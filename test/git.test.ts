import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/lib/store.js";

const GIT_AVAILABLE = (() => {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const d = GIT_AVAILABLE ? describe : describe.skip;

d("Store with git audit", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mdcs-git-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates a commit per write when --git is enabled", async () => {
    const store = new Store({
      root,
      git: { enabled: true, authorName: "tester", authorEmail: "t@x" },
    });
    expect(store.gitEnabled).toBe(true);

    await store.initProject("demo");
    await store.addChunk("demo", { section: "intro", body: "hello" });
    await store.addDecision("demo", {
      title: "use vitest",
      decidedBy: "tester",
    });
    await store.addIssue("demo", {
      title: "needs docs",
      issueType: "task",
    });

    const log = await store.auditLog(20);
    expect(log.length).toBeGreaterThanOrEqual(4);
    const subjects = log.map((e) => e.subject);
    expect(subjects).toEqual(
      expect.arrayContaining([
        expect.stringContaining("update project summary"),
        expect.stringContaining("add chunk(demo/"),
        expect.stringContaining("add decision(demo/"),
        expect.stringContaining("add issue(demo/"),
      ]),
    );
  });

  it("commits status/archive/restore transitions with descriptive subjects", async () => {
    const store = new Store({
      root,
      git: { enabled: true, authorName: "tester", authorEmail: "t@x" },
    });
    const issue = await store.addIssue("demo", {
      title: "fix the thing",
      issueType: "bug",
    });
    await store.updateIssueStatus("demo", issue.frontmatter.id, "resolved");
    await store.archive(
      "demo",
      "issue",
      issue.frontmatter.id,
      "duplicate of #other",
    );
    await store.restore("demo", "issue", issue.frontmatter.id);

    const subjects = (await store.auditLog(20)).map((e) => e.subject);
    expect(subjects.some((s) => /status → resolved/.test(s))).toBe(true);
    expect(subjects.some((s) => /archive issue/.test(s) && /duplicate/.test(s)))
      .toBe(true);
    expect(subjects.some((s) => /restore issue/.test(s))).toBe(true);
  });

  it("noops when there is nothing new to commit", async () => {
    const store = new Store({
      root,
      git: { enabled: true, authorName: "tester", authorEmail: "t@x" },
    });
    await store.initProject("demo");
    const before = (await store.auditLog(50)).length;
    // initProject is idempotent — second call writes nothing new.
    await store.initProject("demo");
    const after = (await store.auditLog(50)).length;
    expect(after).toBe(before);
  });

  it("does not init a repo or commit when git is disabled", async () => {
    const store = new Store({ root });
    expect(store.gitEnabled).toBe(false);
    await store.initProject("demo");
    expect(await store.auditLog()).toEqual([]);
  });
});
