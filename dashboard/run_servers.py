import subprocess
import os
import signal
import sys
import time
import argparse

def start_react(react_dir):
    # Check if dependencies are installed
    node_modules = os.path.join(react_dir, 'node_modules')
    if not os.path.exists(node_modules):
        print("Installing React dependencies...")
        subprocess.check_call(['npm', 'install'], cwd=react_dir)
    # Start the React dev server, redirecting output to devnull
    print("Starting React server...")
    return subprocess.Popen(
        ['npm', 'run', 'dev'], 
        cwd=react_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

def start_flask(flask_dir, port='5360', log_dir='logs'):
    # Convert log_dir to absolute path relative to the project root
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    abs_log_dir = os.path.join(project_root, log_dir)
    
    # Start the Flask server using app.py with custom arguments
    print(f"Starting Flask server with logs at: {abs_log_dir}")
    return subprocess.Popen(
        ['python', 'app.py', '--port', str(port), '--log-dir', abs_log_dir],
        cwd=flask_dir,
        # Inherit stdout and stderr from parent process for Flask
        stdout=sys.stdout,
        stderr=sys.stderr
    )

def main():
    parser = argparse.ArgumentParser(description='Start the dashboard servers')
    parser.add_argument('log_dir', 
                      help='Directory containing the log files (e.g., subl_logs)')
    parser.add_argument('--port', type=int, default=5360,
                      help='Port for the Flask server (default: 5360)')
    
    args = parser.parse_args()
    
    # Check if log directory exists
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    abs_log_dir = os.path.join(project_root, args.log_dir)
    if not os.path.exists(abs_log_dir):
        print(f"Error: Log directory '{abs_log_dir}' does not exist")
        sys.exit(1)
    
    # Define paths to your React and Flask app directories
    base_dir = os.path.dirname(os.path.abspath(__file__))
    react_dir = os.path.join(base_dir, 'frontend')
    flask_dir = os.path.join(base_dir, 'server')

    # Start servers with your parameters
    react_proc = start_react(react_dir)
    flask_proc = start_flask(flask_dir, port=args.port, log_dir=args.log_dir)

    # Give servers a moment to start and check if they're still running
    time.sleep(2)
    if react_proc.poll() is not None or flask_proc.poll() is not None:
        print("Error: One or more servers failed to start")
        # Clean up any running processes
        if react_proc.poll() is None:
            react_proc.terminate()
        if flask_proc.poll() is None:
            flask_proc.terminate()
        sys.exit(1)

    def shutdown(sig, frame):
        print("\nShutting down servers...")
        react_proc.terminate()
        flask_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)

    try:
        while True:
            if react_proc.poll() is not None or flask_proc.poll() is not None:
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown(None, None)

    shutdown(None, None)

if __name__ == '__main__':
    main()
