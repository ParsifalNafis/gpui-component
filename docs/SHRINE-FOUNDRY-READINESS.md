# Shrine / Foundry readiness

## Scope and evidence

Source audit of upstream GPUI Kit revision **`42721ea0`**. This document separates
implemented mechanisms from available extension points and proposed integration
work. Source inspection and existing test definitions do not establish that a
workflow has passed on a device. Record executed commands and observed behavior
with the proof, separately from this roadmap.

The [composition example](../examples/shrine_foundry/README.md#verification) now has
a verified, limited checkpoint: at commit
`191f86cc5f104ff611842492cfb6993b339851f9`, the
[macOS arm64 CI run](https://github.com/ParsifalNafis/gpui-component/actions/runs/34547115363)
passed 14 fixture tests and two mounted native interaction tests. These draw the
actual example and dispatch native pointer/keyboard input. They verify external
edit conflicts, shared draft text through native Copy, editor continuity through
Move/Close/Reopen, and restricted commit refusal. CLI `check` has a confirmed
eager-materialization failure described below. Local launch reached the native
event loop, but pending
macOS Computer Use permissions prevented interactive window inspection. That
manual check and other platform paths remain unverified. The full acceptance
criteria below remain a roadmap.

The user supplied the older `JShrine/docs/PRODUCT-SCHEMA.md`, its user stories,
and the [Grove reference](https://gist.github.com/liam-fitzgerald/20e28360b86b5f75011c77a4e2ae008d)
as design requirements. They are not claims about implemented GPUI behavior or a
final Grove protocol. This document carries their general integration requirements;
it does not reproduce their detailed product records or stories.

GPUI Kit is a useful **realization backend** for Foundry. Its Base/component split,
native script materialization, explicit component parts, inline objects, and dock
renderers already supply substantial machinery. They do not establish durable
semantic identity, contextual authorization, semantic Slot compatibility, or a
scoped Foundry cascade.

## Ownership to preserve

- The external semantic owner retains sources, occurrences, working continuations,
  drafts and base revisions, admitted operations, and semantic routes. A renderer
  projects the context supplied to it and reports interaction intent.
- Foundry resolves semantic roles, scoped presentation choices, accessibility,
  input, and fallback requirements. GPUI types are backend artifacts, not the
  portable definition of those roles.
- GPUI owns focus, measurement, layout, pointer/keyboard dispatch, and other local
  realization mechanics. A Scene rendered inside another surface does not acquire
  a second window root or authority over its source.
- An attachment must preserve its role and identity through layout changes and
  must not increase authority. Native child slots are useful destinations after
  semantic admission; they do not perform that admission themselves.
- Keep domain meaning out of Base. Consume the existing external declarations or
  admitted projection records through a narrow adapter. Do not introduce parallel
  Rust `Flow`, `Plate`, `Block`, Action registries, field-name dispatch, or permission
  schemas as new semantic owners. Rust may host transport and generic materialization
  mechanics; a small fixture is not a production semantic schema.

This agrees with the toolkit's downward dependency direction and explicit
behavior/presentation boundary: [coding guide](../website/docs/coding-guides.md#architecture-at-a-glance),
[architecture](ARCHITECTURE.md#architectural-thesis). Preserve upstream public APIs.
Start above `gpui-base`; propose a generic Base change only after a reproducible
integration case shows an unavailable public seam.

## Implemented mechanisms and integration gaps

| Surface | Evidence at `42721ea0` | Readiness and remaining work |
| --- | --- | --- |
| Controls and anatomical parts | Base Button accepts caller-owned children, controlled state, an accessible name, and a caller-owned focus handle. Switch exposes separate track and thumb parts. The styled Switch composes those parts. [`button.rs:58`](../crates/base/src/button.rs#L58), [`button.rs:193`](../crates/base/src/button.rs#L193), [`switch.rs:57`](../crates/base/src/switch.rs#L57), [`component/switch.rs:181`](../crates/component/src/switch.rs#L181) | Reuse these for admitted control recipes. Disabled/read-only flags express local interaction behavior, not authorization. Base still owns necessary geometry; for example Button establishes centering and line-height at `button.rs:214`. |
| Theme and Foundry styling | Serializable semantic colors, radius, spacing, typography, and shadow tokens exist. Both Base and component themes are App globals. Component theme projects a separate Base copy. [`theme_tokens.rs:10`](../crates/base/src/theme_tokens.rs#L10), [`base/theme.rs:16`](../crates/base/src/theme.rs#L16), [`theme/mod.rs:275`](../crates/component/src/theme/mod.rs#L275) | Suitable inputs for a backend recipe. There is no scoped Foundry ancestry in these theme APIs. Retain the complete resolved local token snapshot outside the legacy global theme; explicit styles/renderers can consume it. |
| Token fidelity and updates | `spacing_tokens()` returns defaults; typography projects only selected legacy fields; `apply_semantic_tokens` stores only a subset. `sync_base` rebuilds Base globals and text defaults. [`theme/mod.rs:310`](../crates/component/src/theme/mod.rs#L310), [`theme/mod.rs:443`](../crates/component/src/theme/mod.rs#L443), [`theme/mod.rs:464`](../crates/component/src/theme/mod.rs#L464) | A custom spacing/elevation snapshot cannot be round-tripped through the legacy theme. A local overlay must not mutate global theme state and affect sibling or ancestor appearances. Full Foundry negotiation, protected accessibility overrides, provenance, fallback, and refusal remain integration work. |
| Script-authored recipes | JavaScript builders produce immutable descriptions that `ScriptView` snapshots and materializes as native GPUI. Component knowledge lives in `gpui-component-shell`. Reflection provides constructors, methods, arguments, child lanes, and eager/deferred named slots. [`view.rs:1`](../crates/shell/src/view.rs#L1), [`component-shell/lib.rs:1`](../crates/component-shell/src/lib.rs#L1), [`component_registry.rs:770`](../crates/shell/src/component_registry.rs#L770), [`component_registry.rs:1531`](../crates/shell/src/component_registry.rs#L1531) | A useful native recipe engine without a new Rust component layer. Reflection describes native APIs, not portable Shrine roles. Named builder slots do not encode semantic compatibility, projection ceilings, or capability attenuation. |
| Host transport and operation intent | `HostModule` exposes synchronous/asynchronous plain-data functions and native-element construction; modules can be restricted per policy. [`host_modules.rs:444`](../crates/shell/src/host_modules.rs#L444), [`host_modules.rs:484`](../crates/shell/src/host_modules.rs#L484), [`policy.rs:160`](../crates/shell/src/policy.rs#L160) | Use a small external-owner bridge. Each consequential request needs current external admission, source revision, and delivery ownership. The declaration checker checks names, not function signatures (`host_modules.rs:541`). Do not treat TypeScript declarations as wire validation. |
| Work lifetime and asynchronous results | Root `ScriptView` drop releases its application generation; nested drop cancels view tasks. A host-call promise no longer resumes after caller removal or reload. Script snapshot refresh has its own API. [`view.rs:139`](../crates/shell/src/view.rs#L139), [`view.rs:268`](../crates/shell/src/view.rs#L268), [`host_modules.rs:534`](../crates/shell/src/host_modules.rs#L534) | Durable work and shared drafts must outlive view objects in the external owner. Keep presentation subscriptions and result-delivery epochs separate. Callback cancellation does not itself establish cancellation or rollback of external work. |
| Scene/Plate composition and overlays | `AnyView` can render embedded content. Root services target the window root, set window `rem`, and activate a selection scope; popups use a window-level deferred layer and bounds. [`root.rs:153`](../crates/component/src/root.rs#L153), [`root.rs:577`](../crates/component/src/root.rs#L577), [`popup.rs:11`](../crates/base/src/popup.rs#L11), [`popup.rs:135`](../crates/base/src/popup.rs#L135) | Embedded content is available; nested contextual services are not established by wrapping it in another Root. Supply explicit presentation ownership for overlays, command routing, clipping and focus restoration, then determine which missing seams are general toolkit work. |
| Docking, tiles, and transposition | DockArea holds pure layout trees, a NodeId entity cache, and a renderer; panels distinguish move from remove; tiles have intents/history. The shell binds dock panels and serialization. [`dock_area.rs:123`](../crates/base/src/dock/dock_area.rs#L123), [`panel.rs:63`](../crates/base/src/dock/panel.rs#L63), [`tiles_state.rs:28`](../crates/base/src/dock/tiles_state.rs#L28), [`dock_api.rs:1`](../crates/shell/src/engine/quickjs/dock_api.rs#L1) | Reuse within-area movement. `PanelId` wraps `EntityId`, not a semantic route (`layout/node.rs:18`). `move_panel` resolves the current area's trees, and drag payloads have no source-area identity (`dock_area.rs:595`, `drag.rs:25`). Cross-area/window transfer needs an explicit continuity contract; disappearance can invoke `on_removed` (`dock_area.rs:1094`). |
| Text editing and drafts | InputBaseState includes Rope, undo, focus, selection, IME, geometry, and scrolling. `set_value` resets undo, selection, and scroll. [`input/base/state.rs:337`](../crates/base/src/input/base/state.rs#L337), [`input/base/state.rs:888`](../crates/base/src/input/base/state.rs#L888) | Retaining one entity preserves one editor, but sharing that entity couples view-local state. Two appearances need one explicitly shared draft with separate carets/viewports, or an explicitly independent draft. Avoid full-value synchronization that destroys local editing history. |
| Rich text and bounded inline content | Markdown plugins parse reusable typed data separately from rendering. Nodes carry text/Markdown fallbacks, accessible names, and source ranges. `InlineElement` has inherited typography and optional baseline. [`markdown_ext.rs:23`](../crates/base/src/text/markdown_ext.rs#L23), [`markdown_ext.rs:106`](../crates/base/src/text/markdown_ext.rs#L106), [`inline_element.rs:3`](../crates/base/src/text/inline_element.rs#L3) | A strong backend seam for admitted inline references. The typed payload is in-process `Any`, not a portable format. Semantic character/occurrence identity, reference resolution, role compatibility, and refusal must arrive from the external owner; arbitrary native widgets are not automatically valid semantic characters. |
| Inline fallback, selection and reflow | Invalid inline metrics fall back to text. Native objects retain their actual size; only text fallback scales to fit. Inline reflow can preserve logical selection without reparsing. Source-copy mode returns original source for select-all and reconstructs partial Markdown. [`inline_object.rs:53`](../crates/base/src/text/inline_object.rs#L53), [`inline_object.rs:107`](../crates/base/src/text/inline_object.rs#L107), [`text/state.rs:400`](../crates/base/src/text/state.rs#L400), [`text/state.rs:59`](../crates/base/src/text/state.rs#L59) | Explicitly resolve oversize content to a compatible compact/expanded/fallback recipe. Test fallback meaning, selection and copy across mixed text and objects. HTML import is a limited rich-text parser, not a DOM/custom-element runtime (`text/format/html.rs:142`, `:407`). |
| Selection, focus and accessibility | Opaque text-selection scope IDs, registration, and activation exist. Controls write accessible roles/names/state; inline wrappers expose a read-only generic container with a name. macOS installs accessibility hit-test forwarding. [`text_selection.rs:19`](../crates/base/src/text_selection.rs#L19), [`text_selection.rs:1710`](../crates/base/src/text_selection.rs#L1710), [`switch.rs:348`](../crates/base/src/switch.rs#L348), [`inline_object.rs:220`](../crates/base/src/text/inline_object.rs#L220), [`macos_accessibility.rs:16`](../crates/base/src/macos_accessibility.rs#L16) | Reuse these mechanics, then prove nested ownership. Focus-trap lookup uses the first containing handle from a global map, without an explicit deepest-owner order (`focus_trap.rs:52`). Accessibility fallback, zoom, reduced motion and native/browser assistive behavior require observed evidence; metadata alone is insufficient. |
| Collections, streams, inspection and glyphs | Tree has caller item rendering and retained state; virtual lists and rich text support bounded visible rendering. Icons and assets are native realization facilities. [`tree.rs:181`](../crates/base/src/tree.rs#L181), [`virtual_list.rs:216`](../crates/base/src/virtual_list.rs#L216), [`text_view.rs:242`](../crates/base/src/text/text_view.rs#L242), [`icon.rs:84`](../crates/component/src/icon.rs#L84) | Reuse for feeds, outlines, inspectors, and terminal glyphs. Subscription scope, semantic Stream identity, reveal/inspect policy, and provenance remain external. A diagnostic script tree or persisted dock layout is not the durable semantic source. |

## Native, browser, and web-content embedding are different paths

| Path | What the repository establishes | What is not yet established |
| --- | --- | --- |
| Native Rust GPUI components | CI defines macOS, Linux, and Windows jobs and a macOS Metal rendering job. [`.github/workflows/ci.yml:16`](../.github/workflows/ci.yml#L16) | A workflow definition is not evidence that this fork or a Shrine scenario has passed those jobs. |
| Native JavaScript recipes | `gpui-shell` runs the QuickJS-backed native materialization path; component bindings are a separate adapter. [`shell/Cargo.toml:45`](../crates/shell/Cargo.toml#L45), [`component-shell/lib.rs:1`](../crates/component-shell/src/lib.rs#L1) | No verified browser execution of this QuickJS shell follows from the Rust gallery's Wasm build. Treat a browser recipe adapter as separate work until a target build and interaction proof demonstrate support. |
| Rust GPUI in the browser | Story Web calls `single_threaded_web`, loads bundled fonts, exports `set_theme`, and retains `run_embedded`'s application handle. Base also has a Wasm example. [`story-web/src/lib.rs:22`](../crates/story-web/src/lib.rs#L22), [`story-web/src/lib.rs:61`](../crates/story-web/src/lib.rs#L61), [`story-web/src/lib.rs:127`](../crates/story-web/src/lib.rs#L127), [`base/examples/wasm/src/lib.rs:21`](../crates/base/examples/wasm/src/lib.rs#L21) | This proves an implementation path to canvas/browser rendering, not DOM Slots, CSS parts, Shadow DOM encapsulation, a native-script bridge, or semantic renderer interchangeability. |
| Gallery page embedding and input | The page detects an iframe host, follows its theme, and manages GPUI's off-screen input. On touch-only devices it sets the input read-only and suppresses the virtual keyboard. [`story-web/www/src/main.js:1`](../crates/story-web/www/src/main.js#L1), [`main.js:18`](../crates/story-web/www/src/main.js#L18), [`main.js:46`](../crates/story-web/www/src/main.js#L46) | The current gallery is not a mobile editing acceptance test. Device keyboard/IME, focus transfer, clipboard, accessibility bridge, multiple embedded instances, sizing and teardown need separate browser evidence. |
| Web content inside native GPUI | Wry WebView exposes show/hide/navigation and tracks GPUI bounds. [`webview/src/lib.rs:45`](../crates/webview/src/lib.rs#L45), [`webview/src/lib.rs:198`](../crates/webview/src/lib.rs#L198) | Upstream describes this path as experimental, macOS/Windows only, with the WebView above GPUI content within its bounds. [README](../crates/webview/README.md#L5). It is not a general composited inline surface or a cross-platform substitute for the current web renderer. |

The GPUI platform implementation is supplied by `gpui-pre-*` dependencies
([`Cargo.toml:61`](../Cargo.toml#L61)). Do not infer platform accessibility or input
parity solely from Kit-level metadata or from a successful compilation.

## Staged preparation

### 1. Deterministic composition fixture

Keep the first proof in application/fixture code using the native shell and
existing component catalog. A mock external owner supplies opaque references,
admitted values, operation availability, and deterministic delayed results. It is
not a Grove parser, namespace runtime, permission system, or production protocol.

Acceptance:

- Show one source in two appearances with distinct occurrence and delivery IDs.
- Explicitly choose a shared draft; share its text while keeping per-view focus,
  selection and viewport separate.
- Switch a compact realization to expanded and back without copying source or
  deriving identity from panel/entity IDs.
- Deliver results in reverse order, remount an appearance, and reuse its visual
  location. A stale result must not update the replacement appearance.
- Show pending, unavailable, conflict, and refusal states without losing draft
  content. A UI refusal is labelled fixture behavior until an external authority
  supplies it.
- Use named component attachment seams and one inline reference with meaningful
  text/accessibility fallback. Change local presentation without changing a
  sibling appearance.

### 2. Narrow external-owner adapter

Replace the mock owner through `HostModule` functions that consume the existing
semantic representation. Keep script recipes and native control bindings reusable.
The external owner retains work that should survive unmount; views own only their
subscriptions and local display state.

Acceptance: validate bridge payloads, recheck current external authority at
invocation, carry draft base revision and operation identity, distinguish work
completion from view delivery, and close subscriptions on detach/reload. Test
expiry/revocation while a control remains visible. Shell policy is a frozen grant
for code ([`policy.rs:73`](../crates/shell/src/policy.rs#L73)); it does not replace
live contextual admission by the semantic owner.

### 3. Scoped Foundry realization

Resolve a local presentation snapshot from externally supplied role/context and
available device features. Retain the complete semantic token snapshot and recipe
choice; do not implement local themes by temporarily replacing App globals.
Use existing parts, item renderers, and inline extension points before changing
Base.

Acceptance: sibling scopes differ without leakage; ancestor presentation is
unchanged; accessibility overrides remain effective; absent/incompatible renderers
produce an explicit supported fallback or refusal; oversized inline content has
a declared route to a bounded larger surface. Recipe replacement preserves source,
occurrence and draft identity. No style choice expands available operations.

### 4. Continuity and nested service seams

Exercise within-area move separately from cross-area/window transfer. Prove the
external draft adapter before extracting a shared editing-buffer seam. Define
ownership for overlays, focus, commands, selection, scrolling, and transient
presentation when content changes scope.

Acceptance: moving does not invoke semantic deletion; closing an appearance does
not end durable work; simultaneous editors do not share carets unintentionally;
undo and selection survive intended updates; a nested popup closes and restores
focus within its owner; disposing one appearance leaves siblings valid. Any Base
patch must solve a generic demonstrated gap and preserve existing consumers.

### 5. Independent renderer and platform proof

Feed the same admitted projection fixture to the web realization and GPUI native
realization. A browser GPUI experiment is a third target unless it shares a proven
recipe execution path. Compare semantic actions, values, references and fallback
meaning; pixel equality is not the portability contract.

Acceptance: desktop keyboard/IME, touch input, copy/selection, assistive names and
actions, zoom, long content, reload/unmount and degraded resources are exercised
on the target claimed. Measure startup, input latency, scrolling and retained
memory separately. Keep unresolved browser-shell support explicit. None of these
results by itself implements headless, paper, voice or other future realizations.

## Verification entry points

Use targeted commands for the files changed, then the relevant upstream gates.
These are available entry points, not a claim they were run during this audit:

```sh
cargo fmt --check
cargo test -p gpui-kit --features test-support --locked
cargo test -p gpui-component
cargo test -p gpui-component --doc
cargo test -p gpui-component-shell --all-targets
cargo clippy -p gpui-component -p gpui-component-story -p gpui-kit-assets -- --deny warnings
```

The focused proof command that passed in the linked CI run is
`cargo test --locked -p gpui-component-shell --test foundry_composition_host`.
Its harness uses `gpui_base::test_support::find` and `simulate_click`, with Base
and Component `test-support` dev features enabled together. Preserve that pairing
when modifying the harness; this mounted draw path does not rely on a separate
`ShellRuntime::check` call.

The CLI `check` command aborts with exit code 134 on this example:
`overflow_y_scroll` materialization requests a keyed `ScrollHandle` through
`Window::use_keyed_state` outside `request_layout`, `prepaint`, or `paint`, so
`Window::current_view` panics. This existing eager-check path limitation is not
specific to Input. Keep the mounted draw-phase test as the automated native proof;
do not report CLI `check` as passing. Interactive application-window verification
remains separate and was blocked by pending macOS Accessibility and Screen
Recording permissions.

The CI matrix additionally exercises workspace tests and shell suites separately
([`ci.yml:83`](../.github/workflows/ci.yml#L83),
[`ci.yml:119`](../.github/workflows/ci.yml#L119)). Run an actual native interaction
proof for focus, overlays, accessibility and composition; a unit-test pass is not
that evidence.

Browser entry points are `make build-prod` in `crates/story-web` and `make build`
in `crates/base/examples/wasm`. The release workflow provisions the Wasm target,
nightly for Base, and a `wasm-bindgen-cli` version matching the lockfile
([`release-docs.yml:47`](../.github/workflows/release-docs.yml#L47)). A browser build
must be followed by device interaction checks. Record dependency/network failures,
unrun checks and unsupported targets directly instead of claiming readiness from
the presence of a build script.
