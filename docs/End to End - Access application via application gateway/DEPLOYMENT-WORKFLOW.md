# Deployment Workflow Guide

This document provides a step-by-step workflow for deploying and verifying the AppGW → Internal Ingress → Service setup.

---

## Phase 1: Kubernetes Deployment

### Step 1.1: Deploy Service A

```bash
# Apply Deployment, Service, and Ingress manifests
kubectl apply -f k8s/service-a-deployment.yaml
kubectl apply -f k8s/service-a-service.yaml
kubectl apply -f k8s/service-a-ingress.yaml

# Expected output:
# deployment.apps/service-a created
# service/service-a created
# ingress.networking.k8s.io/service-a-ingress created
```

### Step 1.2: Deploy Service B

```bash
kubectl apply -f k8s/service-b-deployment.yaml
kubectl apply -f k8s/service-b-service.yaml
kubectl apply -f k8s/service-b-ingress.yaml
```

### Step 1.3: Verify All Resources

```bash
# Check Deployments
kubectl get deployments
# Expected:
# NAME        READY   UP-TO-DATE   AVAILABLE   AGE
# service-a   2/2     2            2           1m
# service-b   2/2     2            2           1m

# Check Services
kubectl get services
# Expected:
# NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
# service-a    ClusterIP   10.0.1.100      <none>        80/TCP     1m
# service-b    ClusterIP   10.0.1.101      <none>        80/TCP     1m

# Check Ingress (wait for ADDRESS to populate)
kubectl get ingress
# Expected:
# NAME                  CLASS           HOSTS                     ADDRESS         PORTS
# service-a-ingress     nginx-internal  service-a.example.com     192.240.0.33    80, 443
# service-b-ingress     nginx-internal  service-b.example.com     192.240.0.33    80, 443

# Check Pods
kubectl get pods
# Expected:
# NAME                         READY   STATUS    RESTARTS   AGE
# service-a-xxxxxxxxxx-xxxxx   1/1     Running   0          1m
# service-a-xxxxxxxxxx-xxxxx   1/1     Running   0          1m
# service-b-xxxxxxxxxx-xxxxx   1/1     Running   0          1m
# service-b-xxxxxxxxxx-xxxxx   1/1     Running   0          1m
```

---

## Phase 2: Internal Testing

### Step 2.1: Port-Forward to Internal NGINX

```bash
# This allows local testing of the internal NGINX ingress
kubectl port-forward -n ingress-nginx \
  svc/nginx-internal-ingress-nginx-controller 8080:80

# In another terminal, test:
curl -H "Host: service-a.example.com" http://localhost:8080/
# Expected: Response from Service A
```

### Step 2.2: Test from Within Cluster

```bash
# Run a temporary pod and test connectivity
kubectl run -it --rm alpine --image=alpine --restart=Never -- sh

# Inside the pod:
apk add --no-cache curl
curl http://service-a.default.svc.cluster.local/
# Expected: Response from Service A

# Test service-to-service communication
curl http://service-b.default.svc.cluster.local/
# Expected: Response from Service B

exit
```

### Step 2.3: Check Pod Logs

```bash
# Check Service A logs
kubectl logs -l app=service-a --tail=50 -f
# Look for startup messages and request logs

# Check Service B logs
kubectl logs -l app=service-b --tail=50 -f

# Check NGINX Ingress Controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=50 -f
# Look for ingress creation messages
```

---

## Phase 3: Azure Application Gateway Configuration

### Step 3.1: Get Internal NGINX IP

```bash
# This is the IP that AppGW will use as backend
kubectl get svc -n ingress-nginx \
  nginx-internal-ingress-nginx-controller -o wide

# Look for EXTERNAL-IP column
# Example: 192.240.0.33
```

### Step 3.2: Azure Portal - Backend Pools

1. Navigate to **Application Gateway**
2. Click **Backend pools** (left sidebar)
3. Click **+ Add** to create a new pool
4. **Name:** `backend-services`
5. **Target type:** IP Addresses
6. **Targets:** Enter the internal NGINX IP (e.g., `192.240.0.33`)
7. Click **Add**

### Step 3.3: Azure Portal - HTTP Settings

1. Click **HTTP settings** (left sidebar)
2. Click **+ Add** to create new settings
3. **Name:** `http-backend-80`
4. **Backend port:** `80`
5. **Protocol:** HTTP
6. **Host name override:** `service-a.example.com`
7. **Health probe:** Choose or create one that points to `/`
8. Click **Add**

