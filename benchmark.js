// benchmark.js
// Runs multiple load test scenarios against our rate limiter system.
// Uses autocannon under the hood — make sure it's installed:
// npm install -g autocannon
// Also make sure docker-compose is running before executing this.
// Run with: node benchmark.js

const autocannon = require('autocannon')

// ─── Scenarios ────────────────────────────────────────────────────────────────

// each scenario tests a different aspect of the system
const scenarios = [
  {
    name: "POST /check — Pro plan — 50 concurrent",
    description: "Core microservice endpoint under moderate load",
    url: "http://localhost:3101/check",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "bench_user_pro",
      ip: "127.0.0.1",
      route: "/posts",
      plan: "pro"           // pro = 1000 req per 15min, won't hit limit during bench
    }),
    connections: 50,        // concurrent connections
    duration: 15            // seconds
  },
  {
    name: "POST /check — Free plan — 10 concurrent",
    description: "Free plan users hitting rate limit boundary",
    url: "http://localhost:3101/check",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "bench_user_free",
      ip: "127.0.0.1",
      route: "/posts",
      plan: "free"          // free = 100 req per 15min, will get blocked quickly
    }),
    connections: 10,
    duration: 15
  },
  {
    name: "GET /posts via dummy-api — Pro plan — 50 concurrent",
    description: "Full flow — dummy API calling rate limiter internally",
    url: "http://localhost:3102/posts",
    method: "GET",
    headers: {
      "x-user-id": "bench_user_dummy",
      "x-user-plan": "pro"
    },
    connections: 50,
    duration: 15
  },
  {
    name: "POST /login via dummy-api — 20 concurrent",
    description: "Strict route — 5 req per 60s, most requests will be blocked",
    url: "http://localhost:3102/login",
    method: "POST",
    headers: {
      "x-user-id": "bench_user_login",
      "x-user-plan": "pro",
      "Content-Type": "application/json"
    },
    connections: 20,
    duration: 15
  },
  {
    name: "POST /check — Enterprise plan — 100 concurrent",
    description: "High concurrency stress test",
    url: "http://localhost:3101/check",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "bench_user_enterprise",
      ip: "127.0.0.1",
      route: "/posts",
      plan: "enterprise"    // enterprise = 10000 req per 15min, won't hit limit
    }),
    connections: 100,
    duration: 15
  }
]

// ─── Run a single scenario ────────────────────────────────────────────────────

// returns a promise that resolves with the result
function runScenario(scenario) {
  return new Promise(function(resolve) {

    console.log(`\n⏳ Running: ${scenario.name}`)
    console.log(`   ${scenario.description}`)
    console.log(`   Connections: ${scenario.connections} | Duration: ${scenario.duration}s`)

    const instance = autocannon({
      url: scenario.url,
      method: scenario.method,
      headers: scenario.headers || {},
      body: scenario.body || undefined,
      connections: scenario.connections,
      duration: scenario.duration,
      // don't print autocannon's default output — we format it ourselves
      silent: true
    })

    // autocannon fires this event when the test finishes
    instance.on('done', function(result) {
      resolve({ scenario, result })
    })
  })
}

// ─── Format results ───────────────────────────────────────────────────────────

function printResult(scenario, result) {
  const rps = Math.round(result.requests.mean)         // requests per second
  const p50 = result.latency.p50                       // 50th percentile latency
  const p99 = result.latency.p99                       // 99th percentile latency
  const totalRequests = result.requests.total
  const errors = result.errors
  const timeouts = result.timeouts
  const non2xx = result.statusCodeStats?.['429']?.count || 0 // count of 429 responses

  console.log(`\n✅ Result: ${scenario.name}`)
  console.log(`   Requests/sec     : ${rps}`)
  console.log(`   Latency p50      : ${p50} ms`)
  console.log(`   Latency p99      : ${p99} ms`)
  console.log(`   Total requests   : ${totalRequests}`)
  console.log(`   Blocked (429)    : ${non2xx}`)
  console.log(`   Errors/timeouts  : ${errors + timeouts}`)

  // return clean object for summary table at the end
  return {
    name: scenario.name,
    rps,
    p50,
    p99,
    totalRequests,
    blocked: non2xx,
    errors: errors + timeouts
  }
}

// ─── Print summary table ──────────────────────────────────────────────────────

function printSummary(results) {
  console.log("\n")
  console.log("═".repeat(80))
  console.log("BENCHMARK SUMMARY")
  console.log("═".repeat(80))
  console.log(
    "Scenario".padEnd(45),
    "RPS".padEnd(8),
    "p50ms".padEnd(8),
    "p99ms".padEnd(8),
    "Blocked"
  )
  console.log("─".repeat(80))

  results.forEach(function(r) {
    console.log(
      r.name.substring(0, 44).padEnd(45),
      String(r.rps).padEnd(8),
      String(r.p50).padEnd(8),
      String(r.p99).padEnd(8),
      String(r.blocked)
    )
  })

  console.log("═".repeat(80))

  // find best RPS across all scenarios
  const bestRps = Math.max(...results.map(r => r.rps))
  console.log(`\n Peak throughput: ${bestRps} requests/sec`)
  console.log(` Tested ${scenarios.length} scenarios | Each ran for ${scenarios[0].duration}s`)
  console.log(`\n💡 Service health: curl http://localhost:3101/health`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(80))
  console.log("RATE LIMITER BENCHMARK")
  console.log("Make sure docker-compose is running before this script")
  console.log("═".repeat(80))

  const summaryResults = []

  // run scenarios one by one — not in parallel
  // parallel runs would interfere with each other's rate limit counters
  for (const scenario of scenarios) {
    const { result } = await runScenario(scenario)
    const summary = printResult(scenario, result)
    summaryResults.push(summary)

    // small pause between scenarios so rate limit windows reset partially
    await new Promise(function(resolve) { setTimeout(resolve, 3000) })
  }

  printSummary(summaryResults)
}

main()