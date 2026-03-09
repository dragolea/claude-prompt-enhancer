// src/audit/cli.ts
import { discoverForAudit } from "./discover-for-audit";
import { analyze } from "./analyze";
import { formatReport } from "./format-report";

const args = process.argv.slice(2);
const humanFlag = args.includes("--human");
const projectRoot = args.find((a) => !a.startsWith("--")) ?? process.cwd();

const inventory = await discoverForAudit(projectRoot);
const report = analyze(inventory);

if (humanFlag) {
  process.stdout.write(formatReport(report));
} else {
  console.log(JSON.stringify(report, null, 2));
}

process.exit(report.summary.errors > 0 ? 1 : 0);
