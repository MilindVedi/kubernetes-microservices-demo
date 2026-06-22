# Next Steps: Using the AppGW Internal Ingress Flow

## You Are Here

✅ All YAML files updated for AppGW flow
✅ Comprehensive documentation written
✅ Ready for deployment

---

## Next Steps

### Step 1: Review Documentation (5 mins)

Read these in order:

1. **[BRANCH-SUMMARY.md](./BRANCH-SUMMARY.md)** — Overview of what changed
2. **[README.md](../README.md)** — Updated project documentation
3. **[APPGW-QUICK-REFERENCE.md](./APPGW-QUICK-REFERENCE.md)** — Key configuration points

### Step 2: Detailed Setup (30 mins)

Follow the complete guide:

**[APPGW-INTERNAL-INGRESS-SETUP.md](./APPGW-INTERNAL-INGRESS-SETUP.md)**

This covers:
- DNS setup (GoDaddy/Azure DNS)
- SSL/TLS certificate upload to AppGW
- Internal NGINX Ingress Controller installation
- Azure AppGW configuration (step-by-step)
- Kubernetes manifest deployment
- Testing and verification
- Troubleshooting guide

### Step 3: Deploy to Your Cluster (20 mins)

Follow the workflow with exact commands and expected outputs:

**[DEPLOYMENT-WORKFLOW.md](./DEPLOYMENT-WORKFLOW.md)**

Sections:
- **Phase 1:** Kubernetes Deployment (deploy manifests)
- **Phase 2:** Internal Testing (verify within cluster)
- **Phase 3:** AppGW Configuration (Azure Portal steps)
- **Phase 4:** DNS Configuration (create CNAME records)
- **Phase 5:** End-to-End Testing (test HTTPS from browser)
- **Phase 6:** Monitoring (enable logs, query diagnostics)

### Step 4: Customize for Your Services

1. Update domain names:
   - In `k8s/service-a-ingress.yaml`: Replace `service-a.example.com`
   - In `k8s/service-b-ingress.yaml`: Replace `service-b.example.com`

2. Update Azure AppGW backend IP:
   - Replace `192.240.0.33` with your internal NGINX LoadBalancer IP

3. Update container ports if needed:
   - Verify actual app listening ports in your Dockerfiles
   - Update `targetPort` in Service YAML to match

---

## Files You'll Need

### Kubernetes Manifests (Ready to Use)

```
k8s/
├── service-a-deployment.yaml    ← Pod definition (ready)
├── service-a-service.yaml       ← ClusterIP service (updated for AppGW)
├── service-a-ingress.yaml       ← Ingress routing (NEW - configure domain)
├── service-b-deployment.yaml    ← Pod definition (ready)
└── service-b-service.yaml       ← ClusterIP service (ready)
```

### Documentation (For Reference)

```
docs/
├── APPGW-INTERNAL-INGRESS-SETUP.md    ← Complete setup guide
├── APPGW-QUICK-REFERENCE.md            ← Quick reference & checklists
├── DEPLOYMENT-WORKFLOW.md              ← Step-by-step workflow
└── BRANCH-SUMMARY.md                   ← What changed (this branch)
```

---

## Configuration Checklist

Before deploying, gather/prepare:

- [ ] **Domain names** — Your service domains (e.g., service-a.example.com)
- [ ] **DNS provider** — Access to create CNAME records (GoDaddy, Azure DNS, etc.)
- [ ] **SSL/TLS certificate** — Wildcard cert for your domain (*.example.com)
- [ ] **Azure AppGW** — Already deployed and accessible
- [ ] **AKS Cluster** — kubectl configured and working
- [ ] **Internal NGINX IP** — From `kubectl get svc -n ingress-nginx` (e.g., 192.240.0.33)
- [ ] **AppGW Public IP** — From Azure Portal (e.g., 20.198.76.194)

---

## Common Customizations

### Adding a New Service (Service C)

1. Copy manifest templates:
   ```bash
   cp k8s/service-a-deployment.yaml k8s/service-c-deployment.yaml
   cp k8s/service-a-service.yaml k8s/service-c-service.yaml
   cp k8s/service-a-ingress.yaml k8s/service-c-ingress.yaml
   ```

2. Update names in all three files:
   - Replace `service-a` → `service-c`
   - Update hostname in ingress: `service-c.example.com`
   - Update container port if different (targetPort in service)

3. Deploy:
   ```bash
   kubectl apply -f k8s/service-c-*.yaml
   ```

4. Configure AppGW:
   - Add HTTPS listener for `service-c.example.com`
   - Add routing rule (same backend pool as other services)
   - Create DNS CNAME for `service-c.example.com`

### Changing Port Numbers

If your app listens on a different port (not 3001):

