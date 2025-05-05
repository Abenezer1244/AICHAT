#!/bin/bash
# deploy.sh - Deployment script for the chatbot application

set -e # Exit on error

# Print colored output
function print_message() {
  GREEN='\033[0;32m'
  NC='\033[0m' # No Color
  echo -e "${GREEN}$1${NC}"
}

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create one based on .env.example"
  exit 1
fi

# Load environment variables
print_message "Loading environment variables..."
source .env

# Create required directories
print_message "Creating required directories..."
mkdir -p nginx/conf.d nginx/ssl nginx/logs

# Check if Docker and Docker Compose are installed
if ! command -v docker >/dev/null 2>&1 || ! command -v docker-compose >/dev/null 2>&1; then
  echo "Error: Docker and Docker Compose are required. Please install them first."
  exit 1
fi

# Build and start the services
print_message "Building and starting services..."
docker-compose build --no-cache
docker-compose up -d

# Check service health
print_message "Checking service health..."
sleep 10

# MongoDB
if docker-compose exec mongodb mongo --eval "db.adminCommand('ping')" > /dev/null; then
  print_message "✓ MongoDB is running"
else
  echo "✗ MongoDB failed to start"
  exit 1
fi

# Redis
if docker-compose exec redis redis-cli ping > /dev/null; then
  print_message "✓ Redis is running"
else
  echo "✗ Redis failed to start"
  exit 1
fi

# Backend
if curl -s http://localhost/api/health | grep -q "ok"; then
  print_message "✓ Backend API is running"
else
  echo "✗ Backend API failed to start"
  exit 1
fi

# Frontend
if curl -s http://localhost/ > /dev/null; then
  print_message "✓ Frontend is running"
else
  echo "✗ Frontend failed to start"
  exit 1
fi

print_message "Deployment completed successfully!"
echo "The chatbot is now available at: http://localhost"
echo "For production use, configure SSL and update the Nginx configuration."

exit 0