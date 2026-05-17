# Kubernetes & Minikube — Commands Reference

> Every command you need, what it does, and when to use it.

---

## Table of Contents

- [Minikube Commands](#minikube-commands)
- [kubectl — Core Commands](#kubectl--core-commands)
- [kubectl — View Resources](#kubectl--view-resources)
- [kubectl — Create & Update Resources](#kubectl--create--update-resources)
- [kubectl — Delete Resources](#kubectl--delete-resources)
- [kubectl — Debugging & Logs](#kubectl--debugging--logs)
- [kubectl — Scaling](#kubectl--scaling)
- [kubectl — Port Forwarding](#kubectl--port-forwarding)
- [kubectl — Exec Into Containers](#kubectl--exec-into-containers)
- [Docker Build Commands](#docker-build-commands)
- [Full Workflow — Deploy From Scratch](#full-workflow--deploy-from-scratch)
- [Full Workflow — Update Code Changes](#full-workflow--update-code-changes)
- [Accessing Your Service — All Methods](#accessing-your-service--all-methods)

---

## Minikube Commands

Minikube runs a local Kubernetes cluster on your machine.

| Command | What It Does |
|---------|-------------|
| `minikube start` | Start (or resume) the cluster. Does NOT wipe existing resources. |
| `minikube stop` | Pause the cluster. All resources are preserved. |
| `minikube delete` | **Completely destroy** the cluster. Fresh start next time. |
| `minikube status` | Check if the cluster is running. |
| `minikube dashboard` | Open the Kubernetes web dashboard in browser. |
| `minikube service <name>` | Create a tunnel and open a service in your browser. |
| `minikube ip` | Get the IP address of the minikube node. |
| `minikube logs` | View minikube system logs. |
| `minikube tunnel` | Create a network tunnel for LoadBalancer services (mock cloud provider). |
| `eval $(minikube docker-env)` | Point your Docker CLI to minikube's Docker daemon. |

### `minikube start`

```bash
minikube start
```

- Starts or resumes the cluster.
- **Does NOT create a fresh cluster** — old deployments from days ago will still be there.
- For a clean slate: `minikube delete` first, then `minikube start`.

### `minikube service <name>`

```bash
minikube service service-a
```

- Creates a **tunnel** from your machine to the service inside the cluster.
- Opens the tunneled URL in your browser automatically.
- **The terminal must stay open** — closing it kills the tunnel.
- Only needed on Docker driver (Windows/Mac). Direct IP works on Linux/VM drivers.

### `eval $(minikube docker-env)`

```bash
eval $(minikube docker-env)
```

- **Points your Docker CLI to minikube's Docker daemon** instead of your local Docker.
- After running this, any `docker build` creates images INSIDE the minikube VM.
- Required when using `imagePullPolicy: Never` — so minikube can find your local images.
- **Only affects the current terminal session.** Open a new terminal = reset.

### `minikube tunnel`

```bash
minikube tunnel
```

- Creates a network route so `LoadBalancer` services get an external IP on your local machine.
- Without this, `EXTERNAL-IP` stays stuck on `<pending>` for LoadBalancer services.
- Acts like a **mock cloud provider** — assigns a local IP (usually `127.0.0.1`).
- Terminal must stay open while the tunnel is active.
- Requires admin/sudo privileges on some systems.

---

## kubectl — Core Commands

kubectl is the CLI tool for talking to Kubernetes.

### Syntax pattern

```bash
kubectl <action> <resource-type> <resource-name> [flags]
```

Examples:
```bash
kubectl get pods                     # List all pods
kubectl get deployment service-a     # Get a specific deployment
kubectl delete pod my-pod-abc123     # Delete a specific pod
kubectl apply -f file.yaml          # Create/update from YAML
```

---

## kubectl — View Resources

| Command | What It Shows |
|---------|-------------- |
| `kubectl get pods` | List all Pods (name, status, restarts, age) |
| `kubectl get services` | List all Services (type, cluster-ip, ports) |
| `kubectl get deployments` | List all Deployments (ready, up-to-date, available) |
| `kubectl get all` | List Pods, Services, Deployments, ReplicaSets — everything |
| `kubectl get nodes` | List cluster nodes |
| `kubectl get namespaces` | List all namespaces |

### Detailed info

```bash
kubectl describe pod <pod-name>            # Full details about a Pod
kubectl describe deployment <deploy-name>  # Full details about a Deployment
kubectl describe service <service-name>    # Full details about a Service
```

### Output formats

```bash
kubectl get pods -o wide          # Extra columns (node, IP)
kubectl get pods -o yaml          # Full YAML output
kubectl get pods -o json          # Full JSON output
kubectl get pods --watch          # Live updating list (Ctrl+C to stop)
```

### Filter by label

```bash
kubectl get pods -l app=service-a        # Only pods with label app=service-a
kubectl get services -l app=service-b    # Only services with label app=service-b
```

---

## kubectl — Create & Update Resources

### `kubectl apply`

```bash
kubectl apply -f <file.yaml>        # Create or update from a single file
kubectl apply -f <directory>/       # Create or update ALL yaml files in a directory
```

- If the resource doesn't exist → **creates** it.
- If the resource already exists → **updates** it (last apply wins).
- `-f` means "file" — you can point to a file or a directory.

```bash
# Examples from this project:
kubectl apply -f k8s/                              # Apply all 4 YAML files at once
kubectl apply -f k8s/service-a-deployment.yaml     # Apply only one file
```

### `kubectl create`

```bash
kubectl create deployment nginx --image=nginx     # Quick one-liner (no YAML needed)
kubectl create service nodeport nginx --tcp=80:80 # Create service without YAML
```

The difference: `apply` is declarative (uses YAML files, idempotent). `create` is imperative (one-time command, errors if already exists).

### `kubectl rollout restart`

```bash
kubectl rollout restart deployment service-a
```

- **Forces all Pods to restart** using the latest image.
- Creates new Pods, terminates old ones (rolling restart).
- Use this after rebuilding a Docker image to pick up changes.

---

## kubectl — Delete Resources

| Command | What It Does |
|---------|-------------|
| `kubectl delete pod <pod-name>` | Delete a specific Pod. If managed by Deployment, a new one auto-spawns. |
| `kubectl delete deployment <name>` | Delete Deployment AND all its Pods. Stays deleted. |
| `kubectl delete service <name>` | Delete a Service (network access removed). |
| `kubectl delete -f k8s/` | Delete ALL resources defined in the k8s/ directory. |
| `kubectl delete all --all` | Delete everything in the current namespace. Nuclear option. |

### Important: Pod deletion vs Deployment deletion

```bash
# This just restarts the Pod (Deployment creates a new one)
kubectl delete pod service-a-789df494f-vwtqf

# This actually stops the app (no new Pod will be created)
kubectl delete deployment service-a
```

Always use `kubectl delete deployment` to truly stop an app.

---

## kubectl — Debugging & Logs

### View logs

```bash
kubectl logs <pod-name>                          # Logs from a Pod
kubectl logs deployment/service-a                # Logs from a Deployment (picks a Pod for you)
kubectl logs <pod-name> -f                       # Follow/stream logs in real-time (like tail -f)
kubectl logs <pod-name> --previous               # Logs from the PREVIOUS crashed container
kubectl logs <pod-name> -c <container-name>      # Logs from a specific container (multi-container Pod)
```

### Describe (detailed info)

```bash
kubectl describe pod <pod-name>       # Events, status, conditions, IP, node, etc.
kubectl describe deployment <name>    # Scaling events, rollout status
kubectl describe service <name>       # Endpoints, selector, ports
```

### Check events

```bash
kubectl get events                              # Recent cluster events
kubectl get events --sort-by='.lastTimestamp'    # Sorted by time
```

---

## kubectl — Scaling

```bash
kubectl scale deployment service-a --replicas=3     # Scale UP to 3 Pods
kubectl scale deployment service-a --replicas=1     # Scale DOWN to 1 Pod
kubectl scale deployment service-a --replicas=0     # Scale to ZERO (stops all Pods)
```

Scaling to 0 is effectively a "stop" without deleting the Deployment.

---

## kubectl — Port Forwarding

An **alternative** to `minikube service` — forward a local port directly to a Pod or Service:

```bash
# Forward localhost:8080 to Pod's port 3001
kubectl port-forward pod/service-a-789df494f-vwtqf 8080:3001

# Forward localhost:8080 to Service's port 3001
kubectl port-forward service/service-a 8080:3001

# Forward localhost:8080 to Deployment (picks a Pod)
kubectl port-forward deployment/service-a 8080:3001
```

The `service/`, `pod/`, `deployment/` prefix tells kubectl **which resource type** you mean:
- `service/service-a` → the Service named "service-a"
- `pod/service-a-xyz` → a specific Pod
- `deployment/service-a` → the Deployment (kubectl picks a Pod for you)
- `svc/` is shorthand for `service/`

Then open `http://localhost:8080/hello` in your browser.

**This works without NodePort** — you can port-forward to a ClusterIP service too. Terminal must stay open.

**To stop:** Press `Ctrl+C` in the terminal.

---

## kubectl — Exec Into Containers

Run commands inside a running container (like SSH):

```bash
# Open a shell inside the container
kubectl exec -it <pod-name> -- /bin/sh

# Run a single command
kubectl exec <pod-name> -- ls /app

# Check if another service is reachable from inside the cluster
kubectl exec <pod-name> -- curl http://service-b:3000/message
```

Useful for debugging network issues between services.

---

## Docker Build Commands

```bash
# Build an image from a Dockerfile
docker build -t <image-name>:<tag> <path-to-dockerfile-directory>

# Examples:
docker build -t service-a:latest ./service-a
docker build -t service-b:latest ./service-b

# List local images
docker images

# Remove an image
docker rmi service-a:latest
```

### Important: Build in the right Docker context

If using Minikube with Docker driver, you need images INSIDE minikube's Docker:

```bash
eval $(minikube docker-env)             # Switch to minikube's Docker
docker build -t service-a ./service-a   # Image is now inside minikube
```

Without `eval $(minikube docker-env)`, the image is built in your local Docker and minikube can't see it.

---

## Full Workflow — Deploy From Scratch

```bash
# 1. Start the cluster
minikube start

# 2. Point Docker to minikube's Docker daemon
eval $(minikube docker-env)

# 3. Build Docker images (inside minikube)
docker build -t service-a:latest ./service-a
docker build -t service-b:latest ./service-b

# 4. Deploy everything to Kubernetes
kubectl apply -f k8s/

# 5. Verify everything is running
kubectl get pods
kubectl get services
kubectl get deployments

# 6. Access the service
minikube service service-a
# OR
kubectl port-forward service/service-a 8080:3001
# Then open http://localhost:8080/hello
```

---

## Full Workflow — Update Code Changes

After editing source code (e.g., `index.js`):

```bash
# 1. Make sure you're using minikube's Docker
eval $(minikube docker-env)

# 2. Rebuild the Docker image
docker build -t service-a:latest ./service-a

# 3. Force Kubernetes to use the new image (pick ONE option):

# Option A: Restart the deployment (rolling restart)
kubectl rollout restart deployment service-a

# Option B: Delete the pod (Deployment creates a new one)
kubectl delete pod <pod-name>

# Option C: Delete & re-apply
kubectl delete -f k8s/service-a-deployment.yaml
kubectl apply -f k8s/service-a-deployment.yaml

# 4. Verify the new Pod is running
kubectl get pods

# 5. Check logs to confirm new code is running
kubectl logs deployment/service-a
```

---

## Accessing Your Service — All Methods

### Method 1: `minikube service` (recommended for Docker driver on Windows)

```bash
minikube service service-a
```
- Creates a tunnel and opens browser
- Terminal must stay open
- URL changes each time (random port)

### Method 2: `kubectl port-forward`

```bash
kubectl port-forward service/service-a 8080:3001
```
- Forward localhost:8080 → service port 3001
- Terminal must stay open
- Works with any service type (even ClusterIP)
- Open `http://localhost:8080/hello`

### Method 3: Direct minikube IP (no Docker driver)

```bash
minikube ip
# Returns something like 192.168.49.2
```
Then open `http://192.168.49.2:30080/hello`

> **Note:** This may NOT work with Docker driver on Windows. Use Method 1 or 2 instead.

### Method 4: NodePort on localhost (Docker Desktop Kubernetes)

If using Docker Desktop's built-in Kubernetes (not Minikube):
```
http://localhost:30080/hello
```
This works directly because Docker Desktop maps node ports to localhost.

---

## Quick Reference Card

```
minikube start                              # Start cluster
eval $(minikube docker-env)                 # Use minikube's Docker
docker build -t <name> <path>              # Build image
kubectl apply -f k8s/                       # Deploy everything
kubectl get pods|services|deployments       # Check status
kubectl logs deployment/<name>              # View logs
kubectl rollout restart deployment <name>   # Redeploy after image rebuild
kubectl delete -f k8s/                      # Tear down everything
kubectl port-forward svc/<name> 8080:3001   # Access service locally
kubectl exec -it <pod> -- /bin/sh           # Shell into container
kubectl scale deployment <name> --replicas=N  # Scale up/down
minikube service <name>                     # Open service (Windows Docker driver)
minikube stop                               # Pause cluster
minikube delete                             # Destroy cluster
```
