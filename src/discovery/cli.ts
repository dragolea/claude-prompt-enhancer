// src/discovery/cli.ts
import { discoverContext } from "./discover";

const projectRoot = process.argv[2] || process.cwd();
const context = await discoverContext(projectRoot);
console.log(JSON.stringify(context, null, 2));
