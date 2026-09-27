# yearsalso-claude-harness

[中文](README.md) | **English**

A personal Claude Code framework harness project. Its core is the **dev-harness** plugin under `plugin/` — generalized and merged from the `.claude/` assets of two real projects: `daqsvrv5` (Go edge gateway) and `tdmversionmanager` (TS/React full-stack). It is no longer bound to a single language or a single project.

## Design Principles

1. **The leader agent is the sole routing authority**: every development request first goes through the leader's two-level adjudication —
   - Level 1 (workflow or not): A direct reply / B single agent / C workflow pipeline, with quantitative criteria (files touched, role handoffs, error cost); ambiguous cases are escalated to the user;
   - Level 2 (which workflow): a routing decision table over 8 workflows.
2. **Language separation**: implementation agents / skills / rules are split per stack into `go-*` and `web-*` — no single engineer agent mixing languages; shared roles (leader/pm/architect/reviewer/tester/auto-committer) are language-agnostic.
3. **project-profile converges differences**: tech stack, gate command, doc directories, and optional process flags (`alignment_check`, `sdd_required`) all live in the target repo's `.claude/project-profile.md`; workflows read the profile at runtime and switch engineer agent, review dimensions, and verification commands by `stack` — this is the mechanism that let the two source projects merge into one plugin.
4. **Adversarial workflow kernel preserved** (from daqsvrv5's redesigned version):
   - Produce → **independent critic refutation** → revision loop (MAX_REVISION=2, escalate when exhausted)
   - **Fail-closed independent test gate**: a verifier agent actually runs the gate command and reports the real exit code; no agent's subjective claims are trusted, and an unparseable exit code also aborts
   - **Memory loop**: read `docs/memory/` at the start; only high-value entries (ADRs / root-cause patterns / pitfalls) are persisted at the end
5. **Generalized hooks** (merged from both projects' settings.json): routing hint injection, dangerous-command interception, extension-dispatched formatting (gofmt/biome/prettier), pre-commit stack-convention review (agent hook), session environment check.

## Directory Layout

```
.claude-plugin/          marketplace manifest (yearsalso)
plugin/
├── .claude-plugin/plugin.json
├── agents/              # shared roles + language-separated engineers
│   ├── leader.md        # ★ two-level adjudication (workflow-or-not + routing table)
│   ├── pm.md / architect.md / reviewer.md / tester.md / auto-committer.md   # language-agnostic
│   ├── go-backend-engineer.md   # Go stack (rules/go + go-testing/go-code-review)
│   └── web-frontend-engineer.md # TS/React stack (rules/web + react/vitest/ts-check)
├── skills/
│   ├── critic/ memory-manager/ project-profile/ doc-writer/ auto-commit/     # shared
│   ├── go-testing/ go-code-review/ gopl-programming-language/(index stub)    # Go stack
│   └── react-coding/ tailwind-coding/ frontend-code-review/ ts-check/ vitest-testing/  # Web stack
├── rules/
│   ├── universal/       # ask-dont-assume / sdd-risk-and-alignment / memory-discipline / no-god-files
│   ├── go/              # go-code / naming-zero-style
│   └── web/             # feature-scoped-handlers / app-scope-guard
├── workflows/           # ★ profile-driven adversarial pipelines (see table below)
├── hooks/               # hooks.json + scripts/ (shell, addressed via ${CLAUDE_PLUGIN_ROOT})
├── commands/            # harness-init / route / add-book-ref / sync-rules
└── templates/           # project-profile / memory-file / claude-md-snippet
verify/
├── check.sh             # unified local/CI self-check entry (four steps)
├── dry-run.mjs          # dry-run regression: stubbed runtime + real/fixture profiles driving workflow sources
└── fixtures/            # profile fixtures (auto fallback when source repos are unreachable, e.g. CI)
.github/workflows/ci.yml # see "Self-Verification: Checks & CI"
```

## Workflow Overview

All workflows are invoked uniformly via `Workflow({ name: '<dev-harness:name>', args })`. Day-to-day they are not launched by hand but selected by the leader's level-2 routing table (explicit invocation to bypass adjudication is also possible). Every workflow that writes artifacts first reads `.claude/project-profile.md` at runtime, switching engineer agent / review dimensions / gate command by stack.

| workflow | Phase chain (from actual meta) | args | fail-closed points | origin |
|----------|---------|------|-------------|------|
| `feature-dev` | Spec → SpecCritique → Design → DesignCritique → Implement → Review → Test → Commit → Retrospect | `{requirement}` | abort when Spec/Design refutation exceeds the loop limit; implementation-artifact existence assertion; abort on unresolved P0; gate aborts on non-zero or unparseable exit code | daqsvrv5 adversarial version, profile-ized |
| `bug-fix` | Analyze → RootCauseCritique → Fix → Review → Verify → Commit → Retrospect | `{bug}` (symptom + repro steps) | root-cause refutation loop limit; fix-artifact existence assertion; unresolved P0; independent gate as above | daqsvrv5 adversarial version, profile-ized |
| `code-review` | ParallelReview → Dedup → AdversarialFilter → Report → Persist | diff scope / focus description | no commit action; critic refutes findings one by one, then severity grading with P0 called out separately | daqsvrv5 enhanced version, dimensions per stack |
| `design-doc` | Clarify → Design → DesignCritique → Retrospect | requirement / problem description | delivers with a warning when the loop limit is hit (pure document, no implementation risk); logs distinguish the two states | daqsvrv5 |
| `design-eval` | Analyze → Evaluate → Report | path/description of the design under evaluation | none (evaluation report type) | tdmversionmanager |
| `refactor-mechanical` | Plan → Execute → Verify | refactor target (mechanical only: renames / moves / dependency upgrades) | Verify phase completeness check + real gate run citing actual output | tdmversionmanager, gate added |
| `doc-tidy` | Scan → Tidy → Update | optional (periodic scan) | none (archive only, never delete; superseded-by pruning) | merged from both projects |
| `deep-research` | Scope → Search → Fetch → Verify → Synthesize | `<question string>` (must be specific) | every claim gets a 3-vote adversarial verification; 2/3 refutations to kill | daqsvrv5 (language-agnostic, ported as-is) |

Quick selection guide (simplified view of the leader's level-2 table): new feature → `feature-dev`; defect fix → `bug-fix`; review-only, no changes → `code-review`; produce a design doc → `design-doc`; evaluate an existing design → `design-eval`; mechanical refactor → `refactor-mechanical`; aging docs/memory → `doc-tidy`; external tech research → `deep-research`.

> **Fail-closed kernel notes** (v0.1.1, honed by real-project runs): the gate is not a single checkpoint — refutation loop exhaustion, empty implementation/fix artifacts (`codeChangedFiles: 0` or unparseable), and an independent verifier's non-zero/unparseable gate exit code all abort before commit and escalate. Prefer stopping over letting things through.

## Merge Trade-offs

- **Single agent split**: each source project had one language-mixing engineer agent → split into `go-backend-engineer` / `web-frontend-engineer`; `backend/frontend` naming renamed with `go-/web-` prefixes to make language ownership explicit.
- **technical-research (tdm) superseded by deep-research (daqsvr)**: the former is a weaker multi-source fan-out + refutation version; local stack-selection research is covered by `design-doc` + the architect agent (leader adjudication B can answer small research directly with a single agent).
- **daqsvrv5 specifics** (v4 alignment, sqlc/EventBus paths, migration numbering) → generalized into the `alignment_check` flag + the profile's "stack context / code landing / project red lines" sections.
- **tdm specifics** (prototype-readonly, web-app-scope, Bun/Elysia details) → generalized into `rules/web/app-scope-guard.md` (scope declarations moved to the profile).
- **The full gopl book knowledge cards are not shipped in the plugin** (size/licensing): the plugin carries an index stub; `/add-book-ref` installs the full version from a local project.
- **Low-frequency assets not merged** (openspec / api-mock / i18n / pr-watcher / test-gen / migrator, etc.) remain in the source projects as future extension points.

## Self-Verification: Checks & CI

This repo holds itself to the same discipline the plugin preaches (verifiable, fail-closed, claims-not-trusted):

```bash
# Run all four steps locally (same entry point as CI)
bash verify/check.sh

# Dry-run regression only (real profiles locally; auto-falls back to verify/fixtures/ on CI)
node verify/dry-run.mjs
```

The four steps of `verify/check.sh`:

1. **Manifest validation**: marketplace.json / plugin.json / hooks.json are legal JSON with required fields (name, plugins[].source, semver version) present;
2. **Hooks**: every script passes `bash -n` and has the executable bit; every script referenced by hooks.json actually exists;
3. **Workflows**: each JS is syntax-checked the same way the runtime does it (wrapped in an async function body);
4. **Dry-run regression**: `dry-run.mjs` stubs the agent/phase/log runtime and drives the actual workflow sources with real (or fixture) profiles, asserting: profile field-contract parsing, per-stack engineer-agent hard binding (agentType), gate command injection, alignment/race clause toggles, plus 6 gate/false-positive scenarios (exit 0/1/unparseable, empty implementation, critic stuck failing, P0 persisting) all aborting or passing correctly.

GitHub Actions (`.github/workflows/ci.yml`), two jobs triggered on push (main/master) and PR:

| job | content |
|-----|------|
| `verify` | `bash verify/check.sh` on Node 22 (dry-run automatically uses fixture mode, no dependency on private local repos) |
| `marketplace-smoke` | installs the claude CLI and runs `claude plugin marketplace add` on this repo, verifying the marketplace parses with the real CLI |

Release reminder: the same version number does not refresh the plugin cache (verified the hard way) — after changing `plugin/`, bump the version in **both** `plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` so downstream `claude plugin update` picks up the new package (check.sh step 1 validates semver format).

## Installation & Onboarding

```bash
# 1. Register this repo as a marketplace (after cloning locally)
claude plugin marketplace add /path/to/yearsalso-claude-harness
# 2. Install the plugin
claude plugin install dev-harness@yearsalso
# 3. Onboard each target project (generate profile + link rules + memory skeleton)
#    run inside the project: /harness-init
# 4. Periodically flow project-proven rules back into the plugin
#    /sync-rules <project-A-path> <project-B-path>
```

## Adding a New Language Stack (e.g. Python)

1. `agents/py-<role>-engineer.md` (follow the go-/web- structure: skill table + implementation discipline + verification loop)
2. `skills/py-*/` (two mandatory skills: testing and review dimensions)
3. `rules/py/` rule pack
4. Add a `py` branch in the workflows' `DIMS_BY_STACK` / profile default mappings — the shared skeleton needs zero changes.

## Real-Project Validation Record (v0.1.1)

Full-chain validation (install → /harness-init → feature-dev live run) has been completed on both daqsvrv5 (Go) and tdmversionmanager (TS/React), with `verify/dry-run.mjs` (Node dry runner, stubbed runtime + real profiles, 165 assertions) as the regression suite.

Defects caught by live runs and fixed in 0.1.1:

| defect | fix |
|---|---|
| `engineer_agent` only assembled into the prompt (soft routing); the plugin agent definition never took effect | engineer-class calls pass `opts.agentType: dev-harness:<agent>` (hard binding, confirmed via runtime spike landing in the subagent meta.json) |
| After the adversarial review loop budget was exhausted, the workflow unconditionally logged "passed" and continued with a warning (an unapproved Spec was let through to implementation) | Spec/Design/root-cause refutation and P0 review all fail-closed and escalate when the limit is hit (design-doc keeps warn-and-deliver, but logs distinguish both states) |
| A legitimately BLOCKED Implement still passed the exit-0 gate with an empty diff and got committed (exit-0 proves no regression, not delivery) | added an "artifact existence assertion" after Implement/Fix: `codeChangedFiles` unparseable or 0 → fail-closed abort |
| Commit swept in pre-existing unrelated changes; Retrospect memory writes left in the working tree | scope red line in the commit prompt; memory files committed separately as `docs(memory): ...` after retrospection |
| flags regex incompatible with the template contract `key=value` (alignment_check=on silently ignored) + comment lines could false-trigger | `[:：=]` tri-state separator, parsed only within the flags line |

Environment caveats (not plugin defects but affect usage):

- Headless (`claude -p`) has a hard guard on writes to the sensitive `.claude/` directory; /harness-init artifacts must land via a temp path or interactive approval.
- Project-scoped plugin agents only resolve inside the registering repo; `agentType` may fail to resolve in its git worktrees — use a user-scoped install when crossing worktrees.
