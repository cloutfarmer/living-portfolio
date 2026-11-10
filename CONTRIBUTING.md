# Contributing

This is a personal portfolio project, so this guide mainly records how it's developed: by me and by the AI coding
agents I work with. Agents also follow [AGENTS.md](AGENTS.md).

## Setup

Node.js 22.18 or later. Blender 5.2.3 LTS only if you change the scene. Details are in [setup](docs/SETUP.md).

```bash
cd web
npm ci
npx vite        # the room; the personal site on the monitor is a separate, private repository
```

## Branches and landing

Changes go `work/<topic>-YYYYMMDD` → `main` → `prod`, and only `prod` deploys ([deploy](docs/DEPLOY.md)).
`main` is the integration branch. Make each change on a `work/` branch in its own worktree, because other sessions
may share the main checkout, and open a pull request into `main`:

```bash
git fetch origin
git worktree add ../living-portfolio-your-change -b work/your-change-YYYYMMDD origin/main
```

Land changes by fast-forward from a local checkout (`git merge --ff-only`, then push), not with GitHub's merge
button. A merge commit made on GitHub can carry the account's private email. To release, promote a `main` commit
that passed CI with `git push origin main:prod`. That push deploys.

## Keep it public-safe

Everything committed here is published, including commit metadata, PR text and branch names.

- **Commit with a GitHub noreply address.** Set it once per clone:
  `git config user.email "<id>+<username>@users.noreply.github.com"`.
- **No personal details:** no personal email, phone number or home address, and no absolute local paths (write paths
  from the repository root).
- **No infrastructure identifiers or secrets:** no AWS account, hosted-zone or distribution IDs, no tokens, and no
  `.env` files. `infra/site.yml` takes these as parameters at deploy time.
- **No private notes:** roadmaps, session logs and scratch evidence stay out of the repo. Put verification evidence
  in the PR description.
- **Assets need provenance first:** add a row to [`assets/ASSET_MANIFEST.csv`](assets/ASSET_MANIFEST.csv) with the
  author, source URL and license before committing a model, font or image. Characters and other IP aren't allowed even
  when a model's license covers the mesh.
- **Photos:** strip location and camera metadata (`exiftool -all= file.jpg`), and add only photos you're allowed to
  publish.

Before every commit, run:

```bash
node scripts/check-public.mjs        # personal paths, emails and commit identities
node .agent/repository-scan.mjs      # secrets and env files
git diff --check
```

CI runs all three on every pull request and on `main` and `prod`.

## Verification

- **Site changes:** `npm run build` in `web/`, then check the change in a browser. The [testing guide](docs/TESTING.md)
  lists the browser checks and which ports to use.
- **Scene changes:** follow [asset generation](docs/ASSET_GENERATION.md). Run `check_scene.py` and `check_glb.py`,
  look at the review sheet, and then re-export.
- In the PR, describe the change, the resulting behavior, and the checks you actually ran. Say "could not verify" for
  anything that didn't run.

## Commits

- Write subjects as behavior, in the imperative: "Settle the belt after scaling it". Keep one concern per commit.
- Stage only the files you mean to commit, and read `git diff --staged` first.
- Update the doc that owns a fact in the same change as the behavior. [The index](docs/README.md) says which doc owns
  what.
