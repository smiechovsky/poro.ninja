FROM node:18-alpine

# Install Docker CLI and coreutils (needed for 'du' command)
RUN apk add --no-cache docker-cli coreutils

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY index.js ./

EXPOSE 9106

CMD ["npm", "start"] 