# ALM: dev → test → prod

How changes move through environments in this repo, and why it is shaped this way.

## The two tracks

A Managed App is **not** a Dataverse solution component. Verified: Dataverse has no
`managedapp` / `appframework` / `codeapp` entity, `ms app deploy` takes a git commit, and the
CLI has no solution commands. So there are two independent pipelines:

| | Dataverse schema | The app |
| --- | --- | --- |
| Artifact | `cr922_managedappinventory` | React code + `ms.config.json` |
| Unit of promotion | Solution (unmanaged → managed) | Git commit |
| How it moves | Export managed, import to target | `ms app deploy` from that env's registration |
| Lives in Dataverse? | Yes | No |

If you only change app code, the solution track is not involved at all. That covers most
changes, including most hotfixes.

## Repo layout

**Three long-lived branches, one per environment.** Feature branches cut from `dev`.

| Branch | Platform remote | Bound by |
| --- | --- | --- |
| `dev` | `env-dev` | `ms.config.json` on that branch |
| `test` | `env-test` | `ms.config.json` on that branch |
| `prod` | `env-prod` | `ms.config.json` on that branch |

Concrete environment IDs, app IDs and Dataverse org URLs live in
`alm.config.json` (and `memory-bank.md`), never in this document — this file is
shared scaffolding and is published to the public template repo.

`github` is the code source of truth — PRs, reviews, history. The `env-*` remotes are
platform-managed repos; **deploys build from those**, not from GitHub.

### Why branches carry `ms.config.json`

`ms app deploy` has **no `--environment-id`**. It deploys whatever `ms.config.json` on disk
says. So the file is the environment selector, it differs per environment, and it must be
committed because the cloud build reads it.

That makes a naive `git merge dev` into `prod` dangerous: it would overwrite prod's binding
with dev's and repoint the production app at the sandbox Dataverse org.

`.gitattributes` prevents this:

```
ms.config.json merge=ours
```

Promotion merges keep the **target** branch's copy. The attribute needs a local driver, which
is per-clone config, not committed:

```bash
npm run alm:setup      # run once per clone — REQUIRED
```

Skip it and the attribute silently does nothing. `alm:promote` refuses to run without it, and
verifies the file was untouched after every merge.

## The schema rule

**Every deploy above dev ships with the managed solution.** Schema is exported as managed from
dev, committed under `solutions/`, and promoted with the code.

```bash
npm run alm:solution -- export --bump build   # from dev; writes solutions/ + manifest.json
npm run alm:solution -- import test           # verifies sha256, then imports
npm run alm:solution -- status                # version in repo vs every environment
```

`alm:deploy` enforces this. For any non-dev environment it refuses to deploy unless the
committed artifact's checksum matches its manifest **and** the target has that exact version
installed:

```
✗ Schema drift: test has v1.0.1.0 but the repo ships v9.9.9.9.
  Run: npm run alm:solution -- import test
```

`solutions/` holds both the managed zip (the promoted artifact) and the unmanaged zip (for
reference/diffing), plus `manifest.json` recording version, timestamp, source environment,
and sha256.

## Keeping remotes in sync

```bash
npm run alm:sync            # push every branch to github + its platform repo
npm run alm:sync -- --check # report drift, exit 1 if any (CI-friendly)
```

`alm:deploy` already pushes to the platform repo and mirrors to GitHub, so `alm:sync` is for
catching up after local-only work. It never force-pushes — a remote ahead of local is reported,
not overwritten.

## Normal change

```bash
git checkout -b feature/thing dev
ms app dev                                   # local, hot reload
git commit -am "feat: thing"

# integrate
git checkout dev && git merge feature/thing
npm run alm:deploy -- dev

# promote
npm run alm:promote -- test
npm run alm:deploy  -- test

npm run alm:promote -- prod
npm run alm:deploy  -- prod
```

`alm:deploy` refuses to run unless: you are on the right branch, the tree is clean,
`ms.config.json` matches the expected app + environment, connection references point at that
environment's Dataverse org, and the build passes. Then it pushes to the platform remote,
mirrors to GitHub, and deploys the exact commit.

## Hotfix while work is in flight

The point is to ship a fix **without** the half-finished enhancement sitting in `dev`. So the
branch is cut from `prod`:

```bash
npm run alm:hotfix -- start login-crash      # branches from prod
# fix, commit, verify with `ms app dev`
npm run alm:hotfix -- land login-crash       # merges to prod + back-merges
npm run alm:deploy -- prod
npm run alm:deploy -- dev                    # optional: ship the back-merge
```

