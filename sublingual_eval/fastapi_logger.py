import uuid
import logging

logger = logging.getLogger("sublingual")

# Import this from openai_logger to share the same context var
from sublingual_eval.openai_logger import request_id_ctx_var

def setup_fastapi_logging():
    try:
        from fastapi import FastAPI
        from fastapi.routing import APIRoute
        
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
        return True
    except ImportError:
        logger.debug("FastAPI not available - skipping FastAPI integration")
        return False 