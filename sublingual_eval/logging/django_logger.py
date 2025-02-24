import uuid
import logging

logger = logging.getLogger("sublingual")

# Import this from openai_logger to share the same context var
from sublingual_eval.logging.openai_logger import request_id_ctx_var

def setup_django_asgi_logging():
    try:
        from django.core.handlers.asgi import ASGIHandler

        # Check if already patched
        if getattr(ASGIHandler.__call__, '_is_request_id_patched', False):
            logger.debug("ASGIHandler.__call__ already patched; skipping patch")
            return True

        original_asgi_call = ASGIHandler.__call__

        async def custom_asgi_call(self, scope, receive, send):
            token = request_id_ctx_var.set(str(uuid.uuid4()))
            try:
                response = await original_asgi_call(self, scope, receive, send)
                return response
            finally:
                request_id_ctx_var.reset(token)

        # Mark the patched function to avoid double patching
        custom_asgi_call._is_request_id_patched = True

        ASGIHandler.__call__ = custom_asgi_call
        logger.debug("Successfully monkey-patched ASGIHandler.__call__ for request ID injection")
        return True
    except ImportError:
        logger.debug("Django ASGIHandler not available - skipping ASGI integration")
        return False

def setup_django_wsgi_logging():
    try:
        from django.core.handlers.wsgi import WSGIHandler

        # Check if already patched
        if getattr(WSGIHandler.__call__, '_is_request_id_patched', False):
            logger.debug("WSGIHandler.__call__ already patched; skipping patch")
            return True

        original_wsgi_call = WSGIHandler.__call__

        def custom_wsgi_call(self, environ, start_response):
            token = request_id_ctx_var.set(str(uuid.uuid4()))
            try:
                response = original_wsgi_call(self, environ, start_response)
                return response
            finally:
                request_id_ctx_var.reset(token)

        # Mark the patched function to avoid double patching
        custom_wsgi_call._is_request_id_patched = True

        WSGIHandler.__call__ = custom_wsgi_call
        logger.debug("Successfully monkey-patched WSGIHandler.__call__ for request ID injection")
        return True
    except ImportError:
        logger.debug("Django WSGIHandler not available - skipping WSGI integration")
        return False
