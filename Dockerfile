FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV FFMPEG_PATH=/usr/bin/ffmpeg
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts && npx prisma generate
COPY . .
RUN npm run build
CMD ["sh", "scripts/start.sh"]
