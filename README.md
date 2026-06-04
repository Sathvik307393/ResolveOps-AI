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
You will need your standard OpenAI key and your AWS credentials to connect the bot to your cloud infrastructure. Create an `.env` file in the root directory containing:

```env
OPENAI_API_KEY=your_openai_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
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
