from openai import OpenAI
import dotenv
import os

dotenv.load_dotenv("keys.env")

def get_value():
    return "moon"

def method1():
    # Method 1: f-string with variable substitution
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": f"What is the capital of the {value}?"},
        ],
    )
    # print("Method 1 response:", response.choices[0].message.content)

def method2():
    # Method 2: using .format() method
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    prompt = "What is the capital of the {}?".format(value)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 2 response:", response.choices[0].message.content)

def method3():
    # Method 3: using string concatenation with +
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    prompt = "What is the capital of the " + value + "?"
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 3 response:", response.choices[0].message.content)

def method4():
    # Method 4: using %-formatting
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    prompt = "What is the capital of the %s?" % value
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 4 response:", response.choices[0].message.content)

def method5():
    # Method 5: using join on a list of strings
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    parts = ["What is the capital of the ", value, "?"]
    prompt = "".join(parts)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 5 response:", response.choices[0].message.content)

def method6():
    # Method 6: using a multi-line string with .format()
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    prompt = """
What is the capital of the {0}?
Please answer in one word.
""".format(value).strip()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 6 response:", response.choices[0].message.content)

def method7():
    # Method 7: using an f-string with a nested function call
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    prompt = f"What is the capital of the {get_value()}?"
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 7 response:", response.choices[0].message.content)

def method8():
    # Method 8: using string.Template
    from string import Template
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    t = Template("What is the capital of the $value?")
    prompt = t.substitute(value=value)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 8 response:", response.choices[0].message.content)

def method9():
    # Method 9: using join with a list comprehension
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    prompt = "".join([s for s in ["What is the capital of the ", value, "?"]])
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 9 response:", response.choices[0].message.content)

def method10():
    # Method 10: mixing f-string and concatenation
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    value = get_value()
    prompt_part1 = f"What is the capital"
    prompt_part2 = " of the " + value
    prompt_part3 = "?"
    prompt = prompt_part1 + prompt_part2 + prompt_part3
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    # print("Method 10 response:", response.choices[0].message.content)

if __name__ == "__main__":
    method1()
    method2()
    method3()
    method4()
    method5()
    method6()
    method7()
    method8()
    method9()
    method10()
