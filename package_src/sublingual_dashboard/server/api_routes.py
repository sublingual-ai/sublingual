from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import json
from flask import Flask, jsonify, Blueprint
import config
from evaluations.evaluation import Evaluation, initialize_client

router = Blueprint('api', __name__)

# Add near the top with other constants
DEFAULT_METRICS = {
    "correctness": {
        "name": "correctness",
        "prompt": "Evaluate the correctness of the response.",
        "tool_type": "int",
        "min_val": 0,
        "max_val": 100
    },
    "user_sentiment": {
        "name": "user_sentiment",
        "prompt": "Evaluate the user's sentiment towards the response.",
        "tool_type": "int",
        "min_val": 0,
        "max_val": 100
    },
    "system_prompt_obedience": {
        "name": "system_prompt_obedience",
        "prompt": "Evaluate the system prompt obedience of the response.",
        "tool_type": "int",
        "min_val": 0,
        "max_val": 100
    }
}

def initialize_metrics():
    """Initialize the metrics configuration file if it doesn't exist."""
    metrics_dir = os.path.join(config.project_dir, "metrics")
    metrics_file = os.path.join(metrics_dir, "metrics.json")
    
    if not os.path.exists(metrics_dir):
        os.makedirs(metrics_dir)
    
    if not os.path.exists(metrics_file):
        with open(metrics_file, 'w') as f:
            json.dump(DEFAULT_METRICS, f, indent=2)

@router.route("/health")
def health():
    return jsonify({"status": "healthy"})


@router.route("/evaluate", methods=["POST"])
def evaluate():
    data = request.json
    run_id = data.get("run_id", "")
    run_data = data.get("run", {})
    criteria = data.get("criteria", [])

    results = {criterion: "<NO_SCORE>" for criterion in criteria}
    try:
        for criterion in criteria:
            messages = run_data["messages"] + [run_data["response"]["choices"][0]["message"]]
            results[criterion] = Evaluation.from_dict(
                DEFAULT_METRICS[criterion]
            ).grade(
                messages, "gpt-4o-mini"
            )
        return jsonify({"scores": results})
    except AttributeError as e:
        if "NoneType" in str(e):
            return (
                jsonify(
                    {
                        "error": "OpenAI client not initialized. Make sure OPENAI_API_KEY is set in your environment file.",
                        "details": str(e),
                    }
                ),
                503,
            )
        raise e
    except Exception as e:
        return jsonify({"error": "Evaluation failed ", "details": str(e)}), 500


@router.route("/get_log")
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


@router.route("/get_available_logs")
def get_available_logs():
    log_dir = os.path.join(config.project_dir, "logs")
    if not os.path.exists(log_dir):
        return jsonify([])
    files = [os.path.join(log_dir, f) for f in os.listdir(log_dir)]
    # Get creation time for each file and sort descending
    files_with_time = [(f, os.path.getctime(f)) for f in files]
    files_with_time.sort(key=lambda x: x[1], reverse=True)
    # Return just the filenames
    return jsonify([f[0] for f in files_with_time])


@router.route("/rename_log", methods=["POST"])
def rename_log():
    data = request.json
    old_path = data.get("old_path")
    new_name = data.get("new_name")

    if not old_path or not new_name:
        return jsonify({"error": "Missing required parameters"}), 400

    try:
        # Get the directory and old filename
        directory = os.path.dirname(old_path)
        # Create new path with the new name
        new_path = os.path.join(directory, f"{new_name}.jsonl")

        # Check if new filename already exists
        if os.path.exists(new_path):
            return jsonify({"error": "A file with this name already exists"}), 400

        # Rename the file
        os.rename(old_path, new_path)
        return jsonify({"success": True, "new_path": new_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@router.route("/delete_log", methods=["POST"])
def delete_log():
    data = request.json
    file_path = data.get("file_path")

    if not file_path:
        return jsonify({"error": "Missing file path"}), 400

    try:
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        os.remove(file_path)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@router.route("/metrics", methods=['GET'])
def get_metrics():
    metrics_file = os.path.join(config.project_dir, "metrics", "metrics.json")
    try:
        with open(metrics_file, 'r') as f:
            return jsonify(json.load(f))
    except FileNotFoundError:
        initialize_metrics()
        return jsonify(DEFAULT_METRICS)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
