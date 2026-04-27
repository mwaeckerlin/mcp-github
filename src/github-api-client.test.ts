import assert from "node:assert/strict";
import test from "node:test";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { __testing } from "./github-api-client.js";

const { normalizeGitHubError, redactSecrets } = __testing;

// ---------------------------------------------------------- normalizeGitHubError

test("normalizeGitHubError: maps HTTP 401 to authentication error", () => {
  const err = Object.assign(new Error("Unauthorized"), { status: 401 });
  const result = normalizeGitHubError(err);
  assert.ok(result instanceof McpError);
  assert.equal(result.code, ErrorCode.InternalError);
  assert.ok(result.message.includes("401"));
  assert.ok(/authentication|permission/i.test(result.message));
});

test("normalizeGitHubError: maps HTTP 403 to authentication error", () => {
  const err = Object.assign(new Error("Forbidden"), { status: 403 });
  const result = normalizeGitHubError(err);
  assert.ok(result instanceof McpError);
  assert.equal(result.code, ErrorCode.InternalError);
  assert.ok(result.message.includes("403"));
  assert.ok(/authentication|permission/i.test(result.message));
});

test("normalizeGitHubError: maps HTTP 404 to not-found message", () => {
  const err = Object.assign(new Error("Not Found"), { status: 404 });
  const result = normalizeGitHubError(err);
  assert.ok(result instanceof McpError);
  assert.equal(result.code, ErrorCode.InternalError);
  assert.ok(/not found|not accessible/i.test(result.message));
});

test("normalizeGitHubError: includes status code in message for other HTTP errors", () => {
  const err = Object.assign(new Error("Unprocessable Entity"), { status: 422 });
  const result = normalizeGitHubError(err);
  assert.ok(result instanceof McpError);
  assert.ok(result.message.includes("422"));
});

test("normalizeGitHubError: returns generic message when no status is present", () => {
  const err = new Error("ECONNREFUSED");
  const result = normalizeGitHubError(err);
  assert.ok(result instanceof McpError);
  assert.ok(/request failed/i.test(result.message));
});

test("normalizeGitHubError: redacts tokens from error messages", () => {
  const err = Object.assign(new Error("invalid token ghs_abc123XYZ"), { status: 401 });
  const result = normalizeGitHubError(err);
  assert.ok(!result.message.includes("ghs_abc123XYZ"));
  assert.ok(result.message.includes("[redacted-token]") || /authentication|permission/i.test(result.message));
});

test("normalizeGitHubError: handles non-Error inputs", () => {
  const result = normalizeGitHubError("plain string error");
  assert.ok(result instanceof McpError);
});

test("normalizeGitHubError: handles null input", () => {
  const result = normalizeGitHubError(null);
  assert.ok(result instanceof McpError);
});

// ---------------------------------------------------------- redactSecrets

test("redactSecrets: redacts ghs_ tokens (GitHub server-to-server)", () => {
  const input = "Authorization: ghs_abcDEF123456789";
  const output = redactSecrets(input);
  assert.ok(!output.includes("ghs_abcDEF123456789"));
  assert.ok(output.includes("[redacted-token]"));
});

test("redactSecrets: redacts gho_ tokens (OAuth)", () => {
  const input = "token=gho_XYZ789abc";
  const output = redactSecrets(input);
  assert.ok(!output.includes("gho_XYZ789abc"));
  assert.ok(output.includes("[redacted-token]"));
});

test("redactSecrets: redacts ghp_ tokens (personal access)", () => {
  const input = "using token ghp_PersonalAccessToken12345";
  const output = redactSecrets(input);
  assert.ok(!output.includes("ghp_PersonalAccessToken12345"));
  assert.ok(output.includes("[redacted-token]"));
});

test("redactSecrets: redacts ghu_ tokens (user-to-server)", () => {
  const input = "ghu_UserToken9876";
  const output = redactSecrets(input);
  assert.ok(!output.includes("ghu_UserToken9876"));
  assert.ok(output.includes("[redacted-token]"));
});

test("redactSecrets: redacts ghr_ tokens (refresh)", () => {
  const input = "ghr_RefreshToken5432";
  const output = redactSecrets(input);
  assert.ok(!output.includes("ghr_RefreshToken5432"));
  assert.ok(output.includes("[redacted-token]"));
});

test("redactSecrets: redacts github_pat_ tokens", () => {
  const input = "github_pat_11ABCDEF_longPatTokenWithUnderscore";
  const output = redactSecrets(input);
  assert.ok(!output.includes("github_pat_11ABCDEF_longPatTokenWithUnderscore"));
  assert.ok(output.includes("[redacted-token]"));
});

test("redactSecrets: leaves non-token text unchanged", () => {
  const input = "Error: resource not found (status 404)";
  const output = redactSecrets(input);
  assert.equal(output, input);
});

test("redactSecrets: leaves empty string unchanged", () => {
  assert.equal(redactSecrets(""), "");
});

test("redactSecrets: redacts multiple tokens in a single string", () => {
  const input = "token1=ghs_abc123, token2=ghp_xyz789";
  const output = redactSecrets(input);
  assert.ok(!output.includes("ghs_abc123"));
  assert.ok(!output.includes("ghp_xyz789"));
  const matches = [...output.matchAll(/\[redacted-token\]/g)];
  assert.equal(matches.length, 2);
});
