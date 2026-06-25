# Kubernetes CronJobs — Complete Guide (Minikube)

This guide covers how to use and manage CronJobs in Kubernetes. It is designed to work entirely locally using **Minikube**.

---

## 1. What is a CronJob?

A `CronJob` runs a containerized task on a repeating schedule.

Think of the Kubernetes resource hierarchy like this:
- **Deployment**: Manages `Pods` that run forever (like a web server).
- **CronJob**: Manages `Jobs` that run on a schedule.
- **Job**: Manages `Pods` that run once until completion and then stop (like a script or batch process).

When a CronJob's scheduled time arrives, the `CronJob` creates a `Job`. That `Job` then creates a `Pod` which actually executes your command.

---

## 2. Anatomy of our `learning-cronjob.yaml`

We created a file at `k8s/learning-cronjob.yaml` that runs every minute.

### The Cron Schedule Syntax
The schedule field uses standard Cron string format:
```yaml
schedule: "*/1 * * * *"
```
The 5 asterisks represent:
1. **Minute** (0 - 59)
2. **Hour** (0 - 23)
3. **Day of the month** (1 - 31)
4. **Month** (1 - 12)
5. **Day of the week** (0 - 6) (Sunday to Saturday)

*Examples:*
- `0 0 * * *` = Run daily at midnight
- `*/5 * * * *` = Run every 5 minutes
- `0 12 * * 5` = Run at 12:00 PM every Friday

### Key Settings

| Field | Meaning |
|-------|---------|
| `concurrencyPolicy` | What happens if the next run triggers while the old one is still running? (Allow, Forbid, Replace) |
| `successfulJobsHistoryLimit` | How many completed Jobs to keep around so you can read their logs (default 3). |
| `failedJobsHistoryLimit` | How many failed Jobs to keep around for debugging (default 1). |
| `suspend` | Set to `true` to pause the schedule without deleting the whole CronJob. |
| `restartPolicy` | Must be `Never` or `OnFailure`. Never use `Always` for a Job, because Jobs are supposed to finish! |

---

## 3. Minikube Workflow & Commands

Make sure Minikube is running before starting:
```bash
minikube start
```

### Deploying the CronJob
```bash
# Apply the file to the cluster
kubectl apply -f k8s/learning-cronjob.yaml
```

### Checking the CronJob Status
```bash
# See the CronJob resource (watch the LAST SCHEDULE field)
kubectl get cronjob learning-cronjob
```

### Watching it Run
Because the schedule is `*/1 * * * *`, a new Job will spawn at the top of the next minute.
```bash
# Watch Jobs being created in real-time (Press Ctrl+C to stop watching)
kubectl get jobs --watch
```

When you see a Job created (e.g., `learning-cronjob-28045678`), you can check the Pods:
```bash
# See the completed or running Pod
kubectl get pods
```

### Reading the Logs
To see what the Job actually did, read the logs of the Pod that ran it:
```bash
# Copy the name of the Pod from 'kubectl get pods'
kubectl logs pod/learning-cronjob-12345678-abcde
```

*(You should see our script's "🚀 Starting Learning CronJob Execution" output).*

---

## 4. Advanced Tricks

### Manually Triggering a CronJob
You don't have to wait for the schedule! You can manually tell Kubernetes to create a Job from your CronJob right now:
```bash
# Creates a Job named 'manual-run-1' from the 'learning-cronjob' template
kubectl create job --from=cronjob/learning-cronjob manual-run-1
```

### Pausing the CronJob
If you want to stop the CronJob from running temporarily, you can suspend it. (Note: On Windows PowerShell, we have to escape the double quotes like `\"`):
```bash
kubectl patch cronjob learning-cronjob -p '{\"spec\" : {\"suspend\" : true}}'
```
To resume it, patch it back to `false`:
```bash
kubectl patch cronjob learning-cronjob -p '{\"spec\" : {\"suspend\" : false}}'
```

### Cleaning Up
When you're done learning, you can delete the CronJob. This will also delete any Jobs and Pods it created.
```bash
kubectl delete -f k8s/learning-cronjob.yaml
```
