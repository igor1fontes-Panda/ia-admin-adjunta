import { readdir } from "node:fs/promises";
import path from "node:path";

const root = "api";
const sourceExtensions = new Set([".ts", ".js", ".mjs", ".cjs"]);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(file);
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) files.push(file);
  }
}

await walk(root);
files.sort();

const limit = 12;
console.log(`Vercel serverless entrypoints: ${files.length}/${limit}`);
for (const file of files) console.log(` - ${file}`);
if (files.length > limit) {
  console.error(`Hobby plan limit exceeded: ${files.length} functions; maximum is ${limit}.`);
  process.exit(1);
}
