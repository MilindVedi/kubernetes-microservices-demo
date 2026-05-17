# Project Walkthrough — Two Microservices on Kubernetes

> How this project works, what each file does, and how the services talk to each other.

---

## Table of Contents

- [Project Structure](#project-structure)
- [How The Services Interact](#how-the-services-interact)
- [Service A — The External-Facing Service](#service-a--the-external-facing-service)
- [Service B — The Internal Backend](#service-b--the-internal-backend)
- [Kubernetes YAML Files](#kubernetes-yaml-files)
- [Dockerfiles](#dockerfiles)
- [Port Mapping In This Project](#port-mapping-in-this-project)
- [The Complete Request Flow](#the-complete-request-flow)
- [Common Issues We Encountered](#common-issues-we-encountered)

---

## Project Structure

```
k8s-learning/
├── k8s/                              ← Kubernetes manifests
│   ├── service-a-deployment.yaml     ← Deployment for Service A
│   ├── service-a-service.yaml        ← Service (network) for Service A
│   ├── service-b-deployment.yaml     ← Deployment for Service B
│   └── service-b-service.yaml        ← Service (network) for Service B
├── service-a/                        ← Service A source code
│   ├── Dockerfile                    ← Docker build instructions
│   ├── index.js                      ← Express app (port 3001)
│   └── package.json                  ← Node.js dependencies
├── service-b/                        ← Service B source code
│   ├── Dockerfile                    ← Docker build instructions
│   ├── index.js                      ← Express app (port 3000)
│   └── package.json                  ← Node.js dependencies
└── docs/
    └── copilot-helpers/              ← Documentation
```

---

## How The Services Interact

```
Browser (you)
    │
    │  http://localhost:30080/hello
    ▼
┌─────────────────────────────────────────┐
│  Kubernetes Cluster (Minikube)          │
│                                         │
│  ┌───────────────────────┐              │
│  │ Service A (NodePort)  │              │
│  │ Port: 30080 → 3001   │              │
│  │  ┌─────────────────┐ │              │
│  │  │ Pod: service-a   │ │              │
│  │  │ index.js @ 3001  │──────┐        │
│  │  └─────────────────┘ │     │        │
│  └───────────────────────┘     │        │
│                                │        │
│       http://service-b:3000/message     │
│                                │        │
│  ┌───────────────────────┐     │        │
│  │ Service B (ClusterIP) │◄────┘        │
│  │ Port: 3000 → 3000    │              │
│  │  ┌─────────────────┐ │              │
│  │  │ Pod: service-b   │ │              │
│  │  │ index.js @ 3000  │ │              │
│  │  └─────────────────┘ │              │
│  └───────────────────────┘              │
│                                         │
└─────────────────────────────────────────┘
```

### Key takeaways:
- **Service A** is exposed outside the cluster (NodePort 30080) — you can hit it from your browser
- **Service B** is internal only (ClusterIP) — only other Pods inside the cluster can reach it
- **Service A calls Service B** using the Kubernetes DNS name `service-b` on port 3000
- **Service B returns data** which Service A combines into the response

---

## Service A — The External-Facing Service

### `service-a/index.js`

```javascript
app.get('/hello', async (req, res) => {
    const response = await axios.get('http://service-b:3000/message')
    res.json({
        fromServiceA: "Hello from Service A!",
        fromServiceB: response.data
    })
});
app.listen(3001, () => { ... })
```

- **Endpoint:** `GET /hello`
- **Port:** 3001
- **What it does:** When someone hits `/hello`, it internally calls Service B at `http://service-b:3000/message`, gets the response, and combines it with its own message.
- **No root `/` endpoint** — accessing `http://localhost:30080/` gives nothing. You must use `/hello`.

### Why `http://service-b:3000`?

Inside a Kubernetes cluster, services can find each other **by name**. Kubernetes has an internal DNS that resolves `service-b` to the ClusterIP of the service-b Service (e.g., `10.103.222.108`). Port `3000` is the `port` defined in `service-b-service.yaml`.

### `service-a/package.json`

```json
{
  "dependencies": {
    "axios": "^1.6.0",    // HTTP client — used to call Service B
    "express": "^4.18.2"  // Web framework — handles HTTP requests
  }
}
```

Service A needs `axios` because it makes HTTP requests to Service B. Service B doesn't need `axios` because it only receives requests.

---

## Service B — The Internal Backend

### `service-b/index.js`

```javascript
app.get("/message", (req, res) => {
    res.json({ message: "Hello from Service B!" });
})
app.listen(3000, () => { ... })
```

- **Endpoint:** `GET /message`
- **Port:** 3000
- **What it does:** Simply returns `{ message: "Hello from Service B!" }`
- **Cannot be accessed from outside** — it's ClusterIP type. Only Service A (or other Pods) can call it.

### `service-b/package.json`

```json
{
  "dependencies": {
    "express": "^4.18.2"  // Web framework only — no axios needed
  }
}
```

---

## Kubernetes YAML Files

### `k8s/service-a-deployment.yaml`

```yaml
apiVersion: apps/v1              # Deployments API version
kind: Deployment                 # Creates & manages Pods
metadata:
  name: service-a                # kubectl get deployment service-a
spec:
  replicas: 1                    # Run 1 Pod
  selector:
    matchLabels:
      app: service-a             # "I manage Pods labelled app=service-a"
  template:                      # Pod blueprint
    metadata:
      labels:
        app: service-a           # Tag each Pod with this label
    spec:
      containers:
      - name: service-a
        image: service-a:latest  # Local Docker image
        imagePullPolicy: Never   # Don't pull from Docker Hub
        ports:
        - containerPort: 3001    # App listens on 3001
```

### `k8s/service-a-service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: service-a
spec:
  selector:
    app: service-a               # Route to Pods with label app=service-a
  ports:
    - protocol: TCP
      port: 3001                 # Service listens on 3001 (cluster-internal)
      targetPort: 3001           # Forward to Pod port 3001
      nodePort: 30080            # External access on localhost:30080
  type: NodePort                 # Accessible from outside the cluster
```

### `k8s/service-b-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: service-b
spec:
  replicas: 1
  selector:
    matchLabels:
      app: service-b
  template:
    metadata:
      labels:
        app: service-b
    spec:
      containers:
      - name: service-b
        image: service-b:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 3000    # App listens on 3000
```

### `k8s/service-b-service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: service-b                # This name becomes the DNS hostname
spec:
  selector:
    app: service-b
  ports:
    - protocol: TCP
      port: 3000                 # Service A calls service-b:3000
      targetPort: 3000           # Forwards to Pod port 3000
  type: ClusterIP                # Only accessible inside the cluster
```

**Why ClusterIP for Service B?** Because Service B is a backend service — only Service A should talk to it. There's no reason to expose it to the outside world.

---

## Dockerfiles

Both Dockerfiles follow the same pattern:

```dockerfile
FROM node:18         # Base image with Node.js
WORKDIR /app         # Set working directory
COPY package*.json . # Copy dependency files first (layer caching)
RUN npm install      # Install dependencies
COPY . .             # Copy app source code
EXPOSE <port>        # Documentation only (doesn't actually do anything)
CMD ["npm", "start"] # Run "node index.js" when container starts
```

### Layer caching trick

```dockerfile
COPY package*.json ./   # Copied FIRST
RUN npm install          # Cached if package.json didn't change
COPY . .                 # Source code — changes often, after npm install
```

By copying `package.json` before the source code, Docker reuses the `npm install` layer if dependencies haven't changed. This makes rebuilds faster.

---

## Port Mapping In This Project

### Where Every Port Comes From — Service A

Each port is defined in a specific file. Here's where they live and what they do:

```
                      ┌──────────────────────────────────┐
                      │ service-a/index.js               │
                      │   app.listen(3001)               │ ← SOURCE OF TRUTH
                      │   This is the REAL port           │
                      └──────────┬───────────────────────┘
                                 │ must match
                      ┌──────────▼───────────────────────┐
                      │ service-a/Dockerfile              │
                      │   EXPOSE 3001                     │ ← Just documentation
                      │   (does nothing functionally)     │    (can be wrong, won't break)
                      └──────────────────────────────────┘

                      ┌──────────────────────────────────┐
                      │ k8s/service-a-deployment.yaml     │
                      │   containerPort: 3001             │ ← Informational for K8s
                      │   (should match app.listen)       │
                      └──────────┬───────────────────────┘
                                 │ must match
                      ┌──────────▼───────────────────────┐
                      │ k8s/service-a-service.yaml        │
                      │   targetPort: 3001                │ ← MUST match app.listen(3001)
                      │   port: 3001                      │ ← Cluster-internal access
                      │   nodePort: 30080                 │ ← External access (browser)
                      └──────────────────────────────────┘
```

| File | Field | Value | Functional? |
|------|-------|-------|-------------|
| `service-a/index.js` | `app.listen(3001)` | 3001 | **YES — the real port** |
| `service-a/Dockerfile` | `EXPOSE 3001` | 3001 | No — just a note |
| `k8s/service-a-deployment.yaml` | `containerPort` | 3001 | Informational |
| `k8s/service-a-service.yaml` | `targetPort` | 3001 | **YES — must match app.listen** |
| `k8s/service-a-service.yaml` | `port` | 3001 | **YES — cluster-internal** |
| `k8s/service-a-service.yaml` | `nodePort` | 30080 | **YES — external access** |

### Where Every Port Comes From — Service B

| File | Field | Value | Functional? |
|------|-------|-------|-------------|
| `service-b/index.js` | `app.listen(3000)` | 3000 | **YES — the real port** |
| `service-b/Dockerfile` | `EXPOSE 3000` | 3000 | No — just a note |
| `k8s/service-b-deployment.yaml` | `containerPort` | 3000 | Informational |
| `k8s/service-b-service.yaml` | `targetPort` | 3000 | **YES — must match app.listen** |
| `k8s/service-b-service.yaml` | `port` | 3000 | **YES — this is what service-a uses** |
| `k8s/service-b-service.yaml` | `nodePort` | N/A | Not applicable (ClusterIP) |

### How Service A connects to Service B via port

```javascript
// In service-a/index.js:
axios.get('http://service-b:3000/message')
//                          ^^^^
//                          This 3000 is the SERVICE port (port:) from
//                          k8s/service-b-service.yaml, NOT the app port.
//                          (In this case they happen to be the same, but
//                          they could be different.)
```

### Traffic flow diagrams

**Service A (external access):**
```
Browser → localhost:30080 → Service (port 3001) → Pod (targetPort 3001) → index.js listen(3001)
              │                    │                       │                      │
          nodePort             Service port           targetPort            app.listen()
          (external)          (cluster-internal)       (Pod)                 (actual code)
```

**Service B (internal only):**
```
Service A → http://service-b:3000 → Service (port 3000) → Pod (targetPort 3000) → index.js listen(3000)
                     │                      │                      │                      │
              K8s DNS name            Service port             targetPort            app.listen()
```

### Port summary table

| | index.js | Dockerfile EXPOSE | containerPort | targetPort | port (Service) | nodePort |
|---|---|---|---|---|---|---|
| **Service A** | 3001 | 3001 | 3001 | 3001 | 3001 | 30080 |
| **Service B** | 3000 | 3000 | 3000 | 3000 | 3000 | N/A (ClusterIP) |

---

## The Complete Request Flow

When you open `http://localhost:30080/hello` in your browser:

```
1. Browser sends GET to localhost:30080
2. Minikube tunnel forwards to nodePort 30080
3. Service A (NodePort) receives on port 3001
4. Service routes to Pod's targetPort 3001
5. service-a/index.js handles GET /hello
6. index.js calls http://service-b:3000/message via axios
7. K8s DNS resolves "service-b" → ClusterIP 10.103.222.108
8. Service B receives on port 3000
9. Service routes to Pod's targetPort 3000
10. service-b/index.js handles GET /message
11. Returns { message: "Hello from Service B!" }
12. service-a/index.js combines both responses
13. Returns to browser:
    {
      "fromServiceA": "Hello from Service A!",
      "fromServiceB": { "message": "Hello from Service B!" }
    }
```

---

## Common Issues We Encountered

### 1. Port mismatch

**Problem:** `index.js` listens on port 3001 but `containerPort` and `targetPort` were set to 3000.

**Result:** Traffic was sent to port 3000 but nothing was listening there. App appeared unreachable.

**Fix:** Make sure `app.listen(PORT)`, `containerPort`, and `targetPort` all match.

### 2. Malformed URL

**Problem:** `http:service-b:3000/message` (missing `//` after `http:`)

**Fix:** `http://service-b:3000/message`

### 3. No root endpoint

**Problem:** Accessing `http://localhost:30080/` returns nothing because there's no `app.get('/')` handler.

**Fix:** Either add a root handler or remember to use `/hello`.

### 4. Image not rebuilt after code changes

**Problem:** Changed `index.js` but the Pod still runs the old code.

**Reason:** Kubernetes uses the cached Docker image (since `imagePullPolicy: Never`). You must rebuild the image AND restart the Pod.

**Fix:**
```bash
docker build -t service-a:latest ./service-a    # Rebuild image
kubectl rollout restart deployment service-a      # Force Pod to use new image
```

### 5. `kubectl logs service-a` fails

**Problem:** "pods service-a not found" — because `service-a` is a Deployment name, not a Pod name.

**Fix:** Use the full Pod name or reference the Deployment:
```bash
kubectl logs deployment/service-a
kubectl logs service-a-789df494f-vwtqf    # Full Pod name from kubectl get pods
```
