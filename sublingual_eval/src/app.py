from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import os
import openai

load_dotenv('keys.env')

# Initialize Flask app
app = Flask(__name__)

# Configure OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')
client = openai.OpenAI()

@app.route('/')
def home():
    return render_template('chat.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        user_message = request.json.get('message', '')
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using 4.0 model
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_message}
            ]
        )
        
        # Extract the assistant's response
        assistant_response = response.choices[0].message.content
        
        return jsonify({
            "response": assistant_response
        })
    
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
