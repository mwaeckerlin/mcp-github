import assert from "node:assert/strict";
import test from "node:test";
import { isReadonlyRpcToolName, runReadonlyRpcToolWithArguments, validateReadonlyRpcToolArguments, assertReadonlyRpcToolName } from "./readonly-rpc-tools.js";
import { listOperationMappings } from "./tools.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { REST_TOOL_FAMILY_NAMES } from "./tool-families.js";

// ---------------------------------------------------------- isReadonlyRpcToolName

test("isReadonlyRpcToolName: true for every REST family name", () => {
  for (const name of REST_TOOL_FAMILY_NAMES) {
    assert.equal(isReadonlyRpcToolName(name), true, `expected true for ${name}`);
  }
});

test("isReadonlyRpcToolName: false for github_graphql", () => {
  assert.equal(isReadonlyRpcToolName("github_graphql"), false);
});

test("isReadonlyRpcToolName: false for discovery tool", () => {
  assert.equal(isReadonlyRpcToolName("github_rest_list_operations"), false);
});

test("isReadonlyRpcToolName: false for empty string", () => {
  assert.equal(isReadonlyRpcToolName(""), false);
});

// ---------------------------------------------------------- assertReadonlyRpcToolName

test("assertReadonlyRpcToolName: returns valid family name unchanged", () => {
  assert.equal(assertReadonlyRpcToolName("github_repositories_rest"), "github_repositories_rest");
  assert.equal(assertReadonlyRpcToolName("github_issues_rest"), "github_issues_rest");
});

test("assertReadonlyRpcToolName: throws McpError for unknown name", () => {
  assert.throws(() => assertReadonlyRpcToolName("not_a_family"), (err) => err instanceof McpError);
});

// ---------------------------------------------------------- validateReadonlyRpcToolArguments

test("validateReadonlyRpcToolArguments: accepts valid operationId in the correct family", () => {
  const operation = listOperationMappings("github_repositories_rest")[0];
  assert.doesNotThrow(() =>
    validateReadonlyRpcToolArguments("github_repositories_rest", { operationId: operation.operationId, parameters: {} })
  );
});

test("validateReadonlyRpcToolArguments: rejects missing operationId", () => {
  assert.throws(
    () => validateReadonlyRpcToolArguments("github_repositories_rest", { parameters: {} }),
    (err) => err instanceof McpError
  );
});

test("validateReadonlyRpcToolArguments: rejects empty operationId string", () => {
  assert.throws(
    () => validateReadonlyRpcToolArguments("github_repositories_rest", { operationId: "   " }),
    (err) => err instanceof McpError
  );
});

test("validateReadonlyRpcToolArguments: rejects non-string operationId", () => {
  assert.throws(
    () => validateReadonlyRpcToolArguments("github_repositories_rest", { operationId: 42 }),
    (err) => err instanceof McpError
  );
});

test("validateReadonlyRpcToolArguments: rejects unknown operationId", () => {
  assert.throws(
    () => validateReadonlyRpcToolArguments("github_repositories_rest", { operationId: "not/an/operation" }),
    (err) => err instanceof McpError
  );
});

test("validateReadonlyRpcToolArguments: rejects operationId belonging to a different family", () => {
  const prOperation = listOperationMappings("github_pull_requests_rest")[0];
  assert.throws(
    () => validateReadonlyRpcToolArguments("github_repositories_rest", { operationId: prOperation.operationId }),
    (err) => err instanceof McpError
  );
});

test("validateReadonlyRpcToolArguments: clamps per_page to max 100", () => {
  const operation = listOperationMappings("github_repositories_rest").find((m) =>
    m.operationId.includes("repos/")
  )!;
  const result = validateReadonlyRpcToolArguments("github_repositories_rest", {
    operationId: operation.operationId,
    parameters: { per_page: 500 }
  });
  assert.equal((result.parameters as { per_page: number }).per_page, 100);
});

test("validateReadonlyRpcToolArguments: clamps nested page-size keys", () => {
  const operation = listOperationMappings("github_search_rest")[0];
  const result = validateReadonlyRpcToolArguments("github_search_rest", {
    operationId: operation.operationId,
    parameters: { per_page: 200, nested: { first: 999 } }
  });
  assert.equal((result.parameters as { per_page: number }).per_page, 100);
  assert.deepEqual((result.parameters as { nested: { first: number } }).nested, { first: 100 });
});

test("validateReadonlyRpcToolArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateReadonlyRpcToolArguments("github_repositories_rest", "not-an-object"),
    (err) => err instanceof McpError
  );
});

// ---------------------------------------------------------- runReadonlyRpcToolWithArguments

test("runReadonlyRpcToolWithArguments: calls client and returns JSON containing operationId", async () => {
  const operation = listOperationMappings("github_repositories_rest")[0];
  const output = await runReadonlyRpcToolWithArguments(
    "github_repositories_rest",
    { operationId: operation.operationId, parameters: {} },
    {
      async callRestByOperationId(operationId, parameters) {
        return { operationId, parameters, data: [] };
      }
    }
  );
  const parsed = JSON.parse(output) as { operationId: string };
  assert.equal(parsed.operationId, operation.operationId);
});

test("runReadonlyRpcToolWithArguments: propagates errors from the API client as-is", async () => {
  const operation = listOperationMappings("github_repositories_rest")[0];
  await assert.rejects(
    () =>
      runReadonlyRpcToolWithArguments(
        "github_repositories_rest",
        { operationId: operation.operationId, parameters: {} },
        {
          async callRestByOperationId() {
            throw new Error("network failure");
          }
        }
      ),
    /network failure/
  );
});

