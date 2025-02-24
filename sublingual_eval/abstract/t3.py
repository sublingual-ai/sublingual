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

# --- Collecting Assignments for the Target Variable ---

def collect_assignments(tree, var_name):
    assignments = []
    class AssignmentCollector(ast.NodeVisitor):
        def __init__(self):
            self.assignments = []
            self.in_dynamic = False
        def generic_visit(self, node):
            old = self.in_dynamic
            if isinstance(node, (ast.If, ast.For, ast.While)):
                self.in_dynamic = True
            super().generic_visit(node)
            self.in_dynamic = old
        def visit_Assign(self, node):
            if (len(node.targets) == 1 and isinstance(node.targets[0], ast.Name)
                and node.targets[0].id == var_name):
                self.assignments.append((node.lineno, node, self.in_dynamic))
            self.generic_visit(node)
    collector = AssignmentCollector()
    collector.visit(tree)
    return sorted(collector.assignments, key=lambda x: x[0])

# --- Sequential Simulation of the Assignment Chain ---
# We first determine the last dynamic assignment (if any) and then simulate only the assignments that follow.
def simulate_chain(var_name, assignments, env):
    last_dynamic_line = None
    for lineno, _, dyn in assignments:
        if dyn:
            last_dynamic_line = lineno
    if last_dynamic_line is not None:
        static_assignments = [a for a in assignments if a[0] > last_dynamic_line]
    else:
        static_assignments = assignments
    if not static_assignments:
        # If no static updates occur after a dynamic update, halt propagation.
        return Var(var_name)
    chain = None
    asterisk_count = 0
    for _, node, _ in static_assignments:
        if isinstance(node.value, ast.BinOp) and isinstance(node.value.op, ast.Add):
            left = node.value.left
            right = node.value.right
            if isinstance(left, ast.Name) and left.id == var_name:
                asterisk_count += 1
                base = Var(var_name + "*" * asterisk_count)
                if chain is None:
                    chain = Concat(base, resolve_expr(right, env))
                else:
                    chain = Concat(chain, resolve_expr(right, env))
            else:
                chain = resolve_expr(node.value, env)
                asterisk_count = 0
        else:
            chain = resolve_expr(node.value, env)
            asterisk_count = 0
    return chain

# --- AST Processing Function (resolve_expr) ---
# Any function call (other than .format() calls) is returned as a Var.
def resolve_expr(node, env):
    if isinstance(node, ast.BinOp):
        if isinstance(node.op, ast.Add):
            return Concat(resolve_expr(node.left, env), resolve_expr(node.right, env))
        elif isinstance(node.op, ast.Mod):
            base = resolve_expr(node.left, env)
            fmt_arg = node.right
            if isinstance(fmt_arg, ast.Tuple):
                args = tuple(resolve_expr(elt, env) for elt in fmt_arg.elts)
            else:
                args = (resolve_expr(fmt_arg, env),)
            return Format(base, *args)
    elif isinstance(node, ast.Call):
        # If it's a .format() call, handle it specially.
        if (isinstance(node.func, ast.Attribute) and node.func.attr == "format"):
            base = resolve_expr(node.func.value, env)
            args = tuple(resolve_expr(arg, env) for arg in node.args)
            kwargs = {kw.arg: resolve_expr(kw.value, env) for kw in node.keywords}
            return Format(base, *args, **kwargs)
        # For any other function call, simply return a Var.
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
            if contains_call(expr):
                return Var(node.id)
            if dynamic:
                return Var(node.id)
            else:
                return resolve_expr(expr, env)
        return Var(node.id)
    else:
        try:
            s = ast.unparse(node)
        except Exception:
            s = "<expr>"
        return Var(s)

# --- The main grammar() function ---

def grammar(var_value):
    frame = inspect.currentframe().f_back
    try:
        source = inspect.getsource(frame.f_code)
    except Exception:
        return "<source unavailable>"
    source = textwrap.dedent(source)
    tree = ast.parse(source)
    env = build_env_with_flags(tree)
    
    target_var = None
    for name, (expr, _) in env.items():
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
        for name in frame.f_locals:
            if frame.f_locals[name] == var_value:
                target_var = name
                break
        if target_var is None:
            return "<could not resolve variable>"
    
    assignments = collect_assignments(tree, target_var)
    if assignments:
        return simulate_chain(target_var, assignments, env)
    else:
        expr, dynamic = env.get(target_var, (None, True))
        if expr is None:
            return Var(target_var)
        return resolve_expr(expr, env)

# --- Test Cases ---

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
    # Example 5: variable updated in an if statement (dynamic update)
    def example5():
        x = "hello"
        if True:
            x = x + " world"
        print("Example5 grammar(x):", grammar(x))
    example5()

    # Example 6: variable updated in a for loop then updated outside (chain simulation)
    def example6():
        s = "start"
        a = "a"
        for i in range(2):
            s = s + " loop"
        s = s + "end"
        s = s + a
        print("Example6 grammar(s):", grammar(s))
    example6()

def example7():
    s = "start"
    with open(".gitignore", "r") as f:
        a = f.read().split("\n")[0]
    for i in range(2):
        s = s + " loop"
    s = s + "end"
    s = s + a
    print("Example7 grammar(s):", grammar(s))

if __name__ == "__main__":
    print("=== Old Test Cases ===")
    old_test_cases()
    print("\n=== New Test Cases ===")
    new_test_cases()
    print("\n=== Example 7 ===")
    example7()
