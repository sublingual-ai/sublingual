import ast
import inspect
import textwrap

# --- Helper classes for our grammar representation ---

class Concat:
    def __init__(self, *parts):
        self.parts = parts
    def __repr__(self):
        return "Concat(" + ", ".join(repr(p) for p in self.parts) + ")"

class Var:
    def __init__(self, name):
        self.name = name
    def __repr__(self):
        return f"Var({self.name!r})"

class Literal:
    def __init__(self, value):
        self.value = value
    def __repr__(self):
        return f"Literal({self.value!r})"

class Format:
    def __init__(self, base, *args, **kwargs):
        self.base = base
        self.args = args
        self.kwargs = kwargs
    def __repr__(self):
        parts = [repr(self.base)]
        if self.args:
            parts.append(", ".join(repr(a) for a in self.args))
        if self.kwargs:
            parts.append(", ".join(f"{k}={v!r}" for k, v in self.kwargs.items()))
        return "Format(" + ", ".join(parts) + ")"

# --- Helper to detect function calls in an AST subtree ---

def contains_call(node):
    for child in ast.walk(node):
        if isinstance(child, ast.Call):
            return True
    return False

# --- Environment Builder (used for non-target variable resolution) ---

class EnvBuilder(ast.NodeVisitor):
    def __init__(self):
        self.env = {}
        self.in_control = False
    def generic_visit(self, node):
        old_control = self.in_control
        if isinstance(node, (ast.If, ast.For, ast.While)):
            self.in_control = True
        super().generic_visit(node)
        self.in_control = old_control
    def visit_Assign(self, node):
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            varname = node.targets[0].id
            self.env[varname] = (node.value, self.in_control)
        self.generic_visit(node)

    def visit_Call(self, node):
        # Track list.append() calls
        if (isinstance(node.func, ast.Attribute) and 
            node.func.attr == 'append' and 
            isinstance(node.func.value, ast.Name)):
            list_name = node.func.value.id
            if list_name in self.env:
                current_list, dynamic = self.env[list_name]
                if isinstance(current_list, ast.List):
                    # Add the appended item to the list's elements
                    current_list.elts.append(node.args[0])
        self.generic_visit(node)

def build_env_with_flags(tree):
    builder = EnvBuilder()
    builder.visit(tree)
    return builder.env

# --- AST Processing Function (resolve_expr) ---

def resolve_expr(node, env, _seen=None):
    # Initialize recursion guard set
    if _seen is None:
        _seen = set()
    
    # If we're looking up a name, add it to seen set to prevent cycles
    if isinstance(node, ast.Name):
        if node.id in _seen:
            return Var(node.id)  # Break the cycle
        _seen = _seen | {node.id}

    if isinstance(node, ast.BinOp):
        if isinstance(node.op, ast.Add):
            return Concat(resolve_expr(node.left, env, _seen), resolve_expr(node.right, env, _seen))
        elif isinstance(node.op, ast.Mod):
            base = resolve_expr(node.left, env, _seen)
            fmt_arg = node.right
            if isinstance(fmt_arg, ast.Tuple):
                args = tuple(resolve_expr(elt, env, _seen) for elt in fmt_arg.elts)
            else:
                args = (resolve_expr(fmt_arg, env, _seen),)
            return Format(base, *args)
    elif isinstance(node, ast.Call):
        if (isinstance(node.func, ast.Attribute) and node.func.attr == "format"):
            base = resolve_expr(node.func.value, env, _seen)
            args = tuple(resolve_expr(arg, env, _seen) for arg in node.args)
            kwargs = {kw.arg: resolve_expr(kw.value, env, _seen) for kw in node.keywords}
            return Format(base, *args, **kwargs)
        try:
            s = ast.unparse(node)
        except Exception:
            s = "<call>"
        return Var(s)
    elif isinstance(node, ast.JoinedStr):
        fmt_parts = []
        args = []
        for value in node.values:
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                fmt_parts.append(value.value)
            elif isinstance(value, ast.FormattedValue):
                fmt_parts.append("{}")
                args.append(resolve_expr(value.value, env, _seen))
            else:
                fmt_parts.append("<unknown>")
        fmt_str = "".join(fmt_parts)
        return Format(Literal(fmt_str), *args)
    elif isinstance(node, ast.Constant) and isinstance(node.value, str):
        return Literal(node.value)
    elif isinstance(node, ast.Name):
        if node.id in env:
            expr, dynamic = env[node.id]
            if contains_call(expr):
                return Var(node.id)
            if dynamic:
                return Var(node.id)
            else:
                return resolve_expr(expr, env, _seen)
        # If we can't find the variable definition anywhere, assume it's injected
        return Var(node.id)  # This covers both function params and dependency injection
    elif isinstance(node, ast.arg):
        # Handle function parameters
        return Var(node.arg)
    else:
        try:
            s = ast.unparse(node)
        except Exception:
            s = "<expr>"
        return Var(s)

