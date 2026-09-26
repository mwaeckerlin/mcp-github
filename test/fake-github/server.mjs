/**
 * Simulated GitHub API for the end-to-end tests of mcp-github.
 *
 * Answers the requests of test/e2e.mjs with fixtures fetched once from the
 * public GitHub API (fixtures/*.json: status and body). Every request must carry
 * the token of the simulation, so the tests also prove that mcp-github sends
 * its GITHUB_TOKEN; without it the answer is 401 like GitHub's.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const TOKEN = process.env.SIMULATED_GITHUB_TOKEN ?? "";
const PORT = Number(process.env.PORT ?? 8080);
const fixture = (name) => JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8"));

const ROUTES = [
  ["GET", /^\/user$/, "user"],
  ["GET", /^\/search\/repositories$/, "search-repositories"],
  ["GET", /^\/repos\/octocat\/Hello-World$/, "repo"],
  ["GET", /^\/repos\/octocat\/Hello-World\/branches$/, "branches"],
  ["GET", /^\/repos\/octocat\/Hello-World\/commits$/, "commits"],
  ["GET", /^\/repos\/octocat\/Hello-World\/git\/ref\/heads\/master$/, "git-ref"],
  ["GET", /^\/repos\/octocat\/Hello-World\/pulls$/, "pulls"],
  ["GET", /^\/repos\/octocat\/Hello-World\/issues$/, "issues"],
  ["GET", /^\/repos\/octocat\/Hello-World\/labels$/, "labels"],
  ["GET", /^\/repos\/octocat\/Hello-World\/releases$/, "releases"],
  ["GET", /^\/repos\/mwaeckerlin\/mcp-github\/actions\/workflows$/, "workflows"],
  ["GET", /^\/repos\/octocat\/Hello-World\/commits\/master\/status$/, "combined-status"],
  ["GET", /^\/events$/, "events"],
  ["GET", /^\/repos\/octocat\/Hello-World\/deployments$/, "deployments"],
  ["GET", /^\/rate_limit$/, "rate-limit"],
  ["GET", /^\/orgs\/github\/projects$/, "org-projects"],
  ["GET", /^\/user\/codespaces$/, "codespaces"]
];

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(body === null ? "" : JSON.stringify(body));
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://fake-github");
  if (url.pathname === "/healthz") return send(response, 200, { ok: true });
  const auth = request.headers.authorization ?? "";
  if (!TOKEN || !auth.endsWith(` ${TOKEN}`)) {
    return send(response, 401, { message: "Requires authentication", status: "401" });
  }
  if (request.method === "POST" && url.pathname === "/graphql") {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const { query = "" } = JSON.parse(raw || "{}");
      if (/\bviewer\s*\{\s*login\s*\}/.test(query)) {
        return send(response, 200, { data: { viewer: { login: fixture("user").body.login } } });
      }
      send(response, 200, { errors: [{ message: "the simulation answers `viewer { login }` only" }] });
    });
    return;
  }
  // Octokit encodes a slash inside a parameter (ref "heads/master" becomes
  // heads%2Fmaster), and GitHub accepts both forms
  const pathname = decodeURIComponent(url.pathname);
  const route = ROUTES.find(([method, path]) => method === request.method && path.test(pathname));
  if (!route) return send(response, 404, { message: "Not Found", status: "404" });
  const { status, body } = fixture(route[2]);
  send(response, status, body);
}).listen(PORT, () => console.log(`simulated GitHub on port ${PORT}`));
