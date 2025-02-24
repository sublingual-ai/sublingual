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
        return Var(node.id)
    else:
        try:
            s = ast.unparse(node)
        except Exception:
            s = "<expr>"
        return Var(s)

# --- The main grammar() function ---
# This version only supports a list of OpenAI message dicts.
def grammar(var_value):
    frame = inspect.currentframe().f_back
    try:
        source = inspect.getsource(frame.f_code)
    except Exception:
        return "<source unavailable>"
    source = textwrap.dedent(source)
    tree = ast.parse(source)
    env = build_env_with_flags(tree)

    # --- Robust Call Node Detection ---
    caller_lineno = frame.f_lineno
    class CallFinder(ast.NodeVisitor):
        def __init__(self):
            self.calls = []
        def visit_Call(self, node):
            try:
                func_name = ast.unparse(node.func)
            except Exception:
                func_name = ""
            if func_name.endswith("grammar"):
                self.calls.append(node)
            self.generic_visit(node)
    finder = CallFinder()
    finder.visit(tree)
    candidate_calls = [call for call in finder.calls if call.lineno <= caller_lineno]
    call_node = max(candidate_calls, key=lambda n: n.lineno) if candidate_calls else None

    # --- Fallback: Use source context if call argument isn't a literal
    if call_node is None or not (call_node.args and isinstance(call_node.args[0], (ast.Dict, ast.List))):
        frame_info = inspect.getframeinfo(frame)
        if frame_info.code_context:
            call_source = "".join(frame_info.code_context)
            try:
                call_tree = ast.parse(call_source)
                for node in ast.walk(call_tree):
                    if isinstance(node, ast.Call):
                        try:
                            func_name = ast.unparse(node.func)
                        except Exception:
                            func_name = ""
                        if func_name.endswith("grammar"):
                            call_node = node
                            break
            except Exception:
                pass

    # --- Process a literal list of message dicts.
    if call_node and call_node.args:
        arg_node = call_node.args[0]
        if isinstance(arg_node, ast.List):
            new_list = []
            for elt in arg_node.elts:
                if isinstance(elt, ast.Dict):
                    new_dict = {}
                    for key, value in zip(elt.keys, elt.values):
                        try:
                            key_val = ast.literal_eval(key)
                        except Exception:
                            key_val = None
                        if key_val == "content":
                            new_dict[key_val] = resolve_expr(value, env)
                        else:
                            try:
                                new_dict[key_val] = ast.literal_eval(value)
                            except Exception:
                                new_dict[key_val] = Var(ast.unparse(value))
                    new_list.append(new_dict)
            return new_list

    return "<unsupported input type>"

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

if __name__ == "__main__":
    print("=== Message Test Cases ===")
    example1()
    example2()
    example3()
    example4()
    example5()
    example6()
    example7()
