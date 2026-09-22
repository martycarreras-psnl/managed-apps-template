# Managed Apps Template

A starting point for **Microsoft Managed Apps** projects built with
[`@microsoft/managed-apps-cli`](https://www.npmjs.com/package/@microsoft/managed-apps-cli),
with dev → test → prod ALM wired up from the first commit.

It ships as a **working reference application** — an inventory of Managed Apps backed by a
Dataverse table, with a full CRUD UI — so you can run it immediately and then reshape it for
your own use case, rather than starting from an empty folder and a pile of scripts.

Works on **Windows** and **macOS**, with **GitHub Copilot App**, **Copilot CLI**, or
**Claude Code**.

---

## What you get

**Branch-per-environment ALM.** `dev` / `test` / `prod`, each bound to its own Power Platform
environment and its own platform-managed git repo. `main` is not used.

**Guarded deploys.** `ms app deploy` has no `--environment-id` — it trusts whatever
`ms.config.json` is on disk. The scripts refuse to deploy unless the branch, app ID, environment
ID, connection references, and solution version all line up:

```
✗ Schema drift: test has v1.0.1.0 but the repo ships v1.0.2.0.
  Run: npm run alm:solution -- import test
```

**Schema and app promoted together.** The managed solution is exported from dev, committed under
`solutions/`, and verified by checksum before import.

**A reference app.** React + Vite, dark theme, searchable/filterable card grid, create/edit form,
delete confirmation, summary header — wired to generated typed Dataverse services. No raw
`fetch`/`axios`.

**Playwright tests** and **GitHub Actions** for build, lint, and promotion guardrails.

---

## 1. Prerequisites

Install these first, whichever agent you use.

| | Why | Check |
| --- | --- | --- |
| **Node.js 22+** | The CLI rejects older versions | `node --version` |
| **Git** | `ms app init` initializes and pushes the repo | `git --version` |
| **Git Credential Manager** | Authenticates pushes to platform-managed repos | `git credential-manager --version` |

### Windows

Git for Windows bundles Git Credential Manager and configures it. Install
[Node.js](https://nodejs.org) and [Git](https://git-scm.com), then verify in PowerShell:

```powershell
node --version
git --version
git credential-manager --version
```

### macOS

```bash
brew install node git
brew install --cask git-credential-manager
git credential-manager configure    # REQUIRED — see below
```

> **Do not skip `git credential-manager configure`.** GCM can be installed but not registered as
> a credential helper, and `ms app create` fails preflight with:
>
> ```
> Git Credential Manager is installed but not configured as a Git credential helper.
> ```
>
> The command writes a `credential.helper` entry to your global `~/.gitconfig`. URL-scoped
> helpers (such as GitHub's) are unaffected.

### The Managed Apps CLI

```bash
npm install -g @microsoft/managed-apps-cli@latest
ms --version
ms auth login
```

`ms auth login` supports interactive browser and device-code sign-in only — **there is no
service principal option**, which is why deploys run locally rather than in CI.

---

## 2. Install the agent plugin

The **Microsoft Managed Apps** plugin gives your agent the `/create-app`, `/add-data-source`,
`/deploy` and related skills. Install it once; it applies to every folder.

### GitHub Copilot CLI

Run `copilot` in any folder, then:

```
/plugin marketplace add microsoft/Managed-Apps
/plugin install microsoft-managed-apps@Managed-Apps
```

### Claude Code

Identical commands. Run `claude`, then:

```
/plugin marketplace add microsoft/Managed-Apps
/plugin install microsoft-managed-apps@Managed-Apps
```

### GitHub Copilot App

The desktop app runs Copilot CLI under the hood and shares the same `~/.copilot` configuration,
so plugins installed in either are available in both. Open a session and use the same slash
commands in chat.

### Optional: Dataverse skills

Useful for schema work, bulk data, queries, security roles, and solution lifecycle:

```
/plugin install dataverse@awesome-copilot
```

Source: [microsoft/Dataverse-skills](https://github.com/microsoft/Dataverse-skills).

> **Verify before continuing:** ask your agent *"list my installed plugins"*. If the Managed
> Apps plugin is missing, the skills below will not resolve.

---

## 3. Create your project

Click **Use this template → Create a new repository** on GitHub, then clone it.

```bash
git clone https://github.com/<you>/<your-repo>
cd <your-repo>
npm install
npm run alm:setup      # merge driver + git hooks — REQUIRED, once per clone
```

`alm:setup` is not optional. It registers the merge driver that keeps `ms.config.json` pinned
per branch; without it a promotion merge will repoint your production app at your dev
environment.

### Find your environment IDs

In the [Power Platform Admin Center](https://admin.powerplatform.microsoft.com/), open each
environment and copy its ID from **Settings → Session details**, or run:

```bash
pac admin list
```

You need at least a dev environment. Test and prod can be added later.

### Initialize

```bash
npm run alm:init -- --name "Expense Tracker" \
  --dev <dev-env-id> --test <test-env-id> --prod <prod-env-id> \
  --prefix contoso
```

On **Windows PowerShell**, put it on a single line (backslash continuation is bash-only):

```powershell
npm run alm:init -- --name "Expense Tracker" --dev <dev-env-id> --prefix contoso
```

Add `--fresh` to remove the reference app and start from an empty `src/`.

`alm:init` writes `alm.config.json`, creates the three branches, installs hooks, and registers
the dev app. It is **guided, not silent** — each environment needs its own `ms app init`, and
every new platform repo triggers a credential prompt on first push.

---

## 4. Build your app

Ask your agent, in plain language:

> "Add a Dataverse table called Expenses with columns for amount, category, date, and notes,
> then build a UI to manage them."

The plugin's skills handle the connector wiring and code generation. Then:

```bash
npm run alm:role -- create                      # security role from alm.config.json
npm run alm:solution -- export -- --bump build  # managed solution into solutions/
git add -A && git commit -m "feat: initial app"
npm run alm:bootstrap -- dev                    # join the platform repo's history
npm run alm:deploy -- dev
```

`alm:bootstrap` exists because a newly provisioned platform repo ships its own unrelated
"Initial commit", so the first push is rejected until the histories are joined.

---

## 5. Promote

```bash
npm run alm:promote  -- test
npm run alm:solution -- import test
npm run alm:deploy   -- test
```

Then the same for `prod`. **Import the solution before deploying** — `alm:deploy` blocks on
version drift, and `ms app add data-source` reads table metadata from the target org, so the
schema must be there first.

### Hotfix while work is in flight

```bash
npm run alm:hotfix -- start login-crash   # branches from prod, not dev
# fix, commit, verify with `ms app dev`
npm run alm:hotfix -- land login-crash    # merges to prod + back-merges
npm run alm:deploy -- prod
```

---

## Commands

| Command | Purpose |
| --- | --- |
| `npm run alm:setup` | Once per clone — merge driver + git hooks |
| `npm run alm:init` | Stand up a new project |
| `npm run alm:deploy -- <env>` | Guarded deploy |
| `npm run alm:promote -- <env>` | Merge the previous stage in |
| `npm run alm:solution -- export\|import\|status` | Managed solution pipeline |
| `npm run alm:role -- create\|show` | Security role from config |
| `npm run alm:hotfix -- start\|land <name>` | Hotfix from prod + back-merge |
| `npm run alm:sync [-- --check]` | Keep git remotes aligned |
| `npm run alm:bootstrap -- <env>` | Join a new platform repo's history |
| `npm run alm:upgrade [-- --check]` | Pull scaffolding updates from this template |

---

## Staying current

```bash
npm run alm:upgrade -- --check   # what changed
npm run alm:upgrade              # apply
```

Only the paths in `alm.config.json → scaffold.paths` are touched, so your `src/`,
`ms.config.json`, and `solutions/` are never at risk. See
[docs/TEMPLATE.md](docs/TEMPLATE.md).

---

## Troubleshooting

Problems you are likely to hit, and what they mean.

**`Git Credential Manager is installed but not configured as a Git credential helper`**
Run `git credential-manager configure`. Common on macOS.

**`'.' is not empty. Specify an empty directory`**
`ms app create` counts `.git` as content. Use `ms app init` for an existing repo — which is what
`alm:init` does.

**`The Microsoft GitHub App can't access the bound repository`**
The Microsoft GitHub App is not installed on the owning account. Enterprise-managed (EMU)
accounts usually cannot install third-party GitHub Apps. Use `--repo native` — a
platform-managed repo — which is what this template does by default.

**`External artifact deployment is not enabled for this environment`**
Your app was registered with `repoType: "none"`. That path uploads a local zip and requires the
`AllowExternalArtifactDeployment` environment setting, which is off by default and not settable
from any CLI. Re-register with `--repo native` to use the cloud build path instead.

**`! [rejected] ... (fetch first)` on the first push to a platform repo**
Unrelated histories. Run `npm run alm:bootstrap -- <env>`.

**`fatal: Cannot prompt because user interactivity has been disabled`**
Some agent harnesses set `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=Never`. The ALM scripts
override this automatically. For a manual push:

```bash
GIT_TERMINAL_PROMPT=1 GCM_INTERACTIVE=1 GCM_GUI_PROMPT=0 git push origin HEAD
```

```powershell
$env:GIT_TERMINAL_PROMPT="1"; $env:GCM_INTERACTIVE="1"; $env:GCM_GUI_PROMPT="0"; git push origin HEAD
```

**Users can open the app but see an error on first load**
Two independent gates. `ms app share` controls who can *open* the app; a Dataverse security role
controls who can *read data*. Sharing alone is not enough. You will not notice as a System
Administrator, because you implicitly hold every privilege. Run `npm run alm:role -- create` and
assign the role.

**Playwright tests cannot sign in**
Tenants enforcing passkey/FIDO cannot authenticate inside an automated browser — Chrome disables
the platform authenticator under automation, so the Touch ID / Windows Hello prompt never
appears. Use an account with password or Authenticator sign-in.

**`merge conflict in ms.config.json` during promotion**
The merge driver is not registered in this clone. Run `npm run alm:setup`. Always keep the
**target** branch's copy.

---

## Documentation

- **[docs/ALM.md](docs/ALM.md)** — the promotion model, hotfix flow, access gates, and the one
  thing this design cannot fix (Dataverse solutions do not branch)
- **[docs/TEMPLATE.md](docs/TEMPLATE.md)** — how the template is structured and maintained
