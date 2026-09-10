// A small hand-authored recipe fixture, not Grove syntax or a Foundry resolver.
// Slots carry supplied content. Recipes own arrangement; bindings own native APIs.
export const recipes = Object.freeze({
  workbench: { hook: "page", slots: ["heading", "description", "tools", "appearances", "source", "receipt", "note"] },
  appearances: { hook: "row", slots: ["items"] },
  appearance: { hook: "panel", slots: ["heading", "identity", "content", "actions", "state"] },
  identity: { hook: "stack", slots: ["items"] },
  actions: { hook: "row", slots: ["items"] },
  record: { hook: "record", slots: ["heading", "content", "detail"] },
  text: { hook: "text", slots: [] },
  button: { hook: "button", slots: [] },
  input: { hook: "input", slots: [] },
});

export function slot(recipe, slots = {}, props = {}) {
  return { recipe, slots, props };
}

export const text = (value, tone = "body") => slot("text", {}, { value, tone });

// Explicit recipe and hook lookup: no eval, arbitrary method dispatch, or field
// name inference. The fixture deliberately has no semantic admission authority.
export function realize(node, bindings) {
  const recipe = recipes[node.recipe];
  if (!recipe || !Object.hasOwn(recipes, node.recipe)) {
    throw new Error(`Unknown recipe: ${node.recipe}`);
  }
  for (const name of Object.keys(node.slots)) {
    if (!recipe.slots.includes(name)) throw new Error(`Unknown slot: ${node.recipe}.${name}`);
  }
  const children = recipe.slots.flatMap(name => {
    const content = node.slots[name];
    return content == null ? [] : (Array.isArray(content) ? content : [content]);
  }).map(child => realize(child, bindings));
  return bindings[recipe.hook](node.props, children);
}
