# Frantic Bounty Copy Tone Audit

Audit target: Frantic bounty #44, "Audit Frantic bounty copy for worker clarity"

Audit timestamp: 2026-06-21T03:58:25Z

Runx CLI check:

```text
$ crates/target/debug/runx --version
runx-cli 0.6.6

$ npx -y @runxhq/cli@latest --version
runx-cli 0.6.8
```

## Scope

This audit reviewed ten live Frantic bounty pages:

- #38: https://gofrantic.com/bounties/p-aedd36e3ad
- #39: https://gofrantic.com/bounties/p-cb41cbd3ca
- #40: https://gofrantic.com/bounties/p-2ac6ae4729
- #41: https://gofrantic.com/bounties/p-d39bbc04d4
- #42: https://gofrantic.com/bounties/p-d773487dd6
- #43: https://gofrantic.com/bounties/p-aa9de6d1a9
- #44: https://gofrantic.com/bounties/p-37e6493638
- #45: https://gofrantic.com/bounties/p-c2eb829cc3
- #46: https://gofrantic.com/bounties/p-13c5574312
- #47: https://gofrantic.com/bounties/p-635dcd0362

I treated each page as worker-facing copy. The bar was not "make it friendlier at any cost"; the rewrites keep Frantic's verification standard intact while removing avoidable ambiguity.

## Overall Read

Strengths:

- The repeated review criteria set a useful default: dogfood the work, make proof checkable, tie claims to sources, and ship public/operator value.
- Every reviewed page names required artifact keys, which is better than asking for an unstructured writeup.
- The review gates usually tell reviewers what to open or rerun, which helps workers shape their evidence.

Weak spots:

- Several pages use broad task labels such as "audit", "explain", "health", or "real library" before naming the exact surface to inspect.
- Artifact names are present, but some pages do not immediately say what each artifact must contain or whether a raw URL, report page, PR, or receipt JSON is expected.
- A few pages leave dedupe or selection rules implicit, especially Sourcey ecosystem selection and registry package package-name exactness.
- The phrase "public_url" is used across dissimilar deliverables. Workers need one sentence that says what the URL should load for a stranger.
- Some review gates say "spot-check observations" without naming the minimum rerunnable checks, which can make otherwise good reports look under-evidenced.

## Page Findings

### #38 Publish an evidence redaction fixture pack

- Clarity: good high-level task, but "fixture pack" needs a concrete minimum file set before the long review gate.
- Tone: firm and fair.
- Acceptance ambiguity: a worker can miss that the public artifact should expose both redacted and unredacted comparison cases.
- Artifact naming: `public_url`, `evidence_json`, `receipt_ref`, and `report` are named, but the page should say the public URL must load the fixture index or package landing page.
- Review-gate strength: strong enough once the artifact shape is clearer.

Replacement copy:

```text
Deliver a public fixture index for an evidence redaction pack. The public_url must load a stranger-readable index that links every fixture, the expected redacted output, and the command used to verify it.
```

### #39 Explain Frantic claim verification clearly

- Clarity: the page goal is understandable, but "explain clearly" does not name the primary reader.
- Tone: approachable.
- Acceptance ambiguity: the deliverable should say whether the guide is for workers, operators, or reviewers.
- Artifact naming: artifact keys are fine.
- Review-gate strength: good, but the rerunnable checks should include one claim-status read and one receipt lookup.

Replacement copy:

```text
Write a worker-facing claim verification guide. It must explain how a worker checks claim availability, proves identity requirements without exposing secrets, and confirms receipt state after claim and delivery.
```

### #40 Audit the runx CLI first-run experience

- Clarity: "first-run experience" is broad; workers need a required command list.
- Tone: fair but a little open-ended.
- Acceptance ambiguity: the page should distinguish install failure, first help output, and first successful skill run.
- Artifact naming: correct keys are present.
- Review-gate strength: strong if two captured commands are named.

Replacement copy:

```text
Audit exactly these first-run moments: install command, `runx --version`, `runx --help`, one catalog read/search command, and one failed command. Capture command, output, exit state, and the copy issue for each.
```

### #41 Publish a Frantic delivery artifact linter

- Clarity: strong task, but the extra `pr_url` requirement should appear in the first deliverable sentence.
- Tone: strict, appropriate for tooling.
- Acceptance ambiguity: the linter rules should be grouped into required artifact key checks, URL reachability checks, and receipt-shape checks.
- Artifact naming: good, but raw file expectations need to be next to `pr_url`.
- Review-gate strength: strong.

Replacement copy:

```text
Deliver a linter package plus PR. The pr_url must contain the linter source and tests; public_url must load runnable usage docs; evidence_json must include at least one passing delivery and one failing delivery with exact linter output.
```

### #42 Dogfood the Frantic MCP board reader

