---
name: data-doctor
description: Inspect bounded dataset fixtures against a declared schema and quality rules, then emit a read-only quality report.
source:
  type: cli-tool
  command: node
  args:
    - run.mjs
runx:
  category: data
  tags:
    - data-quality
    - fixtures
    - validation
---

# Data Doctor

## What this skill does

Data Doctor tells an operator whether a bounded dataset fixture is healthy
enough to trust for a downstream workflow. It reads the supplied dataset,
schema, and quality rules, computes missingness, uniqueness, type drift, and
anomaly checks, then emits metrics, findings, recommendations, and a Markdown
report.

The skill is read-only. It never edits, normalizes, writes back, exports, or
repairs the dataset. The report is evidence for review and handoff, not an
authorization to mutate production data.

## When to use this skill

Use Data Doctor when an agent or operator needs a reproducible data-quality
packet for a public fixture, migration sample, benchmark data slice, or
pre-ingestion review. It is useful before demos, imports, model-evaluation
fixtures, analytics handoffs, or bounty review packets where the reviewer needs
row counts and quality findings tied to the actual supplied rows.

## When not to use this skill

Do not use this skill to inspect private customer data, secrets, unrestricted
exports, live production databases, or unbounded files. Do not use it to clean
data, rewrite schemas, infer hidden columns, fabricate anomaly causes, or claim
that a dataset is complete when the supplied rows or schema are incomplete.

If the dataset is not already bounded and cleared for local fixture use, stop
and obtain a governed read or fixture-capture receipt first.

## Procedure

1. Read `dataset`, `schema`, and `quality_rules` from typed inputs.
2. If an input is a string, resolve it as a package-relative fixture path.
3. Reject paths that escape the skill directory.
4. Confirm `dataset.rows` is an array and `schema.fields` declares every field
   to inspect.
5. For each declared field, compute missing counts, uniqueness, observed types,
   and type drift against the declared type.
6. Apply declared unique key, allowed value, numeric range, and z-score anomaly
   rules.
7. Emit a deterministic quality packet with only supplied columns, row counts,
   findings, recommendations, and a Markdown report.

## Edge cases and stop conditions

Return a failed/refused run when `dataset`, `schema`, or `quality_rules` is
missing, when fixture paths escape the package root, when JSON cannot be parsed,
when `dataset.rows` is not an array, or when `schema.fields` is empty.

Return findings, not failures, for ordinary data-quality problems such as
missing required values, duplicate keys, type drift, out-of-range numbers, or
unexpected categorical values. The skill reports what the rows show and does
not invent columns, root causes, or remediation steps beyond the observed
quality rules.

## Output schema

The runner writes one JSON object to stdout:

```json
{
  "schema": "runx.data_doctor.report.v1",
  "dataset": {
    "name": "string",
    "source": "string",
    "row_count": 0,
    "schema_fields": ["field"]
  },
  "metrics": {
    "row_count": 0,
    "column_count": 0,
    "total_missing_cells": 0,
    "type_drift_cells": 0,
    "duplicate_key_count": 0,
    "anomaly_count": 0,
    "quality_score": 0
  },
  "findings": [
    {
      "severity": "low|medium|high",
      "code": "missing_required_values",
      "column": "email",
      "message": "string",
      "evidence": {}
    }
  ],
  "recommendations": ["string"],
  "report": "# Data Doctor Report\n..."
}
```

## Worked example

```bash
runx skill "$PWD" \
  --input dataset=fixtures/customer-health-dataset.json \
  --input schema=fixtures/customer-health-schema.json \
  --input quality_rules=fixtures/customer-health-rules.json \
  --json
```

Expected evidence:

- `metrics.row_count` is computed from `dataset.rows.length`.
- Findings only reference fields declared in `schema.fields`.
- Missingness, uniqueness, type drift, range, and allowed-value checks come
  from the supplied rows and rules.
- `report` is a read-only Markdown summary that states no dataset mutation was
  performed.

## Inputs

- `dataset`: JSON dataset object or package-relative JSON fixture path. The
  object must include `rows: []`.
- `schema`: JSON schema summary object or package-relative JSON fixture path.
  The object must include `fields: [{ name, type }]`.
- `quality_rules`: JSON quality-rule object or package-relative JSON fixture
  path. Supports `unique_keys`, `max_missing_ratio`,
  `allowed_values`, `numeric_ranges`, and `anomaly_zscore_threshold`.

## Outputs

- `metrics`: aggregate row, missingness, uniqueness, type drift, anomaly, and
  quality-score metrics.
- `findings`: ordered quality findings with severity, code, column, message,
  and evidence.
- `recommendations`: concrete review recommendations based on findings.
- `report`: human-readable Markdown report for the exact input rows.
