import { HazelModule } from '@hazeljs/core';
import { WorkerModule } from '@hazeljs/worker';
import path from 'path';
import { FibonacciTask } from './tasks/fibonacci.task';
import { FibonacciController } from './fibonacci.controller';

// Worker threads require compiled .js; point to dist/tasks whether we run from dist (npm start) or src (ts-node-dev).
const tasksDir = __dirname.endsWith('dist')
  ? path.join(__dirname, 'tasks')
  : path.join(__dirname, '..', 'dist', 'tasks');

@HazelModule({
  imports: [
    WorkerModule.forRoot({
      taskDirectory: tasksDir,
      taskFileExtension: '.task.js',
      poolSize: 4,
      timeout: 30000,
    }),
  ],
  providers: [FibonacciTask],
  controllers: [FibonacciController],
})
export class AppModule {}
