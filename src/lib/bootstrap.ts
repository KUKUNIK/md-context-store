import type { Store } from "./store.js";
import type {
  BootstrapOptions,
  BootstrapResult,
  ChunkFrontmatter,
  DecisionFrontmatter,
  Entry,
  IssueFrontmatter,
} from "./types.js";

export async function buildBootstrap(
  store: Store,
  projectId: string,
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const recentChunkLimit = options.recentChunkLimit ?? 10;
  const recentDecisionLimit = options.recentDecisionLimit ?? 10;
  const openIssueLimit = options.openIssueLimit ?? 30;

  const [projectSummary, currentWork, chunks, decisions, issues] =
    await Promise.all([
      store.getProjectSummary(projectId),
      store.getCurrentWork(projectId),
      store.list(projectId, "chunk", {
        limit: recentChunkLimit,
        includeArchived: options.includeArchived,
      }),
      store.list(projectId, "decision", {
        limit: recentDecisionLimit,
        includeArchived: options.includeArchived,
      }),
      store.list(projectId, "issue", {
        limit: openIssueLimit,
        includeArchived: options.includeArchived,
        status: options.includeArchived ? undefined : "open",
      }),
    ]);

  return {
    projectId,
    projectSummary,
    currentWork,
    recentChunks: chunks as Entry<ChunkFrontmatter>[],
    recentDecisions: decisions as Entry<DecisionFrontmatter>[],
    openIssues: issues as Entry<IssueFrontmatter>[],
  };
}

export function renderBootstrap(result: BootstrapResult): string {
  const lines: string[] = [];
  lines.push(`# ${result.projectId} bootstrap`);
  lines.push("");
  lines.push(`_generated_at: ${new Date().toISOString()}_`);
  lines.push("");

  lines.push("## project_summary");
  lines.push("");
  if (result.projectSummary) {
    lines.push(result.projectSummary.content);
  } else {
    lines.push("_(no project summary yet — run `mdcs summary` to write one)_");
  }
  lines.push("");

  lines.push("## current_work");
  lines.push("");
  if (result.currentWork) {
    lines.push(result.currentWork.content);
  } else {
    lines.push("_(no current work summary — run `mdcs current` to write one)_");
  }
  lines.push("");

  lines.push("## recent_chunks");
  lines.push("");
  if (result.recentChunks.length === 0) {
    lines.push("_(none)_");
  } else {
    for (const chunk of result.recentChunks) {
      lines.push(
        `### [${chunk.frontmatter.section}] ${chunk.frontmatter.id}`,
      );
      lines.push("");
      lines.push(chunk.body);
      lines.push("");
    }
  }

  lines.push("## recent_decisions");
  lines.push("");
  if (result.recentDecisions.length === 0) {
    lines.push("_(none)_");
  } else {
    for (const d of result.recentDecisions) {
      lines.push(
        `### ${d.frontmatter.title} (${d.frontmatter.decision_date} · by ${d.frontmatter.decided_by})`,
      );
      lines.push("");
      lines.push(d.body || "_(no body)_");
      lines.push("");
    }
  }

  lines.push("## open_issues");
  lines.push("");
  if (result.openIssues.length === 0) {
    lines.push("_(none)_");
  } else {
    for (const i of result.openIssues) {
      const fm = i.frontmatter;
      lines.push(
        `### [${fm.issue_type} · ${fm.severity}] ${fm.title} (${fm.status})`,
      );
      lines.push("");
      lines.push(i.body || "_(no body)_");
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
