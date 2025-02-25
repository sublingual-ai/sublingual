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
    def to_dict(self):
        return {
            "type": "Concat",
            "parts": [p.to_dict() for p in self.parts]
        }

class Var:
    def __init__(self, name):
        self.name = name
    def __repr__(self):
        return f"Var({self.name!r})"
    def get_value(self):
        return self.name
    def __eq__(self, other):
        return isinstance(other, Var) and self.name == other.name
    def to_dict(self):
        return {
            "type": "Var",
            "name": self.name
        }

class InferredVar(Var):
    def __init__(self, name, value):
        super().__init__(name)
        self.value = value
    def __repr__(self):
        return f"InferredVar({self.name!r}, {self.value!r})"
    def get_value(self):
        return str(self.value)
    def __eq__(self, other):
        return isinstance(other, InferredVar) and self.name == other.name and self.value == other.value
    def to_dict(self):
        return {
            "type": "InferredVar",
            "name": self.name,
            "value": self.value
        }

class Literal:
    def __init__(self, value):
        self.value = value
    def __repr__(self):
        return f"Literal({self.value!r})"
    def get_value(self):
        return self.value
    def __eq__(self, other):
        return isinstance(other, Literal) and self.value == other.value
    def to_dict(self):
        return {
            "type": "Literal",
            "value": self.value
        }

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
    def to_dict(self):
        return {
            "type": "Format",
            "base": self.base.to_dict(),
            "args": [arg.to_dict() for arg in self.args],
            "kwargs": {k: v.to_dict() for k, v in self.kwargs.items()}
        }

# --- Helper to detect function calls in an AST subtree ---

def contains_call(node):
    for child in ast.walk(node):
        if isinstance(child, ast.Call):
            return True
    return False

# --- Helper to decide if an AST node is "naive" ---
# For BinOp with Add, it is considered naive only if both operands are naive.
def is_naive(node):
    if isinstance(node, ast.Constant):
        return True
    if isinstance(node, ast.JoinedStr):
        return True
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return is_naive(node.left) and is_naive(node.right)
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
# Added extra parameter f_locals to fetch runtime values when needed.

def resolve_expr(node, env, _seen=None, f_locals=None):
    if _seen is None:
        _seen = set()
    
    if isinstance(node, ast.Name):
        if node.id in _seen:
            return Var(node.id)  # Break the cycle
        _seen = _seen | {node.id}
        if node.id in env:
            value_node, is_dynamic = env[node.id]
            
            # For control flow (is_dynamic), we want Var unless it's a complex computation
            if is_dynamic:
                # For simple string operations in control flow, use Var
                if isinstance(value_node, (ast.BinOp, ast.Call, ast.JoinedStr)):
                    return Var(node.id)
                # For other operations in control flow with available value, use InferredVar
                if f_locals and node.id in f_locals:
                    value = f_locals[node.id]
                    if value is not None:
                        return InferredVar(node.id, value)
                return Var(node.id)
            
            # For non-dynamic, non-call expressions, resolve normally
            return resolve_expr(value_node, env, _seen, f_locals)
        # If not in env but in f_locals, use InferredVar
        if f_locals and node.id in f_locals:
            value = f_locals[node.id]
            if value is not None:
                return InferredVar(node.id, value)
        return Var(node.id)

    if isinstance(node, ast.Constant):
        return Literal(str(node.value))

    if isinstance(node, ast.BinOp):
        if isinstance(node.op, ast.Add):
            # If either operand involves a function call, we should get the runtime value
            if contains_call(node):
                # Try to find this expression's variable name in the environment
                for var_name, (var_node, is_dynamic) in env.items():
                    if (ast.dump(var_node) == ast.dump(node) and 
                        f_locals and var_name in f_locals):
                        return InferredVar(var_name, f_locals[var_name])
            # Otherwise handle as normal concatenation
            return Concat(
                resolve_expr(node.left, env, _seen, f_locals),
                resolve_expr(node.right, env, _seen, f_locals)
            )
        elif isinstance(node.op, ast.Mod):
            base = resolve_expr(node.left, env, _seen, f_locals)
            fmt_arg = node.right
            if isinstance(fmt_arg, ast.Tuple):
                args = tuple(resolve_expr(elt, env, _seen, f_locals) for elt in fmt_arg.elts)
            else:
                args = (resolve_expr(fmt_arg, env, _seen, f_locals),)
            return Format(base, *args)
    elif isinstance(node, ast.Call):
        if (isinstance(node.func, ast.Attribute) and node.func.attr == "format"):
            base = resolve_expr(node.func.value, env, _seen, f_locals)
            args = tuple(resolve_expr(arg, env, _seen, f_locals) for arg in node.args)
            kwargs = {kw.arg: resolve_expr(kw.value, env, _seen, f_locals) for kw in node.keywords}
            return Format(base, *args, **kwargs)
        try:
            s = ast.unparse(node)
        except Exception:
            s = "<call>"
        return Var(s)
    elif isinstance(node, ast.JoinedStr):
        # Check if this f-string contains any complex expressions
        has_complex_expr = False
        
        # First check if this JoinedStr is assigned to a variable in a complex context
        for var_name, (var_node, is_dynamic) in env.items():
            if (ast.dump(var_node) == ast.dump(node) and 
                var_name in f_locals and
                is_dynamic):
                return InferredVar(var_name, f_locals[var_name])
        
        # Then check individual expressions within the f-string
        for value in node.values:
            if isinstance(value, ast.FormattedValue):
                if (isinstance(value.value, (ast.IfExp, ast.Call, ast.GeneratorExp, ast.ListComp, ast.SetComp, ast.DictComp)) or 
                    contains_call(value.value)):
                    has_complex_expr = True
                    break
        
        # If we have complex expressions and f_locals is available, use InferredVar
        if has_complex_expr and f_locals:
            # Try to find this expression's variable name in the environment
            for var_name, (var_node, is_dynamic) in env.items():
                if (ast.dump(var_node) == ast.dump(node) and 
                    var_name in f_locals):
                    return InferredVar(var_name, f_locals[var_name])
            
            # If we couldn't find the exact variable, look for any variable with matching value
            for var_name, value in f_locals.items():
                if isinstance(value, str) and value == ast.unparse(node):
                    return InferredVar(var_name, value)
        
        # Otherwise handle normally
        fmt_parts = []
        args = []
        for value in node.values:
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                fmt_parts.append(value.value)
            elif isinstance(value, ast.FormattedValue):
                fmt_parts.append("{}")
                args.append(resolve_expr(value.value, env, _seen, f_locals))
            else:
                fmt_parts.append("<unknown>")
        fmt_str = "".join(fmt_parts)
        return Format(Literal(fmt_str), *args)
    elif isinstance(node, ast.arg):
        # Handle function parameters - use InferredVar if we have the value
        if f_locals and node.arg in f_locals:
            return InferredVar(node.arg, f_locals[node.arg])
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
            if self.func_name in func_str:
                self.calls.append(node)
        except:
            pass
        self.generic_visit(node)

