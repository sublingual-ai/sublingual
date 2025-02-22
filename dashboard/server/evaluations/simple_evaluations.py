from openai import OpenAI
from dotenv import load_dotenv
from textwrap import dedent
import re

load_dotenv("keys.env")

client = OpenAI()


def extract_boxed(s):
    # Use regex to extract the last boxed number
    matches = re.findall(r"\\boxed\{(.*)\}", s)
    if not matches:
        return "x"  # Return default value if no boxed numbers found
    return matches[-1]


def random_0_100():
    res = client.chat.completions.create(
        model="gpt-4o-mini",
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
    prompt = dedent(
        f"""
        You are a helpful assistant that evaluates the user's sentiment towards a given response.
        Here is the conversation history:
        {strified_history}
        Return a score between 0 and 100 for the user's sentiment towards the response.
        - Do NOT say anything else, ONLY output the score.
        - Give a lower score for negative sentiment, and a higher score for positive sentiment.
        - Put your answer in \\boxed{{}}
        """
    )
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": prompt},
        ],
        temperature=1.0,
    )
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
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": prompt},
        ],
        temperature=1.0,
    )
    return extract_boxed(res.choices[0].message.content)


def correctness(messages, response_object):
    response = response_object["choices"][0]["message"]["content"]
    strified_history = "\n\n".join([f"{m['role']}: {m['content']}" for m in messages])
    prompt = dedent(
        f"""
        You are a helpful assistant that evaluates the correctness of a given response.
        Here is the conversation history:
        {strified_history}
        Here is the response:
        {response}
        Return a score between 0 and 100 for the correctness of the response.
        - 0 means completely incorrect
        - 100 means completely correct
        - Do NOT say anything else, ONLY output the score
        - Put your answer in \\boxed{{}}
        """
    )
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": prompt},
        ],
    )
    return extract_boxed(res.choices[0].message.content)
