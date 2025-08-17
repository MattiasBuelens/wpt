// META: global=window,worker,shadowrealm
// META: script=../resources/test-utils.js
'use strict';

// View buffers are detached after pull() returns, so record the information at the time that pull() was called.
function extractViewInfo(view) {
  return {
    constructor: view.constructor,
    bufferByteLength: view.buffer.byteLength,
    bufferMaxByteLength: view.buffer.maxByteLength,
    bufferResizable: view.buffer.resizable,
    byteOffset: view.byteOffset,
    byteLength: view.byteLength
  };
}

promise_test(async t => {
  let pullCount = 0;
  const byobRequests = [];
  const rs = new ReadableStream({
    type: 'bytes',
    pull: t.step_func((c) => {
      const byobRequest = c.byobRequest;
      const view = byobRequest.view;
      byobRequests[pullCount] = {
        nonNull: byobRequest !== null,
        viewNonNull: view !== null,
        viewInfo: extractViewInfo(view)
      };
      if (pullCount === 0) {
        view[0] = 0x01;
        view[1] = 0x02;
        byobRequest.respond(2);
      } else if (pullCount === 1) {
        view[0] = 0x03;
        byobRequest.respond(1);
      }
      ++pullCount;
    })
  });

  const reader = rs.getReader({ mode: 'byob' });
  let buffer = new ArrayBuffer(10, { maxByteLength: 20 });

  const view1 = new Uint8Array(buffer, 0, 3);
  const result1 = await reader.read(view1);
  assert_false(result1.done, 'first result should not be done');
  assert_array_equals([...result1.value], [0x01, 0x02], 'first result value');
  assert_equals(result1.value.byteOffset, 0, 'first result byteOffset');
  assert_equals(result1.value.byteLength, 2, 'first result byteLength');
  assert_equals(result1.value.buffer.byteLength, 10, 'first result buffer.byteLength');
  assert_equals(result1.value.buffer.maxByteLength, 20, 'first result buffer.maxByteLength');
  assert_true(result1.value.buffer.resizable, 'first result buffer should be resizable');

  assert_equals(pullCount, 1, 'pull() must have been called 1 time');

  {
    const byobRequest = byobRequests[0];
    assert_true(byobRequest.nonNull, 'first byobRequest must not be null');
    assert_true(byobRequest.viewNonNull, 'first byobRequest.view must not be null');
    const viewInfo = byobRequest.viewInfo;
    assert_equals(viewInfo.constructor, Uint8Array, 'first view.constructor should be Uint8Array');
    assert_equals(viewInfo.bufferByteLength, 10, 'first view.buffer.byteLength should be 10');
    assert_equals(viewInfo.bufferMaxByteLength, 20, 'first view.buffer.maxByteLength should be 20');
    assert_true(viewInfo.bufferResizable, 'first view.buffer should be resizable');
    assert_equals(viewInfo.byteOffset, 0, 'first view.byteOffset should be 0');
    assert_equals(viewInfo.byteLength, 3, 'first view.byteLength should be 3');
  }

  buffer = result1.value.buffer;
  const view2 = new Uint8Array(buffer, 2, 5);
  const result2 = await reader.read(view2);
  assert_false(result2.done, 'second result should not be done');
  assert_array_equals([...result2.value], [0x03], 'second result value');
  assert_equals(result2.value.byteOffset, 2, 'second result byteOffset');
  assert_equals(result2.value.byteLength, 1, 'second result byteLength');
  assert_equals(result2.value.buffer.byteLength, 10, 'second result buffer.byteLength');
  assert_equals(result2.value.buffer.maxByteLength, 20, 'second result buffer.maxByteLength');
  assert_true(result2.value.buffer.resizable, 'second result buffer should be resizable');

  assert_equals(pullCount, 2, 'pull() must have been called 2 times');

  {
    const byobRequest = byobRequests[1];
    assert_true(byobRequest.nonNull, 'second byobRequest must not be null');
    assert_true(byobRequest.viewNonNull, 'second byobRequest.view must not be null');
    const viewInfo = byobRequest.viewInfo;
    assert_equals(viewInfo.constructor, Uint8Array, 'second view.constructor should be Uint8Array');
    assert_equals(viewInfo.bufferByteLength, 10, 'second view.buffer.byteLength should be 10');
    assert_equals(viewInfo.bufferMaxByteLength, 20, 'second view.buffer.maxByteLength should be 20');
    assert_true(viewInfo.bufferResizable, 'second view.buffer should be resizable');
    assert_equals(viewInfo.byteOffset, 2, 'second view.byteOffset should be 2');
    assert_equals(viewInfo.byteLength, 5, 'second view.byteLength should be 5');
  }

}, 'ReadableStream with byte source: read() with a resizable buffer');
