from flask import Flask, jsonify
import os

app = Flask(__name__)


@app.route("/")
def home():
    return jsonify({"message": "Welcome to the Flask Server!"})


@app.route("/health")
def health():
    return jsonify({"status": "healthy"})


if __name__ == "__main__":
    # List all files in the current directory
    app.run(debug=True, host="0.0.0.0", port=5360)
