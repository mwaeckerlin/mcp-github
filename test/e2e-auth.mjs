/**
 * End-to-end test for MCP_AUTH_TOKEN and the degraded mode, without a GitHub token.
 *
 * The server runs with MCP_AUTH_TOKEN and without GITHUB_TOKEN. A request
 * without the token or with a wrong one is refused with 401; the token in the
 * Authorization header or in the `token` query parameter lets it through;
 * /healthz stays open and reports the degraded mode; the operation listing
 * offers only reading operations. Exits with code 0 on success, 1 on failure.
 *
 * Required environment variables:
 *   MCP_GITHUB_URL  Full URL of the MCP GitHub endpoint, e.g. http://mcp-github-auth:4000
 *   MCP_AUTH_TOKEN  The token the server was started with
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_GITHUB_URL;
const TOKEN = process.env.MCP_AUTH_TOKEN;
if (!MCP_URL || !TOKEN) {
  console.error("MCP_GITHUB_URL and MCP_AUTH_TOKEN must be set — run via: npm run test:e2e:auth");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`PASS  ${name}`);
  passed++;
}

function fail(name, detail = "") {
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

const INITIALIZE = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "e2e-auth", version: "1.0.0" } }
});

async function post(url, headers = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: INITIALIZE
  });
}

async function waitForHealthz(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(new URL("/healthz", MCP_URL));
      if (r.ok) return r.json();
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${MCP_URL}/healthz not ready after ${timeoutMs}ms`);
}

async function listOperations(transport) {
  const client = new Client({ name: "mcp-github-e2e-auth", version: "1.0.0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    const r = await client.callTool({ name: "github_rest_list_operations", arguments: { limit: 100, offset: 0 } });
    const text = r.content.find((c) => c.type === "text")?.text ?? "{}";
    return { tools: tools.map((t) => t.name), listing: JSON.parse(text) };
  } finally {
    await client.close();
  }
}

async function main() {
  console.log("=== MCP GitHub — MCP_AUTH_TOKEN and degraded mode ===");

  const health = await waitForHealthz();
  if (health.status === "degraded" && health.githubTokenConfigured === false) {
    pass("/healthz → open without token, reports the degraded mode");
  } else {
    fail("/healthz → expected status degraded", JSON.stringify(health));
  }

  const without = await post(MCP_URL);
  without.status === 401 ? pass("no token → 401") : fail("no token → expected 401", `got ${without.status}`);

  const wrong = await post(MCP_URL, { Authorization: `Bearer ${TOKEN}x` });
  wrong.status === 401 ? pass("wrong token → 401") : fail("wrong token → expected 401", `got ${wrong.status}`);

  const shorter = await post(MCP_URL, { Authorization: `Bearer ${TOKEN.slice(0, -1)}` });
  shorter.status === 401 ? pass("token cut short → 401") : fail("token cut short → expected 401", `got ${shorter.status}`);

  const byQuery = await post(`${MCP_URL}/?token=${encodeURIComponent(TOKEN)}`);
  byQuery.status === 200 ? pass("token in the query → 200") : fail("token in the query → expected 200", `got ${byQuery.status}`);

  try {
    const { tools, listing } = await listOperations(
      new StreamableHTTPClientTransport(new URL(MCP_URL), {
        requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } }
      })
    );
    tools.includes("github_rest_list_operations")
      ? pass("token in the header → tools/list answers")
      : fail("token in the header → tools/list lacks github_rest_list_operations", tools.join(", "));
    const methods = new Set((listing.operations ?? []).map((o) => o.method));
    const writing = [...methods].filter((m) => m !== "GET" && m !== "HEAD");
    listing.total > 0 && writing.length === 0
      ? pass(`degraded mode → ${listing.total} operations, reading only`)
      : fail("degraded mode → expected reading operations only", `methods: ${[...methods].join(", ")}`);
  } catch (e) {
    fail("token in the header → unexpected exception", e.message);
  }

  console.log(`\n==> ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
