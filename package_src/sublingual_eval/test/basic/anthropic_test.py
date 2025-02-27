import anthropic
from dotenv import load_dotenv
import os
import asyncio
import json

load_dotenv()


def test_sync():
    client = anthropic.Anthropic(
        # defaults to os.environ.get("ANTHROPIC_API_KEY")
        api_key=os.getenv("ANTHROPIC_API_KEY"),
    )
    message = client.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=1024,
        system="Be incredibly excited, talk in all caps, and use emojis.",
        messages=[{"role": "user", "content": "Hello, Claude"}],
        extra_headers={
            "test-info": "test_sync",
        },
    )
    print(message.content)


def test_tool():
    client = anthropic.Anthropic(
        # defaults to os.environ.get("ANTHROPIC_API_KEY")
        api_key=os.getenv("ANTHROPIC_API_KEY"),
    )

    # Define a tool for weather information
    tools = [
        {
            "name": "get_weather",
            "description": "Get the current weather in a location",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g., San Francisco, CA",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "The unit of temperature to use",
                    },
                },
                "required": ["location"],
            },
        }
    ]

    message = client.messages.create(
        model="claude-3-7-sonnet-20250219",
        max_tokens=1024,
        system="You have access to a weather tool. Use it when asked about weather.",
        messages=[
            {"role": "user", "content": "What's the weather like in San Francisco?"}
        ],
        tools=tools,
        tool_choice={"type": "auto"},
        extra_headers={
            "test-info": "test_tool",
        },
    )

    print("Initial response:")
    print(message.content)


async def test_async():
    client = anthropic.AsyncAnthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY"),
    )
    message = await client.messages.create(
        model="claude-3-7-sonnet-20250219",
        max_tokens=1024,
        system="Act very sad, you are sad.",
        messages=[{"role": "user", "content": "Whats the matter with async?"}],
        temperature=1.0,
        extra_headers={
            "test-info": "test_async",
        },
    )
    print("Initial response:")
    print(message.content)


def main():
    test_sync()
    test_tool()
    asyncio.run(test_async())


if __name__ == "__main__":
    main()
