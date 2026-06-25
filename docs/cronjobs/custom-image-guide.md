# Custom Docker Image CronJob Guide

This guide walks you through how to build a custom Docker image for your CronJob and run it entirely within Minikube.

## The Strategy

Instead of passing a script inline inside your Kubernetes YAML file, it is best practice to bake your script into a Docker image. 

We use three files for this:
1. **The Script**: `custom-cron/my-script.sh` (Your actual logic)
2. **The Dockerfile**: `custom-cron/Dockerfile` (Instructions to package the script into a container)
3. **The Manifest**: `k8s/custom-image-cronjob.yaml` (The Kubernetes instruction to run that container on a schedule)

---

## Execution Steps

Because we are doing this locally, you must follow these specific steps in your terminal to build the image so Minikube can see it.

### Step 1: Connect your terminal to Minikube's Docker daemon
Minikube has its own isolated Docker daemon. If you just run `docker build` normally, your laptop gets the image, but Minikube won't be able to find it.

Run this command to point your current PowerShell window to Minikube's Docker:
```powershell
minikube docker-env | Invoke-Expression
```
*(Note: If you ever open a new terminal tab, you have to run this again for that tab!)*

### Step 2: Build the Image
Now, build the Docker image and tag it as `my-custom-cron:v1`:
```powershell
docker build -t my-custom-cron:v1 .\custom-cron
```

### Step 3: Apply the CronJob
Apply the new YAML file to the cluster:
```powershell
kubectl apply -f .\k8s\custom-image-cronjob.yaml
```

### Step 4: Verify it Works
You can either wait 2 minutes for it to trigger, or manually spawn a Job right now to test it out!
```powershell
# Manually trigger a run immediately
kubectl create job --from=cronjob/custom-image-cronjob manual-custom-run-1

# Check the pods
kubectl get pods

# Once it completes, check the logs (replace with actual pod name)
kubectl logs pod/manual-custom-run-1-abcde
```

> [!TIP]
> Notice the `imagePullPolicy: Never` inside the `custom-image-cronjob.yaml`. This is the secret sauce that tells Kubernetes not to search Docker Hub for `my-custom-cron:v1` and instead use the one you just built locally in Step 2!