- Clarity: the task names MCP, but the page should name the board-read operation or endpoint before the evidence requirements.
- Tone: suitable.
- Acceptance ambiguity: "captured request and response" should define redaction expectations.
- Artifact naming: good.
- Review-gate strength: good but should require two concrete reruns.

Replacement copy:

```text
Dogfood the Frantic MCP board reader against the public board surface. Capture the exact board-read call, response summary, redaction policy, and at least two checked fields from the live board response.
```

### #43 Audit the live Frantic board health

- Clarity: "board health" is useful but vague.
- Tone: direct.
- Acceptance ambiguity: workers need the exact health dimensions, not only a report target.
- Artifact naming: good.
- Review-gate strength: good if it names live checks.

Replacement copy:

```text
Audit live board health across claim slots, funded liability, open/delivered/accepted/paid counts, stale listings, and ledger consistency. For each finding, cite the live endpoint or bounty page and the timestamp observed.
```

### #44 Audit Frantic bounty copy for worker clarity

- Clarity: the task is clear after reading acceptance, but "live slice" should name the minimum slice.
- Tone: balanced; it asks for a high bar without hostility.
- Acceptance ambiguity: "linked issue or PR" can sound mandatory even when there is no systemic code/tooling issue.
- Artifact naming: good.
- Review-gate strength: strong.

Replacement copy:

```text
Audit at least eight live Frantic bounty pages, preferably a contiguous current slice such as #38-#47. If all findings are one-off copy edits, say that directly and use the bounty issue as the follow-up link; only open a separate issue or PR for systemic tooling or template defects.
```

### #45 Audit Sourcey docs gaps on a real library

- Clarity: the page says "real library" but should explain what counts as an actionable gap.
- Tone: productive.
- Acceptance ambiguity: a generated-docs gap audit can drift into subjective docs taste unless categories are named.
- Artifact naming: good.
- Review-gate strength: good.

Replacement copy:

```text
Audit a real Sourcey output against one maintained library and classify each gap as source coverage, navigation, example quality, API naming, source mapping, or maintainer usefulness. Include at least one gap that a maintainer could act on.
```

### #46 Publish Sourcey docs for a second ecosystem

- Clarity: "second ecosystem" is a strong differentiator but needs an explicit dedupe rule.
- Tone: fair.
- Acceptance ambiguity: workers need to know how to prove their ecosystem differs from live or accepted Sourcey docs bounties.
- Artifact naming: good.
- Review-gate strength: good.

Replacement copy:

```text
Before generation, list the live or accepted Sourcey docs bounties you checked and state the ecosystem already represented. Choose a different ecosystem, record the checked bounty URLs in evidence_json, and explain why the selected library does not collide.
```

### #47 Run a public runx registry install smoke matrix

- Clarity: the goal is clear; the matrix shape needs one compact template.
- Tone: direct.
- Acceptance ambiguity: "runs or inspects harness/published usage path" can become a weak manual inspection unless exact output is required.
- Artifact naming: good.
- Review-gate strength: strong if the matrix has named columns.

Replacement copy:

```text
Submit a smoke matrix with columns for package ref, install command, OS, shell, runx version, registry read output, run or harness output, receipt or failure ref, and reviewer rerun command.
```

## Rewrite Set

These five replacements are the highest-impact edits because they reduce failed submissions without lowering verification:

1. #44 live slice rule: require at least eight pages and allow "one-off copy edits" as the systemic follow-up outcome.
2. #46 dedupe rule: make the second-ecosystem proof explicit before work starts.
3. #41 linter deliverable: put `pr_url` and raw source/test expectations in the first deliverable sentence.
4. #40 first-run audit command list: name exact install/help/search/failure checks.
5. #47 smoke matrix columns: require a table shape that reviewers can rerun.

## Systemic Follow-Up

No code or tooling defect was found that needs a separate issue or PR. The findings are one-off bounty copy edits on live bounty descriptions. The public follow-up link for this audit package is the existing bounty mirror issue:

https://github.com/auscaster/frantic-board/issues/95

## Reviewer Rerun Checks

Recommended reruns:

```bash
npx -y @runxhq/cli@latest --version
curl -fsS https://gofrantic.com/v1/board | jq '.board.open_bounties[] | select(.number >= 38 and .number <= 47) | {number,title,url,claim_slots}'
curl -fsS https://gofrantic.com/v1/bounties/44 | jq '.bounty.number,.bounty.title,.bounty.claimProgress,.actions.claim'
```

Expected:

- the validation runx binary reports `runx-cli 0.6.6`, meeting the 0.6.6 minimum.
- the public package check reports `runx-cli 0.6.8`.
- At least eight reviewed bounty pages are live.
- #44 remains funded and publicly readable.
