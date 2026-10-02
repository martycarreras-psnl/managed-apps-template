# Set up this project (first run)

Takes a fresh copy of the template to a registered dev app running locally.
The user should not need a terminal, apart from the sign-ins only they can
finish.

**Principles**

- **Run it again safely.** Check each step's state before acting and skip what's
  already done. Running this playbook a second time should only fix gaps.
- **Do the work yourself.** Run commands; don't hand the user a list. Stop only
  for the things marked 🙋 below.
- **Ask everything in one go.** Collect the four decisions (step 5) in
  consecutive questions, then run straight through.
- **Say what's happening in plain words.** One short line per step, e.g.
  "Git Credential Manager is installed but not switched on. Fixing that now."
  Assume the user is new to terminals.
- **Stop clearly when blocked.** If something needs an admin, a licence or a
  policy change, say exactly what and who can fix it. Don't work around it.

## 1. Orient (in parallel, no narration)

```bash
node --version; git --version; git remote -v; git branch --show-current
node .github/skills/managed-apps-devkit/scripts/doctor.mjs     # works before init too
```

Also read `alm.config.json`. If `environments.<first stage>.provisioned` is
already `true`, the project is set up: run [inventory.md → Health](inventory.md#health)
instead and stop.

Note the OS. On Windows, give single-line PowerShell commands.

## 2. Tools

Install only what's missing. List what you'll install, get **one**
confirmation, then install it all.

| Tool | Check | macOS | Windows |
| --- | --- | --- | --- |
| Node.js 22+ | `node --version` | `brew install node` | `winget install OpenJS.NodeJS.LTS` |
| Git | `git --version` | `brew install git` | `winget install Git.Git` (includes Git Credential Manager) |
| Git Credential Manager | `git credential-manager --version` | `brew install --cask git-credential-manager` | bundled with Git for Windows |
| Managed Apps CLI | `ms --version` | `npm install -g @microsoft/managed-apps-cli@latest` | same |
| Power Platform CLI (optional, lists environments) | `pac help` | `dotnet tool install -g Microsoft.PowerApps.CLI.Tool` | same |

Then, always, and it's safe to repeat:

```bash
git credential-manager configure     # registers GCM as git's credential helper; ms app init fails preflight without it
git config --get user.name; git config --get user.email
```

If either identity value is empty, ask the user for their name and email and
set them with `git config --global user.name "…"` and `git config --global user.email "…"`.
Without them, every commit fails, including the ones `alm:init` makes.

- No Homebrew on macOS? Point the user to <https://brew.sh> rather than
  installing it silently. It needs their password.
- If an install asks for an admin password or elevation, the user types it (🙋).
  On a managed laptop it may be blocked. Say so and name the tool they need
  IT to install.
- `pac` needs the .NET SDK. If `dotnet` is missing, skip `pac` and use the
  fallback in step 5.
- After installing Node or Git, a new shell may be needed for PATH changes.
  Re-check with the full path, or ask the user to restart the agent.

## 3. Sign in 🙋

```bash
ms auth status
```

If not signed in, run `ms auth login`. A browser opens and the **user**
completes it, including MFA or passkey. On a machine without a browser, use
`ms auth login --device-code`: show the URL and code and wait. There is no
service principal option.

If `pac` is installed and `pac auth list` shows no profile, run `pac auth create`
(its own browser sign-in). Both must be the **same account and tenant**. If
they differ, say so before continuing.

## 4. Agent plugin

The Microsoft Managed Apps plugin adds the data-source, deploy and create-app
skills that later playbooks delegate to. Setup itself doesn't need it.

| Agent | What to do |
| --- | --- |
| Copilot CLI / GitHub Copilot App | You can run it yourself: `copilot plugin marketplace add microsoft/Managed-Apps` then `copilot plugin install microsoft-managed-apps@Managed-Apps`. Check with `copilot plugin list`. It loads in the **next** session. |
| Claude Code | 🙋 Ask the user to type `/plugin marketplace add microsoft/Managed-Apps` then `/plugin install microsoft-managed-apps@Managed-Apps`. |
| VS Code, Cursor, others | Skip it. The devkit's playbooks use the `ms` CLI directly. |

Optional, for schema and role work: `copilot plugin install dataverse@awesome-copilot`
(or `/plugin install dataverse@awesome-copilot` in Claude Code).

## 5. Decisions (ask together, one question each)

1. **Dev environment.** Run `pac admin list --json` and offer the environments
   as choices: name, type, and the last 4 characters of the ID. Never ask the
   user to paste a GUID when you can list them. Without `pac`: ask the user to
   open <https://make.powerapps.com>, pick the environment in the top-right
   switcher, then open **⚙ Settings → Session details** and copy the
   **Environment ID**.
   Tell them: *the app is permanently tied to this environment.*
2. **App name.** Freeform, 2–5 words (e.g. "Expense Tracker").
3. **Start fresh or keep the example app?** Recommend **start fresh**. The
   example app needs its own Dataverse table, which won't exist in their
   environment, so it shows an error until that's created.
4. **Will the app use Dataverse, Copilot Studio agents or workflows?** If **no**
   (only other connectors, or no data), recommend **app-only**: no solution is
   created or promoted. Pass `--app-only` to init (it implies `--fresh`). If
   unsure, choose app-only; a solution can be added later (`docs/ALM.md → App-only projects`).
5. **Test and prod environments now, or later?** Recommend **later**. They're
   provisioned after the first dev deploy ([environments.md → Provision](environments.md#provision)).
   If they're chosen now, only record the IDs (`--test`/`--prod`).

The publisher prefix defaults to one derived from the name. Mention it, but
don't ask unless the user cares.

## 6. Install and prepare the clone

```bash
npm install
npm run alm:setup           # merge driver + git hooks, REQUIRED once per clone
```

**Remotes. Do this before init.** `alm:init` renames a remote called `origin` to
`env-dev`. If `origin` is the user's GitHub repo, rename it first or GitHub
becomes the dev remote:

```bash
git remote rename origin github      # only if origin points at github.com
```

No git history at all (they downloaded a ZIP)? Run `git init -b main && git add -A && git commit -m "chore: from template"`
first. Tell them they'll want a GitHub repo later as the source of truth.

## 7. Register the dev app

Show a three-line summary (name, environment name, fresh or example) and get a
**yes**. Registration can't be undone or moved. Then:

```bash
npm run alm:init -- --name "<App Name>" --dev <env-id> [--fresh | --app-only] [--test <id>] [--prod <id>]
```

- With `--app-only`, there's no solution track: skip every `alm:solution` and
  `alm:role` step in later playbooks.

- It creates the `dev`/`test`/`prod` branches, registers the app in dev, and
  renames the platform remote to `env-dev`.
- It records dev's Dataverse URL in `alm.config.json` (needed by `alm:solution`
  and `alm:role`). If it warns that it couldn't, sign in to the Dataverse CLI
  or `pac` and run init again.
- It removes the `ms.config.json` and `solutions/` lines from `.gitignore`.
  The template ignores them; a project must commit both.
- With `--fresh`, it replaces the example with a placeholder `src/App.tsx` and
  keeps `tests/support/env.ts`, which the Playwright config needs.

## 7b. Join the platform repo's history 🙋 (visible terminal)

The app's platform repo starts with its own commit, and the first fetch from it
opens a one-time Git Credential Manager sign-in. In an agent shell that prompt
is hidden and the command just hangs, often at the first deploy. Do it now,
where the user can see it: open a **terminal canvas** (or ask the user to use
their own terminal) and run:

```bash
git checkout dev
git add -A && git commit -m "chore: initial setup"      # bootstrap needs a clean tree
npm run alm:bootstrap -- dev
```

The user completes the sign-in in the browser window that opens. Bootstrap is
safe to re-run; it does nothing once the histories are joined.

## 8. Verify

Run in parallel:

```bash
npm run build
node .github/skills/managed-apps-devkit/scripts/doctor.mjs
```

Doctor should show dev provisioned, hooks and merge driver in place, and the
branch bound to the chosen environment. Fix any ✗ before continuing.

If step 8 changed anything, commit it on `dev` once the user agrees. If a
`github` remote exists, offer to push `dev` there too.

## 9. Run it

Start `ms app dev` in the background (async or a terminal canvas) and give the
user the **App Player URL**, the one with real sign-in. The first load may ask
them to sign in 🙋.

Tell them to open it in **Chrome or Edge**. The App Player doesn't work in an
agent's side-panel browser.

Create or update `memory-bank.md`: app name, app ID, dev environment name and
ID, Play URL, date.

**Done when** the App Player URL loads the app from the user's dev environment.

Offer next, choosing the most likely one:

- Add a table and screens → [develop.md → Schema](develop.md#schema) (creates
  the publisher and solution first)
- Connect SharePoint, Outlook and others → [develop.md → Connectors](develop.md#connectors), then [Data source](develop.md#data-source)
- First deploy to the cloud → [ship.md → Deploy to dev](ship.md#dev)
