import ast
import inspect
import textwrap

# --- Helper classes for our grammar representation ---

class Concat:
    def __init__(self, *parts):
        self.parts = parts
    def __repr__(self):
        return "Concat(" + ", ".join(repr(p) for p in self.parts) + ")"
    def get_value(self):
        return "".join(p.get_value() for p in self.parts)
    def __eq__(self, other):
        return isinstance(other, Concat) and self.parts == other.parts

class Var:
    def __init__(self, name):
        self.name = name
    def __repr__(self):
        return f"Var({self.name!r})"
    def get_value(self):
        return self.name
    def __eq__(self, other):
        return isinstance(other, Var) and self.name == other.name

class Literal:
    def __init__(self, value):
        self.value = value
    def __repr__(self):
        return f"Literal({self.value!r})"
    def get_value(self):
        return self.value
    def __eq__(self, other):
        return isinstance(other, Literal) and self.value == other.value

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
    def get_value(self):
        base_val = self.base.get_value()
        args = [arg.get_value() for arg in self.args]
        kwargs = {k: v.get_value() for k, v in self.kwargs.items()}
        if kwargs:
            return base_val.format(*args, **kwargs)
        return base_val.format(*args)
    def __eq__(self, other):
        return (isinstance(other, Format) and 
                self.base == other.base and 
                self.args == other.args and 
                self.kwargs == other.kwargs)

# --- Helper to detect function calls in an AST subtree ---

def contains_call(node):
    for child in ast.walk(node):
        if isinstance(child, ast.Call):
            return True
    return False

# --- Environment Builder (used for non-target variable resolution) ---

class EnvBuilder(ast.NodeVisitor):
    def __init__(self, func_start_line, func_end_line):
        self.env = {}
        self.in_control = False
        self.start_line = func_start_line
        self.end_line = func_end_line

    def generic_visit(self, node):
        old_control = self.in_control
        if isinstance(node, (ast.If, ast.For, ast.While)):
            self.in_control = True
        super().generic_visit(node)
        self.in_control = old_control

    def visit_Assign(self, node):
        # Only process assignments within our function's line range
        if hasattr(node, 'lineno') and self.start_line <= node.lineno <= self.end_line:
            if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                varname = node.targets[0].id
                self.env[varname] = (node.value, self.in_control)
        self.generic_visit(node)

    def visit_Call(self, node):
        # Only process calls within our function's line range
        if hasattr(node, 'lineno') and self.start_line <= node.lineno <= self.end_line:
            if (isinstance(node.func, ast.Attribute) and 
                node.func.attr == 'append' and 
                isinstance(node.func.value, ast.Name)):
                list_name = node.func.value.id
                if list_name in self.env:
                    current_list, dynamic = self.env[list_name]
                    if isinstance(current_list, ast.List):
                        current_list.elts.append(node.args[0])
        self.generic_visit(node)

def build_env_with_flags(tree, start_line, end_line):
    builder = EnvBuilder(start_line, end_line)
    builder.visit(tree)
    return builder.env

# --- AST Processing Function (resolve_expr) ---

def resolve_expr(node, env, _seen=None):
    # Initialize recursion guard set
    if _seen is None:
        _seen = set()
    
    if isinstance(node, ast.Name):
        if node.id in _seen:
            return Var(node.id)  # Break the cycle
        _seen = _seen | {node.id}
        
        # Try to resolve from environment
        if node.id in env:
            value_node, is_dynamic = env[node.id]
            if not is_dynamic:  # If not in control flow, resolve it
                return resolve_expr(value_node, env, _seen)
        return Var(node.id)

    if isinstance(node, ast.Constant):  # Handle all constants, not just strings
        return Literal(str(node.value))  # Convert numbers to strings

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

def get_complete_statement(lines, start_line, forward=True):
    """Extract a complete statement starting from start_line.
    If forward=True, look forward for closing brackets/parens.
    If forward=False, look backward for opening brackets/parens."""
    
    brackets = {
        '(': ')', '[': ']', '{': '}',
        ')': '(', ']': '[', '}': '{'
    }
    stack = []
    collected_lines = []
    
    if forward:
        search_range = range(start_line, len(lines))
    else:
        search_range = range(start_line, -1, -1)
    
    for i in search_range:
        line = lines[i]
        if forward:
            collected_lines.append(line)
        else:
            collected_lines.insert(0, line)
            
        for char in line:
            if char in '([{':
                if forward:
                    stack.append(char)
                else:
                    if stack and stack[-1] == brackets[char]:
                        stack.pop()
                    else:
                        return None
            elif char in ')]}':
                if forward:
                    if stack and stack[-1] == brackets[char]:
                        stack.pop()
                    else:
                        return None
                else:
                    stack.append(char)
                    
        if not stack:
            return '\n'.join(collected_lines)
    
    return None

def get_arg_node(frame, func_name):
    try:
        # Get source and dedent it before parsing
        source = textwrap.dedent(inspect.getsource(frame.f_code))
        
        # Parse the entire function first to build environment
        full_tree = ast.parse(source)
        full_env = build_env_with_flags(full_tree, 1, len(source.split('\n')))
        
        # Get function's line range and call line
        start_line = frame.f_code.co_firstlineno
        call_lineno = frame.f_lineno - start_line + 1
        
        # Extract complete statement
        lines = source.split('\n')
        statement = get_complete_statement(lines, call_lineno - 1)
        
        if statement:
            statement = textwrap.dedent(statement)
            try:
                tree = ast.parse(statement)
                # Use the full environment instead of just statement environment
                call_node = find_call(tree, func_name, 1)
            except Exception:
                return None, full_env
                
            if not call_node:
                return None, full_env

            # Look for messages in keyword arguments first
            for kw in call_node.keywords:
                if kw.arg == 'messages':
                    return kw.value, full_env
            
            # Fall back to first positional arg if no messages keyword found
            if call_node.args:
                return call_node.args[0], full_env

        return None, {}

    except Exception:
        return None, {}

def grammar(var_value):
    arg_node, env = get_arg_node(inspect.currentframe().f_back, "grammar")
    if arg_node is None:
        # If we couldn't get the AST node, try to handle the input value directly
        if isinstance(var_value, dict):
            if "content" in var_value:
                return {"role": var_value.get("role", "user"), 
                       "content": Literal(var_value["content"])}
            return var_value
        elif isinstance(var_value, list):
            return [{"role": msg.get("role", "user"), 
                    "content": Literal(msg["content"]) if "content" in msg else None} 
                   for msg in var_value]
        return "<unsupported input type>"
    return process_messages(arg_node, env)
