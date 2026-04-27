import assert from "node:assert/strict";
import test from "node:test";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { isHttpToolName, loadGatewayConfig, validateHttpToolArguments, isRestToolFamilyName, assertRestToolFamilyName } from "./commands.js";

// ---------------------------------------------------------- isHttpToolName

test("isHttpToolName: true for github_rest_list_operations", () => {
  assert.equal(isHttpToolName("github_rest_list_operations"), true);
});

test("isHttpToolName: false for REST family tool names", () => {
  assert.equal(isHttpToolName("github_repositories_rest"), false);
  assert.equal(isHttpToolName("github_pull_requests_rest"), false);
});

test("isHttpToolName: false for graphql tool", () => {
  assert.equal(isHttpToolName("github_graphql"), false);
});

test("isHttpToolName: false for completely unknown names", () => {
  assert.equal(isHttpToolName("not_a_tool"), false);
  assert.equal(isHttpToolName(""), false);
});

// ---------------------------------------------------------- loadGatewayConfig

test("loadGatewayConfig: reads port correctly", () => {
  const config = loadGatewayConfig({ GITHUB_TOKEN: "tok", MCP_GITHUB_PORT: "4020" });
  assert.equal(config.port, 4020);
  assert.equal(config.githubToken, "tok");
});

test("loadGatewayConfig: defaults port to 4000 and host to 0.0.0.0", () => {
  const config = loadGatewayConfig({ GITHUB_TOKEN: "tok" });
  assert.equal(config.port, 4000);
  assert.equal(config.host, "0.0.0.0");
});

test("loadGatewayConfig: accepts missing GITHUB_TOKEN and marks token as undefined", () => {
  const config = loadGatewayConfig({});
  assert.equal(config.githubToken, undefined);
});

test("loadGatewayConfig: accepts blank GITHUB_TOKEN as undefined", () => {
  const config = loadGatewayConfig({ GITHUB_TOKEN: "   " });
  assert.equal(config.githubToken, undefined);
});

test("loadGatewayConfig: throws when MCP_GITHUB_PORT is non-numeric", () => {
  assert.throws(() => loadGatewayConfig({ GITHUB_TOKEN: "tok", MCP_GITHUB_PORT: "abc" }), /MCP_GITHUB_PORT/);
});

test("loadGatewayConfig: throws when MCP_GITHUB_PORT is out of range", () => {
  assert.throws(() => loadGatewayConfig({ GITHUB_TOKEN: "tok", MCP_GITHUB_PORT: "0" }), /MCP_GITHUB_PORT/);
  assert.throws(() => loadGatewayConfig({ GITHUB_TOKEN: "tok", MCP_GITHUB_PORT: "65536" }), /MCP_GITHUB_PORT/);
});

// ---------------------------------------------------------- validateHttpToolArguments

test("validateHttpToolArguments: clamps limit above 100", () => {
  const parsed = validateHttpToolArguments("github_rest_list_operations", { limit: 500, offset: 0 });
  assert.equal(parsed.limit, 100);
});

test("validateHttpToolArguments: clamps offset above 10000", () => {
  const parsed = validateHttpToolArguments("github_rest_list_operations", { limit: 10, offset: 20000 });
  assert.equal(parsed.offset, 10000);
});

test("validateHttpToolArguments: accepts undefined arguments and applies defaults", () => {
  const parsed = validateHttpToolArguments("github_rest_list_operations", undefined);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
});

test("validateHttpToolArguments: rejects non-number limit", () => {
  assert.throws(() => validateHttpToolArguments("github_rest_list_operations", { limit: "ten" }));
});

test("validateHttpToolArguments: rejects negative offset", () => {
  assert.throws(() => validateHttpToolArguments("github_rest_list_operations", { offset: -1 }));
});

// ---------------------------------------------------------- isRestToolFamilyName

test("isRestToolFamilyName: true for all defined family names", () => {
  assert.equal(isRestToolFamilyName("github_repositories_rest"), true);
  assert.equal(isRestToolFamilyName("github_pull_requests_rest"), true);
  assert.equal(isRestToolFamilyName("github_issues_rest"), true);
  assert.equal(isRestToolFamilyName("github_search_rest"), true);
  assert.equal(isRestToolFamilyName("github_rest_misc"), true);
});

test("isRestToolFamilyName: false for non-family names", () => {
  assert.equal(isRestToolFamilyName("github_graphql"), false);
  assert.equal(isRestToolFamilyName("github_rest_list_operations"), false);
  assert.equal(isRestToolFamilyName(""), false);
});

// ---------------------------------------------------------- assertRestToolFamilyName

test("assertRestToolFamilyName: returns name for valid family", () => {
  assert.equal(assertRestToolFamilyName("github_repositories_rest"), "github_repositories_rest");
});

test("assertRestToolFamilyName: throws McpError for unknown name", () => {
  assert.throws(() => assertRestToolFamilyName("unknown_tool"), (err) => err instanceof McpError);
});

