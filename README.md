# Kubernetes Microservices with Azure App Gateway

This project demonstrates a production-grade architecture for exposing Kubernetes microservices through Azure Application Gateway with internal NGINX Ingress Controller.

---

## Architecture

```
External User
    ↓
HTTPS (AppGW public IP on port 443)
    ↓
Azure Application Gateway
  - HTTPS Listener (port 443)
  - Backend pool: 192.240.0.33 (internal NGINX)
  - Routing rules by hostname
    ↓
Internal NGINX Ingress Controller
  - LoadBalancer IP: 192.240.0.33
  - Ingress resources for each service
    ↓
Kubernetes Services & Pods
  - Service A (ClusterIP on port 80)
  - Service B (ClusterIP on port 80)
  - ↓
  - Pod replicas (listening on actual ports: 3001, 3000)
```

- **Service A** — Exposed via Ingress. Accessible at `service-a.example.com`. Calls Service B internally via DNS.
- **Service B** — Internal only. Accessible from Service A via cluster DNS `service-b.default.svc.cluster.local`.

---

## Key Features

✅ **Production-Ready Architecture**
- Azure Application Gateway handles HTTPS termination
- Internal NGINX Ingress for secure cluster communication
- ClusterIP services (no exposed ports)
- Health probes and resource limits

✅ **Scalable Design**
- Add new services without AppGW changes (same backend pool)
- Horizontal Pod autoscaling ready
- Multi-replica deployments

✅ **Security**
- SSL/TLS encryption (AppGW → User)
- Internal services not exposed publicly
- Cluster DNS for inter-service communication

✅ **Cost Efficient**
- Single AppGW instance for all services
- Single internal NGINX controller
- Shared backend pool

---

## Project Structure

```
├── k8s/                                    # Kubernetes manifests
│   ├── service-a-deployment.yaml           # Service A pod replicas
│   ├── service-a-service.yaml              # Service A ClusterIP
│   ├── service-a-ingress.yaml              # Service A route (nginx-internal)
│   ├── service-b-deployment.yaml           # Service B pod replicas
│   ├── service-b-service.yaml              # Service B ClusterIP
│   └── service-b-ingress.yaml              # Service B route (nginx-internal)
│
├── service-a/                              # Service A source (Node.js, port 3001)
│   ├── Dockerfile
│   ├── index.js                            # Express server
│   └── package.json
│
├── service-b/                              # Service B source (Node.js, port 3000)
│   ├── Dockerfile
│   ├── index.js                            # Express server
│   └── package.json
│
└── docs/
    ├── APPGW-INTERNAL-INGRESS-SETUP.md    # Complete setup guide (MAIN REFERENCE)
    ├── APPGW-QUICK-REFERENCE.md           # Quick reference & troubleshooting
    └── copilot-helpers/
        ├── kubernetes-guide.md             # Generic K8s concepts
        ├── project-walkthrough.md          # (Legacy) Local Minikube walkthrough
        └── commands-reference.md           # Common kubectl commands
```

---

## Quick Start

### Prerequisites

- Azure AKS Cluster
- Azure Application Gateway
- NGINX Ingress Controller (internal LoadBalancer)
- kubectl configured
- DNS provider (GoDaddy, Azure DNS, etc.)

### 1. Deploy Services to Cluster

```bash
# Deploy Service A
kubectl apply -f k8s/service-a-deployment.yaml
kubectl apply -f k8s/service-a-service.yaml
kubectl apply -f k8s/service-a-ingress.yaml

# Deploy Service B
kubectl apply -f k8s/service-b-deployment.yaml
kubectl apply -f k8s/service-b-service.yaml
kubectl apply -f k8s/service-b-ingress.yaml

# Verify
kubectl get all
kubectl get ingress
```

### 2. Get Internal NGINX IP

```bash
kubectl get svc -n ingress-nginx nginx-internal-ingress-nginx-controller

# Output:
# NAME                                     TYPE           EXTERNAL-IP
# nginx-internal-ingress-nginx-controller  LoadBalancer   192.240.0.33
```

### 3. Configure Azure Application Gateway

- **Backend pool:** Add IP `192.240.0.33`
- **HTTPS listener:** For each service (e.g., `service-a.example.com`)
- **Routing rule:** Point to backend pool
- **Certificate:** Upload wildcard cert (*.example.com)

### 4. Configure DNS

```
service-a.example.com  →  CNAME  →  appgw.centralindia.cloudapp.azure.com
service-b.example.com  →  CNAME  →  appgw.centralindia.cloudapp.azure.com
```

### 5. Test

