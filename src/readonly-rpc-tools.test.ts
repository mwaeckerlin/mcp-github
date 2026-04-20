import assert from "node:assert/strict";
import test from "node:test";
import { isReadonlyRpcToolName, runReadonlyRpcToolWithArguments } from "./readonly-rpc-tools.js";
import { listOperationMappings } from "./tools.js";

test("isReadonlyRpcToolName recognizes REST family", () => {
  assert.equal(isReadonlyRpcToolName("github_repositories_rest"), true);
  assert.equal(isReadonlyRpcToolName("github_graphql"), false);
});

test("runReadonlyRpcToolWithArguments runs mapped operation", async () => {
  const operation = listOperationMappings("github_repositories_rest")[0];
  const output = await runReadonlyRpcToolWithArguments(
    "github_repositories_rest",
    { operationId: operation.operationId, parameters: {} },
    {
      async callRestByOperationId(operationId, parameters) {
        return { operationId, parameters };
      }
    }
  );

  const parsed = JSON.parse(output) as { operationId: string };
  assert.equal(parsed.operationId, operation.operationId);
});
