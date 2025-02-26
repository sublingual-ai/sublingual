import streamlit as st
from datetime import datetime
import openai
import os
from dotenv import load_dotenv

load_dotenv()


# Page configuration
st.set_page_config(
    page_title="Sublingual Demo",
    page_icon="🐍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for styling
st.markdown(
    """
    <style>
    .chat-container {
        padding: 1rem;
        border-radius: 10px;
        margin-bottom: 1rem;
    }
    .user-message {
        background-color: #f0f2f6;
        text-align: right;
        padding: 1rem;
        border-radius: 15px;
        margin: 1rem 0;
    }
    .message-content {
        white-space: pre-wrap;
        word-wrap: break-word;
    }
    .assistant-message {
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        padding: 1rem;
        border-radius: 15px;
        margin: 1rem 0;
    }
    .timestamp {
        font-size: 0.8rem;
        color: #888888;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Initialize OpenAI client
if "client" not in st.session_state:
    st.session_state.client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize session state for chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Main chat interface
st.title("🐍🔍 Sublingual Demo -- GPT-4o is getting dumber...")
st.markdown("---")

# Clear chat button - moved from sidebar to main interface
col1, col2, col3 = st.columns([1, 3, 1])
with col1:
    if st.button("Clear Chat"):
        st.session_state.messages = []
        st.rerun()

# Display chat messages
for message in st.session_state.messages:
    if message["role"] == "user":
        st.markdown(
            f"""
        <div class="user-message">
            <div class="message-content">{message["content"].replace(chr(10), "<br>")}</div>
            <div class="timestamp">{message["timestamp"]}</div>
        </div>
        """,
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            f"""
        <div class="assistant-message">
            <div class="message-content">{message["content"].replace(chr(10), "<br>")}</div>
            <div class="timestamp">{message["timestamp"]}</div>
        </div>
        """,
            unsafe_allow_html=True,
        )

# Chat input
user_input = st.chat_input("Type your message here...")


# Replace simple response generation with actual OpenAI call
def generate_response(user_input):
    try:
        # Convert session messages to OpenAI format
        messages = []

        user_prompt = f"""Answer concisely and to the point.\n{user_input}"""
        # Add only the current user message
        messages.append({"role": "user", "content": user_prompt})

        # Get response from OpenAI
        response = st.session_state.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=1.0,
            max_tokens=500,
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"I apologize, but I encountered an error: {str(e)}"


# Handle user input
if user_input:
    # Add user message to chat history
    st.session_state.messages.append(
        {
            "role": "user",
            "content": user_input,
            "timestamp": datetime.now().strftime("%H:%M"),
        }
    )

    # Generate and add assistant response
    response = generate_response(user_input)
    st.session_state.messages.append(
        {
            "role": "assistant",
            "content": response,
            "timestamp": datetime.now().strftime("%H:%M"),
        }
    )

    # Rerun to update the chat display
    st.rerun()
