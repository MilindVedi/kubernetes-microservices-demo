# Azure App Gateway + Internal NGINX Ingress + Kubernetes Services Flow

## Overview

This guide documents the complete setup flow for exposing Kubernetes services through Azure Application Gateway using internal NGINX Ingress Controller. This is the recommended architecture for production deployments.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External User                            │
│              (Browser/API Client)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTPS (TLS/SSL)
                             │
        ┌────────────────────▼────────────────────┐
        │   Azure Application Gateway             │
        │   - Public IP: 20.198.76.194 (example)  │
        │   - HTTPS Listeners (port 443)          │
        │   - HTTP Listeners (port 80 → redirect) │
        │   - Backend Pools: Internal NGINX IP    │
        │   - Routing Rules                       │
        └────────────────────┬────────────────────┘
                             │
                    HTTP (Internal VNet)
                             │
        ┌────────────────────▼────────────────────┐
        │   Internal NGINX Ingress Controller     │
        │   - LoadBalancer Service IP: 192.240.0.33 │
        │   - Ingress Resources (nginx-internal)  │
        │   - Route to backend Services           │
        └────────────────────┬────────────────────┘
                             │
        ┌────────┬───────────┴──────────┬─────────────┐
        │        │                      │             │
        │        ▼                      ▼             ▼
    ┌──────────────┐      ┌──────────────┐   ┌──────────────┐
    │  Service A   │      │  Service B   │   │  Service N   │
    │  ClusterIP   │      │  ClusterIP   │   │  ClusterIP   │
    │  Port: 80    │      │  Port: 80    │   │  Port: 80    │
    │  Target: 3001│     │  Target: 3000│   │  Target: 3002│
    └──────────────┘      └──────────────┘   └──────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
        Deployment A         Deployment B       Deployment N
        (Pod Replicas)       (Pod Replicas)     (Pod Replicas)
```

---

## Prerequisites

- **Azure Subscription** with AKS cluster and Application Gateway
- **AKS Cluster** running with at least one node pool
- **Internal NGINX Ingress Controller** deployed (ingress-nginx Helm chart with internal LoadBalancer)
- **DNS Provider** (GoDaddy, Azure DNS, etc.) for CNAME records
- **SSL/TLS Certificates** (self-signed or CA-signed)
- **kubectl** configured to access your AKS cluster

---

## Step 1: DNS & Domain Setup

### 1.1 Create DNS Records

For each application, create a CNAME record pointing to your Azure Application Gateway public IP:

| Record Type | Name                        | Value                                | TTL |
|-------------|----------------------------|--------------------------------------|-----|
| CNAME       | service-a.example.com       | appgw.centralindia.cloudapp.azure.com | 3600 |
| CNAME       | service-b.example.com       | appgw.centralindia.cloudapp.azure.com | 3600 |

**Why CNAME?** Points your domain to AppGW's public IP (abstraction layer for IP changes)

### 1.2 Verify DNS Resolution

```bash
# Test DNS resolution
nslookup service-a.example.com
# Should return: appgw.centralindia.cloudapp.azure.com
```

---

## Step 2: SSL/TLS Certificate Setup

### 2.1 Obtain Certificate

Options:
- **Self-signed** (testing only):
  ```bash
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout privkey.pem -out cert.pem
  ```
- **Let's Encrypt** (wildcard for *.example.com)
- **GoDaddy/DigiCert** (purchased certificate)

### 2.2 Upload to Azure Application Gateway

1. Go to **Azure Portal** → **Application Gateway** → **Settings** → **SSL certificates**
2. Click **+ Add** certificate
3. Upload `.pfx` file (contains private key + cert chain)
   - If you have `.crt` and `.pem`, convert:
     ```bash
     openssl pkcs12 -export -in cert.pem -inkey privkey.pem \
       -out cert.pfx -certfile ca.pem
     ```
4. Set a friendly name (e.g., `example-wildcard-cert`)

---

## Step 3: Internal NGINX Ingress Controller

### 3.1 Install (if not already deployed)

```bash
# Add NGINX Helm repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install internal NGINX ingress controller
helm install nginx-internal ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.ingressClass=nginx-internal \
  --set controller.service.loadBalancerSourceRanges="10.0.0.0/8" \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-internal"="true"
```

### 3.2 Verify Internal LoadBalancer IP

```bash
kubectl get svc -n ingress-nginx nginx-internal-ingress-nginx-controller

