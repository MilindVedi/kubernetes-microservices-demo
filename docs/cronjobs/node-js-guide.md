# Node.js Docker Image CronJob Guide

This guide shows you how to package a Node.js script into a Docker container and run it as a Kubernetes CronJob in Minikube.

## The Strategy

We follow the same pattern as our bash script example, but this time we use a `node:18-alpine` base image in our Dockerfile so that our container can execute JavaScript.

We created these files:
1. **The Code**: `node-cron/index.js` (The Node script) and `node-cron/package.json`
2. **The Dockerfile**: `node-cron/Dockerfile` (Uses Node Alpine, installs dependencies, and runs `npm start`)
3. **The Manifest**: `k8s/node-cronjob.yaml` (Runs the image every 3 minutes)

---

## Execution Steps

You will follow almost the exact same steps you used for the bash script!

### Step 1: Connect to Minikube's Docker daemon
Make sure your terminal is still connected to Minikube's Docker daemon. If you opened a new PowerShell tab, run:
```powershell
minikube docker-env | Invoke-Expression
```

### Step 2: Build the Node.js Image
Build the Docker image and tag it as `my-node-cron:v1`:
```powershell
docker build -t my-node-cron:v1 .\node-cron
```

### Step 3: Apply the CronJob
Apply the new YAML file:
```powershell
kubectl apply -f .\k8s\node-cronjob.yaml
```

### Step 4: Verify it Works
You can wait 3 minutes, or trigger it manually right now:
```powershell
# Trigger manually
kubectl create job --from=cronjob/node-cronjob manual-node-run-1

# Check the pods
kubectl get pods

# Check the logs of the newly created pod
kubectl logs pod/manual-node-run-1-abcde
```

You should see the green circles `🟢` and the output coming directly from your `console.log()` statements!
