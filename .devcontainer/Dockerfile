# Next.js DevContainer Dockerfile
FROM mcr.microsoft.com/devcontainers/javascript-node:18

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /workspace

# Copy package.json and package-lock.json if they exist
COPY package.json package-lock.json ./

# Install Node.js dependencies if package.json exists
RUN if [ -f package.json ]; then npm install; fi

# Copy the rest of the application
COPY . .

# Expose port 3000
EXPOSE 3000

# Default command
CMD ["npm", "run", "dev"]