```bash
# From your machine
curl https://service-a.example.com/
# Response from Service A

# Service A internally calls Service B
curl https://service-b.example.com/
# Response from Service B
```

---

## Documentation

### Main References

- **[APPGW-INTERNAL-INGRESS-SETUP.md](docs/APPGW-INTERNAL-INGRESS-SETUP.md)** — Complete end-to-end setup guide
  - DNS & domain configuration
  - SSL/TLS certificate setup
  - NGINX Ingress Controller installation
  - Azure AppGW configuration (step-by-step)
  - Kubernetes manifests explained
  - Deployment workflow
  - Troubleshooting guide

- **[APPGW-QUICK-REFERENCE.md](docs/APPGW-QUICK-REFERENCE.md)** — Quick reference & checklists
  - Files overview
  - Key configuration points
  - Common mistakes to avoid
  - Verification commands
  - Multi-service scaling
  - Security considerations

### Learning Resources (Local/Minikube only)

- `docs/copilot-helpers/kubernetes-guide.md` — Generic K8s concepts
- `docs/copilot-helpers/project-walkthrough.md` — Local Minikube demo
- `docs/copilot-helpers/commands-reference.md` — kubectl command reference

---

## Configuration Parameters

When deploying your services, update these values:

| Parameter | Location | Example Value |
|-----------|----------|--------|
| **Domain Name** | Service ingress YAML | `service-a.example.com` |
| **Azure AppGW IP** | AppGW backend pool | `192.240.0.33` |
| **NGINX LoadBalancer IP** | Ingress Address column | `192.240.0.33` |
| **Container Port** | Deployment YAML | `3001` (Service A), `3000` (Service B) |
| **Service Port** | Service YAML | `80` (standard HTTP) |
| **HTTPS Certificate** | AppGW listener | `*.example.com` wildcard cert |
| **Health Check Path** | Deployment YAML | `/` (or custom endpoint) |

---

## Key YAML Files Explained

### Deployment (Pods)

**File:** `k8s/service-a-deployment.yaml`

```yaml
spec:
  replicas: 2                           # Run 2 Pod copies
  selector:
    matchLabels:
      app: service-a                    # Selector for this deployment
  template:
    spec:
      containers:
      - name: service-a
        image: service-a:latest         # Docker image
        ports:
        - containerPort: 3001           # Actual app listening port
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:                  # Restart if unhealthy
          httpGet:
            path: /
            port: 3001
        readinessProbe:                 # Mark ready for traffic
          httpGet:
            path: /
            port: 3001
```

### Service (Internal Routing)

**File:** `k8s/service-a-service.yaml`

```yaml
spec:
  selector:
    app: service-a                      # Route to this deployment
  ports:
    - protocol: TCP
      port: 80                          # Service port (exposed to ingress)
      targetPort: 3001                  # Pod container port (must match deployment)
      name: http                        # Named port reference
  type: ClusterIP                       # Internal only (AppGW accesses via ingress)
```

### Ingress (AppGW Routing)

**File:** `k8s/service-a-ingress.yaml`

```yaml
metadata:
  annotations:
    kubernetes.io/ingress.class: nginx-internal  # Use internal NGINX controller
spec:
  rules:
    - host: service-a.example.com                # Domain name (must match AppGW listener)
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: service-a                  # Route to Service named 'service-a'
                port:
                  number: 80                     # Must match Service.spec.ports[0].port
```

---

## Common Deployment Commands

```bash
# Deploy all manifests
kubectl apply -f k8s/

# Deploy specific service
kubectl apply -f k8s/service-a-*.yaml

# Check deployments
kubectl get deployments
kubectl get services
kubectl get ingress

# Check pod status
kubectl get pods
kubectl describe pod <pod-name>

# Check logs
kubectl logs -l app=service-a --tail=50 -f

# Check ingress details
kubectl describe ingress service-a-ingress

# Port-forward for local testing
kubectl port-forward svc/service-a 8080:80

# Scale deployment
kubectl scale deployment service-a --replicas=3

# Update image
kubectl set image deployment/service-a service-a=service-a:v1.1
```

---

## Troubleshooting

### Ingress not getting ADDRESS

```bash
kubectl describe ingress service-a-ingress
# Check events for errors
# Common: nginx-internal ingress class not installed
```

**Fix:**
```bash
# Verify internal NGINX is running
kubectl get svc -n ingress-nginx
# Should show nginx-internal-ingress-nginx-controller with EXTERNAL-IP (not pending)
```

### 502 Bad Gateway from AppGW

