import unittest
from sublingual_eval.abstract.t3 import grammar, Format, Concat, Var, Literal, InferredVar

class TestGrammar(unittest.TestCase):
    def compare_dicts(self, result, expected):
        self.assertEqual(set(result.keys()), set(expected.keys()))
        for key in result:
            self.assertEqual(result[key], expected[key])

    def compare_lists(self, result, expected):
        self.assertEqual(len(result), len(expected))
        for r, e in zip(result, expected):
            self.compare_dicts(r, e)

    def test_basic_fstring(self):
        """Test f-string parsing"""
        b = "hi"
        c = "lo"
        d = b + c
        e = f"i am {d}!"
        result = grammar([{"role": "user", "content": e}])
        expected = [{
            "role": "user",
            "content": Format(
                Literal("i am {}!"),
                Concat(Literal("hi"), Literal("lo"))
            )
        }]
        self.assertListEqual(result, expected)

    def test_direct_concatenation(self):
        """Test direct string concatenation"""
        a = "Hello "
        b = "world"
        c = a + b
        msg = {"role": "user", "content": c}
        result = grammar(msg)
        expected = {
            "role": "user",
            "content": Concat(Literal("Hello "), Literal("world"))
        }
        self.assertDictEqual(result, expected)

    def test_format_method(self):
        """Test .format() method parsing"""
        fmt = "Sum: {} + {} = {}"
        s = fmt.format(1, 2, 3)
        result = grammar([{"role": "user", "content": s}])
        expected = [{
            "role": "user",
            "content": Format(
                Literal("Sum: {} + {} = {}"),
                Literal("1"), Literal("2"), Literal("3")
            )
        }]
        self.assertListEqual(result, expected)

    def test_percent_format(self):
        """Test %-formatting parsing"""
        fmt = "Hello, %s"
        s = fmt % "world"
        result = grammar([{"role": "user", "content": s}])
        expected = [{
            "role": "user",
            "content": Format(
                Literal("Hello, %s"),
                Literal("world")
            )
        }]
        self.assertListEqual(result, expected)

    def test_variable_reference(self):
        """Test that variables in control flow become Var references"""
        x = "hello"
        if True:
            x = x + " world"
        result = grammar([{"role": "user", "content": x}])
        expected = [{
            "role": "user",
            "content": Var("x")
        }]
        self.assertListEqual(result, expected)

    def test_list_messages(self):
        """Test handling of message lists"""
        msgs = [
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "user"}
        ]
        result = grammar(msgs)
        expected = [
            {"role": "system", "content": Literal("sys")},
            {"role": "user", "content": Literal("user")}
        ]
        self.assertListEqual(result, expected)

    def test_dict_message(self):
        """Test handling of single message dict"""
        msg = {"role": "user", "content": "test"}
        result = grammar(msg)
        expected = {
            "role": "user",
            "content": Literal("test")
        }
        self.assertDictEqual(result, expected)

    def test_invalid_format(self):
        """Test handling of invalid message format"""
        result = grammar("not a dict or list")
        self.assertEqual(result, "<unsupported input type>")

    def test_missing_content(self):
        """Test handling of missing content field"""
        result = grammar([{"role": "user"}])
        expected = [{"role": "user"}]
        self.assertListEqual(result, expected)

    def test_nested_fstrings(self):
        """Test nested f-string parsing"""
        inner = f"inner{42}"
        outer = f"outer{inner}end"
        result = grammar([{"role": "user", "content": outer}])
        expected = [{
            "role": "user",
            "content": Format(
                Literal("outer{}end"),
                Format(
                    Literal("inner{}"),
                    Literal("42")
                )
            )
        }]
        self.assertListEqual(result, expected)

    def test_complex_string_composition(self):
        """Test combination of different string formatting approaches"""
        base = "base"
        fmt1 = "%s_fmt" % base
        fmt2 = "middle_{}".format(fmt1)
        final = f"start_{fmt2}_end{base}"
        
        result = grammar([{"role": "user", "content": final}])
        expected = [{
            "role": "user",
            "content": Format(
                Literal("start_{}_end{}"),
                Format(
                    Literal("middle_{}"),
                    Format(
                        Literal("%s_fmt"),
                        Literal("base")
                    )
                ),
                Literal("base")
            )
        }]
        self.assertListEqual(result, expected)

    def test_mixed_var_and_format(self):
        """Test mixing variable references with string formatting"""
        prefix = "hello"
        if True:
            suffix = "world"
            message = f"{prefix}_{suffix}"
        
        result = grammar([{"role": "user", "content": message}])
        expected = [{
            "role": "user",
            "content": Var("message")
        }]
        self.assertListEqual(result, expected)

    def test_inferred_var_with_format(self):
        """Test InferredVar with complex string formatting"""
        def get_greeting():
            return "hello"
        
        base = get_greeting()
        formatted = f"{base}_{'world' if True else 'there'}"
        
        result = grammar([{"role": "user", "content": formatted}])
        expected = [{
            "role": "user",
            "content": InferredVar("formatted", "hello_world")
        }]
        self.assertListEqual(result, expected)

    def test_complex_conditional_format(self):
        """Test f-strings with complex conditional expressions"""
        x = 42
        y = 24
        formatted = f"The {'bigger' if x > y else 'smaller'} number is {max(x, y)}"
        
        result = grammar([{"role": "user", "content": formatted}])
        expected = [{
            "role": "user",
            "content": InferredVar("formatted", "The bigger number is 42")
        }]
        self.assertListEqual(result, expected)

    def test_nested_function_calls(self):
        """Test f-strings with nested function calls"""
        def inner(x):
            return x * 2
        def outer(x):
            return inner(x) + 1
        
        formatted = f"Result: {outer(inner(3))}"
        
        result = grammar([{"role": "user", "content": formatted}])
        expected = [{
            "role": "user",
            "content": InferredVar("formatted", "Result: 13")
        }]
        self.assertListEqual(result, expected)

    def test_mixed_complex_expressions(self):
        """Test mixing different types of complex expressions in f-strings"""
        def get_title():
            return "Dr."
        
        name = "Smith"
        age = 35
        formatted = f"{get_title()} {name} is {'young' if age < 40 else 'old'} at {min(age + 10, 100)} years"
        
        result = grammar([{"role": "user", "content": formatted}])
        expected = [{
            "role": "user",
            "content": InferredVar("formatted", "Dr. Smith is young at 45 years")
        }]
        self.assertListEqual(result, expected)

    def test_list_comprehension_in_format(self):
        """Test f-strings containing list comprehensions"""
        numbers = [1, 2, 3]
        formatted = f"Squares: {', '.join(str(x*x) for x in numbers)}"
        
        result = grammar([{"role": "user", "content": formatted}])
        expected = [{
            "role": "user",
            "content": InferredVar("formatted", "Squares: 1, 4, 9")
        }]
        self.assertListEqual(result, expected)

    def test_dict_comprehension_in_format(self):
        """Test f-strings with dictionary comprehensions"""
        keys = ['a', 'b']
        formatted = f"Map: {' '.join(f'{k}={ord(k)}' for k in keys)}"
        
        result = grammar([{"role": "user", "content": formatted}])
        expected = [{
            "role": "user",
            "content": InferredVar("formatted", "Map: a=97 b=98")
        }]
        self.assertListEqual(result, expected)

    def test_gitignore_first_line(self):
        """Test reading first line from .gitignore file"""
        with open('.gitignore', 'r') as f:
            first_line = f.readline().strip()
            second_line = f.readline().strip()
        
        result = grammar([
            {"role": "user", "content": first_line}, 
            {"role": "user", "content": second_line}
        ])
        expected = [
            {
                "role": "user", 
                "content": InferredVar("first_line", "# Project specific")
            },
            {
                "role": "user",
                "content": InferredVar("second_line", "keys.env")
            }
        ]
        self.assertListEqual(result, expected)

    def test_parameter_passing(self, string="hi"):
        """Test parameter passing to make sure we store as Var"""
        
        result = grammar([{"role": "user", "content": string}])
        expected = [{
            "role": "user",
            "content": Var("string")
        }]
        self.assertListEqual(result, expected)

if __name__ == '__main__':
    unittest.main() 