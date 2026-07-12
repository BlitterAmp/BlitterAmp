#!/usr/bin/env node
// Generates the dependency-attribution data shown in the About window, across
// BOTH ecosystems that ship in BlitterAmp:
//   - npm production deps (the webview bundle): `pnpm licenses list -P --json`.
//   - Rust crates linked into the host binary: walked from `cargo metadata`,
//     following only normal (non-dev, non-build) dependency edges so the list
//     is what actually ships — rodio, symphonia, cpal, tauri, reqwest, ….
//
// Output: src/generated/licenses.json (committed; re-run `pnpm gen:licenses`
// whenever dependencies change). We record the SPDX license id + homepage per
// package (not the full license text — that would bloat the committed file to
// megabytes; the homepage links reach the canonical text).
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "src/generated/licenses.json");

function npmEntries() {
  const raw = execFileSync("pnpm", ["licenses", "list", "-P", "--json"], { cwd: root, encoding: "utf8" });
  const byLicense = JSON.parse(raw);
  const entries = [];
  for (const group of Object.values(byLicense)) {
    for (const pkg of group) {
      entries.push({
        ecosystem: "npm",
        name: pkg.name,
        version: pkg.versions?.at(-1) ?? "unknown",
        license: pkg.license ?? "unknown",
        homepage: pkg.homepage ?? null,
        description: pkg.description ?? null,
      });
    }
  }
  return entries;
}

function rustEntries() {
  const raw = execFileSync("cargo", ["metadata", "--format-version", "1", "--quiet"], {
    cwd: join(root, "src-tauri"),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const meta = JSON.parse(raw);
  const pkgById = new Map(meta.packages.map((p) => [p.id, p]));
  const nodeById = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const rootId = meta.resolve.root;

  // Walk only normal edges (dep_kinds with kind === null) so we exclude
  // build-scripts and dev deps — i.e. only what links into the binary.
  const shipped = new Set();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    const node = nodeById.get(id);
    if (!node) continue;
    for (const dep of node.deps ?? []) {
      const normal = (dep.dep_kinds ?? []).some((k) => k.kind === null || k.kind === undefined);
      if (!normal || shipped.has(dep.pkg)) continue;
      shipped.add(dep.pkg);
      queue.push(dep.pkg);
    }
  }

  return [...shipped].map((id) => {
    const p = pkgById.get(id);
    return {
      ecosystem: "rust",
      name: p.name,
      version: p.version,
      license: p.license ?? (p.license_file ? "See license file" : "unknown"),
      homepage: p.homepage ?? p.repository ?? null,
      description: p.description ?? null,
    };
  });
}

const seen = new Set();
const entries = [...npmEntries(), ...rustEntries()]
  .filter((e) => {
    const key = `${e.ecosystem}:${e.name}`;
    return seen.has(key) ? false : seen.add(key);
  })
  .sort((a, b) => a.name.localeCompare(b.name) || a.ecosystem.localeCompare(b.ecosystem));

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(entries, null, 2)}\n`);
const npm = entries.filter((e) => e.ecosystem === "npm").length;
const rust = entries.filter((e) => e.ecosystem === "rust").length;
console.log(`wrote ${entries.length} entries (${npm} npm, ${rust} rust) to ${outFile}`);
