# living-portfolio agent guide

This is the canonical entry point for coding agents. Keep it short. Durable
design belongs in `ARCHITECTURE.md`; volatile state and exact procedures belong
under `docs/`.

## Repository

- A public repository. Write paths relative to the repository root. Local Blender
  development and a browser preview; hosting is defined in `infra/`.
- Preserve unrelated and uncommitted work. Do not commit, push, deploy, or
  mutate external services unless the user explicitly requests it.
- Other sessions can share this checkout. Check `git status` and file times before
  editing files you didn't write, and report work that isn't yours.
- Changes go on a `work/<topic>-YYYYMMDD` branch in a separate worktree, then to `main`;
  only a push to `prod` deploys. See `CONTRIBUTING.md`.
- Before planning, run `git fetch origin` and read code from `origin/main`
  (`git show origin/main:<path>` or a fresh worktree), not the local checkout.
  Merge `origin/main` into a work branch before its PR.

## Start here

Read only the documents needed for the task:

| Task | Required reading |
|---|---|
| Product scope and milestones | `docs/PROJECT_SPEC.md` |
| System design or module boundaries | `ARCHITECTURE.md` |
| Adding or changing scene assets | `docs/ASSET_GENERATION.md` |
| Local toolchain setup | `docs/SETUP.md` |
| Current readiness or open questions | `docs/STATUS.md` |
| Rules for contributing changes | `CONTRIBUTING.md` |
| Hosting, releases, or AWS | `docs/DEPLOY.md` |
| Tests or verification | `docs/TESTING.md` and `docs/STATUS.md` |
| Agent limits for this repo | `.agent/policy.yml` and `.agent/lessons.md` |

`docs/README.md` is the complete index. The maintainer keeps the roadmap, session
logs and working notes privately, outside this repository.

## Safety rules

1. Never print, store, commit, or paste secrets.
2. Commands must use known paths and values. If a value is unknown, run a
   discovery command first; never leave a placeholder that can run literally.
3. Blender MCP can execute arbitrary Python. Inspect proposed code and affected
   paths, confirm the active scene, preserve checkpoints, and obtain approval
   before scene writes, renders, or saves. See `docs/SETUP.md`.
4. Obtain approval for Blender-trial shell commands, downloads, and filesystem-wide
   operations. Do not run paid generation APIs or competing Blender bridges.
5. Review asset permissions and record provenance in `assets/ASSET_MANIFEST.csv`
   before use or upload to an external AI service.

### Public repository

Every commit here is published, so nothing personal goes into files, commit
messages, PR text or branch names:

- No personal email (commit with a GitHub noreply address), no absolute local
  paths, no account, zone or distribution IDs, and no private URLs.
- Never copy in, link to, or name the path of the maintainer's private notes.
  Put verification evidence in the PR description, not in new docs.
- No characters or other IP, even when a model's license allows the mesh.
- Run `node scripts/check-public.mjs` before every commit. CI runs it too.

## Engineering invariants

- Prove the single-cube connection and reload before room modeling.
- Prove the complete room → desk → content → back loop before expanding scope. The primary monitor dashboard is
  approved; other content interactions remain deferred. Reactions that stay in the room are fine.
- Provide keyboard-accessible navigation to the same content as 3D interaction.
- Keep scenes, scripts, asset provenance, and spec recoverable; ship optimized exports.
- Use measured browser performance to set asset budgets.
- Report a downloaded asset's cost and license to the user before adding it.

See `ARCHITECTURE.md` for durable boundaries and `docs/TESTING.md` for gates.

## Working standard

- Treat code, migrations, and tests as evidence when documentation disagrees.
- Label facts as validated, unvalidated, historical, or inferred.
- Update the canonical document in the same change as behavior; link to facts
  instead of repeating them.
- Keep docs small: change them in place, without dated entries. See "Keeping docs small" in `docs/README.md`.
- Run the smallest safe relevant tests first.
- A check that can't run reports "could not verify", never "nothing found".

## Session budget

- One task per session. When a task is done, end with "Task done — run /clear
  before the next task."
- Context is capped at 300k tokens by the machine setting
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW=300000`; keep it set.
- Turn off plugins and skills this repo doesn't use (`enabledPlugins` in
  `.claude/settings.json`).
