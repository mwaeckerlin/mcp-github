import assert from "node:assert/strict";
import test from "node:test";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { runToolWithArguments } from "./server.js";
import { getToolDefinitions, getOperationFamily, listOperationMappings } from "./tools.js";

const mockedApiClient = {
  async callRestByOperationId(operationId: string, parameters: Record<string, unknown>) {
    return {
      status: 200,
      url: `https://api.github.com/mock/${operationId}`,
      data: { ok: true, operationId, parameters },
      headers: {}
    };
  },
  async callGraphQl(operationName: string, _query: string, variables: Record<string, unknown>) {
    return { ok: true, operationName, variables };
  }
};

test("all operations are classified into a tool family", () => {
  const mappings = listOperationMappings();
  assert.ok(mappings.length > 500);
  for (const mapping of mappings) {
    assert.ok(getOperationFamily(mapping.operationId));
  }
});

test("github_rest_list_operations returns bounded pages", async () => {
  const text = await runToolWithArguments("github_rest_list_operations", { family: "github_pull_requests_rest", limit: 3, offset: 1 }, mockedApiClient, new Set());
  const parsed = JSON.parse(text) as { count: number; operations: Array<{ family: string }> };
  assert.equal(parsed.count, 3);
  assert.ok(parsed.operations.every((entry) => entry.family === "github_pull_requests_rest"));
});

test("each REST family tool can execute at least one mapped operation", async () => {
  const definitions = getToolDefinitions().filter((definition) => definition.name.endsWith("_rest") && definition.name !== "github_rest_list_operations");

  for (const definition of definitions) {
    const operation = listOperationMappings(definition.name as never)[0];
    assert.ok(operation, `expected mapped operation for ${definition.name}`);
    const output = await runToolWithArguments(definition.name, { operationId: operation.operationId, parameters: {} }, mockedApiClient, new Set());
    const parsed = JSON.parse(output) as { operationId: string };
    assert.equal(parsed.operationId, operation.operationId);
  }
});

test("REST tool rejects operation from another family", async () => {
  const operation = listOperationMappings("github_pull_requests_rest")[0];
  await assert.rejects(
    () => runToolWithArguments("github_repositories_rest", { operationId: operation.operationId, parameters: {} }, mockedApiClient, new Set()),
    (error: unknown) => error instanceof McpError
  );
});

test("graphql tool requires operation name to appear in query", async () => {
  await assert.rejects(
    () => runToolWithArguments("github_graphql", { operationName: "Viewer", query: "query Other { viewer { login } }" }, mockedApiClient, new Set()),
    (error: unknown) => error instanceof McpError
  );

  const okOutput = await runToolWithArguments(
    "github_graphql",
    { operationName: "Viewer", query: "query Viewer { viewer { login } }", variables: { first: 150 } },
    mockedApiClient,
    new Set()
  );
  const parsed = JSON.parse(okOutput) as { data: { variables: { first: number } } };
  assert.equal(parsed.data.variables.first, 100);
});

test("disabled tools are blocked", async () => {
  await assert.rejects(
    () => runToolWithArguments("github_rest_list_operations", {}, mockedApiClient, new Set(["github_rest_list_operations"])),
    (error: unknown) => error instanceof McpError
  );
});
