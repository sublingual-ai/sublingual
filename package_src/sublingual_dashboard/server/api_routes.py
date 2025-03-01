from flask import Blueprint, jsonify, request
import os
import json
import config
from evaluations.evaluation import Evaluation, chat_with_messages
from typing import Dict, List, Optional

router = Blueprint('api', __name__)

# Add near the top with other constants
DEFAULT_METRICS = {
    "correctness": {
        "name": "Correctness",
        "prompt": "Evaluate the correctness of the response.",
        "tool_type": "int",
        "min_val": 0,
        "max_val": 100
    },
    "user_sentiment": {
        "name": "User Sentiment",
        "prompt": "Evaluate the user's sentiment towards the response.",
        "tool_type": "int",
        "min_val": 0,
        "max_val": 100
    },
    "system_prompt_obedience": {
        "name": "System Prompt Obedience",
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


def fetch_metrics_from_disk():
    metrics_file = os.path.join(config.project_dir, "metrics", "metrics.json")
    try:
        with open(metrics_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        initialize_metrics()
        with open(metrics_file, 'r') as f:
            return json.load(f)


def get_evaluations_file_path() -> str:
    """Get the path to the evaluations storage file."""
    eval_dir = os.path.join(config.project_dir, "metrics")
    if not os.path.exists(eval_dir):
        os.makedirs(eval_dir)
    return os.path.join(eval_dir, "evaluations.json")

def load_evaluations() -> Dict:
    """Load existing evaluations from file."""
    file_path = get_evaluations_file_path()
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_evaluations(evaluations: Dict) -> None:
    """Save evaluations to file."""
    file_path = get_evaluations_file_path()
    with open(file_path, 'w') as f:
        json.dump(evaluations, f, indent=2)

def check_existing_evaluations(run_id: str, criteria: List[str]) -> Dict[str, List[str]]:
    """Check which criteria already have evaluations for the given run."""
    existing_evals = load_evaluations()
    if run_id not in existing_evals:
        return {}
    
    existing_criteria = {}
    for criterion in criteria:
        if criterion in existing_evals[run_id]:
            if criterion not in existing_criteria:
                existing_criteria[criterion] = []
            existing_criteria[criterion].append(run_id)
    
    return existing_criteria

@router.route("/health")
def health():
    return jsonify({"status": "healthy"})


@router.route("/evaluate", methods=["POST"])
def evaluate():
    data = request.json
    run_id = data.get("run_id", "")
    run_data = data.get("run", {})
    criteria = data.get("criteria", [])
    check_existing = data.get("check_existing", False)
    force = data.get("force", False)
    
    # If just checking existing evaluations, return that info
    if check_existing:
        existing = check_existing_evaluations(run_id, criteria)
        return jsonify({"existing_evaluations": existing})
    
    # Get metrics as Python dict
    metrics = fetch_metrics_from_disk()
    
    results = {criterion: "<NO_SCORE>" for criterion in criteria}
    try:
        for criterion in criteria:
            messages = run_data["messages"] + [run_data["response"]["choices"][0]["message"]]
            results[criterion] = Evaluation.from_dict(
                metrics[criterion]
            ).grade(
                messages, "gpt-4o-mini"
            )
        
        # Save results if force is True
        if force:
            evaluations = load_evaluations()
            if run_id not in evaluations:
                evaluations[run_id] = {}
            evaluations[run_id].update(results)
            save_evaluations(evaluations)
            
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
    try:
        return jsonify(fetch_metrics_from_disk())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@router.route("/metrics/add", methods=['POST'])
def add_metric():
    try:
        data = request.json
        required_fields = ['name', 'prompt', 'tool_type', 'min_val', 'max_val']
        
        # Validate required fields
        if not all(field in data for field in required_fields):
            return jsonify({
                "error": "Missing required fields",
                "required": required_fields
            }), 400

        # Read existing metrics
        metrics = fetch_metrics_from_disk()
        
        # Generate a unique key from the name
        key = data['name'].lower().replace(' ', '_')
        
        # Check if metric already exists
        if key in metrics:
            return jsonify({
                "error": "A metric with this name already exists"
            }), 400
            
        # Add new metric
        metrics[key] = {
            "name": data['name'],
            "prompt": data['prompt'],
            "tool_type": data['tool_type'],
            "min_val": data['min_val'],
            "max_val": data['max_val']
        }
        
        # Write back to file
        metrics_file = os.path.join(config.project_dir, "metrics", "metrics.json")
        with open(metrics_file, 'w') as f:
            json.dump(metrics, f, indent=2)
            
        return jsonify(metrics)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@router.route("/evaluations", methods=['GET'])
def get_evaluations():
    """Return all stored evaluations."""
    try:
        evals = load_evaluations()
        return jsonify(evals)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@router.route("/delete_logs", methods=["POST"])
def delete_logs():
    data = request.json
    file_paths = data.get("file_paths", [])

    print(f"Deleting files: {file_paths}")
    if not file_paths:
        return jsonify({"error": "No file paths provided"}), 400

    results = {
        "success": [],
        "failed": []
    }

    for file_path in file_paths:
        try:
            if not os.path.exists(file_path):
                results["failed"].append({"path": file_path, "reason": "File not found"})
                continue

            os.remove(file_path)
            results["success"].append(file_path)
        except Exception as e:
            results["failed"].append({"path": file_path, "reason": str(e)})

    if not results["failed"]:
        return jsonify({"success": True, "deleted": results["success"]})
    else:
        return jsonify({
            "partial_success": True,
            "deleted": results["success"],
            "failed": results["failed"]
        }), 207  # 207 Multi-Status


@router.route("/chatwith", methods=["POST"])
def chat():
    try:
        data = request.json
        messages = data.get("messages", [])
        
        response_text = chat_with_messages(messages, model="gpt-4o")
        return jsonify({
            "message": response_text
        })
    except ValueError as e:
        print("ValueError:", str(e))
        return jsonify({
            "error": "OpenAI client not initialized",
            "details": str(e)
        }), 503
    except Exception as e:
        print("Exception:", str(e))
        return jsonify({"error": str(e)}), 500