Repeat for `service-b.example.com` with settings name `http-backend-b-80`

### Step 3.4: Azure Portal - HTTPS Listeners

**For Service A:**

1. Click **Listeners** (left sidebar)
2. Click **+ Add** to create new listener
3. **Listener name:** `https-listener-service-a`
4. **Frontend IP:** Select your public IP
5. **Protocol:** HTTPS
6. **Port:** 443
7. **HTTPS certificate:** Select your wildcard cert (e.g., `example-wildcard-cert`)
8. **Listener type:** Multi site
9. **Host name:** `service-a.example.com`
10. Click **Add**

**For Service B:**

Repeat with:
- **Listener name:** `https-listener-service-b`
- **Host name:** `service-b.example.com`

### Step 3.5: Azure Portal - Routing Rules

**Rule 1 - HTTPS for Service A:**

1. Click **Rules** (left sidebar)
2. Click **+ Add** to create new rule
3. **Rule name:** `rule-https-service-a`
4. **Priority:** `100`
5. **Listener:** `https-listener-service-a`
6. **Backend target section:**
   - **Backend pool:** `backend-services`
   - **HTTP settings:** `http-backend-80`
7. Click **Add**

**Rule 2 - HTTPS for Service B:**

1. Click **+ Add** again
2. **Rule name:** `rule-https-service-b`
3. **Priority:** `110`
4. **Listener:** `https-listener-service-b`
5. **Backend target section:**
   - **Backend pool:** `backend-services`
   - **HTTP settings:** `http-backend-b-80`
6. Click **Add**

**Optional - HTTP Redirect:**

To redirect HTTP to HTTPS:

1. Create HTTP Listener: `http-listener`
2. Click **+ Add** rule
3. **Rule name:** `rule-http-redirect`
4. **Priority:** `120`
5. **Listener:** `http-listener`
6. **Action type:** `Redirect`
7. **Redirect type:** `Permanent (301)`
8. **Target listener:** `https-listener-service-a`
9. Click **Add**

---

## Phase 4: DNS Configuration

### Step 4.1: Create CNAME Records

In your DNS provider (GoDaddy, Azure DNS, etc.):

| Record Type | Name                  | Value                                    | TTL  |
|-------------|----------------------|------------------------------------------|------|
| CNAME       | service-a.example.com | appgw.centralindia.cloudapp.azure.com   | 3600 |
| CNAME       | service-b.example.com | appgw.centralindia.cloudapp.azure.com   | 3600 |

### Step 4.2: Verify DNS Resolution

```bash
# Test DNS from your local machine
nslookup service-a.example.com
# Expected:
# Non-authoritative answer:
# service-a.example.com  canonical name = appgw.centralindia.cloudapp.azure.com
# appgw.centralindia.cloudapp.azure.com  has address 20.198.76.194

# Test with ping
ping service-a.example.com
# Expected: Should resolve to 20.198.76.194

# Wait if DNS is propagating (may take 5-15 minutes)
```

---

## Phase 5: End-to-End Testing

### Step 5.1: Test HTTPS from Local Machine

```bash
# Test Service A
curl -v https://service-a.example.com/
# Expected:
# HTTP/2 200
# Response from Service A

# Test Service B
curl -v https://service-b.example.com/
# Expected:
# HTTP/2 200
# Response from Service B
```

### Step 5.2: Test from Browser

1. Open browser
2. Visit `https://service-a.example.com/`
3. Should see Service A response
4. Check browser console for any JS errors

### Step 5.3: Check AppGW Backend Health

```bash
# In Azure Portal:
# Application Gateway → Backend health

# Expected:
# Backend pool: backend-services
# Target: 192.240.0.33:80
# Status: Healthy (green checkmark)

# If Unhealthy:
# 1. Check pods are running: kubectl get pods
# 2. Check ingress has ADDRESS: kubectl get ingress
# 3. Check health probe endpoint: kubectl port-forward svc/service-a 8080:80 && curl http://localhost:8080/
```

---

## Phase 6: Monitoring and Logs

### Step 6.1: AppGW Diagnostic Logs

Enable diagnostic logs in Azure Portal:

