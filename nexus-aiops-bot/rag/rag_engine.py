import os
import json
from datetime import datetime, timedelta
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

# Configuration is retrieved dynamically during instantiation to avoid cached imports
class LogRageEngine:
    def __init__(self):
        # Retrieve OpenAI Credentials
        api_key = os.getenv("OPENAI_API_KEY")
        
        # Initialize Embeddings
        self.embeddings = OpenAIEmbeddings(
            api_key=api_key,
            model="text-embedding-3-large"
        )
        
        # Initialize Chat Model
        self.chat_model = ChatOpenAI(
            model=os.getenv("OPENAI_MODEL_NAME", "gpt-4o"),
            api_key=api_key,
            temperature=0.1
        )
        
        self.vector_store = None

    def run_query(self, query: str, time_window_mins: int = 30) -> dict:
        """Runs vector search on log indexes and performs root cause analysis with GPT-4o"""
        
        retrieved_logs = []
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        local_logs_path = os.path.join(current_dir, "local_logs.json")
        if not os.path.exists(local_logs_path):
            local_logs_path = "local_logs.json"
            
        if os.path.exists(local_logs_path):
            try:
                with open(local_logs_path, "r") as f:
                    local_logs = json.load(f)
                if local_logs:
                    # FAISS Vector Search Implementation
                    docs = [Document(page_content=json.dumps(log)) for log in local_logs]
                    if not self.vector_store:
                        self.vector_store = FAISS.from_documents(docs, self.embeddings)
                    
                    results = self.vector_store.similarity_search(query, k=15)
                    retrieved_logs = [json.loads(d.page_content) for d in results]
            except Exception as e:
                return {
                    "answer": f"Retrieval Error: FAISS search failed. Details: {str(e)}",
                    "citations": []
                }

        # Build context from logs
        if retrieved_logs:
            context_str = "\n".join([
                f"- [{log.get('timestamp', '')}] Service: {log.get('service', '')} | Level: {log.get('level', '')} | Message: {log.get('message', '')} "
                f"| Status: {log.get('status_code', '')} | Latency: {log.get('latency_ms', '')}ms | ReqID: {log.get('request_id', '')}"
                for log in retrieved_logs
            ])
        else:
            context_str = "No specific incident logs found for this query in the specified time window."

        # Define LangChain System Prompt
        system_prompt = (
            "You are an expert DevSecOps AI SRE Assistant and Automation Engineer. Your job is to:\n"
            "1. Analyze operational logs, traces, and system metrics to identify incident root causes.\n"
            "2. Answer any general questions related to DevOps, AI, development, deployment, and security.\n"
            "3. Act as a powerful automation tool: Write code, generate complete automation scripts, CI/CD pipelines, and infrastructure-as-code snippets when requested.\n"
            "4. Facilitate communication: If the user asks to 'send an email' or alert someone, provide the exact Python script (using smtplib or boto3 SES) or bash/curl command needed to automate that task immediately.\n\n"
            "Format the response using professional markdown with headers, bullet points, and extensive code blocks where appropriate. "
            "Do NOT use simple placeholders; provide fully functional and robust code solutions. Localize all money mentions in Indian Rupees (₹).\n\n"
            "Here is the context representing the retrieved logs from FAISS Vector Store (if any):\n"
            "---CONTEXT START---\n"
            "{context}\n"
            "---CONTEXT END---\n\n"
            "Analyze these logs (if present) and answer the user query: \"{query}\"\n\n"
            "If the user is asking about an incident, follow these strict troubleshooting guidelines:\n"
            "1. **Trace Correlation**: Look for matching `request_id` across different microservices. Correlate failures.\n"
            "2. **Outage Timeline**: Summarize the sequence of events.\n"
            "3. **Identified Cause**: State clearly which microservice is the root cause.\n"
            "4. **Recommendations & Automation**: Provide concrete operational steps AND the automated script/command to fix it immediately (e.g., a kubectl command to restart a pod).\n"
            "5. **Citations**: Mention the timestamps and services."
        )

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", system_prompt)
        ])

        chain = prompt_template | self.chat_model | StrOutputParser()
        
        try:
            answer = chain.invoke({
                "context": context_str,
                "query": query
            })
        except Exception as chat_ex:
            answer = f"Synthesis Error: Could not generate response via OpenAI. Details: {str(chat_ex)}"
            
        return {
            "answer": answer,
            "citations": retrieved_logs
        }
