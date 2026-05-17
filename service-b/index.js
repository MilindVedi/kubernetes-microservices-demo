// Service B - The "backend" service that provides data to Service A
// This service is only accessible inside the cluster (ClusterIP type)
// It cannot be reached directly from outside — only other pods can call it

const express = require('express');  // Web framework for handling HTTP requests

const app = express();

// GET /message - Returns a simple JSON message
// This endpoint is called by Service A internally via:
//   http://service-b:3000/message
// "service-b" is the Kubernetes Service name, resolved via cluster DNS
app.get("/message", (req, res) => {
    res.json({ message: "Hello from Service B!" });
})

// Start listening on port 3000
// This must match:
//   - containerPort in service-b-deployment.yaml (3000)
//   - targetPort in service-b-service.yaml (3000)
app.listen(3000, () => {
    console.log("Service B is running on port 3000");
})