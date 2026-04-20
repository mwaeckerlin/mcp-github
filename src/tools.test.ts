import assert from "node:assert/strict";
import test from "node:test";
import {
  TOOL_DEFINITIONS,
  getToolDefinitions,
  getOperationFamily,
  listOperationMappings,
  getOperationsForFamily
} from "./tools.js";
import { REST_TOOL_FAMILY_NAMES } from "./tool-families.js";

// ---------------------------------------------------------- TOOL_DEFINITIONS

test("TOOL_DEFINITIONS: includes github_rest_list_operations", () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  assert.ok(names.includes("github_rest_list_operations"));
});

test("TOOL_DEFINITIONS: includes github_graphql", () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  assert.ok(names.includes("github_graphql"));
});

test("TOOL_DEFINITIONS: includes every REST family tool", () => {
  const names = new Set(TOOL_DEFINITIONS.map((t) => t.name));
  for (const familyName of REST_TOOL_FAMILY_NAMES) {
    assert.ok(names.has(familyName), `TOOL_DEFINITIONS missing ${familyName}`);
  }
});

test("TOOL_DEFINITIONS: all tools have non-empty descriptions", () => {
  for (const tool of TOOL_DEFINITIONS) {
    assert.ok(
      typeof tool.description === "string" && tool.description.length > 0,
      `empty description for ${tool.name}`
    );
  }
});

test("TOOL_DEFINITIONS: all tools have inputSchema with type=object", () => {
  for (const tool of TOOL_DEFINITIONS) {
    assert.equal(tool.inputSchema.type, "object", `bad schema type for ${tool.name}`);
  }
});

test("TOOL_DEFINITIONS: tool names are unique", () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "duplicate tool names in TOOL_DEFINITIONS");
});

// ---------------------------------------------------------- getToolDefinitions

test("getToolDefinitions: returns all tools when no tools are disabled", () => {
  const all = getToolDefinitions(new Set());
  assert.equal(all.length, TOOL_DEFINITIONS.length);
});

test("getToolDefinitions: filters out disabled tools", () => {
  const disabled = new Set<string>(["github_graphql", "github_rest_list_operations"]);
  const filtered = getToolDefinitions(disabled);
  const names = new Set(filtered.map((t) => t.name));
  assert.equal(names.has("github_graphql"), false);
  assert.equal(names.has("github_rest_list_operations"), false);
  assert.equal(names.has("github_repositories_rest"), true);
});

test("getToolDefinitions: returns all tools when called without argument", () => {
  const all = getToolDefinitions();
  assert.equal(all.length, TOOL_DEFINITIONS.length);
});

test("getToolDefinitions: disabling all tools returns empty array", () => {
  const allNames = new Set(TOOL_DEFINITIONS.map((t) => t.name));
  const filtered = getToolDefinitions(allNames);
  assert.equal(filtered.length, 0);
});

// ---------------------------------------------------------- getOperationFamily

test("getOperationFamily: returns correct family for repos operation", () => {
  const family = getOperationFamily("repos/list-for-authenticated-user");
  assert.equal(family, "github_repositories_rest");
});

test("getOperationFamily: returns correct family for pulls operation", () => {
  const family = getOperationFamily("pulls/list");
  assert.equal(family, "github_pull_requests_rest");
});

test("getOperationFamily: returns correct family for issues operation", () => {
  const family = getOperationFamily("issues/list-for-repo");
  assert.equal(family, "github_issues_rest");
});

test("getOperationFamily: returns correct family for search operation", () => {
  const family = getOperationFamily("search/code");
  assert.equal(family, "github_search_rest");
});

test("getOperationFamily: returns undefined for unknown operationId", () => {
  const family = getOperationFamily("fake/operation/id");
  assert.equal(family, undefined);
});

test("getOperationFamily: returns undefined for empty string", () => {
  const family = getOperationFamily("");
  assert.equal(family, undefined);
});

// ---------------------------------------------------------- listOperationMappings

test("listOperationMappings: returns all operations when called without filter", () => {
  const all = listOperationMappings();
  assert.ok(all.length > 500, `expected >500, got ${all.length}`);
});

test("listOperationMappings: filters to only the specified family", () => {
  const prs = listOperationMappings("github_pull_requests_rest");
  assert.ok(prs.length > 0);
  for (const mapping of prs) {
    assert.equal(mapping.family, "github_pull_requests_rest");
  }
});

test("listOperationMappings: result is sorted by operationId", () => {
  const all = listOperationMappings();
  for (let i = 1; i < all.length; i++) {
    assert.ok(
      all[i - 1].operationId.localeCompare(all[i].operationId) <= 0,
      `out of order: ${all[i - 1].operationId} > ${all[i].operationId}`
    );
  }
});

test("listOperationMappings: all results have family and operationId fields", () => {
  const sample = listOperationMappings().slice(0, 50);
  for (const mapping of sample) {
    assert.ok(typeof mapping.operationId === "string" && mapping.operationId.length > 0);
    assert.ok(REST_TOOL_FAMILY_NAMES.includes(mapping.family));
  }
});

test("listOperationMappings: each family has at least one operation", () => {
  for (const familyName of REST_TOOL_FAMILY_NAMES) {
    const ops = listOperationMappings(familyName);
    assert.ok(ops.length > 0, `family ${familyName} has no operations`);
  }
});

// ---------------------------------------------------------- getOperationsForFamily

test("getOperationsForFamily: returns sorted array for github_pull_requests_rest", () => {
  const ops = getOperationsForFamily("github_pull_requests_rest");
  assert.ok(ops.length > 0);
  for (let i = 1; i < ops.length; i++) {
    assert.ok(ops[i - 1].localeCompare(ops[i]) <= 0, `out of order: ${ops[i - 1]} > ${ops[i]}`);
  }
});

test("getOperationsForFamily: result operationIds are all in the expected family", () => {
  const ops = getOperationsForFamily("github_issues_rest");
  for (const opId of ops) {
    assert.equal(getOperationFamily(opId), "github_issues_rest");
  }
});

test("getOperationsForFamily: every REST family name returns a non-empty array", () => {
  for (const familyName of REST_TOOL_FAMILY_NAMES) {
    const ops = getOperationsForFamily(familyName);
    assert.ok(ops.length > 0, `getOperationsForFamily(${familyName}) returned empty`);
  }
});
