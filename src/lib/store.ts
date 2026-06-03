import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { parse, serialize } from "./frontmatter.js";
import { GitAudit, type GitAuditOptions } from "./git.js";
import { entryId } from "./id.js";
import {
  currentWorkPath,
  defaultStoreRoot,
  entryDir,
  entryPath,
  projectDir,
  projectSummaryPath,
} from "./paths.js";
import type {
  AnyFrontmatter,
  BaseEntryFrontmatter,
  ChunkFrontmatter,
  CurrentWork,
  DecisionFrontmatter,
  Entry,
  EntryKind,
  IssueFrontmatter,
  IssueSeverity,
  IssueStatus,
  IssueType,
  ProjectSummary,
} from "./types.js";

const ENTRY_KINDS: EntryKind[] = ["chunk", "decision", "issue"];

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface StoreConfig {
  root?: string;
  git?: GitAuditOptions;
}

export interface AddChunkInput {
  section: string;
  body: string;
  by?: string;
}

export interface AddDecisionInput {
  title: string;
  decidedBy: string;
  body?: string;
  reasoning?: string;
  decisionDate?: string;
}

export interface AddIssueInput {
  title: string;
  issueType: IssueType;
  severity?: IssueSeverity;
  body?: string;
  by?: string;
}

export interface ListOptions {
  limit?: number;
  includeArchived?: boolean;
  status?: IssueStatus;
}

export class Store {
  readonly root: string;
  private readonly git: GitAudit | null;

  constructor(config: StoreConfig = {}) {
    this.root = config.root ?? defaultStoreRoot();
    this.git =
      config.git && config.git.enabled !== false
        ? new GitAudit(this.root, config.git)
        : null;
  }

  get gitEnabled(): boolean {
    return this.git !== null;
  }

  /** Read-only access to the audit log if git is enabled. */
  async auditLog(limit?: number) {
    if (!this.git) return [];
    return this.git.log(limit);
  }

  private async commit(message: string, ...paths: string[]): Promise<void> {
    if (!this.git) return;
    const rels = paths.map((p) => relative(this.root, p));
    await this.git.commit(message, rels);
  }

  async initProject(
    projectId: string,
    options: { summary?: string } = {},
  ): Promise<void> {
    if (!projectId.match(/^[a-zA-Z0-9_\-]+$/)) {
      throw new Error(
        `invalid project id: "${projectId}" (allowed: a-z A-Z 0-9 _ -)`,
      );
    }
    await ensureDir(projectDir(this.root, projectId));
    for (const kind of ENTRY_KINDS) {
      await ensureDir(entryDir(this.root, projectId, kind));
    }
    const summaryPath = projectSummaryPath(this.root, projectId);
    if (!(await fileExists(summaryPath))) {
      const content = options.summary?.trim()
        ? options.summary.trim()
        : `# ${projectId}\n\nProject summary not written yet.`;
      await this.updateProjectSummary(projectId, content);
    }
  }

  async updateProjectSummary(
    projectId: string,
    content: string,
  ): Promise<ProjectSummary> {
    const summary: ProjectSummary = {
      id: projectId,
      updated_at: nowIso(),
      content: content.trim(),
    };
    const path = projectSummaryPath(this.root, projectId);
    await ensureDir(dirname(path));
    const file = serialize(
      { id: projectId, updated_at: summary.updated_at },
      summary.content,
    );
    await writeFile(path, file, "utf8");
    await this.commit(`summary(${projectId}): update project summary`, path);
    return summary;
  }

  async getProjectSummary(projectId: string): Promise<ProjectSummary | null> {
    const path = projectSummaryPath(this.root, projectId);
    if (!(await fileExists(path))) return null;
    const raw = await readFile(path, "utf8");
    const parsed = parse<{ id: string; updated_at: string }>(raw);
    return {
      id: parsed.frontmatter.id ?? projectId,
      updated_at: parsed.frontmatter.updated_at ?? "",
      content: parsed.body,
    };
  }

