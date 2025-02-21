import sys
import functools
import logging
import runpy

# Import the OpenAI client and underlying resource modules.
from openai import OpenAI
from openai.resources import completions
from openai.resources.chat import chat

# Import our AST parsing utilities.
import ast_utils

# Set up logging.
logger = logging.getLogger("openai")
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())

# -------------------------------
# Patch completions.Completions.create
# -------------------------------
original_completions_create = chat.Completions.create

@functools.wraps(original_completions_create)
def logged_completions_create(self, *args, **kwargs):
    logger.info("completions.Completions.create called with args: %s, kwargs: %s", args, kwargs)
    
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
