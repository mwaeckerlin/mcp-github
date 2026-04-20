import assert from "node:assert/strict";
import test from "node:test";
import { isToolDisabled, loadDisabledToolsFromEnv } from "./disabled-tools.js";

test("loadDisabledToolsFromEnv parses comma-separated tools", () => {
  const disabled = loadDisabledToolsFromEnv({ DISABLE_TOOLS: "a,b, c " });
  assert.equal(disabled.has("a"), true);
  assert.equal(disabled.has("b"), true);
  assert.equal(disabled.has("c"), true);
});

test("isToolDisabled reports correctly", () => {
  assert.equal(isToolDisabled("x", new Set(["x"])), true);
  assert.equal(isToolDisabled("x", new Set(["y"])), false);
});
