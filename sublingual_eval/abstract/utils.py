import ast
import astor
import inspect
import re


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

class Symbol:
    def __init__(self, expr):
        self.expr = expr

    def __str__(self):
        return '{' + self.expr + '}'

    def __repr__(self):
        return f'Symbol({self.expr!r})'

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
        # New branch: if node is a Name, substitute its assigned value if available.
        if isinstance(node, ast.Name):
            if node.id in self.env:
                return self.process_expr(self.env[node.id])
            else:
                return [Var(node.id)]
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
                    if isinstance(value.value, ast.Name):
                        tokens.extend(self.process_expr(value.value))
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
            
            # If both sides are symbols, combine them
            if (len(left_tokens) == 1 and isinstance(left_tokens[0], Symbol) and 
                len(right_tokens) == 1 and isinstance(right_tokens[0], Symbol)):
                combined_expr = f"{left_tokens[0].expr} + {right_tokens[0].expr}"
                return [Symbol(combined_expr)]
            
            return left_tokens + right_tokens
        # Case 4: Handling .format() calls
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr == 'format':
                base_tokens = self.process_expr(node.func.value)
                args_tokens = []
                for arg in node.args:
                    if isinstance(arg, ast.Name):
                        args_tokens.extend(self.process_expr(arg))
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
        # New Case 5: Handling %-formatting
        elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
            # Expect left to be a constant string template.
            if isinstance(node.left, ast.Constant) and isinstance(node.left.value, str):
                template = node.left.value
                # Process the substitution: if the right-hand side is a tuple, process each element,
                # otherwise process it as a single substitution.
                subs = []
                if isinstance(node.right, ast.Tuple):
                    for elt in node.right.elts:
                        subs.extend(self.process_expr(elt))
                else:
                    subs = self.process_expr(node.right)
                parts = template.split("%s")
                tokens = []
                for i, part in enumerate(parts):
                    if part:
                        tokens.append(Literal(part))
                    if i < len(parts) - 1:
                        tokens.extend(subs)
                return tokens
            else:
                expr = astor.to_source(node).strip()
                return [Literal(expr)]
        else:
            expr = astor.to_source(node).strip()
            return [Symbol(expr)]

    def process_function_call(self, node):
        if isinstance(node, ast.Call):
            expr = astor.to_source(node).strip()
            return Symbol(expr)
        else:
            expr = astor.to_source(node).strip()
            return Symbol(expr)

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
    
def build_regex_from_tokens(tokens):
    """
    Build a regex pattern from a list of tokens.
    Literal tokens are escaped exactly, and anything between them is captured.
    Returns a tuple: (pattern, list_of_variable_names)
    """
    pattern = ""
    var_names = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if isinstance(token, Literal):
            pattern += re.escape(token.value)
        elif isinstance(token, (Var, Symbol)):
            # Look ahead for consecutive symbolic tokens
            start_idx = i
            while (i + 1 < len(tokens) and 
                   isinstance(tokens[i + 1], (Var, Symbol))):
                i += 1
            
            # Capture everything between literals
            pattern += "(.+?)"  # Back to simple non-greedy capture
            if i > start_idx:
                # Multiple symbols - combine their expressions for the name
                exprs = []
                for t in tokens[start_idx:i + 1]:
                    if isinstance(t, Symbol):
                        exprs.append(t.expr)
                    else:  # Var
                        exprs.append(str(t))
                combined_expr = " + ".join(exprs)
                var_names.append(("symbol", combined_expr))
            else:
                if isinstance(token, Var):
                    var_names.append(("var", token.name))
                else:
                    var_names.append(("symbol", token.expr))
        else:
            pattern += re.escape(str(token))
        i += 1
    
    pattern = "^" + pattern + "$"
    return pattern, var_names

def extract_variables(tokens, final_string):
    """
    Given a token list and a final string, extract variable values using the built regex.
    Returns a dict mapping each variable name to its first captured value.
    """
    pattern, var_types_and_names = build_regex_from_tokens(tokens)
    match = re.match(pattern, final_string)

    if match:
        return {}

    groups = match.groups()
    result = {}
    
    for idx, (type_, name) in enumerate(var_types_and_names):
        if idx < len(groups):
            result[name] = groups[idx]
    
    return result
