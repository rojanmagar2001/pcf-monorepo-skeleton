# document-intake

A pnpm monorepo for a Power Apps Component Framework (PCF) control, the generated
API client it talks to, the presentation library they share, and the intake shell
they both render — which doubles as a web harness, so UI work needs no Dataverse
environment.

```
apps/document-intake-web   The intake shell: a Vite + React 18 SPA *and* the
                           component the control renders
pcf/documentintake         PCF control, built exclusively by pcf-scripts
packages/api-client        Generated types, zod schemas, react-query hooks
packages/ui                Presentation components + Tailwind styles only
```

## Layering

```
        ui ──────► api-client (types + generated hooks)
        web ─────► ui + api-client
        pcf ─────► web ──► ui + api-client
        api-client ──► (nothing internal)
```

### One shell, two hosts

`apps/document-intake-web` is not only a harness. It has two entry points:

| Entry | Built by | Consumed by |
| --- | --- | --- |
| `src/main.tsx` | Vite → `dist-app/` | the browser, against MSW |
| `src/index.ts` | tsup → `dist/` | `pcf/documentintake`, bundled into the control |

Both mount the same `<App>`. The control does not render a tree of its own —
`index.ts` renders `App` from `@document-intake/web` and supplies what only a
host can: the api config (routed through `ComponentFramework.WebApi` rather than
the network), the QueryClient, the page size off the dataset binding, and the
`onStateChange` callback that becomes `notifyOutputChanged`. Nothing about the
host is assumed inside `App`; every such concern is a prop, down to the copy in
the header, so the MSW strapline stays in `main.tsx` where it is true.

The hazard this creates is MSW: `main.tsx` and the tests import `src/mocks/*`
legitimately, and if the *library* entry ever reached them the mock service
worker would ship inside the control and intercept the host's own requests. Two
checks stand in the way — `src/purity.test.ts` walks the real import graph from
`src/index.ts` and fails if it reaches `main.tsx`, `mocks/`, `msw`, or any bare
specifier outside the control's dependency set; and `check-bundle.mjs` greps the
shipped bundle for MSW's own runtime markers.

