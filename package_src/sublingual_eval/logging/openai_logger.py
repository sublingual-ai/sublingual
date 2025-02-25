import functools
import logging
import time
import inspect
import json
import os
from datetime import datetime
from openai.resources.chat import chat
import contextvars
import uuid
from sublingual_eval.abstract.grammar import (
    process_messages,
    get_arg_node,
    convert_grammar_to_dict,
)

# Set up logging
logger = logging.getLogger("sublingual")

# Context variable for request tracking
request_id_ctx_var = contextvars.ContextVar("request_id", default=None)


# Add this at the top with other imports
class GrammarEncoder(json.JSONEncoder):
    def default(self, obj):
        if hasattr(obj, "__json__"):
            return obj.__json__()
        return super().default(obj)


output_file_name = f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.jsonl"


def write_logged_data(subl_logs_path, logged_data, file_name):
    with open(os.path.join(subl_logs_path, file_name), "a") as f:
        f.write(json.dumps(logged_data, cls=GrammarEncoder) + "\n")


def create_logged_data(result, args, kwargs, caller_frame, grammar_json):
    """Create the logged data dictionary from a completion result"""
    # Get the full stack trace
    stack = inspect.stack()
    stack_info = []

    project_root = os.getcwd()
    excluded_patterns = [
        '<frozen',  # Catches '<frozen runpy>' and similar
        'site-packages',  # Excludes installed packages
        'dist-packages',  # Excludes system packages on some Linux systems
        'lib/python',     # Excludes Python standard library
    ]

    for frame_info in reversed(stack):
        filename = frame_info.filename
        abs_filename = os.path.abspath(filename)

        # Skip frames matching excluded patterns
        if any(pattern in filename for pattern in excluded_patterns):
            continue

        # Skip frames outside project directory
        if not abs_filename.startswith(project_root):
            continue

        code_context = frame_info.code_context if frame_info.code_context else []
        stack_info.append(
            {
                "filename": frame_info.filename,
                "lineno": frame_info.lineno,
                "code_context": code_context,
                "function": frame_info.function,
            }
        )

    # Process messages to handle base64 images
    messages = kwargs.get("messages", [])
    processed_messages = []
    for msg in messages:
        if isinstance(msg, dict):
            processed_msg = msg.copy()
            content = msg.get("content")

            # Handle list-type content (multimodal messages)
            if isinstance(content, list):
                processed_content = []
                for item in content:
                    if isinstance(item, dict):
                        item_copy = item.copy()
                        if "image_url" in item_copy:
                            url = item_copy["image_url"].get("url", "")
                            if url and url.startswith("data:image"):
                                item_copy["image_url"]["url"] = "[BASE64_IMAGE_REMOVED]"
                        processed_content.append(item_copy)
                    else:
                        processed_content.append(item)
                processed_msg["content"] = processed_content

            processed_messages.append(processed_msg)
        else:
            # Handle non-dict message objects (like ChatCompletionMessage)
            processed_messages.append({
                "role": msg.role,
                "content": msg.content,
                **({"tool_calls": [t.model_dump() for t in msg.tool_calls]} if getattr(msg, "tool_calls", None) else {}),
                **({"tool_call_id": msg.tool_call_id} if getattr(msg, "tool_call_id", None) else {}),
                **({"name": msg.name} if getattr(msg, "name", None) else {})
            })

    # Process response to handle base64 images
    response_dict = result.to_dict()
    for choice in response_dict.get("choices", []):
        message = choice.get("message", {})
        content = message.get("content")

        if isinstance(content, list):
            processed_content = []
            for item in content:
                if isinstance(item, dict):
                    item_copy = item.copy()
                    if "image_url" in item_copy:
                        url = item_copy["image_url"].get("url", "")
                        if url and url.startswith("data:image"):
                            item_copy["image_url"]["url"] = "[BASE64_IMAGE_REMOVED]"
                    processed_content.append(item_copy)
                else:
                    processed_content.append(item)
            message["content"] = processed_content
    return {
        "log_id": str(uuid.uuid4()),
        "session_id": request_id_ctx_var.get(),
        "messages": processed_messages,
        "grammar_result": grammar_json,
        "symbolic_mappings": [],  # Simplified for now
        "response": response_dict,
        "usage": result.usage.to_dict(),
        "timestamp": int(time.time()),
        "stack_trace": stack_info,
        "call_parameters": {
            "model": kwargs.get("model"),
            "temperature": kwargs.get("temperature"),
            "max_tokens": kwargs.get("max_tokens"),
            "top_p": kwargs.get("top_p"),
            "frequency_penalty": kwargs.get("frequency_penalty"),
            "presence_penalty": kwargs.get("presence_penalty"),
            "stop": kwargs.get("stop"),
            "n": kwargs.get("n", 1),
        },
        "extra_info": {
            **kwargs.get("extra_headers", {}),
        },
    }


def setup_openai_logging(subl_logs_path: str):
    """Set up synchronous logging for OpenAI completions"""
    original_completions_create = chat.Completions.create

    @functools.wraps(original_completions_create)
    def logged_completions_create(self, *args, **kwargs):
        result = original_completions_create(self, *args, **kwargs)

        try:
            caller_frame = inspect.currentframe().f_back
            arg_node, env = get_arg_node(
                caller_frame, original_completions_create.__name__
            )
            grammar_result = process_messages(
                arg_node, env, f_locals=caller_frame.f_locals
            )
            grammar_dict = convert_grammar_to_dict(grammar_result)
        except Exception as e:
            logger.error("\033[92m\033[94m[sublingual]\033[0m Error processing grammar: %s", e)
            grammar_dict = None

        try:
            logged_data = create_logged_data(
                result, args, kwargs, caller_frame, grammar_dict
            )
            write_logged_data(subl_logs_path, logged_data, output_file_name)
        except Exception as e:
            logger.error("\033[92m\033[94m[sublingual]\033[0m Error in logged_completions_create: %s", e)
        finally:
            return result

    chat.Completions.create = logged_completions_create


def setup_openai_async_logging(subl_logs_path: str):
    """Set up asynchronous logging for OpenAI completions"""
    original_acreate = chat.AsyncCompletions.create

    @functools.wraps(original_acreate)
    async def logged_completions_acreate(self, *args, **kwargs):
        result = await original_acreate(self, *args, **kwargs)

        try:
            arg_node, env = get_arg_node(inspect.currentframe().f_back, "create")
            grammar_result = process_messages(arg_node, env)
            grammar_dict = convert_grammar_to_dict(grammar_result)
        except Exception as e:
            logger.error("\033[92m\033[94m[sublingual]\033[0m Error processing grammar: %s", e)
            grammar_dict = None

        try:
            caller_frame = inspect.currentframe().f_back
            logged_data = create_logged_data(
                result, args, kwargs, caller_frame, grammar_dict
            )
            write_logged_data(subl_logs_path, logged_data, output_file_name)
        except Exception as e:
            logger.error("\033[92m\033[94m[sublingual]\033[0m Error in logged_completions_acreate: %s", e)
        finally:
            return result

    chat.AsyncCompletions.create = logged_completions_acreate
