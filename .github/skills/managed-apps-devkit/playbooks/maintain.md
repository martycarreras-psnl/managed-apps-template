# Maintain

## Sync

```bash
npm run alm:sync -- --check     # report drift per branch/remote; exit 1 if any
npm run alm:sync                # push every provisioned branch to github + its platform repo
```

Never force-pushes. A remote *ahead* of local is reported, not overwritten — in
that case fetch and inspect before doing anything. Tree must be clean.

## Upgrade

Pull shared scaffolding (`alm.config.json → scaffold.paths`, which includes
this skill) from the template. Your `src/`, `ms.config.json` and `solutions/`
are never touched.

```bash
npm run alm:upgrade -- --check                  # what would change
npm run alm:upgrade [-- --tag scaffold-vX.Y.Z]  # apply, on dev, clean tree
```

Then build, commit on `dev`, and promote like any change.

**Never upgrade while you have unpublished scaffold edits** — `alm:upgrade`
replaces those paths wholesale and silently reverts them. Publish first.

## Publish

Push scaffold changes made in this project **up** to the template. Order:
fix here → verify → publish → upgrade.

**Confirm first** — the template is public.

```bash
npm run alm:template -- status
npm run alm:template -- push --bump patch --message "fix(alm): ..."   # patch|minor|major
git commit -am "chore: scaffold vX.Y.Z"                               # the version bump written back
```

`push` copies only `scaffold.paths`, refuses if anything in
`scaffold.neverShare` would travel, and never re-cuts an existing tag. Before
publishing, make sure no environment ID, app ID, org URL or UPN appears in the
scaffold paths (`git grep` for them).

Semver: patch = fix, minor = new command/playbook, major = projects must act
(e.g. a new required `alm.config.json` field).

## Delete

**Confirm twice** — name the app, its ID and environment, and that it is live.

```bash
ms app info --app <appId> --json           # show the user exactly what will go
ms app delete --app <appId>                # soft-delete; add --force to skip the prompt
```

If it belongs to an ALM stage, follow [environments.md → Retire](environments.md#retire)
too, and update `memory-bank.md`.
