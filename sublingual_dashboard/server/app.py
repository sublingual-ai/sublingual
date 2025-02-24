from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import json
import argparse
from flask import Flask, jsonify
from flask_cors import CORS
from evaluations.simple_evaluations import (
    random_0_100,
    user_sentiment,
    system_prompt_obedience,
    correctness,
    initialize_client,
)
import config

app = Flask(__name__)
CORS(app)

from api_routes import router

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
        "--log-dir",
        type=str,
        default=".",
        help="Directory to load .jsonl log files from",
    )
    parser.add_argument(
        "--env-file",
        type=str,
        default="keys.env",
        help="Path to the environment file containing the OpenAI API key",
    )
    args = parser.parse_args()

    # Use the absolute path as provided
    config.set_log_dir(args.log_dir)
    print(f"Log directory: {config.log_dir}")

    # Initialize the OpenAI client
    initialize_client(args.env_file)

    app.run(debug=True, host="0.0.0.0", port=args.port)
