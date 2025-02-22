import subprocess
import os
import signal
import sys
import time
import argparse
import psutil
import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def get_process_using_port(port):
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            connections = proc.connections()
            for conn in connections:
                if conn.laddr.port == port:
                    return proc
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return None

def check_ports_and_kill_processes(flask_port, react_port):
    """Check both ports and handle any conflicts before starting servers"""
    ports_to_check = [
        (flask_port, "Flask"),
        (react_port, "React")
    ]
    
    for port, service_name in ports_to_check:
        if is_port_in_use(port):
            proc = get_process_using_port(port)
            if proc:
                # Try to determine if it's a Sublingual process
                is_sublingual = any('python' in arg.lower() for arg in proc.cmdline() if isinstance(arg, str))
                
                process_desc = f"Sublingual process" if is_sublingual else "process"
                print(f"\nFound existing {process_desc} (PID: {proc.pid}) using {service_name} port {port}")
                
                response = input(f"Would you like to kill this process to continue? (y/n): ").lower()
                if response == 'y':
                    try:
                        proc.terminate()
                        proc.wait(timeout=5)  # Wait for process to terminate
                        print(f"Process terminated successfully")
                    except psutil.TimeoutExpired:
                        proc.kill()  # Force kill if termination takes too long
                        print(f"Process force killed")
                    except Exception as e:
                        print(f"Error killing process: {e}")
                        print("Aborting startup")
                        sys.exit(1)
                else:
                    print("Aborting startup")
                    sys.exit(1)
    
    # Add a small delay after killing processes to ensure ports are freed
    time.sleep(1)

def start_react(react_dir, port=5361):
    # Check if dependencies are installed
    node_modules = os.path.join(react_dir, 'node_modules')
    if not os.path.exists(node_modules):
        print("Installing React dependencies...")
        subprocess.check_call(['npm', 'install'], cwd=react_dir)
    # Start the React dev server with specified port
    print("Starting React server...")
    return subprocess.Popen(
        ['npm', 'run', 'dev', '--', '--port', str(port)], 
        cwd=react_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

def start_flask(flask_dir, port='5360', log_dir='logs', verbose=False):
    # Use absolute path from current working directory
    abs_log_dir = os.path.abspath(log_dir)
    
    # Start the Flask server using app.py with custom arguments
    print(f"Starting Flask server with logs at: {abs_log_dir}")
    return subprocess.Popen(
        ['python', os.path.join(flask_dir, 'app.py'), '--port', str(port), '--log-dir', abs_log_dir],
        stdout=sys.stdout if verbose else subprocess.DEVNULL,
        stderr=sys.stderr if verbose else subprocess.DEVNULL
    )

def print_startup_message(flask_port, react_port):
    # ANSI escape codes for colors
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'
    
    print("\n" + "=" * 60)
    print(f"🚀 Servers started successfully!")
    print(f"📱 Frontend available at: {BLUE}http://localhost:{react_port}{RESET}")
    print(f"🔧 API server running at: {YELLOW}http://localhost:{flask_port}{RESET}")
    print(f"💡 {GREEN}Press Ctrl+C to stop the servers{RESET}")
    print("=" * 60 + "\n")

def main(args):
    # Check if log directory exists
    abs_log_dir = os.path.abspath(args.log_dir)
    if not os.path.exists(abs_log_dir):
        print(f"Error: Log directory '{abs_log_dir}' does not exist")
        sys.exit(1)
    
    # Check and handle any port conflicts before starting servers
    check_ports_and_kill_processes(args.flask_port, args.react_port)
    
    # Define paths to your React and Flask app directories
    base_dir = os.path.dirname(os.path.abspath(__file__))
    react_dir = os.path.join(base_dir, 'frontend')
    flask_dir = os.path.join(base_dir, 'server')

    # Start servers with your parameters
    react_proc = start_react(react_dir, port=args.react_port)
    flask_proc = start_flask(flask_dir, port=args.flask_port, log_dir=args.log_dir, verbose=args.verbose)

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

    # Print the nice formatted message if not in verbose mode
    if not args.verbose:
        print_startup_message(args.flask_port, args.react_port)

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
    # This is just for direct script execution, not used by subl
    parser = argparse.ArgumentParser(description='Start the dashboard servers')
    parser.add_argument('--log-dir', default=os.path.join(os.getcwd(), '.sublingual', 'logs'), 
                       help='Directory containing the log files (default: .sublingual/logs)')
    parser.add_argument('--flask-port', type=int, default=5360, help='Port for the Flask server (default: 5360)')
    parser.add_argument('--react-port', type=int, default=5361, help='Port for the React server (default: 5361)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Show Flask server output')
    main(parser.parse_args())
