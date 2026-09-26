# Import existing source code and convert it to a Managed App

`ms app init` registers an app and writes `ms.config.json` for a project that
already exists. **It does not modify the code.** Whether the result can ship
depends on the code meeting the runtime's constraints, so assess first.

## 1. Get the code in place

- ZIP: extract into an **empty working folder** outside the repo first, so you
  can inspect before merging anything.
- Git URL: `git clone <url> <folder>`.
- Existing standalone Managed App: `ms app clone`.

## 2. Assess (read-only, report before changing anything)

Check in parallel and give the user a short verdict table:

| Check | How | Blocking? |
| --- | --- | --- |
| Builds to static files with an `index.html` | `package.json` scripts; framework (Vite, CRA, Angular, Next *static export*, plain HTML) | **Yes** — server runtimes (Express, Next SSR, Flask, .NET) cannot run in the Managed Apps host |
| Build command and output dir | e.g. `npm run build` → `dist/` or `build/` | Sets `--build-command` / `--build-path` |
| Data access | grep for `fetch(`, `axios`, SDK clients, API keys, MSAL | Usually the main work — see step 4 |
| Secrets in code / `.env` | grep for keys, connection strings | Must be removed; never commit them |
| Node version | `engines`, lockfile | CLI needs Node 22+ |
| Routing | client-side router base path | Hash or relative routing is safest (*unverified* for history routing) |

If a blocker exists, stop and propose the options (e.g. move server logic to a
connector, Power Automate flow, or Dataverse) instead of forcing it.

## 3. Choose the target

- **Template project with ALM** (recommended for anything shared): create the
  project per [create.md → Template](create.md#template) with `--fresh`, then
  copy the imported `src/`, `public/`, and assets in. Merge `package.json` **by
  hand**: keep the template's `alm:*` scripts and devDependencies, add the app's
  dependencies. Keep the template's `vite.config.ts` unless the app needs
  something specific.
- **Standalone**: register the imported folder directly:
  ```bash
  ms app init --display-name "Imported App" --environment-id <id> --repo native \
    [--build-command "npm run build"] [--build-path ./build] [--build-entry-point index.html]
  ```

## 4. Rewire data access

Replace direct API calls with connector-backed generated services:

1. For each external system the code calls, find the connector:
   `ms connector list --search <name> --only-allowed --json`.
2. Add it with the plugin's **`add-data-source`** skill (or the
   service-specific `microsoft-managed-apps:add-*` skill). This generates
   typed services under `generated/`.
3. Swap call sites to the generated services. Delete API keys and custom auth.
4. Shared connections must declare least-privilege `allowedActions` or deploy fails.

If there is no connector for a system, say so; do not invent a workaround.

## 5. Verify and ship

```bash
npm install && npm run build            # must pass from a clean clone
ms app dev                              # exercise every screen that touched data
```

Then deploy: template → [ship.md → Dev](ship.md#dev); standalone → commit,
`git push`, `ms app deploy`. **Confirm before registering and before deploying.**

**Done when** the app loads on its Play URL with real data. Note in
`memory-bank.md` what was rewired and what was dropped.