1. **Verify health probe passes:**
   ```bash
   kubectl exec -it <pod-name> -- curl http://localhost:3001/
   ```

2. **Check AppGW backend health:**
   - Azure Portal → Application Gateway → Backend health
   - Should show "Healthy"

3. **Check port mapping:**
   ```bash
   # Service port must match target port
   kubectl get svc service-a -o jsonpath='{.spec.ports[0].port}'
   kubectl get svc service-a -o jsonpath='{.spec.ports[0].targetPort}'
   ```

### Pod CrashLoopBackOff

```bash
# Check pod logs
kubectl logs <pod-name>

# Common causes:
# 1. Wrong container port in Deployment
# 2. Health probe failing
# 3. Application startup error
```

### Connection refused from AppGW

1. Verify DNS resolution: `nslookup service-a.example.com`
2. Check AppGW HTTPS listener hostname matches ingress hostname
3. Verify certificate CN matches domain: `openssl s_client -connect service-a.example.com:443`

---

## Project Layout and Files

| File | Purpose |
|------|---------|
| `README.md` | This file - project overview |
| `docs/APPGW-INTERNAL-INGRESS-SETUP.md` | **Complete setup guide - READ THIS FIRST** |
| `docs/APPGW-QUICK-REFERENCE.md` | Quick checklist and troubleshooting |
| `k8s/service-{a,b}-deployment.yaml` | Pod configuration |
| `k8s/service-{a,b}-service.yaml` | Internal routing (ClusterIP) |
| `k8s/service-{a,b}-ingress.yaml` | Ingress routing rules |
| `service-a/index.js` | Service A source code (Node.js/Express) |
| `service-b/index.js` | Service B source code (Node.js/Express) |

---

## How Services Communicate

```
Browser Request
    ↓ HTTPS to AppGW
AppGW (HTTPS termination)
    ↓ HTTP to internal NGINX (192.240.0.33:80)
NGINX Ingress Controller
    ↓ Routes based on hostname
Service A (ClusterIP 10.x.x.x:80)
    ↓ Port forwarding to container port 3001
Pod Container
    ↓ Application logic (Express server)
Service A Response
    ↓ Calls Service B via DNS
Service B (ClusterIP 10.x.x.x:80)
    ↓ Port forwarding to container port 3000
Pod Container
    ↓ Application logic
Combined Response
    ↓ Back through ingress/AppGW
Browser Display
```

---

## Security Features

✅ **HTTPS Encryption** — AppGW terminates TLS for all external traffic
✅ **Internal-Only Services** — ClusterIP services not exposed to internet
✅ **Cluster DNS** — Services communicate via secure cluster network
✅ **Health Probes** — Faulty pods automatically excluded from routing
✅ **Resource Limits** — Prevents pod resource exhaustion

---

## Next Steps

1. **Read the full setup guide:** [docs/APPGW-INTERNAL-INGRESS-SETUP.md](docs/APPGW-INTERNAL-INGRESS-SETUP.md)
2. **Set up your Azure environment** following the guide
3. **Deploy these manifests** to your AKS cluster
4. **Configure Azure AppGW** with the domains and certificates
5. **Test via HTTPS** to your domain

---

## Additional Resources

- [Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Azure Application Gateway](https://docs.microsoft.com/en-us/azure/application-gateway/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Express.js](https://expressjs.com/)

---

## License

This is a learning project. Feel free to modify and use as needed.


## Port Mapping

| Service | App Port | Container Port | Target Port | Service Port | Node Port |
|---------|----------|---------------|-------------|-------------|-----------|
| Service A | 3001 | 3001 | 3001 | 3001 | 30080 |
| Service B | 3000 | 3000 | 3000 | 3000 | N/A (ClusterIP) |

---

## Updating Code

After making changes to source code:

```bash
eval $(minikube docker-env)
docker build -t service-a:latest ./service-a
kubectl rollout restart deployment service-a
```

---

## Cleanup

```bash
kubectl delete -f k8s/    # Remove all K8s resources
minikube stop              # Pause cluster
minikube delete            # Destroy cluster entirely
```

---

## Documentation

Detailed learning notes are in `docs/copilot-helpers/`:

- **kubernetes-guide.md** — K8s concepts, architecture, YAML structure, networking
- **project-walkthrough.md** — How this specific project works
- **commands-reference.md** — All kubectl/minikube/docker commands

---

## Tech Stack

- **Runtime:** Node.js 18
- **Framework:** Express.js
- **HTTP Client:** Axios (Service A → Service B)
- **Container:** Docker
- **Orchestration:** Kubernetes (Minikube)
