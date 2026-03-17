/**
 * hazeljs-worker-tasks-starter
 *
 * Fibonacci example using @hazeljs/worker. Compare CPU-intensive computation
 * with and without worker threads.
 *
 * Quick start:
 *   npm install
 *   npm run dev
 *
 * Endpoints:
 *   GET /fibonacci/worker?n=35  — runs in worker (non-blocking)
 *   GET /fibonacci/sync?n=35   — runs on main thread (blocking)
 */

import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);

  console.log(`
┌──────────────────────────────────────────────────────────────────┐
│       @hazeljs/worker — Fibonacci Starter                         │
├──────────────────────────────────────────────────────────────────┤
│  Server running on http://localhost:${port}                          │
│                                                                  │
│  GET /fibonacci/worker?n=35  — Fibonacci in worker (non-blocking) │
│  GET /fibonacci/sync?n=35    — Fibonacci on main thread (block)   │
│                                                                  │
│  Try n=35–40 to see CPU load. Worker keeps main thread responsive│
│                                                                  │
│  GET  /health    Liveness probe                                  │
│  GET  /ready     Readiness probe                                  │
└──────────────────────────────────────────────────────────────────┘
  `);
}

bootstrap().catch(console.error);
