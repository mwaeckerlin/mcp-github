export function loadDisabledToolsFromEnv(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  return new Set(
    (env.DISABLE_TOOLS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
}

export function isToolDisabled(toolName: string, disabledTools: ReadonlySet<string>): boolean {
  return disabledTools.has(toolName);
}
