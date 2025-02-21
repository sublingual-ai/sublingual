import sys
import functools
import logging
import runpy
import os
import time
import json
import uuid
# Import the OpenAI client and underlying resource modules.
from openai import OpenAI
from openai.resources import completions
from openai.resources.chat import chat

# Import our AST parsing utilities.
import ast_utils

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


# -------------------------------
# Patch completions.Completions.create
# -------------------------------
original_completions_create = chat.Completions.create


@functools.wraps(original_completions_create)
def logged_completions_create(self, *args, **kwargs):
    logger.info(
        "completions.Completions.create called with args: %s, kwargs: %s", args, kwargs
    )

    # Get the caller's source code one level up the stack.
    source_code = ast_utils.get_caller_source()
    if source_code:
        logger.info("Caller source code:\n%s", source_code)
        # Decompile the prompt from the caller's source code.
        tokens = ast_utils.symbolic_decompile(source_code)
        logger.info("Abstract symbolic representation: %s", tokens)
    else:
        logger.info("No caller source available.")

    result = original_completions_create(self, *args, **kwargs)
    # logger.info("completions.Completions.create returned: %s", result)
    logged_data = {
        "messages": kwargs.get("messages", []),
        "response_texts": [choice.message.content for choice in result.choices],
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

# -------------------------------
# Run the target script.
# -------------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m subl <script.py>")
        sys.exit(1)
    script = sys.argv[1]
    # Adjust sys.argv so that the target script sees its own arguments.
    sys.argv = sys.argv[1:]
    runpy.run_path(script, run_name="__main__")
