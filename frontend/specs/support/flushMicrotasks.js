// Drain pending microtasks so an async tick started by `jasmine.clock().tick()` runs to
// completion (its `await` continuation, the dispatch, and any synchronous reschedule).
export async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
