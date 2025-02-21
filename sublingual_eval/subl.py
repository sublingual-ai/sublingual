# sublingual_eval/subl.py

import argparse
import sys
from sublingual_eval.wrapper_exec import main as wrapper_main
from dashboard.run_servers import main as server_main

def main():
    parser = argparse.ArgumentParser(description="Subl command line interface")
    
    if len(sys.argv) > 1 and sys.argv[1] == 'server':
        # Handle server command
        parser.add_argument('command', help='Command to run (server)')
        parser.add_argument('log_dir', help='Directory containing the log files (e.g., subl_logs)')
        parser.add_argument('--flask-port', type=int, default=5360, help='Port for the Flask server (default: 5360)')
        parser.add_argument('--react-port', type=int, default=5361, help='Port for the React server (default: 5361)')
        parser.add_argument('-v', '--verbose', action='store_true', help='Show Flask server output')
        args = parser.parse_args()
        server_main(args)
    else:
        # Handle script execution - let wrapper_main handle the args
        wrapper_main()

if __name__ == "__main__":
    main()
