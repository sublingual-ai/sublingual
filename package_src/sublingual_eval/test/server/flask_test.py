#!/usr/bin/env python
import os
from flask import Flask, request, jsonify
import openai
from dotenv import load_dotenv

# Load environment variables from keys.env
load_dotenv(".env")
openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)

def get_gpt_response(prompt: str, system_prompt: str = None) -> str:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages
        )
        return response.choices[0].message.content
    except Exception as e:
        raise Exception(f"Error calling GPT: {str(e)}")

HTML_TEMPLATE = """
<html>
  <head>
    <title>Chat with OpenAI</title>
    <style>
      .chat-container { margin: 20px; }
      .chat-form { margin-bottom: 20px; }
      .response-container { 
        margin-top: 10px;
        white-space: pre-wrap;
        font-family: monospace;
      }
    </style>
  </head>
  <body>
    <h1>Chat with OpenAI</h1>
    
    <div class="chat-container">
      <h2>Standard Chat</h2>
      <form class="chat-form" id="standard-form" method="post" action="/chat">
        <textarea name="prompt" rows="4" cols="50" placeholder="Enter your prompt here"></textarea><br/>
        <button type="submit">Send to Standard Chat</button>
      </form>
      <div id="standard-response" class="response-container"></div>
    </div>

    <div class="chat-container">
      <h2>Creative Chat</h2>
      <form class="chat-form" id="creative-form" method="post" action="/chat/creative">
        <textarea name="prompt" rows="4" cols="50" placeholder="Enter your prompt here"></textarea><br/>
        <button type="submit">Send to Creative Chat</button>
      </form>
      <div id="creative-response" class="response-container"></div>
    </div>

    <script>
      async function handleForm(formId, responseId) {
        const form = document.getElementById(formId);
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          const formData = new FormData(form);
          try {
            const response = await fetch(form.action, {
              method: 'POST',
              body: formData,
            });
            const data = await response.json();
            document.getElementById(responseId).textContent = JSON.stringify(data, null, 2);
          } catch (error) {
            document.getElementById(responseId).textContent = `Error: ${error.message}`;
          }
        });
      }
      handleForm('standard-form', 'standard-response');
      handleForm('creative-form', 'creative-response');
    </script>
  </body>
</html>
"""

@app.route("/", methods=["GET"])
def index():
    return HTML_TEMPLATE

@app.route("/chat", methods=["POST"])
def chat_with_openai():
    prompt = request.form.get("prompt", "")
    try:
        # Call GPT twice in sequence
        message1 = get_gpt_response(prompt)
        message2 = get_gpt_response(message1)
        return jsonify({"response": message2})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/chat/creative", methods=["POST"])
def creative_chat_with_openai():
    prompt = request.form.get("prompt", "")
    system_prompt = ("You are a creative assistant who loves to think outside the box "
                     "and generate unique, imaginative responses.")
    try:
        response_text = get_gpt_response(prompt, system_prompt)
        return jsonify({"response": response_text})
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True, use_reloader=False)
