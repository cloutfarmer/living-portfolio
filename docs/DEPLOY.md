# Deploy

How the room and the personal site go live at `alexsigua.com`. The domain is registered (auto-renew on) and the stack
`living-portfolio-site` was created on November 9, 2026, and `http://` and `www` redirect to `https://alexsigua.com/`.
The first release went live on November 10, 2026 with the steps below (a stack update, then `deploy.mjs`), and the
post-deploy checks passed.

## What runs where

- **Infrastructure:** `infra/site.yml`, one CloudFormation stack in **us-east-1**. It holds a private S3
  bucket that only CloudFront can read (Origin Access Control), an ACM certificate, Route 53 aliases for
  the apex and `www` (which redirects to the apex), security headers (an enforced CSP and a Permissions-Policy),
  a branded `404.html` for missing paths, and a monthly cost alert. Template changes need the stack deployed again
  (step 3 below) before they're live.
- **Content:** `web/scripts/deploy.mjs` builds the personal site from the sibling `portfolio-dashboard`
  checkout and the room from this one, uploads `web/dist`, deletes what the build no longer has, and
  invalidates the HTML and the other fixed-name files.
- **Caching:** files under `assets/` are hashed by Vite, so they're cached for a year. HTML is revalidated
  on every visit. Fixed names (the scene GLB, `og.jpg`) get a day, and every deploy invalidates them.
  The scene GLB goes up already Brotli-encoded (`Content-Encoding: br`), because CloudFront doesn't compress
  `model/gltf-binary`; `--dry-run` prints both sizes.
- `dashboard-build.json`, dotfiles and source maps are never uploaded.

## Cost

Estimates; check at purchase. The domain in Route 53 is about $15 a year, and the hosted zone $0.50 a
month. The certificate is free. S3 and CloudFront fit the always-free tier at portfolio traffic.
The stack's budget emails at 80% of $5 a month and when the month is forecast past it.

## One-time setup (Alex)

1. Sign in to AWS with an administrator user from IAM Identity Center, not the root user. Then run
   `aws configure sso` and name the profile, for example `portfolio`.
2. Register `alexsigua.com` in the Route 53 console (a paid step). Registration creates the hosted zone. Find its ID:
   `aws route53 list-hosted-zones-by-name --dns-name alexsigua.com --profile portfolio`.
3. Deploy the stack. It takes about 5–15 minutes, mostly the certificate and the distribution:

   ```sh
   aws cloudformation deploy --region us-east-1 --profile portfolio \
     --stack-name living-portfolio-site --template-file infra/site.yml \
     --parameter-overrides HostedZoneId=<zone id from step 2> AlertEmail=<your email>
   ```

   Confirm the email AWS Budgets sends.

## Each release

1. Merge to `main` in both repositories, then pull `main` in this checkout and in `../portfolio-dashboard`.
2. `AWS_PROFILE=portfolio node web/scripts/deploy.mjs --dry-run`, and read the list.
3. `AWS_PROFILE=portfolio node web/scripts/deploy.mjs`. It refuses to run with uncommitted changes in
   either repository unless you pass `--allow-dirty`, so what's live can always be rebuilt from Git.
4. Check the live site (below).

## Checks after a deploy

- `curl -sI https://alexsigua.com/` and `https://alexsigua.com/projects/` return 200 with HSTS.
  `http://` and `https://www.` return 301 to `https://alexsigua.com/`.
- `curl -sI https://alexsigua.com/dashboard-build.json` returns 404, and `/` carries `content-security-policy`.
- `curl -sI -H 'Accept-Encoding: br' https://alexsigua.com/corner-desk.glb` shows `content-encoding: br` and
  `content-type: model/gltf-binary`.
- In a browser: the room loads, the computer shows the site, and "Skip to portfolio" and
  "Back to the room" work. There are no console errors.

## Rollback

Check out the previous release's commits in both repositories, then deploy again with `--allow-dirty` if
needed. The bucket also keeps old versions of each file for 30 days.

To take the site down, empty the bucket, then delete the stack. The domain and hosted zone stay, because
the registration made them.
