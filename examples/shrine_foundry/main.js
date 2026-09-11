import { View } from "gpui-kit";
import { InputState } from "gpui-base";
import { createFixture } from "./fixture.js";
import { realize, scope, slot, text } from "./foundry.js";
import { documentCard } from "./document-card.js";
import { gpuiBindings } from "./gpui-bindings.js";

export default class FoundryWorkbench extends View {
  init() {
    this.host = createFixture();
    this.referenceExpanded = false;
    this.inputs = new Map();
    this.syncInputs();
  }

  // Flow-owned text is shared explicitly. InputState (caret, focus, IME, undo)
  // belongs to one appearance. Never render the same entity in two places.
  syncInputs() {
    for (const appearance of this.host.snapshot().projections) {
      let input = this.inputs.get(appearance.id);
      if (!appearance.mounted) {
        input?.release();
        this.inputs.delete(appearance.id);
        continue;
      }
      if (!input) {
        input = InputState.new({ placeholder: "Document title", value: appearance.draft.title });
        this.inputs.set(appearance.id, input);
        input.on("change", (_event, cx) => {
          if (input.value() === this.host.draftFor(appearance.id).title) return;
          this.host.changeDraft(appearance.id, input.value());
          this.syncInputs();
          cx.notify();
        });
        input.on("submit", (_event, cx) => this.perform(() => this.host.commit(appearance.id), cx));
      } else if (input.value() !== appearance.draft.title) {
        // Proof limitation: full-value mirroring resets the peer editor's local
        // history/selection. Production requires edit deltas, not set_value.
        input.set_value(appearance.draft.title);
      }
    }
  }

  perform(operation, cx) {
    operation();
    this.syncInputs();
    cx.notify();
  }

  action(id, label, operation, primary = false) {
    return slot("button", {}, { id, label, primary, run: cx => this.perform(operation, cx) });
  }

  appearance(view) {
    const name = view.id === this.host.ids.primary ? "Appearance A" : "Appearance B";
    const source = this.host.snapshot().sources.find(item => item.id === view.sourceId);
    const reference = view.placement === "embedded";
    const actions = view.mounted ? [
      this.action(`${view.id}:commit`, "Commit", () => this.host.commit(view.id), true),
      this.action(`${view.id}:rebase`, "Keep draft on latest", () => this.host.rebase(view.id)),
      this.action(`${view.id}:move`, "Move", () => {
        const all = this.host.snapshot().projections;
        for (const other of all.filter(item => item.id !== view.id)) {
          this.host.move(other.id, view.placement);
        }
        this.host.move(view.id, view.placement === "main" ? "embedded" : "main");
      }),
      this.action(`${view.id}:unmount`, "Close", () => this.host.unmount(view.id)),
    ] : [this.action(`${view.id}:mount`, "Reopen appearance", () => this.host.mount(view.id))];

    const card = documentCard(view, {
      source,
      editor: slot("input", {}, { state: this.inputs.get(view.id) }),
      actions: slot("actions", { items: actions }),
      heading: slot("identity", { items: [
        text(reference ? "Document reference" : "Working document", "title"),
        text(`${name} · ${view.placement}`, "muted"),
      ] }),
      footer: text(reference
        ? "This reference stays connected to the working draft."
        : "Keep writing here.", "muted"),
    });
    const id = reference ? "context:reference" : "context:desk";
    const overrides = reference ? {
      document: this.referenceExpanded ? "expanded" : "compact",
      density: this.referenceExpanded ? "comfortable" : "compact",
      surface: "muted",
    } : {};
    // Context belongs to the embedding location. Moving an appearance into
    // another location changes its presentation, not its source or editor.
    return scope(id, overrides, slot("embedding", {
      heading: text(reference ? "Reading pane" : "Writing desk", "title"),
      tools: reference ? this.action("context:reference:toggle",
        this.referenceExpanded ? "Compact reference" : "Expand reference",
        () => { this.referenceExpanded = !this.referenceExpanded; }) : null,
      content: card,
    }, { id }));
  }

  render(cx) {
    const snapshot = this.host.snapshot();
    const source = snapshot.sources[0];
    const latest = snapshot.receipts[snapshot.receipts.length - 1];
    const secondary = snapshot.projections.find(view => view.id === this.host.ids.secondary);
    const ordered = [...snapshot.projections].sort((a, b) => (a.placement === "main" ? -1 : 1) - (b.placement === "main" ? -1 : 1));
    return realize(slot("workbench", {
      heading: text("One document, two contexts", "heading"),
      description: text("Edit either title. Change the reading pane’s presentation; the writing desk stays the same."),
      tools: slot("actions", { items: [
        this.action("fixture:external-update", "Simulate external edit", () => this.host.externalUpdate(this.host.ids.source, "Updated elsewhere")),
        this.action("fixture:toggle-authority", secondary.allowedActions.length ? "Restrict appearance B" : "Restore appearance B", () =>
          this.host.setEnvelope(secondary.id, secondary.allowedActions.length ? [] : ["edit", "commit", "rebase", "search"])),
      ] }),
      appearances: slot("appearances", { items: ordered.map(view => this.appearance(view)) }),
      source: slot("record", {
        heading: text("Committed source", "title"),
        content: text(source.title),
        detail: text(`${source.id} · revision ${source.revision}`, "muted"),
      }),
      receipt: slot("record", {
        heading: text(`Outcome: ${latest.status} / ${latest.code}`, "title"),
        content: text(latest.message),
        detail: text(latest.projectionId ?? latest.sourceId ?? "fixture host", "muted"),
      }),
      note: text("Local fixture · no persistence or Grove runtime. Enter commits. Moving changes in-window placement. Keeping a draft on the latest revision does not merge text.", "muted"),
    }), gpuiBindings(cx));
  }
}
