# UI/UX brief — kubiq

## Status of this document

Binding for every screen, component and stylesheet in `frontend/`. It sits **below** `CLAUDE.md`
and **above** personal taste: where `CLAUDE.md` states a rule, that rule wins; everything
`CLAUDE.md` leaves open is decided here, and a deviation needs the repository owner, not an
argument in a pull request.

Read the section that covers what you are building **before** you write markup.

---

## 1. What this product is

A desktop Kubernetes console for operators who already know Kubernetes. They are not learning the
domain from us — they are looking for one pod among four hundred, reading its logs, and going back
to work. Everything below follows from that:

- **Density over comfort.** Screen real estate spent on padding is a row the operator cannot see.
- **Latency is the feature.** A list that paints in 200 ms beats a list that animates beautifully
  in 600 ms.
- **The cluster is the source of truth, not our optimism.** We never show a state we have not been
  told about.
- **Quiet chrome.** Colour means status. If colour means anything else, status stops being visible.

---

## 2. Relationship to Lens

The instruction is *recognisably the same kind of tool, not a copy*. Jakob's Law decides which is
which: **conventions that carry the user's muscle memory are kept; visual identity and the places
Lens is genuinely weak are ours.**

### Kept, deliberately (high-frequency interactions — departing costs the user on every visit)

| Convention | Why it stays |
|---|---|
| Catalog of clusters as the entry screen, pinned clusters for fast switching | The first thing a Lens user looks for |
| Left sidebar grouped Cluster / Workloads / Config / Network / Storage / Access Control / Custom Resources | Group names are the same words the Kubernetes docs use |
| Dense resource table, Name first, Age last | Direct descendant of `kubectl get` output |
| Row click opens object details without leaving the list | The core loop of the whole tool |
| Bottom dock for logs and shells, tabbed and resizable | Logs need width; a side panel cannot give it |
| Namespace selector in the top bar | Scopes everything below it, same as Lens |

### Ours, deliberately (each one is a place Lens costs the operator something)

| Departure | The problem with the convention |
|---|---|
| **Quiet, token-driven surfaces in both themes** — neutral greys, one accent, hairline borders, restrained elevation | Lens's light theme is an afterthought; ours are equals because every colour is a token |
| **Details in a non-modal right panel** — the list stays scrollable, sortable and clickable underneath | A drawer that disables the list forces close → find → open for every neighbour row |
| **Discovery-driven sidebar** — kinds the cluster does not serve, or the user cannot `list`, are not in the menu | Dead menu entries that 403 on click are a tax on every cluster with restricted RBAC |
| **Staleness is stated** — a live list says it is live, a dropped watch says since when it is stale and offers a retry | Silently frozen data is the most expensive failure mode a console has |
| **Command palette on `Ctrl`/`Cmd`+`K`** — jump to a kind, a namespace or a cluster by typing | Professional-tool convention (VS Code, Linear) that beats hunting a tree |
| **Keyboard-first tables** — arrows move the row cursor, `Enter` opens, `Esc` closes, `/` focuses filter | Mouse-only tables are slow for the people who live in this screen |
| **Density switch, persisted** — compact and comfortable row heights | One density cannot serve a 13" laptop and a 32" monitor |

Nothing else is a licence to diverge. If you find yourself inventing an interaction not listed
above, the answer is the conventional one.

---

## 3. Layout skeleton

```
┌─────────────────────────────────────────────────────────────────────┐
│ TopNav      logo │ cluster ▾ │ namespace ▾ │ search │ status │ theme │  56px
├────────────┬────────────────────────────────────────┬───────────────┤
│ Sidebar    │ Content                                │ Detail panel  │
│ sections   │   toolbar (title · count · filters)    │  (non-modal,  │
│ from       │   ────────────────────────────────     │   resizable,  │
│ discovery  │   resource table                       │   right)      │
│ 224px      │                                        │  420–880px    │
│            ├────────────────────────────────────────┴───────────────┤
│            │ Dock — logs / shell tabs (collapsed by default)        │
└────────────┴────────────────────────────────────────────────────────┘
```

- **One window.** Clusters switch inside it; there are no cluster tabs at window level.
- **The catalog screen** (`/app/clusters`) replaces the whole content area — no sidebar sections,
  no namespace selector, because nothing is connected yet.
- **Sidebar** collapses to 56px icons; the collapsed state persists.
- **Detail panel and dock** are siblings of the content area, not overlays of it. Both are
  resizable and both remember their size.
- Sizes above are defaults; the resize handle owns the rest.

---

## 4. Spacing and density

