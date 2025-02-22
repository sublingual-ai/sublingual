from flask import Flask, jsonify, request
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
)

app = Flask(__name__)
CORS(app)

log_dir = ""


@app.route("/")
def home():
    return jsonify({"message": "Welcome to the Flask Server!"})


@app.route("/health")
def health():
    return jsonify({"status": "healthy"})


@app.route("/evaluate", methods=["POST"])
def evaluate():
    data = request.json
    run_id = data.get("run_id", "")
    run_data = data.get("run", {})
    criteria = data.get("criteria", [])
    # TODO: Implement actual evaluation logic
    # For now, return random scores for the requested criteria
    results = {criterion: "X" for criterion in criteria}
    print(criteria)
    if "correctness" in criteria:
        results["correctness"] = correctness(run_data["messages"], run_data["response"])
    if "user_sentiment" in criteria:
        results["user_sentiment"] = user_sentiment(
            run_data["messages"], run_data["response"]
        )
    if "system_prompt_obedience" in criteria:
        results["system_prompt_obedience"] = system_prompt_obedience(
            run_data["messages"], run_data["response"]
        )

    return jsonify({"scores": results})


@app.route("/get_log")
def get_log():
    filename = request.args.get("filename", "")
    try:
        all_logs = []
        with open(filename, "r") as f:
            for line in f:
                obj = json.loads(line)
                # Coalesce session_id from extra_headers if it's not present
                if obj["session_id"] is None:
                    obj["session_id"] = obj.get("extra_info", {}).get("req_id", None)
                all_logs.append(obj)
        return jsonify(all_logs)
    except FileNotFoundError:
        return jsonify({"error": f"Log file {filename} not found"}), 404
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON in log file"}), 500


@app.route("/get_available_logs")
def get_available_logs():
    files = [os.path.join(log_dir, f) for f in os.listdir(log_dir)]
    # Get creation time for each file and sort descending
    files_with_time = [(f, os.path.getctime(f)) for f in files]
    files_with_time.sort(key=lambda x: x[1], reverse=True)
    # Return just the filenames
    return jsonify([f[0] for f in files_with_time])


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
    args = parser.parse_args()

    # Use the absolute path as provided
    log_dir = args.log_dir

    app.run(debug=True, host="0.0.0.0", port=args.port)
