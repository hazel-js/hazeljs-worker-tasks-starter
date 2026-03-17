/**
 * Fibonacci worker task — runs in a worker thread.
 * CPU-intensive computation does not block the main event loop.
 */
import { WorkerTask } from '@hazeljs/worker';
import { fibonacci } from './fibonacci';

export interface FibonacciPayload {
  n: number;
}

export interface FibonacciResult {
  value: number;
  n: number;
}

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

export default FibonacciTask;
