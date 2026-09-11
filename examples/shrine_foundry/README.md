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

The shell opens a native window. Add `--watch` after the example path to reload
when its sources change. No JavaScript packages are required. The first Rust
build downloads and compiles the toolkit.

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
| [foundry_composition_host.rs](../../crates/component-shell/tests/foundry_composition_host.rs) | Mounts the actual example in a GPUI test window and exercises native Button interactions. |

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
cargo test --locked -p gpui-component-shell --test foundry_composition_host
```

At commit `191f86cc5f104ff611842492cfb6993b339851f9`, the
[macOS arm64 CI run](https://github.com/ParsifalNafis/gpui-component/actions/runs/34547115363)
passed all **14 Node fixture tests** and **two mounted native interaction tests**.
Both load and draw the actual example through the public shell API, find native
controls through `gpui_base::test_support`, and dispatch pointer/keyboard input:

- **External edit and conflict:** native Button clicks change the source, then
  attempt Commit. The conflict preserves both appearances' original draft bases
  and the externally changed source.
- **Editing and continuity:** native typing updates both editors, verified through
  their Copy command, without committing the source. Move retains the editor;
  Close releases it; Reopen creates a new editor with the retained draft and a
  working change subscription. Restricting B then clicking its Commit produces
  refusal while preserving the source and shared draft.

The test harness enables `gpui-base/test-support` and
`gpui-component/test-support` together in the
[dev dependencies](../../crates/component-shell/Cargo.toml#L16); keep those features
paired. This result covers the mounted GPUI test path. The CI binary from the
earlier green code commit `72dc56c5` also launched locally on macOS and reached its
event loop without logged errors; the later commit only extends the test harness.
Interactive window inspection was blocked by pending macOS Accessibility and
Screen Recording permissions; editing by hand remains unverified. The CI result
does not establish browser or operating-system accessibility parity.

The CLI `check` command currently aborts with exit code 134 for this example.
Its eager materialization resolves `overflow_y_scroll` through a keyed
`ScrollHandle` outside `request_layout`, `prepaint`, or `paint`, causing
`Window::current_view` to panic. This is an existing eager-check path limitation;
the mounted test exercises the normal draw phases instead. The failure is not
specific to Input, and `check` is not a passing verification command for this proof.

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
