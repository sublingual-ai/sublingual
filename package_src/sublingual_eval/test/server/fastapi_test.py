import os
import openai
from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse, JSONResponse
from dotenv import load_dotenv

# Load environment variables from keys.env
load_dotenv(".env")
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

async def get_gpt_response(prompt: str, system_prompt: str = None) -> str:
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

# Basic HTML frontend to submit a chat prompt
@app.get("/", response_class=HTMLResponse)
async def get_frontend():
    html_content = """
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
          <form class="chat-form" id="standard-form">
            <textarea name="prompt" rows="4" cols="50" placeholder="Enter your prompt here"></textarea><br/>
            <button type="submit">Send to Standard Chat</button>
          </form>
          <div id="standard-response" class="response-container"></div>
        </div>

        <div class="chat-container">
          <h2>Creative Chat</h2>
          <form class="chat-form" id="creative-form">
            <textarea name="prompt" rows="4" cols="50" placeholder="Enter your prompt here"></textarea><br/>
            <button type="submit">Send to Creative Chat</button>
          </form>
          <div id="creative-response" class="response-container"></div>
        </div>

        <script>
          function handleSubmit(formId, endpoint) {
            document.getElementById(formId).addEventListener('submit', async (e) => {
              e.preventDefault();
              const form = e.target;
              const responseDiv = document.getElementById(formId.replace('form', 'response'));
              
              try {
                const formData = new FormData(form);
                const response = await fetch(endpoint, {
                  method: 'POST',
                  body: formData
                });
                const data = await response.json();
                responseDiv.textContent = JSON.stringify(data, null, 2);
              } catch (error) {
                responseDiv.textContent = `Error: ${error.message}`;
              }
            });
          }

          handleSubmit('standard-form', '/chat');
          handleSubmit('creative-form', '/chat/creative');
        </script>
      </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# Standard chat endpoint
@app.post("/chat", response_class=JSONResponse)
async def chat_with_openai(prompt: str = Form(...)):
    try:
        message1 = await get_gpt_response(prompt)
        message2 = await get_gpt_response(message1)
        return {"response": message2}
    except Exception as e:
        return {"error": str(e)}

# Creative chat endpoint with different system prompt
@app.post("/chat/creative", response_class=JSONResponse)
async def creative_chat_with_openai(prompt: str = Form(...)):
    try:
        system_prompt = "You are a creative assistant who loves to think outside the box and generate unique, imaginative responses."
        response = await get_gpt_response(prompt, system_prompt)
        return {"response": response}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)