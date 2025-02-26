#!/usr/bin/env python
import os
import sys
import django
import asyncio
from django.conf import settings
from django.core.management import execute_from_command_line
from django.http import HttpResponse, JsonResponse
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from dotenv import load_dotenv
import openai

# Load environment variables from keys.env
load_dotenv(".env")
openai.api_key = os.getenv("OPENAI_API_KEY")

# Minimal Django settings
DEBUG = True
SECRET_KEY = 'your-secret-key'
ALLOWED_HOSTS = ['*']

if not settings.configured:
    settings.configure(
        DEBUG=DEBUG,
        SECRET_KEY=SECRET_KEY,
        ALLOWED_HOSTS=ALLOWED_HOSTS,
        ROOT_URLCONF=__name__,
        MIDDLEWARE=[
            'django.middleware.common.CommonMiddleware',
            'django.middleware.csrf.CsrfViewMiddleware',
        ],
    )

django.setup()

# Helper async function to call OpenAI.
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

# Index view that returns HTML with two forms.
async def index(request):
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
          <form class="chat-form" id="standard-form" method="post" action="/chat/">
            <textarea name="prompt" rows="4" cols="50" placeholder="Enter your prompt here"></textarea><br/>
            <button type="submit">Send to Standard Chat</button>
          </form>
          <div id="standard-response" class="response-container"></div>
        </div>

        <div class="chat-container">
          <h2>Creative Chat</h2>
          <form class="chat-form" id="creative-form" method="post" action="/chat/creative/">
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
    return HttpResponse(html_content)

# Standard chat endpoint.
@csrf_exempt
async def chat_with_openai(request):
    if request.method == "POST":
        prompt = request.POST.get("prompt", "")
        try:
            message1 = await get_gpt_response(prompt)
            message2 = await get_gpt_response(message1)
            return JsonResponse({"response": message2})
        except Exception as e:
            return JsonResponse({"error": str(e)})
    return JsonResponse({"error": "Only POST method allowed"})

# Creative chat endpoint.
@csrf_exempt
async def creative_chat_with_openai(request):
    if request.method == "POST":
        prompt = request.POST.get("prompt", "")
        system_prompt = "You are a creative assistant who loves to think outside the box and generate unique, imaginative responses."
        try:
            response = await get_gpt_response(prompt, system_prompt)
            return JsonResponse({"response": response})
        except Exception as e:
            return JsonResponse({"error": str(e)})
    return JsonResponse({"error": "Only POST method allowed"})

# URL patterns.
urlpatterns = [
    path('', index),
    path('chat/', chat_with_openai),
    path('chat/creative/', creative_chat_with_openai),
]

# Run the Django development server.
if __name__ == "__main__":
    execute_from_command_line(sys.argv)
