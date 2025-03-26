#!/bin/bash
# Script to run the AITable MCP server with debug logging enabled

# Ensure the script exits on error
set -e

# Create logs directory if it doesn't exist
mkdir -p logs

# Set timestamp for log file
TIMESTAMP=$(date +"%Y-%m-%dT%H-%M-%S")
LOG_FILE="logs/aitable-mcp-server-$TIMESTAMP.log"

echo "Starting AITable MCP server with debugging enabled..."
echo "Logs will be saved to: $LOG_FILE"

# Set debug environment variables
export LOG_LEVEL=debug
export DEBUG=true

# Build the server
echo "Building server..."
npm run build

# Run the server and capture logs
echo "Running server..."
node ./dist/index.js | tee "$LOG_FILE" 