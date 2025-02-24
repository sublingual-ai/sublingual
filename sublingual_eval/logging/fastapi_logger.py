import uuid
import logging

logger = logging.getLogger("sublingual")

# Import this from openai_logger to share the same context var
from sublingual_eval.logging.openai_logger import request_id_ctx_var

def setup_fastapi_logging():
    try:
        from fastapi import FastAPI
        from fastapi.routing import APIRoute

        # Check if already patched
        if getattr(APIRoute.get_route_handler, '_is_request_id_patched', False):
            logger.debug("APIRoute.get_route_handler already patched; skipping patch")
            return True

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

        # Mark the patched function to prevent double patching
        custom_get_route_handler._is_request_id_patched = True

        APIRoute.get_route_handler = custom_get_route_handler
        logger.debug("Successfully monkey-patched APIRoute.get_route_handler for request ID injection")
        return True
    except ImportError:
        logger.debug("FastAPI not available - skipping FastAPI integration")
        return False
