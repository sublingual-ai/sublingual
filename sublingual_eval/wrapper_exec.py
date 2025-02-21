import sys
import logging
import runpy
import os

# Set up logging
logger = logging.getLogger("sublingual")
logger.setLevel(logging.DEBUG)
logger.addHandler(logging.StreamHandler())

# Import our logging setup functions
from sublingual_eval.openai_logger import setup_openai_logging, setup_openai_async_logging
from sublingual_eval.fastapi_logger import setup_fastapi_logging

def init():
    """Initialize all logging functionality"""
    setup_openai_logging()
    setup_openai_async_logging()
    setup_fastapi_logging()

def main():
    if len(sys.argv) < 2:
        print("Usage: python -m subl <script.py>")
        sys.exit(1)
    init()  # Initialize logging only when running a script
    script = sys.argv[1]
    # Adjust sys.argv so that the target script sees its own arguments
    sys.argv = sys.argv[1:]
    runpy.run_path(script, run_name="__main__")

if __name__ == "__main__":
    main()
