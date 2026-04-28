import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

export type CopilotToolName = "github_copilot_assign_issue";

export const COPILOT_TOOL_NAMES: ReadonlyArray<CopilotToolName> = ["github_copilot_assign_issue"];

export interface AgentAssignment {
  target_repo?: string;
  base_branch?: string;
  custom_instructions?: string;
  custom_agent?: string;
  model?: string;
}

export interface CopilotAssignArguments {
  owner: string;
  repo: string;
  issue_number: number;
  agent_assignment?: AgentAssignment;
}

function asObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new McpError(ErrorCode.InvalidParams, `${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function isCopilotToolName(value: string): value is CopilotToolName {
  return (COPILOT_TOOL_NAMES as ReadonlyArray<string>).includes(value);
}

export function validateCopilotAssignArguments(argumentsValue: unknown): CopilotAssignArguments {
  const args = asObject(argumentsValue, "arguments");

  const { owner, repo, issue_number } = args;

  if (typeof owner !== "string" || owner.trim().length < 1) {
    throw new McpError(ErrorCode.InvalidParams, "owner must be a non-empty string");
  }
  if (typeof repo !== "string" || repo.trim().length < 1) {
    throw new McpError(ErrorCode.InvalidParams, "repo must be a non-empty string");
  }
  if (typeof issue_number !== "number" || !Number.isInteger(issue_number) || issue_number < 1) {
    throw new McpError(ErrorCode.InvalidParams, "issue_number must be a positive integer");
  }

  let agent_assignment: AgentAssignment | undefined;
  if (args.agent_assignment !== undefined) {
    const aa = asObject(args.agent_assignment, "agent_assignment");
    agent_assignment = {
      target_repo: typeof aa.target_repo === "string" ? aa.target_repo : undefined,
      base_branch: typeof aa.base_branch === "string" ? aa.base_branch : undefined,
      custom_instructions: typeof aa.custom_instructions === "string" ? aa.custom_instructions : undefined,
      custom_agent: typeof aa.custom_agent === "string" ? aa.custom_agent : undefined,
      model: typeof aa.model === "string" ? aa.model : undefined
    };
  }

  return { owner, repo, issue_number, agent_assignment };
}

export async function runCopilotToolWithArguments(
  toolName: CopilotToolName,
  argumentsValue: unknown,
  client: { assignCopilotToIssue(owner: string, repo: string, issueNumber: number, agentAssignment?: AgentAssignment): Promise<unknown> }
): Promise<string> {
  if (toolName === "github_copilot_assign_issue") {
    const { owner, repo, issue_number, agent_assignment } = validateCopilotAssignArguments(argumentsValue);
    const data = await client.assignCopilotToIssue(owner, repo, issue_number, agent_assignment);
    return JSON.stringify({ owner, repo, issue_number, data }, null, 2);
  }
  throw new McpError(ErrorCode.InvalidParams, `Unknown Copilot tool: ${toolName}`);
}
