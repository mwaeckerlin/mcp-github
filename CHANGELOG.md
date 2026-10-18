# Changelog

- 2026-10-18 **1.1.2**
    - The container turns healthy in Docker Swarm: the image's health check needed a shell, which the image does not carry, so Swarm stopped every task as unhealthy while the server answered; it now runs without one, also without a GitHub token, and the test stacks rely on it
    - The development commands in the README can be copied as they stand, without a `$ ` prompt

- 2026-09-26 **1.1.1**
    - A guessed `MCP_AUTH_TOKEN` can no longer be narrowed down character by character: the server compares the presented token in constant time
    - `GITHUB_API_URL` connects the server to a GitHub Enterprise Server
    - The tests no longer need a GitHub token and never reach the real GitHub: they run against a simulated GitHub API with recorded answers, on networks without internet access, and the pipeline runs all of them
    - The test environment's GitHub token no longer enters the image build
    - The image build keeps the downloaded npm packages between builds and fetches only what is new
    - `MCP_AUTH_TOKEN` and the degraded mode without a GitHub token are covered end to end, and the image is checked to carry the agent instructions
    - The image is published for amd64 and arm64 under one tag, built, tested and published automatically on every change and every week
    - The package is named `@mwaeckerlin/mcp-github`, and the npm scripts follow the family: `npm run build` builds the image, `npm run build:ts` compiles TypeScript

- 2026-07-16 **1.1.0**
    - The shipped image is verified to contain no shell, busybox or perl
    - `github_copilot_assign_issue` assigns the Copilot cloud agent to an issue, with a clear message when GitHub refuses a bot as assignee
    - `MCP_AUTH_TOKEN` protects the MCP endpoint between the sandbox and the server
