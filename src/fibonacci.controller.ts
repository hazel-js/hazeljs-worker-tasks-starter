/**
 * Fibonacci controller — compare worker vs sync execution.
 *
 * GET /fibonacci/worker?n=35 — runs in worker thread (non-blocking)
 * GET /fibonacci/sync?n=35   — runs on main thread (blocks event loop)
 */
import { Controller, Get, Query } from '@hazeljs/core';
import { WorkerExecutor } from '@hazeljs/worker';
import { fibonacci } from './tasks/fibonacci';

@Controller('fibonacci')
export class FibonacciController {
  constructor(private readonly workerExecutor: WorkerExecutor) {}

  /**
   * Compute Fibonacci using @hazeljs/worker — runs in a worker thread.
   * Main thread stays responsive; other requests can be handled concurrently.
   */
  @Get('worker')
  async fibonacciWorker(@Query('n') nStr: string) {
    const n = this.parseN(nStr);
    const { result, durationMs } = await this.workerExecutor.execute<{
      value: number;
      n: number;
    }>('fibonacci', { n });
    return {
      mode: 'worker',
      n: result.n,
      value: result.value,
      durationMs,
      note: 'Computed in worker thread — main thread stayed responsive',
    };
  }

  /**
   * Compute Fibonacci on main thread — blocks the event loop.
   * Use for comparison; high n values will block all other requests.
   */
  @Get('sync')
  async fibonacciSync(@Query('n') nStr: string) {
    const n = this.parseN(nStr);
    const start = Date.now();
    const value = fibonacci(n);
    const durationMs = Date.now() - start;
    return {
      mode: 'sync',
      n,
      value,
      durationMs,
      note: 'Computed on main thread — event loop was blocked',
    };
  }

  private parseN(nStr: string): number {
    const n = parseInt(nStr ?? '0', 10);
    if (isNaN(n) || n < 0 || n > 45) {
      throw new Error('Query param "n" must be 0–45 (e.g. ?n=35)');
    }
    return n;
  }
}