Base unit **4px**. Only these steps exist: `4 8 12 16 24 32 48`. Tailwind's `1 2 3 4 6 8 12`.
Arbitrary values (`p-[13px]`) are a defect.

| Context | Inset | Gap |
|---|---|---|
| Table cell | `px-3` | — |
| Toolbar | `px-4 py-2` | `gap-2` |
| Card / section | `p-4` | `gap-4` between sections |
| Detail panel body | `px-4 py-3` | `gap-3` between blocks |
| Page region | `p-4` | `gap-4` |

Two density modes, applied as `data-density` on the content root and read by CSS:

| | Row height | Font | Icon |
|---|---|---|---|
| `compact` (default) | 28px | 12px / `text-xs` | 14px |
| `comfortable` | 36px | 13px / `text-sm` | 16px |

Nothing else changes between modes — not padding rhythm, not column widths.

**Hit targets.** This is a pointer application, so 44px is not the floor; 28px is, and it is a
floor on the *interactive area*, not the glyph. A 14px icon in a 28px button is correct; a 14px
icon in a 14px button is a defect. Table rows are click targets across their full width. Give
destructive actions distance, never proximity: `Delete` is the last item in a menu, separated, and
never adjacent to a frequently-used item.

---

## 5. Motion

`motion-v` drives element animation; `@lucide/vue` provides icons. Icons do not animate except
where the icon *is* the state (`LoaderCircle` spinning, `RefreshCw` while refreshing).

### Principles

1. **Purposeful** — motion explains a spatial or state relationship, or it is not written.
2. **Quick** — nothing a user waits for exceeds 260 ms.
3. **Physical** — entering decelerates, leaving accelerates, moving does both.
4. **Interruptible** — a second trigger cancels the first; nothing queues.
5. **Never on data** — see the watch rule below; it is the one that gets broken.

### Tokens

CSS custom properties in `index.css`, mirrored in `src/constants/UiMotion.ts` for `motion-v`
(which takes **seconds**):

| Token | CSS | motion-v | Use |
|---|---|---|---|
| instant | `--motion-instant: 80ms` | `0.08` | Toggle, checkbox, hover tint, focus ring |
| fast | `--motion-fast: 120ms` | `0.12` | Tooltip, chip, row cursor, badge change |
| normal | `--motion-normal: 180ms` | `0.18` | Dropdown, toast, tab switch, fade-in of loaded content |
| moderate | `--motion-moderate: 260ms` | `0.26` | Side panel, dock, modal, sidebar collapse |

| Easing | Curve | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default — anything moving between two states |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entering the screen |
| `--ease-in` | `cubic-bezier(0.3, 0, 1, 0.3)` | Leaving the screen |
| `linear` | — | Looping only: spinner, shimmer, indeterminate bar |

No spring, no bounce, no overshoot anywhere in this product.

### Prescribed motions

| Thing | Motion |
|---|---|
| Side panel | `x: 24 → 0`, `opacity: 0 → 1`, moderate, `ease-out`; leaving `ease-in` |
| Dock | `height` moderate `ease-standard` |
| Modal / confirm | overlay fade normal; panel `y: 8 → 0` + fade normal (already in `index.css`) |
| Dropdown / context menu | `scale: 0.98 → 1` + fade, fast, origin at the trigger |
| Toast | `y: 8 → 0` + fade normal in, fade fast out |
| Tab / section switch | crossfade normal, no horizontal slide |
| Sidebar collapse | width moderate `ease-standard`; labels fade out `fast` first |
| Loaded content replacing a skeleton | fade normal, **no** slide, **no** layout shift |
| List entrance (catalog cards only) | stagger 30 ms, cap the whole sequence at 300 ms |

### The watch rule — read this before touching a live table

A table fed by a watch receives events in bursts. Animating rows there is not polish, it is a
seizure.

- Rows **never** animate in, out, or on reorder. They appear and disappear.
- A changed or added row gets **one** background tint that fades out over 600 ms, `linear`, and
  nothing else. `ok` → accent tint, `warning`/`error` → the matching status tint.
- The tint is **suppressed entirely** when more than 8 events arrive within one second, and stays
  suppressed until the burst ends. A relist counts as one event, not N.
- Sorting and filtering re-render; they do not animate.

### Reduced motion

Handled once, at the root, never per component.

- `@media (prefers-reduced-motion: reduce)` sets every `--motion-*` to `1ms` and turns the shimmer
  into a flat `hsl(var(--muted))`.
