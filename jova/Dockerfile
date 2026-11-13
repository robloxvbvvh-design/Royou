FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-numpy && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["./start.sh"]
