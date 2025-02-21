import sys
import functools
import logging
import runpy
import os
import time
import json
import uuid
import json
from datetime import datetime
import os

# Import the OpenAI client and underlying resource modules.
from openai import OpenAI
from openai.resources import completions
from openai.resources.chat import chat

# Import our AST parsing utilities.
from sublingual_eval.abstract import utils

# Set up logging.
logger = logging.getLogger("sublingual")
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())

subl_logs_path = "subl_logs/"
if not os.path.exists(subl_logs_path):
    os.makedirs(subl_logs_path)


def write_logged_data(logged_data, file_name):
    with open(os.path.join(subl_logs_path, file_name), "a") as f:
        f.write(json.dumps(logged_data) + "\n")


def get_symbolic_mappings(source_code, messages):
    """
    Given the caller's source code and the messages argument (list of dicts),
    decompile the prompt construction into symbolic tokens,
    build regex patterns for each message, extract variable values,
    and return a list of mappings (one per message) along with the number of regexes.
    """
    # Decompile the source code to get symbolic token lists.
    tokens = utils.symbolic_decompile(source_code)
    
    # Ensure we always have a list of token lists.
    if tokens and not isinstance(tokens[0], list):
        token_lists = [tokens]
    else:
        token_lists = tokens

    # Extract final prompt strings for user messages.
    user_prompts = [msg.get("content", "") for msg in messages]

    mapping_list = []
    for idx, token_list in enumerate(token_lists):
        # Build regex pattern and variable names for this token list.
        regex, var_names = utils.build_regex_from_tokens(token_list)
        # Use the corresponding prompt string (if available) for extraction.
        final_string = user_prompts[idx] if idx < len(user_prompts) else ""
        extracted = utils.extract_variables(token_list, final_string) if final_string else {}

        mapping = []
        for token in token_list:
            if isinstance(token, utils.Literal):
                mapping.append({"symbol": repr(token), "value": token.value})
            elif isinstance(token, utils.Var):
                mapping.append({"symbol": repr(token), "value": extracted.get(token.name, None)})
            elif isinstance(token, utils.FuncCall):
                mapping.append({"symbol": repr(token), "value": extracted.get(token.func_name, None)})
            else:  # Symbol case
                mapping.append({"symbol": repr(token), "value": extracted.get(token.expr, None)})
        mapping_list.append(mapping)
    return mapping_list, len(token_lists)


original_completions_create = chat.Completions.create


@functools.wraps(original_completions_create)
def logged_completions_create(self, *args, **kwargs):
    logger.info(
        "completions.Completions.create called with args: %s, kwargs: %s", args, kwargs
    )

    # Get the caller's source code one level up the stack.
    source_code = utils.get_caller_source()
    if source_code:
        messages = kwargs.get("messages", [])
        symbolic_mappings, regex_count = get_symbolic_mappings(source_code, messages)
    else:
        logger.info("No caller source available.")

    result = original_completions_create(self, *args, **kwargs)
    # logger.info("completions.Completions.create returned: %s", result)
    logged_data = {
        "messages": kwargs.get("messages", []),
        "response_texts": [choice.message.content for choice in result.choices],
        "symbolic_mappings": symbolic_mappings,
        "response": result.to_dict(),
        "usage": result.usage.to_dict(),
        "timestamp": int(time.time()),
        "call_parameters": {
            "model": kwargs.get("model", ""),
            "temperature": kwargs.get("temperature", 0),
            "max_tokens": kwargs.get("max_tokens", 0),
            "top_p": kwargs.get("top_p", 0),
            "frequency_penalty": kwargs.get("frequency_penalty", 0),
            "presence_penalty": kwargs.get("presence_penalty", 0),
            "stop": kwargs.get("stop", []),
        },
        "extra_info": {
            **kwargs.get("extra_headers", {}),
        },
    }
    write_logged_data(logged_data, f"{uuid.uuid4()}.jsonl")
    return result


chat.Completions.create = logged_completions_create

def main():
    if len(sys.argv) < 2:
        print("Usage: python -m subl <script.py>")
        sys.exit(1)
    script = sys.argv[1]
    # Adjust sys.argv so that the target script sees its own arguments.
    sys.argv = sys.argv[1:]
    runpy.run_path(script, run_name="__main__")


if __name__ == "__main__":
    main()
