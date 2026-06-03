import { readFile } from "node:fs/promises";
import { Command } from "commander";
import kleur from "kleur";
import { buildBootstrap, renderBootstrap } from "./lib/bootstrap.js";
import { Store } from "./lib/store.js";
import type {
  EntryKind,
  IssueSeverity,
  IssueStatus,
  IssueType,
} from "./lib/types.js";

const VERSION = "0.2.0";

interface GlobalOptions {
  store?: string;
  git?: boolean;
  gitAuthor?: string;
  gitEmail?: string;
}

function makeStore(options: GlobalOptions): Store {
  return new Store({
    root: options.store,
    git: options.git
      ? {
          enabled: true,
          authorName: options.gitAuthor,
          authorEmail: options.gitEmail,
        }
      : undefined,
  });
}

async function readBody(opts: {
  body?: string;
  bodyFile?: string;
  stdin?: boolean;
}): Promise<string> {
  if (opts.body) return opts.body;
  if (opts.bodyFile) return readFile(opts.bodyFile, "utf8");
  if (opts.stdin) return readStdin();
  return "";
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk.toString("utf8");
  }
  return data;
}

function printErr(message: string): void {
  process.stderr.write(`${kleur.red("error")}: ${message}\n`);
}

function printOk(message: string): void {
  process.stdout.write(`${kleur.green("ok")} ${message}\n`);
}

