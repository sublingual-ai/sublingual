from openai import OpenAI
import dotenv
import os

dotenv.load_dotenv("keys.env")


def get_value():
    return "moon"


if __name__ == "__main__":
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    value = get_value()
    b = "123"
    a = b.lower()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are very very creative, and you are a great story teller. BE VERY CONCISE, 20 words max.",
            },
            {
                "role": "user",
                "content": f"Tell me a very short story, maybe about {a} ",
            },
        ],
        n=3,
        extra_headers={
            "run_id": "run1",
        },
    )
    # print("\n====OpenAI chat response====\n", response.choices[0].message.content)
