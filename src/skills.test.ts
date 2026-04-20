import assert from "node:assert/strict";
import test from "node:test";
import { isSkillsToolName, runSkillsToolWithArguments } from "./skills.js";

test("isSkillsToolName recognizes github_graphql", () => {
  assert.equal(isSkillsToolName("github_graphql"), true);
  assert.equal(isSkillsToolName("github_rest_misc"), false);
});

test("runSkillsToolWithArguments executes validated graphql call", async () => {
  const output = await runSkillsToolWithArguments(
    "github_graphql",
    { operationName: "Viewer", query: "query Viewer { viewer { login } }", variables: { first: 400 } },
    {
      async callGraphQl(operationName, _query, variables) {
        return { operationName, variables };
      }
    }
  );

  const parsed = JSON.parse(output) as { data: { variables: { first: number } } };
  assert.equal(parsed.data.variables.first, 100);
});
