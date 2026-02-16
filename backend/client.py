import requests


class MathTutor:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.session_id = None
    
    def ask(self, question):
        """Send a question and get an answer"""
        response = requests.post(
            f"{self.base_url}/ask",
            json={"question": question}
        )
        response.raise_for_status()
        return response.json()["answer"]
    
    def start_conversation(self):
        """Start a new conversation session"""
        self.session_id = None
        return self.session_id
    
    def chat(self, question):
        """Send a message in the current conversation"""
        response = requests.post(
            f"{self.base_url}/chat",
            json={"question": question, "session_id": self.session_id}
        )
        response.raise_for_status()
        data = response.json()
        self.session_id = data["session_id"]
        return data["answer"]
    
    def get_history(self):
        """Get the conversation history for the current session"""
        if not self.session_id:
            return []
        response = requests.get(
            f"{self.base_url}/session/{self.session_id}"
        )
        response.raise_for_status()
        return response.json()["history"]
    
    def clear_session(self):
        """Clear the current conversation session"""
        if self.session_id:
            requests.delete(
                f"{self.base_url}/session/{self.session_id}"
            )
            self.session_id = None


if __name__ == "__main__":
    tutor = MathTutor()
    
    # Example of continuous conversation
    tutor.start_conversation()
    
    while True:
        question = input("Enter your math question (or 'quit' to exit): ")
        if question.lower() == 'quit':
            break
        
        answer = tutor.chat(question)
        print(f"Tutor: {answer}\n")
