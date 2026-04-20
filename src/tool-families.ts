import type { RestOperation } from "./openapi-operations.js";

export interface RestToolFamily {
  name: RestToolFamilyName;
  description: string;
}

export const REST_TOOL_FAMILY_NAMES = [
  "github_repositories_rest",
  "github_branches_rest",
  "github_commits_rest",
  "github_git_data_rest",
  "github_pull_requests_rest",
  "github_issues_rest",
  "github_labels_milestones_rest",
  "github_releases_tags_rest",
  "github_actions_workflows_rest",
  "github_checks_status_rest",
  "github_discussions_projects_rest",
  "github_users_orgs_teams_rest",
  "github_search_rest",
  "github_notifications_reactions_rest",
  "github_webhooks_deployments_rest",
  "github_codespaces_rest",
  "github_rest_misc"
] as const;

export type RestToolFamilyName = (typeof REST_TOOL_FAMILY_NAMES)[number];

interface RestToolFamilyMatcher {
  family: RestToolFamily;
  matches(operation: RestOperation): boolean;
}

const TOOL_FAMILY_MATCHERS: RestToolFamilyMatcher[] = [
  {
    family: {
      name: "github_branches_rest",
      description: "GitHub branch APIs (branch metadata, branch protection, and branch listings)."
    },
    matches: (operation) => /branch/i.test(operation.operationId)
  },
  {
    family: {
      name: "github_commits_rest",
      description: "GitHub commit APIs (commit listing, commit metadata, statuses on commits, and comparisons)."
    },
    matches: (operation) => /commit/i.test(operation.operationId)
  },
  {
    family: {
      name: "github_git_data_rest",
      description: "Git database APIs (trees, blobs, refs, tags, and low-level git object endpoints)."
    },
    matches: (operation) => operation.tags.includes("git") || operation.operationId.startsWith("git/")
  },
  {
    family: {
      name: "github_pull_requests_rest",
      description: "Pull Request APIs including PR metadata, reviews, comments, and changed files."
    },
    matches: (operation) => operation.tags.includes("pulls") || operation.operationId.startsWith("pulls/")
  },
  {
    family: {
      name: "github_issues_rest",
      description: "Issue APIs including issue comments and issue timeline/event operations."
    },
    matches: (operation) => operation.tags.includes("issues") || operation.operationId.startsWith("issues/")
  },
  {
    family: {
      name: "github_labels_milestones_rest",
      description: "Label and milestone APIs for repositories and issues."
    },
    matches: (operation) => /label|milestone/i.test(operation.operationId)
  },
  {
    family: {
      name: "github_releases_tags_rest",
      description: "Release and tag APIs including release assets and git tags."
    },
    matches: (operation) => /release|tag/i.test(operation.operationId)
  },
  {
    family: {
      name: "github_actions_workflows_rest",
      description: "GitHub Actions APIs including workflows, workflow runs, artifacts, and runners."
    },
    matches: (operation) => operation.tags.includes("actions") || /workflow|artifact|runner|actions\//i.test(operation.operationId)
  },
  {
    family: {
      name: "github_checks_status_rest",
      description: "Checks and status APIs including check runs, check suites, and combined status endpoints."
    },
    matches: (operation) => operation.tags.includes("checks") || /check|status/i.test(operation.operationId)
  },
  {
    family: {
      name: "github_discussions_projects_rest",
      description: "Discussion and classic Projects APIs, including organization and repository projects."
    },
    matches: (operation) => /discussion|project/i.test(operation.operationId) || operation.tags.includes("projects")
  },
  {
    family: {
      name: "github_users_orgs_teams_rest",
      description: "User, organization, and team APIs including memberships, invitations, and profile data."
    },
    matches: (operation) => operation.tags.some((tag) => ["users", "orgs", "teams", "enterprise-team-memberships", "enterprise-team-organizations", "enterprise-teams"].includes(tag))
  },
  {
    family: {
      name: "github_search_rest",
      description: "GitHub search APIs for repositories, code, issues, pull requests, users, and topics."
    },
    matches: (operation) => operation.tags.includes("search") || operation.operationId.startsWith("search/")
  },
  {
    family: {
      name: "github_notifications_reactions_rest",
      description: "Notifications, activity, and reactions APIs."
    },
    matches: (operation) => operation.tags.some((tag) => ["activity", "reactions"].includes(tag))
  },
  {
    family: {
      name: "github_webhooks_deployments_rest",
      description: "Webhook and deployment APIs including repository/org hooks and deployment statuses."
    },
    matches: (operation) => /hook|webhook|deployment/i.test(operation.operationId)
  },
  {
    family: {
      name: "github_codespaces_rest",
      description: "GitHub Codespaces and hosted compute APIs."
    },
    matches: (operation) => operation.tags.some((tag) => ["codespaces", "hosted-compute"].includes(tag))
  },
  {
    family: {
      name: "github_repositories_rest",
      description: "Repository APIs including repository metadata, contents, collaborators, branches, and settings."
    },
    matches: (operation) => operation.tags.includes("repos") || operation.operationId.startsWith("repos/")
  },
  {
    family: {
      name: "github_rest_misc",
      description: "All remaining GitHub REST APIs not covered by the dedicated family tools."
    },
    matches: () => true
  }
];

export function classifyOperationToFamily(operation: RestOperation): RestToolFamilyName {
  for (const matcher of TOOL_FAMILY_MATCHERS) {
    if (matcher.matches(operation)) {
      return matcher.family.name;
    }
  }
  return "github_rest_misc";
}

export function getRestToolFamilies(): RestToolFamily[] {
  const dedup = new Map<RestToolFamilyName, RestToolFamily>();
  for (const matcher of TOOL_FAMILY_MATCHERS) {
    dedup.set(matcher.family.name, matcher.family);
  }
  return [...dedup.values()];
}
