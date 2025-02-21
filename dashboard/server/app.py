from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return jsonify({"message": "Welcome to the Flask Server!"})


@app.route("/health")
def health():
    return jsonify({"status": "healthy"})


@app.route("/get_log")
def get_log():
    filename = request.args.get("filename", "")
    try:
        obj = []
        with open(filename, "r") as f:
            for line in f:
                obj.append(json.loads(line))
        return jsonify(obj)
    except FileNotFoundError:
        return jsonify({"error": f"Log file {filename} not found"}), 404
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON in log file"}), 500


@app.route("/get_available_logs")
def get_available_logs():
    files = os.listdir(".")
    # Get creation time for each file and sort descending
    files_with_time = [(f, os.path.getctime(f)) for f in files]
    files_with_time.sort(key=lambda x: x[1], reverse=True)
    # Return just the filenames
    return jsonify([f[0] for f in files_with_time])


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5360, use_reloader=True)