# Example output:
# NAME                                     TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)
# nginx-internal-ingress-nginx-controller  LoadBalancer   10.0.XX.XX      192.240.0.33     80:30XXX/TCP,443:30XXX/TCP
```

Note the **EXTERNAL-IP** (e.g., 192.240.0.33) — this is what AppGW backend pool will target.

---

## Step 4: Azure Application Gateway Configuration

### 4.1 Backend Pools

1. Go to **Azure Portal** → **Application Gateway** → **Backend pools**
2. Click **+ Add** backend pool
3. Configure:
   - **Name:** `backend-services`
   - **Target type:** IP Addresses
   - **IP or FQDN:** `192.240.0.33` (internal NGINX LoadBalancer IP)
   - Click **Add**

### 4.2 Backend HTTP Settings

1. Go to **HTTP Settings** → **+ Add**
2. Configure:
   - **Name:** `backend-http-80`
   - **Backend port:** `80`
   - **Protocol:** `HTTP`
   - **Host name override:** `service-a.example.com` (exact domain for each app)
   - **Health probe:** Create custom or use default `/`
   - Click **Add**

Repeat for each service with appropriate domain name.

### 4.3 HTTPS Listener

1. Go to **Listeners** → **+ Add**
2. Configure:
   - **Listener name:** `https-listener-service-a`
   - **Frontend IP:** Public (your AppGW public IP)
   - **Protocol:** `HTTPS`
   - **Port:** `443`
   - **HTTPS certificate:** Select `example-wildcard-cert` (uploaded in Step 2)
   - **Listener type:** `Multi site`
   - **Host name:** `service-a.example.com`
   - Click **Add**

### 4.4 HTTP Redirect Listener (Optional but Recommended)

1. Go to **Listeners** → **+ Add**
2. Configure:
   - **Listener name:** `http-listener-redirect`
   - **Frontend IP:** Public
   - **Protocol:** `HTTP`
   - **Port:** `80`
   - Click **Add**

### 4.5 Routing Rules

#### HTTPS Routing Rule (Main)

1. Go to **Rules** → **+ Add**
2. Configure:
   - **Rule name:** `rule-https-service-a`
   - **Priority:** `100`
   - **Listener:** `https-listener-service-a`
   - **Backend targets:**
     - **Backend pool:** `backend-services`
     - **HTTP settings:** `backend-http-80`
   - Click **Add**

#### HTTP Redirect Rule (Optional)

1. Go to **Rules** → **+ Add**
2. Configure:
   - **Rule name:** `rule-http-redirect`
   - **Priority:** `101`
   - **Listener:** `http-listener-redirect`
   - **Action type:** `Redirect`
   - **Redirect type:** `Permanent (301)`
   - **Target listener:** `https-listener-service-a`
   - Click **Add**

---

## Step 5: Kubernetes Manifests

### 5.1 Service Deployment

**File:** `k8s/service-a-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: service-a
spec:
  replicas: 2                  # Run 2 Pod replicas for availability
  selector:
    matchLabels:
      app: service-a
  template:
    metadata:
      labels:
        app: service-a
    spec:
      containers:
      - name: service-a
        image: service-a:latest          # Your Docker image
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3001            # Port app listens on
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:                   # Restart if unhealthy
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:                  # Mark as ready for traffic
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 5.2 Service Definition

**File:** `k8s/service-a-service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: service-a
spec:
  selector:
    app: service-a
  ports:
    - protocol: TCP
      port: 80                 # Service port (exposed internally)
      targetPort: 3001         # Pod port (where app listens)
      name: http
  type: ClusterIP              # Internal only - no external port
```

### 5.3 Ingress Resource

**File:** `k8s/service-a-ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: service-a-ingress
  annotations:
    # Use internal NGINX ingress controller
    kubernetes.io/ingress.class: nginx-internal
spec:
  rules:
    - host: service-a.example.com       # Must match AppGW listener hostname
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: service-a         # Routes to Service defined above
                port:
                  number: 80            # Must match Service.spec.ports[0].port
```

---

## Step 6: Deployment Steps

### 6.1 Deploy Manifests

```bash
# Navigate to k8s directory
cd k8s/

# Apply all manifests
kubectl apply -f service-a-deployment.yaml
kubectl apply -f service-a-service.yaml
kubectl apply -f service-a-ingress.yaml

# Verify deployment
kubectl get deployments
kubectl get services
kubectl get ingress
```

### 6.2 Check Ingress Status

