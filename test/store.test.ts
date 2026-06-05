import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/lib/store.js";
import { buildBootstrap, renderBootstrap } from "../src/lib/bootstrap.js";

describe("Store", () => {
  let root: string;
  let store: Store;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mdcs-test-"));
    store = new Store({ root });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("initializes a project with summary scaffolding", async () => {
    await store.initProject("demo");
    const projects = await store.listProjects();
    expect(projects).toEqual(["demo"]);
    const summary = await store.getProjectSummary("demo");
    expect(summary).not.toBeNull();
    expect(summary?.content).toContain("demo");
  });

  it("rejects invalid project ids", async () => {
    await expect(store.initProject("bad name!")).rejects.toThrow(
      /invalid project id/,
    );
  });

  it("adds a chunk and lists it", async () => {
    await store.initProject("demo");
    const entry = await store.addChunk("demo", {
      section: "initial",
      body: "hello world",
      by: "tester",
    });
    expect(entry.frontmatter.kind).toBe("chunk");
    expect(entry.frontmatter.section).toBe("initial");
    expect(entry.body).toBe("hello world");

    const list = await store.list("demo", "chunk");
    expect(list).toHaveLength(1);
    expect(list[0]?.frontmatter.id).toBe(entry.frontmatter.id);
  });

  it("adds a decision with reasoning composed into body", async () => {
    await store.initProject("demo");
    const entry = await store.addDecision("demo", {
      title: "use markdown",
      decidedBy: "alice",
      body: "we will store entries as markdown files",
      reasoning: "no database dependency",
    });
    expect(entry.body).toContain("we will store entries as markdown files");
    expect(entry.body).toContain("## Reasoning");
    expect(entry.body).toContain("no database dependency");
  });

  it("adds an issue and transitions status", async () => {
    await store.initProject("demo");
    const created = await store.addIssue("demo", {
      title: "broken link",
      issueType: "bug",
      severity: "high",
      body: "404 on /docs",
    });
    expect(created.frontmatter.status).toBe("open");

    const resolved = await store.updateIssueStatus(
      "demo",
      created.frontmatter.id,
      "resolved",
    );
    expect(resolved.frontmatter.status).toBe("resolved");
    expect(resolved.frontmatter.resolved_at).toBeTruthy();
  });

  it("filters open issues by default in list()", async () => {
    await store.initProject("demo");
    const a = await store.addIssue("demo", {
      title: "first",
      issueType: "task",
    });
    const b = await store.addIssue("demo", {
      title: "second",
      issueType: "task",
    });
    await store.updateIssueStatus("demo", b.frontmatter.id, "resolved");

    const openOnly = await store.list("demo", "issue", { status: "open" });
    expect(openOnly.map((e) => e.frontmatter.id)).toEqual([a.frontmatter.id]);
  });

  it("soft-archives and restores entries", async () => {
    await store.initProject("demo");
    const chunk = await store.addChunk("demo", {
      section: "to-archive",
      body: "delete me",
    });
    await store.archive("demo", "chunk", chunk.frontmatter.id, "no longer relevant");
    const listed = await store.list("demo", "chunk");
    expect(listed).toHaveLength(0);
    const withArchived = await store.list("demo", "chunk", {
      includeArchived: true,
    });
    expect(withArchived).toHaveLength(1);
    expect(withArchived[0]?.frontmatter.archived).toBe(true);

    await store.restore("demo", "chunk", chunk.frontmatter.id);
    const after = await store.list("demo", "chunk");
    expect(after).toHaveLength(1);
    expect(after[0]?.frontmatter.archived).toBe(false);
  });

  it("filters entries by --since (inclusive lower bound on created_at)", async () => {
    await store.initProject("demo");
    const old = await store.addChunk("demo", {
      section: "ancient",
      body: "from before",
    });
    // Ensure the two entries have distinguishable created_at timestamps.
    await new Promise((r) => setTimeout(r, 5));
    const recent = await store.addChunk("demo", {
      section: "recent",
      body: "from after",
    });

    // since in the distant past → both visible
    const allEntries = await store.list("demo", "chunk", {
      since: "1970-01-01",
    });
    expect(allEntries.map((e) => e.frontmatter.id).sort()).toEqual(
      [old.frontmatter.id, recent.frontmatter.id].sort(),
    );

    // since after the older entry's timestamp → only the newer one survives
    const cutoff = recent.frontmatter.created_at;
    const onlyRecent = await store.list("demo", "chunk", { since: cutoff });
    expect(onlyRecent.map((e) => e.frontmatter.id)).toEqual([
      recent.frontmatter.id,
    ]);

    // since in the far future → nothing
    const future = await store.list("demo", "chunk", {
      since: "2999-01-01",
    });
    expect(future).toEqual([]);
  });

  it("writes and reads project summary and current work", async () => {
    await store.initProject("demo");
    await store.updateProjectSummary("demo", "# Demo\n\nDescription.");
    await store.updateCurrentWork("demo", "phase: design\nstatus: active");

    const summary = await store.getProjectSummary("demo");
    expect(summary?.content).toContain("Description.");
    const current = await store.getCurrentWork("demo");
    expect(current?.content).toContain("phase: design");
  });

  it("persists frontmatter and body to disk", async () => {
    await store.initProject("demo");
    const entry = await store.addChunk("demo", {
      section: "persistence",
      body: "stored on disk",
    });
    const raw = await readFile(entry.path, "utf8");
    expect(raw).toContain("kind: chunk");
    expect(raw).toContain("section: persistence");
    expect(raw).toContain("stored on disk");
  });

  it("builds and renders a bootstrap context", async () => {
    await store.initProject("demo", { summary: "# Demo\n\nfor bootstrap." });
    await store.updateCurrentWork("demo", "doing things");
    await store.addChunk("demo", { section: "alpha", body: "chunk alpha" });
    await store.addDecision("demo", {
      title: "pick alpha",
      decidedBy: "alice",
      reasoning: "alpha first",
    });
    await store.addIssue("demo", {
      title: "open issue",
      issueType: "task",
    });

    const result = await buildBootstrap(store, "demo");
    expect(result.projectSummary?.content).toContain("for bootstrap.");
    expect(result.currentWork?.content).toBe("doing things");
    expect(result.recentChunks).toHaveLength(1);
    expect(result.recentDecisions).toHaveLength(1);
    expect(result.openIssues).toHaveLength(1);

    const md = renderBootstrap(result);
    expect(md).toContain("# demo bootstrap");
    expect(md).toContain("## project_summary");
    expect(md).toContain("for bootstrap.");
    expect(md).toContain("chunk alpha");
    expect(md).toContain("pick alpha");
    expect(md).toContain("open issue");
  });
});
