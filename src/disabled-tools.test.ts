import assert from "node:assert/strict";
import test from "node:test";
import { isToolDisabled, loadDisabledToolsFromEnv, parseDisabledTools } from "./disabled-tools.js";
import { getToolDefinitions } from "./tools.js";

// ---------------------------------------------------------- parseDisabledTools

test("parseDisabledTools: supports comma separation", () => {
  const parsed = parseDisabledTools("github_graphql,github_rest_misc");
  assert.equal(parsed.has("github_graphql"), true);
  assert.equal(parsed.has("github_rest_misc"), true);
  assert.equal(parsed.size, 2);
});

test("parseDisabledTools: supports whitespace and comma mixed separation", () => {
  const parsed = parseDisabledTools(" github_repositories_rest, github_issues_rest  github_search_rest\tgithub_actions_workflows_rest ");
  assert.deepEqual([...parsed].sort(), [
    "github_actions_workflows_rest",
    "github_issues_rest",
    "github_repositories_rest",
    "github_search_rest"
  ]);
});

test("parseDisabledTools: ignores empty entries from multiple delimiters", () => {
  const parsed = parseDisabledTools(" , ,   \n\t ");
  assert.equal(parsed.size, 0);
});

test("parseDisabledTools: handles empty string", () => {
  const parsed = parseDisabledTools("");
  assert.equal(parsed.size, 0);
});

test("parseDisabledTools: returns single entry when only one tool listed", () => {
  const parsed = parseDisabledTools("github_graphql");
  assert.equal(parsed.size, 1);
  assert.equal(parsed.has("github_graphql"), true);
});

// ---------------------------------------------------------- loadDisabledToolsFromEnv

test("loadDisabledToolsFromEnv: reads DISABLE_TOOLS env var", () => {
  const disabled = loadDisabledToolsFromEnv({ DISABLE_TOOLS: "github_graphql,github_rest_misc" });
  assert.equal(disabled.has("github_graphql"), true);
  assert.equal(disabled.has("github_rest_misc"), true);
});

test("loadDisabledToolsFromEnv: returns empty set when env var is absent", () => {
  const disabled = loadDisabledToolsFromEnv({});
  assert.equal(disabled.size, 0);
});

test("loadDisabledToolsFromEnv: returns empty set when DISABLE_TOOLS is empty string", () => {
  const disabled = loadDisabledToolsFromEnv({ DISABLE_TOOLS: "" });
  assert.equal(disabled.size, 0);
});

// ---------------------------------------------------------- isToolDisabled

test("isToolDisabled: returns true for an exact match", () => {
  assert.equal(isToolDisabled("github_graphql", new Set(["github_graphql"])), true);
});

test("isToolDisabled: returns false when tool is not in the set", () => {
  assert.equal(isToolDisabled("github_repositories_rest", new Set(["github_graphql"])), false);
});

test("isToolDisabled: exact match only — does not match prefixes", () => {
  const disabled = new Set(["github_repositories_rest"]);
  assert.equal(isToolDisabled("github_repositories_rest_extra", disabled), false);
  assert.equal(isToolDisabled("github_repositories", disabled), false);
});

test("isToolDisabled: returns false for empty disabled set", () => {
  assert.equal(isToolDisabled("github_graphql", new Set()), false);
});

// ---------------------------------------------------------- getToolDefinitions + disabled

test("getToolDefinitions: hides disabled tools from the tool list", () => {
  const disabled = new Set<string>(["github_graphql", "github_rest_list_operations"]);
  const names = new Set(getToolDefinitions(disabled).map((tool) => tool.name));
  assert.equal(names.has("github_graphql"), false);
  assert.equal(names.has("github_rest_list_operations"), false);
  assert.equal(names.has("github_repositories_rest"), true);
  assert.equal(names.has("github_issues_rest"), true);
});

test("getToolDefinitions: returns all tools when disabled set is empty", () => {
  const all = getToolDefinitions(new Set());
  const names = all.map((t) => t.name);
  assert.ok(names.includes("github_graphql"));
  assert.ok(names.includes("github_rest_list_operations"));
  assert.ok(names.includes("github_repositories_rest"));
});

