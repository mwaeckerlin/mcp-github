import assert from "node:assert/strict";
import test from "node:test";
import { listOperationMappings } from "./tools.js";
import { loadServerConfigFromEnv, validateGraphQlArguments, validateOperationListArguments, validateRestCallArguments } from "./validation.js";

test("loadServerConfigFromEnv parses and validates env", () => {
  const config = loadServerConfigFromEnv({
    GITHUB_TOKEN: "token",
    MCP_GITHUB_HOST: "127.0.0.1",
    MCP_GITHUB_PORT: "4010",
    DISABLE_TOOLS: "github_graphql,github_rest_misc"
  });
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4010);
  assert.ok(config.disabledTools.has("github_graphql"));
});

test("validateOperationListArguments clamps bounds", () => {
  const parsed = validateOperationListArguments({ limit: 999, offset: 20000 });
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.offset, 10000);
});

test("validateRestCallArguments enforces family and clamps page sizes", () => {
  const operationId = listOperationMappings("github_search_rest")[0].operationId;
  const parsed = validateRestCallArguments("github_search_rest", {
    operationId,
    parameters: { per_page: 400, nested: { first: 500 } }
  });

  assert.equal(parsed.parameters.per_page, 100);
  assert.deepEqual(parsed.parameters.nested, { first: 100 });
});

test("validateGraphQlArguments validates and clamps variables", () => {
  const parsed = validateGraphQlArguments({
    operationName: "Viewer",
    query: "query Viewer { viewer { login } }",
    variables: { first: 400 }
  });

  assert.equal((parsed.variables as { first: number }).first, 100);
});
