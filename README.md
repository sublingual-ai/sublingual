# 🐍 🔍 Sublingual 

😴 Zero code LLM observability and evals 😴

## Get started instantly
1. Install:
    ```bash
    pip install subl
    ``` 

2. Run your script as usual with `subl` instead of `python`.
    ```bash
    subl <your_script.py>
    ```

3. Pull up the dashboard:
    ```bash
    subl server
    ```

## Current support
 🤖 OpenAI Client (Async + Sync)
 
 ⚠️ Other LLM clients will not be logged, but hot-swapped urls are supported. e.g. Gemini
 ```python
client = OpenAI(
    api_key="GEMINI_API_KEY",
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
 ```

 ⚠️ Streaming responses are not currently supported for logging


## How it works

- 🚀 Fast and lightweight
- 📊 Comprehensive metrics
- 🛠 Easy to extend

## License

MIT License - see the [LICENSE](LICENSE) file for details.
