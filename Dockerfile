FROM alpine:latest

WORKDIR /app

# Copy the test script into the container
COPY test-devtron-job.sh .

# Make it executable
RUN chmod +x test-devtron-job.sh

# Default command to run if none is provided
CMD ["./test-devtron-job.sh"]
