# 🐍 🔍 Sublingual 

😴 Observe you LLM outputs and do evals without changing your code 😴

[![Join Our Discord](https://img.shields.io/badge/Discord-7289DA?logo=discord&logoColor=white)](https://discord.gg/7A4Kzhth6b)

Ask us any questions, suggest features, or see what everyone is building on our Discord!

## Get started instantly
1. Install:
    ```bash
    pip install subl
    ``` 

2. Throw `subl` in front of your original command
    ```bash
    subl python your_script.py      # Replace 'python your_script.py' with your actual entry point
    ```

3. Pull up the dashboard:
    ```bash
    subl server
    ```

## 🤔 What is Sublingual? 
Sublingual helps you log and analyze all of your LLM calls, including the prompt template, call parameters, responses, tool calls, and more.
The coolest thing? You don't have to change any of your code!

📍 All your data stays local

✂️ Disentangled logic: The reliability of your LLM calls are not dependent on the logging server

🔗 Easy integration: No code changes necessary

![image](https://github.com/user-attachments/assets/97e9bec5-0330-4a44-b97d-50739eb9de81)


## 🪄 How does it work?
We automatically patch the OpenAI/Anthropic client to log all LLM calls and responses, then analyze the runtime code to extract the prompt template that you used as well. All of this so you don't have to change any of your code. When you don't want to log, you can just run your script as usual without `subl`, and the patch will not be applied or affect your code at all.

Adding `subl` before a command will trigger all python subprocesses spawned by this command to, on initialization, patch the LLM client classes to log calls and scan the runtime stack frames for info. By doing so, it can automatically (try to) find prompt templates and track server sessions.
    

## Supported LLM Providers and Frameworks

 ✅ OpenAI Client (Async + Sync)
 
 ✅ Anthropic Client (Async + Sync)
 
 ⏳ LangChain calls to ChatOpenAI or ChatAnthropic are logged, but we're working on full LangChain support to trace the entire workflow!

 ⚠️ Other LLM clients will not be logged, but hot-swapped urls are supported. e.g. Gemini
 ```python
client = OpenAI(
    api_key="GEMINI_API_KEY",
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
 ```

 ⚠️ Streaming responses are not currently supported for logging

## Running Evals
⚖️ We currently offer LLM as judge evals using OpenAI models. We have prebuilt Correctness, System Prompt Obedeience, and User response sentiment metrics that you can use, but we also offer a way for you to define your own judging criteria inside the dashboard.

❗ You must provide your own api key if you want to use this feature, and can do so by setting the OPENAI_API_KEY environment variable, or just placing it in a .env in the same directory that you run `subl server` in.


## Server support
If you are running a server that makes LLM calls, we support Flask, FastAPI, Django, and more.
Just throw subl before it like
```bash
subl flask run ...
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.
