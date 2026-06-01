export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function timestampId(now: Date = new Date()): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}` +
    `-${pad(now.getUTCMilliseconds(), 3)}`
  );
}

export function entryId(title: string, now: Date = new Date()): string {
  const slug = slugify(title);
  const stamp = timestampId(now);
  return slug ? `${stamp}-${slug}` : stamp;
}
