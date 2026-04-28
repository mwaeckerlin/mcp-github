import assert from "node:assert/strict";
import test from "node:test";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { isCopilotToolName, validateCopilotAssignArguments, runCopilotToolWithArguments } from "./copilot-tools.js";

// ---------------------------------------------------------- isCopilotToolName

test("isCopilotToolName: true for github_copilot_assign_issue", () => {
  assert.equal(isCopilotToolName("github_copilot_assign_issue"), true);
});

test("isCopilotToolName: false for REST family tools", () => {
  assert.equal(isCopilotToolName("github_issues_rest"), false);
  assert.equal(isCopilotToolName("github_repositories_rest"), false);
});

test("isCopilotToolName: false for other tools", () => {
  assert.equal(isCopilotToolName("github_graphql"), false);
  assert.equal(isCopilotToolName("github_rest_list_operations"), false);
  assert.equal(isCopilotToolName(""), false);
});

// ---------------------------------------------------------- validateCopilotAssignArguments

test("validateCopilotAssignArguments: accepts minimal valid arguments", () => {
  const result = validateCopilotAssignArguments({ owner: "octo-org", repo: "octo-repo", issue_number: 42 });
  assert.equal(result.owner, "octo-org");
  assert.equal(result.repo, "octo-repo");
  assert.equal(result.issue_number, 42);
  assert.equal(result.agent_assignment, undefined);
});

test("validateCopilotAssignArguments: accepts agent_assignment", () => {
  const result = validateCopilotAssignArguments({
    owner: "octo-org",
    repo: "octo-repo",
    issue_number: 1,
    agent_assignment: {
      target_repo: "octo-org/octo-repo",
      base_branch: "main",
      custom_instructions: "Focus on the tests",
      custom_agent: "",
      model: "gpt-4o"
    }
  });
  assert.equal(result.agent_assignment?.target_repo, "octo-org/octo-repo");
  assert.equal(result.agent_assignment?.base_branch, "main");
  assert.equal(result.agent_assignment?.custom_instructions, "Focus on the tests");
  assert.equal(result.agent_assignment?.model, "gpt-4o");
});

test("validateCopilotAssignArguments: accepts partial agent_assignment", () => {
  const result = validateCopilotAssignArguments({
    owner: "org",
    repo: "repo",
    issue_number: 5,
    agent_assignment: { custom_instructions: "Use TypeScript" }
  });
  assert.equal(result.agent_assignment?.custom_instructions, "Use TypeScript");
  assert.equal(result.agent_assignment?.base_branch, undefined);
});

test("validateCopilotAssignArguments: rejects missing owner", () => {
  assert.throws(
    () => validateCopilotAssignArguments({ repo: "repo", issue_number: 1 }),
    (err) => err instanceof McpError && err.code === ErrorCode.InvalidParams
  );
});

test("validateCopilotAssignArguments: rejects empty owner", () => {
  assert.throws(
    () => validateCopilotAssignArguments({ owner: "", repo: "repo", issue_number: 1 }),
    (err) => err instanceof McpError
  );
});

test("validateCopilotAssignArguments: rejects missing repo", () => {
  assert.throws(
    () => validateCopilotAssignArguments({ owner: "org", issue_number: 1 }),
    (err) => err instanceof McpError
  );
});

test("validateCopilotAssignArguments: rejects missing issue_number", () => {
  assert.throws(
    () => validateCopilotAssignArguments({ owner: "org", repo: "repo" }),
    (err) => err instanceof McpError
  );
});

test("validateCopilotAssignArguments: rejects non-integer issue_number", () => {
  assert.throws(
    () => validateCopilotAssignArguments({ owner: "org", repo: "repo", issue_number: 1.5 }),
    (err) => err instanceof McpError
  );
});

test("validateCopilotAssignArguments: rejects zero issue_number", () => {
  assert.throws(
    () => validateCopilotAssignArguments({ owner: "org", repo: "repo", issue_number: 0 }),
    (err) => err instanceof McpError
  );
});

test("validateCopilotAssignArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateCopilotAssignArguments("not an object"),
    (err) => err instanceof McpError
  );
});

test("validateCopilotAssignArguments: rejects non-object agent_assignment", () => {
  assert.throws(
    () => validateCopilotAssignArguments({ owner: "org", repo: "repo", issue_number: 1, agent_assignment: "bad" }),
    (err) => err instanceof McpError
  );
});

// ---------------------------------------------------------- runCopilotToolWithArguments

const mockedClient = {
  assignCopilotToIssue: async (owner: string, repo: string, issueNumber: number) => ({
    status: 201,
    url: `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
    data: { number: issueNumber, assignees: [{ login: "copilot-swe-agent[bot]" }] },
    headers: {}
  })
};

test("runCopilotToolWithArguments: calls client and returns JSON with owner/repo/issue_number/data", async () => {
  const output = await runCopilotToolWithArguments(
    "github_copilot_assign_issue",
    { owner: "octo-org", repo: "octo-repo", issue_number: 7 },
    mockedClient
  );
  const parsed = JSON.parse(output) as { owner: string; repo: string; issue_number: number; data: unknown };
  assert.equal(parsed.owner, "octo-org");
  assert.equal(parsed.repo, "octo-repo");
  assert.equal(parsed.issue_number, 7);
  assert.ok(parsed.data !== undefined);
});

test("runCopilotToolWithArguments: propagates errors from the API client", async () => {
  const failingClient = {
    assignCopilotToIssue: async () => {
      throw new McpError(ErrorCode.InternalError, "GitHub API error (422): test error");
    }
  };
  await assert.rejects(
    () => runCopilotToolWithArguments("github_copilot_assign_issue", { owner: "org", repo: "repo", issue_number: 1 }, failingClient),
    (err) => err instanceof McpError
  );
});
