import assert from "node:assert/strict";
import test from "node:test";
import { isHttpToolName, loadGatewayConfig, validateHttpToolArguments } from "./commands.js";

test("isHttpToolName detects list operation tool", () => {
  assert.equal(isHttpToolName("github_rest_list_operations"), true);
  assert.equal(isHttpToolName("github_graphql"), false);
});

test("loadGatewayConfig returns parsed server configuration", () => {
  const config = loadGatewayConfig({ GITHUB_TOKEN: "token", MCP_GITHUB_PORT: "4020" });
  assert.equal(config.port, 4020);
});

test("validateHttpToolArguments validates paging", () => {
  const parsed = validateHttpToolArguments("github_rest_list_operations", { limit: 500, offset: 20000 });
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.offset, 10000);
});
