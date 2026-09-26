---
name: managed-apps-devkit
description: >-
  Menu-driven developer guide for Microsoft Managed Apps projects built on the
  managed-apps-template ALM (dev → test → prod branches). Presents "here is
  everything we can do" as a selectable menu, then runs the matching playbook
  as efficiently as possible. Covers: listing Power Platform environments;
  seeing which environment each app is registered in; project health checks;
  creating a new app or project; importing existing source code and converting
  it to a Managed App; cloning an app; adding data sources and Dataverse
  schema; local dev and tests; deploying and promoting to test/prod; preview,
  rollback and hotfixes; adding a new environment pathway such as QA; sharing
  and data access; syncing remotes and template upgrades; troubleshooting.
  Use when the user asks "what can I do", "show me the options", "menu",
  "devkit", "help with managed apps", or states any of those goals directly.
---

# Managed Apps Devkit

A menu over everything a developer does in a Managed Apps project, plus one
playbook per goal telling you (the agent) the fastest *safe* way to finish it.

## Step 0 — Orient (silently, in parallel, before showing anything)

Run these together in one turn; do not narrate them:

| Read | Why |
| --- | --- |
| `alm.config.json` | Environments, branches, remotes, app IDs, solution, promotion order. **Source of every ID — never ask the user for one that is here.** |
| `ms.config.json` (if present) | Which app + environment the *current branch* is bound to |
| `memory-bank.md` (if present) | Project history, gotchas, last deploys |
| `git branch --show-current` and `git status --porcelain` | Where we are, whether the tree is clean |
| `node .github/skills/managed-apps-devkit/scripts/doctor.mjs` | Tools, sign-in, bindings, hooks, remotes in one call (≈5 s; add `--remote` for drift + template version, ≈20 s) |

If `alm.config.json` does not exist, this is not a template project: only the
"standalone" options apply (marked ◇ below). Say so in one line.

If doctor reports ✗, surface those first (one line each) — most goals fail on them.

## Step 1 — Menu (skip if the user already named a goal)

If the user's request already maps to a row below, **go straight to its
playbook**. Otherwise present the menu with `ask_user`, two questions max:

**Question 1 — "What would you like to do?"** choices (one per category):

1. **See what I have** — environments, apps, project health
2. **Start something new** — new app, import existing code, clone an app
3. **Build** — run locally, add data sources, change schema, test
4. **Ship** — deploy, promote, preview, roll back, hotfix
5. **Environments** — add a pathway (e.g. QA), provision test/prod, rename
6. **Access** — share the app, grant data access, who has access
7. **Maintain** — sync remotes, template upgrades, delete an app, fix an error

**Question 2 — the specific action** in that category, from this table.
Put the most likely option first given Step 0 (e.g. after a merge to `dev`,
"Deploy to dev" first; if doctor found drift, "Sync remotes" first).