`land` back-merges prod into `test` and `dev` automatically. **This is the step teams forget** —
without it the next `dev → test → prod` promotion silently reverts the fix.

### Rolling back

App-only changes roll back by redeploying the previous commit:

```bash
git log --oneline          # find the last good sha
ms app deploy --commit <sha>
```

Schema changes do **not** roll back cleanly. That asymmetry is the main argument for keeping
schema changes additive.

## Schema changes

Solutions do not branch. Your dev *environment* holds whatever schema you have been building,
including in-flight work — so you cannot cleanly export "just the fix" if a hotfix needs a
schema change.

Mitigations, best first:

1. **Keep schema additive and decoupled from app releases.** A new nullable column shipped
   early is harmless; the app ignores it until the feature lands. This avoids the problem
   entirely and is why most teams never hit it.
2. **Solution patch** on top of the imported version, for a narrow fix.
3. **A hotfix environment** — a copy of prod — so emergency schema work exports from a clean
   baseline.

Normal schema promotion: make the change in dev → confirm it is in `CopilotAppsFoundations` →
export managed → import to target → **then** bind the app there.

Order matters: `ms app add data-source` reads table metadata from the target org, so the
solution must be imported first.

## Enforcement

GitHub branch protection and rulesets both require **GitHub Pro on a private repo**, and this
repo is private on a free plan — the API returns 403. Enforcement is therefore local:

`.githooks/pre-push` blocks direct pushes to `test` and `prod`. `npm run alm:setup` points
`core.hooksPath` at `.githooks`; the ALM scripts set `ALM_ALLOW_PUSH=1` to pass through.

```
  Blocked: direct push to 'prod'.
  Override for an emergency:  ALM_ALLOW_PUSH=1 git push ...
```

To get server-side enforcement, make the repo public or upgrade to GitHub Pro; the workflow
does not otherwise change.

## Standing up a new environment

1. Create the environment.
2. Import the managed solution.
3. Create/assign a security role granting privileges on `cr922_managedappinventory`
   (see "Access" below).
4. `git checkout test` (or `prod`)
5. `ms app init --display-name "Managed Apps Inventory" --environment-id <id> --repo native`
6. `ms app add data-source --connector shared_commondataserviceforapps --as table --table cr922_managedappinventory --use-sso`
7. `git remote rename origin env-test` — `ms app init` adds its repo as `origin`
8. Fill in `alm.config.json` (`environmentId`, `appId`, `dataverseUrl`, `provisioned: true`)
9. `npm run alm:bootstrap -- test` — a new platform repo ships its own unrelated
   "Initial commit", so the first push is rejected until the histories are joined
10. Commit on that branch, then `npm run alm:deploy -- test`

Author tooling on `dev` and promote it. Committing scripts directly on an environment branch
causes avoidable `package.json` conflicts at the next promotion.

`alm:deploy` blocks on any environment marked `provisioned: false`.

### Unprovisioned branches have no `ms.config.json`

`test` and `prod` deliberately ship without that file until their environment exists, so a
stray `ms app deploy` on those branches fails loudly instead of quietly deploying to sandbox.
`npm run build` does not need the file, so CI still passes.

One consequence: once an environment is provisioned and `dev`'s binding later changes (for
example after re-registering the app), promoting `dev -> test` can raise a modify/delete
conflict on `ms.config.json`. Always keep the target branch's copy — `alm:promote` verifies
this and aborts if the merge would introduce another environment's binding.

## Access: two independent gates

`ms.config.json` stores **no connection GUID** and the data source uses `--use-sso`, so each
user connects to Dataverse **as themselves**. The table is `UserOwned`.

```
ms app share        →  can the user open the app?
Dataverse role      →  can the user see any data?
```

Sharing does not grant data access. A shared user without privileges on
`cr922_managedappinventory` loads the app and then hits an error on first read. You will not
notice this in sandbox as System Administrator, because you implicitly hold every privilege.

## What is automated, and what is not

`ms auth login` supports only interactive browser and device-code sign-in — **there is no
service principal or client-secret option**. So `ms app deploy` cannot run in GitHub Actions
today.

| | Where |
| --- | --- |
| Build, typecheck, lint | GitHub Actions, on every PR |
| `ms.config.json` untouched in promotion PRs | GitHub Actions |
| `dev → test → prod` order enforcement | GitHub Actions |
| Deploy | Local, `npm run alm:deploy` |
| Solution export/import | Local, `npm run alm:solution` |
| Direct push to test/prod | Blocked by `.githooks/pre-push` |

If service principal auth ships for the CLI, deploy can move into CI with no change to the
branching model.
