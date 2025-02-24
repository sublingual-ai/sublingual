import sys
import logging
import runpy
import os

# Set up logging
logger = logging.getLogger("sublingual")
logger.setLevel(logging.DEBUG)
logger.addHandler(logging.StreamHandler())

from sublingual_eval.initialization import init, handle_pth


def main():
    if len(sys.argv) < 2:
        print("Usage: subl <script.py>")
        sys.exit(1)

    # Env vars to select which modules to patch
    os.environ["SUBL_PATCH_OPENAI"] = "1"
    os.environ["SUBL_PATCH_FASTAPI"] = "1"
    os.environ["SUBL_PATCH_DJANGO"] = "1"
    os.environ["SUBL_PATCH_FLASK"] = "1"

    init()

    # Pretty print the running command
    if sys.argv[1] == "-m":
        if len(sys.argv) < 3:
            print("Usage: subl -m <module>")
            sys.exit(1)
        print("\033[94m[sublingual]\033[0m Running:", " ".join(sys.argv[2:]))
        module = sys.argv[2]
        # Adjust sys.argv so that the target module sees its own arguments
        sys.argv = sys.argv[2:]
        runpy.run_module(module, run_name="__main__", alter_sys=True)
    else:
        print("\033[94m[sublingual]\033[0m Running:", " ".join(sys.argv[1:]))
        script = sys.argv[1]
        # Adjust sys.argv so that the target script sees its own arguments
        sys.argv = sys.argv[1:]
        runpy.run_path(script, run_name="__main__")


if __name__ == "__main__":
    main()
