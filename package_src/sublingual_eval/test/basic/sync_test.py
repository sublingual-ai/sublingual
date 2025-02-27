from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables from keys.env
load_dotenv(".env")

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# First call
response1 = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "What is the capital of France?"}
    ]
)
print("First response:", response1.choices[0].message.content)

# Second call
response2 = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "What is 2+2?"}
    ]
)
print("Second response:", response2.choices[0].message.content)
