# Use the official lightweight Node.js image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
# (Even though we have no dependencies right now, this is good practice)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the actual script
COPY index.js ./

# Run the node script
CMD ["npm", "start"]
