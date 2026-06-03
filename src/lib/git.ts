import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitOptions {
  /** Author name baked into commit objects. Defaults to "mdcs". */
  authorName?: string;
  /** Author email. Defaults to "mdcs@local". */
  authorEmail?: string;
  /** Override the git binary (mostly for tests). Defaults to "git". */
  bin?: string;
  /**
   * If true, attempt `git init` on the store root the first time a commit
   * is requested. Defaults to true — turn off if the store root sits inside
   * an existing repo you don't want polluted.
   */
  initIfMissing?: boolean;
}

export interface GitAuditOptions extends GitOptions {
  /**
   * Disables the audit trail entirely. Equivalent to not configuring git
   * at all, but useful as an explicit kill switch from the CLI.
   */
  enabled?: boolean;
}

const DEFAULT_NAME = "mdcs";
const DEFAULT_EMAIL = "mdcs@local";
const DEFAULT_BIN = "git";

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Stateless git wrapper used by the Store. Each call shells out to the
 * configured git binary with the store root as cwd. Errors are surfaced
 * to the caller — never swallowed — so a broken setup is visible up front
 * rather than after weeks of missing audit history.
 */
export class GitAudit {
  private readonly bin: string;
  private readonly authorName: string;
  private readonly authorEmail: string;
  private readonly initIfMissing: boolean;
  private initialised = false;

  constructor(
    readonly root: string,
    options: GitOptions = {},
  ) {
    this.bin = options.bin ?? DEFAULT_BIN;
    this.authorName = options.authorName ?? DEFAULT_NAME;
    this.authorEmail = options.authorEmail ?? DEFAULT_EMAIL;
    this.initIfMissing = options.initIfMissing ?? true;
  }

  private async run(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync(this.bin, args, {
      cwd: this.root,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: this.authorName,
        GIT_AUTHOR_EMAIL: this.authorEmail,
        GIT_COMMITTER_NAME: this.authorName,
        GIT_COMMITTER_EMAIL: this.authorEmail,
      },
    });
  }

  private async ensureInitialised(): Promise<void> {
    if (this.initialised) return;
    const gitDir = join(this.root, ".git");
    if (await dirExists(gitDir)) {
      this.initialised = true;
      return;
    }
    if (!this.initIfMissing) {
      throw new Error(
        `git audit: store root "${this.root}" is not a git repo and initIfMissing=false`,
      );
    }
    await this.run(["init", "--quiet", "--initial-branch=main"]);
    this.initialised = true;
  }

  async commit(message: string, paths: readonly string[]): Promise<string | null> {
    if (paths.length === 0) return null;
    await this.ensureInitialised();
    await this.run(["add", "--", ...paths]);
    const status = await this.run(["status", "--porcelain"]);
    if (status.stdout.trim() === "") return null;
    await this.run(["commit", "--quiet", "--no-verify", "-m", message]);
    const { stdout } = await this.run(["rev-parse", "HEAD"]);
    return stdout.trim();
  }

  async log(limit = 20): Promise<{ sha: string; subject: string; date: string }[]> {
    await this.ensureInitialised();
    try {
      const { stdout } = await this.run([
        "log",
        `-n${limit}`,
        "--pretty=format:%H%x09%cI%x09%s",
      ]);
      return stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [sha = "", date = "", subject = ""] = line.split("\t");
          return { sha, date, subject };
        });
    } catch {
      return [];
    }
  }
}
