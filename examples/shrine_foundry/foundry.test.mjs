import assert from "node:assert/strict";
import test from "node:test";
import { realize, recipes, scope, slot, text } from "./foundry.js";
import { documentCard } from "./document-card.js";
import { createFixture } from "./fixture.js";

// These tests describe the explicit JS fixture, not a Grove resolver or security.
const defaults = { id: "workbench", document: "expanded", density: "comfortable", surface: "surface" };
const bindings = Object.fromEntries(Object.values(recipes).map(({ hook }) => [
  hook, (props, children, context) => ({ hook, props, children, context }),
]));
const row = (...items) => slot("appearances", { items });
const document = () => slot("document", Object.fromEntries(
  recipes.document.slots.map(name => [name, text(name)]),
), { id: "same-document" });
const labels = rendered => rendered.children.map(child => child.props.value);

function freezeTree(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

test("every native hook receives the frozen default context", () => {
  for (const name of Object.keys(recipes)) {
    const rendered = realize(slot(name), bindings);
    assert.deepEqual(rendered.context, defaults);
    assert.equal(Object.isFrozen(rendered.context), true);
    assert.throws(() => { rendered.context.density = "compact"; }, TypeError);
  }
});

test("nested scopes inherit and restore context through receiving slots", () => {
  const supplied = document();
  const overrides = Object.freeze({ document: "compact", density: "compact", surface: "muted" });
  const node = freezeTree(row(
    scope("reference", overrides, slot("embedding", {
      heading: text("Reference"),
      content: row(
        supplied,
        scope("nested", { document: "expanded", density: "comfortable" }, slot("embedding", { content: supplied })),
        supplied,
      ),
    })),
    supplied,
  ));
  const rendered = realize(node, bindings);
  const [reference, outside] = rendered.children;
  const [before, nested, after] = reference.children[1].children;
  assert.equal(reference.hook, "embedding"); // The scope adds no native wrapper.
  assert.deepEqual(reference.context, { id: "reference", ...overrides });
  assert.equal(reference.children[0].context, reference.context);
  assert.equal(before.context, reference.context);
  assert.equal(after.context, reference.context);
  assert.deepEqual(nested.context, { id: "nested", ...overrides, document: "expanded", density: "comfortable" });
  assert.equal(nested.children[0].context, nested.context);
  assert.equal(Object.isFrozen(nested.context), true);
  assert.equal(labels(nested.children[0]).includes("identity"), true);
  assert.equal(labels(before).includes("identity"), false);
  assert.equal(labels(after).includes("identity"), false);
  assert.deepEqual(outside.context, defaults);
  assert.equal(rendered.context, outside.context);
  assert.deepEqual(overrides, { document: "compact", density: "compact", surface: "muted" });
});

test("one unchanged document node realizes in expanded and compact arrangements", () => {
  const supplied = freezeTree(document());
  const before = JSON.stringify(supplied);
  const rendered = realize(row(
    supplied,
    scope("reference", { document: "compact" }, supplied),
    scope("nested-expanded", { document: "expanded", density: "compact" }, supplied),
  ), bindings);
  const [expanded, compact, denseExpanded] = rendered.children;
  assert.deepEqual(labels(expanded), ["heading", "identity", "content", "actions", "state", "footer"]);
  assert.deepEqual(labels(compact), ["heading", "content", "actions", "state", "footer"]);
  assert.deepEqual(labels(denseExpanded), labels(expanded));
  assert.equal(expanded.hook, "document");
  assert.equal(compact.hook, "document");
  assert.equal(expanded.props, compact.props);
  assert.equal(JSON.stringify(supplied), before);
  assert.equal(supplied.slots.identity.props.value, "identity");
});

test("compact selection cannot hide an unknown supplied slot", () => {
  const invalid = slot("document", { heading: text("Title"), hidden: text("Unexpected") });
  for (const variant of ["expanded", "compact"]) {
    assert.throws(() => realize(scope("reference", { document: variant }, invalid), bindings),
      /Unknown slot: document.hidden/);
  }
});

test("scope overrides accept only the bounded presentation values", () => {
  for (const name of ["hook", "bindings", "id", "permission", "toString", Symbol("extra")]) {
    assert.throws(() => realize(scope("reference", { [name]: "anything" }, text("x")), bindings),
      /Unknown scope override/);
  }
  for (const [name, value] of [
    ["document", "arbitrary"], ["density", "wide"], ["surface", "sidebar"],
    ["document", undefined], ["density", null], ["surface", {}],
  ]) {
    assert.throws(() => realize(scope("reference", { [name]: value }, text("x")), bindings),
      /Invalid scope override/);
  }
  assert.throws(() => realize(scope("", {}, text("x")), bindings), /Invalid scope id/);
  assert.throws(() => realize(scope("reference", [], text("x")), bindings), /Invalid scope overrides/);
});

test("the reusable documentCard keeps caller slots local over shared fixture data", () => {
  const host = createFixture();
  host.changeDraft(host.ids.primary, "Shared working title");
  const snapshot = freezeTree(host.snapshot());
  const source = snapshot.sources[0];
  const cards = snapshot.projections.map((view, index) => documentCard(view, {
    source,
    editor: slot("input", {}, { id: view.id, value: view.draft.title }),
    actions: slot("actions", { items: slot("button", {}, { label: `Action ${index}` }) }),
    heading: text(index === 0 ? "Working document" : "Document reference"),
    footer: text(index === 0 ? "Keep writing here." : "Connected to the working draft."),
  }));
  freezeTree(cards);
  const [desk, reference] = realize(row(
    scope("desk", {}, cards[0]),
    scope("reference", { document: "compact", density: "compact", surface: "muted" }, cards[1]),
  ), bindings).children;
  assert.deepEqual(desk.children.map(child => child.hook), ["text", "stack", "input", "row", "text", "text"]);
  assert.deepEqual(reference.children.map(child => child.hook), ["text", "input", "row", "text", "text"]);
  assert.equal(desk.children[0].props.value, "Working document");
  assert.equal(reference.children[0].props.value, "Document reference");
  assert.equal(desk.children.at(-1).props.value, "Keep writing here.");
  assert.equal(reference.children.at(-1).props.value, "Connected to the working draft.");
  for (const rendered of [desk, reference]) {
    assert.equal(rendered.children.find(child => child.hook === "input").props.value, "Shared working title");
    assert.equal(rendered.children.every(child => child.context === rendered.context), true);
  }
  assert.equal(desk.props.id, host.ids.primary);
  assert.equal(reference.props.id, host.ids.secondary);
  assert.equal(desk.children[1].children[0].props.value, `Source: ${source.id}`);
  const expandedReference = realize(scope("reference", { document: "expanded" }, cards[1]), bindings);
  assert.equal(expandedReference.children[1].children[0].props.value, `Source: ${source.id}`);
  assert.equal(expandedReference.children[1].children[1].props.value, `Flow: ${host.ids.flow}`);
  assert.equal(expandedReference.children[0].props.value, "Document reference");
  assert.equal(reference.context.document, "compact");
  assert.equal(desk.context.document, "expanded");
  assert.deepEqual(host.snapshot(), snapshot);
  assert.equal(source.title, "A continuous body of work");
  assert.equal(source.revision, 1);
});

test("recipe and hook lookup is explicit and cannot be redirected by props", () => {
  assert.throws(() => realize(slot("unknown"), bindings), /Unknown recipe: unknown/);
  assert.throws(() => realize(slot("toString"), bindings), /Unknown recipe: toString/);
  assert.throws(() => realize(text("x"), {}), /Unknown binding hook: text/);
  assert.throws(() => realize(text("x"), { text: 42 }), /Unknown binding hook: text/);
  assert.throws(() => realize(text("x"), Object.create(bindings)), /Unknown binding hook: text/);
  assert.throws(() => realize({ kind: "arbitrary" }, bindings), /Unknown node kind: arbitrary/);
  assert.equal(realize(slot("text", {}, { value: "x", hook: "arbitrary" }), bindings).hook, "text");
});

test("repeated realizations and failed scopes never leak context", () => {
  const supplied = document();
  for (let pass = 0; pass < 3; pass += 1) {
    const scoped = realize(scope("reference", {
      document: "compact", density: "compact", surface: "muted",
    }, supplied), bindings);
    assert.equal(scoped.context.id, "reference");
    assert.equal(labels(scoped).includes("identity"), false);
    assert.throws(() => realize(scope("failed", { document: "invalid" }, supplied), bindings));
    const ordinary = realize(supplied, bindings);
    assert.deepEqual(ordinary.context, defaults);
    assert.equal(labels(ordinary).includes("identity"), true);
  }
});
