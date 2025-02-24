from openai import AsyncOpenAI
import os
from dotenv import load_dotenv

# Load environment variables from keys.env
load_dotenv("keys.env")

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def main():
    # First call    
    response1 = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": "What is the capital of France?"}
        ]
    )
    print("First response:", response1.choices[0].message.content)

    # Second call
    response2 = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": "What is 2+2?"}
        ]
    )
    print("Second response:", response2.choices[0].message.content)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
