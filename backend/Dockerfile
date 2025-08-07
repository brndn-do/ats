# Start with base image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /backend

# Install bash
RUN apt-get update && apt-get install -y bash && rm -rf /var/lib/apt/lists/*

# Customize bash prompt
RUN echo "export PS1='/backend \$ '" >> ~/.bashrc

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Run app
CMD [ "npm", "run", "dev" ]
