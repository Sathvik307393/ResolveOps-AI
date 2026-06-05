#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "Installing Docker..."
if ! command -v docker &> /dev/null
then
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
else
    echo "Docker is already installed."
fi

echo "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null
then
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose is already installed."
fi

echo "Installing Certbot (for Let's Encrypt SSL)..."
sudo apt-get install -y certbot

DOMAIN="nexusai.sathvikdevops.online"
EMAIL="admin@sathvikdevops.online" # Replace with actual email

echo "Checking SSL certificate for $DOMAIN..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "Requesting new SSL certificate for $DOMAIN..."
    # Make sure port 80 is open and no web server is currently using it
    sudo certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos -m $EMAIL
else
    echo "SSL certificate for $DOMAIN already exists."
fi

echo "Starting Docker Compose services..."
# Make sure AWS credentials are exported before running this script
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "WARNING: AWS credentials are not fully set. The AWS Bedrock integration may fail."
fi

# We build and start the containers in detached mode
sudo docker-compose up --build -d

echo "Deployment complete! Your bot should be live at https://$DOMAIN"
