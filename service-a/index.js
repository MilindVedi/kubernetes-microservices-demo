// Service A - The "frontend" service that talks to Service B
// This service is exposed externally via NodePort (port 30080)

const express = require('express');  // Web framework for handling HTTP requests
const axios = require('axios');      // HTTP client for making requests to other services

const app = express();

// GET /health - Lightweight health check that does NOT call service-b
// Used by Kubernetes liveness/readiness/startup probes
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// GET /hello - Main endpoint that combines data from Service A and Service B
// When a user hits this endpoint, Service A calls Service B internally
app.get('/hello', async (req, res) => {
    try {
        // Call Service B using its Kubernetes Service name ("service-b")
        // Inside a Kubernetes cluster, services can find each other by name
        // "service-b" resolves to the ClusterIP of the service-b Service (e.g., 10.103.222.108)
        // Port 3000 is the port defined in service-b's Service YAML (spec.ports.port)
        const response = await axios.get('http://service-b:3000/message')

        // Combine responses from both services
        res.json(
            {
                fromServiceA: "Hello from Service A!",
                fromServiceB: response.data     // Data returned by Service B's /message endpoint
            }
        )
    } catch (e) {
        // If Service B is unreachable or returns an error
        res.status(500).json({ error: e.message });
    }
});

// Start listening on port 3001
// This must match:
//   - containerPort in service-a-deployment.yaml (3001)
//   - targetPort in service-a-service.yaml (3001)
app.listen(3001, () => {
    console.log('Service A is running on port 3001');
})