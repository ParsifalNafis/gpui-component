// AI-assisted behavioral checks for the deterministic host fixture, not GPUI rendering.
import test from "node:test";
import assert from "node:assert/strict";
import { createFixture } from "./fixture.js";

test("two appearances share the Flow draft without making snapshots writable", () => {
  const host = createFixture();
  const { primary, secondary } = host.ids;
  host.changeDraft(primary, "Private working title");
  assert.equal(host.draftFor(secondary).title, "Private working title");
  const snapshot = host.snapshot();
  snapshot.projections[0].draft.title = "tampered";
  snapshot.projections[0].allowedActions.length = 0;
  assert.equal(host.draftFor(primary).title, "Private working title");
  assert.equal(host.commit(primary).status, "ok");
});

test("moving and remounting retain identity, source, Flow, and uncommitted draft", () => {
  const host = createFixture();
  const { primary, source, flow } = host.ids;
  host.changeDraft(primary, "Resume me");
  host.move(primary, "detached-window");
  host.unmount(primary);
  assert.equal(host.commit(primary).status, "refused");
  host.mount(primary);
  const view = host.snapshot().projections.find(item => item.id === primary);
  assert.equal(view.sourceId, source);
  assert.equal(view.flowId, flow);
  assert.equal(view.placement, "detached-window");
  assert.equal(view.draft.title, "Resume me");
  assert.equal(host.commit(primary).sourceId, source);
});

test("source refresh cannot update the draft's revision basis; conflict preserves it", () => {
  const host = createFixture();
  const { primary, secondary, source } = host.ids;
  host.changeDraft(primary, "My edit");
  host.externalUpdate(source, "Someone else's edit");
  const conflict = host.commit(secondary);
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.expectedRevision, 1);
  assert.equal(conflict.actualRevision, 2);
  assert.equal(host.draftFor(primary).title, "My edit");
  assert.equal(host.snapshot().sources[0].title, "Someone else's edit");
  assert.equal(host.rebase(primary).code, "rebased");
  assert.equal(host.draftFor(primary).title, "My edit");
  assert.equal(host.commit(secondary).status, "ok");
  assert.equal(host.snapshot().sources[0].title, "My edit");
  assert.equal(host.draftFor(primary).dirty, false);
});

test("current appearance envelope controls commit even after moving", () => {
  const host = createFixture();
  const { primary, secondary } = host.ids;
  host.changeDraft(primary, "Still private");
  host.setEnvelope(secondary, ["edit"]);
  host.move(secondary, "main");
  const denied = host.commit(secondary);
  assert.equal(denied.code, "outside-envelope");
  assert.equal(host.snapshot().sources[0].revision, 1);
  assert.equal(host.draftFor(secondary).title, "Still private");
  assert.equal(host.commit(primary).status, "ok");
});

test("another Flow gets an independent draft even for the same source", () => {
  const host = createFixture();
  host.openAppearance({ id: "other-appearance", flowId: "other-flow" });
  host.changeDraft(host.ids.primary, "Working Flow only");
  assert.equal(host.draftFor("other-appearance").title, "A continuous body of work");
  assert.equal(host.startSearch(host.ids.primary, "", "other-appearance").receipt.status, "refused");
});

test("latest search wins, keeps source references, and tickets cannot replay", () => {
  const host = createFixture();
  const first = host.startSearch(host.ids.primary, "missing");
  const last = host.startSearch(host.ids.primary, "continuous");
  assert.equal(host.completeSearch(last.ticketId).status, "ok");
  assert.equal(host.completeSearch(first.ticketId).status, "stale");
  assert.equal(host.completeSearch(last.ticketId).code, "consumed-ticket");
  assert.deepEqual(host.snapshot().results[0].items, [{ sourceId: host.ids.source }]);
  assert.equal(host.snapshot().results[0].query, "continuous");
});

test("unmount/remount invalidates destination delivery but presentation moves do not", () => {
  const host = createFixture();
  const beforeUnmount = host.startSearch(host.ids.primary, "");
  host.unmount(host.ids.secondary);
  host.mount(host.ids.secondary);
  assert.equal(host.completeSearch(beforeUnmount.ticketId).status, "stale");
  assert.equal(host.snapshot().results.length, 0);
  const beforeMove = host.startSearch(host.ids.primary, "");
  host.move(host.ids.secondary, "main");
  assert.equal(host.completeSearch(beforeMove.ticketId).status, "ok");
});

