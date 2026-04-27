import assert from "node:assert/strict";
import test from "node:test";
import { classifyOperationToFamily, getRestToolFamilies, REST_TOOL_FAMILY_NAMES } from "./tool-families.js";
import { loadRestOperations } from "./openapi-operations.js";

// ---------------------------------------------------------- classifyOperationToFamily

test("classifyOperationToFamily: every REST operation gets classified to a family", () => {
  const operations = loadRestOperations();
  for (const op of operations) {
    const family = classifyOperationToFamily(op);
    assert.ok(
      REST_TOOL_FAMILY_NAMES.includes(family),
      `invalid family ${family} for operation ${op.operationId}`
    );
  }
});

test("classifyOperationToFamily: branch operations go to github_branches_rest", () => {
  const ops = loadRestOperations().filter((op) => /branch/i.test(op.operationId));
  assert.ok(ops.length > 0, "expected at least one branch operation");
  for (const op of ops) {
    assert.equal(classifyOperationToFamily(op), "github_branches_rest");
  }
});

test("classifyOperationToFamily: pull-request operations (no earlier-matching keyword) go to github_pull_requests_rest", () => {
  // Only check PR operations that don't match an earlier classifier (commits, git, branch).
  const ops = loadRestOperations().filter(
    (op) =>
      (op.tags.includes("pulls") || op.operationId.startsWith("pulls/")) &&
      !/commit/i.test(op.operationId) &&
      !/branch/i.test(op.operationId) &&
      !op.tags.includes("git") &&
      !op.operationId.startsWith("git/")
  );
  assert.ok(ops.length > 0, "expected at least one qualifying PR operation");
  for (const op of ops) {
    assert.equal(
      classifyOperationToFamily(op),
      "github_pull_requests_rest",
      `unexpected family for ${op.operationId}`
    );
  }
});

test("classifyOperationToFamily: issues operations (non-label/milestone) go to github_issues_rest", () => {
  // Label and milestone operations have their own family and take priority over the generic
  // issues matcher, even if their operationId starts with "issues/".
  const ops = loadRestOperations().filter(
    (op) =>
      (op.tags.includes("issues") || op.operationId.startsWith("issues/")) &&
      !/label|milestone/i.test(op.operationId)
  );
  assert.ok(ops.length > 0, "expected at least one non-label/milestone issues operation");
  for (const op of ops) {
    assert.equal(classifyOperationToFamily(op), "github_issues_rest");
  }
});

test("classifyOperationToFamily: label and milestone operations go to github_labels_milestones_rest", () => {
  const labelOps = ["issues/list-labels-for-repo", "issues/get-label", "issues/list-milestones", "issues/get-milestone"];
  let checked = 0;
  for (const opId of labelOps) {
    const op = loadRestOperations().find((o) => o.operationId === opId);
    if (!op) continue;
    checked++;
    assert.equal(
      classifyOperationToFamily(op),
      "github_labels_milestones_rest",
      `expected ${opId} to be in github_labels_milestones_rest`
    );
  }
  assert.ok(checked > 0, "expected at least one known label/milestone operation to be present");
});

test("classifyOperationToFamily: search operations (no earlier-matching keyword) go to github_search_rest", () => {
  // Only check search operations that don't match an earlier classifier.
  const ops = loadRestOperations().filter(
    (op) =>
      (op.tags.includes("search") || op.operationId.startsWith("search/")) &&
      !/branch|commit|label|milestone/i.test(op.operationId) &&
      !op.tags.includes("git") &&
      !op.operationId.startsWith("git/")
  );
  assert.ok(ops.length > 0, "expected at least one qualifying search operation");
  for (const op of ops) {
    assert.equal(
      classifyOperationToFamily(op),
      "github_search_rest",
      `unexpected family for ${op.operationId}`
    );
  }
});

test("classifyOperationToFamily: core actions workflow operations go to github_actions_workflows_rest", () => {
  // Use specific operations that don't trigger earlier matchers (branch, commit, git, label, release/tag).
  const specificOps = [
    "actions/list-workflow-runs-for-repo",
    "actions/get-workflow",
    "actions/list-jobs-for-workflow-run"
  ];
  let checked = 0;
  for (const opId of specificOps) {
    const op = loadRestOperations().find((o) => o.operationId === opId);
    if (!op) continue;
    checked++;
    assert.equal(
      classifyOperationToFamily(op),
      "github_actions_workflows_rest",
      `unexpected family for ${opId}`
    );
  }
  assert.ok(checked > 0, "expected at least one known actions operation to be present");
});

test("classifyOperationToFamily: git blob/tree/ref operations (no commit keyword) go to github_git_data_rest", () => {
  // Use specific git operations that don't match the earlier commits classifier.
  const specificOps = ["git/create-blob", "git/get-blob", "git/create-tree", "git/get-tree"];
  let checked = 0;
  for (const opId of specificOps) {
    const op = loadRestOperations().find((o) => o.operationId === opId);
    if (!op) continue;
    checked++;
    assert.equal(
      classifyOperationToFamily(op),
      "github_git_data_rest",
      `unexpected family for ${opId}`
    );
  }
  assert.ok(checked > 0, "expected at least one known git operation to be present");
});

test("classifyOperationToFamily: fallback family is github_rest_misc", () => {
  const miscOp = loadRestOperations().find((op) => classifyOperationToFamily(op) === "github_rest_misc");
  assert.ok(miscOp !== undefined, "expected at least one misc operation");
});

// ---------------------------------------------------------- getRestToolFamilies

test("getRestToolFamilies: returns an entry for every family name", () => {
  const families = getRestToolFamilies();
  const names = new Set(families.map((f) => f.name));
  for (const name of REST_TOOL_FAMILY_NAMES) {
    assert.ok(names.has(name), `family ${name} missing from getRestToolFamilies()`);
  }
});

test("getRestToolFamilies: all families have non-empty descriptions", () => {
  for (const family of getRestToolFamilies()) {
    assert.ok(
      typeof family.description === "string" && family.description.length > 0,
      `empty description for family ${family.name}`
    );
  }
});

test("getRestToolFamilies: returns no duplicates", () => {
  const families = getRestToolFamilies();
  const names = families.map((f) => f.name);
  assert.equal(new Set(names).size, names.length, "duplicate family names");
});

// ---------------------------------------------------------- REST_TOOL_FAMILY_NAMES

test("REST_TOOL_FAMILY_NAMES: each family name has at least one operation", () => {
  const operations = loadRestOperations();
  for (const familyName of REST_TOOL_FAMILY_NAMES) {
    if (familyName === "github_rest_misc") {
      continue;
    }
    const matched = operations.filter((op) => classifyOperationToFamily(op) === familyName);
    assert.ok(matched.length > 0, `no operations in family ${familyName}`);
  }
});
