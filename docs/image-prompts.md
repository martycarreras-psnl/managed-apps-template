# Diagram prompts for GPT Image 2.5

Eight prompts for high-fidelity instructional diagrams covering the Managed Apps ALM model.
Each is self-contained — paste one in and go.

**How to use these**

- Every prompt repeats the same **style block** so the set looks like one family. Keep it.
- Generate at **16:9** unless noted. Prompts 4 and 6 work better at **4:3**.
- The callouts are the point. If a render drops them, re-run with
  *"ensure every numbered callout is legible and connected to its element with a thin leader
  line."*
- Text in generated images is often imperfect. Treat these as **illustrative diagrams**, not
  reference documentation, and keep `docs/guide.html` as the source of truth.

---

## Shared style block

> **Style:** Clean technical architecture diagram, dark UI aesthetic. Background `#0f0d14`.
> Cards `#1e1b26` with 1px borders `#322d3d` and 12px rounded corners. Accent violet `#aa3bff`,
> dev blue `#6fb4ff`, test amber `#ffb454`, prod green `#3ddc97`. Body text `#e8e6ee`,
> secondary `#a29ead`. Clean geometric sans-serif (Inter or similar); monospace for identifiers.
> Generous whitespace, precise 1.5px connector lines with small arrowheads. Flat vector — no
> skeuomorphism, no drop shadows, no 3D, no stock-photo people. Numbered circular callout badges
> in accent violet with thin leader lines. Crisp, high fidelity, poster quality.

---

## 1 — System overview (hero)

> Wide technical architecture diagram titled **"The app and the solution travel different
> paths."** The diagram is split into **two clearly separated horizontal bands**, each enclosed
> by its own thin dashed rounded border.
>
> **UPPER BAND — labelled "TRACK A — THE APP (code)"**, three columns:
> *YOUR MACHINE* → *PLATFORM GIT REPO* → *RUNTIME HOST*.
> Left: three stacked branch cards, colour-coded dev blue, test amber, prod green, each showing
> a small `ms.config.json` file tag and a truncated app ID.
> Middle: three separate git repository cards labelled `env-dev`, `env-test`, `env-prod`, each
> captioned "hosted at that environment's endpoint · cloud build runs here".
> Right: all three lanes converge with smooth curved arrows into **one tall rounded panel**
> outlined in violet labelled `play.managedapps.cloud.microsoft`, subtitled "one shared host ·
> three app IDs · where users open the app".
>
> **LOWER BAND — labelled "TRACK B — THE SOLUTION (schema)"**, a single left-to-right row:
> three environment cards (dev blue, test amber, prod green), each containing a Dataverse
> database icon. Dev reads "solution: unmanaged · authored here"; test and prod read
> "solution: managed · locked" with a small padlock. Violet arrows between them labelled
> "export" then "import".
>
> **Connecting the bands:** three thin dashed colour-matched curves drop from the runtime panel
> down to their *own* environment card — blue to dev, amber to test, green to prod. These must
> read as runtime data connections, clearly different in weight and style from the solid
> deployment arrows above.
>
> Two summary boxes along the bottom: one outlined in red reading **"The app never passes
> through here — no build artifact is imported into Dataverse. Only the solution is."**, and one
> neutral reading **"At runtime, not at deploy time — each app reads only its own environment's
> Dataverse, resolved from connection references."**
>
> Callouts:
> 1. "The app is registered in an environment, but served from a shared host — it is never
>    deployed into the environment"
> 2. "Each environment provisions its own git repo; the cloud build runs there"
> 3. "The solution is the only artifact that enters a Power Platform environment"
> 4. "The two paths meet only at runtime, through connection references"
>
> Style: [shared style block]

---

## 2 — `ms.config.json` is the environment selector

> Technical diagram titled **"The file that decides where your app deploys."**
>
> Centre: a large rounded card representing `ms.config.json`, shown as a JSON snippet with two
> highlighted lines: `"appId": "e2ca41f8…"` and `"environmentId": "b82681f2…"`.
>
> Left: a terminal card showing the command `ms app deploy` with a red crossed-out flag
> `--environment-id` beside it and the label "does not exist".
>
> Right: three candidate environment cards (dev blue, test amber, prod green). A thick violet
> arrow runs from the JSON card to the **dev** card only; the other two are dimmed to ~35%
> opacity.
>
> Bottom: a warning strip in red `#ff5c7a` reading **"Wrong file on disk = deployed to the wrong
> environment."**
>
> Callouts:
> 1. "There is no --environment-id flag; the CLI trusts the file on disk"
> 2. "Each branch carries its own copy of this file"
> 3. "A merge driver pins it per branch so promotion never overwrites it"
>
> Style: [shared style block]

---

## 3 — Code and schema promote together

> Technical diagram titled **"Two things travel; both must arrive."**
>
> Two horizontal tracks running left to right across three stations labelled **DEV** (blue),
> **TEST** (amber), **PROD** (green).
>
> Upper track — **APP CODE**: a git commit node at each station, connected by arrows labelled
> `alm:promote`. All three commit nodes show the same short hash, emphasising that the identical
> commit moves forward.
> Lower track — **SCHEMA**: a solution package at each station. At dev it is an open unlocked
> box labelled "unmanaged · authored here". At test and prod it is a closed padlocked box
> labelled "managed v1.0.2". Arrows between them are labelled `export` then `import`.
>
> A vertical dashed bracket joins the two tracks at each station with the label **"versions must
> match"**.
>
> Callouts:
> 1. "The same commit deploys everywhere — only ms.config.json differs"
> 1b. "The code track never enters a Power Platform environment; only the schema track does"
> 2. "The managed solution zip is committed to the repo and verified by sha256"
> 3. "Deploy is blocked if the target's installed version does not match"
>
> Style: [shared style block]

