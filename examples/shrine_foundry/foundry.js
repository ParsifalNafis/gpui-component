// A small hand-authored recipe fixture, not Grove syntax or a Foundry resolver.
// Slots carry supplied content. Recipes own arrangement; bindings own native APIs.
export const recipes = Object.freeze({
  workbench: { hook: "page", slots: ["heading", "description", "appearances", "tools", "source", "receipt", "note"] },
  appearances: { hook: "row", slots: ["items"] },
  document: { hook: "document", slots: ["heading", "identity", "content", "actions", "state", "footer"] },
  embedding: { hook: "embedding", slots: ["heading", "tools", "content"] },
  identity: { hook: "stack", slots: ["items"] },
  actions: { hook: "row", slots: ["items"] },
  record: { hook: "record", slots: ["heading", "content", "detail"] },
  text: { hook: "text", slots: [] },
  button: { hook: "button", slots: [] },
  input: { hook: "input", slots: [] },
});
for (const recipe of Object.values(recipes)) {
  Object.freeze(recipe.slots);
  Object.freeze(recipe);
}

const rootContext = Object.freeze({
  id: "workbench", document: "expanded", density: "comfortable", surface: "surface",
});
const contextValues = Object.freeze({
  document: Object.freeze(["expanded", "compact"]),
  density: Object.freeze(["comfortable", "compact"]),
  surface: Object.freeze(["surface", "muted"]),
});
const documentOrder = Object.freeze({
  expanded: recipes.document.slots,
  compact: Object.freeze(["heading", "content", "actions", "state", "footer"]),
});

export function slot(recipe, slots = {}, props = {}) {
  return { recipe, slots, props };
}

export const text = (value, tone = "body") => slot("text", {}, { value, tone });

// An explicit fixture convention, not Grove scope syntax or an authority boundary.
export function scope(id, overrides, content) {
  return { kind: "scope", id, overrides, content };
}

function scopedContext(parent, node) {
  if (typeof node.id !== "string" || !node.id.trim()) throw new Error("Invalid scope id");
  if (!node.overrides || typeof node.overrides !== "object" || Array.isArray(node.overrides)) {
    throw new Error("Invalid scope overrides");
  }
  const resolved = { ...parent, id: node.id };
  for (const name of Reflect.ownKeys(node.overrides)) {
    if (!Object.hasOwn(contextValues, name)) throw new Error(`Unknown scope override: ${String(name)}`);
    const value = node.overrides[name];
    if (!contextValues[name].includes(value)) throw new Error(`Invalid scope override: ${name}=${value}`);
    resolved[name] = value;
  }
  return Object.freeze(resolved);
}

// Explicit recipe and hook lookup: no eval, arbitrary method dispatch, or field
// name inference. The fixture deliberately has no semantic admission authority.
export function realize(node, bindings) {
  return realizeInContext(node, bindings, rootContext);
}

function realizeInContext(node, bindings, context) {
  if (!node || typeof node !== "object") throw new Error("Invalid recipe node");
  if (node.kind === "scope") {
    return realizeInContext(node.content, bindings, scopedContext(context, node));
  }
  if (node.kind != null) throw new Error(`Unknown node kind: ${node.kind}`);
  const recipe = recipes[node.recipe];
  if (!recipe || !Object.hasOwn(recipes, node.recipe)) {
    throw new Error(`Unknown recipe: ${node.recipe}`);
  }
  if (!node.slots || typeof node.slots !== "object" || Array.isArray(node.slots)) {
    throw new Error(`Invalid slots: ${node.recipe}`);
  }
  // Validate against the whole recipe before choosing the visible arrangement.
  for (const name of Reflect.ownKeys(node.slots)) {
    if (!recipe.slots.includes(name)) throw new Error(`Unknown slot: ${node.recipe}.${String(name)}`);
  }
  if (!Object.hasOwn(bindings, recipe.hook) || typeof bindings[recipe.hook] !== "function") {
    throw new Error(`Unknown binding hook: ${recipe.hook}`);
  }
  const order = node.recipe === "document" ? documentOrder[context.document] : recipe.slots;
  const children = order.flatMap(name => {
    const content = node.slots[name];
    return content == null ? [] : (Array.isArray(content) ? content : [content]);
  }).map(child => realizeInContext(child, bindings, context));
  return bindings[recipe.hook](node.props, children, context);
}
