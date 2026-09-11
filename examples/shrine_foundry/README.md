# Foundry composition proof

**One reusable document component, two embedding contexts, one shared draft.**
The writing desk displays an expanded document. The reading pane displays the
same component as a compact reference with its own heading, footer, surface,
and control density. Expanding that reference changes its local presentation;
the writing desk and the underlying document remain the same.

This tests a small composition boundary: the embedding context supplies slots
and presentation, the fixture owns the source and draft, and GPUI supplies native
controls. It uses GPUI Kit's existing JavaScript shell. The context rules below
are explicit fixture conventions; this is not an implementation of Grove,
Shadow DOM, or a production Foundry resolver.

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

1. Compare **Writing desk** and **Reading pane**. Both use `documentCard`;
   their hosts supply different heading and footer slots. The reference hides
   identity metadata and uses denser controls on a separate semantic surface.
2. Type a title in either editor. Both show the same draft; the committed source
   below stays unchanged. Select **Expand reference**, then **Compact reference**.
   Only the reading pane changes presentation. Its title and editor survive.
3. Move an appearance. It adopts the receiving context's presentation and slots
   while keeping its route, source, Flow and native editor. Close and reopen it:
   a new editor starts from the retained draft. These are locations in one window.

The previous source-ownership checks remain available below the contexts:

1. Select **Simulate external edit**, then **Commit**. The revision conflict
   retains your draft and shows the separately updated source. **Keep draft on
   latest** explicitly changes the draft's revision basis; committing afterward
   overwrites the source with that draft. This is not a text merge.
2. Select **Restrict appearance B**, then B's **Commit**. The fixture returns
   `outside-envelope`. Moving B does not expand its admitted actions. Restore B
   to resume editing. These controls exercise a simulated host, not security.

## Boundaries

| File | Responsibility |
| --- | --- |
| [fixture.js](fixture.js) | In-memory source, Flow draft, appearance identity, revisions, simulated admission and operation receipts. Snapshots are copies. |
| [document-card.js](document-card.js) | The single reusable document component; accepts caller-supplied heading, footer, editor and action content. No GPUI imports or embedding-location decisions. |
| [foundry.js](foundry.js) | Named recipes and immutable nested presentation contexts. Selects expanded/compact document composition and passes the resolved context to bindings. No GPUI imports. |
| [gpui-bindings.js](gpui-bindings.js) | Maps recipes and their received context to native controls and semantic theme tokens without modifying global Theme. |
| [main.js](main.js) | Composes the two hosts and their supplied slots; retains a distinct `InputState` per mounted appearance and the reading pane's presentation choice. |
| [fixture.test.mjs](fixture.test.mjs) | Behavioral checks for continuity, cross-Flow isolation, source-relative commits, revision conflicts, revocation, and stale search delivery. |
| [foundry.test.mjs](foundry.test.mjs) | Context inheritance, local overrides, recipe reuse, supplied-slot locality and validation. |
| [foundry_composition_host.rs](../../crates/component-shell/tests/foundry_composition_host.rs) | Mounts the actual example and exercises native input, composition and source operations. |

The root context chooses `expanded`, `comfortable`, and the `surface` color role.
The writing desk inherits those choices. The reading pane overrides them with
`compact`, `compact`, and `muted`. Every scope derives a fresh frozen context;
its children receive it as an argument. Traversal never installs a global
"current scope" or temporarily changes GPUI's global Theme.

Supplied slot content uses the **receiving context's presentation** unless it
explicitly introduces an inner scope. Its callback closures still belong to
their creator. This is a chosen fixture rule, not browser slot/CSS/event behavior.
Compact presentation deliberately omits identity metadata; it retains the editor,
actions, draft status and supplied footer. Unknown slots are errors even when a
compact recipe would otherwise hide that lane.

Recipes are deliberately small. A production adapter must consume Grove's
resolved declarations and admitted projections, replacing the fixture host. The
prototype does not make JavaScript object keys or GPUI types semantic authority.

The fixture also exercises asynchronous delivery with explicit tickets: later
requests, unmount/remount, and revoked invocations invalidate older delivery.
Search is covered in the fixture tests; it is not presented as a native search UI
or a real asynchronous service.

## Verification

```sh
node --test examples/shrine_foundry/*.test.mjs
cargo test --locked -p gpui-component-shell --test foundry_composition_host
```

At commit `bf926ec1e0015d79e37698e64ba125d53cf16329`, the
[macOS arm64 CI run](https://github.com/ParsifalNafis/gpui-component/actions/runs/34548554851)
passed **22 Node tests** (14 source/draft fixture tests and 8 composition tests)
and **three mounted native interaction tests**. The native tests load and draw
the actual example through the public shell API, find controls through
`gpui_base::test_support`, and dispatch pointer/keyboard input:

- **Local composition:** the desk and reference have different resolved recipes,
  caller slots, control density and actual painted semantic surfaces. Expanding
  and compacting the reference preserves both native editors and their text,
  leaves the desk's complete description unchanged, and leaves Base/Component
  global themes unchanged. Expanded identity content appears and disappears as
  intended, while supplied heading/footer content stays with its host.
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
paired. This result covers the mounted GPUI test path. The updated JavaScript
example also launched locally with the previously verified native shell binary
without logged errors. Interactive window inspection remains unverified: earlier
attempts were blocked by pending macOS Accessibility and Screen Recording
permissions. The CI result does not establish browser or operating-system
accessibility parity, or manual visual quality across device sizes and themes.

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
- This bounded context fixture demonstrates local recipe, surface and density
  choices. Full Grove/Foundry cascade and negotiation, semantic slot admission,
  nested Scene services, inline references, durable Trace and replay, real
  capability attenuation, and cross-window continuity remain work.
- This JavaScript shell is native. The repository's Rust/Wasm gallery does not
  establish browser execution of this example or DOM/Shadow DOM semantics.

The [readiness audit](../../docs/SHRINE-FOUNDRY-READINESS.md) maps the broader Shrine
requirements to existing toolkit mechanisms, missing contracts, and staged
acceptance criteria. This proof exercises parts of its first and third stages.
