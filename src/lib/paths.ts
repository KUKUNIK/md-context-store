import { homedir } from "node:os";
import { join } from "node:path";
import type { EntryKind } from "./types.js";

export function defaultStoreRoot(): string {
  return process.env.MDCS_HOME || join(homedir(), ".mdcs");
}

export function projectDir(root: string, projectId: string): string {
  return join(root, "projects", projectId);
}

export function entryDir(
  root: string,
  projectId: string,
  kind: EntryKind,
): string {
  return join(projectDir(root, projectId), `${kind}s`);
}

export function entryPath(
  root: string,
  projectId: string,
  kind: EntryKind,
  id: string,
): string {
  return join(entryDir(root, projectId, kind), `${id}.md`);
}

export function projectSummaryPath(root: string, projectId: string): string {
  return join(projectDir(root, projectId), "project.md");
}

export function currentWorkPath(root: string, projectId: string): string {
  return join(projectDir(root, projectId), "current.md");
}
