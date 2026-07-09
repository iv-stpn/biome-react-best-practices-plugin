// Codemod for `react/prefer-usecallback`.
//
// The plugin rule is diagnostic-only: it reports every function declared at the
// top level of a component/hook body but leaves the code untouched, because the
// correct repair (wrap in useCallback, fill the dependency array, add the
// import) is context-specific and — for imports — not something Biome's GritQL
// can synthesise safely.
//
// This script applies that repair. It runs Biome to collect the rule's
// diagnostics (so it sees exactly what the rule matched, with the same scope
// rules), then rewrites each reported span:
//
//   const handleClick = () => go();        →  const handleClick = useCallback(() => go(), []);
//   function handleReset() { reset(); }    →  const handleReset = useCallback(function handleReset() { reset(); }, []);
//   async function load() { await x(); }   →  const load = useCallback(async function load() { await x(); }, []);
//
// and ensures `useCallback` is imported from React. The dependency array is
// always left EMPTY — computing real dependencies needs dataflow analysis this
// script does not attempt. You MUST fill each `[]` in; an empty array closes
// over stale props/state. The script prints a count of callbacks to review.
//
// Run it AFTER `biome check --write .` (so formatting/other fixes settle first):
//   bun run node_modules/biome-react-best-practices-plugin/fixers/prefer-usecallback.ts [paths...]
//
// Flags:
//   --dry-run   show what would change without writing
//   --help      usage
//
// Idempotent: a function already wrapped in useCallback is a call expression,
// not a bare function, so the rule no longer matches it and the script skips it.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const RULE = "prefer-usecallback";

interface Pos {
  line: number;
  column: number;
}
interface Edit {
  start: number;
  end: number;
  text: string;
}

// Locate the Biome binary the consumer already has installed. Prefer the local
// node_modules/.bin; fall back to a bare `biome` on PATH.
function resolveBiome(): string {
  const local = join(process.cwd(), "node_modules", ".bin", "biome");
  return existsSync(local) ? local : "biome";
}

interface BiomeDiagnostic {
  category?: string;
  message?: string;
  location?: { path?: string; start?: Pos; end?: Pos };
}

// Run `biome lint --reporter=json` on the given paths and return the parsed
// report. Biome exits non-zero whenever any diagnostic is emitted, so capture
// stdout regardless of exit code.
function runBiome(paths: string[]): { diagnostics?: BiomeDiagnostic[] } {
  const biome = resolveBiome();
  let raw = "";
  try {
    raw = execFileSync(biome, ["lint", "--reporter=json", ...paths], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    raw = (err as { stdout?: string }).stdout ?? "";
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    console.error("prefer-usecallback: could not parse Biome JSON output.");
    process.exit(1);
  }
}

interface BiomeDiagnostic {
  category?: string;
  message?: string;
  location?: { path?: string; start?: Pos; end?: Pos };
}

// Convert a 1-based {line, column} into a 0-based string offset for `source`.
// Biome columns count UTF-16 code units from 1, matching JS string indexing.
function toOffset(source: string, pos: Pos): number {
  let line = 1;
  let offset = 0;
  while (line < pos.line) {
    const nl = source.indexOf("\n", offset);
    if (nl === -1) return source.length;
    offset = nl + 1;
    line++;
  }
  return offset + (pos.column - 1);
}

// Build the replacement for one reported span. The rule sets the span so this is
// unambiguous: for the `const NAME = <fn>` form the span is the function node, so
// we wrap it in place; for a `function` declaration the span is the whole
// statement, and the char before it (skipping whitespace) is NOT `=`, so we
// convert it to a `const NAME = useCallback(function NAME(...) {...}, [])`. A
// named function expression inside useCallback preserves async/generator/name,
// so no special-casing is needed for those.
export function buildReplacement(source: string, start: number, spanText: string): string | null {
  // Walk back over whitespace to find the character preceding the span.
  let i = start - 1;
  while (i >= 0 && /\s/.test(source[i] ?? "")) i--;
  const prev = i >= 0 ? (source[i] ?? "") : "";

  if (prev === "=") {
    // const/let assignment — the span is the function expression itself.
    return `useCallback(${spanText}, [])`;
  }

  // Function declaration — extract its name to rebuild it as a const binding.
  const m = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)/.exec(spanText);
  if (!m) return null; // Unexpected shape — skip rather than corrupt the file.
  const name = m[1];
  return `const ${name} = useCallback(${spanText}, []);`;
}

