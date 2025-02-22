from openai import AsyncOpenAI
import os
from dotenv import load_dotenv

# Load environment variables from keys.env
load_dotenv("keys.env")

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Define available tools
calculator_tool = {
    "type": "function",
    "function": {
        "name": "calculator",
        "description": "Perform basic arithmetic calculations",
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["add", "subtract", "multiply", "divide"],
                    "description": "The arithmetic operation to perform"
                },
                "numbers": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "The numbers to perform the operation on"
                }
            },
            "required": ["operation", "numbers"]
        }
    }
}

async def calculator(operation: str, numbers: list) -> float:
    if operation == "add":
        return sum(numbers)
    elif operation == "subtract":
        return numbers[0] - sum(numbers[1:])
    elif operation == "multiply":
        result = 1
        for num in numbers:
            result *= num
        return result
    elif operation == "divide":
        result = numbers[0]
        for num in numbers[1:]:
            result /= num
        return result
    raise ValueError(f"Unknown operation: {operation}")

async def main():
    # First call without tool use
    response1 = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": "What is 15 plus 27?"}
        ]
    )
    print("First response:", response1.choices[0].message.content)

    # Second call with tool use
    response2 = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": "What is 10 times 5?"}
        ],
        tools=[calculator_tool],
        tool_choice={"type": "function", "function": {"name": "calculator"}}
    )
    print("Second response:")
    for choice in response2.choices:
        print(choice.message.content)
        print(choice.message.tool_calls)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
