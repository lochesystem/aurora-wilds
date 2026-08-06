#!/usr/bin/env node
/**
 * Rewrites root-absolute asset URLs so the static export works under
 * https://<user>.github.io/aurora-ascent/
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("dist/client");
const PREFIX = "/aurora-ascent";
const EXTENSIONS = new Set([".html", ".js", ".css", ".json", ".rsc", ".svg"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    let text = fs.readFileSync(full, "utf8");
    const next = text
      .replaceAll('"/assets/', `"${PREFIX}/assets/`)
      .replaceAll("'/assets/", `'${PREFIX}/assets/`)
      .replaceAll("(/assets/", `(${PREFIX}/assets/`)
      .replaceAll('href="/favicon', `href="${PREFIX}/favicon`)
      .replaceAll('href="/og', `href="${PREFIX}/og`)
      .replaceAll('src="/favicon', `src="${PREFIX}/favicon`)
      .replaceAll('url(/assets/', `url(${PREFIX}/assets/`)
      .replaceAll('url("/assets/', `url("${PREFIX}/assets/`)
      // vinext on Windows can embed absolute font paths during prerender
      .replace(
        /url\((?:["']?)(?:[A-Za-z]:)?[^)"']*?\.vinext\/fonts\//g,
        `url(${PREFIX}/assets/_vinext_fonts/`,
      )
      .replace(
        /url\((?:["']?)(?:[A-Za-z]:)?[^)"']*?\/assets\/_vinext_fonts\//g,
        `url(${PREFIX}/assets/_vinext_fonts/`,
      );
    if (next !== text) fs.writeFileSync(full, next);
  }
}

if (!fs.existsSync(ROOT)) {
  console.error(`Missing ${ROOT}. Run the Pages build first.`);
  process.exit(1);
}

walk(ROOT);
fs.writeFileSync(path.join(ROOT, ".nojekyll"), "");
console.log(`Rewrote static asset paths with prefix ${PREFIX}`);
