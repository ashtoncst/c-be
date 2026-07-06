# Use AWS ECR Public mirror of the official Node.js image to avoid
# Docker Hub unauthenticated pull rate limits inside CodeBuild. Pinned to
# Node 20 LTS (Debian-based) so the runtime matches what CI validates.
# https://gallery.ecr.aws/docker/library/node
FROM public.ecr.aws/docker/library/node:20

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy local code to the container image.
COPY . .

# Copy the .env file to the container image.
# COPY .env .env

# Build the TypeScript code.
RUN npm run build

# Run the web service on container startup.
CMD [ "npm", "run", "start" ]
