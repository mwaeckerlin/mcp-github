import assert from "node:assert/strict";
import test from "node:test";
import { isSkillsToolName, runSkillsToolWithArguments, validateSkillsToolArguments } from "./skills.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------- isSkillsToolName

test("isSkillsToolName: true for github_graphql", () => {
  assert.equal(isSkillsToolName("github_graphql"), true);
});

test("isSkillsToolName: false for REST family tools", () => {
  assert.equal(isSkillsToolName("github_repositories_rest"), false);
  assert.equal(isSkillsToolName("github_rest_misc"), false);
});

test("isSkillsToolName: false for discovery tool", () => {
  assert.equal(isSkillsToolName("github_rest_list_operations"), false);
});

test("isSkillsToolName: false for empty string", () => {
  assert.equal(isSkillsToolName(""), false);
});

// ---------------------------------------------------------- validateSkillsToolArguments

test("validateSkillsToolArguments: accepts valid operationName and query", () => {
  assert.doesNotThrow(() =>
    validateSkillsToolArguments("github_graphql", {
      operationName: "Viewer",
      query: "query Viewer { viewer { login } }"
    })
  );
});

test("validateSkillsToolArguments: rejects missing operationName", () => {
  assert.throws(
    () => validateSkillsToolArguments("github_graphql", { query: "query Viewer { viewer { login } }" }),
    (err) => err instanceof McpError
  );
});

test("validateSkillsToolArguments: rejects empty operationName", () => {
  assert.throws(
    () => validateSkillsToolArguments("github_graphql", { operationName: "", query: "query X { viewer { login } }" }),
    (err) => err instanceof McpError
  );
});

test("validateSkillsToolArguments: rejects missing query", () => {
  assert.throws(
    () => validateSkillsToolArguments("github_graphql", { operationName: "Viewer" }),
    (err) => err instanceof McpError
  );
});

test("validateSkillsToolArguments: rejects empty query", () => {
  assert.throws(
    () => validateSkillsToolArguments("github_graphql", { operationName: "Viewer", query: "   " }),
    (err) => err instanceof McpError
  );
});

test("validateSkillsToolArguments: rejects query longer than 20000 characters", () => {
  assert.throws(
    () =>
      validateSkillsToolArguments("github_graphql", {
        operationName: "Viewer",
        query: "query Viewer { " + "x".repeat(20000)
      }),
    (err) => err instanceof McpError
  );
});

test("validateSkillsToolArguments: rejects query that does not contain operationName", () => {
  assert.throws(
    () =>
      validateSkillsToolArguments("github_graphql", {
        operationName: "Viewer",
        query: "query Other { viewer { login } }"
      }),
    (err) => err instanceof McpError
  );
});

test("validateSkillsToolArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateSkillsToolArguments("github_graphql", "not-an-object"),
    (err) => err instanceof McpError
  );
});

test("validateSkillsToolArguments: clamps page-size variables", () => {
  const result = validateSkillsToolArguments("github_graphql", {
    operationName: "Viewer",
    query: "query Viewer { viewer { login } }",
    variables: { first: 999, limit: 200 }
  });
  assert.equal((result.variables as { first: number }).first, 100);
  assert.equal((result.variables as { limit: number }).limit, 100);
});

// ---------------------------------------------------------- runSkillsToolWithArguments

test("runSkillsToolWithArguments: calls client and returns JSON with operationName and data", async () => {
  const output = await runSkillsToolWithArguments(
    "github_graphql",
    { operationName: "Viewer", query: "query Viewer { viewer { login } }", variables: { first: 400 } },
    {
      async callGraphQl(operationName, _query, variables) {
        return { operationName, variables };
      }
    }
  );
  const parsed = JSON.parse(output) as { operationName: string; data: { variables: { first: number } } };
  assert.equal(parsed.operationName, "Viewer");
  assert.equal(parsed.data.variables.first, 100);
});

test("runSkillsToolWithArguments: propagates errors from the API client as-is", async () => {
  await assert.rejects(
    () =>
      runSkillsToolWithArguments(
        "github_graphql",
        { operationName: "Viewer", query: "query Viewer { viewer { login } }" },
        {
          async callGraphQl() {
            throw new Error("GraphQL network failure");
          }
        }
      ),
    /GraphQL network failure/
  );
});

