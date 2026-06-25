FROM busybox:1.36

# Create an app directory
WORKDIR /app

# Copy our script from the host machine into the container
COPY my-script.sh /app/my-script.sh

# Make the script executable
RUN chmod +x /app/my-script.sh

# Tell Docker to run this script automatically when the container starts
CMD ["/app/my-script.sh"]
