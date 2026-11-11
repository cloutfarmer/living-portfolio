# Deploy

How the room and the personal site go live at `alexsigua.com`. The domain is registered (auto-renew on) and the stack
`living-portfolio-site` was created on November 9, 2026, and `http://` and `www` redirect to `https://alexsigua.com/`.
The first release went live on November 10, 2026 by hand (a stack update, then `deploy.mjs`, now the
[manual fallback](#manual-fallback)), and the post-deploy checks passed. GitHub Actions deploys are set up as below
and are unvalidated until a first run passes.

## What runs where

- **Infrastructure:** `infra/site.yml`, one CloudFormation stack in **us-east-1**. It holds a private S3
  bucket that only CloudFront can read (Origin Access Control), an ACM certificate, Route 53 aliases for
  the apex and `www` (which redirects to the apex), security headers (an enforced CSP and a Permissions-Policy),
  a branded `404.html` for missing paths, a monthly cost alert, and the deploy role GitHub Actions assumes. Template
  changes are always a manual, reviewed step ([changing the stack](#changing-the-stack)); CI never touches them.
- **Content:** `web/scripts/deploy.mjs` builds the personal site from the sibling `portfolio-dashboard`
  checkout and the room from this one, uploads `web/dist`, deletes what the build no longer has, and
  invalidates the HTML and the other fixed-name files. `.github/workflows/deploy.yml` runs it.
- **Caching:** files under `assets/` are hashed by Vite, so they're cached for a year. HTML is revalidated
  on every visit. Fixed names (the scene GLB, `og.jpg`) get a day, and every deploy invalidates them.
  The scene GLB goes up already Brotli-encoded (`Content-Encoding: br`), because CloudFront doesn't compress
  `model/gltf-binary`; `--dry-run` prints both sizes.
- `dashboard-build.json`, dotfiles and source maps are never uploaded.

## How a release happens

Both repositories use the same branches. Only `prod` ships:

```
work/<topic>-YYYYMMDD  →  main (integration, CI)  →  prod (deploys)
```

1. Make the change on a `work/` branch in its own worktree and land it on `main` ([contributing](../CONTRIBUTING.md)).
2. Once `ci` has passed on that `main` commit, promote it by fast-forward, so `prod` is always an exact `main` commit:
   `git push origin main:prod`.
3. A push to this repository's `prod` runs `deploy`. A push to `portfolio-dashboard`'s `prod` runs its
   `trigger-deploy` workflow, which starts this repository's `deploy` on `prod` (`workflow_dispatch`).
4. Every deploy builds **this repository's `prod` and `portfolio-dashboard`'s `prod`**. It repeats CI's checks and
   the site's tests, deploys, then runs `web/scripts/check-live.sh`, which fails the run unless the checks below pass
   and the live home page is the page it just built.
5. To redeploy without a change: Actions → deploy → Run workflow → branch `prod`.

Safeguards: the `production` environment admits only `prod`, so a run from any other branch is refused before it
gets credentials. AWS trusts only tokens for this repository's `production` environment. One deploy runs at a time
and is never cancelled halfway. Account, bucket and distribution IDs are masked in the logs. Pull requests never deploy.

There's no required reviewer, so deploys are automatic. To add one later: Settings → Environments → production →
Required reviewers, add yourself, save. Each deploy then waits for an approval.

### Credentials

No long-lived credentials are stored ([decisions](DECISIONS.md)):

- **AWS:** GitHub's OIDC token is exchanged for the stack's `DeployRole`. It can only read the stack, put and delete
  files in the site bucket, and invalidate the distribution.
- **The private site:** a GitHub App installed on both repositories hands out installation tokens that expire within
  an hour. `deploy` requests one that can only read `portfolio-dashboard`, and `trigger-deploy` one that can only
  start workflows here.

| Where | Kind | Name | Value |
|---|---|---|---|
| this repo, `production` environment | secret | `AWS_DEPLOY_ROLE_ARN` | the stack output `DeployRoleArn` |
| this repo, `production` environment | secret | `DEPLOY_APP_PRIVATE_KEY` | the App's private key (`.pem` contents) |
| this repo, `production` environment | variable | `DEPLOY_APP_CLIENT_ID` | the App's Client ID |
| `portfolio-dashboard` | repository secret | `DEPLOY_APP_PRIVATE_KEY` | the same private key |
| `portfolio-dashboard` | repository variable | `DEPLOY_APP_CLIENT_ID` | the same Client ID |

To rotate the App key: generate a new one in the App's settings, replace both secrets, then delete the old key.

### Branch protection

A ruleset on `main` and `prod` here blocks force pushes and deletion and requires the `ci` check, so only a commit
that passed CI can land or be promoted. Pull requests aren't required, because changes land by fast-forward.
`portfolio-dashboard` is private, and GitHub doesn't enforce rulesets on private repositories on the free plan, so
its branches rely on this procedure.

## Cost

Estimates; check at purchase. The domain in Route 53 is about $15 a year, and the hosted zone $0.50 a
month. The certificate is free. S3 and CloudFront fit the always-free tier at portfolio traffic.
GitHub Actions minutes are free for public repositories, and the private site's trigger uses seconds a month.
The stack's budget emails at 80% of $5 a month and when the month is forecast past it.

## One-time setup (Alex)

1. Sign in to AWS with an administrator user from IAM Identity Center, not the root user. Then run
   `aws configure sso` and name the profile, for example `portfolio`.
2. Register `alexsigua.com` in the Route 53 console (a paid step). Registration creates the hosted zone. Find its ID:
   `aws route53 list-hosted-zones-by-name --dns-name alexsigua.com --profile portfolio`.
3. Deploy the stack ([changing the stack](#changing-the-stack)). The first deploy takes about 5–15 minutes, mostly
   the certificate and the distribution, and needs
   `--parameter-overrides HostedZoneId=<zone id from step 2> AlertEmail=<your email>`. Confirm the email AWS Budgets sends.
4. Create a GitHub App (Settings → Developer settings → GitHub Apps → New GitHub App): no webhook; repository
   permissions Contents: read and Actions: write; only on this account. Generate a private key, then install the
   App on only `living-portfolio` and `portfolio-dashboard`. App permissions cover every installation, so each
   workflow narrows its token to one repository and one permission.
5. Create the `production` environment here (Settings → Environments → New environment). Under Deployment branches
   and tags choose Selected branches and tags and add `prod`. Add the secrets and variables in the table above.
6. Create the ruleset (Settings → Rules → Rulesets → New branch ruleset): enforcement Active, targets `main` and `prod`,
   Restrict deletions, Block force pushes, Require status checks to pass with `ci`.

## Changing the stack

Infrastructure is never deployed by CI. Review a change set first:

```sh
aws cloudformation deploy --region us-east-1 --profile portfolio \
  --stack-name living-portfolio-site --template-file infra/site.yml \
  --capabilities CAPABILITY_IAM --no-execute-changeset
```

Existing parameters keep their values unless you pass `--parameter-overrides`. The GitHub OIDC provider is one per
AWS account. If `aws iam list-open-id-connect-providers --profile portfolio` lists none for
`token.actions.githubusercontent.com`, add `--parameter-overrides CreateGitHubOidcProvider=true`. Read the change set
with the command the deploy prints, then execute it in the CloudFormation console or with
`aws cloudformation execute-change-set`.

## Manual fallback

When Actions is unavailable, deploy from a laptop with the stack's administrator profile:

1. Check out the commits to release, normally `prod` in this checkout and in `../portfolio-dashboard`.
2. `AWS_PROFILE=portfolio node web/scripts/deploy.mjs --dry-run`, and read the list.
3. `AWS_PROFILE=portfolio node web/scripts/deploy.mjs`. It refuses to run with uncommitted changes in
   either repository unless you pass `--allow-dirty`, so what's live can always be rebuilt from Git.
4. `web/scripts/check-live.sh web/dist/index.html`, then the browser check below.

## Checks after a deploy

`web/scripts/check-live.sh` runs these and exits non-zero on the first failure:

- `https://alexsigua.com/` and `/projects/` return 200 with HSTS, and `/` carries `content-security-policy`.
  `http://` and `https://www.` return 301 to `https://alexsigua.com/`.
- `/dashboard-build.json` returns 404.
- `/corner-desk.glb`, requested with `Accept-Encoding: br`, has `content-encoding: br` and
  `content-type: model/gltf-binary`.
- Given the built `index.html`, the live home page matches it within about 2 minutes.

By hand, in a browser: the room loads, the computer shows the site, and "⤢ Full screen" and
"Back to the room" work. There are no console errors.

## Rollback

Revert the change on `main` and promote it to `prod` as usual. If that's too slow, use the
[manual fallback](#manual-fallback) at the previous release's commits. Re-running an old Actions run doesn't roll
back the personal site, because it always builds that repository's current `prod`. The bucket also keeps old
versions of each file for 30 days.

To take the site down, empty the bucket, then delete the stack. The domain and hosted zone stay, because
the registration made them.