- `UiMotion` returns `0` for every duration when `matchMedia('(prefers-reduced-motion: reduce)')`
  matches, so `motion-v` follows the same switch.
- **Preserved regardless:** the spinner and the indeterminate progress bar. They carry state; a
  frozen spinner reads as a hung application.

---

## 6. Status

The vocabulary is the domain's, unchanged: `ok | pending | warning | error | unknown`, plus `info`
for a neutral highlight the domain has no word for.

| Tone | Token | Glyph | Reads as |
|---|---|---|---|
| `ok` | `--success` | filled dot | Healthy, Running, Bound, Active |
| `pending` | `--muted-foreground` | hollow ring | Pending, ContainerCreating, Terminating |
| `warning` | `--warning` | filled triangle | Degraded, restarts climbing, partially ready |
| `error` | `--destructive` | filled octagon | Failed, CrashLoopBackOff, Unschedulable |
| `unknown` | `--border` | hollow dot | The cluster did not say |
| `info` | `--primary` | filled dot | Neutral emphasis, never health |

**Colour is never the only carrier.** Every status dot has either adjacent text or an `aria-label`,
and the five tones differ in shape as well as hue. A table cell showing status shows the word.

---

## 7. Tables

The resource table is the product. Get it wrong and nothing else matters.

### Columns

- Columns come from `KubeResourceKind.columns`. A screen does not hand-write a column list.
- **Name, Status, Age are never hidden and never reorderable.** They do ninety per cent of the
  work. Name is the first column and sticks on horizontal scroll.
- `priority > 0` (Kubernetes printer-column priority) means hidden by default, available in the
  column picker. Default-visible columns cap at **7**; beyond that, the extras start hidden
  regardless of priority.
- `align: 'right'` columns are right-aligned and use tabular figures. Ages, counts and sizes are
  numbers — they line up or they are unreadable.
- Text that overflows truncates with an ellipsis and carries a tooltip with the full value. It
  never wraps; a wrapped cell breaks the row grid.

### Behaviour

- **Sorting** is over the loaded page, client-side, and the header says so when more pages exist
  (`Sorted within 500 loaded of 2 431`). Do not pretend to sort a collection you do not hold.
- **Filtering by text** is client-side over the loaded rows and debounced 150 ms.
- **Filtering by namespace and labels goes into the request** (`labelSelector` / `fieldSelector`),
  never `getAll().filter()` — `CLAUDE.md` → Data.
- **Selection** is a checkbox column, `Shift` extends a range, the header checkbox selects the
  loaded page and says how many.
- **Row cursor**: `↑`/`↓` move it, `Enter` opens details, `Space` toggles selection, `Esc` clears,
  `Home`/`End` jump. The cursor is a visible ring, distinct from selection and from hover.
- **Context menu** on right-click and on a kebab button in the last column — the same menu, built
  from the verbs the kind actually supports. A verb the cluster refuses is absent, not disabled.

### Structure

A real `<table>`: `<thead>`, `<tbody>`, `<th scope="col">`. Sortable headers are `<button>`s inside
the `<th>` with `aria-sort`. The row is `<tr tabindex="-1">` carrying the click, and the Name cell
holds a `<button>` so the row is reachable and named for assistive technology.

---

## 8. Detail panel and dock

**Panel** — right side, non-modal, resizable 420–880px, size persisted.

- `role="region"` with `aria-label`, **not** `aria-modal`. The list behind it stays live.
- `Esc` closes and returns focus to the row that opened it. Opening moves focus into the panel
  heading.
- Header: kind, name, namespace, status, and the object's actions. Body: progressive disclosure —
  overview first (status, key fields, containers), then labels/annotations, then events, then YAML.
  Everything past overview is a collapsed section or a tab, never all expanded at once.
- Switching rows with the panel open **replaces the content in place**; it does not close and
  reopen.

**Dock** — bottom, tabbed, resizable, collapsed by default, size persisted.

- Logs and shells only. One tab per stream, each labelled `pod/container`, each closable.
- Closing a tab stops its stream. Collapsing the dock does **not** stop streams — that surprises
  people who collapse it to read the table.
- Disconnecting a cluster closes every tab belonging to it.

---

## 9. Loading, empty, error

The Doherty threshold sets the rule: **no loading indicator for anything that finishes under
400 ms.** A spinner that flashes for 120 ms makes a fast application look broken.

