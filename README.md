# Managed Apps Template

A starting point for **Microsoft Managed Apps** projects built with
[`@microsoft/managed-apps-cli`](https://www.npmjs.com/package/@microsoft/managed-apps-cli),
with dev → test → prod ALM wired up from the first commit.

It ships as a **working reference application** — an inventory of Managed Apps backed by a
Dataverse table, with a full CRUD UI — so you can run it immediately and then reshape it, rather
than starting from an empty folder and a pile of scripts.

## What you get

**Branch-per-environment ALM.** `dev` / `test` / `prod`, each bound to its own Power Platform
environment and its own platform-managed git repo. `main` is not used.

**Guarded deploys.** `ms app deploy` has no `--environment-id` — it trusts whatever
`ms.config.json` is on disk. The scripts refuse to deploy unless the branch, app ID, environment
ID, connection references and solution version all line up:

```
✗ Schema drift: test has v1.0.1.0 but the repo ships v1.0.2.0.
  Run: npm run alm:solution -- import test
```

**Schema and app promoted together.** The managed solution is exported from dev, committed under
`solutions/`, and verified by checksum before any import. Deploys above dev are blocked when the
target's installed version does not match.

**A reference app.** React + Vite, dark theme, searchable/filterable card grid, create/edit form,
delete confirmation, summary header — all wired to generated typed Dataverse services. No raw
`fetch`/`axios`.

**Playwright tests** for the reference app, and **GitHub Actions** for build, lint, and promotion
guardrails.

## Quick start

```bash
npm install
npm run alm:setup            # registers the merge driver + git hooks — REQUIRED
npm run alm:init -- --help   # stand up dev/test/prod
```

`alm:init` is guided, not silent: creating apps across three environments needs `ms app init` per
environment and a credential prompt on each new platform repo.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run alm:setup` | Once per clone — merge driver + git hooks |
| `npm run alm:init` | Stand up a new project across environments |
| `npm run alm:deploy -- <env>` | Guarded deploy |
| `npm run alm:promote -- <env>` | Merge the previous stage in |
| `npm run alm:solution -- export\|import\|status` | Managed solution pipeline |
| `npm run alm:role -- create\|show` | Security role from config |
| `npm run alm:hotfix -- start\|land <name>` | Hotfix from prod + back-merge |
| `npm run alm:sync [-- --check]` | Keep git remotes aligned |
| `npm run alm:bootstrap -- <env>` | Join a new platform repo's history |
| `npm run alm:upgrade` | Pull scaffolding updates from this template |

## Staying current

Projects created from this template can pull scaffolding improvements later:

```bash
npm run alm:upgrade -- --check   # what changed
npm run alm:upgrade              # apply
```

Only the paths in `alm.config.json → scaffold.paths` are touched, so your `src/`,
`ms.config.json` and `solutions/` are never at risk.

## Documentation

- **[docs/ALM.md](docs/ALM.md)** — the promotion model, hotfix flow, access gates, and the one
  thing this design cannot fix (Dataverse solutions do not branch)
- **[docs/TEMPLATE.md](docs/TEMPLATE.md)** — how the template is structured and maintained

## Requirements

Node 22+, git, and `@microsoft/managed-apps-cli` (`npm install -g @microsoft/managed-apps-cli`).
A Power Platform environment with Dataverse. Three environments for the full model, though you
can start with one and add the others later.
