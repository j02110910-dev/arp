# ARP - Agent Reliability Platform Deployment Guide

## Table of Contents

- [Environment Requirements](#environment-requirements)
- [Deployment Methods](#deployment-methods)
- [Environment Variables](#environment-variables)
- [Health Checks and Monitoring](#health-checks-and-monitoring)
- [Log Management](#log-management)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)

---

## Environment Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18.0.0+ | LTS recommended |
| npm | 9.0.0+ | Comes with Node 18 |
| Docker | 20.10+ | For containerized deployment |
| Docker Compose | 2.0+ | For orchestration |

### System Resources

- **Minimum**: 1 CPU, 512MB RAM
- **Recommended**: 2 CPUs, 1GB RAM
- **Storage**: 500MB for application + logs

---

## Deployment Methods

### Method 1: Docker Compose (Recommended for Production)

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/arp.git
cd arp

# Copy environment configuration
cp .env.example .env

# Edit .env with production values (see Environment Variables section)
vim .env

# Start the container
docker-compose up -d

# Verify deployment
docker-compose ps
curl http://localhost:3000/health
```

#### Production Docker Compose File

```yaml
version: '3.8'

services:
  arp:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - arp-data:/app/data
      - arp-logs:/app/logs
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('./dist/src/index.js')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M

volumes:
  arp-data:
  arp-logs:
```

---

### Method 2: Manual Deployment

#### Step 1: Install Dependencies

```bash
# Install Node.js 18+
# For Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version  # Should show 9.x.x
```

#### Step 2: Clone and Build

```bash
git clone https://github.com/your-org/arp.git
cd arp

# Install dependencies
npm ci

# Build TypeScript
npm run build

# Run tests
npm test
```

#### Step 3: Configure Environment

```bash
cp .env.example .env
# Edit .env with production values
```

#### Step 4: Start the Application

```bash
# Start in production mode
NODE_ENV=production npm start

# Or use a process manager (recommended)
npm install -g pm2
pm2 start dist/src/index.js --name arp
pm2 save
pm2 startup
```

#### Step 5: Set Up Reverse Proxy (Optional)

```nginx
# /etc/nginx/sites-available/arp
server {
    listen 80;
    server_name arp.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### Method 3: Kubernetes Deployment

#### Prerequisites

- Kubernetes 1.25+
- kubectl configured
- PV provisioner (for persistent storage)

#### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: arp
  labels:
    app: arp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: arp
  template:
    metadata:
      labels:
        app: arp
    spec:
      containers:
      - name: arp
        image: arp:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: arp-env
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: arp-service
spec:
  selector:
    app: arp
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: arp-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  rules:
  - host: arp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: arp-service
            port:
              number: 80
```

#### Deploy Commands

```bash
# Create namespace
kubectl create namespace arp

# Create secret from .env file
kubectl create secret generic arp-env --from-env-file=.env -n arp

# Apply manifests
kubectl apply -f k8s-deployment.yaml -n arp

# Check status
kubectl get pods -n arp
kubectl get svc -n arp
```

---

## Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `3000` |
| `DASHBOARD_ALLOWED_ORIGIN` | CORS origin for dashboard API (restrict in production) | `https://arp.example.com` |

### Plugin Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `SILENT_WATCH_ENABLED` | Enable silent monitoring | `false` |
| `COGNITIVE_GOVERNOR_ENABLED` | Enable cognitive governor | `false` |
| `COGNITIVE_GOVERNOR_THRESHOLD` | Cognitive governor threshold | `0.8` |
| `COGNITIVE_GOVERNOR_STRATEGY` | Cognitive governor strategy | `reduce` |
| `PERMISSION_SENTINEL_ENABLED` | Enable permission sentinel | `false` |
| `OUTPUT_VERIFIER_ENABLED` | Enable output verification | `false` |

### Notification Channels (Choose at least one)

| Variable | Description |
|----------|-------------|
| `SERVER_CHAN_KEY` | ServerChan SendKey |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat ID |
| `SLACK_WEBHOOK` | Slack webhook URL |
| `FEISHU_WEBHOOK` | Feishu webhook URL |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `TO_EMAIL` | Destination email address |
| `FROM_EMAIL` | Sender email address |

### AI/ML Configuration

| Variable | Description |
|----------|-------------|
| `OUTPUT_VERIFIER_VISION_API_KEY` | Vision API key for screenshot verification |

### Creating .env for Production

```bash
# Core settings
NODE_ENV=production
PORT=3000

# Enable desired plugins
SILENT_WATCH_ENABLED=true
COGNITIVE_GOVERNOR_ENABLED=true
PERMISSION_SENTINEL_ENABLED=true
OUTPUT_VERIFIER_ENABLED=true

# Notification channels (example with Telegram)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyzYZ
TELEGRAM_CHAT_ID=123456789
```

---

## Health Checks and Monitoring

### Built-in Health Endpoint

```bash
# Check service health
curl http://localhost:3000/health

# Expected response:
# { "status": "healthy", "uptime": 3600, "plugins": {...} }
```

### Docker Health Check

The included `docker-compose.yml` has a health check configured:

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('./dist/src/index.js')"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Monitoring with Health Stats

```typescript
import { ARP } from 'arp';

const arp = new ARP();
const health = arp.watch.health();
console.log(health);
// { totalEvents: 100, totalAlerts: 5, lastCheck: Date, ... }
```

### External Monitoring (Prometheus compatible)

For Kubernetes, add these endpoints to your monitoring stack:

```
/health - Application health
/metrics - Prometheus metrics endpoint (if implemented)
/stats - Runtime statistics
```

---

## Log Management

### Log Location

When using Docker:

```bash
# View container logs
docker-compose logs -f arp

# Or specifically for the main service
docker logs -f arp_arp_1
```

### Pino Logger Configuration

ARP uses [pino](https://github.com/pinojs/pino) for structured logging.

#### Default Log Levels

| Environment | Level | Description |
|-------------|-------|-------------|
| `production` | `info` | Standard operational info |
| `development` | `debug` | Detailed debug output |
| `test` | `silent` | No logs |

#### Custom Log Configuration

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
});

export default logger;
```

#### Log Output Formats

**Production (JSON):**
```json
{"level":30,"time":1700000000000,"msg":"Agent executed successfully","agentId":"agent-1"}
```

**Development (Pretty):**
```
[12:00:00.000] INFO (1234): Agent executed successfully
    agentId: "agent-1"
```

### Log Retention

#### Docker

```yaml
# docker-compose.yml
services:
  arp:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### Systemd

```bash
# /etc/logrotate.d/arp
/path/to/arp/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 root root
}
```

---

## Backup and Recovery

### Backup Strategy

#### What to Backup

1. **Environment Configuration**
   ```bash
   cp .env .env.backup.$(date +%Y%m%d)
   ```

2. **Application Data**
   ```bash
   tar -czf arp-data-backup.tar.gz ./data/
   ```

3. **Database (if applicable)**
   ```bash
   # For any persistent storage
   pg_dump -U arp -d arp > arp-db-backup.sql
   ```

#### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/arp/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup environment
cp .env $BACKUP_DIR/.env.$DATE

# Backup data
tar -czf $BACKUP_DIR/data.$DATE.tar.gz ./data/

# Upload to remote storage (optional)
# aws s3 cp $BACKUP_DIR/data.$DATE.tar.gz s3://my-bucket/arp/

echo "Backup completed: $DATE"
```

#### Cron Schedule

```bash
# Add to crontab
0 2 * * * /path/to/backup.sh >> /var/log/arp-backup.log 2>&1
```

### Recovery Procedures

#### From Docker Volume Backup

```bash
# Stop the service
docker-compose down

# Restore data
tar -xzf arp-data-backup.tar.gz

# Restart
docker-compose up -d
```

#### From Environment Backup

```bash
# Stop service
docker-compose down

# Restore environment
cp .env.backup.20240101 .env

# Restart
docker-compose up -d
```

### Disaster Recovery Checklist

- [ ] Backup files stored in off-site location
- [ ] Backup restoration tested quarterly
- [ ] Environment variables documented
- [ ] SSL certificates backed up
- [ ] Notification channels verified
- [ ] Runbook documented for common failures

---

## Troubleshooting

### Common Issues

#### 1. Container Fails to Start

**Symptom:**
```
Error: Cannot find module './dist/src/index.js'
```

**Solution:**
```bash
# Rebuild the container
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Or ensure build happens inside container
docker-compose up --build
```

#### 2. Port Already in Use

**Symptom:**
```
Error: listen EADDRINUSE :::3000
```

**Solution:**
```bash
# Find what's using port 3000
lsof -i :3000
# or
netstat -tlnp | grep 3000

# Kill the process or change the port
PORT=3001 docker-compose up -d
```

#### 3. Out of Memory

**Symptom:**
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Solution:**
```yaml
# docker-compose.yml
services:
  arp:
    deploy:
      resources:
        limits:
          memory: 2G
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048
```

#### 4. Health Check Failing

**Symptom:**
```
docker-compose ps  # Shows unhealthy
```

**Solution:**
```bash
# Check container logs
docker-compose logs arp

# Test health endpoint manually
docker exec -it arp_arp_1 curl http://localhost:3000/health

# Adjust health check timing
```

#### 5. Notifications Not Working

**Symptom:**
Alerts not reaching notification channels.

**Solution:**
```bash
# Verify environment variables are set
docker exec arp_arp_1 env | grep -E "(TELEGRAM|WECHAT|SLACK)"

# Test notification manually
curl -X POST http://localhost:3000/api/test-notification

# Check notification plugin logs
docker-compose logs | grep notification
```

#### 6. High CPU Usage

**Solution:**
```bash
# Check for infinite loops or recursion
docker-compose logs --tail=100 | grep -i error

# Profile the application
docker exec -it arp_arp_1 node --prof dist/src/index.js

# Reduce log verbosity
docker-compose logs --tail=50
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Development mode with debug logs
NODE_ENV=development LOG_LEVEL=debug npm start

# Docker with debug
docker-compose run -e LOG_LEVEL=debug arp
```

### Getting Help

- GitHub Issues: https://github.com/your-org/arp/issues
- Documentation: https://docs.arp.example.com
- Email: support@arp.example.com
