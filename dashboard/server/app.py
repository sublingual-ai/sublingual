from flask import Flask, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

logs_cache = []


@app.route("/")
def home():
    return jsonify({"message": "Welcome to the Flask Server!"})


@app.route("/health")
def health():
    return jsonify({"status": "healthy"})


@app.route("/logs")
def logs():
    return jsonify(logs_cache)


if __name__ == "__main__":
    # List all files in the current directory
    print(os.listdir("."))
    for file in os.listdir("."):
        if file.endswith(".jsonl"):
            with open(file, "r") as f:
                for line in f:
                    logs_cache.append(json.loads(line))
    app.run(debug=True, host="0.0.0.0", port=5360)
