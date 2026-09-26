# Build

Work on a feature branch cut from the first environment branch (`dev`), not on
`test`/`prod`. Author tooling changes on `dev` too — committing them directly on
an environment branch causes `package.json` conflicts at the next promotion.

```bash
git checkout -b feature/<name> dev
```

## Local

```bash
ms app dev          # hot reload; prints a local URL and an App Player URL
```

- Run it async / in a terminal canvas and hand the user the **App Player URL**
  (that is the one with real connector auth).
- `ms app dev` uses the connections of the environment in `./ms.config.json` —
  on `dev` that is the dev Dataverse.

## Data source

Delegate to the plugin skill; don't hand-write connector code.

- Dataverse table → **`microsoft-managed-apps:add-dataverse`**
- Anything else → **`add-data-source`** (discovers the connector, table vs action mode)

Useful direct commands:

```bash
ms connector list --only-allowed --search <text> --json      # what tenant policy allows
ms connector list-actions --connector <api-id> --json        # actions + policy
ms app add data-source --connector shared_commondataserviceforapps --as table --table <logicalname> --use-sso
ms app refresh data-source ...                                # after a schema change
ms app remove data-source ...
```

Rules: use generated services under `generated/` — no raw `fetch`/`axios`.
Shared connections need `allowedActions`. `--use-sso` means users connect as
themselves (so they also need a Dataverse role — [access.md](access.md#role)).

## Schema

Tables and columns are Dataverse solution components, promoted separately from
code (see `docs/ALM.md → The two tracks`).

1. Make the change in the **dev** environment — `dv-metadata` skill, or the
   maker portal. Keep changes **additive** (new nullable columns); they are
   the only kind that roll back safely.
2. Ensure the component is in the solution named in `alm.config.json → solution.uniqueName`.
3. Refresh the app's data source if the table shape changed, rebuild, test locally.
4. Export the managed solution into the repo and commit it with the code:
   ```bash
   npm run alm:solution -- export --bump build     # build|patch|minor|major
   git add solutions/ && git commit -m "feat(schema): ..."
   ```
5. New table? Add it to `alm.config.json → solution.tables` and update the role
   (`npm run alm:role -- create` is idempotent).

Required-ness: a column marked *Business required* in Dataverse is enforced on
save by Dataverse, but the UI only shows it as required if the form code does —
update the form too.

## Tests

```bash
npm run build          # typecheck + bundle — what the cloud build runs
npm run lint
npm run test:e2e       # Playwright; first time: npm run test:e2e:login to capture auth
```

Passkey/FIDO-only accounts cannot sign in under automation; use a password or
Authenticator account for e2e.

## Settings

```bash
ms app get-settings
ms app set-setting --help           # e.g. --show-header false
```

Settings are written to `ms.config.json` on the **current branch** and take
effect on the next `ms app dev` / deploy. Because `ms.config.json` is pinned per
branch, change each environment's settings on its own branch.
