FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY curriculum ./curriculum
COPY scripts ./scripts
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
RUN cd frontend && npm run build
WORKDIR /srv/frontend
EXPOSE 4173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0"]
