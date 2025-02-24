import unittest
from sublingual_eval.abstract.t3 import grammar, Format, Concat, Var, Literal

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

if __name__ == '__main__':
    unittest.main() 