1. **Application Gateway** → **Diagnostic settings**
2. Click **+ Add diagnostic setting**
3. **Name:** `appgw-diagnostics`
4. Enable:
   - Application Gateway Access Logs
   - Application Gateway Performance Logs
5. **Send to:** Log Analytics Workspace
6. Click **Save**

### Step 6.2: Query Logs

In Azure Portal → **Log Analytics Workspace** → **Logs**:

```kusto
// Find failed requests
AzureDiagnostics
| where ResourceType == "APPLICATIONGATEWAYS"
| where httpStatus_d >= 400
| project TimeGenerated, clientIP_s, requestUri_s, httpStatus_d, backendStatus_s, timeTaken_d
| sort by TimeGenerated desc
```

### Step 6.3: Monitor Pod Behavior

```bash
# Watch pods in real-time
kubectl get pods -w

# Watch a specific pod
kubectl describe pod <pod-name>

# Stream logs from all pods for a service
kubectl logs -l app=service-a -f --all-containers=true
```

---

## Troubleshooting Flowchart

```
❌ "Connection refused"
  ├─ Check DNS: nslookup service-a.example.com
  ├─ Check AppGW status: Azure Portal
  └─ Check ingress address: kubectl get ingress

❌ "502 Bad Gateway"
  ├─ Check pod health: kubectl get pods
  ├─ Check health probe: kubectl port-forward svc/service-a 8080:80 && curl http://localhost:8080/
  ├─ Check AppGW backend health: Azure Portal → Backend health
  └─ Check logs: kubectl logs -l app=service-a

❌ "504 Gateway Timeout"
  ├─ Check pod is responding: kubectl exec <pod-name> -- curl http://localhost:3001/
  ├─ Increase AppGW timeout: AppGW → Settings → Request time-out
  └─ Check if pod is overloaded: kubectl top pods

❌ "404 Not Found"
  ├─ Check ingress rules: kubectl describe ingress service-a-ingress
  ├─ Verify hostname matches: should match AppGW listener hostname
  └─ Check pod serving on correct port: kubectl logs

❌ "SSL certificate error"
  ├─ Check certificate CN: openssl s_client -connect service-a.example.com:443
  ├─ Verify cert uploaded to AppGW: Azure Portal → SSL certificates
  └─ Check listener uses correct cert: AppGW → Listeners
```

---

## Verification Checklist

Before considering deployment complete:

- [ ] Pods are running: `kubectl get pods` shows all READY
- [ ] Services created: `kubectl get svc` shows services
- [ ] Ingress has ADDRESS: `kubectl get ingress` shows IP
- [ ] Internal NGINX running: `kubectl get svc -n ingress-nginx`
- [ ] AppGW backend pool created and configured
- [ ] HTTPS listeners created for each service
- [ ] Routing rules created and prioritized
- [ ] DNS CNAME records created
- [ ] DNS resolves correctly: `nslookup service-a.example.com`
- [ ] HTTPS works: `curl https://service-a.example.com/`
- [ ] AppGW backend shows "Healthy"
- [ ] Logs show successful requests: AppGW diagnostic logs

---

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Ingress stuck in `<pending>` | nginx-internal ingress class not installed; run `helm install nginx-internal ingress-nginx/ingress-nginx ...` |
| Pod not starting | Check deployment logs: `kubectl logs <pod-name>`; verify image tag and resources |
| 502 Bad Gateway | Check health probe endpoint; verify service port matches backend port |
| 504 Timeout | Increase request timeout in AppGW; check if pod is unresponsive |
| DNS not resolving | Wait for DNS propagation (5-15 min); verify CNAME record in DNS provider |
| SSL certificate error | Verify certificate CN includes domain; check cert is uploaded to AppGW |

---

## Performance Tuning

Once everything is working:

```bash
# Scale deployment for higher load
kubectl scale deployment service-a --replicas=5

# Update resource limits based on actual usage
kubectl set resources deployment service-a \
  --limits cpu=1000m,memory=1Gi \
  --requests cpu=500m,memory=512Mi

# Enable horizontal pod autoscaling
kubectl autoscale deployment service-a --min=2 --max=10 --cpu-percent=70
```

---

## Cleanup

To remove all resources:

```bash
# Delete all manifests
kubectl delete -f k8s/

# Verify deletion
kubectl get all
```

In Azure Portal, also delete:
- AppGW backend pool
- HTTP settings
- Listeners
- Routing rules
- SSL certificates
