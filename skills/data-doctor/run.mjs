import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = "runx.data_doctor.report.v1";
const SKILL_VERSION = "0.1.0";

try {
  const inputs = readInputs();
  const root = process.cwd();
  const dataset = readJsonInput(inputs.dataset, "dataset", root);
  const schema = readJsonInput(inputs.schema, "schema", root);
  const qualityRules = readJsonInput(inputs.quality_rules, "quality_rules", root);
  const result = analyzeDataset({ dataset, schema, qualityRules });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 64;
}

function readInputs() {
  if (process.env.RUNX_INPUTS_PATH) {
    return JSON.parse(fs.readFileSync(process.env.RUNX_INPUTS_PATH, "utf8"));
  }
  if (process.env.RUNX_INPUTS_JSON) {
    return JSON.parse(process.env.RUNX_INPUTS_JSON);
  }
  return {
    dataset: parseMaybeJson(process.env.RUNX_INPUT_DATASET),
    schema: parseMaybeJson(process.env.RUNX_INPUT_SCHEMA),
    quality_rules: parseMaybeJson(process.env.RUNX_INPUT_QUALITY_RULES),
  };
}

function parseMaybeJson(raw) {
  if (raw === undefined || raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function readJsonInput(value, label, root) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${label} is required`);
  }
  if (typeof value === "string") {
    const resolved = path.resolve(root, value);
    ensureInside(root, resolved, label);
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  throw new Error(`${label} must be a JSON object or package-relative JSON path`);
}

function ensureInside(root, resolved, label) {
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(normalizedRoot)) {
    throw new Error(`${label} path must stay inside the skill directory`);
  }
}

function analyzeDataset({ dataset, schema, qualityRules }) {
  const rows = validateDataset(dataset);
  const fields = validateSchema(schema);
  const rules = validateRules(qualityRules);
  const schemaFields = fields.map((field) => field.name);
  const findings = [];
  const columnMetrics = {};

  for (const field of fields) {
    columnMetrics[field.name] = computeColumnMetrics(rows, field);
    collectFieldFindings({ findings, field, metrics: columnMetrics[field.name], rows, rules });
  }

  const uniqueKeys = uniqueRuleFields(fields, rules);
  const duplicateKeyCount = collectUniquenessFindings({ findings, rows, uniqueKeys });
  const anomalyCount = collectAnomalyFindings({ findings, rows, fields, rules });
  const totalMissingCells = sum(Object.values(columnMetrics).map((metric) => metric.missing_count));
  const typeDriftCells = sum(Object.values(columnMetrics).map((metric) => metric.type_drift_count));
  const qualityScore = scoreQuality({
    rowCount: rows.length,
    columnCount: fields.length,
    findingCount: findings.length,
    totalMissingCells,
    typeDriftCells,
    duplicateKeyCount,
    anomalyCount,
  });
  const metrics = {
    row_count: rows.length,
    column_count: fields.length,
    total_missing_cells: totalMissingCells,
    type_drift_cells: typeDriftCells,
    duplicate_key_count: duplicateKeyCount,
    anomaly_count: anomalyCount,
    quality_score: qualityScore,
    columns: columnMetrics,
  };
  const recommendations = buildRecommendations(findings);
  const report = renderReport({ dataset, schemaFields, metrics, findings, recommendations });
  const canonicalInput = JSON.stringify({ dataset, schema, qualityRules });

  return {
    schema: SCHEMA,
    data_doctor_version: SKILL_VERSION,
    dataset: {
      name: stringOrDefault(dataset.name, "unnamed_dataset"),
      source: stringOrDefault(dataset.source, "inline_dataset"),
      row_count: rows.length,
      schema_fields: schemaFields,
      input_sha256: sha256(canonicalInput),
    },
    metrics,
    findings,
    recommendations,
    report,
    read_only: {
      dataset_mutated: false,
      mutation_policy: "No dataset rows are edited, normalized, written back, exported, or repaired.",
    },
  };
}

function validateDataset(dataset) {
  if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
    throw new Error("dataset must be a JSON object");
  }
  if (!Array.isArray(dataset.rows)) {
    throw new Error("dataset.rows must be an array");
  }
  for (const [index, row] of dataset.rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`dataset.rows[${index}] must be an object`);
    }
  }
  return dataset.rows;
}

function validateSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error("schema must be a JSON object");
  }
  if (!Array.isArray(schema.fields) || schema.fields.length === 0) {
    throw new Error("schema.fields must be a non-empty array");
  }
  const seen = new Set();
  return schema.fields.map((rawField, index) => {
    if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) {
      throw new Error(`schema.fields[${index}] must be an object`);
    }
    const name = stringOrDefault(rawField.name, "");
    const type = stringOrDefault(rawField.type, "");
    if (!name) throw new Error(`schema.fields[${index}].name is required`);
    if (seen.has(name)) throw new Error(`schema field ${name} is duplicated`);
    seen.add(name);
    if (!["string", "number", "integer", "boolean", "date"].includes(type)) {
      throw new Error(`schema field ${name} has unsupported type ${type}`);
    }
    return {
      name,
      type,
      required: rawField.required === true,
      unique: rawField.unique === true,
    };
  });
}

function validateRules(rules) {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    throw new Error("quality_rules must be a JSON object");
  }
  return {
    max_missing_ratio: numberOrDefault(rules.max_missing_ratio, 0),
    unique_keys: Array.isArray(rules.unique_keys) ? rules.unique_keys.filter((value) => typeof value === "string") : [],
    allowed_values: objectOrEmpty(rules.allowed_values),
    numeric_ranges: objectOrEmpty(rules.numeric_ranges),
    anomaly_zscore_threshold: numberOrDefault(rules.anomaly_zscore_threshold, null),
  };
}

function computeColumnMetrics(rows, field) {
  const observedTypes = {};
  const uniqueValues = new Set();
  let missingCount = 0;
  let typeDriftCount = 0;

  for (const row of rows) {
    const value = row[field.name];
    if (isMissing(value)) {
      missingCount += 1;
      continue;
    }
    uniqueValues.add(String(value));
    const observedType = observedTypeFor(value);
    observedTypes[observedType] = (observedTypes[observedType] || 0) + 1;
    if (!matchesDeclaredType(value, field.type)) {
      typeDriftCount += 1;
    }
  }

  return {
    declared_type: field.type,
    required: field.required,
    missing_count: missingCount,
    missing_ratio: ratio(missingCount, rows.length),
    unique_count: uniqueValues.size,
    duplicate_value_count: Math.max(0, rows.length - missingCount - uniqueValues.size),
    observed_types: observedTypes,
    type_drift_count: typeDriftCount,
  };
}

function collectFieldFindings({ findings, field, metrics, rows, rules }) {
  if (field.required && metrics.missing_count > 0) {
    findings.push({
      severity: "high",
      code: "missing_required_values",
      column: field.name,
      message: `${metrics.missing_count} of ${rows.length} rows are missing required ${field.name}.`,
      evidence: {
        missing_count: metrics.missing_count,
        missing_ratio: metrics.missing_ratio,
      },
    });
  }

  if (metrics.missing_ratio > rules.max_missing_ratio) {
    findings.push({
      severity: field.required ? "high" : "medium",
      code: "missingness_threshold_exceeded",
      column: field.name,
      message: `${field.name} missing ratio ${metrics.missing_ratio} exceeds rule ${rules.max_missing_ratio}.`,
      evidence: {
        missing_ratio: metrics.missing_ratio,
        max_missing_ratio: rules.max_missing_ratio,
      },
    });
  }

  if (metrics.type_drift_count > 0) {
    findings.push({
      severity: "high",
      code: "type_drift",
      column: field.name,
      message: `${metrics.type_drift_count} values do not match declared ${field.type} type.`,
      evidence: {
        declared_type: field.type,
        observed_types: metrics.observed_types,
        type_drift_count: metrics.type_drift_count,
      },
    });
  }
}

function uniqueRuleFields(fields, rules) {
  const result = new Set(rules.unique_keys);
  for (const field of fields) {
    if (field.unique) result.add(field.name);
  }
  return [...result].sort();
}

function collectUniquenessFindings({ findings, rows, uniqueKeys }) {
  let duplicateKeyCount = 0;
  for (const fieldName of uniqueKeys) {
    const seen = new Map();
    for (const [index, row] of rows.entries()) {
      const value = row[fieldName];
      if (isMissing(value)) continue;
      const key = String(value);
      const indices = seen.get(key) || [];
      indices.push(index);
      seen.set(key, indices);
    }
    const duplicates = [...seen.entries()]
      .filter(([, indices]) => indices.length > 1)
      .map(([value, indices]) => ({ value, row_indices: indices }));
    duplicateKeyCount += duplicates.reduce((count, duplicate) => count + duplicate.row_indices.length - 1, 0);
    if (duplicates.length > 0) {
      findings.push({
        severity: "high",
        code: "duplicate_unique_key",
        column: fieldName,
        message: `${fieldName} has ${duplicates.length} duplicated key value(s).`,
        evidence: { duplicates },
      });
    }
  }
  return duplicateKeyCount;
}

function collectAnomalyFindings({ findings, rows, fields, rules }) {
  let anomalyCount = 0;
  for (const field of fields) {
    const allowed = Array.isArray(rules.allowed_values[field.name]) ? rules.allowed_values[field.name] : null;
    if (allowed) {
      const unexpected = [];
      for (const [index, row] of rows.entries()) {
        const value = row[field.name];
        if (!isMissing(value) && !allowed.includes(value)) {
          unexpected.push({ value, row_index: index });
        }
      }
      if (unexpected.length > 0) {
        anomalyCount += unexpected.length;
        findings.push({
          severity: "medium",
          code: "unexpected_category",
          column: field.name,
          message: `${field.name} contains ${unexpected.length} value(s) outside the allowed set.`,
          evidence: { allowed_values: allowed, unexpected },
        });
      }
    }

    if (["number", "integer"].includes(field.type)) {
      anomalyCount += collectNumericRangeFindings({ findings, rows, field, rules });
      anomalyCount += collectZScoreFindings({ findings, rows, field, threshold: rules.anomaly_zscore_threshold });
    }
  }
  return anomalyCount;
}

function collectNumericRangeFindings({ findings, rows, field, rules }) {
  const range = rules.numeric_ranges[field.name];
  if (!range || typeof range !== "object") return 0;
  const min = typeof range.min === "number" ? range.min : null;
  const max = typeof range.max === "number" ? range.max : null;
  const outOfRange = [];
  for (const [index, row] of rows.entries()) {
    const value = row[field.name];
    if (isMissing(value) || typeof value !== "number") continue;
    if ((min !== null && value < min) || (max !== null && value > max)) {
      outOfRange.push({ value, row_index: index });
    }
  }
  if (outOfRange.length > 0) {
    findings.push({
      severity: "medium",
      code: "numeric_range_anomaly",
      column: field.name,
      message: `${field.name} has ${outOfRange.length} value(s) outside the declared numeric range.`,
      evidence: { min, max, out_of_range: outOfRange },
    });
  }
  return outOfRange.length;
}

function collectZScoreFindings({ findings, rows, field, threshold }) {
  if (threshold === null || threshold <= 0) return 0;
  const values = rows
    .map((row, rowIndex) => ({ rowIndex, value: row[field.name] }))
    .filter((entry) => typeof entry.value === "number" && Number.isFinite(entry.value));
  if (values.length < 3) return 0;
  const mean = sum(values.map((entry) => entry.value)) / values.length;
  const variance = sum(values.map((entry) => (entry.value - mean) ** 2)) / values.length;
  const standardDeviation = Math.sqrt(variance);
  if (standardDeviation === 0) return 0;
  const outliers = values
    .map((entry) => ({
      value: entry.value,
      row_index: entry.rowIndex,
      z_score: round(Math.abs((entry.value - mean) / standardDeviation)),
    }))
    .filter((entry) => entry.z_score >= threshold);
  if (outliers.length > 0) {
    findings.push({
      severity: "medium",
      code: "zscore_anomaly",
      column: field.name,
      message: `${field.name} has ${outliers.length} z-score outlier(s) at threshold ${threshold}.`,
      evidence: {
        threshold,
        mean: round(mean),
        standard_deviation: round(standardDeviation),
        outliers,
      },
    });
  }
  return outliers.length;
}

function matchesDeclaredType(value, type) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value));
    default:
      return false;
  }
}

function observedTypeFor(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (typeof value === "number" && !Number.isFinite(value)) return "non_finite_number";
  return typeof value;
}

function scoreQuality({ rowCount, columnCount, findingCount, totalMissingCells, typeDriftCells, duplicateKeyCount, anomalyCount }) {
  const cellCount = Math.max(1, rowCount * columnCount);
  const penalty = (totalMissingCells * 5)
    + (typeDriftCells * 8)
    + (duplicateKeyCount * 10)
    + (anomalyCount * 4)
    + (findingCount * 3);
  return Math.max(0, Math.min(100, Math.round(100 - (penalty / cellCount) * 10)));
}

function buildRecommendations(findings) {
  if (findings.length === 0) {
    return ["No quality findings were produced for the supplied rows and schema."];
  }
  const recommendations = [];
  if (findings.some((finding) => finding.code === "missing_required_values")) {
    recommendations.push("Backfill or reject rows with missing required values before using this dataset downstream.");
  }
  if (findings.some((finding) => finding.code === "duplicate_unique_key")) {
    recommendations.push("Resolve duplicate unique keys before treating row-level metrics as entity-level truth.");
  }
  if (findings.some((finding) => finding.code === "type_drift")) {
    recommendations.push("Fix type drift at the fixture source or declare an explicit coercion step outside this read-only skill.");
  }
  if (findings.some((finding) => finding.code.endsWith("_anomaly") || finding.code === "unexpected_category")) {
    recommendations.push("Review anomalous values against source-system expectations before importing or publishing the dataset.");
  }
  return [...new Set(recommendations)];
}

function renderReport({ dataset, schemaFields, metrics, findings, recommendations }) {
  const lines = [];
  lines.push("# Data Doctor Report");
  lines.push("");
  lines.push(`Dataset: ${stringOrDefault(dataset.name, "unnamed_dataset")}`);
  lines.push(`Source: ${stringOrDefault(dataset.source, "inline_dataset")}`);
  lines.push(`Rows inspected: ${metrics.row_count}`);
  lines.push(`Schema fields: ${schemaFields.join(", ")}`);
  lines.push("");
  lines.push("## Metrics");
  lines.push("");
  lines.push(`- Quality score: ${metrics.quality_score}`);
  lines.push(`- Missing cells: ${metrics.total_missing_cells}`);
  lines.push(`- Type drift cells: ${metrics.type_drift_cells}`);
  lines.push(`- Duplicate unique-key rows: ${metrics.duplicate_key_count}`);
  lines.push(`- Anomaly count: ${metrics.anomaly_count}`);
  lines.push("- Dataset mutation performed: false");
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  if (findings.length === 0) {
    lines.push("- No findings for the supplied rows and schema.");
  } else {
    for (const finding of findings) {
      lines.push(`- [${finding.severity}] ${finding.code} (${finding.column}): ${finding.message}`);
    }
  }
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");
  for (const recommendation of recommendations) {
    lines.push(`- ${recommendation}`);
  }
  lines.push("");
  lines.push("## Read-Only Boundary");
  lines.push("");
  lines.push("- The supplied dataset was inspected only in memory.");
  lines.push("- No rows, files, databases, or external systems were modified.");
  return `${lines.join("\n")}\n`;
}

function isMissing(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function ratio(numerator, denominator) {
  if (denominator === 0) return 0;
  return round(numerator / denominator);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function numberOrDefault(value, defaultValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : defaultValue;
}

function stringOrDefault(value, defaultValue) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : defaultValue;
}
