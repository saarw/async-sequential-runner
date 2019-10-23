import AsyncSequentialRunner from './async-sequential-runner';

function timeoutPromise<R>(fn: () => R, timeout: number): Promise<R> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(fn());
    }, timeout);
  });
}

describe('SequentialOperator', () => {
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
