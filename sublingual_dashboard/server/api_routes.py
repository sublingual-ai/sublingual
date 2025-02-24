from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import json
import argparse
from flask import Flask, jsonify, Blueprint
from evaluations.simple_evaluations import (
    random_0_100,
    user_sentiment,
    system_prompt_obedience,
    correctness,
    initialize_client,
)
import config


router = Blueprint('api', __name__)


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
        if "correctness" in criteria:
            results["correctness"] = correctness(
                run_data["messages"], run_data["response"]
            )
        if "user_sentiment" in criteria:
            results["user_sentiment"] = user_sentiment(
                run_data["messages"], run_data["response"]
            )
        if "system_prompt_obedience" in criteria:
            results["system_prompt_obedience"] = system_prompt_obedience(
                run_data["messages"], run_data["response"]
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
        raise
    except Exception as e:
        return jsonify({"error": "Evaluation failed", "details": str(e)}), 500


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
    files = [os.path.join(config.log_dir, f) for f in os.listdir(config.log_dir)]
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
