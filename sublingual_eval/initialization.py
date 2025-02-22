# Import our logging setup functions
from sublingual_eval.openai_logger import (
    setup_openai_logging,
    setup_openai_async_logging,
)
from sublingual_eval.fastapi_logger import setup_fastapi_logging
import os
import sysconfig


def handle_pth():
    PTH_TEXT = "import sublingual_eval.site_customize"
    python_dir = sysconfig.get_path("purelib")
    pth_file = os.path.join(python_dir, "sublingual_eval.pth")
    try:
        with open(pth_file, "w") as f:
            f.write(PTH_TEXT)
    except Exception as e:
        # Use ANSI escape codes for colorful warning
        print(
            "\033[93m⚠️  \033[91m[sublingual] Warning:\033[0m Failed to write .pth file."
        )
        print(
            "\033[93mNew processes will not have logging enabled (Including FastAPI --workers and --reload).\033[0m"
        )
        print(f"\033[96m│\033[0m Location: {pth_file}")
        print(f"\033[96m└─\033[0m Error: {str(e)}")


def init():
    """Initialize all logging functionality"""
    if os.getenv("SUBL_PATCH_OPENAI", "0") == "1":
        setup_openai_logging()
        setup_openai_async_logging()
    if os.getenv("SUBL_PATCH_FASTAPI", "0") == "1":
        setup_fastapi_logging()
    print(
        f"Initialized logging for {os.getenv('SUBL_PATCH_OPENAI', '0')} and {os.getenv('SUBL_PATCH_FASTAPI', '0')}"
    )
