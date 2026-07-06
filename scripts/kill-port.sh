#!/bin/bash
# Kill process using a specific port
# Usage: ./scripts/kill-port.sh 3000

PORT=${1:-3000}

echo "🔍 Checking for processes on port $PORT..."

if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "Found process(es) using port $PORT:"
    lsof -i :$PORT
    echo ""
    echo "Killing process(es)..."
    lsof -ti:$PORT | xargs kill -9
    echo "✅ Port $PORT is now free"
else
    echo "✅ Port $PORT is already free"
fi