// Ensure `useCallback` is imported from React. Returns the source unchanged if it
// is already imported. Handles: an existing named import (add to the braces), a
// default-only `import React from "react"` (add a named clause), and no React
// import at all (prepend a fresh line — Biome's import organiser merges/sorts it
// on the next `biome check --write`).
export function ensureImport(source: string): string {
  // Already imported anywhere from react?
  if (/import[^;]*\{[^}]*\buseCallback\b[^}]*\}[^;]*from\s*["']react["']/s.test(source)) return source;

  // Named import (optionally with a default before the braces): add to the list.
  // Rebuild the braces with normalized `{ a, b }` spacing (Biome will reformat to
  // the project's style on the next `biome check --write` regardless).
  const named = /(import\s+(?:[A-Za-z0-9_$]+\s*,\s*)?)\{([^}]*)\}(\s*from\s*["']react["'])/s;
  if (named.test(source))
    return source.replace(named, (_full, head: string, inner: string, tail: string) => {
      const items = inner
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      items.push("useCallback");
      return `${head}{ ${items.join(", ")} }${tail}`;
    });

  // Default-only import: `import React from "react"` → add a named clause.
  const def = /(import\s+[A-Za-z0-9_$]+)(\s+from\s*["']react["'])/;
  if (def.test(source)) return source.replace(def, (_full, head: string, tail: string) => `${head}, { useCallback }${tail}`);

  // No React import at all — prepend one.
  return `import { useCallback } from "react";\n${source}`;
}

// Apply the codemod to one file. Returns the number of callbacks wrapped.
function fixFile(path: string, diagnostics: BiomeDiagnostic[], dryRun: boolean): number {
  const source = readFileSync(path, "utf8");

  // Turn each diagnostic into a text edit, sorted by descending start offset so
  // applying them never invalidates the offsets of edits not yet applied.
  const edits: Edit[] = [];
  for (const d of diagnostics) {
    const s = d.location?.start;
    const e = d.location?.end;
    if (!s || !e) continue;
    const start = toOffset(source, s);
    const end = toOffset(source, e);
    const spanText = source.slice(start, end);
    const text = buildReplacement(source, start, spanText);
    if (text === null) {
      console.warn(`  ! skipped unrecognised span at ${path}:${s.line}:${s.column}`);
      continue;
    }
    edits.push({ start, end, text });
  }
  if (edits.length === 0) return 0;
  edits.sort((a, b) => b.start - a.start);

  let out = source;
  for (const edit of edits) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  out = ensureImport(out);

  if (dryRun) console.log(`  would fix ${edits.length} callback(s) in ${path}`);
  else {
    writeFileSync(path, out, "utf8");
    console.log(`  fixed ${edits.length} callback(s) in ${path}`);
  }
  return edits.length;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(
      [
        "Wrap top-level component/hook functions flagged by react/prefer-usecallback in useCallback.",
        "",
        "Usage:",
        "  bun run node_modules/biome-react-best-practices-plugin/fixers/prefer-usecallback.ts [paths...]",
        "",
        "Run it AFTER `biome check --write .`. Paths default to the current directory.",
        "",
        "Flags:",
        "  --dry-run   show what would change without writing",
        "  --help, -h  this message",
        "",
        "The dependency array of every wrapped callback is left EMPTY — you must fill it in.",
      ].join("\n"),
    );
    return;
  }

  const dryRun = argv.includes("--dry-run");
  const paths = argv.filter((a) => !a.startsWith("-"));
  if (paths.length === 0) paths.push(".");

  const report = runBiome(paths);
  const relevant = (report.diagnostics ?? []).filter(
    (d) => d.category === "plugin" && (d.message ?? "").includes(`[react/${RULE}]`),
  );

  if (relevant.length === 0) {
    console.log("prefer-usecallback: nothing to fix.");
    return;
  }

  // Group diagnostics by file.
  const byFile = new Map<string, BiomeDiagnostic[]>();
  for (const d of relevant) {
    const p = d.location?.path;
    if (!p) continue;
    const list = byFile.get(p);
    if (list) list.push(d);
    else byFile.set(p, [d]);
  }

  let total = 0;
  for (const [path, diags] of byFile) total += fixFile(path, diags, dryRun);

  const verb = dryRun ? "would wrap" : "wrapped";
  console.log(
    `\nprefer-usecallback: ${verb} ${total} callback(s) across ${byFile.size} file(s).` +
      (total > 0 ? `\n⚠ Review each useCallback: the dependency array is empty and must be completed.` : ""),
  );
}

// Only run when executed directly (`bun run …`), not when imported by a test.
// `require.main === module` is the CommonJS equivalent of Bun's import.meta.main
// and works under this tsconfig's CommonJS output.
if (require.main === module) main();
