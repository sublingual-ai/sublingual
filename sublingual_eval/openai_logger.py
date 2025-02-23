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
# Set up logging
logger = logging.getLogger("sublingual")

# Context variable for request tracking
request_id_ctx_var = contextvars.ContextVar("request_id", default=None)


output_file_name = f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.jsonl"

def write_logged_data(subl_logs_path, logged_data, file_name):
    with open(os.path.join(subl_logs_path, file_name), "a") as f:
        f.write(json.dumps(logged_data) + "\n")
    # print(f"Logged data written to {os.path.join(subl_logs_path, file_name)}")

def create_logged_data(result, args, kwargs, caller_frame):
    """Create the logged data dictionary from a completion result"""
    # Get the full stack trace
    stack = inspect.stack()
    stack_info = []
    
    project_root = os.getcwd()
    for frame_info in reversed(stack):
        filename = frame_info.filename
        abs_filename = os.path.abspath(filename)

        if not abs_filename.startswith(project_root):
            continue

        code_context = frame_info.code_context if frame_info.code_context else []
        stack_info.append({
            "filename": frame_info.filename,
            "lineno": frame_info.lineno,
            "code_context": code_context,
            "function": frame_info.function,
        })

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
                        # Check for base64 images in image_url
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
            processed_messages.append(msg)

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
        # "response_texts": [choice.message.content for choice in result.choices],
        "symbolic_mappings": [],  # Simplified for now
        "response": response_dict,
        "usage": result.usage.to_dict(),
        "timestamp": int(time.time()),
        "stack_trace": stack_info,
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

def setup_openai_logging(subl_logs_path: str):
    """Set up synchronous logging for OpenAI completions"""
    original_completions_create = chat.Completions.create

    @functools.wraps(original_completions_create)
    def logged_completions_create(self, *args, **kwargs):
        # Make the original call
        result = original_completions_create(self, *args, **kwargs)
        try:
            # logger.debug(f"Request ID: {request_id_ctx_var.get()}")
            # logger.debug(
            #     "completions.Completions.create called with args: %s, kwargs: %s",
            #     args,
            #     kwargs,
            # )

            caller_frame = inspect.currentframe().f_back
            logged_data = create_logged_data(result, args, kwargs, caller_frame)
            write_logged_data(subl_logs_path, logged_data, output_file_name)
        except Exception as e:
            logger.error("Error in logged_completions_create: %s", e)
        finally:
            return result

    chat.Completions.create = logged_completions_create

def setup_openai_async_logging(subl_logs_path: str):
    """Set up asynchronous logging for OpenAI completions"""
    original_acreate = chat.AsyncCompletions.create

    @functools.wraps(original_acreate)
    async def logged_completions_acreate(self, *args, **kwargs):
        # Make the original call
        result = await original_acreate(self, *args, **kwargs)
        try:
            # logger.debug(request_id_ctx_var.get())
            # logger.debug(
            #     "completions.AsyncCompletions.create called with args: %s, kwargs: %s",
            #     args,
            #     kwargs,
            # )

            caller_frame = inspect.currentframe().f_back
            logged_data = create_logged_data(result, args, kwargs, caller_frame)
            write_logged_data(subl_logs_path, logged_data, output_file_name)
        except Exception as e:
            logger.error("Error in logged_completions_acreate: %s", e)
        finally:
            return result

    chat.AsyncCompletions.create = logged_completions_acreate
