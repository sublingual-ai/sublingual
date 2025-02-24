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

# --- Environment Builder (used for non-target variable resolution) ---

class EnvBuilder(ast.NodeVisitor):
    """
    Build a mapping of variable names to (final_assigned_ast, dynamic_flag).
    This is used for resolving references inside expressions.
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
            # Always store the final assignment and mark dynamic if inside control flow.
            self.env[varname] = (node.value, self.in_control)
        self.generic_visit(node)

def build_env_with_flags(tree):
    builder = EnvBuilder()
    builder.visit(tree)
    return builder.env

# --- Collecting Assignments for the Target Variable ---

def collect_assignments(tree, var_name):
    """
    Returns a list of assignments to var_name as tuples:
    (lineno, assign_node, dynamic_flag)
    """
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
            if (len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) and 
                node.targets[0].id == var_name):
                self.assignments.append((node.lineno, node, self.in_dynamic))
            self.generic_visit(node)
    collector = AssignmentCollector()
    collector.visit(tree)
    assignments = sorted(collector.assignments, key=lambda x: x[0])
    return assignments

# --- Sequential Simulation of the Assignment Chain ---

def simulate_chain(var_name, assignments, env):
    """
    Simulate the symbolic chain for variable var_name using its assignments.
    For assignments of the form:
        X = X + Y
    we update the chain as follows:
      - If the assignment is dynamic, set chain = Concat(Var(X), resolved(Y))
        and mark the chain as dynamic.
      - If the assignment is static:
          * If the previous chain was dynamic, reset the chain as
                Concat(Var(X), resolved(Y))
          * Otherwise, update as chain = Concat(previous_chain, resolved(Y)).
    For a simple (non-concat) assignment, simply resolve the expression.
    """
    chain = None
    static_chain = True  # True if the chain so far is built statically.
    for _, node, dyn in assignments:
        # Check if assignment is of the form X = X + Y.
        if isinstance(node.value, ast.BinOp) and isinstance(node.value.op, ast.Add):
            left = node.value.left
            right = node.value.right
            if isinstance(left, ast.Name) and left.id == var_name:
                # It's a self concatenation.
                if chain is None:
                    # First assignment of this pattern.
                    if dyn:
                        base = Var(var_name)
                        static_chain = False
                    else:
                        base = resolve_expr(left, env)  # usually initial value
                        static_chain = True
                    chain = Concat(base, resolve_expr(right, env))
                else:
                    if dyn:
                        # Dynamic update: reset left to Var(var_name)
                        chain = Concat(Var(var_name), resolve_expr(right, env))
                        static_chain = False
                    else:
                        # Static update:
                        if static_chain:
                            base = chain
                        else:
                            base = Var(var_name)
                        chain = Concat(base, resolve_expr(right, env))
                        static_chain = True
            else:
                # Not of the form X = X + ...; override chain.
                chain = resolve_expr(node.value, env)
                static_chain = not dyn
        else:
            # Simple assignment.
            chain = resolve_expr(node.value, env)
            static_chain = not dyn
    return chain

# --- AST Processing Function (resolve_expr) ---

def resolve_expr(node, env):
    """
    Recursively convert an AST node representing a string expression into our grammar.
    Supports:
      - String literals as Literal nodes
      - Concatenation (using +) as Concat nodes
      - f-strings (converted into Format nodes)
      - %-formatting and .format() calls as Format nodes
      - Variable references: if marked dynamic in env, return Var; otherwise, resolve.
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
    This function retrieves the caller’s source, parses it, and:
      1. Identifies the target variable by matching its value.
      2. Collects all assignments to that variable.
      3. Simulates the chain of string operations.
    """
    frame = inspect.currentframe().f_back
    try:
        source = inspect.getsource(frame.f_code)
    except Exception:
        return "<source unavailable>"
    source = textwrap.dedent(source)
    tree = ast.parse(source)
    env = build_env_with_flags(tree)
    
    # Heuristically find the target variable by comparing evaluated assignments.
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
        # Fallback: check f_locals.
        for name in frame.f_locals:
            if frame.f_locals[name] == var_value:
                target_var = name
                break
        if target_var is None:
            return "<could not resolve variable>"
    
    # Collect assignments for the target variable.
    assignments = collect_assignments(tree, target_var)
    if assignments:
        chain = simulate_chain(target_var, assignments, env)
        return chain
    else:
        expr, dynamic = env.get(target_var, (None, True))
        if expr is None:
            return Var(target_var)
        return resolve_expr(expr, env)

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
        a = "ba"
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
    example7()

if __name__ == "__main__":
    print("=== Old Test Cases ===")
    old_test_cases()
    print("\n=== New Test Cases ===")
    new_test_cases()
