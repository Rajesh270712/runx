---
name: frantic-copy-audit-validator
description: Validate the Frantic bounty #44 copy-audit report and evidence bundle.
source:
  type: cli-tool
  command: node
  args:
    - run.mjs
  timeout_seconds: 30
  sandbox:
    profile: readonly
    cwd_policy: skill-directory
inputs:
  evidence_path:
    type: string
    required: true
    description: Path to evidence_json relative to this skill directory.
  report_path:
    type: string
    required: true
    description: Path to report markdown relative to this skill directory.
runx:
  category: ops
  input_resolution:
    required:
      - evidence_path
      - report_path
---

# Frantic Copy Audit Validator

This local validation skill checks that the Frantic bounty #44 artifact package
contains the expected live-page count, runx CLI version evidence, replacement
copy, follow-up link, and reviewer rerun instructions.

