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

## Keeping projects and template in step

```
   project repo  ──  alm:template push ──▶  template (tagged)
                 ◀──  alm:upgrade      ──
```

Both directions operate only on the allowlist:

- **`alm:upgrade`** — `git checkout <ref> -- <scaffold paths>`. Cannot touch your `src/`,
  `ms.config.json`, or `solutions/`.
- **`alm:template push`** — copies the same paths into a template checkout, asserts sterility,
  then commits and optionally tags.

Versioning is by git tag (`scaffold-v1.2.0`) with `scaffold.version` recorded locally, so
`alm:upgrade` can report *"you are on 1.0.0, template is at 1.3.0."*

The project where scaffolding is developed should also run `alm:upgrade` periodically, so it
never drifts from what everyone else receives.

## Changing the scaffolding

1. Make the change in a project repo, where it can be exercised against real environments.
2. Verify it.
3. `npm run alm:template -- push --message "..." --tag scaffold-vX.Y.Z`
4. Downstream projects pick it up with `npm run alm:upgrade`.

Use semver: patch for fixes, minor for new commands, **major when a project must act** — for
example a new required field in `alm.config.json`.

## Adding a new scaffold file

Add the path to `scaffold.paths`. `alm:template` and `alm:upgrade` validate that no scaffold path
overlaps `neverShare` and that every path exists, so a typo fails immediately rather than
silently shipping nothing.

## Why not an npm package?

A versioned package would be the conventional answer, but git remotes need no registry, no
publish step, and no auth beyond what the repos already have — and they work when the template is
public and the consumers are private. If publishing ever becomes worthwhile, the allowlist is
already the package boundary.
