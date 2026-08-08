import { flushMicrotasks } from './flushMicrotasks.js';

describe('flushMicrotasks', () => {
  it('lets a chain of three awaited continuations run to completion', async () => {
    const steps = [];
    (async () => {
      await null;
      steps.push(1);
      await null;
      steps.push(2);
    })();

    await flushMicrotasks();

    expect(steps).toEqual([1, 2]);
  });
});
