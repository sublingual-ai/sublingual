from textwrap import dedent

# Import our logging setup functions
from sublingual_eval.logging.openai_logger import (
    setup_openai_logging,
    setup_openai_async_logging,
)
from sublingual_eval.logging.fastapi_logger import setup_fastapi_logging
from sublingual_eval.logging.django_logger import (
    setup_django_asgi_logging,
    setup_django_wsgi_logging,
)
from sublingual_eval.logging.flask_logger import setup_flask_logging
import os
import sysconfig


PTH_TEXT = dedent(
    """
    try:
        import sublingual_eval.site_customize
    except Exception as e:
        pass
    """
).strip()

### THIS IS NOT USED ANYMORE, ONLY USED TO MANUALLY WRITE .PTH AT RUN TIME
def handle_pth():
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




def create_subl_logs_dir():
    if not os.path.exists("subl_logs"):
        os.makedirs("subl_logs")


def init():
    """Initialize all logging functionality"""
    # Create the sublingual logs directory
    if (
        os.getenv("SUBL_PATCH_OPENAI", "0") == "1"
        or os.getenv("SUBL_PATCH_FASTAPI", "0") == "1"
        or os.getenv("SUBL_PATCH_DJANGO", "0") == "1"
        or os.getenv("SUBL_PATCH_FLASK", "0") == "1"
    ):
        subl_logs_path = os.path.join(os.getcwd(), ".sublingual", "logs")
        if not os.path.exists(os.path.join(os.getcwd(), ".sublingual")):
            os.makedirs(os.path.join(os.getcwd(), ".sublingual"))
        if not os.path.exists(subl_logs_path):
            os.makedirs(subl_logs_path)
        print("\033[92m\033[94m[sublingual]\033[0m Logging enabled \033[92m✔\033[0m")

    # Setup logging
    if os.getenv("SUBL_PATCH_OPENAI", "0") == "1":
        setup_openai_logging(subl_logs_path)
        setup_openai_async_logging(subl_logs_path)
    if os.getenv("SUBL_PATCH_FASTAPI", "0") == "1":
        setup_fastapi_logging()
    if os.getenv("SUBL_PATCH_DJANGO", "0") == "1":
        setup_django_asgi_logging()
        setup_django_wsgi_logging()
    if os.getenv("SUBL_PATCH_FLASK", "0") == "1":
        os.environ["FLASK_RUN_FROM_RELOADER"] = "false"
        setup_flask_logging()
