import requests
import json

# Configuration for AnythingLLM local NPU integration
API_URL = "http://localhost:3001/api/v1"
API_KEY = "QP5TYFR-A0HM99J-H6FY9QX-14123GT"
WORKSPACE = "my-workspace"

def generate_mermaid(prompt):
    """Sends a request to local AnythingLLM to generate a Mermaid diagram."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Payload for AnythingLLM workspace chat
    payload = {
        "message": f"Generate a valid Mermaid.js diagram for: {prompt}. Return only the Mermaid code block starting with ```mermaid.",
        "mode": "chat"
    }
    
    try:
        response = requests.post(
            f"{API_URL}/workspace/{WORKSPACE}/chat",
            headers=headers,
            json=payload
        )
        if response.status_code == 200:
            return response.json().get("textResponse", "No response from LLM.")
        else:
            return f"Error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"Failed to connect to local NPU: {e}"

if __name__ == "__main__":
    test_prompt = "A simple cloud architecture with a load balancer, two web servers, and a database."
    print("Sending prompt to local NPU...")
    result = generate_mermaid(test_prompt)
    print("\n--- Result ---\n")
    print(result)
