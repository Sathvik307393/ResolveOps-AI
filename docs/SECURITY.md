# Security Architecture & Best Practices in ResolveOps AI

Security and data privacy are foundational pillars of ResolveOps AI. This document outlines the explicit measures implemented to protect your credentials, tokens, and telemetry data.

## 1. Credential Handling & Storage

We follow a strictly ephemeral approach to sensitive credentials wherever possible:

- **GitHub Personal Access Tokens (PATs):**
  - Your PAT is never permanently stored in plaintext on our servers.
  - Used securely to query the GitHub API over HTTPS.
  - Required permissions are strictly validated (e.g., repository read access, workflows scope) without over-requesting permissions.

- **AWS Credentials:**
  - We strongly recommend using **IAM Role ARNs** (Cross-Account AssumeRole) rather than Access Keys. This delegates trust safely.
  - If Access Keys are used, they are validated against `sts.get_caller_identity()`. We do not persist Secret Access Keys in our database; they are securely discarded post-validation or heavily encrypted based on deployment configuration.

- **Azure Credentials:**
  - Azure Service Principal secrets and AI Foundry Keys (`AZURE_AI_FOUNDRY_API_KEY`) are stored purely as backend environment variables.
  - The frontend never receives or handles raw API keys for AI models, preventing client-side leakage.

## 2. Telemetry & Log Redaction (AI RCA Privacy)

When a GitHub Action pipeline fails, ResolveOps AI analyzes the raw logs. Before these logs are rendered in the UI or sent to an AI Provider (Azure AI Foundry / Bedrock) for Root Cause Analysis (RCA), they pass through a strict **regex-based redaction engine**.

The following patterns are scrubbed and replaced with `[REDACTED_SECRET]`:
- **GitHub PATs:** Matches standard formats (`ghp_...`, `gho_...`).
- **AWS Access Keys:** Matches `AKIA...` identifiers.
- **AWS Secret Keys:** Matches 40-character base64 heuristics prefixed with `secret` or `key`.
- **Azure UUIDs:** Scrubs potential Tenant IDs, Client IDs, and Subscription IDs matching UUID regex.
- **JWT Tokens:** Redacts standard `ey...` encoded payloads.
- **Embedded Passwords:** Removes basic auth passwords inside HTTP, MongoDB, Postgres, or MySQL URLs.

## 3. Graceful AI Fallbacks (Zero-Trust Design)

To ensure operational reliability without compromising security, the system does not fail open if external AI providers are unavailable:

- **Azure AI Foundry First:** The system defaults to processing RCA data through secured Azure AI Foundry deployments.
- **Amazon Bedrock Fallback:** If configured, Amazon Bedrock acts as the secondary provider.
- **Local Rule-Based Fallback:** If AI credentials are not configured or the services are down, the backend uses a local, heuristic rule-based engine. This parses the logs locally (e.g., checking for specific Kubernetes or Azure login faults) to return an RCA. This ensures that sensitive workflow telemetry is never broadcasted to unauthorized external endpoints when misconfigured.

## 4. API Gateway Proxying
All client requests route through our API Gateway, meaning:
- Frontend applications interact only with normalized, sanitized endpoints.
- External service routing (to GitHub, AWS, or AI services) happens entirely behind the firewall within the microservices layer.
