// META: global=window,worker
'use strict';

for (const numReads of [1, 2, 3]) {
  promise_test(async t => {
    let controller;
    const stream = new ReadableStream({
      type: 'bytes',
      start(c) {
        controller = c;
      }
    });

    // One byte cannot fill a Uint16Array element, so this read stays pending.
    const byobReader = stream.getReader({ mode: 'byob' });
    const byobRead = byobReader.read(new Uint16Array(1));
    controller.enqueue(new Uint8Array([1]));
    byobReader.releaseLock();
    await promise_rejects_js(t, TypeError, byobRead,
                            'releasing the BYOB reader must reject its pending read');

    const reader = stream.getReader();
    t.add_cleanup(() => reader.cancel());
    const reads = [];
    for (let i = 0; i < numReads; ++i) {
      reads.push(reader.read());
    }

    // The first enqueue moves the partial BYOB read into the queue. Filling
    // the pending reads must stop when that queue is empty, then use this chunk.
    controller.enqueue(new Uint8Array([2]));
    controller.enqueue(new Uint8Array([3]));
    controller.close();

    const results = await Promise.all(reads);
    for (let i = 0; i < numReads; ++i) {
      assert_false(results[i].done, `pending read ${i + 1} must return a chunk`);
      assert_array_equals(results[i].value, [i + 1],
                          `pending read ${i + 1} must receive the next byte`);
    }

    for (let i = numReads; i < 3; ++i) {
      const result = await reader.read();
      assert_false(result.done, `queued chunk ${i + 1} must remain available`);
      assert_array_equals(result.value, [i + 1], 'queued bytes must be preserved');
    }
    const result = await reader.read();
    assert_true(result.done, 'the stream must close after all queued bytes are read');
    assert_equals(result.value, undefined, 'the final read must not return a chunk');
  }, 'ReadableStream with byte source: enqueue() after releasing a partially filled BYOB read, ' +
     `with ${numReads} pending default reads`);
}
