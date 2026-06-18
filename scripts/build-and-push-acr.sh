#!/bin/bash
set -e

# Required variables:
# ACR_NAME
# ACR_LOGIN_SERVER (Usually <ACR_NAME>.azurecr.io)

if [ -z "$ACR_NAME" ] || [ -z "$ACR_LOGIN_SERVER" ]; then
  echo "Error: ACR_NAME and ACR_LOGIN_SERVER environment variables must be set."
  echo "Example: export ACR_NAME=reolveopsai && export ACR_LOGIN_SERVER=reolveopsai.azurecr.io"
  exit 1
fi

GIT_SHA=$(git rev-parse --short HEAD)
echo "Building for Git SHA: $GIT_SHA"

echo "Logging into Azure Container Registry: $ACR_NAME"
az acr login --name "$ACR_NAME"

SERVICES=(
  "frontend"
  "services/api-gateway-service"
  "services/github-intelligence-service"
  "services/azure-intelligence-service"
  "services/aws-intelligence-service"
  "services/notification-service"
)

for DIR in "${SERVICES[@]}"; do
  if [ -f "$DIR/Dockerfile" ]; then
    SERVICE_NAME=$(basename "$DIR")
    echo "========================================="
    echo "Building $SERVICE_NAME..."
    echo "========================================="
    
    # Build
    docker build -t "$ACR_LOGIN_SERVER/$SERVICE_NAME:dev" -t "$ACR_LOGIN_SERVER/$SERVICE_NAME:$GIT_SHA" "$DIR"
    
    # Push dev tag
    echo "Pushing $SERVICE_NAME:dev to ACR..."
    docker push "$ACR_LOGIN_SERVER/$SERVICE_NAME:dev"
    
    # Push SHA tag
    echo "Pushing $SERVICE_NAME:$GIT_SHA to ACR..."
    docker push "$ACR_LOGIN_SERVER/$SERVICE_NAME:$GIT_SHA"
  else
    echo "Skipping $DIR - no Dockerfile found."
  fi
done

echo "========================================="
echo "All images built and pushed successfully."
echo "========================================="
