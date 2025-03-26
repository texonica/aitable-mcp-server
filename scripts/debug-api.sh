#!/bin/bash
# Script to run direct API debug tests for AITable

# Ensure the script exits on error
set -e

# Create logs directory if it doesn't exist
mkdir -p logs

echo "Running AITable API debug tests..."

# Set debug environment variables
export LOG_LEVEL=debug
export DEBUG=true

# Run the debug test script
node test-debug.js

echo "Debug tests completed. See logs directory for details."
echo "To check for errors, look for 'ERROR' in the log file." 