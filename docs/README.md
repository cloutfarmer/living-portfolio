# Documentation index

New here? Read in this order: the [README](../README.md) for what the project is, [architecture](../ARCHITECTURE.md)
for how it fits together, the [product spec](PROJECT_SPEC.md) for what it's trying to be, and
[asset generation](ASSET_GENERATION.md) for how the scene is built. [Contributing](../CONTRIBUTING.md) has the rules
for changes.

| Document | Purpose |
|---|---|
| [Architecture](../ARCHITECTURE.md) | Durable design, module boundaries and invariants |
| [Product spec](PROJECT_SPEC.md) | North star, scope, milestones and open product questions |
| [Decisions](DECISIONS.md) | Choices that still apply, and why |
| [Status](STATUS.md) | What's built, what was verified and how, and what couldn't be verified |
| [Asset generation](ASSET_GENERATION.md) | How to add or change scene assets: workflow, commands, rules, brief template |
| [Testing](TESTING.md) | Scene checks, browser checks and quality gates |
| [Setup](SETUP.md) | Local toolchain, browser preview and the optional Blender bridge |
| [Blender viewing](BLENDER_VIEWING.md) | Beginner steps for opening the scene and playing the candle animation |
| [Deploy](DEPLOY.md) | Hosting on AWS: infrastructure, releases, checks, rollback and costs |
| [Agent lessons](../.agent/lessons.md) | One rule per real failure while building the room with AI agents |

Add `SECURITY.md`, `plans/`, `operations/`, and `decisions/` (`ADR-NNNN-<slug>.md`) only when they have real content.

## Keeping docs small

A live doc says what's true now, in as few lines as it needs. Git keeps the rest.

- **Change, don't append.** Update `STATUS.md` and `DECISIONS.md` in place, without dated entries.
  Delete a line when it stops being true.
- **Aim for these sizes:** every doc under 100 lines, 125 at most where unavoidable, with lines wrapped at about
  120 characters (table rows excepted). Past that, cut detail; the PR description is the place for evidence.

## Truth and precedence

1. Code, migrations, and tests establish implemented behavior.
2. `ARCHITECTURE.md` establishes intended durable design; `PROJECT_SPEC.md`
   establishes product intent.
3. `STATUS.md` establishes the latest validation state.
4. Setup and operational runbooks establish exact procedures, with proposed
   procedures labeled unverified until run.
5. Decision records explain accepted tradeoffs.

If canonical documents disagree, verify against code or the target environment,
then update the incorrect document and `STATUS.md`.
