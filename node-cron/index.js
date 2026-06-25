console.log("=================================================");
console.log("🟢 Starting Node.js Docker Image CronJob Execution");
console.log("=================================================");
console.log(`Current Time: ${new Date().toISOString()}`);
console.log("Executing baked-in script from /app/index.js");

console.log("Simulating some work in Node.js...");

// A simple simulated delay using Promises
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runJob() {
  for (let i = 1; i <= 5; i++) {
    console.log(`Processing item ${i} of 5...`);
    await sleep(1000); // 1 second delay
  }
  
  console.log("✅ Node.js Custom Job completed successfully!");
  console.log("=================================================");
}

// Execute the async function
runJob().catch(err => {
  console.error("❌ Job failed with error:", err);
  process.exit(1); // Exit with a non-zero code so Kubernetes knows it failed
});
