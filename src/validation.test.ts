import assert from "node:assert/strict";
import test from "node:test";
import { listOperationMappings } from "./tools.js";
import { loadServerConfigFromEnv, validateGraphQlArguments, validateOperationListArguments, validateRestCallArguments } from "./validation.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------- loadServerConfigFromEnv

test("loadServerConfigFromEnv: accepts valid configuration", () => {
  const config = loadServerConfigFromEnv({
    GITHUB_TOKEN: "ghp_token",
    MCP_GITHUB_HOST: "127.0.0.1",
    MCP_GITHUB_PORT: "4010",
    DISABLE_TOOLS: "github_graphql,github_rest_misc"
  });
  assert.equal(config.githubToken, "ghp_token");
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4010);
  assert.ok(config.disabledTools.has("github_graphql"));
  assert.ok(config.disabledTools.has("github_rest_misc"));
});

test("loadServerConfigFromEnv: defaults host to 0.0.0.0 and port to 4000", () => {
  const config = loadServerConfigFromEnv({ GITHUB_TOKEN: "tok" });
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 4000);
  assert.equal(config.disabledTools.size, 0);
});

test("loadServerConfigFromEnv: accepts missing GITHUB_TOKEN and marks token as undefined", () => {
  const config = loadServerConfigFromEnv({});
  assert.equal(config.githubToken, undefined);
});

test("loadServerConfigFromEnv: accepts whitespace-only GITHUB_TOKEN as undefined", () => {
  const config = loadServerConfigFromEnv({ GITHUB_TOKEN: "   " });
  assert.equal(config.githubToken, undefined);
});

test("loadServerConfigFromEnv: loads MCP_AUTH_TOKEN from env", () => {
  const config = loadServerConfigFromEnv({ MCP_AUTH_TOKEN: "my-secret-token" });
  assert.equal(config.mcpAuthToken, "my-secret-token");
});

test("loadServerConfigFromEnv: trims MCP_AUTH_TOKEN whitespace", () => {
  const config = loadServerConfigFromEnv({ MCP_AUTH_TOKEN: "  trimmed  " });
  assert.equal(config.mcpAuthToken, "trimmed");
});

test("loadServerConfigFromEnv: accepts missing MCP_AUTH_TOKEN as undefined", () => {
  const config = loadServerConfigFromEnv({});
  assert.equal(config.mcpAuthToken, undefined);
});

test("loadServerConfigFromEnv: accepts whitespace-only MCP_AUTH_TOKEN as undefined", () => {
  const config = loadServerConfigFromEnv({ MCP_AUTH_TOKEN: "   " });
  assert.equal(config.mcpAuthToken, undefined);
});

test("loadServerConfigFromEnv: throws when MCP_GITHUB_PORT is non-numeric", () => {
  assert.throws(() => loadServerConfigFromEnv({ GITHUB_TOKEN: "tok", MCP_GITHUB_PORT: "xyz" }), /MCP_GITHUB_PORT/);
});

test("loadServerConfigFromEnv: throws when MCP_GITHUB_PORT is 0", () => {
  assert.throws(() => loadServerConfigFromEnv({ GITHUB_TOKEN: "tok", MCP_GITHUB_PORT: "0" }), /MCP_GITHUB_PORT/);
});

test("loadServerConfigFromEnv: throws when MCP_GITHUB_PORT is 65536", () => {
  assert.throws(() => loadServerConfigFromEnv({ GITHUB_TOKEN: "tok", MCP_GITHUB_PORT: "65536" }), /MCP_GITHUB_PORT/);
});

// ---------------------------------------------------------- validateOperationListArguments

test("validateOperationListArguments: defaults limit to 50 and offset to 0", () => {
  const parsed = validateOperationListArguments(undefined);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.family, undefined);
});

test("validateOperationListArguments: accepts valid family filter", () => {
  const parsed = validateOperationListArguments({ family: "github_pull_requests_rest" });
  assert.equal(parsed.family, "github_pull_requests_rest");
});

test("validateOperationListArguments: clamps limit above 100", () => {
  const parsed = validateOperationListArguments({ limit: 999 });
  assert.equal(parsed.limit, 100);
});

test("validateOperationListArguments: clamps limit below 1 to 1", () => {
  const parsed = validateOperationListArguments({ limit: 0 });
  assert.equal(parsed.limit, 1);
});

test("validateOperationListArguments: clamps offset above 10000", () => {
  const parsed = validateOperationListArguments({ offset: 99999 });
  assert.equal(parsed.offset, 10000);
});

