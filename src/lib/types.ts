export type EntryKind = "chunk" | "decision" | "issue";

export type IssueType = "bug" | "task" | "risk" | "incident";
export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type IssueStatus = "open" | "in_progress" | "resolved" | "archived";

export interface BaseEntryFrontmatter {
  id: string;
  kind: EntryKind;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at?: string;
  archived_reason?: string;
  by?: string;
}

export interface ChunkFrontmatter extends BaseEntryFrontmatter {
  kind: "chunk";
  section: string;
}

export interface DecisionFrontmatter extends BaseEntryFrontmatter {
  kind: "decision";
  title: string;
  decided_by: string;
  decision_date: string;
}

export interface IssueFrontmatter extends BaseEntryFrontmatter {
  kind: "issue";
  title: string;
  issue_type: IssueType;
  severity: IssueSeverity;
  status: IssueStatus;
  resolved_at?: string;
}

export type AnyFrontmatter =
  | ChunkFrontmatter
  | DecisionFrontmatter
  | IssueFrontmatter;

export interface Entry<F extends BaseEntryFrontmatter = AnyFrontmatter> {
  frontmatter: F;
  body: string;
  path: string;
}

export interface ProjectSummary {
  id: string;
  updated_at: string;
  content: string;
}

export interface CurrentWork {
  id: string;
  updated_at: string;
  content: string;
}

export interface BootstrapOptions {
  recentChunkLimit?: number;
  recentDecisionLimit?: number;
  openIssueLimit?: number;
  includeArchived?: boolean;
}

export interface BootstrapResult {
  projectId: string;
  projectSummary: ProjectSummary | null;
  currentWork: CurrentWork | null;
  recentChunks: Entry<ChunkFrontmatter>[];
  recentDecisions: Entry<DecisionFrontmatter>[];
  openIssues: Entry<IssueFrontmatter>[];
}
