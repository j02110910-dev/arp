# ARP - Agent Reliability Platform

Kubernetes deployment manifests for the ARP platform.

## Prerequisites

- Kubernetes 1.21+
- kubectl configured with cluster access
- (Optional) PersistentVolume provisioner for data persistence

## Quick Start

Deploy the entire stack with a single command:

```bash
kubectl apply -f k8s/
```

This creates all resources in the `arp-system` namespace:
- Namespace
- ConfigMap (non-sensitive configuration)
- Secret (sensitive credentials - **update with real values**)
- Deployment (3 replicas)
- Service (ClusterIP)
- Ingress (arp.internal)
- HorizontalPodAutoscaler (2-10 replicas)
- PodDisruptionBudget (min 2 available)

## Required: Configure Secrets

**IMPORTANT**: Before deploying, update the secrets with real values:

```bash
# Edit the secrets file
vim k8s/secrets.yaml

# Or create secrets manually
kubectl create secret generic arp-secrets \
  -n arp-system \
  --from-literal=WECHAT_KEY='your-server酱-key' \
  --from-literal=TELEGRAM_BOT_TOKEN='your-telegram-bot-token' \
  --from-literal=TELEGRAM_CHAT_ID='your-chat-id' \
  --from-literal=EMAIL_HOST='smtp.example.com' \
  --from-literal=EMAIL_PORT='587' \
  --from-literal=EMAIL_USER='alerts@example.com' \
  --from-literal=EMAIL_PASS='your-email-password' \
  --from-literal=EMAIL_TO='oncall@example.com' \
  --from-literal=FEISHU_WEBHOOK='https://open.feishu.cn/open-apis/bot/v2/hook/xxx' \
  --from-literal=SLACK_WEBHOOK='https://hooks.slack.com/services/xxx'
```

## Optional: TLS Certificate

For TLS termination, create a TLS secret:

```bash
kubectl create secret tls arp-tls-cert \
  -n arp-system \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem
```

Or use cert-manager for automatic certificate management.

## Optional: PVC for Data Persistence

If using a dynamic provisioner:

```bash
kubectl apply -f k8s/pvc.yaml
```

## Verify Deployment

```bash
# Check pods are running
kubectl get pods -n arp-system

# Check services
kubectl get svc -n arp-system

# View logs
kubectl logs -n arp-system -l app.kubernetes.io/name=arp -f

# Check HPA status
kubectl get hpa -n arp-system
```

## Access the Dashboard

Add `arp.internal` to your `/etc/hosts` pointing to your ingress controller IP:

```
echo "INGRESS_IP arp.internal" >> /etc/hosts
```

Then access: `https://arp.internal`

## Configuration

### Environment Variables (ConfigMap)

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | production | Environment |
| DASHBOARD_PORT | 3000 | Dashboard HTTP port |
| LOG_LEVEL | info | Logging level |
| WATCH_ENABLED | true | Enable SilentWatch monitoring |
| WATCH_MAX_CONSECUTIVE_CALLS | 10 | Max consecutive tool calls |
| WATCH_MAX_CONSECUTIVE_EMPTY | 3 | Max empty responses |
| WATCH_STEP_TIMEOUT_MS | 60000 | Step timeout in ms |
| MEMORY_ENABLED | true | Enable Cognitive Governor |
| MEMORY_TOKEN_LIMIT | 8000 | Context token limit |
| MEMORY_COMPRESSION_THRESHOLD | 0.7 | Compression threshold |
| COMPRESSION_STRATEGY | smart | smart/summarize/truncate |
| GUARD_ENABLED | true | Enable Permission Sentinel |
| DATA_PATH | /data/arp | Knowledge base path |
| ALERT_HISTORY_PATH | /data/alert-history | Alert log path |

### Secrets

| Key | Description |
|-----|-------------|
| WECHAT_KEY | Server酱 key for WeChat notifications |
| TELEGRAM_BOT_TOKEN | Telegram bot authentication token |
| TELEGRAM_CHAT_ID | Telegram chat ID for alerts |
| EMAIL_HOST | SMTP server hostname |
| EMAIL_PORT | SMTP server port |
| EMAIL_USER | SMTP username |
| EMAIL_PASS | SMTP password |
| EMAIL_TO | Alert recipient email |
| FEISHU_WEBHOOK | Feishu webhook URL |
| SLACK_WEBHOOK | Slack webhook URL |
| VISION_API_KEY | API key for screenshot verification |

## Scaling

```bash
# Manual scale
kubectl scale deployment arp-dashboard -n arp-system --replicas=5

# HPA is configured for auto-scaling (2-10 replicas, 70% CPU target)
```

## Cleanup

```bash
kubectl delete -f k8s/
```