# --- The main grammar() function ---
# This version only supports a list of OpenAI message dicts.

class CallFinder(ast.NodeVisitor):
    def __init__(self, func_name):
        self.calls = []
        self.func_name = func_name
    def visit_Call(self, node):
        try:
            func_str = ast.unparse(node.func)
            # Match the function name passed in the initializer
            if self.func_name in func_str:
                self.calls.append(node)
        except:
            pass
        self.generic_visit(node)

def process_dict(dict_node, env):
    result = {}
    for key, value in zip(dict_node.keys, dict_node.values):
        try:
            key_val = ast.literal_eval(key)
            if key_val == "content":
                result[key_val] = resolve_expr(value, env)
            else:
                result[key_val] = ast.literal_eval(value)
        except Exception:
            continue
    return result

def process_messages(arg_node, env):
    # Handle both direct nodes and variable references
    if isinstance(arg_node, ast.Name) and arg_node.id in env:
        expr, _ = env[arg_node.id]
        if not contains_call(expr):
            arg_node = expr
    
    # Process the node
    if isinstance(arg_node, ast.List):
        result = []
        for elt in arg_node.elts:
            if isinstance(elt, ast.Dict):
                result.append(process_dict(elt, env))
            elif isinstance(elt, ast.Name) and elt.id in env:
                expr, _ = env[elt.id]
                if isinstance(expr, ast.Dict):
                    result.append(process_dict(expr, env))
        return result if result else "<unsupported input type>"
    elif isinstance(arg_node, ast.Dict):
        result = process_dict(arg_node, env)
        return result if result else "<unsupported input type>"
    return "<unsupported input type>"

def find_call(tree, func_name, lineno):
    finder = CallFinder(func_name)
    finder.visit(tree)
    
    # First try to find exact line matches
    exact_matches = [call for call in finder.calls if call.lineno == lineno]
    
    if exact_matches:
        return exact_matches[0]
    
    # If no exact match, look for the closest preceding call
    preceding_calls = [call for call in finder.calls if call.lineno < lineno]
    if preceding_calls:
        closest_call = max(preceding_calls, key=lambda x: x.lineno)
        if lineno - closest_call.lineno <= 5:
            return closest_call
    
    # If still no match found, look for the closest call after
    following_calls = [call for call in finder.calls if call.lineno > lineno]
    if following_calls:
        closest_call = min(following_calls, key=lambda x: x.lineno)
        if closest_call.lineno - lineno <= 5:
            return closest_call
            
    return None

def get_arg_node(frame, func_name):
    try:
        # Get the source code from multiple potential sources
        source = None
        filename = frame.f_code.co_filename
        
        # Try to get source from the file first
        try:
            with open(filename, 'r') as f:
                source = f.read()
        except Exception:
            pass
            
        # If file read failed, try getting source from frame
        if not source:
            try:
                source = textwrap.dedent(inspect.getsource(frame.f_code))
            except Exception:
                return None, {}

        tree = ast.parse(source)
        env = build_env_with_flags(tree)
        
        # Get the call at the exact line number
        call_node = find_call(tree, func_name, frame.f_lineno)
        
        if not call_node:
            return None, env

        # Look for messages in keyword arguments first
        for kw in call_node.keywords:
            if kw.arg == 'messages':
                return kw.value, env
        
        # Fall back to first positional arg if no messages keyword found
        if call_node.args:
            return call_node.args[0], env

        return None, env

    except Exception:
        return None, {}