  async updateCurrentWork(
    projectId: string,
    content: string,
  ): Promise<CurrentWork> {
    const work: CurrentWork = {
      id: projectId,
      updated_at: nowIso(),
      content: content.trim(),
    };
    const path = currentWorkPath(this.root, projectId);
    await ensureDir(dirname(path));
    const file = serialize(
      { id: projectId, updated_at: work.updated_at },
      work.content,
    );
    await writeFile(path, file, "utf8");
    await this.commit(`current(${projectId}): update current work`, path);
    return work;
  }

  async getCurrentWork(projectId: string): Promise<CurrentWork | null> {
    const path = currentWorkPath(this.root, projectId);
    if (!(await fileExists(path))) return null;
    const raw = await readFile(path, "utf8");
    const parsed = parse<{ id: string; updated_at: string }>(raw);
    return {
      id: parsed.frontmatter.id ?? projectId,
      updated_at: parsed.frontmatter.updated_at ?? "",
      content: parsed.body,
    };
  }

  async addChunk(
    projectId: string,
    input: AddChunkInput,
  ): Promise<Entry<ChunkFrontmatter>> {
    await this.initProject(projectId);
    const now = new Date();
    const id = entryId(input.section, now);
    const frontmatter: ChunkFrontmatter = {
      id,
      kind: "chunk",
      section: input.section,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      archived: false,
      ...(input.by ? { by: input.by } : {}),
    };
    return this.writeEntry(projectId, "chunk", frontmatter, input.body);
  }

  async addDecision(
    projectId: string,
    input: AddDecisionInput,
  ): Promise<Entry<DecisionFrontmatter>> {
    await this.initProject(projectId);
    const now = new Date();
    const id = entryId(input.title, now);
    const frontmatter: DecisionFrontmatter = {
      id,
      kind: "decision",
      title: input.title,
      decided_by: input.decidedBy,
      decision_date:
        input.decisionDate ?? now.toISOString().slice(0, 10),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      archived: false,
      by: input.decidedBy,
    };
    const body = composeDecisionBody(input.body, input.reasoning);
    return this.writeEntry(projectId, "decision", frontmatter, body);
  }

  async addIssue(
    projectId: string,
    input: AddIssueInput,
  ): Promise<Entry<IssueFrontmatter>> {
    await this.initProject(projectId);
    const now = new Date();
    const id = entryId(input.title, now);
    const frontmatter: IssueFrontmatter = {
      id,
      kind: "issue",
      title: input.title,
      issue_type: input.issueType,
      severity: input.severity ?? "medium",
      status: "open",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      archived: false,
      ...(input.by ? { by: input.by } : {}),
    };
    return this.writeEntry(projectId, "issue", frontmatter, input.body ?? "");
  }

  async list<K extends EntryKind>(
    projectId: string,
    kind: K,
    options: ListOptions = {},
  ): Promise<Entry<AnyFrontmatter>[]> {
    const dir = entryDir(this.root, projectId, kind);
    if (!(await fileExists(dir))) return [];
    const files = await readdir(dir);
    const mdFiles = files.filter((f) => f.endsWith(".md")).sort().reverse();
    const entries: Entry<AnyFrontmatter>[] = [];
    for (const file of mdFiles) {
      const entry = await this.readEntryFile(`${dir}/${file}`);
      if (!entry) continue;
      if (!options.includeArchived && entry.frontmatter.archived) continue;
      if (
        options.status &&
        entry.frontmatter.kind === "issue" &&
        (entry.frontmatter as IssueFrontmatter).status !== options.status
      ) {
        continue;
      }
      entries.push(entry);
      if (options.limit && entries.length >= options.limit) break;
    }
    return entries;
  }

  async show(
    projectId: string,
    kind: EntryKind,
    id: string,
  ): Promise<Entry<AnyFrontmatter> | null> {
    const path = entryPath(this.root, projectId, kind, id);
    return this.readEntryFile(path);
  }

