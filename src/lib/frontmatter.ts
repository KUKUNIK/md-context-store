import matter from "gray-matter";

export function serialize(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const stringified = matter.stringify(body.trimEnd() + "\n", frontmatter);
  return stringified.endsWith("\n") ? stringified : `${stringified}\n`;
}

export function parse<F = Record<string, unknown>>(
  raw: string,
): { frontmatter: F; body: string } {
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as F,
    body: parsed.content.trim(),
  };
}
