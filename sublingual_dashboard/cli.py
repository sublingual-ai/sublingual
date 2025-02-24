import argparse
import os

def parse_args():
    """Parse and return command line arguments"""
    parser = argparse.ArgumentParser(description='Start the dashboard servers')
    parser.add_argument(
        '--log-dir', 
        default=os.path.join(os.getcwd(), '.sublingual', 'logs'),
        help='Directory containing the log files (default: .sublingual/logs)'
    )
    parser.add_argument(
        '--flask-port', 
        type=int, 
        default=5360,
        help='Port for the Flask server (default: 5360)'
    )
    parser.add_argument(
        '--react-port',
        type=int,
        default=5361,
        help='Port for the React server (default: 5361)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Show Flask server output'
    )
    
    return parser.parse_args() 