`packages/ui` has no fetching logic of its own and declares no DTOs — every
domain type is inferred from the generated zod schema. A test enforces this
(`packages/ui/src/purity.test.ts`).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm build` | Builds every package in dependency order, then asserts the control bundle is host-safe |
| `pnpm test` | Vitest (api-client, ui, web) + Jest (control) |
| `pnpm lint` / `pnpm format:check` | Biome, repo-wide |
| `pnpm typecheck` | `tsc --noEmit` per package |
| `pnpm dev` | Web harness on :5173, backed by MSW |
| `pnpm build:libs` | Builds just what the control consumes: api-client, ui, web |
| `pnpm storybook` | Storybook on :6006 |
| `pnpm --filter api-client generate` | Regenerates `src/generated/` from `openapi.json` |
| `pnpm verify:generate` | Regenerates and fails if the working tree is dirty |

## PCF compatibility constraints

The control is a **standard** control that bundles its own React 18. It declares
no `platform-library`, because doing so would pin it to the host's React 16.14.

Everything the control imports obeys these rules, and each is enforced rather
than documented and hoped for:

| Constraint | Enforced by |
| --- | --- |
| Single bundle: no `import()`, `React.lazy`, code splitting, workers, top-level await | `scripts/check-bundle.mjs`, `packages/*/src/purity.test.ts`, webpack's `LimitChunkCountPlugin` |
| No `process.env` / `import.meta.env` / Node built-ins in `ui`, `api-client` and the `web` library entry | `purity.test.ts` in all three, Biome's `noNodejsModules` |
| No MSW in the control bundle | `apps/document-intake-web/src/purity.test.ts` (import graph) + `check-bundle.mjs` (shipped bundle) |
| No axios, no polyfills — native `fetch` or an injected fetcher | `check-bundle.mjs`, `verify-generated.mjs` |
| Exactly one copy of `@tanstack/react-query` | `check-bundle.mjs` (bundle) + `check-single-react-query.mjs` (install) |
| No side-effect CSS imports in library source | `purity.test.ts`; the stylesheet is a string, not an import |
| ESM + `.d.ts`, `target: es2017`, `sideEffects: false` | `tsup.config.ts` in `ui`, `api-client` and `web` |
| No global singletons — QueryClient, state and portals are per instance | `ApiProvider`, `createQueryClient()`, control lifecycle tests |
| Portals mount in the control's container, never `document.body` | `UiRoot`'s portal host; asserted in `UiRoot.test.tsx` and `purity.test.ts` |

The control's `build` script clears `out/` before running, because pcf-scripts
exits 0 even when webpack fails to compile. Without that, a failed control build
would leave the previous bundle behind for `check-bundle.mjs` to certify, and
the whole pipeline would pass green on a control that does not compile.

`pnpm build` runs the **production** PCF build, which is the artifact a solution
ships. `check-bundle.mjs` refuses to certify a development build, because those
carry their dependencies' comments and a clean result would not mean what it
appears to. Use `pnpm --filter @document-intake/pcf-documentintake build:dev`
with `pcf-start` for debugging.

## Code generation

`packages/api-client/openapi.json` is the source of truth. Orval emits two
outputs from it in one pass:

1. `client: 'react-query'`, `httpClient: 'fetch'`, `mode: 'tags-split'`
2. `client: 'zod'` — request/response schemas, emitted alongside

Generated output lands in `src/generated/`, is **committed**, and is never
produced during `pnpm build` — pcf-scripts must not depend on codegen.
Regeneration is explicit, and CI regenerates and fails if the tree is dirty.

Hand-written on top: `customFetch` (the mutator), `createWebApiFetch`,
`createQueryClient`, `<ApiProvider>`, the query-key factory, and the zod
refinements. Generated modules are re-exported unmodified.

### Runtime configuration

Nothing reads the environment. `ApiClientConfig` (`{ baseUrl, fetchImpl?,
headers?, onError? }`) is injected by the host and reaches requests two ways:

- **Per instance (preferred)** — `<ApiProvider config={…}>` supplies it through
  React context, and `useApiRequestInit()` threads it onto each call as the
  generated hooks' `request` option. Two controls on one form can therefore hit
  different endpoints.
- **Ambient fallback** — `configureApiClient()` in `init()`, for call sites that
  do not thread a config. This is a reference-counted stack, not a single slot,
  so one instance being destroyed never pulls configuration out from under its
  siblings.

The same generated hooks serve both worlds: the harness passes plain `fetch`,
the control passes `createWebApiFetch(context)`, which routes through
`ComponentFramework.WebApi`.

## Tailwind

One config, `packages/ui/tailwind.config.ts`, consumed by the library build, the
web app and Storybook. There is no second config file.

```ts
corePlugins: { preflight: false }  // preflight would reset the host app
important: '.di-root'               // scopes + wins specificity fights
prefix: 'di-'
```

`UiRoot` applies `di-root`; the control and the web app both mount through it.
Because `important` makes utilities *descendant* selectors, `UiRoot` renders its
children inside an inner wrapper — the scope element itself cannot be styled by
utilities.

The stylesheet is compiled **out of band** by `packages/ui/scripts/build-styles.mjs`,
never through pcf-scripts' pipeline, and emitted as a string module:

- `dist/styles.css` — the compiled sheet
- `dist/styles.js` + `dist/styles.d.ts` — `export const uiStyles: string`

> The spec called for `dist/styles.ts`. It is emitted as compiled ESM + types
> instead, because the PCF webpack build cannot consume a `.ts` file from a
> dependency's `dist` — which is the very thing keeping postcss out of that
> build. The string export itself is exactly as specified.

The script also **fails the build** unless every rule is scoped under `.di-root`
and no preflight-style `*,::before` reset survives. That check earned its keep:
Tailwind emits its `@defaults` block as `*,::before,::after,::backdrop{…}` even
with preflight disabled, so the script rewrites those selectors into the scope
with postcss.

The control injects `uiStyles` into a `<style data-di-styles>` element in
`init()`, reference counted so N instances inject exactly once and it is removed
only when the last instance is destroyed.

## Toolchain

Vite 8 (Rolldown) drives the web app, Storybook's builder and Vitest's
transform. It is never introduced into `pcf/documentintake`.

The locked set was checked against each other's peer ranges rather than assumed:

| Package | Version | Peer range satisfied |
| --- | --- | --- |
| vite | 8.2.1 | — |
| vitest | 4.1.10 | `vite: ^6 \|\| ^7 \|\| ^8` |
| @storybook/react-vite | 10.5.9 | `vite: ^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| @vitejs/plugin-react | 6.0.5 | `vite: ^8` |

All three library builds — `ui`, `api-client` and `web`'s `src/index.ts` — use
**tsup**, not Vite library mode. `vite-plugin-dts` still
declares a `rollup: ">=3"` peer, and Vite 8 bundles with Rolldown — exactly the
plugin friction to avoid. They need only ESM + `.d.ts`, so the simpler tool
wins, and `target: 'es2017'` is set explicitly in each rather than left to Vite
7+'s `baseline-widely-available` default. Vite still builds the web app's SPA
entry, into `dist-app/`, so the two outputs never collide.

## Testing

| Package | Runner |
| --- | --- |
| `packages/api-client` | Vitest + MSW, with handlers derived from `openapi.json` |
| `packages/ui` | Vitest + Testing Library (+ Storybook, MSW addon) |
| `apps/document-intake-web` | Vitest + Testing Library (+ an import-graph purity test) |
| `pcf/documentintake` | Jest + ts-jest + jsdom, with a typed `ComponentFramework.Context` factory |

The MSW route table is built from the spec, and `assertContractCoverage()` fails
the suite if `openapi.json` grows an operation with no handler behind it.

The control's Jest environment (`test/jsdomWithPlatformGlobals.cjs`) adds the
platform globals jsdom omits — `fetch`, `Response`, `Headers`, streams. Without
them the webAPI adapter dies with `Response is not defined` and the tests
exercise an error path that cannot happen in a real host.

## Known deviations

Three places where following the brief literally would have produced worse code.
Each is commented at the site.

1. **`customFetch(url, options)`, not `(config, options)`.** With
   `httpClient: 'fetch'` orval calls the mutator with the resolved URL first;
   the `(config, …)` shape is the axios contract.
2. **`override.query` sets `signal`, not `useQuery: true`.** `useQuery: true`
   turns *every* operation into a query, so `updateDocumentStatus` would fire
   its PATCH on render; setting `useQuery` and `useMutation` together inverts
   the assignment instead. Orval's own verb routing is correct — GET becomes a
   query, everything else a mutation.
3. **`dist/styles.js` + `.d.ts` instead of `dist/styles.ts`** — see Tailwind above.

`pcf/documentintake/eslint.config.mjs` is a stub: pcf-scripts runs a fixed
ESLint step and fails without a config file. Biome is the linter for this
workspace, so the stub satisfies that step rather than introducing a second,
diverging rule set for one package.
