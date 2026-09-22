# 🐳 Sentinel Finance — Docker & Docker Hub Deployment Guide

This guide covers everything needed to build, run locally with `docker compose`, push to Docker Hub, and allow anyone to pull and run Sentinel Finance with zero setup.

---

## ⚡ Quick Reference

| Goal | Command |
| :--- | :--- |
| **Run Locally (Compose)** | `docker compose up -d --build` |
| **Stop Local Container** | `docker compose down` |
| **Push to Docker Hub** | `docker build -t <dockerhub-username>/sentinel-finance:latest .` <br> `docker push <dockerhub-username>/sentinel-finance:latest` |
| **Run from Docker Hub** | `docker run -d -p 3000:3000 --name sentinel-finance <dockerhub-username>/sentinel-finance:latest` |

---

## 🏗️ 1. Run Locally with Docker Compose

Ensure **Docker Desktop** is running on your machine.

### Step 1: Start the container
In the project root directory, run:
```bash
docker compose up -d --build
```

### Step 2: Open in your browser
Navigate to:
```
http://localhost:3000
```
The entire application (Portfolio, Robo-01 Agent, Guarantees, Activity PROVN receipts) will be live.

### Step 3: Check container logs
```bash
docker compose logs -f sentinel-finance
```

### Step 4: Stop the container
```bash
docker compose down
```

---

## ☁️ 2. Build & Push to Docker Hub

You can push this image to Docker Hub so evaluators, judges, or teammates can run it without cloning the repository or installing Node / pnpm.

### Step 1: Log in to Docker Hub
```bash
docker login
```
*(Enter your Docker Hub username and password/token when prompted.)*

### Step 2: Build and Tag the Image
Replace `<your-username>` with your actual Docker Hub username:

```bash
docker build -t <your-username>/sentinel-finance:latest .
```

*(Optional: Tag with version)*
```bash
docker build -t <your-username>/sentinel-finance:v1.0.0 -t <your-username>/sentinel-finance:latest .
```

### Step 3: Push to Docker Hub
```bash
docker push <your-username>/sentinel-finance:latest
```

*(If tagged with version, also push the version tag:)*
```bash
docker push <your-username>/sentinel-finance:v1.0.0
```

---

## 🌍 3. How Anyone Can Pull & Run from Docker Hub

Anyone in the world with Docker installed can now run Sentinel Finance with **a single command** without cloning any code:

```bash
docker run -d -p 3000:3000 --name sentinel-finance <your-username>/sentinel-finance:latest
```

Then open:
```
http://localhost:3000
```

To stop and remove:
```bash
docker stop sentinel-finance && docker rm sentinel-finance
```

---

## 🚀 4. Pro-Tip: Multi-Platform Builds (AMD64 & ARM64)

If evaluators run on Apple Silicon (M1/M2/M3/M4) as well as standard x86 Intel/AMD machines, you can build a multi-architecture image using Docker Buildx:

```bash
# 1. Create and switch to buildx builder
docker buildx create --name sentinel-builder --use

# 2. Build and push both linux/amd64 and linux/arm64 in one command
docker buildx build --platform linux/amd64,linux/arm64 \
  -t <your-username>/sentinel-finance:latest \
  --push .
```

This guarantees seamless execution across Windows, Linux, and macOS without emulation overhead.
