import { readFileSync } from "node:fs";
import path from "node:path";

const evidencePath = process.env.RUNX_INPUT_EVIDENCE_PATH ?? "";
const reportPath = process.env.RUNX_INPUT_REPORT_PATH ?? "";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(64);
}

function readRelative(filePath) {
  if (!filePath || path.isAbsolute(filePath) || filePath.includes("..")) {
    fail(`invalid relative path: ${filePath}`);
  }
  return readFileSync(path.join(process.cwd(), filePath), "utf8");
}

const evidence = JSON.parse(readRelative(evidencePath));
const report = readRelative(reportPath);

if (evidence.schema !== "frantic.copy_audit.v1") {
  fail("unexpected evidence schema");
}
if (evidence.bounty_number !== 44) {
  fail("evidence is not for bounty #44");
}
const versionPattern = /^runx-cli\s+0\.(?:6\.(?:[6-9]|\d{2,})|[7-9]\.|[1-9]\d+\.)/;
if (!versionPattern.test(evidence.validation_runx_cli?.output ?? "")) {
  fail("validation runx CLI output does not meet the 0.6.6 minimum");
}
if (!versionPattern.test(evidence.runx_cli?.output ?? "")) {
  fail("public runx CLI output does not meet the 0.6.6 minimum");
}
if (!Array.isArray(evidence.observations) || evidence.observations.length < 8) {
  fail("expected at least eight observations");
}

let replacementCount = 0;
for (const observation of evidence.observations) {
  if (!/^https:\/\/gofrantic\.com\/bounties\/p-/.test(observation.bounty_url ?? "")) {
    fail(`observation ${observation.bounty_number} is missing a live bounty URL`);
  }
  if (!Array.isArray(observation.issue_categories) || observation.issue_categories.length === 0) {
    fail(`observation ${observation.bounty_number} is missing issue categories`);
  }
  if (!Array.isArray(observation.snippets) || observation.snippets.length === 0) {
    fail(`observation ${observation.bounty_number} is missing snippets`);
  }
  if (!Array.isArray(observation.replacement_snippets) || observation.replacement_snippets.length === 0) {
    fail(`observation ${observation.bounty_number} is missing replacement snippets`);
  }
  if (!observation.follow_up_link) {
    fail(`observation ${observation.bounty_number} is missing a follow-up link`);
  }
  if (!observation.review_rationale) {
    fail(`observation ${observation.bounty_number} is missing review rationale`);
  }
  replacementCount += observation.replacement_snippets.length;
}

if (replacementCount < 5) {
  fail("expected at least five replacement snippets");
}
if (!report.includes("https://github.com/auscaster/frantic-board/issues/95")) {
  fail("report does not include the follow-up issue link");
}
if (!report.includes("No code or tooling defect was found")) {
  fail("report does not state one-off/systemic follow-up outcome");
}
if (!report.includes("npx -y @runxhq/cli@latest --version")) {
  fail("report does not include the runx CLI rerun command");
}

process.stdout.write(JSON.stringify({
  status: "valid",
  bounty_number: evidence.bounty_number,
  observation_count: evidence.observations.length,
  replacement_count: replacementCount,
  validation_runx_cli_output: evidence.validation_runx_cli.output,
  runx_cli_output: evidence.runx_cli.output,
  follow_up_link: evidence.systemic_follow_up.follow_up_link
}, null, 2));
