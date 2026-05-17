# Kubernetes Microservices Demo

A learning project demonstrating two Node.js microservices communicating with each other inside a Kubernetes cluster using Minikube.

---

## Architecture

```
Browser → localhost:30080/hello → Service A (NodePort) → Service B (ClusterIP) → Response
```

- **Service A** — External-facing. Receives requests and calls Service B internally.
- **Service B** — Internal only. Returns data to Service A via cluster DNS.

```
┌─────────────────────────────────────────┐
│  Kubernetes Cluster (Minikube)          │
│                                         │
│  Service A (NodePort :30080)            │
│    → Calls http://service-b:3000        │
│                                         │
│  Service B (ClusterIP)                  │
│    → Returns { message: "Hello..." }    │
└─────────────────────────────────────────┘
```

---

## Project Structure

```
├── k8s/                          # Kubernetes manifests
│   ├── service-a-deployment.yaml
│   ├── service-a-service.yaml
│   ├── service-b-deployment.yaml
│   └── service-b-service.yaml
├── service-a/                    # Service A source (Express, port 3001)
│   ├── Dockerfile
│   ├── index.js
│   └── package.json
├── service-b/                    # Service B source (Express, port 3000)
│   ├── Dockerfile
│   ├── index.js
│   └── package.json
└── docs/copilot-helpers/         # Learning documentation
    ├── kubernetes-guide.md       # Generic K8s concepts
    ├── project-walkthrough.md    # Project-specific walkthrough
    └── commands-reference.md     # All commands reference
```

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)

---

## Quick Start

```bash
# 1. Start minikube
minikube start

# 2. Point Docker to minikube's Docker daemon
eval $(minikube docker-env)

# 3. Build images
docker build -t service-a:latest ./service-a
docker build -t service-b:latest ./service-b

# 4. Deploy to Kubernetes
kubectl apply -f k8s/

# 5. Verify pods are running
kubectl get pods

# 6. Access the app
minikube service service-a
# Or: kubectl port-forward service/service-a 8080:3001
# Then open http://localhost:8080/hello
```

---

## API Endpoints

### Service A

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/hello` | GET | Returns combined response from Service A + Service B |

**Example response:**
```json
{
  "fromServiceA": "Hello from Service A!",
  "fromServiceB": {
    "message": "Hello from Service B!"
  }
}
```

### Service B (internal only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/message` | GET | Returns `{ message: "Hello from Service B!" }` |

---

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
