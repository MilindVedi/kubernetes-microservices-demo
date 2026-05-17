# Use Node.js 18 as the base image (includes npm, node)
FROM node:18

# Set the working directory inside the container to /app
# All subsequent commands run from this directory
WORKDIR /app

# Copy package.json and package-lock.json first (for Docker layer caching)
# If these files haven't changed, Docker reuses the cached npm install layer
COPY package*.json ./

# Install Node.js dependencies (express, axios)
RUN npm install

# Copy the rest of the app source code (index.js, etc.)
COPY . .

# Documentation only — tells readers this app uses port 3001
# Does NOT actually open or configure the port
EXPOSE 3001

# Command to run when the container starts
# Runs "npm start" which executes "node index.js" (defined in package.json scripts)
CMD ["npm", "start"]