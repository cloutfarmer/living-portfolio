# Local setup

Run commands from the repository root unless a step says otherwise. Day-to-day scene work uses the headless
commands in [asset generation](ASSET_GENERATION.md), which need no bridge. [Status](STATUS.md) records what has run.

## Tools

Tested with Node 22.18 and Blender 5.2.3 LTS at `/Applications/Blender.app` (set `BLENDER` if it lives elsewhere); exact
package versions are in `web/package-lock.json`. The personal site on the monitor is a separate, private repository
expected at `../portfolio-dashboard`, which the room builds into `/projects/` (see
[architecture](../ARCHITECTURE.md#dashboard-integration)). Deploying needs the AWS CLI with an SSO profile; see
[deploy](DEPLOY.md).

## Browser preview

The exported scene is committed, so the room runs without Blender:

```sh
cd web
npm ci
npx vite               # the room only; serves http://localhost:5173 or the next free port
```

Without the personal site checked out, the room works, but the main monitor and the "⤢ Full screen" link load
the room itself (Vite's fallback page) instead of the site.
With `../portfolio-dashboard` present (or `DASHBOARD_DIR` set), use the full commands:

```sh
npm run export-scene   # newest saved corner-desk-vNNN.blend -> assets/processed/corner-desk.glb (needs Blender)
npm run dev            # builds the personal site into /projects/, then starts Vite
```

`export-scene` runs its own headless Blender on the saved file and never saves it, so it doesn't touch an open Blender
session. It sees saved work only: save a new checkpoint, re-run it, and reload the page. Pass a path to export another
file. `npm run build` then `npm run preview` serves the production build (port 4173).

## Blender bridge (optional)

The single-cube connection gate passed on November 4, 2026, through the official Blender Lab bridge's connection helper
(native MCP tools weren't exposed in that session). Re-check the
[official overview](https://www.blender.org/lab/mcp-server/) and
[setup wiki](https://projects.blender.org/lab/blender_mcp/wiki/Setup) before reinstalling. Cloning and registering it
downloads code and changes client configuration, so get approval first and inspect the destination. The guide
proposed these commands (unverified here; it used `codex mcp add` with the same arguments):

```sh
git clone https://projects.blender.org/lab/blender_mcp.git "$HOME/blender_mcp"
claude mcp add blender -- uv --directory "$HOME/blender_mcp/mcp" run blender-mcp
claude mcp list
```

To re-prove a connection: keep Blender open on a blank file with its MCP server running, list the tools and inspect the
active scene without changing it, then, with approval for the shown Python, make one cube with a muted green material,
render, save to a scratch `connection-test.blend` outside `blender/scenes/`, and reopen it.

The bridge can run arbitrary agent-generated Python without guards. Use a dedicated workspace, backups, recoverable
checkpoints and script review; get approval for shell commands, downloads and filesystem-wide operations; and never
run competing Blender bridges. An isolated account or VM gives stronger isolation.
