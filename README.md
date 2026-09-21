# kubiq

A desktop Kubernetes cluster management console — a replacement for Lens — built with
**Wails 3 + Go + Vue 3**.

## Stack

| Layer | Technologies |
|---|---|
| Shell | Wails 3 (alpha), Go 1.25, system tray with close-to-tray |
| Frontend core | Vue 3.5, TypeScript 6, Vite 8 |
| Components | class based (`@iappx/vue-facing-di`): `@Component` / `@Prop` / `@VModel` / `@Watch` |
| DI | `tsyringe` (`@inject`, `@injectable`, `@singleton`) |
| State | Pinia plus a project `StoreBase`, events over `EventBus` (mitt) |
| Routing | `vue-router` with declarative route classes (`@RoutePage`, `@RouteTitle`, `@MenuIncluded`) |
| UI | Tailwind CSS 4, reka-ui, `@lucide/vue`, motion-v; light and dark themes |
| Data | `@iappx/entity-repo` + `entity-repo-query` + the REST dialect `entity-repo-rest` over the Go client |
| Tests | Vitest (jsdom), mocked only at the bindings boundary |

## How the two halves split

The Go side is a **thin client**: it performs mechanical acts — open a TLS session, send an
HTTP request, hold a stream, run a process — and knows nothing about Kubernetes. There is no
API path, no resource name and no kubeconfig parsing in Go.

Everything about the data — which endpoint, what the payload means, how it maps onto entities,
how a failure reads — lives in the frontend, behind `@iappx/entity-repo`. Adding an endpoint is
a frontend change: no rebuild of the binary, no regenerated bindings.

Credentials are the one thing Go holds on to: the frontend hands it a flat connection
specification and Go builds the TLS client from it, so certificates and tokens never travel
back out.

## Quick start

```bash
cd frontend && npm install
```

```bash
wails3 task bindings
```

```bash
wails3 task dev
```

## Commands

| Command | What it does |
|---|---|
| `wails3 task dev` | Runs the app in development mode (Go + Vite with hot reload) |
| `wails3 task build` | Builds the app for the current OS |
| `wails3 task package` | Production build with packaging (installer / nfpm / msix) |
| `wails3 task bindings` | Regenerates the TS bindings after a Go service signature changes |
| `go build ./core/... .` | Builds the Go side |
| `go vet ./core/...` | Static analysis of the Go side |
| `go test ./core/...` | Go tests |
| `npm run typecheck` | `vue-tsc --noEmit` (from `frontend/`) |
| `npm run build` | Type check plus production build of the frontend |
| `npm test` | Vitest (from `frontend/`) |
| `npm run lint` | ESLint over `src/` |

> `go build ./...` also compiles `build/ios`, which needs an iOS toolchain — use
> `go build ./core/... .`.

> The standalone `task` binary is not required: `wails3 task` runs the same Taskfiles.

## Structure

```
main.go                     Wails entry point: window, tray, the list of bound Go services
core/
├── services/io/            IoService — file operations
├── services/env/           EnvService — environment variables, home directory, path expansion
├── services/kube/          connection sessions, TLS, generic HTTP, watch and log streams
├── services/process/       ProcessService — external processes, streams, PTY (ConPTY)
├── services/channel/       WebSocket channels (exec/attach) and port forwarding
├── tray/                   system tray and close-to-tray
└── utils/                  paths and byte-range parsing
build/                      packaging assets and Taskfiles per OS
frontend/
├── bindings/               generated TS bindings — never edit by hand
├── src/
│   ├── domain/             entities, resource kind registry, discovery, events — no Vue, IO or DI
│   ├── application/        use-case services (a folder per service) and event handlers
│   ├── infrastructure/     entity contexts, transports over the bindings, event bus, adapters
│   ├── store/              Pinia stores
│   ├── components/         Vue components
│   ├── containers/         application shell (Sidebar, TopNav)
│   ├── views/              pages and route classes
│   └── lib/                framework scaffolding: router, vue-store, validation, utilities
└── test/                   Vitest, grouped by layer
```

## Application identity

Name, company, description, identifier and version live in `build/config.yml` — the source of
truth for packaging. After editing it:

```bash
wails3 task common:update:build-assets
```

That regenerates the assets under `build/`. The window and tray name are constants in
`main.go`; the name shown in the interface is `VITE_APP_NAME` in `frontend/.env`; the colours
are the `--primary` / `--accent` / `--ring` tokens in
`frontend/src/assets/styles/css/index.css`, mirrored by the static splash in
`frontend/index.html`.

The rules every change in this repository must follow are in [CLAUDE.md](CLAUDE.md).
