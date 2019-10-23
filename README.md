# async-sequential-runner
A runner for async tasks that can pause their execution to ensure that each task runs to completion before the next task is started, instead of allowing new tasks to progress while one task is paused. Also allows registering cancelable triggers that will resolve when a task has completed running, to enable polling. Written to support backends where multiple requests with intermittent pauses access a resource that should only be accessed sequentially.

# Installation
```npm install --save async-sequential-runner```

# Usage
```
    const resource = {
        counter: 1
    }
    // Create a runner
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
    const all = Promise.all([task1, task2])
    resolver.resolveFn!();
    const results = await all;

    // Note that the tasks did not run in paralllel
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(2);
```