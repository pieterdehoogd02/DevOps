# Use Node.js base image
FROM node:16

# Set working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

# Define the command to start the service
CMD ["node", "src/server.js"]

# Expose port 5000 to the outside world
EXPOSE 5001