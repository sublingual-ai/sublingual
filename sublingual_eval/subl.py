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
import inspect

# Import the OpenAI client and underlying resource modules.
from openai import OpenAI
from openai.resources import completions
from openai.resources.chat import chat

# Import our AST parsing utilities.
from sublingual_eval.abstract import utils

import uuid
import contextvars


# Set up logging.
logger = logging.getLogger("sublingual")
logger.setLevel(logging.DEBUG)
logger.addHandler(logging.StreamHandler())

subl_logs_path = "subl_logs/"
if not os.path.exists(subl_logs_path):
    os.makedirs(subl_logs_path)

output_file_name = f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.jsonl"


# Make FastAPI imports optional
try:
    from fastapi import FastAPI
    from fastapi.routing import APIRoute
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False
    logger.debug("FastAPI not available - skipping FastAPI integration")


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
        extracted = (
            utils.extract_variables(token_list, final_string) if final_string else {}
        )

        mapping = []
        for token in token_list:
            if isinstance(token, utils.Literal):
                mapping.append({"symbol": repr(token), "value": token.value})
            elif isinstance(token, utils.Var):
                mapping.append(
                    {"symbol": repr(token), "value": extracted.get(token.name, None)}
                )
            elif isinstance(token, utils.FuncCall):
                mapping.append(
                    {
                        "symbol": repr(token),
                        "value": extracted.get(token.func_name, None),
                    }
                )
            else:  # Symbol case
                mapping.append(
                    {"symbol": repr(token), "value": extracted.get(token.expr, None)}
                )
        mapping_list.append(mapping)
    return mapping_list, len(token_lists)


# Define a context variable to store the request id
request_id_ctx_var = contextvars.ContextVar("request_id", default=None)

original_completions_create = chat.Completions.create


@functools.wraps(original_completions_create)
def logged_completions_create(self, *args, **kwargs):
    # Make the original call
    result = original_completions_create(self, *args, **kwargs)
    try:
        logger.debug(
            request_id_ctx_var.get()
        )
        logger.debug(
            "completions.Completions.create called with args: %s, kwargs: %s",
            args,
            kwargs,
        )

        ### AST Stuff
        symbolic_mappings = []
        # Get the caller's source code one level up the stack.
        # source_code = utils.get_caller_source()
        # if source_code:
        #     messages = kwargs.get("messages", [])
        #     symbolic_mappings, regex_count = get_symbolic_mappings(source_code, messages)
        # else:
        #     logger.debug("No caller source available.")

        # Get stack frame info
        caller_frame = inspect.currentframe().f_back
        frame_info = inspect.getframeinfo(caller_frame, context=20)
        caller_function_name = caller_frame.f_code.co_name
        print(
            f"caller_function_name: {caller_function_name}, {type(caller_function_name)}"
        )
        # logger.info("completions.Completions.create returned: %s", result)
        logged_data = {
            "session_id": request_id_ctx_var.get(),
            "messages": kwargs.get("messages", []),
            "response_texts": [choice.message.content for choice in result.choices],
            "symbolic_mappings": symbolic_mappings,
            "response": result.to_dict(),
            "usage": result.usage.to_dict(),
            "timestamp": int(time.time()),
            "stack_info": {
                "filename": frame_info.filename,
                "lineno": frame_info.lineno,
                "code_context": (
                    frame_info.code_context if frame_info.code_context else ""
                ),
                "caller_function_name": caller_frame.f_code.co_name,
            },
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
        write_logged_data(logged_data, output_file_name)
    except Exception as e:
        logger.error("Error in logged_completions_create: %s", e)
    finally:
        return result


chat.Completions.create = logged_completions_create


# Only modify FastAPI if it's available
if FASTAPI_AVAILABLE:
    original_get_route_handler = APIRoute.get_route_handler

    def custom_get_route_handler(self):
        original_handler = original_get_route_handler(self)
        
        async def custom_handler(request):
            token = request_id_ctx_var.set(str(uuid.uuid4()))
            try:
                response = await original_handler(request)
                return response
            finally:
                request_id_ctx_var.reset(token)
        
        return custom_handler

    APIRoute.get_route_handler = custom_get_route_handler


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
