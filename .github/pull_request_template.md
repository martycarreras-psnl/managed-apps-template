## What and why

<!-- What does this change, and why is it needed? Link the issue it fixes (Fixes #123). -->

## Area

- [ ] `alm:*` scripts
- [ ] Devkit skill or playbooks
- [ ] Git hooks or CI
- [ ] Reference app
- [ ] Guides (docs site, README, `docs/ALM.md`)

## How you tested it

<!-- Commands you ran and what you saw. If it deploys, promotes or talks to Dataverse, say which kind
of environment you used. Never paste environment, tenant or app IDs. -->

## Checklist

- [ ] `npm run build` and `npm run lint` pass
- [ ] `node --check` passes on every modified `.mjs` file
- [ ] No secrets, credentials, or environment, tenant or app IDs in the diff
- [ ] Conventional commit messages (`fix:`, `feat:`, `docs:`, `chore:`)
- [ ] User-facing changes update the matching guide (`docs/advanced.html` `#ask`, `docs/grow.html` `#start` if it applies without Dataverse)

<!-- This repository is published from a separate ALM source repo. A maintainer ports accepted
changes there and publishes a tagged release; see CONTRIBUTING.md. -->
