import assert from "node:assert/strict";
import test from "node:test";
import { loadRestOperations } from "./openapi-operations.js";

const VALID_HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

// ---------------------------------------------------------- loadRestOperations

test("loadRestOperations: returns more than 500 operations", () => {
  const operations = loadRestOperations();
  assert.ok(operations.length > 500, `expected >500 operations, got ${operations.length}`);
});

test("loadRestOperations: all operations have valid HTTP methods", () => {
  for (const op of loadRestOperations()) {
    assert.ok(VALID_HTTP_METHODS.has(op.method), `invalid method ${op.method} on ${op.operationId}`);
  }
});

test("loadRestOperations: all operations have non-empty operationIds", () => {
  for (const op of loadRestOperations()) {
    assert.ok(typeof op.operationId === "string" && op.operationId.length > 0, "empty operationId");
  }
});

test("loadRestOperations: all operations have a path starting with /", () => {
  for (const op of loadRestOperations()) {
    assert.ok(op.path.startsWith("/"), `path does not start with /: ${op.path}`);
  }
});

test("loadRestOperations: all parameterNames arrays are sorted", () => {
  for (const op of loadRestOperations()) {
    const sorted = [...op.parameterNames].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(op.parameterNames, sorted, `parameterNames not sorted for ${op.operationId}`);
  }
});

test("loadRestOperations: result is sorted by operationId", () => {
  const operations = loadRestOperations();
  for (let i = 1; i < operations.length; i++) {
    assert.ok(
      operations[i - 1].operationId.localeCompare(operations[i].operationId) <= 0,
      `out of order: ${operations[i - 1].operationId} > ${operations[i].operationId}`
    );
  }
});

test("loadRestOperations: all operations have a tags array", () => {
  for (const op of loadRestOperations()) {
    assert.ok(Array.isArray(op.tags), `tags is not an array for ${op.operationId}`);
  }
});

test("loadRestOperations: operationIds are unique", () => {
  const operations = loadRestOperations();
  const ids = new Set(operations.map((op) => op.operationId));
  assert.equal(ids.size, operations.length, "duplicate operationIds found");
});

test("loadRestOperations: known well-known operations are present", () => {
  const operations = loadRestOperations();
  const ids = new Set(operations.map((op) => op.operationId));
  assert.ok(ids.has("repos/list-for-authenticated-user"), "repos/list-for-authenticated-user missing");
  assert.ok(ids.has("pulls/list"), "pulls/list missing");
  assert.ok(ids.has("issues/list-for-repo"), "issues/list-for-repo missing");
  assert.ok(ids.has("users/get-authenticated"), "users/get-authenticated missing");
  assert.ok(ids.has("search/code"), "search/code missing");
  assert.ok(ids.has("actions/list-workflow-runs-for-repo"), "actions/list-workflow-runs-for-repo missing");
});
