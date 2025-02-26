# sublingual_eval/subl.py

import argparse
import sys
from sublingual_eval.wrapper_exec import main as wrapper_python
from sublingual_eval.wrapper_generic import main as wrapper_generic
from sublingual_dashboard.run_servers import main as server_main
import os


def main():
    parser = argparse.ArgumentParser(description="Subl command line interface")
    if len(sys.argv) > 1 and sys.argv[1] == "server":
        # Handle server command
        parser.add_argument("command", help="Command to run (server)")
        parser.add_argument(
            "--log-dir",
            help="Directory containing the log files (e.g., subl_logs)",
            default=os.path.join(os.getcwd(), ".sublingual", "logs"),
            type=str,
        )
        parser.add_argument(
            "-v", "--verbose", action="store_true", help="Show Flask server output"
        )
        parser.add_argument(
            "--port",
            "-p",
            type=int,
            default=5360,
            help="Port for the Flask server",
        )
        parser.add_argument(
            "--flask-debug",
            action="store_true",
            help="Run the Flask server in debug mode",
        )
        parser.add_argument(
            "--env",
            "-e",
            type=str,
            default=".env",
            help="Path to the environment file containing the OpenAI API key",
        )
        args = parser.parse_args()
        server_main(args)
    else:
        # Handle script execution - let wrapper_main handle the args

        # wrapper_python() # Old wrapper with custom python handling
        wrapper_generic()


if __name__ == "__main__":
    main()
