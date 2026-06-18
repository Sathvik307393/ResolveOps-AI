# Manual AKS Deployment Guide

This guide details the process for manually building, pushing, and deploying the ResolveOps AI application to Azure Kubernetes Service (AKS) for testing purposes.

## Flow Overview

1. Create Resource Group
2. Create ACR
3. Create AKS
4. Attach ACR to AKS
5. Login to Azure
6. Get AKS credentials
7. Build and push images to ACR
8. Replace ACR placeholders if needed
9. Apply Kubernetes YAML
10. Check pods, services, logs

## Prerequisites

- Azure CLI installed (`az`)
- Docker installed (`docker`)
- Kubernetes CLI installed (`kubectl`)
- Git installed (`git`)

## 1-4. Azure Resource Setup (If not already created)

Set your variables (replace the placeholders):

```bash
export RESOURCE_GROUP="<RESOURCE_GROUP>"
export ACR_NAME="<ACR_NAME>"
export AKS_NAME="<AKS_NAME>"
export LOCATION="eastus" # or your preferred region
```

Create the resources:

```bash
# Create Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create ACR (Basic tier is sufficient for dev)
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic

# Create AKS
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_NAME \
  --node-count 2 \
  --generate-ssh-keys

# Attach ACR to AKS
az aks update \
  --name $AKS_NAME \
  --resource-group $RESOURCE_GROUP \
  --attach-acr $ACR_NAME
```

## 5-6. Authenticate

Login to Azure and get credentials for both ACR and AKS.

```bash
# Login to Azure
az login

# Login to ACR via Docker
az acr login --name <ACR_NAME>

# Get AKS credentials for kubectl
az aks get-credentials \
  --name <AKS_NAME> \
  --resource-group <RESOURCE_GROUP>
```

## 7. Build and Push Images

Set the environment variables for the build script, then run it from the root of the repository.

```bash
export ACR_NAME="<ACR_NAME>"
export ACR_LOGIN_SERVER="<ACR_LOGIN_SERVER>" # Usually <ACR_NAME>.azurecr.io

chmod +x scripts/build-and-push-acr.sh
./scripts/build-and-push-acr.sh
```

## 8. Replace Placeholders in YAML

The Kubernetes YAML files in `deploy/k8s/base` contain placeholders for `<ACR_LOGIN_SERVER>`.
You must replace these placeholders with your actual ACR login server name before deploying.

For example, you can use `sed` (Linux/macOS):

```bash
# Replace <ACR_LOGIN_SERVER> with your actual server
sed -i 's/<ACR_LOGIN_SERVER>/myacr.azurecr.io/g' deploy/k8s/base/*.yaml
```

## 9. Apply Kubernetes YAML

Before deploying, if your application requires secrets (e.g., API keys), create them in the namespace:

```bash
# Create the namespace first
kubectl apply -f deploy/k8s/base/namespace.yaml

# Create the secrets
kubectl create secret generic resolveops-secrets \
  --from-literal=OPENAI_API_KEY=your-key \
  --from-literal=AWS_ACCESS_KEY_ID=your-aws-key \
  -n resolveops-ai-dev
```

Run the deployment script:

```bash
chmod +x scripts/deploy-to-aks.sh
./scripts/deploy-to-aks.sh
```

Alternatively, you can apply them manually:

```bash
kubectl apply -f deploy/k8s/base/
```

## 10. Check Verification

Verify that your pods are running and check your services.

```bash
# Check Pods
kubectl get pods -n resolveops-ai-dev

# Check Services
kubectl get svc -n resolveops-ai-dev

# Check Logs for a specific deployment
kubectl logs -n resolveops-ai-dev deploy/frontend
kubectl logs -n resolveops-ai-dev deploy/api-gateway-service
```

Access the `frontend` or `api-gateway-service` by looking at the `EXTERNAL-IP` listed in the `kubectl get svc -n resolveops-ai-dev` output.
