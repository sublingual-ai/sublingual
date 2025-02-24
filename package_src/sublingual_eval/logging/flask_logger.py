import uuid
import logging

logger = logging.getLogger("sublingual")

# Import this from openai_logger to share the same context var
from sublingual_eval.logging.openai_logger import request_id_ctx_var

def setup_flask_logging():
    try:
        from flask import Flask
    except ImportError:
        logger.debug("Flask not available - skipping Flask integration")
        return False

    if getattr(Flask.__init__, '_is_request_id_patched', False):
        logger.debug("Flask.__init__ already patched; skipping patch")
        return True

    original_init = Flask.__init__

    def custom_init(self, *args, **kwargs):
        # Initialize the Flask app normally.
        original_init(self, *args, **kwargs)
        # Only patch the wsgi_app if not already patched.
        if not getattr(self.wsgi_app, '_is_request_id_patched', False):
            original_wsgi_app = self.wsgi_app

            def custom_wsgi_app(environ, start_response):
                token = request_id_ctx_var.set(str(uuid.uuid4()))
                try:
                    return original_wsgi_app(environ, start_response)
                finally:
                    request_id_ctx_var.reset(token)
            # Mark the wsgi_app wrapper as patched to prevent duplication.
            custom_wsgi_app._is_request_id_patched = True
            self.wsgi_app = custom_wsgi_app

    # Mark our custom __init__ so we don't patch twice.
    custom_init._is_request_id_patched = True
    Flask.__init__ = custom_init
    logger.debug("Successfully patched Flask.__init__ with non-duplicating request ID injection")
    return True

if __name__ == '__main__':
    setup_flask_logging()