```bash
# Wait for ingress to get an IP address (may take 1-2 minutes)
kubectl get ingress -w

# Example output:
# NAME                  CLASS           HOSTS                      ADDRESS         PORTS       AGE
# service-a-ingress     nginx-internal  service-a.example.com      192.240.0.33    80, 443     2m
```

The **ADDRESS** column should show the internal NGINX IP (e.g., 192.240.0.33).

---

## Step 7: Testing & Verification

### 7.1 Test Internal Access (from within cluster)

```bash
# Port-forward to Ingress controller
kubectl port-forward -n ingress-nginx svc/nginx-internal-ingress-nginx-controller 8080:80

# In another terminal:
curl -H "Host: service-a.example.com" http://localhost:8080/

# Expected: Response from Service A
```

### 7.2 Test via AppGW HTTPS

```bash
# From your local machine
curl -H "Host: service-a.example.com" \
  https://20.198.76.194/  \
  --cacert ca.pem

# Or use browser (accept cert warning if self-signed):
https://service-a.example.com/
```

### 7.3 Check Pod Logs

```bash
# If request fails, check pod logs
kubectl logs -l app=service-a

# Check Ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx -f
```

---

## Step 8: Multi-Service Setup

Repeat for Service B and additional services:

### Service B

**File:** `k8s/service-b-ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: service-b-ingress
  annotations:
    kubernetes.io/ingress.class: nginx-internal
spec:
  rules:
    - host: service-b.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: service-b
                port:
                  number: 80
```

**AppGW Configuration for Service B:**

1. Add HTTPS Listener: `https-listener-service-b` (same certificate)
   - Host: `service-b.example.com`
2. Add HTTP Settings: `backend-http-80` (same backend pool)
   - Host override: `service-b.example.com`
3. Add Routing Rule: `rule-https-service-b` (priority 110)
   - Listener: `https-listener-service-b`
   - Backend pool: `backend-services`
   - HTTP settings: `backend-http-80`

---

## Troubleshooting

### Ingress not getting ADDRESS

```bash
kubectl describe ingress service-a-ingress

# Look for events, error messages
# Common cause: Ingress class not matching (nginx-internal not installed)
```

### 502 Bad Gateway from AppGW

1. **Check health probe:**
   ```bash
   kubectl exec -it <pod-name> -- curl http://localhost:3001/health
   ```
2. **Verify backend port:**
   ```bash
   kubectl port-forward svc/service-a 8080:80
   curl http://localhost:8080/
   ```
3. **Check AppGW backend health:**
   - Azure Portal → Application Gateway → Backend health
   - Should show "Healthy" for 192.240.0.33:80

### Connection reset when accessing via domain

1. Verify DNS resolution:
   ```bash
   nslookup service-a.example.com
   ```
2. Check certificate CN matches domain:
   ```bash
   openssl s_client -connect service-a.example.com:443 | grep CN
   ```
3. Check AppGW logs:
   - Azure Portal → Application Gateway → Diagnostic logs
   - Look for `BackendConnectionClosed`, `ResponseTimeout`, or `CompressionError`

---

## Summary of Flow

1. **User Browser** → Makes request to `https://service-a.example.com`
2. **DNS Resolution** → Routes to AppGW public IP `20.198.76.194`
3. **AppGW HTTPS Listener** → Receives on port 443, decrypts HTTPS
4. **AppGW Routing Rule** → Matches hostname, forwards to backend pool
5. **Internal NGINX** → Receives HTTP request on port 80 (192.240.0.33)
6. **Ingress Controller** → Matches hostname, routes to Service A
7. **Service (ClusterIP)** → Load-balances traffic to Pod replicas
8. **Application Container** → Processes request on port 3001
9. **Response Flow** → Reverse path back to user browser

---

## Best Practices

✅ **Do:**
- Use internal LoadBalancer for NGINX (not public)
- Use ClusterIP services (not NodePort)
- Set resource requests/limits on containers
- Use health probes (liveness + readiness)
- Use HTTPS with valid certificates
- Implement HTTP → HTTPS redirect
- Use appropriate TTL for DNS records (3600 recommended)

❌ **Don't:**
- Expose services via NodePort when using AppGW
- Mix external and internal NGINX ingress classes
- Use hardcoded IPs (use service DNS names)
- Leave health probes unconfigured
- Use self-signed certificates in production
- Enable compression in AppGW if NGINX already compresses

---

## Related Documentation

- [Azure Application Gateway Documentation](https://docs.microsoft.com/en-us/azure/application-gateway/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
