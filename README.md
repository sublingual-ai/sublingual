# Sublingual LLM Observability and Evaluation

Log, observe, and evaluate outputs without changing any code.
Avoid the hassle of integrating the logging and changing your code.
Built by lazy developers, for lazy developers.

## Get started instantly
```bash
pip install subl
subl <your_script.py>
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