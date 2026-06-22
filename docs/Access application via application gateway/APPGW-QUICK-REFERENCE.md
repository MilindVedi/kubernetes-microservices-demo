# App Gateway → Internal Ingress → Service: Quick Reference

## Files Overview

| File | Purpose | Type |
|------|---------|------|
| `service-a-deployment.yaml` | Defines Pod replicas with container spec | Deployment |
| `service-a-service.yaml` | Creates ClusterIP service (internal routing) | Service |
| `service-a-ingress.yaml` | Routes traffic to Service via nginx-internal | Ingress |
| `service-b-deployment.yaml` | Defines Pod replicas for Service B | Deployment |
| `service-b-service.yaml` | Creates ClusterIP service for Service B | Service |
| `service-b-ingress.yaml` | Routes traffic to Service B via nginx-internal | Ingress |

---

## Key Configuration Points

### Service Changes from NodePort → ClusterIP

**Before (Local Testing):**
```yaml
service-a-service.yaml:
  type: NodePort
  ports:
    port: 3001
    nodePort: 30080
```

**After (Azure with AppGW):**
```yaml
service-a-service.yaml:
  type: ClusterIP              # ← Changed to internal only
  ports:
    port: 80                   # ← Changed to standard HTTP port
    targetPort: 3001           # ← Container's actual port
    name: http                 # ← Named port for ingress
```

### Ingress Configuration

```yaml
service-a-ingress.yaml:
  metadata:
    annotations:
      kubernetes.io/ingress.class: nginx-internal
  rules:
    host: service-a.example.com
    path: /
    backend:
      service:
        name: service-a
        port: 80                # ← Must match Service port
```

### Azure AppGW Configuration

| Component | Value | Notes |
|-----------|-------|-------|
| Backend Pool | `192.240.0.33` | Internal NGINX LoadBalancer IP |
| Backend Port | `80` | NGINX ingress controller listening port |
| HTTPS Listener Port | `443` | Standard HTTPS |
| Certificate | `example-wildcard.pfx` | Wildcard for all services |
| Host Override | `service-a.example.com` | Exact domain name |

---

## Deployment Workflow

```bash
# Step 1: Create/Update manifests
# - Edit service-a-deployment.yaml (image, replicas, resources)
# - Edit service-a-service.yaml (ports, selectors)
# - Edit service-a-ingress.yaml (hostname)

# Step 2: Apply to cluster
kubectl apply -f k8s/service-a-deployment.yaml
kubectl apply -f k8s/service-a-service.yaml
kubectl apply -f k8s/service-a-ingress.yaml

# Step 3: Verify
kubectl get all -l app=service-a
kubectl get ingress

# Step 4: Configure AppGW (one-time per service)
# - Backend pool (shared: 192.240.0.33)
# - HTTPS listener (new)
# - Routing rule (new)
# - DNS CNAME (new)
```

---

## Verification Commands

```bash
# Check if ingress got internal NGINX IP
kubectl get ingress service-a-ingress -o wide

# Test from within cluster
kubectl run -it --rm alpine --image=alpine --restart=Never -- \
  wget -qO- http://service-a.default.svc.cluster.local

# Port-forward to test locally
kubectl port-forward svc/service-a 8080:80
curl http://localhost:8080

# Check pod logs
kubectl logs -l app=service-a

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

---

## Common Mistakes to Avoid

| ❌ Mistake | ✅ Correct |
|-----------|-----------|
| Service type: `NodePort` | Service type: `ClusterIP` |
| Service port: `3001` | Service port: `80` (standard HTTP) |
| Ingress class: `nginx` | Ingress class: `nginx-internal` |
| Backend pool IP: `10.x.x.x` | Backend pool IP: `192.240.0.33` (LoadBalancer IP) |
| Ingress host: `localhost` | Ingress host: `service-a.example.com` |
| No health probes | Include liveness + readiness probes |
| Container port mismatch | Container port must match `targetPort` |

---

## Port Mapping Example

```
User Request
    ↓
Browser: https://service-a.example.com (port 443 - implicit)
    ↓
AppGW HTTPS Listener: port 443
    ↓
AppGW Backend pool: 192.240.0.33:80 (HTTP forwarding)
    ↓
NGINX Ingress Controller: port 80
    ↓
Ingress Rule: service-a.example.com → service-a:80
    ↓
Service: port 80 → targetPort 3001
    ↓
Pod Container: port 3001 (application listening)
```

---

## DNS Setup Example

| Domain | Records |
|--------|---------|
| `service-a.example.com` | CNAME → `appgw.centralindia.cloudapp.azure.com` |
| `service-b.example.com` | CNAME → `appgw.centralindia.cloudapp.azure.com` |

Both services use the same AppGW public IP, but AppGW routes based on hostname.

---

## AppGW Backend Health Check

```bash
# In Azure Portal:
# Application Gateway → Backend health

# Should show: "Healthy" for 192.240.0.33:80

# If "Unhealthy":
# 1. Check ingress controller is running
kubectl get svc -n ingress-nginx

# 2. Check pods are running
kubectl get pods

# 3. Test manually
kubectl port-forward -n ingress-nginx \
  svc/nginx-internal-ingress-nginx-controller 8080:80
curl http://localhost:8080/
```

---

## Multi-Service Scaling

To add a new service (Service C):

1. **Create manifests:**
   ```
   k8s/service-c-deployment.yaml  (copy from service-a-deployment.yaml)
   k8s/service-c-service.yaml     (copy from service-a-service.yaml)
   k8s/service-c-ingress.yaml     (copy from service-a-ingress.yaml)
   ```

2. **Update names/selectors:**
   - Replace `service-a` → `service-c` in all files
   - Update hostname in ingress: `service-c.example.com`

3. **Apply to cluster:**
   ```bash
   kubectl apply -f k8s/service-c-*.yaml
   ```

4. **Configure AppGW (reuse backend pool):**
   - Add HTTPS listener: `service-c.example.com`
   - Add routing rule: point to same backend pool `backend-services`
   - Backend pool already contains 192.240.0.33, so no changes needed

5. **DNS:**
   - Add CNAME: `service-c.example.com` → `appgw.centralindia.cloudapp.azure.com`

That's it! AppGW routes based on hostname to the same internal NGINX, which then routes to the correct service via ingress.

---

## Security Considerations

- **SSL/TLS**: AppGW terminates HTTPS, forwards HTTP to NGINX
- **Internal Network**: NGINX controller on internal LoadBalancer (not publicly accessible)
- **Service-to-Service**: Services access each other via cluster DNS (`service-b.default.svc.cluster.local`)
- **Certificate**: Wildcard cert on AppGW covers all services (*.example.com)

---

## Cost Optimization

- **One AppGW** serves all services (vs. one AppGW per service)
- **One internal NGINX** controller for all services (vs. multiple ingress controllers)
- **Shared backend pool** for NGINX (single target IP)
- **Multiple listeners/rules** on AppGW (cheap, main cost is AppGW instance)
