import openapiPackage from "@octokit/openapi";

export interface RestOperation {
  operationId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  path: string;
  tags: string[];
  parameterNames: string[];
}

function isHttpMethodName(value: string): value is RestOperation["method"] {
  return value === "GET" || value === "POST" || value === "PUT" || value === "PATCH" || value === "DELETE" || value === "HEAD";
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function loadRestOperations(): RestOperation[] {
  const spec = (openapiPackage as { schemas: Record<string, unknown> }).schemas["api.github.com"] as {
    paths: Record<string, Record<string, { operationId?: string; tags?: string[]; parameters?: Array<{ name?: string }> }>>;
  };

  const operations: RestOperation[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [rawMethod, operation] of Object.entries(pathItem)) {
      const method = rawMethod.toUpperCase();
      if (!isHttpMethodName(method) || !operation?.operationId) {
        continue;
      }

      const parameterNames = uniqueSorted((operation.parameters ?? []).map((parameter) => parameter?.name).filter((name): name is string => typeof name === "string"));

      operations.push({
        operationId: operation.operationId,
        method,
        path,
        tags: uniqueSorted(operation.tags ?? []),
        parameterNames
      });
    }
  }

  operations.sort((a, b) => a.operationId.localeCompare(b.operationId));
  return operations;
}
