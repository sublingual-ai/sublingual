from openai import OpenAI
from dotenv import load_dotenv
from textwrap import dedent
import re
import os

# Remove the global client initialization
client = None

def initialize_client(env_file):
    global client
    load_dotenv(env_file)
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        client = OpenAI(api_key=api_key)
    else:
        RED = "\033[91m"
        RESET = "\033[0m"
        print(
            f"\n{RED}❌ No OpenAI API key found in environment file: {env_file}\nEvaluations will not work.{RESET}\n"
        )
        return None


def extract_boxed(s):
    # Use regex to extract the last boxed number
    matches = re.findall(r"\\boxed\{(.*)\}", s)
    if not matches:
        return "<NO_SCORE>"  # Return default value if no boxed numbers found
    return matches[-1]


def random_0_100():
    res = client.chat.completions.create(
        model="gpt-4o-2024-05-13",
        messages=[
            {
                "role": "user",
                "content": dedent(
                    f"""
                    Pick a random number between 0 and 100. 
                    - Do NOT say anything else, ONLY output the number.
                    - Put your answer in \\boxed{{}}
                    """
                ).strip(),
            },
        ],
        temperature=2.0,
    )
    print(res.choices[0].message.content)
    return extract_boxed(res.choices[0].message.content)


def user_sentiment(messages, response):
    strified_history = "\n\n".join([f"{m['role']}: {m['content']}" for m in messages])
    system_prompt = dedent(
        f"""
        You are a helpful assistant that evaluates the user's sentiment towards a given response.
        Return a score between 0 and 100 for the user's sentiment towards the response.
        - Do NOT say anything else, ONLY output the score.
        - Give a lower score for negative sentiment, and a higher score for positive sentiment.
        - 0 means the user is very negative towards the response
        - 100 means the user is very positive towards the response
        - 50 means the user is neutral towards the response
        - Put your answer in \\boxed{{}}
        """
    )
    prompt = dedent(
        f"""
        You are a helpful assistant that evaluates the user's sentiment towards a given response.
        Here is the conversation history:
        {strified_history}
        
        Rate the user's sentiment in the conversation.
        """
    )
    res = client.chat.completions.create(
        model="gpt-4o-2024-05-13",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
    )
    print(res.choices[0].message.content)
    return extract_boxed(res.choices[0].message.content)


def system_prompt_obedience(messages, response_object):
    # Find the system prompt if it exists
    system_prompt = None
    for message in messages:
        if message["role"] == "system":
            system_prompt = message["content"]
            break

    if not system_prompt:
        return 100  # If no system prompt, assume perfect obedience
    response = response_object["choices"][0]["message"]["content"]
    print(response)
    prompt = dedent(
        f"""
        You are evaluating how well an AI assistant followed the system prompt instructions.
        
        System prompt given to assistant:
        {system_prompt}
        
        Assistant's response:
        {response}
        
        Rate how well the assistant followed the system prompt instructions from 0-100:
        - 0 means completely ignored the system prompt
        - 100 means perfectly followed all instructions
        - Do NOT say anything else, ONLY output the score
        - Put your answer in \\boxed{{}}
        """
    )

    res = client.chat.completions.create(
        model="gpt-4o-2024-05-13",
        messages=[
            {"role": "user", "content": prompt},
        ],
    )
    return extract_boxed(res.choices[0].message.content)


def correctness(messages, response_object):
    response = response_object["choices"][0]["message"]["content"]
    strified_history = "\n\n".join([f"{m['role']}: {m['content']}" for m in messages])
    system_prompt = dedent(
        f"""
        On a scale of 0 to 100, rate how correct the response is to the user's message.
        - Say 100 if the response is an accurate answer to the user's message
        - 0 means the response is completely incorrect
        - Put your answer in \\boxed{{}}
        """
    )
    prompt = dedent(
        f"""
        You are a helpful assistant that evaluates the correctness of a given response.
        ### Conversation History
        {strified_history}
        ### Response
        {response}
        """
    )
    res = client.chat.completions.create(
        model="gpt-4o-2024-05-13",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
    )
    print("System Prompt: ", system_prompt)
    print("Prompt: ", prompt)
    print("Response: ", res.choices[0].message.content)
    return extract_boxed(res.choices[0].message.content)