test("a pending invocation loses delivery when its origin unmounts or permission changes", () => {
  const host = createFixture();
  const orphaned = host.startSearch(host.ids.primary, "");
  host.unmount(host.ids.primary);
  host.mount(host.ids.primary);
  assert.equal(host.completeSearch(orphaned.ticketId).status, "stale");
  const revoked = host.startSearch(host.ids.primary, "");
  host.setEnvelope(host.ids.primary, ["edit"]);
  assert.equal(host.completeSearch(revoked.ticketId).status, "refused");
  assert.equal(host.snapshot().results.length, 0);
});

test("unknown sources and duplicate appearances refuse without changing the target", () => {
  const host = createFixture();
  assert.equal(host.openAppearance({ id: host.ids.primary }).status, "refused");
  const search = host.startSearch(host.ids.primary, "");
  assert.equal(host.completeSearch(search.ticketId, [{ sourceId: "unadmitted" }]).status, "refused");
  assert.equal(host.snapshot().results.length, 0);
  assert.equal(host.snapshot().projections.length, 2);
});

test("the newest request owns a shared destination even across invoking appearances", () => {
  const host = createFixture();
  const first = host.startSearch(host.ids.primary, "old");
  const newest = host.startSearch(host.ids.secondary, "continuous");
  assert.equal(host.completeSearch(newest.ticketId).status, "ok");
  assert.equal(host.completeSearch(first.ticketId).status, "stale");
  assert.equal(host.snapshot().results[0].query, "continuous");
});

test("regranting permission does not revive work admitted before revocation", () => {
  const host = createFixture();
  const revoked = host.startSearch(host.ids.primary, "");
  host.setEnvelope(host.ids.primary, ["edit"]);
  host.setEnvelope(host.ids.primary, ["edit", "search"]);
  assert.equal(host.completeSearch(revoked.ticketId).code, "revoked-search-grant");
  const newlyAdmitted = host.startSearch(host.ids.primary, "");
  assert.equal(host.completeSearch(newlyAdmitted.ticketId).status, "ok");
});

test("no-op edits, commits and rebases do not create false conflicts", () => {
  const host = createFixture();
  host.openAppearance({ id: "other-appearance", flowId: "other-flow" });
  const initial = host.draftFor(host.ids.primary);
  host.changeDraft(host.ids.primary, "temporary");
  host.changeDraft(host.ids.primary, initial.title);
  assert.equal(host.draftFor(host.ids.primary).dirty, false);
  assert.equal(host.commit(host.ids.primary).code, "unchanged");
  assert.equal(host.rebase(host.ids.primary).code, "unchanged");
  assert.equal(host.snapshot().sources[0].revision, initial.baseRevision);
  host.changeDraft("other-appearance", "Other Flow edit");
  assert.equal(host.commit("other-appearance").status, "ok");
});

test("dirty compares with the captured base; a stale clean draft still cannot overwrite", () => {
  const host = createFixture();
  const initial = host.draftFor(host.ids.primary);
  host.externalUpdate(host.ids.source, "New source title");
  host.changeDraft(host.ids.primary, "temporary");
  host.changeDraft(host.ids.primary, initial.title);
  assert.equal(host.draftFor(host.ids.primary).dirty, false);
  assert.equal(host.commit(host.ids.primary).status, "conflict");
  host.rebase(host.ids.primary);
  assert.equal(host.draftFor(host.ids.primary).dirty, true);
});

test("a closed appearance can move its reserved placement without remounting or changing context", () => {
  const host = createFixture();
  host.changeDraft(host.ids.primary, "Retained while closed");
  host.unmount(host.ids.primary);
  const before = host.snapshot().projections.find(view => view.id === host.ids.primary);
  assert.equal(host.move(host.ids.primary, "embedded").status, "ok");
  const moved = host.snapshot().projections.find(view => view.id === host.ids.primary);
  assert.equal(moved.placement, "embedded");
  assert.equal(moved.mounted, false);
  assert.equal(moved.lifetime, before.lifetime);
  assert.equal(moved.sourceId, before.sourceId);
  assert.equal(moved.flowId, before.flowId);
  assert.deepEqual(moved.draft, before.draft);
  assert.equal(host.move("unknown-appearance", "main").status, "refused");
  host.mount(host.ids.primary);
  assert.equal(host.commit(host.ids.primary).status, "ok");
});
