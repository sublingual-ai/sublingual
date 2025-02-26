import sys
import os
import subprocess


def main():
    if len(sys.argv) < 2:
        print("Usage: subl <command>")
        sys.exit(1)

    # Set environment variables for module patching
    os.environ["SUBL_PATCH_OPENAI"] = "1"
    os.environ["SUBL_PATCH_FASTAPI"] = "1"
    os.environ["SUBL_PATCH_DJANGO"] = "1"
    os.environ["SUBL_PATCH_FLASK"] = "1"

    # Print the command that is about to be executed
    print("\033[94m[sublingual]\033[0m Running command:", " ".join(sys.argv[1:]))

    # Execute the provided command with the current environment variables
    result = subprocess.run(sys.argv[1:], env=os.environ)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
