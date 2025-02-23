import uuid
import logging

logger = logging.getLogger("sublingual")

# Import this from openai_logger to share the same context var
from sublingual_eval.openai_logger import request_id_ctx_var

def setup_django_asgi_logging():
    try:
        from django.core.handlers.asgi import ASGIHandler

        original_asgi_call = ASGIHandler.__call__

        async def custom_asgi_call(self, scope, receive, send):
            token = request_id_ctx_var.set(str(uuid.uuid4()))
            try:
                response = await original_asgi_call(self, scope, receive, send)
                return response
            finally:
                request_id_ctx_var.reset(token)

        ASGIHandler.__call__ = custom_asgi_call
        logger.debug("Successfully monkey-patched ASGIHandler.__call__ for request ID injection")
        return True
    except ImportError:
        logger.debug("Django ASGIHandler not available - skipping ASGI integration")
        return False

def setup_django_wsgi_logging():
    try:
        from django.core.handlers.wsgi import WSGIHandler

        original_wsgi_call = WSGIHandler.__call__

        def custom_wsgi_call(self, environ, start_response):
            token = request_id_ctx_var.set(str(uuid.uuid4()))
            try:
                response = original_wsgi_call(self, environ, start_response)
                return response
            finally:
                request_id_ctx_var.reset(token)

        WSGIHandler.__call__ = custom_wsgi_call
        logger.debug("Successfully monkey-patched WSGIHandler.__call__ for request ID injection")
        return True
    except ImportError:
        logger.debug("Django WSGIHandler not available - skipping WSGI integration")
        return False
