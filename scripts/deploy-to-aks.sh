#!/bin/bash
set -e

# Deploy to AKS manually

echo "Deploying to AKS namespace: resolveops-ai-dev"

# 1. Apply namespace
echo "Applying namespace..."
kubectl apply -f deploy/k8s/base/namespace.yaml

# 2. Apply configmap
echo "Applying configmap..."
kubectl apply -f deploy/k8s/base/configmap.yaml

# 3. Apply service account
echo "Applying service account..."
kubectl apply -f deploy/k8s/base/serviceaccount.yaml

# Check if user has created secrets
if kubectl get secret resolveops-secrets -n resolveops-ai-dev > /dev/null 2>&1; then
  echo "Secret 'resolveops-secrets' found."
else
  echo "Warning: Secret 'resolveops-secrets' not found. Deployments using it might fail or not have required keys."
  echo "You can create it later using: kubectl create secret generic resolveops-secrets --from-literal=KEY=value -n resolveops-ai-dev"
fi

# 4. Apply service manifests
echo "Applying application manifests..."
kubectl apply -f deploy/k8s/base/frontend.yaml
kubectl apply -f deploy/k8s/base/api-gateway-service.yaml
kubectl apply -f deploy/k8s/base/github-intelligence-service.yaml
kubectl apply -f deploy/k8s/base/azure-intelligence-service.yaml
kubectl apply -f deploy/k8s/base/aws-intelligence-service.yaml
kubectl apply -f deploy/k8s/base/notification-service.yaml

echo "========================================="
echo "Deployment applied successfully."
echo "========================================="
echo ""
echo "Verify your deployment with the following commands:"
echo "  kubectl get pods -n resolveops-ai-dev"
echo "  kubectl get svc -n resolveops-ai-dev"
