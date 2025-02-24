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

# --- AST processing functions ---

def build_env(node):
    """
    Walk the AST and build a mapping from variable names to their assigned expression.
    Only handles simple assignments (single target, no reassignments).
    """
    env = {}
    for stmt in ast.walk(node):
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1:
            target = stmt.targets[0]
            if isinstance(target, ast.Name):
                env[target.id] = stmt.value
    return env

def resolve_expr(node, env):
    """
    Recursively convert an AST node representing a string expression into our grammar.
    Supports:
      - String literals as Literal nodes
      - Concatenation using + as Concat nodes
      - f-strings (converted into Format nodes)
      - %-formatting (BinOp with Mod) as Format nodes
      - .format() calls on strings as Format nodes
      - Variable references (ast.Name)
    """
    if isinstance(node, ast.BinOp):
        if isinstance(node.op, ast.Add):
            left = resolve_expr(node.left, env)
            right = resolve_expr(node.right, env)
            return Concat(left, right)
        elif isinstance(node.op, ast.Mod):
            # %-formatting: left % right
            base = resolve_expr(node.left, env)
            fmt_arg = node.right
            if isinstance(fmt_arg, ast.Tuple):
                args = tuple(resolve_expr(elt, env) for elt in fmt_arg.elts)
            else:
                args = (resolve_expr(fmt_arg, env),)
            return Format(base, *args)
    elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "format":
        # .format() call: e.g., "hello {}".format(x)
        base = resolve_expr(node.func.value, env)
        args = tuple(resolve_expr(arg, env) for arg in node.args)
        kwargs = {kw.arg: resolve_expr(kw.value, env) for kw in node.keywords}
        return Format(base, *args, **kwargs)
    elif isinstance(node, ast.JoinedStr):
        # Convert f-string into a format string: replace each FormattedValue with '{}'
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
            return resolve_expr(env[node.id], env)
        else:
            return Var(node.id)
    else:
        try:
            s = ast.unparse(node)
        except Exception:
            s = "<expr>"
        return Var(s)

def find_assignment_of(var_name, tree):
    """
    Find the assignment node corresponding to a variable name.
    Returns the AST node for the assigned expression.
    """
    for stmt in ast.walk(tree):
        if isinstance(stmt, ast.Assign):
            for target in stmt.targets:
                if isinstance(target, ast.Name) and target.id == var_name:
                    return stmt.value
    return None

# --- The main grammar() function ---

def grammar(var_value):
    """
    To be called at the end of a function.
    This function inspects the caller’s source, builds an AST, and then
    determines how the string was built.
    
    Example usage:
    
      def my_func(a):
          b = a + "hi"
          c = "lo"
          d = b + c
          e = f"i am {d}!"
          print(grammar(e))
    
    For f-strings, the output is now expressed as a Format node. For example:
      Format(Literal("i am {}!"), Concat(Concat(Var('a'), Literal("hi")), Literal("lo")))
    """
    # Get the caller frame and its source
    frame = inspect.currentframe().f_back
    try:
        source = inspect.getsource(frame.f_code)
    except Exception:
        return "<source unavailable>"
    source = textwrap.dedent(source)
    
    # Parse the source code
    tree = ast.parse(source)
    
    # Build an environment mapping variable names to their assigned expressions.
    env = build_env(tree)
    
    # Heuristically determine which variable matches var_value
    target_var = None
    for name, expr in env.items():
        try:
            val = eval(compile(ast.Expression(expr), filename="<ast>", mode="eval"), frame.f_globals, frame.f_locals)
        except Exception:
            continue
        if val == var_value:
            target_var = name
            break

    if target_var is None:
        return "<could not resolve variable>"
    
    assigned_node = env.get(target_var)
    if assigned_node is None:
        return f"<no assignment for {target_var}>"
    
    # Build the grammar representation recursively.
    grammar_rep = resolve_expr(assigned_node, env)
    return grammar_rep

# --- Example usage and test cases ---

if __name__ == "__main__":
    # Example 1: f-string with concatenation
    def example1():
        b = "hi"
        c = "lo"
        d = b + c
        e = f"i am {d}!"
        # f-string becomes a Format node
        print("Example1 grammar(e):", grammar(e))
    example1()

    # Example 2: parameter plus concatenation
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
