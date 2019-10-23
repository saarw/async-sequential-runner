import { AsyncSequentialRunner } from './async-sequential-runner';

function timeoutPromise<R>(fn: () => R, timeout: number): Promise<R> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(fn());
    }, timeout);
  });
}

describe('SequentialOperator', () => {
  it('async task runes sequentially', async () => {
    const resource = {
      counter: 1,
    };
    const runner = new AsyncSequentialRunner<number>();
    const resolver: { resolveFn?: () => void } = {};
    const blocker = new Promise((resolve, reject) => {
      resolver.resolveFn = resolve;
    });
    // Push some tasks onto the runner that get a value before blocking on some resource
    // If the tasks were to start running in parallel, they would return the same value
    const task1 = runner.run(async () => {
      const value = resource.counter;
      await blocker;
      resource.counter += 1;
      return value;
    });
    const task2 = runner.run(async () => {
      const value = resource.counter;
      await blocker;
      resource.counter += 1;
      return value;
    });

    // Await the tasks in parallel
    const all = Promise.all([task1, task2]);
    resolver.resolveFn!();
    const results = await all;

    // Note that the tasks executed sequentially
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(2);
  });
  it('async task fires triggers', async () => {
    const runner = new AsyncSequentialRunner<void>();
    const resolver: { resolveFn?: () => void } = {};
    const promise = new Promise((resolve, reject) => {
      resolver.resolveFn = resolve;
    });
    runner.run(async () => {
      await promise;
    });
    expect(runner.hasTasksOrTriggers()).toBe(true);
    const trigger = runner.taskCompleteTrigger();
    resolver.resolveFn!();
    await trigger.promise;
    expect(runner.hasTasksOrTriggers()).toBe(false);
  });
  it('test resource not concurrently acccessed', async () => {
    const resource = {
      currentOps: 0,
      counter: 0,
    };
    const runner = new AsyncSequentialRunner<void>();
    const p = [];
    const errors = [];
    const opsNum = 50;
    for (let i = 0; i < opsNum; i++) {
      p.push(
        runner.run((moreScheduled: boolean) => {
          resource.currentOps += 1;
          return timeoutPromise(() => {
            if (resource.currentOps > 1) {
              errors.push('concurrent resource access');
              fail('Concurrent access');
            }
            resource.counter += 1;
            resource.currentOps -= 1;
          }, Math.random() * 3);
        }),
      );
    }
    await Promise.all(p);
    expect(resource.currentOps).toBe(0);
    expect(resource.counter).toBe(opsNum);
    expect(errors.length).toBe(0);
  });
});
