# Foundry composition proof

A native GPUI Kit experiment for preparing a Shrine/Grove realization backend.
It uses the existing JavaScript component shell. There is no new Rust domain
model, Grove parser, or change to Base.

One document appears twice in an explicitly shared working Flow. Each appearance
has a stable route and a separate native editor. Edit either title, move an
appearance, close it, then reopen it: the Flow still holds the draft. Enter and
**Commit** invoke the same source-directed operation.

## Run

From the repository root, with Rust and the platform prerequisites in the
[installation guide](../../website/docs/installation.md):

```sh
cargo run -p gpui-component-shell --bin gpui-component-shell -- examples/shrine_foundry
```

The shell opens a native window and watches the example for changes. No JavaScript
packages are required. The first Rust build downloads and compiles the toolkit.

## Try it

1. Type a title in A. B shows the same draft, while the committed source below
   remains unchanged. Focus and native input entities are distinct.
2. Move A. Its route, source and Flow remain the same. Close and reopen it: its
   new native editor starts from the retained draft. This is placement within one
   window; it does not implement detached operating-system windows.
3. Select **Simulate external edit**, then **Commit**. The revision conflict
   retains your draft and shows the separately updated source. **Keep draft on
   latest** explicitly changes the draft's revision basis; committing afterward
   overwrites the source with that draft. This is not a text merge.
4. Select **Restrict appearance B**, then B's **Commit**. The fixture returns
   `outside-envelope`. Moving B does not expand its admitted actions. Restore B
   to resume editing. These controls exercise a simulated host, not security.

## Boundaries

| File | Responsibility |
| --- | --- |
| [fixture.js](fixture.js) | In-memory source, Flow draft, appearance identity, revisions, simulated admission and operation receipts. Snapshots are copies. |
| [foundry.js](foundry.js) | Hand-authored recipe fixtures with named content slots and explicit realization hooks. No GPUI imports. This is not proposed Grove syntax or a complete Foundry resolver. |
| [gpui-bindings.js](gpui-bindings.js) | Maps those hooks to existing native controls, layout and semantic theme colors. |
| [main.js](main.js) | Supplies appearance content and event intentions; retains a distinct `InputState` per mounted appearance. |
| [fixture.test.mjs](fixture.test.mjs) | Behavioral checks for continuity, cross-Flow isolation, source-relative commits, revision conflicts, revocation, and stale search delivery. |

Recipes are deliberately small. A production adapter must consume Grove's
resolved declarations and admitted projections, replacing the fixture host. The
prototype does not make JavaScript object keys or GPUI types semantic authority.

The fixture also exercises asynchronous delivery with explicit tickets: later
requests, unmount/remount, and revoked invocations invalidate older delivery.
Search is covered in the fixture tests; it is not presented as a native search UI
or a real asynchronous service.

## Verification

```sh
node --test examples/shrine_foundry/fixture.test.mjs
cargo run -p gpui-component-shell --bin gpui-component-shell -- check examples/shrine_foundry
cargo test -p gpui-component-shell --test foundry_composition_host
```

The Node checks exercise fixture behavior. The native integration test loads the
actual example through the public shell API and checks rendering and interaction.
`check` alone only proves initial eager materialization, not later events.

Validation so far (2026-09-10): all 14 fixture tests pass, the JavaScript files
pass Node syntax checks, and the new Rust test passes `rustfmt --check`. Native
compilation and interaction verification are still pending; do not treat this
initial checkpoint as a verified native run.

## Limits and next steps

- All state is in memory. Closing/reloading the application resets the fixture;
  continuity here means surviving appearance teardown within the workbench.
- Peer text is mirrored with `set_value`, which resets that peer's local editing
  history and selection. It proves shared draft ownership, not a production
  multi-editor model. A real integration needs text deltas and separate per-view
  selection/IME state. Remount intentionally creates fresh local editor state.
- The base shell Input has a native text role, but does not forward its script
  `accessibility_label` behavior to InputBase. Styled retained form inputs expose
  a label but lack change callbacks. This example uses the functional Base input
  with a visible context; full accessible naming is a tracked binding gap.
- Styles use the current host theme. Scoped Foundry cascade, semantic slot
  admission, nested Scene services, inline references, durable Trace and replay,
  real capability attenuation, and cross-window continuity remain work.
- This JavaScript shell is native. The repository's Rust/Wasm gallery does not
  establish browser execution of this example or DOM/Shadow DOM semantics.

The [readiness audit](../../docs/SHRINE-FOUNDRY-READINESS.md) maps the broader Shrine
requirements to existing toolkit mechanisms, missing contracts, and staged
acceptance criteria. This proof implements a subset of its first stage.
