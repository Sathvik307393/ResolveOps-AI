# 🛡️ Nexus AIOps Bot

Nexus AIOps is an intelligent, all-in-one DevSecOps platform designed to act as your autonomous Site Reliability Engineer (SRE). It integrates deeply with your cloud infrastructure to monitor logs, resolve incidents, track deployments, and analyze your cloud architecture in real-time.

## ✨ Features

- **☁️ Cloud Architect Analyzer**: Dynamically scans your Azure Resource Groups and provides architectural recommendations and cost/security optimizations using GPT-4o based on the Well-Architected Framework.
- **⚡ Live Incident Streaming**: Wires directly into Azure Table Storage and Event Hubs to stream live outages and provide instant root-cause analysis (RCA).
- **☸️ Kubernetes Cluster Watch**: Built-in monitoring for your distributed microservices and container orchestration.
- **🤖 Ask the Architect Chatbot**: An intelligent RAG (Retrieval-Augmented Generation) assistant that answers any DevSecOps, infrastructure, or troubleshooting questions with deep context on your environment.

## 🚀 Quickstart: AWS EC2 Deployment

Since the Nexus AIOps bot is fully containerized, you can deploy it quickly to any cloud provider. Here is how to easily run it on a Free-Tier AWS Ubuntu EC2 instance:

### 1. Prerequisites
You will need your Azure credentials to connect the bot to your cloud logs and the GPT-4o models. Create an `.env` file in the root directory containing:

```env
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
AZURE_SEARCH_SERVICE_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_ADMIN_KEY=your_search_key
AZURE_SEARCH_INDEX_NAME=devops-logs-index
AZURE_STORAGE_CONNECTION_STRING=your_table_storage_connection_string
GITHUB_TOKEN=your_github_pat
```

### 2. Run on AWS EC2
SSH into your AWS Ubuntu instance and run the following commands to install Docker and launch the bot:

```bash
# 1. Update and install Docker
sudo apt update
sudo apt install docker.io -y

# 2. Clone your repository
git clone https://github.com/Sath2003/NexusAI.git
cd NexusAI/nexus-aiops-bot

# 3. Create your .env file
nano .env # Paste the variables from the prerequisites step here!

# 4. Build and Run the Container
sudo docker build -t nexus-aiops-bot .
sudo docker run -d -p 80:8501 --env-file .env --name nexus-bot nexus-aiops-bot
```

### 3. DNS Configuration
Once running, map your custom domain (e.g., `nexusai.sathvikdevops.online`) by creating an **A Record** in your DNS settings that points to your EC2 instance's Public IPv4 address.

## 🛠️ Local Development

To run the Streamlit dashboard locally for development:

```bash
cd nexus-aiops-bot
pip install -r requirements.txt
streamlit run app/dashboard.py
```
