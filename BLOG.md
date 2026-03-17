# Why We Built @hazeljs/worker: Offloading CPU-Heavy Work in Node.js

This post explains why worker threads matter in Node.js, what problems they solve, why we built the [**@hazeljs/worker**](https://www.npmjs.com/package/@hazeljs/worker) package, and how the Fibonacci starter demonstrates the difference between doing CPU work on the main thread vs. in a worker.

---

## The Problem: Node.js and the Single-Threaded Event Loop

Node.js runs your JavaScript on a **single main thread** with an **event loop**. That design is great for I/O-bound work: while one request waits on the database or the network, the event loop can handle other requests. As long as no single callback runs for a long time, the server stays responsive.

The trouble starts when a request does **CPU-bound work**: heavy number crunching, parsing, encryption, compression, or any synchronous computation that keeps the main thread busy. While that code runs:

- The event loop is **blocked**.
- No other requests are handled.
- Timers and I/O callbacks are delayed.
- The whole process looks “stuck” until the CPU work finishes.

So a single expensive computation can degrade or freeze your entire Node.js app. That’s the core problem worker threads are meant to solve.

---

## Why Worker Threads?

**Worker threads** let you run JavaScript in **separate threads** inside the same process. Each worker has its own:

- JavaScript engine (V8) context
- Heap and stack
- Event loop

They do **not** share memory with the main thread. Data is passed in and out via **message passing** (serialized, e.g. with structured clone or JSON). So:

- **CPU work in a worker does not block the main thread.** The main event loop keeps handling HTTP, timers, and I/O.
- You get **real parallelism** for CPU-bound tasks (up to the number of cores and workers you use).
- You stay in **one process**, unlike `child_process` or separate services, so deployment and process management stay simple.

The tradeoff is that passing data has a cost (serialization/deserialization), so workers are a bad fit for tiny, frequent tasks. They shine for **chunky CPU work**: embeddings, OCR, report generation, image processing, crypto, or—as in our example—naive recursive Fibonacci.

---

## Why We Built @hazeljs/worker

We wanted a **framework-native** way in [**HazelJS**](https://hazeljs.ai) to:

1. **Offload CPU-heavy logic** from the main thread without hand-rolling worker pools and message protocols.
2. **Integrate with the rest of the stack**: dependency injection, decorators, modules, and (optionally) Inspector.
3. **Keep the API simple**: define a task class, register it, and execute it from controllers or services with one call.
4. **Manage lifecycle and robustness**: pool size, timeouts, graceful shutdown, and clear errors.

So we built [**@hazeljs/worker**](https://www.npmjs.com/package/@hazeljs/worker): a small layer on top of Node.js `worker_threads` that gives you:

- A **managed worker pool** (size based on CPU count by default).
- **@WorkerTask** to mark classes as task handlers (with name, timeout, concurrency).
- **WorkerExecutor** to run tasks from anywhere (e.g. controllers) with a simple `execute('task-name', payload)`.
- **Task discovery** from the DI container or an explicit task registry/directory.
- **Path resolution at runtime**: e.g. `taskDirectory` + `taskFileExtension` so the framework resolves handler paths for you.
- **Graceful shutdown** so in-flight tasks can finish before the process exits.
- **Inspector integration** so you can see worker tasks when using [**@hazeljs/inspector**](https://www.npmjs.com/package/@hazeljs/inspector).

The goal is: you write a class with a `run(payload)` method, register the module and the task, and the framework takes care of the pool, serialization, and execution in a worker.

---

## What Problems [@hazeljs/worker](https://www.npmjs.com/package/@hazeljs/worker) Solves

| Problem | How the package helps |
|--------|------------------------|
| **Main thread blocked by CPU work** | Work runs in a worker; the main thread stays free for HTTP and I/O. |
| **Boilerplate for workers** | No manual `new Worker(...)`, message handling, or pool logic; you define tasks and call `execute()`. |
| **Where to run which code** | Clear split: task handlers run in workers; the rest of the app (controllers, services) runs on the main thread. |
| **Config and paths** | `taskDirectory` + `taskFileExtension` (or `taskRegistry`) so handler paths are resolved at runtime. |
| **Timeouts and overload** | Per-task timeout and optional `maxConcurrency` to avoid runaway or overloaded tasks. |
| **Shutdown** | Pool registers for SIGTERM/SIGINT and shuts down gracefully, waiting for in-flight tasks. |
| **Observability** | When Inspector is installed, worker tasks are visible in the dashboard. |

It does **not** replace horizontal scaling, load balancers, or job queues. It’s focused on **offloading CPU within one Node.js process** so that process stays responsive.

---

## The Fibonacci Example: Why It’s a Good Demo

Fibonacci is a classic way to show CPU-bound behavior:

1. **Same algorithm everywhere**  
   We use the same naive recursive implementation for both the “sync” and “worker” endpoints. The only difference is *where* it runs (main thread vs. worker), so the comparison is fair.

2. **Obviously CPU-bound**  
   The recursive implementation has exponential time complexity. For `n` in the 30–45 range, it does millions of calls and keeps the CPU busy for a noticeable time (hundreds of ms or more). That’s enough to block the event loop if run on the main thread.

3. **Easy to compare**  
   Two endpoints, same `n`:
   - **Sync:** `GET /fibonacci/sync?n=40` — runs on the main thread; while it runs, other requests wait.
   - **Worker:** `GET /fibonacci/worker?n=40` — runs in a worker; the main thread can still serve other requests.

4. **Concrete UX impact**  
   If you open two tabs and hit the sync endpoint with a large `n` in both, the second request won’t get a response until the first one finishes. With the worker endpoint, both can progress in parallel (up to pool size).

So the Fibonacci starter is not just a toy: it’s a minimal, reproducible demo of “CPU work blocks the event loop” vs. “CPU work in a worker keeps the server responsive.”

---

## How the Fibonacci Starter Is Structured

### 1. The math: shared and CPU-heavy

```typescript
// tasks/fibonacci.ts
export function fibonacci(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

This runs **both** in the worker (for the worker endpoint) and on the main thread (for the sync endpoint), so we compare the same workload in two execution contexts.

### 2. The worker task: runs in a worker thread

```typescript
// tasks/fibonacci.task.ts
@WorkerTask({
  name: 'fibonacci',
  timeout: 30000,
  maxConcurrency: 4,
})
export class FibonacciTask {
  async run(payload: FibonacciPayload): Promise<FibonacciResult> {
    const { n } = payload;
    const value = fibonacci(n);
    return { value, n };
  }
}
```

- **@WorkerTask** registers this class as a task named `'fibonacci'` with a timeout and concurrency limit.
- The **worker pool** loads the compiled handler from `taskDirectory` + `'fibonacci'` + `taskFileExtension` (e.g. `dist/tasks/fibonacci.task.js`) and calls `run(payload)` inside a worker. The main thread never runs this method.

### 3. The controller: two ways to run the same work

- **Worker path:** inject `WorkerExecutor`, call `execute('fibonacci', { n })`. The framework serializes the payload, sends it to a worker, runs `FibonacciTask#run` there, and returns the result. The main thread only does the HTTP and the `execute()` call; it does not run the recursive Fibonacci.
- **Sync path:** call `fibonacci(n)` directly in the controller. That runs on the main thread and blocks the event loop until it returns.

So “with worker” vs “without worker” in the blog title is exactly: **worker path** (non-blocking) vs **sync path** (blocking).

### 4. Module config: task directory and extension

```typescript
WorkerModule.forRoot({
  taskDirectory: tasksDir,        // e.g. dist/tasks
  taskFileExtension: '.task.js',
  poolSize: 4,
  timeout: 30000,
})
```

- **taskDirectory** is resolved so it points at the **compiled** task handlers (e.g. `dist/tasks`), whether you run the app from `dist/` or from `src/` (e.g. ts-node-dev). Workers must load `.js` files, not `.ts`.
- **taskFileExtension** tells the framework how to build the path for each discovered task name at runtime (e.g. `fibonacci` → `fibonacci.task.js`). So you don’t hard-code paths; the framework resolves them when it discovers tasks and starts the pool.

This is what we mean by “handled at runtime”: the app only specifies directory and extension; the worker package figures out the full path for each task.

---

## What Happens When You Call Each Endpoint

### GET /fibonacci/sync?n=40 (without worker)

1. Request hits the controller on the main thread.
2. Controller calls `fibonacci(40)` on the main thread.
3. The main thread is busy for the whole duration (e.g. hundreds of ms or more). The event loop does not process other requests, timers, or I/O until `fibonacci(40)` returns.
4. Response is sent.

If you send another request (e.g. to `/health` or another `/fibonacci/sync`) while the first is computing, that second request will wait in the queue until the first one finishes. You’ve effectively made the server single-request-at-a-time for that period.

### GET /fibonacci/worker?n=40 (with worker)

1. Request hits the controller on the main thread.
2. Controller calls `workerExecutor.execute('fibonacci', { n: 40 })`.
3. The executor serializes the payload, picks a worker from the pool, and sends a message to that worker. The main thread is free immediately (it’s not running the recursive Fibonacci).
4. The worker thread loads the task handler (from `dist/tasks/fibonacci.task.js`), runs `run({ n: 40 })`, which calls `fibonacci(40)` **inside the worker**.
5. When the worker finishes, it sends the result back. The main thread receives it and resolves the `execute()` promise.
6. Controller sends the response.

While the worker is computing, the main thread can serve other requests (including more Fibonacci requests, up to pool size). So “with worker” means: the **Fibonacci problem** (the CPU-heavy part) is offloaded to a worker and no longer blocks the main thread.

---

## When to Use Workers (and When Not To)

**Use [@hazeljs/worker](https://www.npmjs.com/package/@hazeljs/worker) when:**

- You have **CPU-bound** work: heavy computations, parsing, crypto, compression, embeddings, report generation, etc.
- You want the **main thread to stay responsive** so the server can handle other requests and I/O.
- You’re okay with **serialization overhead** and the “run in another thread” model.

**Avoid using it for:**

- **I/O-bound** work (DB, HTTP, file I/O). That’s what the main thread and the event loop are good at; moving it to a worker usually adds overhead and no benefit.
- **Very small, very frequent** tasks where the cost of messaging and worker scheduling outweighs the gain.
- **Replacing horizontal scaling or job queues**; workers are per-process parallelism, not a substitute for multiple instances or Redis/queue-based jobs.

The Fibonacci example is intentionally CPU-bound and heavy enough that the difference between “with worker” and “without worker” is obvious in both behavior and responsiveness.

---

## Summary

- **Node.js** is single-threaded; **CPU-bound work on the main thread blocks the event loop** and hurts responsiveness.
- **Worker threads** run code in separate threads so that **CPU work doesn’t block the main thread**; data is passed by message passing.
- [**@hazeljs/worker**](https://www.npmjs.com/package/@hazeljs/worker) provides a **managed pool**, **@WorkerTask**, **WorkerExecutor**, **task discovery**, and **runtime path resolution** so you can offload CPU-heavy tasks without writing low-level worker code.
- The **Fibonacci starter** shows the same algorithm **with** (worker) and **without** (sync) the package: sync blocks the server, worker keeps it responsive.

To try it yourself: clone or open the starter, run `npm run build` and `npm run dev`, then hit `/fibonacci/sync?n=40` and `/fibonacci/worker?n=40` (and maybe open a second tab to see the difference in responsiveness). Use `n` in the 0–45 range; higher values make the effect more visible.

---

## Links

- **[HazelJS](https://hazeljs.ai)** — Website
- **[Documentation](https://hazeljs.com/docs)** — HazelJS docs
- **[Worker package docs](https://hazeljs.com/docs/packages/worker)** — @hazeljs/worker guide
- **[@hazeljs/worker](https://www.npmjs.com/package/@hazeljs/worker)** — npm
- **[@hazeljs/core](https://www.npmjs.com/package/@hazeljs/core)** — npm
- **[@hazeljs/inspector](https://www.npmjs.com/package/@hazeljs/inspector)** — npm
