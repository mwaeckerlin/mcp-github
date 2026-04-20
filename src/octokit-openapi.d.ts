declare module "@octokit/openapi" {
  const openapiPackage: {
    schemas: Record<string, unknown>;
  };
  export default openapiPackage;
}