def process_dict(dict_node, env, f_locals=None):
    result = {}
    for key, value in zip(dict_node.keys, dict_node.values):
        try:
            key_val = ast.literal_eval(key)
            if key_val == "content":
                result[key_val] = resolve_expr(value, env, f_locals=f_locals)
            else:
                try:
                    result[key_val] = ast.literal_eval(value)
                except:
                    if f_locals and isinstance(value, ast.Name) and value.id in f_locals:
                        result[key_val] = f_locals[value.id]
        except Exception:
            continue
    return result

def process_messages(arg_node, env, f_locals=None):
    # FIX: if arg_node is a Name, replace it with its assignment expression
    if isinstance(arg_node, ast.Name) and arg_node.id in env:
        value_node, _ = env[arg_node.id]
        arg_node = value_node

    if isinstance(arg_node, ast.List):
        result = []
        for elt in arg_node.elts:
            if isinstance(elt, ast.Dict):
                result.append(process_dict(elt, env, f_locals=f_locals))
            elif isinstance(elt, ast.Name) and elt.id in env:
                expr, _ = env[elt.id]
                if isinstance(expr, ast.Dict):
                    result.append(process_dict(expr, env, f_locals=f_locals))
        return result if result else f"<Expected non-empty list of message dictionaries, got empty list>"
    elif isinstance(arg_node, ast.Dict):
        result = process_dict(arg_node, env, f_locals=f_locals)
        return result if result else f"<Expected valid message dictionary with 'content' field, got dictionary without content>"
    return f"<Expected a list of message dictionaries or a single message dictionary, got {type(arg_node).__name__}>"

def find_call(tree, func_name, lineno):
    finder = CallFinder(func_name)
    finder.visit(tree)
    
    exact_matches = [call for call in finder.calls if call.lineno == lineno]
    if exact_matches:
        return exact_matches[0]
    
    preceding_calls = [call for call in finder.calls if call.lineno < lineno]
    if preceding_calls:
        closest_call = max(preceding_calls, key=lambda x: x.lineno)
        if lineno - closest_call.lineno <= 5:
            return closest_call
    
    following_calls = [call for call in finder.calls if call.lineno > lineno]
    if following_calls:
        closest_call = min(following_calls, key=lambda x: x.lineno)
        if closest_call.lineno - lineno <= 5:
            return closest_call
            
    return None

def get_complete_statement(lines, start_line, forward=True):
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
        source = textwrap.dedent(inspect.getsource(frame.f_code))
        full_tree = ast.parse(source)
        full_env = build_env_with_flags(full_tree, 1, len(source.split('\n')))
        start_line = frame.f_code.co_firstlineno
        call_lineno = frame.f_lineno - start_line + 1
        lines = source.split('\n')
        statement = get_complete_statement(lines, call_lineno - 1)
        
        if statement:
            statement = textwrap.dedent(statement)
            try:
                tree = ast.parse(statement)
                call_node = find_call(tree, func_name, 1)
            except Exception:
                return None, full_env
                
            if not call_node:
                return None, full_env

            for kw in call_node.keywords:
                if kw.arg == 'messages':
                    return kw.value, full_env
            
            if call_node.args:
                return call_node.args[0], full_env

        return None, {}

    except Exception:
        return None, {}

def grammar(var_value):
    caller_frame = inspect.currentframe().f_back
    arg_node, env = get_arg_node(caller_frame, "grammar")
    if arg_node is None:
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
    return process_messages(arg_node, env, f_locals=caller_frame.f_locals)

def convert_grammar_to_dict(grammar_result):
    """Convert grammar objects to JSON-serializable dictionaries"""
    if isinstance(grammar_result, list):
        return [
            {k: msg[k].to_dict() if hasattr(msg[k], 'to_dict') else msg[k] 
             for k in msg}
            for msg in grammar_result
        ]
    elif isinstance(grammar_result, dict):
        return {
            k: v.to_dict() if hasattr(v, 'to_dict') else v 
            for k, v in grammar_result.items()
        }
    return grammar_result