| Situation | What renders |
|---|---|
| First load, < 300 ms | Nothing. The content appears. |
| First load, ≥ 300 ms | Skeleton in the real column layout, real row count, shimmer |
| Refresh / relist of data already on screen | 2px indeterminate bar above the table. **Never** a skeleton — replacing visible data with grey blocks is a regression |
| Action in flight | The triggering control disables and shows a spinner within 100 ms; the affected row gets a busy tint |
| Watch connected | A quiet `Live` pill in the toolbar with a slow pulse |
| Watch dropped | `Stale since 14:32` pill in `warning` tone with a `Reconnect` button; the data stays on screen |
| Collection genuinely empty | `EmptyState`: "No Deployments in `default`" + the primary create action |
| Filter matched nothing | A **different** state: "No Deployments match `nginx`" + `Clear filter`. Never the empty-collection copy — it tells the user the wrong thing |
| Load failed | `UiErrorState` inside the content region: the `ApiError` message, a `Retry`, and the technical detail behind a disclosure. A toast **in addition**, never instead — a toast leaves a blank screen behind it |
| Not permitted (403) | Its own copy: "You cannot list Secrets in this namespace", no retry button |

The 300 ms delay is a component (`UiDeferredLoader`), not a `setTimeout` copied into every screen.

Optimistic UI is allowed for **local** state only — pinning a cluster, density, sidebar collapse.
Never for a cluster mutation: the watch is what tells us it happened.

---

## 10. Feedback and destructive actions

- Every action the user takes is acknowledged. Mutations that the watch will reflect anyway still
  get a toast, because the watch may take a second and silence reads as failure.
- Toasts: success auto-dismisses after 4 s, errors persist until dismissed. They name the object:
  `Scaled deployment/api to 3 replicas`.
- **Confirm only what cannot be undone.** Kubernetes deletes cannot, so deletion is confirmed:
  `ConfirmDialog` in `danger` variant naming kind, name and namespace, with the propagation policy
  visible. Scaling, restarting and cordoning are not confirmed — they are reversible and confirming
  them trains people to click through dialogs.
- A destructive confirm never has focus on the destructive button when it opens.
- Errors follow `CLAUDE.md` → Errors without exception: transport throws `ApiError`, whoever cannot
  recover emits `AppErrorEvent`, `ErrorHandler` decides. No component writes its own error copy for
  a failed request.

---

## 11. Search and keyboard

**Two different things, do not merge them.**

- **Filter** — the field in the content toolbar. Scoped to the current list, debounced 150 ms,
  clearable, placeholder naming what it searches (`Filter pods by name or label`). Focused by `/`.
  A query shaped like a label selector (`app=api`) is pushed into the request as `labelSelector`;
  anything else filters loaded rows by name.
- **Command palette** — `Ctrl`/`Cmd`+`K`. Navigation, not filtering: kinds, namespaces, clusters,
  actions. Recent entries first, then matches, capped at 8 visible. `↑`/`↓`, `Enter`, `Esc`.

Global keys, all of them cancellable and none of them overriding a browser default that matters:

