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

# --- Environment Builder with Control Flow Awareness ---

class EnvBuilder(ast.NodeVisitor):
    """
    Builds an environment mapping variable names to a tuple (expr, dynamic_flag),
    where expr is the AST node of its *final* assignment and dynamic_flag is True if the
    variable was ever assigned within a control flow block (if/for/while) or reassigned.
    """
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
            # If this variable was already assigned, mark as dynamic.
            if varname in self.env:
                self.env[varname] = (node.value, True)
            else:
                # Mark as dynamic if currently in control flow.
                self.env[varname] = (node.value, self.in_control)
        self.generic_visit(node)

def build_env_with_flags(tree):
    """
    Build an environment mapping variable names to (expr, dynamic_flag) using EnvBuilder.
    """
    builder = EnvBuilder()
    builder.visit(tree)
    return builder.env

# --- AST processing functions ---

def resolve_expr(node, env):
    """
    Recursively convert an AST node representing a string expression into our grammar.
    Supports:
      - String literals as Literal nodes
      - Concatenation using + as Concat nodes
      - f-strings (converted into Format nodes)
      - %-formatting (BinOp with Mod) as Format nodes
      - .format() calls on strings as Format nodes
      - Variable references (ast.Name); if the variable is dynamic, return Var
    """
    if isinstance(node, ast.BinOp):
        if isinstance(node.op, ast.Add):
            left = resolve_expr(node.left, env)
            right = resolve_expr(node.right, env)
            return Concat(left, right)
        elif isinstance(node.op, ast.Mod):
            base = resolve_expr(node.left, env)
            fmt_arg = node.right
            if isinstance(fmt_arg, ast.Tuple):
                args = tuple(resolve_expr(elt, env) for elt in fmt_arg.elts)
            else:
                args = (resolve_expr(fmt_arg, env),)
            return Format(base, *args)
    elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "format":
        base = resolve_expr(node.func.value, env)
        args = tuple(resolve_expr(arg, env) for arg in node.args)
        kwargs = {kw.arg: resolve_expr(kw.value, env) for kw in node.keywords}
        return Format(base, *args, **kwargs)
    elif isinstance(node, ast.JoinedStr):
        fmt_parts = []
        args = []
        for value in node.values:
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                fmt_parts.append(value.value)
            elif isinstance(value, ast.FormattedValue):
                fmt_parts.append("{}")
                args.append(resolve_expr(value.value, env))
            else:
                fmt_parts.append("<unknown>")
        fmt_str = "".join(fmt_parts)
        return Format(Literal(fmt_str), *args)
    elif isinstance(node, ast.Constant) and isinstance(node.value, str):
        return Literal(node.value)
    elif isinstance(node, ast.Name):
        if node.id in env:
            expr, dynamic = env[node.id]
            if dynamic:
                return Var(node.id)
            else:
                return resolve_expr(expr, env)
        else:
            return Var(node.id)
    else:
        try:
            s = ast.unparse(node)
        except Exception:
            s = "<expr>"
        return Var(s)

# --- The main grammar() function ---

def grammar(var_value):
    """
    To be called at the end of a function.
    This function inspects the caller’s source, builds an AST, and then
    determines how the string was built.
    
    The final assignment is always resolved if available.
    Within that AST, any reference to a variable that was updated dynamically
    will appear as Var.
    """
    frame = inspect.currentframe().f_back
    try:
        source = inspect.getsource(frame.f_code)
    except Exception:
        return "<source unavailable>"
    source = textwrap.dedent(source)
    
    tree = ast.parse(source)
    env = build_env_with_flags(tree)
    
    # Heuristically determine which variable matches var_value.
    target_var = None
    for name, (expr, dynamic) in env.items():
        if expr is None:
            continue
        try:
            val = eval(compile(ast.Expression(expr), filename="<ast>", mode="eval"),
                       frame.f_globals, frame.f_locals)
        except Exception:
            continue
        if val == var_value:
            target_var = name
            break

    if target_var is None:
        # Fallback: for dynamic variables, check f_locals
        for name in frame.f_locals:
            if frame.f_locals[name] == var_value:
                target_var = name
                break
        if target_var is None:
            return "<could not resolve variable>"
    
    expr, dynamic = env.get(target_var, (None, True))
    if expr is None:
        return Var(target_var)
    
    # Always resolve the final assignment AST.
    grammar_rep = resolve_expr(expr, env)
    return grammar_rep

# --- Example usage and test cases ---

def old_test_cases():
    # Example 1: f-string with concatenation (static assignment)
    def example1():
        b = "hi"
        c = "lo"
        d = b + c
        e = f"i am {d}!"
        print("Example1 grammar(e):", grammar(e))
    example1()

    # Example 2: parameter plus concatenation (static assignment for d)
    def example2(a):
        b = a + "hi"
        c = "lo"
        d = b + c
        e = f"i am {d}!"
        print("Example2 grammar(d):", grammar(d))
    example2("greetings, ")

    # Example 3: %-formatting
    def example3():
        s = "Hello, %s" % "world"
        print("Example3 grammar(s):", grammar(s))
    example3()

    # Example 4: .format() formatting
    def example4():
        s = "Sum: {} + {} = {}".format(1, 2, 3)
        print("Example4 grammar(s):", grammar(s))
    example4()

def new_test_cases():
    # Example 5: variable updated in an if statement (dynamic)
    def example5():
        x = "hello"
        if True:
            x = x + " world"
        print("Example5 grammar(x):", grammar(x))
    example5()

    # Example 6: variable updated in a for loop, then updated outside (dynamic final assignment)
    def example6():
        s = "start"
        for i in range(2):
            s = s + " loop"
        s = s + "end"
        print("Example6 grammar(s):", grammar(s))
    example6()

if __name__ == "__main__":
    print("=== Old Test Cases ===")
    old_test_cases()
    print("\n=== New Test Cases ===")
    new_test_cases()
