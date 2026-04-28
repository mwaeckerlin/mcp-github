import { loadRestOperations } from "./openapi-operations.js";
import { classifyOperationToFamily, getRestToolFamilies, type RestToolFamilyName } from "./tool-families.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: readonly string[];
    additionalProperties: false;
  };
}

const operationFamilyMap = new Map<string, RestToolFamilyName>();
const operationsByFamily = new Map<RestToolFamilyName, string[]>();
const operationDetailsMap = new Map<
  string,
  {
    operationId: string;
    family: RestToolFamilyName;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
    path: string;
    parameterNames: string[];
  }
>();

for (const operation of loadRestOperations()) {
  const family = classifyOperationToFamily(operation);
  operationFamilyMap.set(operation.operationId, family);
  operationsByFamily.set(family, [...(operationsByFamily.get(family) ?? []), operation.operationId]);
  operationDetailsMap.set(operation.operationId, {
    operationId: operation.operationId,
    family,
    method: operation.method,
    path: operation.path,
    parameterNames: [...operation.parameterNames]
  });
}

const REST_CALL_SCHEMA = {
  type: "object" as const,
  properties: {
    operationId: {
      type: "string",
      description: "GitHub OpenAPI operationId for the selected tool family"
    },
    parameters: {
      type: "object",
      description: "Arguments for the selected operation (route and query/body fields)",
      additionalProperties: true
    }
  },
  required: ["operationId"],
  additionalProperties: false as const
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "github_rest_list_operations",
    description: "List allowlisted GitHub REST operations and the matching MCP tool family.",
    inputSchema: {
      type: "object",
      properties: {
        family: {
          type: "string",
          enum: [...new Set(operationFamilyMap.values())]
        },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        offset: { type: "integer", minimum: 0, maximum: 10000 }
      },
      additionalProperties: false
    }
  },
  ...getRestToolFamilies().map((family) => {
    return {
      name: family.name,
      description: family.description,
      inputSchema: REST_CALL_SCHEMA
    };
  }),
  {
    name: "github_graphql",
    description: "Run GitHub GraphQL operations using a named operation with validated inputs.",
    inputSchema: {
      type: "object",
      properties: {
        operationName: {
          type: "string",
          minLength: 1,
          description: "Named GraphQL operation to execute"
        },
        query: {
          type: "string",
          minLength: 1,
          description: "GraphQL query or mutation text"
        },
        variables: {
          type: "object",
          additionalProperties: true,
          description: "GraphQL variables object"
        }
      },
      required: ["operationName", "query"],
      additionalProperties: false
    }
  },
  {
    name: "github_copilot_assign_issue",
    description:
      "Assign GitHub Copilot cloud agent to an existing issue. " +
      "Copilot will research the issue, create an implementation plan, make code changes on a branch, and open a pull request. " +
      "Requires a Copilot plan (Pro, Pro+, Business, or Enterprise) with cloud agent enabled in the repository. " +
      "This feature is in public preview and subject to change.",
    inputSchema: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description: "Repository owner (user or organization)"
        },
        repo: {
          type: "string",
          description: "Repository name"
        },
        issue_number: {
          type: "integer",
          minimum: 1,
          description: "Issue number to assign Copilot to"
        },
        agent_assignment: {
          type: "object",
          description: "Optional agent assignment configuration",
          properties: {
            target_repo: {
              type: "string",
              description: "Repository where Copilot will make code changes (defaults to owner/repo)"
            },
            base_branch: {
              type: "string",
              description: "Branch to use as the base for Copilot's changes"
            },
            custom_instructions: {
              type: "string",
              description: "Additional instructions for Copilot beyond the issue body"
            },
            custom_agent: {
              type: "string",
              description: "Name of a custom agent profile to use"
            },
            model: {
              type: "string",
              description: "AI model for Copilot to use (e.g. 'gpt-4o', 'claude-3-7-sonnet')"
            }
          },
          additionalProperties: false
        }
      },
      required: ["owner", "repo", "issue_number"],
      additionalProperties: false
    }
  }
];

export function getToolDefinitions(disabledTools: ReadonlySet<string> = new Set()): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => !disabledTools.has(tool.name));
}

export function getOperationFamily(operationId: string): RestToolFamilyName | undefined {
  return operationFamilyMap.get(operationId);
}

export function listOperationMappings(family?: RestToolFamilyName): Array<{
  operationId: string;
  family: RestToolFamilyName;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  path: string;
  parameterNames: string[];
}> {
  const mappings: Array<{
    operationId: string;
    family: RestToolFamilyName;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
    path: string;
    parameterNames: string[];
  }> = [];
  for (const details of operationDetailsMap.values()) {
    if (!family || family === details.family) {
      mappings.push({
        operationId: details.operationId,
        family: details.family,
        method: details.method,
        path: details.path,
        parameterNames: [...details.parameterNames]
      });
    }
  }
  mappings.sort((a, b) => a.operationId.localeCompare(b.operationId));
  return mappings;
}

export function getOperationsForFamily(family: RestToolFamilyName): string[] {
  return [...(operationsByFamily.get(family) ?? [])].sort((a, b) => a.localeCompare(b));
}