test("validateOperationListArguments: rejects unknown family string", () => {
  assert.throws(
    () => validateOperationListArguments({ family: "github_nonexistent_rest" }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-number limit", () => {
  assert.throws(
    () => validateOperationListArguments({ limit: "ten" }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects negative offset", () => {
  assert.throws(
    () => validateOperationListArguments({ offset: -1 }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-integer offset", () => {
  assert.throws(
    () => validateOperationListArguments({ offset: 1.5 }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateOperationListArguments("not-an-object"),
    (err) => err instanceof McpError
  );
});

// ---------------------------------------------------------- validateRestCallArguments

test("validateRestCallArguments: accepts valid args in correct family", () => {
  const operationId = listOperationMappings("github_search_rest")[0].operationId;
  const parsed = validateRestCallArguments("github_search_rest", {
    operationId,
    parameters: { q: "repo:github" }
  });
  assert.equal(parsed.operationId, operationId);
  assert.equal((parsed.parameters as { q: string }).q, "repo:github");
});

test("validateRestCallArguments: clamps per_page to max 100", () => {
  const operationId = listOperationMappings("github_search_rest")[0].operationId;
  const parsed = validateRestCallArguments("github_search_rest", {
    operationId,
    parameters: { per_page: 400 }
  });
  assert.equal((parsed.parameters as { per_page: number }).per_page, 100);
});

test("validateRestCallArguments: clamps nested page-size keys", () => {
  const operationId = listOperationMappings("github_search_rest")[0].operationId;
  const parsed = validateRestCallArguments("github_search_rest", {
    operationId,
    parameters: { per_page: 400, nested: { first: 500 } }
  });
  assert.equal((parsed.parameters as { per_page: number }).per_page, 100);
  assert.deepEqual((parsed.parameters as { nested: { first: number } }).nested, { first: 100 });
});

test("validateRestCallArguments: defaults per_page when supported by operation and missing", () => {
  const operationId = listOperationMappings("github_repositories_rest").find(
    (m) => m.operationId === "repos/list-for-authenticated-user"
  )?.operationId ?? listOperationMappings("github_repositories_rest")[0].operationId;
  const parsed = validateRestCallArguments("github_repositories_rest", {
    operationId,
    parameters: {}
  });
  const perPage = (parsed.parameters as { per_page?: number }).per_page;
  if (perPage !== undefined) {
    assert.equal(perPage, 30);
  }
});

test("validateRestCallArguments: rejects missing operationId", () => {
  assert.throws(
    () => validateRestCallArguments("github_repositories_rest", { parameters: {} }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects empty operationId string", () => {
  assert.throws(
    () => validateRestCallArguments("github_repositories_rest", { operationId: "   " }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects unknown operationId", () => {
  assert.throws(
    () => validateRestCallArguments("github_repositories_rest", { operationId: "fake/operation" }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects operationId from a different family", () => {
  const prOpId = listOperationMappings("github_pull_requests_rest")[0].operationId;
  assert.throws(
    () => validateRestCallArguments("github_repositories_rest", { operationId: prOpId, parameters: {} }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateRestCallArguments("github_repositories_rest", null),
    (err) => err instanceof McpError
  );
});

// ---------------------------------------------------------- validateGraphQlArguments

test("validateGraphQlArguments: accepts valid query with matching operationName", () => {
  const parsed = validateGraphQlArguments({
    operationName: "Viewer",
    query: "query Viewer { viewer { login } }",
    variables: { first: 10 }
  });
  assert.equal(parsed.operationName, "Viewer");
  assert.equal(typeof parsed.query, "string");
});

test("validateGraphQlArguments: rejects missing operationName", () => {
  assert.throws(
    () => validateGraphQlArguments({ query: "query X { viewer { login } }" }),
    (err) => err instanceof McpError
  );
});

test("validateGraphQlArguments: rejects empty operationName", () => {
  assert.throws(
    () => validateGraphQlArguments({ operationName: "", query: "query X { viewer { login } }" }),
    (err) => err instanceof McpError
  );
});

test("validateGraphQlArguments: rejects missing query", () => {
  assert.throws(
    () => validateGraphQlArguments({ operationName: "Viewer" }),
    (err) => err instanceof McpError
  );
});

test("validateGraphQlArguments: rejects empty query", () => {
  assert.throws(
    () => validateGraphQlArguments({ operationName: "Viewer", query: "   " }),
    (err) => err instanceof McpError
  );
});

test("validateGraphQlArguments: rejects query exceeding 20000 characters", () => {
  assert.throws(
    () =>
      validateGraphQlArguments({
        operationName: "Viewer",
        query: "query Viewer { " + "x".repeat(20000)
      }),
    (err) => err instanceof McpError
  );
});

test("validateGraphQlArguments: rejects operationName not present as word boundary in query", () => {
  assert.throws(
    () =>
      validateGraphQlArguments({
        operationName: "Viewer",
        query: "query OtherName { viewer { login } }"
      }),
    (err) => err instanceof McpError
  );
});

test("validateGraphQlArguments: clamps page-size variable values", () => {
  const parsed = validateGraphQlArguments({
    operationName: "Viewer",
    query: "query Viewer { viewer { login } }",
    variables: { first: 400 }
  });
  assert.equal((parsed.variables as { first: number }).first, 100);
});

test("validateGraphQlArguments: rejects non-object variables", () => {
  assert.throws(
    () =>
      validateGraphQlArguments({
        operationName: "Viewer",
        query: "query Viewer { viewer { login } }",
        variables: "not-an-object"
      }),
    (err) => err instanceof McpError
  );
});

test("validateGraphQlArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateGraphQlArguments("not-an-object"),
    (err) => err instanceof McpError
  );
});

