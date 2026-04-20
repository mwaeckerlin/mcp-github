import assert from "node:assert/strict";
import test from "node:test";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { runToolWithArguments } from "./server.js";
import { getToolDefinitions, getOperationFamily, listOperationMappings } from "./tools.js";
import { REST_TOOL_FAMILY_NAMES } from "./tool-families.js";

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

// ---------------------------------------------------------- operation registry

test("all operations are classified into a tool family", () => {
  const mappings = listOperationMappings();
  assert.ok(mappings.length > 500, `expected >500 operations, got ${mappings.length}`);
  for (const mapping of mappings) {
    assert.ok(getOperationFamily(mapping.operationId), `no family for ${mapping.operationId}`);
  }
});

// ---------------------------------------------------------- github_rest_list_operations

test("github_rest_list_operations: returns bounded pages with correct structure", async () => {
  const text = await runToolWithArguments(
    "github_rest_list_operations",
    { family: "github_pull_requests_rest", limit: 3, offset: 1 },
    mockedApiClient,
    new Set()
  );
  const parsed = JSON.parse(text) as {
    total: number;
    count: number;
    offset: number;
    limit: number;
    operations: Array<{ family: string }>;
  };
  assert.equal(parsed.count, 3);
  assert.equal(parsed.limit, 3);
  assert.equal(parsed.offset, 1);
  assert.ok(typeof parsed.total === "number" && parsed.total > 0);
  assert.ok(parsed.operations.every((op) => op.family === "github_pull_requests_rest"));
});

test("github_rest_list_operations: lists all operations when no family filter", async () => {
  const text = await runToolWithArguments("github_rest_list_operations", { limit: 100 }, mockedApiClient, new Set());
  const parsed = JSON.parse(text) as { total: number; count: number };
  assert.ok(parsed.total > 500);
  assert.equal(parsed.count, 100);
});

test("github_rest_list_operations: offset beyond total returns empty operations", async () => {
  const text = await runToolWithArguments(
    "github_rest_list_operations",
    { family: "github_pull_requests_rest", limit: 10, offset: 10000 },
    mockedApiClient,
    new Set()
  );
  const parsed = JSON.parse(text) as { count: number; operations: unknown[] };
  assert.equal(parsed.count, 0);
  assert.equal(parsed.operations.length, 0);
});

// ---------------------------------------------------------- REST family tools

test("each REST family tool can execute at least one mapped operation", async () => {
  const definitions = getToolDefinitions().filter(
    (def) => def.name.endsWith("_rest") && def.name !== "github_rest_list_operations"
  );

  for (const definition of definitions) {
    const operation = listOperationMappings(definition.name as (typeof REST_TOOL_FAMILY_NAMES)[number])[0];
    assert.ok(operation, `no mapped operation for ${definition.name}`);
    const output = await runToolWithArguments(
      definition.name,
      { operationId: operation.operationId, parameters: {} },
      mockedApiClient,
      new Set()
    );
    const parsed = JSON.parse(output) as { operationId: string; family: string };
    assert.equal(parsed.operationId, operation.operationId);
    assert.equal(typeof parsed.family, "string");
  }
});

test("REST tool rejects operation from another family", async () => {
  const prOperation = listOperationMappings("github_pull_requests_rest")[0];
  await assert.rejects(
    () =>
      runToolWithArguments(
        "github_repositories_rest",
        { operationId: prOperation.operationId, parameters: {} },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

test("REST tool rejects missing operationId", async () => {
  await assert.rejects(
    () => runToolWithArguments("github_repositories_rest", { parameters: {} }, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});

test("REST tool rejects unknown operationId", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "github_repositories_rest",
        { operationId: "not/an/operation" },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

test("REST tool propagates McpError from API client", async () => {
  const operation = listOperationMappings("github_repositories_rest")[0];
  const failingClient = {
    async callRestByOperationId(): Promise<never> {
      throw new McpError(ErrorCode.InternalError, "GitHub API down");
    },
    async callGraphQl(): Promise<never> {
      throw new McpError(ErrorCode.InternalError, "GraphQL API down");
    }
  };
  await assert.rejects(
    () =>
      runToolWithArguments(
        "github_repositories_rest",
        { operationId: operation.operationId, parameters: {} },
        failingClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

// ---------------------------------------------------------- github_graphql

test("github_graphql: rejects when operationName is absent from query", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "github_graphql",
        { operationName: "Viewer", query: "query Other { viewer { login } }" },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

test("github_graphql: accepts valid query and clamps variables", async () => {
  const okOutput = await runToolWithArguments(
    "github_graphql",
    { operationName: "Viewer", query: "query Viewer { viewer { login } }", variables: { first: 150 } },
    mockedApiClient,
    new Set()
  );
  const parsed = JSON.parse(okOutput) as { data: { variables: { first: number } } };
  assert.equal(parsed.data.variables.first, 100);
});

test("github_graphql: rejects missing operationName", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "github_graphql",
        { query: "query Viewer { viewer { login } }" },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

test("github_graphql: rejects query that is too long", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "github_graphql",
        { operationName: "Viewer", query: "query Viewer { " + "x".repeat(20000) },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

// ---------------------------------------------------------- disabled tools

test("disabled tool returns McpError", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "github_rest_list_operations",
        {},
        mockedApiClient,
        new Set(["github_rest_list_operations"])
      ),
    (err) => err instanceof McpError
  );
});

test("disabled tool with family name returns McpError", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "github_repositories_rest",
        { operationId: listOperationMappings("github_repositories_rest")[0].operationId },
        mockedApiClient,
        new Set(["github_repositories_rest"])
      ),
    (err) => err instanceof McpError
  );
});

// ---------------------------------------------------------- unknown tool

test("unknown tool returns McpError", async () => {
  await assert.rejects(
    () => runToolWithArguments("not_a_real_tool", {}, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});

test("partially-matching tool name returns McpError", async () => {
  await assert.rejects(
    () => runToolWithArguments("github_repositories", {}, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});

