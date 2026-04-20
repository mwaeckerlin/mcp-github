import { validateGraphQlArguments } from "./validation.js";

export type SkillsToolName = "github_graphql";

export const SKILLS_TOOL_INPUT_SCHEMAS = {
  github_graphql: {
    type: "object",
    properties: {
      operationName: { type: "string", minLength: 1 },
      query: { type: "string", minLength: 1 },
      variables: { type: "object", additionalProperties: true }
    },
    required: ["operationName", "query"],
    additionalProperties: false
  }
} as const;

export function isSkillsToolName(value: string): value is SkillsToolName {
  return value === "github_graphql";
}

export function validateSkillsToolArguments(_toolName: SkillsToolName, argumentsValue: unknown): ReturnType<typeof validateGraphQlArguments> {
  return validateGraphQlArguments(argumentsValue);
}

export async function runSkillsToolWithArguments(
  _toolName: SkillsToolName,
  argumentsValue: unknown,
  client: { callGraphQl(operationName: string, query: string, variables: Record<string, unknown>): Promise<unknown> }
): Promise<string> {
  const { operationName, query, variables } = validateSkillsToolArguments("github_graphql", argumentsValue);
  const data = await client.callGraphQl(operationName, query, variables);
  return JSON.stringify({ operationName, data }, null, 2);
}
