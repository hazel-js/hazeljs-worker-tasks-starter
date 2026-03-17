# hazeljs-worker-tasks-starter

Fibonacci example using [@hazeljs/worker](https://www.npmjs.com/package/@hazeljs/worker) — CPU-intensive task offloading with and without worker threads.

> **Note:** This starter depends on `@hazeljs/core` and `@hazeljs/worker` (see `package.json`). For local development against the hazeljs monorepo, replace these with `file:../hazeljs/packages/core` and `file:../hazeljs/packages/worker`; otherwise use the published versions (e.g. `0.2.0` or latest).

## Quick Start

```bash
npm install
npm run dev     # builds, then watches src and runs from dist (worker tasks load from dist/)
# or: npm run build && npm start
```

Then try:

- **http://localhost:3000/fibonacci/worker?n=35** — runs in worker thread (non-blocking)
- **http://localhost:3000/fibonacci/sync?n=35** — runs on main thread (blocking)

## What's Included

- **FibonacciTask** — `@WorkerTask` that computes Fibonacci in a worker thread
- **fibonacci(n)** — shared naive recursive implementation (CPU-intensive)
- **FibonacciController** — two endpoints to compare worker vs sync execution

## Endpoints

| Endpoint | Description |
| -------- | ----------- |
| `GET /fibonacci/worker?n=35` | Compute in worker — main thread stays responsive |
| `GET /fibonacci/sync?n=35` | Compute on main thread — blocks event loop |

Use `n` between 0–45. Higher values (e.g. 40) take longer and demonstrate the blocking effect of sync vs worker.

## Comparison

- **Worker**: CPU work runs in a separate thread. The main event loop stays responsive; other HTTP requests can be handled concurrently.
- **Sync**: CPU work runs on the main thread. While computing, the server cannot handle other requests.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled `dist/main.js` |

## Environment

| Variable | Description |
| -------- | ----------- |
| `PORT` | Server port (default: 3000) |

## Links

- [@hazeljs/worker](https://www.npmjs.com/package/@hazeljs/worker)
- [Worker Package Docs](https://hazeljs.com/docs/packages/worker)
- [HazelJS](https://hazeljs.com)