| Key | Action |
|---|---|
| `Ctrl`/`Cmd`+`K` | Command palette |
| `/` | Focus the filter |
| `Esc` | Close panel → close dock → clear cursor, in that order |
| `↑` `↓` | Row cursor |
| `Enter` | Open details for the cursor row |
| `Ctrl`/`Cmd`+`\` | Toggle sidebar |

---

## 12. Icons

`@lucide/vue` only. Sizes: **14px** in compact rows and dense toolbars, **16px** in comfortable
rows, **18px** in the sidebar and top bar, **20–26px** in empty states. One stroke weight — the
library default.

- Resource kind icons come from the registry's `icon` string and are resolved **in the
  presentation layer** by `KubeIcon.vue`. The domain keeps strings; it never imports a Vue
  component.
- An unknown icon name falls back to a neutral glyph and does not throw.
- Every icon-only control carries `aria-label` and `title` — `CLAUDE.md` → Accessibility.
- Icons never carry meaning alone in a table cell. Pair with text or a tooltip.

---

## 13. Accessibility — the floor, checked per component

`CLAUDE.md` → Accessibility is mandatory and this adds the table and panel specifics:

1. Clickable is `<button type="button">`, navigable is `<a>`/`router-link`. No `<div @click>`.
2. `Esc` closes panel, dock tab, modal, menu; focus returns to whatever opened it.
3. Icon-only buttons: `aria-label` plus `title`.
4. The global `:focus-visible` ring is never removed. The table row cursor is a *separate* visual
   from focus, and both are visible.
5. Fields are labelled through `UiFormField`; errors are `aria-describedby` + `aria-invalid`.
6. Sortable headers carry `aria-sort`. Selection checkboxes carry a label naming the row.
7. Dialogs: `role="dialog"` / `alertdialog`, `aria-modal="true"`, `aria-labelledby`. The side panel
   is **not** a dialog and must not claim to be.
8. Live regions are **not** required for streaming data — announcing every watch event is hostile.
   Announce state changes the user caused, not the ones the cluster did.

---

## 14. Language

**English, everywhere, including every user-facing string** — `CLAUDE.md` → Language, confirmed by
the repository owner for wave 2. Kubernetes terms keep their canonical spelling (`Pods`,
`Deployments`, `CrashLoopBackOff`, `taints`, `readinessProbe`).

Copy style: sentence case for labels and buttons (`Add kubeconfig`, not `Add Kubeconfig`), no
trailing periods on labels, periods in sentences. Errors say what happened and what to do, never
`An error occurred`.

`vue-i18n` stays wired and unused; write strings straight into templates.

---

## 15. Theming

Every colour is a token from `index.css`. A literal `hsl()`, a hex, or a Tailwind palette colour
(`bg-slate-800`) in a component is a defect — `CLAUDE.md` → Theming.

### The palette is Teal, and two of its values look wrong on purpose

Chosen by the repository owner on 2026-09-21 from six rendered candidates. `--primary` is deep
teal — `189 90% 29%` light, `187 72% 58%` dark — and the monochrome cube mark takes it.

Two tokens will look like mistakes to anyone who did not sit through the comparison. They are not.
Do not "correct" them:

- **`--success` is at hue 142, not the usual 152.** The brand sits at 189. A healthy-green any
  closer stops reading as a different colour from it, and "healthy" versus "the accent" is a
  distinction this product cannot afford to lose. 47° is already the tightest brand-to-status gap
  in the palette.
- **`--accent` is violet, not the neighbouring cyan it used to be.** The accent tints a row the
  watch just changed; at 190 that tint would have been the brand colour, so the signal would have
  disappeared into the chrome.

Three status values were also moved to clear WCAG AA as text, which the shipped ones did not:
light `--warning` was at 2.63 against the background, light `--success` at 4.08, dark
`--destructive` at 3.92. A warning nobody can read is the worst of the three to get wrong.

Both themes ship finished. The light theme is not a courtesy: a console gets used in a bright room
as often as a dark one, and a status colour that is legible in one theme and mud in the other is a
bug in the token, not in the component.

New tokens are added to `:root`/`.light` **and** `.dark` in the same edit, and exposed through
`@theme inline` if a utility needs them.

---

## 16. The UI kit

Wave 2 builds every screen out of these. A screen that hand-rolls one of them instead is rejected.

```
src/constants/UiMotion.ts                       motion tokens for motion-v

src/components/common/table/UiDataTable.vue     the resource table
src/components/common/table/UiTableToolbar.vue  title · count · filter · actions · density · columns
src/components/common/table/UiColumnPicker.vue
src/components/common/table/types/TUiTableColumn.ts
src/components/common/table/types/TUiTableSort.ts
src/components/common/table/types/TUiTableDensity.ts

src/components/common/panel/UiSidePanel.vue     non-modal right panel
src/components/common/panel/UiDock.vue          bottom tabbed dock
src/components/common/panel/UiResizeHandle.vue  drag + arrow keys, role="separator"

src/components/common/feedback/UiErrorState.vue
src/components/common/feedback/UiDeferredLoader.vue
src/components/common/feedback/UiLiveIndicator.vue
src/components/common/feedback/UiProgressBar.vue

src/components/common/status/UiStatusDot.vue
src/components/common/status/UiStatusBadge.vue
src/components/common/status/types/TUiTone.ts

src/components/common/menu/UiDropdownMenu.vue   reka-ui
src/components/common/menu/UiContextMenu.vue    reka-ui
src/components/common/menu/types/TUiMenuItem.ts

src/components/common/search/UiSearchField.vue
src/components/common/select/UiMultiSelect.vue  reka-ui
src/components/common/UiTooltip.vue             reka-ui
src/components/common/icon/KubeIcon.vue
src/components/common/time/UiAge.vue            one shared ticker, not a timer per row
```

Already in the repository and reused as-is: `EmptyState`, `ConfirmDialog`, `UiModal`,
`UiFormField`, `UiPagination`, `UiSection`, `UiSelect`, `UiTabBar`, `UiToggle`, `UiSkeletons`,
`ModalShellBase`.

`reka-ui` is already a dependency. Menus, tooltips, popovers and multi-selects are built on it —
hand-rolled keyboard handling for those is a defect, not craftsmanship.