  async updateIssueStatus(
    projectId: string,
    id: string,
    status: IssueStatus,
  ): Promise<Entry<IssueFrontmatter>> {
    const path = entryPath(this.root, projectId, "issue", id);
    const entry = await this.readEntryFile(path);
    if (!entry) throw new Error(`issue not found: ${id}`);
    if (entry.frontmatter.kind !== "issue") {
      throw new Error(`entry ${id} is not an issue`);
    }
    const fm = entry.frontmatter as IssueFrontmatter;
    fm.status = status;
    fm.updated_at = nowIso();
    if (status === "resolved") fm.resolved_at = fm.updated_at;
    await writeFile(path, serialize({ ...fm }, entry.body), "utf8");
    await this.commit(
      `issue(${projectId}/${id}): status → ${status}`,
      path,
    );
    return { frontmatter: fm, body: entry.body, path };
  }

  async archive(
    projectId: string,
    kind: EntryKind,
    id: string,
    reason: string,
  ): Promise<Entry<AnyFrontmatter>> {
    const path = entryPath(this.root, projectId, kind, id);
    const entry = await this.readEntryFile(path);
    if (!entry) throw new Error(`${kind} not found: ${id}`);
    const fm = entry.frontmatter as BaseEntryFrontmatter;
    fm.archived = true;
    fm.archived_at = nowIso();
    fm.archived_reason = reason;
    fm.updated_at = fm.archived_at;
    await writeFile(path, serialize({ ...fm }, entry.body), "utf8");
    await this.commit(
      `archive ${kind}(${projectId}/${id}): ${reason}`,
      path,
    );
    return { frontmatter: fm as AnyFrontmatter, body: entry.body, path };
  }

  async restore(
    projectId: string,
    kind: EntryKind,
    id: string,
  ): Promise<Entry<AnyFrontmatter>> {
    const path = entryPath(this.root, projectId, kind, id);
    const entry = await this.readEntryFile(path);
    if (!entry) throw new Error(`${kind} not found: ${id}`);
    const fm = entry.frontmatter as BaseEntryFrontmatter;
    fm.archived = false;
    delete fm.archived_at;
    delete fm.archived_reason;
    fm.updated_at = nowIso();
    await writeFile(path, serialize({ ...fm }, entry.body), "utf8");
    await this.commit(`restore ${kind}(${projectId}/${id})`, path);
    return { frontmatter: fm as AnyFrontmatter, body: entry.body, path };
  }

  async listProjects(): Promise<string[]> {
    const root = `${this.root}/projects`;
    if (!(await fileExists(root))) return [];
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  }

  private async writeEntry<F extends BaseEntryFrontmatter>(
    projectId: string,
    kind: EntryKind,
    frontmatter: F,
    body: string,
  ): Promise<Entry<F>> {
    const path = entryPath(this.root, projectId, kind, frontmatter.id);
    await ensureDir(dirname(path));
    const file = serialize(
      frontmatter as unknown as Record<string, unknown>,
      body,
    );
    await writeFile(path, file, "utf8");
    await this.commit(`add ${kind}(${projectId}/${frontmatter.id})`, path);
    return { frontmatter, body: body.trim(), path };
  }

  private async readEntryFile(
    path: string,
  ): Promise<Entry<AnyFrontmatter> | null> {
    if (!(await fileExists(path))) return null;
    const raw = await readFile(path, "utf8");
    const parsed = parse<AnyFrontmatter>(raw);
    return { frontmatter: parsed.frontmatter, body: parsed.body, path };
  }
}

function composeDecisionBody(body?: string, reasoning?: string): string {
  const parts: string[] = [];
  if (body?.trim()) parts.push(body.trim());
  if (reasoning?.trim()) {
    parts.push(`## Reasoning\n\n${reasoning.trim()}`);
  }
  return parts.join("\n\n");
}
