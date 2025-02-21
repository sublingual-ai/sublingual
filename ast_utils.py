import ast
import astor  # pip install astor if needed
import inspect

# ---------- Helper Classes for Symbolic Tokens ----------

class Literal:
    def __init__(self, value):
        self.value = value

    def __str__(self):
        return self.value

    def __repr__(self):
        return f'Literal({self.value!r})'

class Var:
    def __init__(self, name):
        self.name = name

    def __str__(self):
        return '{' + self.name + '}'

    def __repr__(self):
        return f'Var({self.name!r})'

class FuncCall:
    def __init__(self, func_name, args):
        self.func_name = func_name
        self.args = args  # List of tokens for the arguments

    def __str__(self):
        args_str = ", ".join(str(arg) for arg in self.args)
        return f"{self.func_name}({args_str})"

    def __repr__(self):
        return f'FuncCall({self.func_name!r}, {self.args!r})'

# ---------- AST Visitor for Symbolic Prompt Decompilation ----------

class PromptSymbolicVisitor(ast.NodeVisitor):
    def __init__(self):
        # Final tokens will be stored as a list of representations.
        # For assignments (like prompt = ...), we wrap the token list in a list.
        # For calls with messages, we produce one token list per message.
        self.tokens = []
        # Environment: map variable names to their assigned AST nodes.
        self.env = {}

    def visit_Assign(self, node):
        # Record assignments in the environment.
        for target in node.targets:
            if isinstance(target, ast.Name):
                self.env[target.id] = node.value
                # If the variable is 'prompt', process it.
                if target.id == 'prompt':
                    self.tokens = [self.process_expr(node.value)]
        self.generic_visit(node)

    def visit_Call(self, node):
        # Look for a call to completions.create (e.g. client.chat.completions.create)
        if isinstance(node.func, ast.Attribute) and node.func.attr == "create":
            # Check for keyword argument "messages"
            for kw in node.keywords:
                if kw.arg == "messages":
                    # Process the messages to produce a symbolic representation per message.
                    self.tokens = self.process_messages(kw.value)
        self.generic_visit(node)

    def process_messages(self, node):
        """
        Process the 'messages' argument which is expected to be a list of dicts.
        For each dict, if it has a key "content", produce a separate token list.
        """
        messages_tokens = []
        if isinstance(node, ast.List):
            for elt in node.elts:
                if isinstance(elt, ast.Dict):
                    for key, value in zip(elt.keys, elt.values):
                        if isinstance(key, ast.Constant) and key.value == "content":
                            tokens = self.process_expr(value)
                            messages_tokens.append(tokens)
        return messages_tokens

    def process_expr(self, node):
        # Case 1: Literal strings via ast.Constant.
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return [Literal(node.value)]
        # Case 2: f-string (JoinedStr)
        elif isinstance(node, ast.JoinedStr):
            tokens = []
            for value in node.values:
                if isinstance(value, ast.Constant) and isinstance(value.value, str):
                    tokens.append(Literal(value.value))
                elif isinstance(value, ast.FormattedValue):
                    # For a formatted value, check if it's a simple variable.
                    if isinstance(value.value, ast.Name):
                        var_name = value.value.id
                        if var_name in self.env:
                            # Instead of a simple Var, substitute with the symbolic representation
                            # of its assigned expression.
                            tokens.extend(self.process_expr(self.env[var_name]))
                        else:
                            tokens.append(Var(var_name))
                    elif isinstance(value.value, ast.Call):
                        tokens.append(self.process_function_call(value.value))
                    else:
                        expr = astor.to_source(value.value).strip()
                        tokens.append(Literal("{" + expr + "}"))
            return tokens
        # Case 3: String concatenation using +
        elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            left_tokens = self.process_expr(node.left)
            right_tokens = self.process_expr(node.right)
            return left_tokens + right_tokens
        # Case 4: Handling .format() calls
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr == 'format':
                base_tokens = self.process_expr(node.func.value)
                args_tokens = []
                for arg in node.args:
                    if isinstance(arg, ast.Name):
                        var_name = arg.id
                        if var_name in self.env:
                            args_tokens.extend(self.process_expr(self.env[var_name]))
                        else:
                            args_tokens.append(Var(var_name))
                    elif isinstance(arg, ast.Call):
                        args_tokens.append(self.process_function_call(arg))
                    elif isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                        args_tokens.append(Literal(arg.value))
                    else:
                        expr = astor.to_source(arg).strip()
                        args_tokens.append(Literal("{" + expr + "}"))
                new_tokens = []
                arg_index = 0
                for token in base_tokens:
                    if isinstance(token, Literal):
                        parts = token.value.split("{}", -1)
                        if len(parts) == 1:
                            new_tokens.append(token)
                        else:
                            for i, part in enumerate(parts):
                                if part:
                                    new_tokens.append(Literal(part))
                                if i < len(parts) - 1 and arg_index < len(args_tokens):
                                    new_tokens.append(args_tokens[arg_index])
                                    arg_index += 1
                    else:
                        new_tokens.append(token)
                return new_tokens
            else:
                return [self.process_function_call(node)]
        else:
            expr = astor.to_source(node).strip()
            return [Literal(expr)]

    def process_function_call(self, node):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            func_name = node.func.id
            args_tokens = []
            for arg in node.args:
                if isinstance(arg, ast.Name):
                    var_name = arg.id
                    if var_name in self.env:
                        args_tokens.extend(self.process_expr(self.env[var_name]))
                    else:
                        args_tokens.append(Var(var_name))
                elif isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    args_tokens.append(Literal(arg.value))
                else:
                    expr = astor.to_source(arg).strip()
                    args_tokens.append(Literal("{" + expr + "}"))
            return FuncCall(func_name, args_tokens)
        else:
            expr = astor.to_source(node).strip()
            return Literal("{" + expr + "}")

def symbolic_decompile(source_code):
    """
    Given a source code string, parse it and return a list of symbolic representations.
    For calls with messages, each element in the returned list corresponds to one message's content.
    """
    tree = ast.parse(source_code)
    visitor = PromptSymbolicVisitor()
    visitor.visit(tree)
    return visitor.tokens

def get_caller_source():
    """
    Retrieve the source code of the caller (one level up in the call stack).
    """
    frame = inspect.stack()[2]
    try:
        return inspect.getsource(frame.frame)
    except Exception as e:
        print("Error retrieving source:", e)
        return None
