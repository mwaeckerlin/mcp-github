import { Octokit } from "@octokit/core";
import { graphql } from "@octokit/graphql";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { loadRestOperations } from "./openapi-operations.js";
import type { AgentAssignment } from "./copilot-tools.js";

const OPERATION_REGISTRY = new Map(loadRestOperations().map((operation) => [operation.operationId, operation]));

export interface RestCallResult {
  status: number;
  url: string;
  data: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export class GitHubApiClient {
  private readonly octokit: Octokit;
  private readonly graphqlWithAuth: typeof graphql;

  constructor(githubToken?: string) {
    this.octokit = githubToken ? new Octokit({ auth: githubToken }) : new Octokit();
    this.graphqlWithAuth = githubToken
      ? graphql.defaults({
        headers: {
          authorization: `token ${githubToken}`
        }
      })
      : graphql;
  }

  async callRestByOperationId(operationId: string, parameters: Record<string, unknown>): Promise<RestCallResult> {
    const operation = OPERATION_REGISTRY.get(operationId);
    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown operationId: ${operationId}`);
    }

    try {
      const response = await this.octokit.request(`${operation.method} ${operation.path}`, parameters);
      return {
        status: response.status,
        url: response.url,
        data: response.data,
        headers: {
          link: response.headers.link,
          "x-ratelimit-limit": response.headers["x-ratelimit-limit"],
          "x-ratelimit-remaining": response.headers["x-ratelimit-remaining"],
          "x-ratelimit-reset": response.headers["x-ratelimit-reset"]
        }
      };
    } catch (error: unknown) {
      throw normalizeGitHubError(error);
    }
  }

  async callGraphQl(operationName: string, query: string, variables: Record<string, unknown>): Promise<unknown> {
    try {
      return await this.graphqlWithAuth(query, {
        ...variables,
        operationName
      });
    } catch (error: unknown) {
      throw normalizeGitHubError(error);
    }
  }

  async assignCopilotToIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    agentAssignment?: AgentAssignment
  ): Promise<RestCallResult> {
    try {
      const agentAssignmentBody: Record<string, string> = {
        target_repo: agentAssignment?.target_repo ?? `${owner}/${repo}`
      };
      if (agentAssignment?.base_branch) agentAssignmentBody.base_branch = agentAssignment.base_branch;
      if (agentAssignment?.custom_instructions) agentAssignmentBody.custom_instructions = agentAssignment.custom_instructions;
      if (agentAssignment?.custom_agent) agentAssignmentBody.custom_agent = agentAssignment.custom_agent;
      if (agentAssignment?.model) agentAssignmentBody.model = agentAssignment.model;

      const response = await this.octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees",
        {
          owner,
          repo,
          issue_number: issueNumber,
          assignees: ["copilot-swe-agent[bot]"],
          agent_assignment: agentAssignmentBody
        }
      );
      return {
        status: response.status,
        url: response.url,
        data: response.data,
        headers: {
          link: response.headers.link,
          "x-ratelimit-limit": response.headers["x-ratelimit-limit"],
          "x-ratelimit-remaining": response.headers["x-ratelimit-remaining"],
          "x-ratelimit-reset": response.headers["x-ratelimit-reset"]
        }
      };
    } catch (error: unknown) {
      throw normalizeGitHubError(error);
    }
  }
}

export function normalizeGitHubError(error: unknown): McpError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = redactSecrets(rawMessage);
  const maybeStatus = (error as { status?: unknown } | undefined)?.status;
  const status = typeof maybeStatus === "number" ? maybeStatus : undefined;

  if (status === 401 || status === 403) {
    return new McpError(ErrorCode.InternalError, `GitHub authentication or permission error (${status})`);
  }

  if (status === 404) {
    return new McpError(ErrorCode.InternalError, "GitHub resource not found or not accessible");
  }

  if (status === 422) {
    const errors = (error as { response?: { data?: { errors?: unknown[] } } }).response?.data?.errors;
    const isAssigneeError =
      (Array.isArray(errors) &&
        errors.some(
          (e) => typeof e === "object" && e !== null && (e as Record<string, unknown>).field === "assignees"
        )) ||
      /assignee/i.test(rawMessage);
    if (isAssigneeError) {
      return new McpError(
        ErrorCode.InternalError,
        'GitHub API error (422): Assigning bot/agent accounts via the REST API requires the assignee "copilot-swe-agent[bot]" and an "agent_assignment" body field. Use the dedicated "github_copilot_assign_issue" tool to assign Copilot cloud agent to an issue.'
      );
    }
    return new McpError(ErrorCode.InternalError, `GitHub API error (422): ${message}`);
  }

  if (status !== undefined) {
    return new McpError(ErrorCode.InternalError, `GitHub API error (${status}): ${message}`);
  }

  return new McpError(ErrorCode.InternalError, `GitHub API request failed: ${message}`);
}

export function redactSecrets(value: string): string {
  return value
    .replace(/(gh[opsur]_[A-Za-z0-9_]+)/g, "[redacted-token]")
    .replace(/(github_pat_[A-Za-z0-9_]+)/g, "[redacted-token]");
}

export const __testing = { normalizeGitHubError, redactSecrets };
