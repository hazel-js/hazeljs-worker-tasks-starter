/**
 * Naive recursive Fibonacci — CPU-intensive, blocks the event loop.
 * Used by both worker task and sync computation for fair comparison.
 */
export function fibonacci(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
