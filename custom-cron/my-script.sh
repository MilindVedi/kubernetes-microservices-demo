#!/bin/sh
echo "================================================="
echo "🐳 Starting Custom Docker Image CronJob Execution"
echo "================================================="
echo "Current Time: $(date)"
echo "Executing baked-in script from /app/my-script.sh"
echo "Simulating some work..."

for i in 1 2 3 4 5; do
  echo "Processing item $i of 5"
  sleep 1
done

echo "✅ Custom Job completed successfully!"
echo "================================================="