---

## 4 — The schema drift guard *(4:3)*

> Terminal-focused diagram titled **"Blocked before anything ships."**
>
> A large realistic terminal window, dark, monospace, rounded corners. Inside, a sequence of
> check lines:
>
> ```
> ✓ on branch test
> ✓ working tree clean
> ✓ ms.config.json -> app 0cac2d24…
> ✓ connection references match this environment
> ✗ Schema drift: test has v1.0.1.0 but the repo ships v1.0.2.0.
>   Run: npm run alm:solution -- import test
> ```
>
> Green checkmarks for the passing lines, a bright red `✗` for the failure. A red horizontal
> stop-bar cuts across the terminal immediately below the failing line, with everything below it
> dimmed and labelled "push · build · deploy — never reached".
>
> To the right, a small before/after pair: a broken UI card showing "column not found" (dimmed,
> red outline) versus a healthy UI card (green outline), captioned "what the guard prevents".
>
> Callouts:
> 1. "Guards run in order, cheapest first"
> 2. "Failure happens locally — nothing was pushed"
> 3. "The fix is printed with the error"
>
> Style: [shared style block]

---

## 5 — Three apps, one admin list

> Technical diagram titled **"Dev, test and prod all land in the same place."**
>
> Left: three app tiles stacked vertically, colour-coded blue/amber/green, **all showing the
> identical name** "Expense Tracker" with different monospace app IDs beneath.
>
> Curved arrows from all three converge into a single large panel on the right, styled as an
> admin console table titled **"Microsoft 365 Admin Center → Apps"**. The table has exactly two
> columns: **NAME** and **APP ID**. It lists "Expense Tracker" three times with three different
> IDs, plus two other unrelated duplicate rows below.
>
> A red annotation arrow points at the three identical rows with the label
> **"no environment column"**.
>
> Below the table, a green "better" card shows the same list with names
> `Expense Tracker [DEV]`, `Expense Tracker [TEST]`, `Expense Tracker [PROD]` — clearly
> distinguishable.
>
> Callouts:
> 1. "Each environment produces a separate app registration"
> 2. "The admin surface is flat — nothing indicates environment"
> 3. "Only the clone URL encodes the environment ID"
> 4. "Fix: put the environment in the display name"
>
> Style: [shared style block]

---

## 6 — Two access gates *(4:3)*

> Technical diagram titled **"Sharing an app is not the same as granting data access."**
>
> A left-to-right flow: a user avatar icon → **GATE 1** → **GATE 2** → a green "works" endpoint.
>
> **GATE 1** is a violet-outlined portal labelled `ms app share`, subtitled "can they open it?".
> **GATE 2** is an amber-outlined portal labelled "Dataverse security role", subtitled "can they
> see data?".
>
> A second user path passes cleanly through gate 1 but strikes a red barrier at gate 2 and
> branches downward to a small app window showing a red error banner reading "failed to load
> records". Label this path **"shared, but no role"**.
>
> Bottom strip, red: **"As a System Administrator you pass both gates implicitly — you will not
> reproduce this."**
>
> Callouts:
> 1. "Two independent systems, checked at different layers"
> 2. "SSO means every user connects to Dataverse as themselves"
> 3. "The role ships inside the managed solution, so it promotes automatically"
>
> Style: [shared style block]

---

## 7 — Hotfix while work is in flight

> Git branch topology diagram titled **"Shipping a fix without shipping the half-built feature."**
>
> Three horizontal branch lines, top to bottom: `dev` (blue), `test` (amber), `prod` (green),
> with commit dots along each.
>
> On `dev`, three commits are drawn as hollow/dashed outlines labelled "feature in progress —
> not ready".
>
> A `hotfix/login-crash` branch (violet) splits **downward off `prod`** — clearly not off dev —
> with a single solid commit, then merges back into `prod`. A deploy rocket icon sits on prod
> immediately after the merge.
>
> Two dashed violet back-merge arrows run upward from `prod` into `test` and `dev`, labelled
> **"back-merge — the step teams forget"**.
>
> Callouts:
> 1. "Branch from prod, never from dev — that is what excludes in-flight work"
> 2. "Prod ships the fix alone"
> 3. "Back-merge, or the next promotion silently reverts it"
> 4. "App-only fixes roll back by redeploying the previous commit; schema does not"
>
> Style: [shared style block]

---

## 8 — Template propagation

> Technical diagram titled **"Improve once, propagate everywhere."**
>
> Centre-left: a repository card labelled **"your project"** containing two clearly separated
> zones — a violet-outlined zone labelled "shared scaffolding" (listing `scripts/alm/`,
> `.githooks/`, `.github/workflows/`, `docs/ALM.md`) and a grey zone labelled "your app"
> (listing `src/`, `ms.config.json`, `solutions/`).
>
> Centre-right: a repository card labelled **"public template"** with a version tag chip
> `scaffold-v1.2.0`.
>
> Two arrows between them: an upper arrow left→right labelled `alm:template push`, and a lower
> arrow right→left labelled `alm:upgrade`. **Both arrows originate from and terminate in the
> violet scaffolding zone only** — draw a thin dashed boundary showing the grey "your app" zone
> is untouched, with a small shield icon on that boundary.
>
> Far right: three smaller downstream project cards fanning out, each receiving a copy of the
> violet zone.
>
> Callouts:
> 1. "An allowlist defines exactly which paths are shared"
> 2. "Your app code and environment bindings can never be overwritten or leaked"
> 3. "The originating project consumes the template too, so it cannot drift"
>
> Style: [shared style block]
