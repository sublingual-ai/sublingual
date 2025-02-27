from langchain.chat_models import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain.schema import HumanMessage, SystemMessage
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory

from dotenv import load_dotenv

load_dotenv("../../../.env")


def simple_chat_example():
    # Initialize the ChatOpenAI model
    chat = ChatOpenAI(temperature=0.7, model_name="gpt-3.5-turbo")

    # Create a simple conversation chain with memory
    conversation = ConversationChain(
        llm=chat, memory=ConversationBufferMemory(), verbose=True
    )

    # Example interactions
    responses = []

    # First interaction
    response1 = conversation.predict(input="Hi! How are you?")
    responses.append(response1)

    # Second interaction
    response2 = conversation.predict(
        input="What can you tell me about Python programming?"
    )
    responses.append(response2)

    return responses


def direct_message_example():
    # Initialize the chat model
    chat = ChatOpenAI(temperature=0.7, model_name="gpt-3.5-turbo")

    # Example of sending messages directly
    messages = [
        SystemMessage(content="You are a helpful programming assistant."),
        HumanMessage(
            content="Write a simple Python function to calculate fibonacci numbers."
        ),
    ]

    response = chat(messages)
    return response.content


def anthropic_example():
    # Initialize the ChatAnthropic model
    chat = ChatAnthropic(temperature=0.7, model="claude-3-5-sonnet-20240620")

    # Example of sending messages directly
    messages = [
        SystemMessage(
            content="Your name is claude, make sure to use it in your responses."
        ),
        HumanMessage(
            content="What are the key differences between Python lists and tuples?"
        ),
    ]

    response = chat(messages)
    return response.content


if __name__ == "__main__":
    # Test the conversation chain
    print("Testing conversation chain:")
    responses = simple_chat_example()
    for i, response in enumerate(responses, 1):
        print(f"\nResponse {i}:", response)

    print("\nTesting direct messaging with OpenAI:")
    fibonacci_response = direct_message_example()
    print(fibonacci_response)

    print("\nTesting Anthropic Claude:")
    claude_response = anthropic_example()
    print(claude_response)