1. Update deployment:
   ```yaml
   # k8s/service-a-deployment.yaml
   ports:
   - containerPort: 5000    # ← Your actual port
   ```

2. Update service:
   ```yaml
   # k8s/service-a-service.yaml
   ports:
     - port: 80
       targetPort: 5000     # ← Must match containerPort
   ```

3. No need to change ingress (it uses service port 80)

---

## Troubleshooting Quick Links

| Problem | Location | Solution |
|---------|----------|----------|
| Ingress not getting ADDRESS | APPGW-INTERNAL-INGRESS-SETUP.md | Install internal NGINX ingress controller |
| 502 Bad Gateway | APPGW-QUICK-REFERENCE.md | Check health probe endpoint |
| DNS not resolving | DEPLOYMENT-WORKFLOW.md Phase 4 | Wait for propagation or verify CNAME record |
| Pod not starting | DEPLOYMENT-WORKFLOW.md Phase 1 | Check pod logs: `kubectl logs <pod-name>` |
| Connection refused | APPGW-INTERNAL-INGRESS-SETUP.md | Verify AppGW backend health |

---

## Key Takeaways

### This Architecture

```
[User HTTPS] → [AppGW HTTPS Listener] 
  → [Internal NGINX Ingress on :80] 
    → [ClusterIP Service on :80] 
      → [Pod Container on :3001]
```

### Benefits

✅ **Secure** — HTTPS termination at AppGW, internal traffic via cluster DNS
✅ **Scalable** — One AppGW backend pool serves multiple services
✅ **Simple** — Add new services without changing AppGW (just new listeners/rules)
✅ **Reliable** — Health probes ensure only healthy pods receive traffic
✅ **Cost Efficient** — Single AppGW + single NGINX controller for all services

### Key Difference from Local Setup

| Aspect | Local (NodePort) | Production (AppGW) |
|--------|-----------------|-------------------|
| External Access | `http://localhost:30080` | `https://service-a.example.com` |
| HTTPS | Not applicable | Terminated at AppGW |
| Service Type | NodePort | ClusterIP |
| Service Port | 3001 | 80 (standard) |
| Ingress | Not used | nginx-internal class |
| Backend Routing | Direct to pod | Via NGINX ingress |

---

## Success Criteria

You'll know the setup is working when:

✅ Pods run: `kubectl get pods` shows all READY
✅ Ingress has ADDRESS: `kubectl get ingress` shows IP (192.240.0.33)
✅ AppGW backend is Healthy: Azure Portal → Backend health
✅ DNS resolves: `nslookup service-a.example.com` → Shows AppGW IP
✅ HTTPS works: `curl https://service-a.example.com/` → HTTP 200
✅ Browser shows response: `https://service-a.example.com` → Displays content

---

## Getting Help

### If Something Doesn't Work

1. **Check logs first:**
   ```bash
   kubectl logs -l app=service-a --tail=50
   kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=50
   ```

2. **Verify manifests:**
   ```bash
   kubectl describe ingress service-a-ingress
   kubectl describe svc service-a
   kubectl describe pod <pod-name>
   ```

3. **Consult troubleshooting guides:**
   - APPGW-INTERNAL-INGRESS-SETUP.md → Troubleshooting section
   - APPGW-QUICK-REFERENCE.md → Common mistakes
   - DEPLOYMENT-WORKFLOW.md → Troubleshooting flowchart

4. **Check Azure Portal:**
   - Application Gateway → Backend health (should show Healthy)
   - Application Gateway → Diagnostic logs (look for errors)

---

## What's Next After Successful Deployment

Once everything is working:

1. **Add monitoring:** Enable AppGW diagnostic logs and create alerts
2. **Configure autoscaling:** Set up HPA (Horizontal Pod Autoscaler)
3. **Add more services:** Use the templates to add additional services
4. **Optimize:** Adjust resource limits based on actual usage
5. **Document:** Update your runbooks with actual IPs and domain names

---

## Branch Information

**Name:** `feature/azure-appgw-internal-ingress-flow`
**Status:** Ready for deployment ✅
**Size:** 7 files changed, 1,818 insertions

To switch to this branch:
```bash
git checkout feature/azure-appgw-internal-ingress-flow
```

To merge into main after testing:
```bash
git checkout main
git merge feature/azure-appgw-internal-ingress-flow
```

---

## Questions?

Refer to:
- **"What should I do first?"** → Read BRANCH-SUMMARY.md
- **"How do I set up AppGW?"** → Read APPGW-INTERNAL-INGRESS-SETUP.md
- **"Quick reference?"** → Read APPGW-QUICK-REFERENCE.md
- **"Step-by-step workflow?"** → Read DEPLOYMENT-WORKFLOW.md
- **"Why did something fail?"** → Check troubleshooting sections
- **"How do I customize?"** → Check "Common Customizations" above

Good luck with your deployment! 🚀
