import { test } from "node:test";
import assert from "node:assert/strict";
import { createId } from "../src/id.ts";

test("IDs remain unique UUIDs when HTTP contexts lack randomUUID", (t) => {
  const crypto = globalThis.crypto;
  t.mock.getter(globalThis, "crypto", () => ({
    getRandomValues: crypto.getRandomValues.bind(crypto),
  }));
  const ids = Array.from({ length: 1000 }, () => createId());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
});

test("IDs use the native API when available", (t) => {
  const uuid = "b773b685-e82e-4d64-94bd-ffab1849cc34";
  const native = t.mock.method(globalThis.crypto, "randomUUID", () => uuid);
  assert.equal(createId(), uuid);
  assert.equal(native.mock.callCount(), 1);
});
