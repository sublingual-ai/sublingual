from typing import List, Dict, Any, Optional, Union
from textwrap import dedent
import openai
import json
from dotenv import load_dotenv
import os
from openai import OpenAI


# Remove the global client initialization
client = None

def initialize_client(env_file):
    global client
    load_dotenv(env_file)
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        client = OpenAI(api_key=api_key)
    else:
        RED = "\033[91m"
        RESET = "\033[0m"
        print(
            f"\n{RED}❌ No OpenAI API key found in environment file: {env_file}\nEvaluations will not work.{RESET}\n"
        )
        return None

class Evaluation:
    system_prompt = dedent("""
    You are an expert evaluator of AI assistant responses.
    You will be given a conversation between a user and an AI assistant.
    Use the tool provided to evaluate the AI assistant's response according to the provided criteria.
    """).strip()
    
    def __init__(
            self,
            name: str,
            prompt: str,
            tool_type: str,
            min_val: Optional[int] = None,
            max_val: Optional[int] = None
        ):
        self.name = name
        self.prompt = prompt
        self.tool_type = tool_type
        self.min_val = min_val
        self.max_val = max_val

        if tool_type == "int":
            self.tool = construct_numeric_eval(min_val, max_val)
        elif tool_type == "bool":
            self.tool = construct_boolean_eval()
        else:
            raise ValueError(f"Invalid tool type: {tool_type}")

    def grade(
            self,
            messages: List[Dict[str, Any]],
            model: str = "gpt-4o-mini"
        ) -> int:
        if self.tool_type == "bool":
            criteria_prompt = f"User Criteria: {self.prompt}\n\nEvaluate this as either true or false."
        else:
            criteria_prompt = f"User Criteria: {self.prompt}\n\nEvaluate this with a score between {self.min_val} and {self.max_val}."

        judge_messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": "\n".join([f"{m['role']}: {m['content']}" for m in messages])},
            {"role": "user", "content": criteria_prompt},
        ]
        judge_response = client.chat.completions.create(
            model=model,
            messages=judge_messages,
            tools=[self.tool],
            tool_choice="required",
        )
        if judge_response.choices[0].message.tool_calls:
            tool_call = judge_response.choices[0].message.tool_calls[0]
            tool_args = json.loads(tool_call.function.arguments)
            if self.tool_type == "int":
                return tool_args["integer"]
            elif self.tool_type == "bool":
                return tool_args["boolean"]
            else:
                raise ValueError(f"Invalid tool type: {self.tool_type}")
        else:
            raise ValueError("No tool call found in judge response")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "prompt": self.prompt,
            "tool_type": self.tool_type,
            "min_val": self.min_val,
            "max_val": self.max_val
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Evaluation":
        return cls(
            name=data["name"],
            prompt=data["prompt"],
            tool_type=data["tool_type"],
            min_val=data["min_val"],
            max_val=data["max_val"]
        )


def construct_numeric_eval(min_val: int, max_val: int) -> Dict[str, Any]:
    if min_val > max_val:
        raise ValueError("min_val must be less than max_val")
    
    tool = {
        "type": "function",
        "function": {
            "name": "return_integer",
            "description": "Return an integer value between min_val and max_val.",
            "parameters": {
                "type": "object",
                "properties": {
                    "integer": {
                        "type": "integer",
                        "description": "An integer value.",
                        "minimum": min_val,
                        "maximum": max_val
                    }
                },
                "required": ["integer"]
            }
        }
    }
    
    return tool


def construct_boolean_eval() -> Dict[str, Any]:
    tool = {
        "type": "function",
        "function": {
            "name": "return_boolean",
            "description": "Return a boolean value.",
            "parameters": {
                "type": "object",
                "properties": {
                    "boolean": {
                        "type": "boolean",
                        "description": "A boolean value."
                    }
                },
                "required": ["boolean"]
            }
        }
    }
    
    return tool

