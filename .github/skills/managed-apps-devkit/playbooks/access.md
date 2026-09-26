# Access

Two **independent** gates. Users need both:

```
ms app share          → can the user open the app?
Dataverse role        → can the user see any data?      (only if the app uses Dataverse)
```

Apps bound with `--use-sso` connect **as the user**, so sharing alone yields an
app that opens and then errors on first read. System Administrators never
notice, because they implicitly hold every privilege.

Access is **per app**, so per environment: sharing the `[TEST]` app grants
nothing on `[PROD]`. Take each stage's `appId` from `alm.config.json`.

## Share

**Confirm first**, listing who gets what on which app.

```bash
ms app share alice@contoso.com,bob@contoso.com --app <appId>                # play (default)
ms app share alice@contoso.com --app <appId> --access edit                  # contributor
ms app share <group-object-id> --app <appId> --access test                  # test operator
ms app unshare alice@contoso.com --app <appId>
```

Groups and service principals: use **Entra object IDs** (not the application/client ID).
Prefer groups for anything beyond a handful of people.

## Link

A tenant-wide link granting *Microsoft App Reader* (play) to whoever redeems it.

```bash
ms app share link create --app <appId> --json
ms app share link list   --app <appId> --json
ms app share link revoke --app <appId> --link-id <id>   # id from list
```

**Confirm first** — anyone in the tenant with the link can open the app.

## Role

The role is defined in `alm.config.json → app.securityRole` and ships inside the
managed solution, so it exists in every environment the solution is imported into.

```bash
npm run alm:role -- create       # dev only: create/update the role and add it to the solution
npm run alm:role -- show [env]   # privileges in an environment
```

After changing the role: export the solution and promote it
([develop.md → Schema](develop.md#schema)).

**Assigning** the role to users or teams is per environment: delegate to the
**`dv-security`** skill, or the admin center (Environment → Settings → Users /
Teams). Assigning to an Entra-group team scales best.

## Who

```bash
ms app share list --app <appId> --json
ms app share link list --app <appId> --json
npm run alm:role -- show <env>
```

Present one table per environment: principal, access level, and whether the
role is held (if you checked it).
