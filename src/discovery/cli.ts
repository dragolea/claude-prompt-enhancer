// src/discovery/cli.ts
import { discoverContext } from "./discover";
import { readCache, writeCache } from "./cache";

const projectRoot = process.argv[2] || process.cwd();

const cached = await readCache(projectRoot);
if (cached) {
  console.log(JSON.stringify(cached));
} else {
  const context = await discoverContext(projectRoot);
  await writeCache(projectRoot, context);
  console.log(JSON.stringify(context));
}
