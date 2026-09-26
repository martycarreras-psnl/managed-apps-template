# Start something new

Every new app registration is **permanently bound to one environment**. Always
settle the environment first, and confirm it with the user before registering.

## Template

A new project with full dev → test → prod ALM, built from the public template.

**Inputs:** display name; dev environment ID (required); test/prod IDs
(optional, can come later); publisher prefix; whether to keep the reference app.
Get IDs from [inventory.md → Environments](inventory.md#environments) and let the
user pick — don't ask them to paste GUIDs.

**Steps**

1. Create the repo from the template and clone it:
   ```bash
   gh repo create <owner>/<name> --private --template martycarreras-psnl/managed-apps-template --clone
   cd <name> && npm install
   npm run alm:setup                       # merge driver + hooks, REQUIRED once per clone
   ```
2. Initialise (registers the **dev** app only):
   ```bash
   npm run alm:init -- --name "Expense Tracker" --dev <dev-env-id> [--test <id>] [--prod <id>] --prefix contoso [--fresh]
   ```
   `--fresh` removes the reference app; `src/App.tsx` must then be replaced before building.
   `alm:init` renames the new platform remote `origin` → `env-dev`.
3. Add GitHub as the source-of-truth remote: `git remote add github https://github.com/<owner>/<name>.git`
   (skip if `origin` already is GitHub — then `git remote rename origin github` **before** step 2).
4. Build the data model and UI → [develop.md](develop.md#schema) and [develop.md](develop.md#data-source).
   Update `alm.config.json → app.table`, `app.tableLogicalName`, `solution.tables`.
5. `npm run alm:role -- create` → `npm run alm:solution -- export --bump build`.
6. First deploy: commit, `npm run alm:bootstrap -- dev`, `npm run alm:deploy -- dev`.
7. Test/prod later → [environments.md → Provision](environments.md#provision).

**Done when** the dev Play URL loads data. Record app ID, env ID, Play URL in `memory-bank.md`.

## Standalone

A single app with no branch-per-environment ALM (prototype, personal tool).
Delegate to the plugin's **`create-app`** skill — it handles plan → scaffold →
data source → build → `ms app dev`. Make sure it is called with an explicit
`--environment-id` unless the user wants their personal developer environment.

```bash
ms app create <folder> --display-name "My App" --environment-id <id>     # folder must be empty (".git" counts)
```

Repo mode is fixed for the app's life: default platform-managed git (recommended),
`--repo <github-url>` (needs the Microsoft GitHub App on the owner — usually not
possible for enterprise-managed accounts), or `--repo none` (bring-your-own build;
needs the *External artifacts* setting in PPAC).

A standalone app can be adopted into the template later: see
[import-existing.md](import-existing.md) (treat it as existing source).

## Clone

Work on an existing platform-managed app on this machine.

```bash
ms app list --json --non-interactive          # find the appId (or use apps-inventory.mjs)
ms app clone <empty-folder> --app <appId>     # configures Git Credential Manager too
cd <empty-folder> && npm install && ms app dev
```

Apps bound to an external GitHub repo: clone from GitHub instead. `--repo none`
apps have no source to clone.
