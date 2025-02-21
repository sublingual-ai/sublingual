from openai import OpenAI
import dotenv
import os

dotenv.load_dotenv("keys.env")

def get_value():
    return "moon"

if __name__ == "__main__":
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    value = get_value()

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": f"What is the capital of the {value}?"},
        ],
    )
    print("\n====OpenAI chat response====\n", response.choices[0].message.content)
