// Unit tests for the prefer-usecallback codemod's pure transforms.
// Run with: bun test fixers/prefer-usecallback.test.ts
//
// These cover the two functions that do the actual rewriting — buildReplacement
// (wrap an expression vs. convert a declaration) and ensureImport (the four
// import shapes) — without spawning Biome, so they are fast and deterministic.
import { describe, expect, test } from "bun:test";
import { buildReplacement, ensureImport } from "./prefer-usecallback.ts";

// Helper: locate a substring and call buildReplacement with its real offset, the
// way fixFile does (the char before the span decides expression vs declaration).
function wrap(source: string, span: string): string | null {
  const start = source.indexOf(span);
  if (start === -1) throw new Error(`span not found: ${span}`);
  return buildReplacement(source, start, span);
}

describe("buildReplacement", () => {
  test("arrow assigned to const → wrapped in place", () => {
    const src = "const handleClick = () => go();";
    expect(wrap(src, "() => go()")).toBe("useCallback(() => go(), [])");
  });

  test("function expression assigned to const → wrapped in place", () => {
    const src = "const save = function () { persist(); };";
    expect(wrap(src, "function () { persist(); }")).toBe("useCallback(function () { persist(); }, [])");
  });

  test("typed const arrow → wrapped in place (prev char is =)", () => {
    const src = "const handler: () => void = () => go();";
    expect(wrap(src, "() => go()")).toBe("useCallback(() => go(), [])");
  });

  test("function declaration → converted to const binding", () => {
    const src = "function handleReset() { reset(); }";
    expect(wrap(src, src)).toBe("const handleReset = useCallback(function handleReset() { reset(); }, []);");
  });

  test("async function declaration → keeps async via named fn expression", () => {
    const src = "async function load() { await x(); }";
    expect(wrap(src, src)).toBe("const load = useCallback(async function load() { await x(); }, []);");
  });

  test("generator declaration → keeps the star", () => {
    const src = "function* gen() { yield 1; }";
    expect(wrap(src, src)).toBe("const gen = useCallback(function* gen() { yield 1; }, []);");
  });

  test("unrecognised declaration shape → null (skip, do not corrupt)", () => {
    // A leading char that is not `=` and text that is not a function decl.
    const src = "return class {}";
    expect(buildReplacement(src, src.indexOf("class"), "class {}")).toBeNull();
  });
});

describe("ensureImport", () => {
  test("adds useCallback to an existing named React import", () => {
    const src = `import { useState } from "react";\nx;`;
    expect(ensureImport(src)).toBe(`import { useState, useCallback } from "react";\nx;`);
  });

  test("is idempotent when useCallback is already imported", () => {
    const src = `import { useState, useCallback } from "react";\nx;`;
    expect(ensureImport(src)).toBe(src);
  });

  test("augments a default-only React import", () => {
    const src = `import React from "react";\nx;`;
    expect(ensureImport(src)).toBe(`import React, { useCallback } from "react";\nx;`);
  });

  test("prepends an import when React is not imported at all", () => {
    const src = `const x = 1;\n`;
    expect(ensureImport(src)).toBe(`import { useCallback } from "react";\nconst x = 1;\n`);
  });

  test("handles a trailing comma in the named import list", () => {
    const src = `import { useState, } from "react";\nx;`;
    expect(ensureImport(src)).toBe(`import { useState, useCallback } from "react";\nx;`);
  });

  test("does not touch a useCallback imported from a non-react module", () => {
    const src = `import { useCallback } from "preact/hooks";\nimport { useState } from "react";\nx;`;
    // The react import still gets useCallback added; the preact one is left alone.
    expect(ensureImport(src)).toBe(
      `import { useCallback } from "preact/hooks";\nimport { useState, useCallback } from "react";\nx;`,
    );
  });
});
