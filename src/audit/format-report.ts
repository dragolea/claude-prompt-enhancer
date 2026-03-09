// src/audit/format-report.ts
import type { AuditReport, Severity } from "./types";

const SEVERITY_LABELS: Record<Severity, string> = {
  error: "ERROR",
  warn: "WARNING",
  info: "INFO",
};

export function formatReport(report: AuditReport): string {
  const sections: string[] = [];

  // Inventory section
  const agentCategories = new Set(report.inventory.agents.map((a) => a.category));
  const invLines = ["INVENTORY"];
  invLines.push(
    `  Agents: ${report.inventory.agents.length}` +
      (agentCategories.size > 0 ? ` (across ${agentCategories.size} ${agentCategories.size === 1 ? "category" : "categories"})` : "")
  );
  invLines.push(`  Skills: ${report.inventory.skills.length}`);
  sections.push(invLines.join("\n"));

  // Findings section
  const { errors, warnings, infos } = report.summary;
  const parts = [];
  if (errors > 0) parts.push(`${errors} ${errors === 1 ? "error" : "errors"}`);
  if (warnings > 0) parts.push(`${warnings} ${warnings === 1 ? "warning" : "warnings"}`);
  if (infos > 0) parts.push(`${infos} ${infos === 1 ? "info" : "infos"}`);

  if (report.findings.length === 0) {
    sections.push("FINDINGS\n  No issues found.");
  } else {
    const findLines = [`FINDINGS (${parts.join(", ")})`];
    for (const finding of report.findings) {
      findLines.push("");
      findLines.push(`  ${SEVERITY_LABELS[finding.severity].padEnd(7)}  ${finding.rule}`);
      findLines.push(`    ${finding.message}`);
      for (const file of finding.files) {
        findLines.push(`      ${file}`);
      }
      findLines.push(`    Fix: ${finding.suggestion}`);
    }
    sections.push(findLines.join("\n"));
  }

  return sections.join("\n\n") + "\n";
}
