import os
import openai
from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse, JSONResponse
from dotenv import load_dotenv
import sublingual_eval

# Load environment variables from keys.env
load_dotenv("keys.env")
openai.api_key = os.getenv("OPENAI_API_KEY")


if __name__ == "__main__":
    print("Running module_test.py")
    print(sublingual_eval.__file__)
    client = openai.OpenAI()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "What is the capital of the moon?"}],
    )
    print(response.choices[0].message.content)
