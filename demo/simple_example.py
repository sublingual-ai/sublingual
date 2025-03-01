from openai import OpenAI
from dotenv import load_dotenv
import os
load_dotenv(".env")

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

def hello():
    response = client.chat.completions.create(
        model="gpt-4o-mini", 
        messages=[
            {"role": "user", "content": "Hello!"}
        ]
    )
    print(response.choices[0].message.content)

def g(language, number):
    sysprompt = f"Respond in only {number} word. Say only the name in, nothing else."
    prompt = f"Pick a name in {language}."
    response = client.chat.completions.create(
        model="gpt-4o-mini", 
        messages=[
            {"role": "system", "content": sysprompt},
            {"role": "user", "content": prompt}
        ]
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini", 
        messages=[
            {"role": "user", "content": f"Say hello to {response.choices[0].message.content}"}
        ]
    )

    user_prompt = f"Say hi in {language}"
    response = client.chat.completions.create(
        model="gpt-4o-mini", 
        messages=[
            {"role": "system", "content": "SPEAK IN ALL CAPS"},
            {"role": "user", "content": user_prompt}
        ]
    )

if __name__ == "__main__":
    hello()
    g("French", "two")