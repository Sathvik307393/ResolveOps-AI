<div align="center">

# 🛡️ Nexus AI

### Autonomous SRE & Incident Intelligence Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-nexusai.sathvikdevops.online-6366f1?style=for-the-badge&logo=vercel)](https://nexusai.sathvikdevops.online)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![AWS DynamoDB](https://img.shields.io/badge/AWS%20DynamoDB-4053D6?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com/dynamodb)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)

*An AI-Powered platform that predicts failures, automates incident management, reduces operational toil, and delivers intelligent notifications to keep your infrastructure reliable.*

</div>

---

## 🛑 Problem Statement

Modern IT and DevOps environments are heavily plagued by **alert fatigue**, fragmented monitoring tools, and reactive incident management. When a service experiences downtime or degraded performance, on-call engineers spend critical minutes—or even hours—sifting through logs across multiple disparate platforms, manually diagnosing root causes, and executing repetitive remediation steps. 

This manual, disjointed workflow leads to:
- **High Mean Time To Resolution (MTTR)**
- **Increased operational toil and engineer burnout**
- **Reduced overall system reliability and disrupted end-user experiences**

**Nexus AI** solves this by acting as an autonomous on-call engineer. It continuously ingests telemetry, proactively detects anomalies, automatically generates Root Cause Analysis (RCA) reports using a RAG-powered LLM engine, and centralizes insights into a single, unified dashboard.

---

## ✨ What is Nexus AI?

Nexus AI is a multi-tenant **AI-powered Site Reliability Engineering (SRE) platform** deployed as a production-grade web application. It automates monitoring and incident resolution, dispatching targeted notifications and providing actionable DevOps insights from a stunning, glassmorphic Next.js dashboard.

---

## ⚙️ Tech Stack

Nexus AI leverages a modern, distributed technology stack designed for high availability and low latency:

### Backend & Microservices
- **Python 3.11 & FastAPI**: High-performance asynchronous framework for building microservices.
- **Microservices Architecture**: decoupled services (`auth-service`, `api-gateway-service`, `ai-rca-service`, etc.) for scalable operations.

### AI & Intelligence Engine
- **Amazon Bedrock (Claude 3 Haiku)**: The core LLM for analyzing logs and answering infrastructure queries.
- **LangChain & FAISS**: For Retrieval-Augmented Generation (RAG) and intelligent vector search on logs.

### Frontend
- **Next.js 15 (React) & TypeScript**: Server-side rendered and highly responsive web application.
- **Tailwind CSS v4 & shadcn/ui**: For a premium, glassmorphic, and dynamic user interface.

### Database & Persistence
- **AWS DynamoDB**: Highly scalable NoSQL database with strict multi-tenant data isolation (`nexus_users`, `nexus_api_keys`, `nexus_logs`, `nexus_incidents`).

### Infrastructure & Deployment
- **AWS EC2 (Ubuntu)**: Cloud compute instances.
- **Docker & Docker Compose**: Containerization and orchestration of the microservices.
- **NGINX & Let's Encrypt**: Reverse proxy and SSL termination.

---

## 📡 Connections & Inter-Service Communication

Nexus AI is built on a distributed microservices architecture consisting of several dedicated services (e.g., `api-gateway-service`, `ai-rca-service`, `aws-intelligence-service`, `azure-intelligence-service`, `github-intelligence-service`, and `notification-service`). 

Here is how these services connect and establish communication:

### 1. API Gateway as the Central Hub
The **`api-gateway-service`** acts as the central entry point for all incoming requests (both from the Next.js frontend and external telemetry webhooks). It handles authentication, rate limiting, and request validation before routing traffic to the appropriate downstream microservice.

### 2. Internal Microservice Communication (REST/HTTP)
Services communicate internally over standard HTTP/REST protocols (using clients like `httpx` and `requests`). For example, when a new log requires AI analysis, the API Gateway synchronously calls the `ai-rca-service` to generate an insight, maintaining a decoupled but highly coordinated flow.

### 3. External Cloud Integrations
- **AWS & Azure Intelligence**: The `aws-intelligence-service` and `azure-intelligence-service` establish secure, authenticated connections to external cloud providers using their respective native SDKs (`boto3` for AWS, `azure-mgmt-*` for Azure). They fetch resource topologies, pull metrics, and analyze cost data securely.
- **GitHub Intelligence**: The `github-intelligence-service` connects to GitHub via its REST API and Webhooks to correlate system incidents with recent code commits or automated deployments.

### 4. Shared Data Layer
Instead of complex point-to-point data passing, services independently interface with the **AWS DynamoDB** data layer, ensuring high consistency and decoupling state management from compute.

### 5. Notification Dispatching
When an incident is created or an RCA is resolved, the **`notification-service`** establishes an outbound connection to email providers like **AWS SES / SMTP** or **SendGrid** to dispatch immediate, formatted alerts to the relevant tenant engineers.

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| **🧠 AI Copilot** | LLM-powered chatbot that answers infrastructure questions, generates Kubernetes YAML, and analyzes your live logs using Retrieval-Augmented Generation (RAG). |
| **📊 Live Dashboard** | Real-time System Reliability Score computed from actual ingested log ratios. Dynamic sparkline charts update as new telemetry arrives. |
| **🚨 Incident Command Center** | Automatic incident creation when `ERROR` / `CRITICAL` logs are ingested. Displays RCA reports generated by the AI engine. |
| **🔍 Service Log Explorer** | Aggregates all services sending telemetry into a unified log terminal view, grouped by service name and severity. |
| **💡 DevOps Suggestion Hub** | Pre-mapped resolutions for common errors across the Development, Deployment, and Runtime stages of the software lifecycle. |

---

## 🌐 Live Deployment

The application is live at **[https://nexusai.sathvikdevops.online](https://nexusai.sathvikdevops.online)**

---

## 📡 Sending Telemetry to Nexus AI

Once your account is created, use your API key to send logs from any service:

```bash
curl -X POST https://nexusai.sathvikdevops.online/api/v1/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "service": "payment-api",
    "level": "ERROR",
    "message": "Connection pool exhausted after 30s timeout",
    "latency_ms": 30045,
    "status_code": 503,
    "request_id": "req_abc123xyz"
  }'
```

When an `ERROR` or `CRITICAL` log is ingested, Nexus AI will:
1. Automatically create an incident in your dashboard
2. Trigger the AI RCA engine to analyze recent logs
3. Send you an email notification with the full incident report

---

<div align="center">

Built with ❤️ by [@Sath2003](https://github.com/Sath2003)

</div>