def grammar(var_value):
    arg_node, env = get_arg_node(inspect.currentframe().f_back, "grammar")
    if arg_node is None:
        return "<unsupported input type>"
    return process_messages(arg_node, env)

# --- Unit Test Cases: Seven examples using variable-defined content in a literal dict ---

def example1():
    # Example 1: f-string with concatenation (static assignment)
    b = "hi"
    c = "lo"
    d = b + c
    e = f"i am {d}!"
    # Passing a literal list with the variable 'e'
    print("Example1 grammar(messages):", grammar([{"role": "user", "content": e}]))

def example2():
    # Example 2: Parameter plus concatenation (simulated inline)
    a = "greetings, "
    b = a + "hi"
    c = "lo"
    d = b + c
    e = f"i am {d}!"
    print("Example2 grammar(messages):", grammar([{"role": "user", "content": e}]))

def example3():
    # Example 3: %-formatting
    s = "Hello, %s" % "world"
    print("Example3 grammar(messages):", grammar([{"role": "user", "content": s}]))

def example4():
    # Example 4: .format() formatting
    s = "Sum: {} + {} = {}".format(1, 2, 3)
    print("Example4 grammar(messages):", grammar([{"role": "user", "content": s}]))

def example5():
    # Example 5: Conditional expression (dynamic update simulation)
    x = "hello"
    if True:
        x = x + " world"
    print("Example5 grammar(messages):", grammar([{"role": "user", "content": x}]))

def example6():
    # Example 6: Chain simulation (updates in a loop simulated inline)
    s = "start"
    for i in range(2):
        s = s + " loop"
    s = s + "end"
    print("Example6 grammar(messages):", grammar([{"role": "user", "content": s}]))

def example7():
    # Example 7: File read simulation with open() (non-literal parts become Vars)
    s = "start"
    with open(".gitignore", "r") as f:
        a = f.read().split("\n")[0]
    for i in range(2):
        s = s + " loop"
    s = s + "end"
    s = s + a
    print("Example7 grammar(messages):", grammar([{"role": "user", "content": s}]))

def example8():
    # Example 8: Using a variable to hold the message dict
    msg = {
        "role": "user",
        "content": "Hello " + "world"
    }
    print("\nExample 8 (variable dict) grammar(message):")
    print(grammar(msg))
    
    msgs = [
        {"role": "system", "content": "System: " + ("Init " + "complete")},
        {"role": "user", "content": "User: " + "How are you?"}
    ]
    print("\nExample 8 (variable list) grammar(messages):")
    print(grammar(msgs))

def example9():
    # Example 9: Variable dict/list with f-strings and concatenation
    b = "hi"
    c = "lo"
    d = b + c
    e = f"i am {d}!"
    
    # Variable dict with f-string content
    msg = {
        "role": "user",
        "content": e
    }
    print("\nExample 9 (variable dict with f-string) grammar(message):")
    print(grammar(msg))
    
    # Variable list with format() and %-formatting
    s1 = "Hello, %s" % "world"
    s2 = "Sum: {} + {} = {}".format(1, 2, 3)
    msgs = [
        {"role": "system", "content": s1},
        {"role": "user", "content": s2}
    ]
    print("\nExample 9 (variable list with formatting) grammar(messages):")
    print(grammar(msgs))

def example10():
    # Example 10: Variable dict/list with dynamic content
    # Dynamic string building
    x = "hello"
    if True:
        x = x + " world"
    
    # Loop-based string building
    s = "start"
    for i in range(2):
        s = s + " loop"
    s = s + "end"
    
    # Variable dict with dynamic content
    msg = {
        "role": "user",
        "content": x + " - " + s
    }
    print("\nExample 10 (variable dict with dynamic content) grammar(message):")
    print(grammar(msg))
    
    # Variable list with file read simulation
    with open(".gitignore", "r") as f:
        a = f.read().split("\n")[0]
    
    msgs = [
        {"role": "system", "content": "System message: " + s},
        {"role": "user", "content": "File content: " + a}
    ]
    print("\nExample 10 (variable list with file read) grammar(messages):")
    print(grammar(msgs))

if __name__ == "__main__":
    print("=== Message Test Cases ===")
    example1()
    example2()
    example3()
    example4()
    example5()
    example6()
    example7()
    example8()
    example9()
    example10()
