# 🐍 🔍 Sublingual 

😴 Zero code LLM observability and evals 😴

## Get started instantly
1. Install:
    ```bash
    pip install subl
    ``` 

2. Run your script as usual with `subl` instead of `python`
    ```bash
    subl <your_script.py>
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

## 🪄 How does it work?
We automatically patch the OpenAI client to log all LLM calls and responses, then analyze the runtime code to extract the prompt template that you used as well. All of this so you don't have to change any of your code. When you don't want to log, you can just run your script as usual without `subl`, and the patch will not be applied or affect your code at all.
    

## Supported LLM Providers

 🤖 OpenAI Client (Async + Sync)

 ⚠️ Other LLM clients will not be logged, but hot-swapped urls are supported. e.g. Gemini
 ```python
client = OpenAI(
    api_key="GEMINI_API_KEY",
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
 ```

 ⚠️ Streaming responses are not currently supported for logging


## Server support
If you are running a server that makes LLM calls, we support Flask, FastAPI, Django, and more.
Run
```bash
subl -m flask run ...
```
instead of
```bash
flask run ...
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.
