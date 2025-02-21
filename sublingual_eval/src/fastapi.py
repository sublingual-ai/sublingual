import os
import openai
from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse, JSONResponse
from dotenv import load_dotenv

# Load environment variables from keys.env
load_dotenv("keys.env")
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Basic HTML frontend to submit a chat prompt
@app.get("/", response_class=HTMLResponse)
async def get_frontend():
    html_content = """
    <html>
      <head>
        <title>Chat with OpenAI</title>
      </head>
      <body>
        <h1>Chat with OpenAI</h1>
        <form action="/chat" method="post">
          <textarea name="prompt" rows="4" cols="50" placeholder="Enter your prompt here"></textarea><br/>
          <button type="submit">Send</button>
        </form>
      </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# API endpoint to get chat completions from OpenAI
@app.post("/chat", response_class=JSONResponse)
async def chat_with_openai(prompt: str = Form(...)):
    try:
        # Call OpenAI's Chat Completions endpoint
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        message1 = response.choices[0].message.content
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": message1}]
        )
        message2 = response.choices[0].message.content
        return {"response": message2}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
