FROM node:20

WORKDIR /app

COPY package.json ./
RUN npm install --production || true

COPY . .

EXPOSE 8080
CMD ["npm", "start"]