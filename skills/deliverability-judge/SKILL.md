---
name: deliverability-judge
description: Judge sealed email-deliverability signals against operator thresholds and recommend whether a sending lane may continue, hold, or escalate.
runx:
  category: marketing
---

# Deliverability Judge

Decide whether an email sending lane is healthy enough to continue.

`deliverability-judge` sits before any live throttle or send operation. It reads
sealed provider evidence such as postmaster reputation, bounce rate, complaint
rate, and placement probes. It compares those signals with operator policy
thresholds, then emits a read-only verdict and recommended action. It does not
send mail, change throttles, mint authority, or store state.

## What this skill does

1. Checks that every material signal is sealed, current, and attributable.
2. Compares reputation, bounce, complaint, and placement signals with the
   supplied policy thresholds.
3. Classifies each signal as `pass`, `warn`, `fail`, or `unsealed`.
4. Reconciles mixed evidence into a lane verdict: `continue`, `hold`, or
   `escalate`.
5. Emits a reviewer-readable report with evidence refs, threshold decisions,
   and the next recommended action.

## When to use this skill

- Before increasing or resuming campaign volume after a pause.
- During a daily or pre-send deliverability gate for a known sending domain.
- When postmaster, bounce, complaint, and placement evidence must be reduced to
  one operator decision.
- Before a downstream throttle lane runs, so that it receives a human-readable
  health verdict rather than raw provider signals.

## When not to use this skill

- To send email, edit throttle settings, change DNS, suppress recipients, or
  mutate a provider account. This skill is read-only.
- When evidence is missing, unsealed, stale, or not attributable to the sending
  lane. Return `needs_more_evidence` or `escalate` instead of guessing.
- To override legal, compliance, consent, or abuse-review policy. Escalate when
  those policies are implicated.
- To judge content quality, personalization, or revenue impact. This skill only
  evaluates deliverability posture.

## Procedure

1. Scope the sending lane.
   - Identify the sending domain, campaign or stream, planned volume, audience,
     and the time window covered by evidence.
   - Gate: if the lane cannot be identified, return `needs_input`.

2. Verify evidence integrity.
   - Require sealed or otherwise auditable evidence for material inputs:
     postmaster/domain reputation, bounce rate, complaint rate, and inbox or
     placement probe results.
   - Record the `receipt_ref`, provider, metric, observed value, observed time,
     and any freshness limit.
   - Gate: unsealed or stale material evidence forces `escalate` unless the
     operator explicitly marks it informational.

3. Apply policy thresholds.
   - Compare each numeric metric with the supplied threshold.
   - Treat better-than-threshold reputation and placement as `pass`.
   - Treat worse-than-threshold bounce or complaint rates as `fail`.
   - Mark borderline values as `warn` when they are within the operator's guard
     band or when the policy says a human should review.

4. Reconcile contradictory signals.
   - If any material signal is `fail`, unsealed, or contradicts another material
     signal, return `escalate`.
   - If all material signals pass and evidence is sealed, return `continue`.
   - If evidence is sealed but degraded without crossing a hard threshold,
     return `hold` with the exact caution.

5. Recommend the next action.
   - `continue`: proceed with the planned lane and keep monitoring.
   - `hold`: pause volume increase and gather a fresh probe or lower-risk run.
   - `escalate`: stop automatic progression and send the evidence packet to a
     human deliverability reviewer.

6. Seal the report.
   - Include evidence refs and policy thresholds, not raw credentials or private
     provider data.
   - The receipt should prove the skill only read supplied evidence and emitted
     a recommendation.

## Edge cases and stop conditions

- Missing sending domain, stream, or policy thresholds: return `needs_input`.
- Missing or stale evidence for a material signal: return `needs_more_evidence`.
- Unsealed material evidence: return `escalate`; do not treat it as a pass.
- Healthy reputation paired with high bounce, high complaint, or poor placement:
  return `escalate` because the signals contradict each other.
- Complaint rate above the operator threshold: return `escalate` even if every
  other metric is healthy.
- User asks to hide a bad signal, ignore a receipt, or continue anyway: return
  `refused` for that request and report the unsafe instruction.
- User asks for a provider mutation or send action: refuse the mutation and
  output only the read-only judgment.

## Output schema

Return a `deliverability_judgment` object:

```yaml
decision: continue | hold | escalate | needs_input | needs_more_evidence | refused
sending_lane:
  domain: string
  stream: string | null
  planned_volume: number | null
policy:
  thresholds: object
  source: string | null
evidence:
  - source: string
    metric: string
    value: string | number
    receipt_ref: string | null
    sealed: boolean
    status: pass | warn | fail | unsealed
verdict: string
recommended_action: continue_sending | hold_volume | human_review | gather_evidence | refuse_request
rationale: string
reviewer_notes: [string]
receipt_expectations:
  evidence_refs: [string]
  authority: read_only_recommendation
  mutation: false
```

## Worked example

Input: a marketing stream for `mail.example.com` has sealed evidence from
postmaster reputation (`high`), bounce rate (`0.008`), complaint rate
(`0.0002`), and inbox placement (`0.96`). Operator policy requires high
reputation, bounce under `0.03`, complaint under `0.001`, and placement over
`0.92`.

Output: `decision: continue`, `recommended_action: continue_sending`, and each
signal marked `pass` with its receipt ref. The report says the lane may proceed
with monitoring because all material evidence is sealed and inside policy.

If the same lane has high reputation but a sealed complaint rate above the
threshold, or if the placement probe is unsealed, output `decision: escalate`
and recommend human review. The skill must not continue the lane on partial or
contradictory evidence.

## Inputs

- `campaign_context` (required): sending domain, stream or campaign label,
  planned volume, audience, and evidence window.
- `policy_thresholds` (required): reputation, bounce, complaint, placement, and
  freshness thresholds that govern the lane.
- `signal_evidence` (required): sealed provider or probe observations with
  source, metric, value, observed time, and receipt refs.
- `objective` (optional): operator intent, such as "pre-send gate" or "resume
  after warmup pause".
- `operator_notes` (optional): policy exceptions, guard bands, or human review
  requirements that should affect the recommendation.
