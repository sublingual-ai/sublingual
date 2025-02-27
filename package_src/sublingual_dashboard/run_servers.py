import subprocess
import os
import signal
import sys
import time
import argparse
import psutil
import socket
import itertools
import threading
import webbrowser


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


def get_process_using_port(port):
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            connections = proc.connections()
            for conn in connections:
                if conn.laddr.port == port:
                    return proc
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return None


def check_ports_and_kill_processes(flask_port):
    """Check port and handle any conflicts before starting server"""
    ports_to_check = [
        (flask_port, "Flask"),
    ]

    for port, service_name in ports_to_check:
        if is_port_in_use(port):
            proc = get_process_using_port(port)
            if proc:
                # Try to determine if it's a Sublingual process
                is_sublingual = any(
                    "python" in arg.lower()
                    for arg in proc.cmdline()
                    if isinstance(arg, str)
                )

                process_desc = f"Sublingual process" if is_sublingual else "process"
                print(
                    f"\nFound existing {process_desc} (PID: {proc.pid}) using {service_name} port {port}"
                )

                response = input(
                    f"Would you like to kill this process to continue? (y/n): "
                ).lower()
                if response == "y":
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


def create_box(message, style="single"):
    chars = {
        "single": {"tl": "┌", "tr": "┐", "bl": "└", "br": "┘", "h": "─", "v": "│"},
        "double": {"tl": "╔", "tr": "╗", "bl": "╚", "br": "╝", "h": "═", "v": "║"},
    }
    box = chars[style]
    width = len(message) + 2
    top = f"{box['tl']}{box['h'] * width}{box['tr']}"
    middle = f"{box['v']} {message} {box['v']}"
    bottom = f"{box['bl']}{box['h'] * width}{box['br']}"
    return f"{top}\n{middle}\n{bottom}"


class Spinner:
    def __init__(self, message="", is_last=False):
        self.spinner = itertools.cycle(
            ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        )
        self.stop_running = False
        self.spin_thread = None
        self.message = message
        self.box_width = 50  # Match status box total width
        self.is_last = is_last

    def spin(self):
        while not self.stop_running:
            spinner_char = next(self.spinner)
            line = f"{spinner_char} {self.message}"
            sys.stdout.write("\r" + line)
            sys.stdout.flush()
            time.sleep(0.1)

        # Show completion message
        line = f"  ✓ {self.message}"
        sys.stdout.write("\r" + line)
        if not self.is_last:
            sys.stdout.write("\n")
        else:
            sys.stdout.write("\n")  # Extra newline before the connecting border
        sys.stdout.flush()

    def __enter__(self):
        self.stop_running = False
        self.spin_thread = threading.Thread(target=self.spin)
        self.spin_thread.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop_running = True
        if self.spin_thread:
            self.spin_thread.join()


def start_flask(
    flask_dir,
    port="5360",
    project_dir=".sublingual",
    verbose=False,
    debug=False,
    env_path=".env",
):
    # Use absolute path from current working directory
    abs_project_dir = os.path.abspath(project_dir)

    # Start the Flask server using app.py with custom arguments
    with Spinner(f"Starting Flask server...", is_last=True):
        commands = [
            "python",
            os.path.join(flask_dir, "app.py"),
            "--port",
            str(port),
            "--project-dir",
            abs_project_dir,
            "--env",
            env_path,
        ]
        if debug:
            commands.append("--debug")
        if verbose:
            commands.append("--verbose")

        proc = subprocess.Popen(
            commands,
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
        # Give it a moment to start
        time.sleep(2)
        return proc


def print_startup_message(flask_port, project_dir):
    # ANSI escape codes for colors
    BLUE = "\033[94m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RESET = "\033[0m"

    # Truncate project_dir from the left if too long, preserving 30 chars
    max_path_length = 30
    truncated_project_dir = (
        project_dir
        if len(project_dir) <= max_path_length
        else "..." + project_dir[-(max_path_length - 3) :]
    )

    server_url = f"http://localhost:{flask_port}"
    messages = [
        "🚀 Server started successfully!",
        f"🌐 View dashboard at: {YELLOW}{server_url}{RESET}",
        f"📁 Project Directory: {YELLOW}{truncated_project_dir}{RESET}",
        f"💡 {GREEN}Press Ctrl+C to stop the server{RESET}",
    ]

    # Calculate the width needed for the box (37 chars)
    content_width = max(
        len(
            msg.replace("\033[94m", "")
            .replace("\033[92m", "")
            .replace("\033[93m", "")
            .replace("\033[0m", "")
        )
        for msg in messages
    )
    width = content_width + 5  # Add padding

    # First print the connecting border
    print(f"╔{'═' * width}╗")

    # Then the rest of the box
    for msg in messages:
        clean_msg = (
            msg.replace("\033[94m", "")
            .replace("\033[92m", "")
            .replace("\033[93m", "")
            .replace("\033[0m", "")
        )
        padding = " " * (width - len(clean_msg) - 3)
        print(f"║ {msg}{padding} ║")
    print(f"╚{'═' * width}╝")
    print()
    webbrowser.open(server_url)


def main(args):
    # Check if project directory exists
    abs_project_dir = os.path.abspath(args.project_dir)
    if not os.path.exists(abs_project_dir):
        print(f"\nError: Could not find project directory at '{abs_project_dir}'")
        print("\nThis could be due to one of these reasons:")
        print("1. You haven't run an app with `subl ...` yet")
        print(
            "2. You're not in the same directory where you originally ran `subl ...` with "
        )
        print("\nTo fix this:")
        print("- Make sure you're in the directory where you ran 'subl' on your app")
        print("- Or specify a different project directory with --project-dir\n")
        sys.exit(1)

    # Check and handle any port conflicts before starting server
    check_ports_and_kill_processes(args.port)

    # Define paths to Flask app directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    flask_dir = os.path.join(base_dir, "server")

    # Start Flask server
    flask_proc = start_flask(
        flask_dir,
        port=args.port,
        project_dir=args.project_dir,
        verbose=args.verbose,
        debug=args.flask_debug,
        env_path=args.env,
    )

    # Give server a moment to start and check if it's still running
    time.sleep(2)
    if flask_proc.poll() is not None:
        print("Error: Server failed to start")
        if flask_proc.poll() is None:
            flask_proc.terminate()
        sys.exit(1)

    # Print the nice formatted message if not in verbose mode
    print_startup_message(args.port, abs_project_dir)

    def shutdown(sig, frame):
        print("\nShutting down server...")
        flask_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)

    try:
        while True:
            if flask_proc.poll() is not None:
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown(None, None)

    shutdown(None, None)


if __name__ == "__main__":
    # Import CLI handling from separate module
    from cli import parse_args

    main(parse_args())
