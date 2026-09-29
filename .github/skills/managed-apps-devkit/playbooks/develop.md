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
  (that is the one with real connector auth). Tell them to open it in **Chrome
  or Edge**; it doesn't work in an agent's side-panel browser.
- `ms app dev` uses the connections of the environment in `./ms.config.json` —
  on `dev` that is the dev Dataverse.

## Connectors

Before building on a connector or MCP server, confirm that policy allows it
**in every environment the app will ship to**. Policy is per environment:
allowed in dev does not mean allowed in prod.

**Browse what exists** (public catalogs, kept current by Microsoft):

- All connectors: <https://learn.microsoft.com/en-us/connectors/connector-reference/>
  - Power Apps only: <https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-powerapps-connectors>
- All MCP servers: <https://learn.microsoft.com/en-us/connectors/connector-reference/connector-reference-mcpserver-connectors>

Being listed in a catalog doesn't mean you can use it. The CLI check below
decides that for your environment.

**Check it for real**, once per environment. Take the environment IDs from
`alm.config.json → environments.<stage>.environmentId`, or
`ms.config.json → environmentId` for a standalone app:

```bash
ms connector list -e <env-id> --search <text>                      # Policy Status: Allowed / Blocked
ms connector list -e <env-id> --only-allowed --json                # everything policy allows
ms connector list-actions --connector <id> -e <env-id> --search <text>   # Behavior + Action ID per action
```

- **Always pass `-e`.** Without it the CLI checks your *personal developer
  environment*, which may have different policy. Run it from outside the project,
  or with an explicit `-e`, so you know which environment is being checked.
- Run the checks for all environments in parallel. Show one table: rows are
  connector or action, columns are environments. Flag any cell that isn't
  Allowed.
- Use the **Connector** column as the ID, for example `office365`. Put the
  **Action ID**s from `list-actions` into `allowedActions` in `ms.config.json`
  (shared connections). Request only the actions `src/` actually calls.
- What this proves: policy allows the connector. What it doesn't prove: that a
  connection exists or that users can reach the data. Confirm those by adding
  the data source and testing with `ms app dev` in each environment.
- If it's blocked anywhere, stop and tell the user. The environment's admin
  controls this through the data policy in the Power Platform admin center.
  Don't work around it.

## Data source

Delegate to the plugin skill; don't hand-write connector code. Run the checks
in [Connectors](#connectors) first.

- Dataverse table → **`microsoft-managed-apps:add-dataverse`**
- Anything else → **`add-data-source`** (discovers the connector, table vs action mode)

Useful direct commands:

```bash
ms connector list -e <env-id> --only-allowed --search <text> --json   # what policy allows there
ms connector list-actions --connector <api-id> -e <env-id> --json     # actions + policy
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

0. **First table only:** create the publisher and solution before the table,
   so the table gets the right prefix and lands in the solution:
   ```bash
   npm run alm:solution -- create     # safe to re-run; reuses what exists
   ```
   It uses `alm.config.json → solution.publisherPrefix` and `uniqueName`, and
   needs `environments.dev.dataverseUrl` (set by `alm:init`).
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
