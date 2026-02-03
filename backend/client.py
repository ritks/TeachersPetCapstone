import requests


class MathTutor:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
    
    def ask(self, question):
        """Send a question and get an answer"""
        response = requests.post(
            f"{self.base_url}/ask",
            json={"question": question}
        )
        response.raise_for_status()
        return response.json()["answer"]


if __name__ == "__main__":
    tutor = MathTutor()
    question = input("Enter your math question: ")
    answer = tutor.ask(question)
    print(f"Answer: {answer}")
