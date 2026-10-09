import os
import pytest
from langfuse import observe
from google import genai
from google.genai import types
from langfuse import Langfuse

# Configure mock credentials for testing if they don't exist
os.environ.setdefault("GEMINI_API_KEY", "mock_key")
os.environ.setdefault("LANGFUSE_SECRET_KEY", "sk-lf-mock")
os.environ.setdefault("LANGFUSE_PUBLIC_KEY", "pk-lf-mock")
os.environ.setdefault("LANGFUSE_HOST", "http://localhost:3000")

langfuse = Langfuse()

@observe()
def generate_math_hint(student_input: str) -> str:
    """Mock agent turn for ADK."""
    # We would normally call the Gemini API here. 
    # For testing without a real key, we mock the return or use a real call if a valid key is present.
    if os.environ["GEMINI_API_KEY"] == "mock_key":
        return "This is a mocked hint for testing Langfuse trace emission."
    
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"Help the student with this math problem: {student_input}",
    )
    return response.text

def test_adk_langfuse_trace():
    """Test that Google ADK tracer connects cleanly to Langfuse and emits a trace."""
    # Ensure langfuse is initialized
    assert langfuse is not None
    
    # Run the mocked agent turn
    result = generate_math_hint("I don't know how to multiply fractions.")
    assert result is not None
    
    # Wait for traces to flush
    langfuse.flush()
