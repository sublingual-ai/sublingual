from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import json
import argparse
from flask import Flask, jsonify
from flask_cors import CORS
from evaluations.evaluation import initialize_client
import config
import logging
from api_routes import router, initialize_metrics

app = Flask(__name__)
CORS(app)

app.register_blueprint(router, url_prefix="/api")

# Serve static files from frontend_build directory
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_static(path):
    if path == "":
        return send_from_directory("frontend_build", "index.html")
    try:
        return send_from_directory("frontend_build", path)
    except FileNotFoundError:
        return send_from_directory("frontend_build", "index.html")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run the Flask server with custom options."
    )
    parser.add_argument(
        "--port", type=int, default=5360, help="Port number for the Flask server"
    )
    parser.add_argument(
        "--project-dir",
        type=str,
        default=".sublingual",
        help="Directory containing the Sublingual project files",
    )
    parser.add_argument(
        "--env",
        type=str,
        default=".env",
        help="Path to the environment file containing the OpenAI API key",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Run the Flask server in debug mode",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Run the Flask server in verbose mode",
    )
    args = parser.parse_args()

    # Set up the project directory in config
    config.set_project_dir(args.project_dir)
    
    # Initialize metrics configuration
    initialize_metrics()
    
    # Initialize the OpenAI client
    initialize_client(args.env)

    # If not verbose, disable Flask's logging
    if not args.verbose:
        logging.getLogger("werkzeug").setLevel(logging.ERROR)

    app.run(debug=args.debug, host="0.0.0.0", port=args.port)
