# Kubernetes (K8s) — Complete Beginner's Guide

> A cynical but thorough guide. Because someone has to explain this properly.

---

## Table of Contents

- [What is Kubernetes?](#what-is-kubernetes)
- [Core Concepts](#core-concepts)
- [Cluster Architecture](#cluster-architecture)
- [YAML File Structure](#yaml-file-structure)
- [Resource Types (kind)](#resource-types-kind)
- [Deployments](#deployments)
- [Services](#services)
- [Pods](#pods)
- [Labels & Selectors](#labels--selectors)
- [Port Mapping (The 3 Ports)](#port-mapping-the-3-ports)
- [Service Types](#service-types)
- [How Resources Are Identified](#how-resources-are-identified)
- [Installing Kubernetes Locally](#installing-kubernetes-locally)
- [What is Minikube? (Deep Dive)](#what-is-minikube-deep-dive)
- [How Container Networking Actually Works (Network Namespaces)](#how-container-networking-actually-works-network-namespaces)

---

## What is Kubernetes?

Kubernetes (K8s) is open-source software for managing containers across multiple machines. Originally built by Google, now maintained by the CNCF. It automates deployment, scaling, and management of containerized applications.

**In plain terms:** You give Kubernetes a description of what you want running (YAML files), and it makes it happen — starting containers, restarting crashed ones, scaling up/down, and routing network traffic.

---

## Core Concepts

| Concept | What It Is |
|---------|-----------|
| **Cluster** | A group of machines running Kubernetes |
| **Node** | A single machine in the cluster |
| **Pod** | Smallest deployable unit — runs one or more containers |
| **Deployment** | Manages Pods — handles scaling, updates, self-healing |
| **Service** | Stable network endpoint to access Pods |
| **Namespace** | Virtual cluster for isolating resources |
| **Label** | Key-value tag attached to resources |
| **Selector** | Query to find resources by label |

---

## Cluster Architecture

A Kubernetes cluster consists of machines with Kubernetes software installed on them.

```
┌─────────────────── CLUSTER ──────────────────────┐
│                                                    │
│  CONTROL PLANE (Master Node)                       │
│  ├── kube-apiserver        ← API gateway           │
│  │   Receives all commands (kubectl → here)        │
│  ├── etcd                  ← Database              │
│  │   Stores all cluster state                      │
│  ├── controller-manager    ← Watches & acts        │
│  │   Contains controllers for each resource type   │
│  └── scheduler             ← Assigns Pods to nodes │
│      Decides WHICH node runs each Pod              │
│                                                    │
│  WORKER NODE(S)                                    │
│  ├── kubelet               ← Node agent            │
│  │   Manages containers on this node               │
│  ├── kube-proxy            ← Network proxy         │
│  │   Handles networking rules                      │
│  └── container runtime     ← Docker/containerd     │
│      Actually runs the containers                  │
│                                                    │
└────────────────────────────────────────────────────┘
```

### What happens when you run `kubectl apply`

```
You (kubectl apply -f file.yaml)
  │
  ▼
kubectl (CLI on YOUR machine) ─── sends HTTP request ───►
  │
  ▼
kube-apiserver ─── validates YAML, stores in ───►
  │
  ▼
etcd (database) ─── controller-manager watches for changes ───►
  │
  ▼
controller-manager ─── creates ReplicaSet/Pods ───►
  │
  ▼
scheduler ─── assigns Pod to a node ───►
  │
  ▼
kubelet (on the node) ─── tells container runtime to pull image & start container
  │
  ▼
Container Runtime (Docker/containerd) ─── runs your app
```

### Can Kubernetes run on Windows?

**No.** Kubernetes requires a Linux kernel. On Windows/Mac, tools like Docker Desktop or Minikube create a lightweight Linux VM and run Kubernetes inside it.

| OS | Native K8s? | How to run locally |
|----|------------|-------------------|
| Linux | Yes | `kubeadm init` or Minikube |
| Windows | No (needs Linux VM) | Docker Desktop or Minikube |
| Mac | No (needs Linux VM) | Docker Desktop or Minikube |

---

## YAML File Structure

**Every** Kubernetes resource follows the same four top-level fields:

```yaml
apiVersion:   # Which API group/version to use
kind:         # What type of resource (Deployment, Service, Pod, etc.)
metadata:     # Identity — name, namespace, labels, annotations
spec:         # The desired state — what you want Kubernetes to do
```

That's it. Nothing else at the top level. The `kind` determines what goes inside `spec`.

**Kubernetes does NOT care about filenames.** You could name your file `banana.yaml` — it only reads the content and checks `kind` inside. File naming conventions are just for humans.

You can put **multiple resources** in one file separated by `---`:

```yaml
kind: Deployment
metadata:
  name: my-app
spec: ...
---
kind: Service
metadata:
  name: my-app
spec: ...
```

---

## Resource Types (kind)

| Kind | Purpose |
|------|---------|
| `Pod` | Single container/group of containers (rarely created directly) |
| `Deployment` | Manages Pods — rolling updates, scaling, self-healing |
| `Service` | Network access to a set of Pods |
| `ReplicaSet` | Ensures N copies of a Pod (managed by Deployment automatically) |
| `StatefulSet` | Like Deployment but for stateful apps (databases) |
| `DaemonSet` | Runs one Pod on every node |
| `Job` | Run-once task |
| `CronJob` | Scheduled recurring task |
| `ConfigMap` | Store config as key-value pairs |
| `Secret` | Store sensitive data (passwords, tokens) |
| `Ingress` | HTTP routing / load balancing from outside |
| `PersistentVolume` | Storage resource |
| `PersistentVolumeClaim` | Request for storage |
| `Namespace` | Virtual cluster isolation |
| `ServiceAccount` | Identity for Pods |
| `HorizontalPodAutoscaler` | Auto-scale based on metrics |
| `NetworkPolicy` | Firewall rules between Pods |

---

## Deployments

A Deployment is the most common way to run your app. It creates Pods, manages them, and handles updates.

### Anatomy of a Deployment YAML

```yaml
apiVersion: apps/v1              # Deployments API version
kind: Deployment                 # Resource type
metadata:
  name: my-app                   # Deployment's unique name (its identity)
spec:                            # ← Deployment's own spec
  replicas: 1                    # Number of Pod copies to run
  selector:
    matchLabels:
      app: my-app                # "Manage Pods with this label"
  template:                      # ← Pod blueprint starts here
    metadata:
      labels:
        app: my-app              # Label stamped on each Pod (must match selector)
    spec:                        # ← Pod's spec (what runs inside)
      containers:
      - name: my-app             # Container name
        image: my-app:latest     # Docker image to run
        imagePullPolicy: Never   # Never pull from registry (local dev)
        ports:
        - containerPort: 3000    # Port the app listens on
```

### Two `metadata` blocks

- **Top-level `metadata.name`** — The Deployment's own name. Used in CLI commands like `kubectl get deployment my-app`.
- **`template.metadata.labels`** — Labels stamped on Pods created by this Deployment. Used by the selector.

### Two `spec` blocks

- **Outer `spec`** — Deployment config (replicas, selector, template)
- **Inner `spec` (under template)** — Pod config (containers, ports, volumes)

Everything under `template:` belongs to the **Pod**. Everything outside `template:` (but inside outer `spec`) belongs to the **Deployment**.

### Required Deployment fields

| Field | Required? | Purpose |
|-------|-----------|---------|
| `apiVersion` | Yes | API group |
| `kind` | Yes | Resource type |
| `metadata.name` | Yes | Deployment identity |
| `spec.selector` | Yes | Find Pods |
| `spec.template` | Yes | Pod blueprint |
| `spec.template.metadata.labels` | Yes | Must match selector |
| `spec.template.spec.containers` | Yes | What to run |

### Common optional fields

| Field | Purpose |
|-------|---------|
| `replicas` | Pod count (default: 1) |
| `strategy` | Update strategy (RollingUpdate or Recreate) |
| `resources` | CPU/memory requests and limits |
| `env` | Environment variables |
| `ports` | Exposed ports |
| `livenessProbe` | Health check — is the container alive? |
| `readinessProbe` | Health check — is the container ready for traffic? |
| `volumes` | Storage mounts |

---

## Services

A Service is a stable network endpoint for a set of Pods. Pods are ephemeral (they die and get new IPs), but a Service provides a consistent way to reach them.

### Anatomy of a Service YAML

```yaml
apiVersion: v1               # Core API version
kind: Service
metadata:
  name: my-app               # Service name (also used as DNS name inside cluster)
spec:
  selector:
    app: my-app               # Route traffic to Pods with this label
  ports:
    - protocol: TCP
      port: 3000              # Port the Service listens on (cluster-internal)
      targetPort: 3000        # Port on the Pod (must match app's listen port)
      nodePort: 30080         # Port on the machine (only for NodePort type)
  type: NodePort              # How the service is exposed
```

---

## Pods

A Pod is the smallest deployable unit. It runs one or more containers that share:
- Network (same IP, localhost communication)
- Storage (shared volumes)
- Lifecycle (start/stop together)

You rarely create Pods directly — Deployments create and manage them for you.

### Pod naming

Pods created by Deployments get auto-generated names:
```
my-app                    ← Deployment name
my-app-7f8b9c6d4          ← ReplicaSet (auto suffix)
my-app-7f8b9c6d4-x2kp    ← Pod (auto suffix)
```

---

## Labels & Selectors

Labels are key-value tags on resources. Selectors are queries to find resources by label.

### How they connect everything

```
Deployment
  selector: app=my-app        ← "I manage Pods with this label"
      │
      ▼
  Pod (label: app=my-app)     ← Created by Deployment, tagged with label
      ▲
      │
Service
  selector: app=my-app        ← "I route traffic to Pods with this label"
```

The label (`app: my-app`) is the **shared key** across Deployment → Pod → Service.

### Rules

- `selector.matchLabels` in Deployment **must match** `template.metadata.labels`
- `selector` in Service routes to Pods with matching labels
- Labels are used from **the very first deployment**, not just on updates

---

## Port Mapping (The 3 Ports)

Three different ports exist at different layers. Understanding them is critical.

### The Traffic Flow

```
Outside world (your browser)
    │
    │  localhost:30080        ← nodePort (your machine)
    ▼
  Service
    │
    │  service-name:3000      ← port (inside cluster)
    ▼
  Pod
    │
    │  container:3000         ← targetPort (your app)
    ▼
  index.js listening on 3000
```

| Port | Where | What | Who uses it |
|------|-------|------|------------|
| `nodePort` | Your machine | External access (30000-32767 range) | Your browser, external users |
| `port` | Service (inside cluster) | Cluster-internal entry point | Other services/Pods in the cluster |
| `targetPort` | Pod/Container | Must match what your app actually `listen()`s on | The Service routing to your app |

### Where Each Port Is Defined (And Whether It Matters)

Ports appear in **4 different places** across your project files. Here's which ones actually do something:

| Where | Example | Functional? | Must match app? |
|-------|---------|-------------|-----------------|
| **index.js** `app.listen(3001)` | The app's actual listen port | **YES — this is the real port** | This IS the source of truth |
| **Dockerfile** `EXPOSE 3001` | Documentation in the image | **NO — purely informational** | Should match for clarity, but doesn't affect anything |
| **Deployment YAML** `containerPort: 3001` | Tells K8s what port the container uses | **Mostly informational** | Should match for clarity |
| **Service YAML** `targetPort: 3001` | Where the Service sends traffic | **YES — functional** | **MUST match app.listen() or traffic won't reach it** |
| **Service YAML** `port: 3001` | Where the Service listens (cluster-internal) | **YES — functional** | Can be different from app port |
| **Service YAML** `nodePort: 30080` | External machine port | **YES — functional** | Completely independent (30000-32767) |

### Key rules:

1. `targetPort` **MUST** equal `app.listen(PORT)` — or traffic goes nowhere
2. `port` can be anything — it's the cluster-internal address other services use
3. `nodePort` is independent — only for external access, range 30000-32767
4. `containerPort` and `EXPOSE` are just documentation — nice to have, not required

### What if `targetPort` is not specified?

If you omit `targetPort` in your Service YAML, Kubernetes **defaults it to the same value as `port`**. So if `port: 80` and no `targetPort`, traffic goes to port 80 on the Pod.

---

## Service Types

| Type | Accessible from | Use case |
|------|----------------|----------|
| `ClusterIP` (default) | Inside cluster only | Internal microservices |
| `NodePort` | Outside via `node-ip:port` | Dev/testing, simple external access |
| `LoadBalancer` | External load balancer | Production (cloud providers) |
| `ExternalName` | DNS alias | Pointing to external services |

### ClusterIP

```yaml
type: ClusterIP
# Only other Pods in the cluster can reach this service
# Access via: http://service-name:port
# Kubernetes assigns an internal IP (e.g., 10.103.222.108)
```

- Default type if you don't specify `type:`.
- Other Pods talk to it using the **Service name** as a DNS hostname.
- Example: `http://service-b:3000/message` from inside the cluster.

### NodePort

```yaml
type: NodePort
# Accessible from outside at node-ip:nodePort
# nodePort range: 30000-32767
# Also still accessible inside cluster via ClusterIP
```

- Opens a specific port on every Node (machine) in the cluster.
- The simplest way to access your app from your laptop browser.
- **Important:** NodePort range is restricted to 30000-32767 to avoid conflicts with standard system ports (80, 443, etc.).

### LoadBalancer

```yaml
type: LoadBalancer
# Cloud provider creates a real load balancer (AWS ELB, GCP LB, etc.)
# Gets an actual external IP
```

- You do NOT need to specify a special "loadBalancer port" — just use the standard `port` and `targetPort` fields.
- Because the Load Balancer gets its **own unique public IP**, it can listen on standard ports like 80 or 443 without conflicts.

**Example:**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-lb-service
spec:
  type: LoadBalancer
  selector:
    app: my-web-app
  ports:
    - protocol: TCP
      port: 80          # The external IP will listen on this port!
      targetPort: 8080  # The Pod still listens here
```

### The Secret: LoadBalancer Is a NodePort in Disguise

When you create a LoadBalancer service, Kubernetes **automatically** does three things behind the scenes:

1. Creates the internal `ClusterIP` (port).
2. Allocates a random `nodePort` (30000-32767) on your cluster nodes.
3. Tells the cloud provider's Load Balancer: "Listen on your public IP at port 80 and forward traffic to my cluster nodes on that random nodePort."

```
User Browser
    │
    ▼  http://35.200.10.20:80
External Load Balancer (cloud-assigned IP)
    │
    ▼  Forwards to random nodePort (e.g., 31234)
Cluster Node
    │
    ▼  Kubernetes Service (ClusterIP:80)
Pod (targetPort:8080)
    │
    ▼
Your App
```

### LoadBalancer on Minikube (Local)

If you try `type: LoadBalancer` on local Minikube, the EXTERNAL-IP stays stuck on `<pending>` because your laptop isn't a cloud provider — there's no system to hand out public IPs.

**To make it work locally:**

```bash
minikube tunnel
```

This runs a process that acts like a mock cloud provider, provisioning a local IP (usually `127.0.0.1`) so you can test LoadBalancer services locally. The terminal running `minikube tunnel` must stay open.

---

## How Resources Are Identified

Kubernetes identifies resources by: **`kind` + `name` + `namespace`**

| Scenario | Result |
|----------|--------|
| Same `kind`, different `name` | Two separate resources, both exist |
| Same `kind`, same `name` | One resource — last `apply` wins (overwrites) |
| Different `kind`, same `name` | Two separate resources (Deployment "x" and Service "x" are different) |

---

## Installing Kubernetes Locally

| Tool | Install Method | Start Command |
|------|---------------|---------------|
| **Docker Desktop** | Checkbox in Docker Desktop settings | Automatic |
| **Minikube** | `choco install minikube` or download | `minikube start` |
| **Kind** | `choco install kind` or download | `kind create cluster` |

### Minikube lifecycle

```bash
minikube start       # Start or resume cluster (doesn't create fresh each time)
minikube stop        # Pause the cluster (state is preserved)
minikube delete      # Completely destroy the cluster (fresh start)
minikube status      # Check if cluster is running
```

> **Important:** `minikube start` resumes an existing cluster — it doesn't wipe it clean.
> Old deployments from days ago will still be there. Use `minikube delete` for a fresh start.

### Docker driver on Windows

When using the Docker driver on Windows, minikube runs inside a Docker container with a Linux kernel. 
All Kubernetes components (apiserver, etcd, etc.) run as containers inside that container.

```
Windows
└── Docker Desktop
    └── Minikube container (Linux)
        ├── kube-apiserver (container)
        ├── etcd (container)
        ├── controller-manager (container)
        ├── scheduler (container)
        └── Your Pods (containers)
```

---

## Appendix: Key Terms

| Term | Meaning |
|------|---------|
| **etcd** | Key-value database storing all cluster state |
| **kubelet** | Agent on each node that manages containers |
| **kube-proxy** | Handles network routing on each node |
| **ReplicaSet** | Ensures N Pods are running (managed by Deployment) |
| **Rolling update** | Gradually replace old Pods with new ones |
| **Self-healing** | Auto-restart crashed Pods |
| **Namespace** | Virtual partition of a cluster |
| **Control plane** | The "brain" components (apiserver, etcd, etc.) |
| **Worker node** | Machine that runs your Pods |
| **Network Namespace** | Linux kernel feature that gives each container its own isolated network stack |
| **veth pair** | Virtual network cable connecting a container's namespace to the host bridge |
| **Virtual Bridge** | Hidden network switch inside the host VM connecting all containers |

---

## What is Minikube? (Deep Dive)

### The Correct Mental Model

> Minikube creates a VM (or Docker container), installs the Kubernetes cluster components inside it, and **that action** turns the VM into a Kubernetes cluster.

**Important wording:** You can't say "creates a cluster and installs Kubernetes in it" — because a cluster doesn't exist until Kubernetes is installed. A "cluster" IS machines running Kubernetes. Until the components (kubelet, API server, etc.) are installed and talking to each other, it's just a blank VM.

### The Layer Cake

```
Layer 1 (Bottom):  Your physical laptop/desktop
Layer 2 (Middle):  Virtual environment (VM or Docker container) created by Minikube
Layer 3 (Top):     Kubernetes cluster components running inside that virtual environment
```

### Single-Node Cluster

In production, a Kubernetes cluster has:
- **Master nodes** (the brain) — run control plane components
- **Worker nodes** (the muscle) — run your actual apps

Minikube crams **all of these responsibilities into one single VM**. That one VM acts as both master and worker. This is called a "single-node cluster."

### Multi-Node in Minikube

You CAN have multiple nodes in Minikube. But it does NOT create VMs inside VMs (that's nested virtualization, and it's painful).

```bash
# Create a 3-node cluster
minikube start --nodes=3
```

**How it works depends on the driver:**

| Driver | What gets created for each node |
|--------|-------------------------------|
| **Docker driver** | 3 separate Docker containers on your laptop (lightweight) |
| **VirtualBox driver** | 3 separate VMs on your laptop (heavier) |

```
Docker driver:                    VirtualBox driver:
Your Laptop                       Your Laptop
├── Container 1 = Node 1          ├── VM 1 = Node 1
├── Container 2 = Node 2          ├── VM 2 = Node 2
└── Container 3 = Node 3          └── VM 3 = Node 3
```

They are all separate instances on your host machine, linked together by Minikube to form one cluster.

### `eval $(minikube docker-env)`

This command points your terminal's Docker CLI to **minikube's internal Docker daemon** instead of your local Docker. After running it, any `docker build` creates images inside the minikube VM — which is necessary because `imagePullPolicy: Never` means Kubernetes only looks for images locally inside its own node.

**Only affects the current terminal session.** Open a new terminal = back to local Docker.

---

## How Container Networking Actually Works (Network Namespaces)

This section explains the Linux kernel magic that makes container ports work.

### The "Matrix-Breaking" Question

A container is just an isolated Linux process. It doesn't have a physical network card or a hardware router inside it. **So how does it have its own ports? And why don't they clash with other containers?**

### The Answer: Linux Network Namespaces

When Docker/containerd starts a container, it wraps the process in an isolated bubble called a **Network Namespace**. Inside this bubble, the process gets its own private:

- Loopback interface (`localhost`)
- Virtual network card (usually `eth0`)
- Routing table
- **Port table (0 to 65535)**

The Linux kernel **lies to the process**. The process honestly believes it has its own private operating system with its own private set of ports.

### Why Containers Don't Clash

Every container gets its **own completely isolated Network Namespace**.

**Without containers:** Every process lives in the same room. If Process A takes Port 8080, Process B cannot have it.

**With containers (Namespaces):** The kernel builds isolated, soundproof apartments:

```
Host VM (the apartment building)
│
├── Container 1 (Apartment 1)
│   └── Process binds to port 8080 ← in its own namespace
│
├── Container 2 (Apartment 2)
│   └── Process binds to port 8080 ← in its own namespace (no conflict!)
│
└── Container 3 (Apartment 3)
    └── Process binds to port 8080 ← in its own namespace (no conflict!)
```

Because their network universes are completely separated by the kernel, they have no idea the other exists. Their ports **never conflict** even though they all use 8080.

### How Do Containers Actually Connect?

If they're completely isolated, how does traffic get to them?

Kubernetes creates a hidden **Virtual Network Switch (Bridge)** inside the host VM. It then runs a **virtual network cable** (called a `veth pair`) from the host bridge straight into each container's private namespace.

```
Host VM
├── Virtual Bridge (network switch)
│   ├── veth pair ──── Container 1 (IP: 10.244.0.5, Port 8080)
│   ├── veth pair ──── Container 2 (IP: 10.244.0.6, Port 8080)
│   └── veth pair ──── Container 3 (IP: 10.244.0.7, Port 8080)
```

Every container is assigned its **own unique Internal IP Address** on this virtual network. So when you say a container is "hosted on targetPort 8080," what it actually means:

1. The containerized process is listening on Port 8080 **inside its own namespace**
2. It is only reachable via that container's **unique private IP address** (e.g., `10.244.0.5:8080`)
3. The Kubernetes Service knows this IP and forwards traffic to it

### So where are the ports really?

The ports are managed by the **host VM's Linux kernel**, but the kernel carves up the port space into **isolated partitions (namespaces)** so that each container gets its own independent set of 65,535 ports. The port is not "exposed outside" the container — it lives in the container's private network namespace, and only Kubernetes (via the virtual bridge) knows how to route traffic to it.

### Why targetPort must match app.listen()

```
Your app says:    app.listen(3001)   ← Process binds to port 3001 in its namespace
K8s sends to:     targetPort: 3001   ← Service sends traffic to port 3001 in that namespace
                              ↓
                        They must match!
```

If they don't match, the Service sends traffic to a port where nothing is listening, and you get a connection refused error.