function isEntryKind(s: string): s is EntryKind {
  return s === "chunk" || s === "decision" || s === "issue";
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("mdcs")
    .description(
      "md-context-store — local filesystem context store for AI sessions",
    )
    .version(VERSION)
    .option("--store <path>", "store root directory (default: $MDCS_HOME or ~/.mdcs)")
    .option("--git", "auto-commit every write to the store root as a git audit trail")
    .option("--git-author <name>", "git author name (used with --git; default: mdcs)")
    .option("--git-email <email>", "git author email (used with --git; default: mdcs@local)");

  program
    .command("init <project-id>")
    .description("initialize a project directory")
    .option("--summary <text>", "initial project summary text")
    .action(async (projectId: string, opts: { summary?: string }) => {
      const store = makeStore(program.opts() as GlobalOptions);
      await store.initProject(projectId, { summary: opts.summary });
      printOk(`project initialized: ${projectId} (store: ${store.root})`);
    });

  program
    .command("projects")
    .description("list all projects in the store")
    .action(async () => {
      const store = makeStore(program.opts() as GlobalOptions);
      const ids = await store.listProjects();
      if (ids.length === 0) {
        process.stdout.write("(no projects yet)\n");
        return;
      }
      for (const id of ids) process.stdout.write(`${id}\n`);
    });

  program
    .command("summary <project-id>")
    .description("read or write the project summary")
    .option("--content <text>", "new summary content")
    .option("--content-file <path>", "read summary from file")
    .option("--stdin", "read summary from stdin")
    .action(
      async (
        projectId: string,
        opts: { content?: string; contentFile?: string; stdin?: boolean },
      ) => {
        const store = makeStore(program.opts() as GlobalOptions);
        const body = await readBody({
          body: opts.content,
          bodyFile: opts.contentFile,
          stdin: opts.stdin,
        });
        if (body) {
          const result = await store.updateProjectSummary(projectId, body);
          printOk(`project summary updated (${result.updated_at})`);
        } else {
          const current = await store.getProjectSummary(projectId);
          if (!current) {
            process.stdout.write("(no project summary)\n");
            return;
          }
          process.stdout.write(`${current.content}\n`);
        }
      },
    );

  program
    .command("current <project-id>")
    .description("read or write the current work summary")
    .option("--content <text>", "new current work content")
    .option("--content-file <path>", "read content from file")
    .option("--stdin", "read content from stdin")
    .action(
      async (
        projectId: string,
        opts: { content?: string; contentFile?: string; stdin?: boolean },
      ) => {
        const store = makeStore(program.opts() as GlobalOptions);
        const body = await readBody({
          body: opts.content,
          bodyFile: opts.contentFile,
          stdin: opts.stdin,
        });
        if (body) {
          const result = await store.updateCurrentWork(projectId, body);
          printOk(`current work updated (${result.updated_at})`);
        } else {
          const current = await store.getCurrentWork(projectId);
          if (!current) {
            process.stdout.write("(no current work)\n");
            return;
          }
          process.stdout.write(`${current.content}\n`);
        }
      },
    );

  const add = program.command("add").description("add a chunk / decision / issue");

  add
    .command("chunk <project-id>")
    .description("add a context chunk")
    .requiredOption("--section <name>", "section / topic name")
    .option("--body <text>", "chunk body markdown")
    .option("--body-file <path>", "read body from file")
    .option("--stdin", "read body from stdin")
    .option("--by <agent>", "author identifier")
    .action(
      async (
        projectId: string,
        opts: {
          section: string;
          body?: string;
          bodyFile?: string;
          stdin?: boolean;
          by?: string;
        },
      ) => {
        const store = makeStore(program.opts() as GlobalOptions);
        const body = await readBody({
          body: opts.body,
          bodyFile: opts.bodyFile,
          stdin: opts.stdin,
        });
        const entry = await store.addChunk(projectId, {
          section: opts.section,
          body,
          by: opts.by,
        });
        printOk(`chunk added: ${entry.frontmatter.id} (${entry.path})`);
      },
    );

  add
    .command("decision <project-id>")
    .description("add a decision record")
    .requiredOption("--title <text>", "decision title")
    .requiredOption("--by <agent>", "decided by")
    .option("--reasoning <text>", "reasoning text")
    .option("--body <text>", "extra body markdown")
    .option("--body-file <path>", "read body from file")
    .option("--stdin", "read body from stdin")
    .option("--date <yyyy-mm-dd>", "decision date (default: today UTC)")
    .action(
      async (
        projectId: string,
        opts: {
          title: string;
          by: string;
          reasoning?: string;
          body?: string;
          bodyFile?: string;
          stdin?: boolean;
          date?: string;
        },
      ) => {
        const store = makeStore(program.opts() as GlobalOptions);
        const body = await readBody({
          body: opts.body,
          bodyFile: opts.bodyFile,
          stdin: opts.stdin,
        });
        const entry = await store.addDecision(projectId, {
          title: opts.title,
          decidedBy: opts.by,
          body,
          reasoning: opts.reasoning,
          decisionDate: opts.date,
        });
        printOk(`decision added: ${entry.frontmatter.id} (${entry.path})`);
      },
    );

  add
    .command("issue <project-id>")
    .description("add an issue (bug, task, risk, incident)")
    .requiredOption("--title <text>", "issue title")
    .requiredOption("--type <kind>", "bug | task | risk | incident")
    .option("--severity <level>", "low | medium | high | critical", "medium")
    .option("--body <text>", "issue body markdown")
    .option("--body-file <path>", "read body from file")
    .option("--stdin", "read body from stdin")
    .option("--by <agent>", "discovered by")
    .action(
      async (
        projectId: string,
        opts: {
          title: string;
          type: string;
          severity: string;
          body?: string;
          bodyFile?: string;
          stdin?: boolean;
          by?: string;
        },
      ) => {
        const store = makeStore(program.opts() as GlobalOptions);
        const issueType = opts.type as IssueType;
        if (!["bug", "task", "risk", "incident"].includes(issueType)) {
          printErr(`invalid --type: ${opts.type}`);
          process.exitCode = 1;
          return;
        }
        const severity = opts.severity as IssueSeverity;
        if (!["low", "medium", "high", "critical"].includes(severity)) {
          printErr(`invalid --severity: ${opts.severity}`);
          process.exitCode = 1;
          return;
        }
        const body = await readBody({
          body: opts.body,
          bodyFile: opts.bodyFile,
          stdin: opts.stdin,
        });
        const entry = await store.addIssue(projectId, {
          title: opts.title,
          issueType,
          severity,
          body,
          by: opts.by,
        });
        printOk(`issue added: ${entry.frontmatter.id} (${entry.path})`);
      },
    );

  program
    .command("list <project-id> <kind>")
    .description("list entries of a kind (chunk | decision | issue)")
    .option("--limit <n>", "limit results", "20")
    .option("--archived", "include archived entries")
    .option("--status <state>", "filter issues by status")
    .action(
      async (
        projectId: string,
        kind: string,
        opts: { limit: string; archived?: boolean; status?: string },
      ) => {
        if (!isEntryKind(kind)) {
          printErr(`invalid kind: ${kind} (expected chunk | decision | issue)`);
          process.exitCode = 1;
          return;
        }
        const store = makeStore(program.opts() as GlobalOptions);
        const entries = await store.list(projectId, kind, {
          limit: Number.parseInt(opts.limit, 10),
          includeArchived: opts.archived,
          status: opts.status as IssueStatus | undefined,
        });
        if (entries.length === 0) {
          process.stdout.write("(none)\n");
          return;
        }
        for (const entry of entries) {
          const fm = entry.frontmatter;
          if (fm.kind === "chunk") {
            process.stdout.write(`${fm.id}\t${fm.section}\n`);
          } else if (fm.kind === "decision") {
            process.stdout.write(
              `${fm.id}\t${fm.decision_date}\t${fm.decided_by}\t${fm.title}\n`,
            );
          } else if (fm.kind === "issue") {
            process.stdout.write(
              `${fm.id}\t${fm.status}\t${fm.severity}\t${fm.title}\n`,
            );
          }
        }
      },
    );

  program
    .command("show <project-id> <kind> <id>")
    .description("show a single entry")
    .action(async (projectId: string, kind: string, id: string) => {
      if (!isEntryKind(kind)) {
        printErr(`invalid kind: ${kind}`);
        process.exitCode = 1;
        return;
      }
      const store = makeStore(program.opts() as GlobalOptions);
      const entry = await store.show(projectId, kind, id);
      if (!entry) {
        printErr(`not found: ${kind} ${id}`);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${JSON.stringify(entry.frontmatter, null, 2)}\n`);
      process.stdout.write("---\n");
      process.stdout.write(`${entry.body}\n`);
    });

  program
    .command("bootstrap <project-id>")
    .description("render full bootstrap context as markdown")
    .option("--limit-chunks <n>", "recent chunks", "10")
    .option("--limit-decisions <n>", "recent decisions", "10")
    .option("--limit-issues <n>", "open issues", "30")
    .action(
      async (
        projectId: string,
        opts: {
          limitChunks: string;
          limitDecisions: string;
          limitIssues: string;
        },
      ) => {
        const store = makeStore(program.opts() as GlobalOptions);
        const result = await buildBootstrap(store, projectId, {
          recentChunkLimit: Number.parseInt(opts.limitChunks, 10),
          recentDecisionLimit: Number.parseInt(opts.limitDecisions, 10),
          openIssueLimit: Number.parseInt(opts.limitIssues, 10),
        });
        process.stdout.write(renderBootstrap(result));
      },
    );

  program
    .command("status <project-id> <issue-id> <state>")
    .description("change issue status: open | in_progress | resolved | archived")
    .action(async (projectId: string, issueId: string, state: string) => {
      const allowed: IssueStatus[] = [
        "open",
        "in_progress",
        "resolved",
        "archived",
      ];
      if (!allowed.includes(state as IssueStatus)) {
        printErr(`invalid state: ${state}`);
        process.exitCode = 1;
        return;
      }
      const store = makeStore(program.opts() as GlobalOptions);
      const entry = await store.updateIssueStatus(
        projectId,
        issueId,
        state as IssueStatus,
      );
      printOk(`issue ${entry.frontmatter.id} → ${state}`);
    });

  program
    .command("archive <project-id> <kind> <id>")
    .description("soft-archive an entry")
    .requiredOption("--reason <text>", "archive reason")
    .action(
      async (
        projectId: string,
        kind: string,
        id: string,
        opts: { reason: string },
      ) => {
        if (!isEntryKind(kind)) {
          printErr(`invalid kind: ${kind}`);
          process.exitCode = 1;
          return;
        }
        const store = makeStore(program.opts() as GlobalOptions);
        const entry = await store.archive(projectId, kind, id, opts.reason);
        printOk(`archived: ${entry.frontmatter.id}`);
      },
    );

  program
    .command("restore <project-id> <kind> <id>")
    .description("restore an archived entry")
    .action(async (projectId: string, kind: string, id: string) => {
      if (!isEntryKind(kind)) {
        printErr(`invalid kind: ${kind}`);
        process.exitCode = 1;
        return;
      }
      const store = makeStore(program.opts() as GlobalOptions);
      const entry = await store.restore(projectId, kind, id);
      printOk(`restored: ${entry.frontmatter.id}`);
    });

  program
    .command("log")
    .description("show the git audit log (requires --git on the parent invocation)")
    .option("-n, --limit <n>", "limit entries", "20")
    .action(async (opts: { limit: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      if (!globalOpts.git) {
        printErr(
          "mdcs log requires --git on the parent invocation (e.g. `mdcs --git log`)",
        );
        process.exitCode = 1;
        return;
      }
      const store = makeStore(globalOpts);
      if (!store.gitEnabled) {
        printErr("git audit is not enabled for this store");
        process.exitCode = 1;
        return;
      }
      const entries = await store.auditLog(Number.parseInt(opts.limit, 10));
      if (entries.length === 0) {
        process.stdout.write("(no commits yet)\n");
        return;
      }
      for (const e of entries) {
        process.stdout.write(
          `${e.sha.slice(0, 8)}  ${e.date}  ${e.subject}\n`,
        );
      }
    });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    printErr(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

main();
