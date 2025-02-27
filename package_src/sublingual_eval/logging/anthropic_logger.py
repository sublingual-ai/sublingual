import functools
import logging
import time
import inspect
import json
import os
from datetime import datetime
import contextvars
import uuid
from anthropic import Anthropic, AsyncAnthropic
from anthropic.resources.messages import Messages, AsyncMessages

# Set up logging
logger = logging.getLogger("sublingual")

# Context variable for request tracking
request_id_ctx_var = contextvars.ContextVar("request_id", default=None)

# Set up output file name
output_file_name = f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.jsonl"


def write_logged_data(subl_logs_path, logged_data, file_name):
    with open(os.path.join(subl_logs_path, file_name), "a") as f:
        f.write(json.dumps(logged_data) + "\n")


def create_logged_data(result, args, kwargs, caller_frame):
    """Create the logged data dictionary from a completion result"""
    # Get the full stack trace
    stack = inspect.stack()
    stack_info = []

    project_root = os.getcwd()
    excluded_patterns = [
        "<frozen",
        "site-packages",
        "dist-packages",
        "lib/python",
    ]

    for frame_info in reversed(stack):
        filename = frame_info.filename
        abs_filename = os.path.abspath(filename)

        if any(pattern in filename for pattern in excluded_patterns):
            continue

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
    # Process messages - just get them directly from kwargs
    messages = kwargs.get("messages", [])

    # Add system message if present
    if kwargs.get("system"):
        messages = [{"role": "system", "content": kwargs["system"]}] + messages

    # Format response similar to OpenAI's structure
    response_dict = {
        "id": result.id,
        "model": result.model,
        "created": int(time.time()),
        "object": "anthropic.messages",
        "usage": {
            "prompt_tokens": result.usage.input_tokens,
            "completion_tokens": result.usage.output_tokens,
            "total_tokens": result.usage.input_tokens + result.usage.output_tokens,
        },
    }
    # Create a single choice with a message containing all content and tool calls
    choice_message = {
        "role": result.role,
    }
    # Handle content - extract text from TextBlock objects
    if hasattr(result, "content"):
        # Content is a list of TextBlocks and ToolUseBlocks
        choice_message["content"] = None  # Initialize as None
        tool_calls = []

        for block in result.content:
            if block.type == "text":
                choice_message["content"] = block.text
            elif block.type == "tool_use":
                tool_calls.append(
                    {
                        "id": block.id,
                        "type": "function",
                        "function": {
                            "name": block.name,
                            "arguments": json.dumps(block.input),
                        },
                    }
                )

        if tool_calls:
            choice_message["tool_calls"] = tool_calls

    response_dict["choices"] = [
        {"finish_reason": result.stop_reason, "index": 0, "message": choice_message}
    ]

    return {
        "log_id": str(uuid.uuid4()),
        "session_id": request_id_ctx_var.get(),
        "messages": messages,  # Use messages directly
        "grammar_result": None,  # Not applicable for Anthropic
        "symbolic_mappings": [],  # Not applicable for Anthropic
        "response": response_dict,
        "usage": response_dict["usage"],
        "timestamp": int(time.time()),
        "stack_trace": stack_info,
        "call_parameters": {
            "model": kwargs.get("model"),
            "temperature": kwargs.get("temperature"),
            "max_tokens": kwargs.get("max_tokens"),
            "top_p": kwargs.get("top_p"),
            "stop_sequences": kwargs.get("stop_sequences"),
        },
        "extra_info": {
            **kwargs.get("extra_headers", {}),
        },
    }


def _convert_to_dict(obj):
    """Convert an object to a dict if possible, otherwise return as is"""
    if hasattr(obj, "__dict__"):
        result = {}
        for key, value in obj.__dict__.items():
            if key.startswith("_"):
                continue
            result[key] = _convert_to_dict(value)
        return result
    elif isinstance(obj, list):
        return [_convert_to_dict(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: _convert_to_dict(v) for k, v in obj.items()}
    else:
        return obj


def setup_anthropic_logging(subl_logs_path: str):
    """Set up synchronous logging for Anthropic completions"""
    # Store the original create method
    original_messages_create = Messages.create

    @functools.wraps(original_messages_create)
    def logged_messages_create(self, *args, **kwargs):
        result = original_messages_create(self, *args, **kwargs)
        try:
            caller_frame = inspect.currentframe().f_back
            logged_data = create_logged_data(result, args, kwargs, caller_frame)
            write_logged_data(subl_logs_path, logged_data, output_file_name)
        except Exception as e:
            logger.error(
                "\033[92m\033[94m[sublingual]\033[0m Error in logged_messages_create: %s",
                e,
            )
        finally:
            return result

    # Replace the create method
    Messages.create = logged_messages_create


def setup_anthropic_async_logging(subl_logs_path: str):
    """Set up asynchronous logging for Anthropic completions"""
    # Store the original acreate method
    original_messages_acreate = AsyncMessages.create

    @functools.wraps(original_messages_acreate)
    async def logged_messages_acreate(self, *args, **kwargs):
        result = await original_messages_acreate(self, *args, **kwargs)
        try:
            caller_frame = inspect.currentframe().f_back
            logged_data = create_logged_data(result, args, kwargs, caller_frame)
            write_logged_data(subl_logs_path, logged_data, output_file_name)
        except Exception as e:
            logger.error(
                "\033[92m\033[94m[sublingual]\033[0m Error in logged_messages_acreate: %s",
                e,
            )
        finally:
            return result

    # Replace the acreate method
    AsyncMessages.create = logged_messages_acreate
