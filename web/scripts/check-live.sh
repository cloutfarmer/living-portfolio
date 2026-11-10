#!/usr/bin/env bash
# Checks the live site after a deploy (docs/DEPLOY.md) and exits non-zero on the first failure.
# Usage, from the repository: web/scripts/check-live.sh [path to the built index.html]
# With a path, it also waits (about 2 minutes at most) until the live home page is that exact file,
# which proves this build is the one being served.
set -euo pipefail

site="${SITE_URL:-https://alexsigua.com}"
host="${site#https://}"

fail() { echo "check-live: FAIL $*" >&2; exit 1; }
pass() { echo "check-live: ok   $*"; }
# Response headers only, lower-cased names, no carriage returns. Empty if the request fails.
headers() { curl -sS -o /dev/null -D - --max-time 20 "$@" 2>/dev/null | tr -d '\r' || true; }
status_of() { awk 'NR==1 { print $2 }' <<<"$1"; }
header_of() { awk -v name="$2" 'tolower($1) == name ":" { sub(/^[^:]*:[ ]*/, ""); print; exit }' <<<"$1"; }
sha() { if command -v sha256sum >/dev/null; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi; }

expect_ok_with_hsts() {
  local response; response="$(headers "$1")"
  [[ "$(status_of "$response")" == 200 ]] || fail "$1 returned '$(status_of "$response")', expected 200"
  [[ -n "$(header_of "$response" strict-transport-security)" ]] || fail "$1 has no strict-transport-security"
  pass "$1 200 with HSTS"
}

expect_redirect_home() {
  local response; response="$(headers "$1")"
  [[ "$(status_of "$response")" == 301 ]] || fail "$1 returned '$(status_of "$response")', expected 301"
  [[ "$(header_of "$response" location)" == "$site/" ]] || fail "$1 redirects to '$(header_of "$response" location)', expected $site/"
  pass "$1 301 to $site/"
}

expect_ok_with_hsts "$site/"
expect_ok_with_hsts "$site/projects/"
expect_redirect_home "http://$host/"
expect_redirect_home "https://www.$host/"

response="$(headers "$site/")"
[[ -n "$(header_of "$response" content-security-policy)" ]] || fail "$site/ has no content-security-policy"
pass "$site/ carries content-security-policy"

response="$(headers "$site/dashboard-build.json")"
[[ "$(status_of "$response")" == 404 ]] || fail "dashboard-build.json returned '$(status_of "$response")', expected 404"
pass "dashboard-build.json 404"

response="$(headers -H 'Accept-Encoding: br' "$site/corner-desk.glb")"
[[ "$(header_of "$response" content-encoding)" == br ]] || fail "corner-desk.glb content-encoding is '$(header_of "$response" content-encoding)', expected br"
[[ "$(header_of "$response" content-type)" == model/gltf-binary ]] || fail "corner-desk.glb content-type is '$(header_of "$response" content-type)', expected model/gltf-binary"
pass "corner-desk.glb br, model/gltf-binary"

if [[ $# -ge 1 ]]; then
  [[ -f "$1" ]] || fail "no built page at $1"
  want="$(sha <"$1")"
  for attempt in $(seq 1 12); do
    got="$(curl -sS --max-time 20 "$site/" 2>/dev/null | sha || true)"
    if [[ "$got" == "$want" ]]; then pass "live home page is this build ($1)"; exit 0; fi
    echo "check-live: home page not this build yet (attempt $attempt of 12); waiting 10 s"
    sleep 10
  done
  fail "the live home page still isn't $1 after about 2 minutes"
fi
