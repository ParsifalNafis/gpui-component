import { slot, text } from "./foundry.js";

// One reusable component. It knows the document projection, but neither its
// embedding location nor GPUI. The caller supplies the heading/footer/actions;
// the receiving Foundry context selects the recipe and native presentation.
export function documentCard(view, { source, editor, actions, heading, footer }) {
  const draftStatus = view.draft.baseRevision !== source.revision
    ? "source changed"
    : (view.draft.dirty ? "uncommitted draft" : "saved");
  return slot("document", {
    heading,
    identity: slot("identity", { items: [
      text(`Source: ${view.sourceId}`, "muted"),
      text(`Flow: ${view.flowId}`, "muted"),
      text(`Route: ${view.id}`, "muted"),
    ] }),
    content: view.mounted
      ? (view.allowedActions.includes("edit") ? editor : text(`Read only: ${view.draft.title}`))
      : text("Appearance closed. The shared draft remains in its Flow."),
    actions,
    state: text(view.mounted
      ? `Base revision ${view.draft.baseRevision} · ${draftStatus} · ${view.allowedActions.length ? "actions admitted" : "actions refused"}`
      : "Local input released; reopen to create a fresh native editor.", "muted"),
    footer,
  }, { id: view.id });
}