| # | Action | Playbook |
| --- | --- | --- |
| 1.1 | See Power Platform environments I can use ◇ | [inventory.md](playbooks/inventory.md#environments) |
| 1.2 | See every app and the environment it is registered in ◇ | [inventory.md](playbooks/inventory.md#apps) |
| 1.3 | Project health check (tools, bindings, drift) | [inventory.md](playbooks/inventory.md#health) |
| 1.4 | Details of one app (connectors, repo, commit, sharing) ◇ | [inventory.md](playbooks/inventory.md#one-app) |
| 1.5 | Solution/schema version in every environment | [inventory.md](playbooks/inventory.md#schema) |
| 2.1 | New project from the template (full dev/test/prod ALM) | [create.md](playbooks/create.md#template) |
| 2.2 | Quick standalone app, no ALM ◇ | [create.md](playbooks/create.md#standalone) |
| 2.3 | Import existing source code and convert it to a Managed App ◇ | [import-existing.md](playbooks/import-existing.md) |
| 2.4 | Clone an existing app to work on it ◇ | [create.md](playbooks/create.md#clone) |
| 3.1 | Run the app locally with hot reload ◇ | [develop.md](playbooks/develop.md#local) |
| 3.2 | Add a data source / connector ◇ | [develop.md](playbooks/develop.md#data-source) |
| 3.3 | Add or change a Dataverse table/column | [develop.md](playbooks/develop.md#schema) |
| 3.4 | Build, lint, run end-to-end tests | [develop.md](playbooks/develop.md#tests) |
| 3.5 | Change app settings (header, icon, name) ◇ | [develop.md](playbooks/develop.md#settings) |
| 4.1 | Deploy to dev | [ship.md](playbooks/ship.md#dev) |
| 4.2 | Promote and deploy to the next environment (test, prod…) | [ship.md](playbooks/ship.md#promote) |
| 4.3 | Preview a commit or branch without deploying ◇ | [ship.md](playbooks/ship.md#preview) |
| 4.4 | Roll back to a previous version | [ship.md](playbooks/ship.md#rollback) |
| 4.5 | Hotfix production while other work is in flight | [ship.md](playbooks/ship.md#hotfix) |
| 5.1 | Add a new environment pathway (e.g. QA) | [environments.md](playbooks/environments.md#add) |
| 5.2 | Provision a placeholder environment (test/prod not yet bound) | [environments.md](playbooks/environments.md#provision) |
| 5.3 | Rename the app per environment (`[DEV]`/`[TEST]`/`[PROD]`) | [environments.md](playbooks/environments.md#rename) |
| 5.4 | Retire an environment | [environments.md](playbooks/environments.md#retire) |
| 6.1 | Share the app with people or groups ◇ | [access.md](playbooks/access.md#share) |
| 6.2 | Create or revoke a tenant-wide share link ◇ | [access.md](playbooks/access.md#link) |
| 6.3 | Grant data access (Dataverse security role) | [access.md](playbooks/access.md#role) |
| 6.4 | See who has access ◇ | [access.md](playbooks/access.md#who) |
| 7.1 | Sync all branches with GitHub and platform repos | [maintain.md](playbooks/maintain.md#sync) |
| 7.2 | Pull scaffolding updates from the template | [maintain.md](playbooks/maintain.md#upgrade) |
| 7.3 | Publish scaffolding changes up to the template | [maintain.md](playbooks/maintain.md#publish) |
| 7.4 | Delete an app ◇ | [maintain.md](playbooks/maintain.md#delete) |
| 7.5 | Fix an error I'm seeing ◇ | [troubleshooting.md](playbooks/troubleshooting.md) |

◇ = also works outside a template project.

## Step 2 — Run the playbook

Open **only** the playbook you need. Each has: *Inputs* (and where to read
them), *Steps*, *Confirm before*, *Done when*. Follow them in order.

When finished: report the outcome in ≤5 lines (URLs, IDs, SHAs), update
`memory-bank.md` if the playbook says to, and offer the one most likely next
action from the menu — not the whole menu again.

## Operating rules (apply to every playbook)

**Efficiency**

- Batch independent reads and read-only commands into one turn.
- Always use `--json --non-interactive` with `ms` when you will parse output.
- Querying apps other than this branch's: run `ms app info` / `ms app list`
  from a neutral directory (e.g. the OS temp dir). Inside a project, `ms app
  info` defaults to the environment in `./ms.config.json` and fails for apps
  registered elsewhere.
- Prefer `npm run alm:*` over raw `ms`/`git` — the scripts carry the guards
  (branch, binding, schema version, clean tree). Raw `ms app deploy` is only for
  rollback by SHA.
- Delegate to installed plugin skills where they exist instead of reinventing:
  `add-data-source` / `microsoft-managed-apps:add-dataverse` (connectors),
  `create-app` (standalone scaffold), `dv-metadata` (tables/columns),
  `dv-security` (role assignment), `dv-connect` (Dataverse CLI auth).
- Long commands (build, deploy, e2e): run with a long initial wait; don't poll.

**Safety — confirm with the user before**

- any deploy except dev; any promotion; any `alm:solution -- import`
- `ms app share` / `unshare` / share links; `ms app delete`
- `alm:template -- push`; any `git push` you run by hand
- creating an app registration (it cannot be moved to another environment later)

**Never**

- Edit or merge another branch's `ms.config.json` into this one. Each
  environment branch owns its binding; `.gitattributes` pins it with
  `merge=ours`.
- Run `ms app create` / `ms app init` without `--environment-id` in a template
  project — the CLI auto-routes to the user's personal developer environment.
- Put environment IDs, app IDs or org URLs in shared scaffolding
  (`scaffold.paths`) or docs — they belong in `alm.config.json` / `memory-bank.md`.
- Commit, push, or switch branches unless the playbook step requires it and the
  user has agreed.

**Credentials.** Pushes to platform-managed repos can need an interactive Git
Credential Manager prompt. Agent shells often disable prompts; the ALM scripts
re-enable them. If a push still fails with "cannot prompt" or hangs, ask the
user to run that exact command in their own terminal, then continue.

**Windows.** Give PowerShell commands on one line (no `\` continuations).

**Honesty.** The Managed Apps CLI is in preview. When a playbook step is marked
*unverified*, say so. Check `ms <cmd> --help` rather than guessing flags.

## Tool map

| Need | Tool |
| --- | --- |
| Apps, deploy, share, data sources, local dev | `ms` (`@microsoft/managed-apps-cli`) |
| Environment names/IDs/types | `pac admin list --json` (Power Platform CLI) |
| Dataverse solutions, roles, raw Web API | `dataverse` CLI (via `alm:solution`, `alm:role`) |
| Branching, promotion, guarded deploy | `npm run alm:*` (see `docs/ALM.md`) |
| Everything at once, read-only | `scripts/doctor.mjs`, `scripts/apps-inventory.mjs` |

`pac code` is for *Power Apps code apps*, a different product — do not use it
for Managed Apps.
