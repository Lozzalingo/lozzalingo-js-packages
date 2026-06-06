FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install server deps
COPY package.json package-lock.json* ./
RUN npm install --production

# Install and build client
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Copy server code
COPY server/ ./server/
COPY data/ ./data/

EXPOSE 1935 3000

CMD ["node", "server/index.js"]
