/**
 * Helper async generator class that runs async task from a queue, 
 * removing them from the queue when they complete.
 * @param queue The queue to get operations from.
 */
async function* serialAsyncRunner<R>(queue: Array<(hasMore: boolean) => Promise<R>>) {
    while (queue.length > 0) {
        const task = queue[0];
        yield await task(queue.length > 1).then((v) => {
            queue.shift();
            return v;
        });
    }
}

/**
 * Runs async tasks sequentially.
 */
class AsyncSequentialRunner<R> {
    private activeIterator?: {
        gen: AsyncGenerator<R, void, unknown>,
        queue: Array<(hasMore: boolean) => Promise<R>>
    };
    private triggers?: Array<() => void>;

    /**
     * Runs a task after previous scheduled operations 
     * have run, returning a promise with the result.
     * @param operation A function that will be called to perform 
     * work, with a boolean indicating if more operations are scheduled.
     */
    public async run(task: (hasMore: boolean) => Promise<R>)
        : Promise<R> {
        const it = this.activeIterator || ((): {
            gen: AsyncGenerator<R, void, unknown>,
            queue: Array<() => Promise<R>>
        } => {
            const queue: Array<() => Promise<R>> = [];
            const iter = {
                queue,
                gen: serialAsyncRunner(queue)
            };
            this.activeIterator = iter;
            return iter;
        })();

        it.queue.push(task);
        return it.gen.next().then((itResult) => {
            if (it.queue.length === 0) {
                this.activeIterator = undefined;
            }
            if (this.triggers) {
                const triggers = this.triggers;
                this.triggers = undefined;
                triggers.forEach((resFn) => {
                    resFn();
                });
            }
            return itResult.value as R;
        });
    }

    /** 
     * Creates a trigger with a promise that will complete after the 
     * next task has completed. The trigger can be cancelled by
     * calling the cancel function. Useful to trigger polling functions 
     * that can schedule a task when the trigger promise completes.
     */
    public taskCompleteTrigger(): {
        cancel: () => void,
        promise: Promise<void>
     } {
        if (!this.triggers) {
            this.triggers = [];
        }
        const triggers = this.triggers;
        const p = new Promise<void>((resolve, reject) => {
            triggers.push(resolve);
        });
        const res = triggers[triggers.length -1];
        return {
            cancel: () => {
                if (this.triggers) {
                    const idx = this.triggers.findIndex((v) => {
                        return v === res;
                    });
                    if (idx >= 0) {
                        if (this.triggers.length === 1) {
                            this.triggers = undefined;
                        } else {
                            this.triggers.splice(idx, 1);
                        }
                    }
                }
            },
            promise: p
        };
    } 

    /** 
     * Returns whether there are more tasks scheduled or triggers waiting
     * for task completion, useful for determining when to clean up
     * references to the runner.
     */
    public hasTasksOrTriggers(): boolean {
        return !!((this.triggers && this.triggers.length > 0) ||
            (this.activeIterator && this.activeIterator.queue.length));
    }
}

export default AsyncSequentialRunner;
