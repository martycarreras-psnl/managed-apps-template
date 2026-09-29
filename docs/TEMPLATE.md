# How this template is structured and maintained

## Two categories of file

**Shared scaffolding** — identical in every project, listed in
`alm.config.json → scaffold.paths`:

```
scripts/alm/              the ALM tooling
.githooks/                pre-push protection
.github/workflows/ci.yml  build, lint, promotion guards
docs/ALM.md               the promotion model
.gitattributes            pins ms.config.json per branch
.github/skills/managed-apps-devkit/   agent menu + playbooks for every developer task
AGENTS.md                 entry point every coding agent reads; points to setup + devkit
```

**Project content** — yours to replace:

```
src/                      the app
generated/                typed services (CLI-generated)
.ms/schemas/              connector schemas (CLI-generated)
solutions/                managed solution artifacts
ms.config.json            environment binding, per branch
alm.config.json           environment map + app identity
```

The scaffolding carries **no project-specific values**. Everything it needs — table name, role
name, environment IDs, solution name — comes from `alm.config.json`. That is what lets the same
scripts serve every project.

## Never shared

`alm.config.json → scaffold.neverShare` lists files that must never travel into the template:

```
ms.config.json  solutions/  memory-bank.md  app_generated_plan.md  .env
```

`alm:template push` refuses to push if any of them appear in the template checkout. This matters
because the template is **public** while the projects using it are typically private —
`ms.config.json` alone would expose environment and app IDs.

## Where the template comes from

Every file in this template is authored in one private **ALM source repo**, the repo whose
`alm.config.json` has `scaffold.source: true`, and published from there with
`npm run alm:template -- push`. **Don't edit the template directly:** the next publish overwrites it,
and a publish stops if the template holds a file the source repo doesn't manage.

```
   ALM source repo  ── alm:template push ──▶  template (tagged)  ── alm:upgrade ──▶  projects
```

The source repo's `alm.config.json → scaffold` says what travels:

| List | Published to the template | Pulled into projects by `alm:upgrade` |
| --- | --- | --- |
| `paths` — shared scaffolding | Yes | Yes |
| `publishOnly` — docs site, reference app, README, build config | Yes (a path, or `{ "from", "to" }`) | No |
| `alm.config.json` itself | Yes, minus `source` and `publishOnly` | No |

- **Projects can't publish.** `alm:template push` refuses unless `scaffold.source` is `true`.
- **The source repo never deploys an app.** Its `alm.config.json` becomes the template's, so every
  environment stays unprovisioned; a publish refuses if one carries an ID or org URL.
- **The source repo doesn't run `alm:upgrade`** (it refuses): it is where the template comes from.

Versioning is by git tag (`scaffold-v1.2.0`) with `scaffold.version` recorded locally, so
`alm:upgrade` can report *"you are on 1.0.0, template is at 1.3.0."*

## Changing the template

1. Make the change in the ALM source repo. If you found the problem in a project, port the fix
   there. A fix left only in a project is reverted by that project's next `alm:upgrade`.
2. Verify it: build and lint in the source repo, and exercise anything that needs live
   environments in a project.
3. Review what will change: `npm run alm:template -- status`.
4. Publish it:
   ```bash
   npm run alm:template -- push --bump patch --message "fix(alm): ..."
   ```
5. Commit the `alm.config.json` version bump that `push` writes back, and push the source repo.
6. Projects pick it up with `npm run alm:upgrade`.

**User-facing changes need the guides updated too.** If the change adds something a user can
do (a devkit menu item, an `alm:*` command or flag, a script, a workflow), update
`docs/index.html#ask` (a copyable phrase) and the matching section of `docs/guide.html` in the
same release. Newcomers learn what's possible from those pages, not from the code.

### Releases

`--bump patch|minor|major` derives the next version **and** its tag, and writes the version into
the same template commit the tag points at. That pairing matters: a tag alone does not move the
number consumers compare against, so tagging without bumping publishes a release nobody detects
as new.

| Flag | Result |
| --- | --- |
| `--bump patch` | `1.1.0` → `1.1.1`, tags `scaffold-v1.1.1` |
| `--bump minor` | `1.1.0` → `1.2.0`, tags `scaffold-v1.2.0` |
| `--bump major` | `1.1.0` → `2.0.0`, tags `scaffold-v2.0.0` |
| `--tag scaffold-v1.2.3` | Explicit version; must match `scaffold-vX.Y.Z` |
| *(neither)* | Syncs files without cutting a release |

`push` refuses to re-cut an existing tag. Moving a published tag breaks consumers: `git fetch
--tags` aborts on a moved tag, which is why `alm:upgrade` fetches with `--force`.

Semver guidance: patch for fixes, minor for new commands, **major when a project must act** —
for example a new required field in `alm.config.json`.

## Adding a new file

Shared with every project: add it to `scaffold.paths`. Template-only: add it to
`scaffold.publishOnly`. `alm:template` checks that every listed path exists and that none overlaps
`neverShare`. A publish also stops if the template contains a file neither list covers; pass
`--prune` to delete such files from the template instead.

## Why not an npm package?

A versioned package would be the conventional answer, but git remotes need no registry, no
publish step, and no auth beyond what the repos already have — and they work when the template is
public and the consumers are private. If publishing ever becomes worthwhile, the allowlist is
already the package boundary.
