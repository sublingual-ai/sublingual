from openai import OpenAI
import dotenv
import os

dotenv.load_dotenv("keys.env")


def get_value():
    return "moon"

def main():
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    value = get_value()
    b = "123"
    a = b.lower()
    for i in range(10):
        story_idea = (
            client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are super creative, coming up with a short story prompt. The prompt should be 5 words MAX.",
                    },
                    {
                        "role": "user",
                        "content": f"Come up with a short story prompt",
                    },
                ],
                n=3,
                extra_headers={
                    "req_id": f"{i}",
                },
            )
            .choices[0]
            .message.content
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are very very creative, and you are a great story teller. BE VERY CONCISE, 20 words max.",
                },
                {
                    "role": "user",
                    "content": f"Tell me a very short story, about {story_idea}",
                },
            ],
            n=1,
            extra_headers={
                "req_id": f"{i}",
            },
        )
    # print("\n====OpenAI chat response====\n", response.choices[0].message.content)

if __name__ == "__main__":
    main()
