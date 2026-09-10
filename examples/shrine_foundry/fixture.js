// Deterministic local host fixture. Not Grove, durable storage, or real authorization.
// AI-assisted proof: semantic state stays here; views receive copied projections.
export function createFixture() {
  const ids = Object.freeze({
    source: "source-document-42", flow: "flow-working",
    primary: "appearance-editor-a", secondary: "appearance-editor-b",
  });
  const copy = value => JSON.parse(JSON.stringify(value));
  const sources = new Map([[ids.source, {
    id: ids.source, title: "A continuous body of work", revision: 1,
  }]]);
  const flows = new Map([[ids.flow, { id: ids.flow, drafts: new Map() }]]);
  const projections = new Map();
  const receipts = [];
  const results = new Map();
  const tickets = new Map();
  const latest = new Map();
  const latestDestination = new Map();
  const searchGrants = new Map();
  let serial = 0;

  function receipt(status, code, message, details = {}) {
    const value = { id: `receipt-${++serial}`, status, code, message, ...details };
    receipts.push(value);
    if (receipts.length > 40) receipts.shift();
    return copy(value);
  }

  function projection(id) { return projections.get(id); }
  function context(view) {
    return { projectionId: view.id, sourceId: view.sourceId, flowId: view.flowId };
  }
  function guard(id, action) {
    const view = projection(id);
    if (!view || !view.mounted) {
      return receipt("refused", "unavailable", "This appearance is not mounted.", { projectionId: id });
    }
    if (action && !view.allowedActions.includes(action)) {
      return receipt("refused", "outside-envelope", "This appearance does not admit that action.", {
        ...context(view), action,
      });
    }
    return null;
  }
  function draft(view) {
    const owned = flows.get(view.flowId).drafts;
    if (!owned.has(view.sourceId)) {
      const source = sources.get(view.sourceId);
      owned.set(source.id, {
        sourceId: source.id, title: source.title, baseTitle: source.title,
        baseRevision: source.revision, dirty: false,
      });
    }
    return owned.get(view.sourceId);
  }

  function openAppearance({ id, sourceId = ids.source, flowId = ids.flow,
    placement = "embedded", allowedActions = ["edit", "commit", "rebase", "search"] }) {
    if (projections.has(id) || !id || !sources.has(sourceId)) {
      return receipt("refused", "invalid-appearance", "An appearance needs a new identity and a known source.");
    }
    if (!flows.has(flowId)) flows.set(flowId, { id: flowId, drafts: new Map() });
    const view = { id, sourceId, flowId, placement, mounted: true, lifetime: 1,
      allowedActions: [...allowedActions] };
    projections.set(id, view);
    searchGrants.set(id, 1);
    draft(view);
    return receipt("ok", "appearance-opened", "The source has another appearance.", context(view));
  }

  openAppearance({ id: ids.primary, placement: "main" });
  openAppearance({ id: ids.secondary, placement: "embedded" });

  return {
    ids,
    openAppearance,
    snapshot() {
      return copy({
        mode: "Deterministic local host fixture — not Grove or real authorization",
        sources: [...sources.values()],
        flows: [...flows.values()].map(flow => ({ id: flow.id, drafts: [...flow.drafts.values()] })),
        projections: [...projections.values()].map(view => ({ ...view, draft: draft(view) })),
        receipts, results: [...results.values()],
      });
    },
    draftFor(id) { return projection(id) ? copy(draft(projection(id))) : null; },
    changeDraft(id, title) {
      const denied = guard(id, "edit");
      if (denied) return denied;
      const view = projection(id);
      const working = draft(view);
      working.title = String(title);
      working.dirty = working.title !== working.baseTitle;
      return receipt("ok", "draft-changed", "The Flow retains this working draft.", context(view));
    },
    commit(id) {
      const denied = guard(id, "commit");
      if (denied) return denied;
      const view = projection(id);
      const working = draft(view);
      const source = sources.get(view.sourceId);
      if (working.baseRevision !== source.revision) {
        return receipt("conflict", "revision-conflict", "The source changed. Your draft is still available.", {
          ...context(view), expectedRevision: working.baseRevision, actualRevision: source.revision,
        });
      }
      if (working.title === source.title) {
        working.dirty = false;
        return receipt("ok", "unchanged", "The draft already matches its source.", context(view));
      }
      source.title = working.title;
      source.revision += 1;
      working.baseTitle = source.title;
      working.baseRevision = source.revision;
      working.dirty = false;
      return receipt("ok", "committed", "The draft was committed to its source.", {
        ...context(view), revision: source.revision,
      });
    },
    rebase(id) {
      const denied = guard(id, "rebase");
      if (denied) return denied;
      const view = projection(id);
      const working = draft(view);
      const source = sources.get(view.sourceId);
      if (working.baseRevision === source.revision) {
        return receipt("ok", "unchanged", "The draft already uses the current revision.", context(view));
      }
      working.baseRevision = source.revision;
      working.baseTitle = source.title;
      working.dirty = working.title !== source.title;
      return receipt("ok", "rebased", "Kept your draft against the current revision; this does not merge text.", {
        ...context(view), revision: source.revision,
      });
    },
    externalUpdate(sourceId, title) {
      const source = sources.get(sourceId);
      if (!source) return receipt("refused", "unknown-source", "The source does not exist.", { sourceId });
      source.title = String(title);
      source.revision += 1;
      return receipt("ok", "external-update", "Simulated another writer changing the source.", {
        sourceId, revision: source.revision,
      });
    },
    move(id, placement) {
      const view = projection(id);
      if (!view) return receipt("refused", "unknown-appearance", "The appearance does not exist.");
      // Arrangement metadata survives even while its native realization is absent.
      view.placement = String(placement);
      return receipt("ok", "moved", "The appearance moved; its source and Flow did not change.", context(view));
    },
    unmount(id) {
      const denied = guard(id);
      if (denied) return denied;
      const view = projection(id);
      view.mounted = false;
      view.lifetime += 1;
      return receipt("ok", "unmounted", "The appearance is unmounted; its working context remains.", context(view));
    },
    mount(id) {
      const view = projection(id);
      if (!view) return receipt("refused", "unknown-appearance", "The appearance does not exist.");
      view.mounted = true;
      return receipt("ok", "mounted", "The same appearance resumed its working context.", context(view));
    },
    setEnvelope(id, allowedActions) {
      const view = projection(id);
      if (!view) return receipt("refused", "unknown-appearance", "The appearance does not exist.");
      // Revoking a search grant retires pending work even if a later grant replaces it.
      if (view.allowedActions.includes("search") && !allowedActions.includes("search")) {
        searchGrants.set(id, searchGrants.get(id) + 1);
      }
      view.allowedActions = [...allowedActions];
      return receipt("ok", "envelope-changed", "The fixture host changed the admitted actions.", context(view));
    },
    startSearch(id, query, destinationId = ids.secondary) {
      const denied = guard(id, "search") || guard(destinationId);
      if (denied) return { ticketId: null, receipt: denied };
      const origin = projection(id);
      const destination = projection(destinationId);
      // This fixture permits delivery only within the same admitted working Flow.
      if (origin.flowId !== destination.flowId) {
        return { ticketId: null, receipt: receipt("refused", "cross-flow-delivery",
          "This fixture has no admission for delivery into another Flow.", context(origin)) };
      }
      const ticketId = `search-${++serial}`;
      tickets.set(ticketId, {
        id: ticketId, origin: id, destination: destinationId,
        originLifetime: origin.lifetime, destinationLifetime: destination.lifetime,
        searchGrant: searchGrants.get(id),
        query: String(query), done: false,
      });
      latest.set(id, ticketId);
      latestDestination.set(destinationId, ticketId);
      return { ticketId, receipt: receipt("pending", "search-started", "A local search is pending.", {
        ...context(origin), ticketId, destinationId,
      }) };
    },
    completeSearch(ticketId, items) {
      const ticket = tickets.get(ticketId);
      if (!ticket || ticket.done) {
        return receipt("stale", "consumed-ticket", "This search ticket is absent or already consumed.", { ticketId });
      }
      ticket.done = true;
      const origin = projection(ticket.origin);
      const destination = projection(ticket.destination);
      if (latest.get(ticket.origin) !== ticketId || latestDestination.get(ticket.destination) !== ticketId
        || !origin?.mounted || !destination?.mounted
        || origin.lifetime !== ticket.originLifetime || destination.lifetime !== ticket.destinationLifetime) {
        return receipt("stale", "stale-delivery", "This result no longer belongs to the current appearance lifetime.", { ticketId });
      }
      const denied = guard(ticket.origin, "search");
      if (denied) return denied;
      if (ticket.searchGrant !== searchGrants.get(ticket.origin)) {
        return receipt("refused", "revoked-search-grant", "The grant for this pending search was revoked.", { ticketId });
      }
      const matches = items ?? [...sources.values()]
        .filter(source => source.title.toLowerCase().includes(ticket.query.toLowerCase()))
        .map(source => ({ sourceId: source.id }));
      if (!Array.isArray(matches) || matches.some(item => !sources.has(item?.sourceId))) {
        return receipt("refused", "unknown-result-source", "Search results must retain known source references.", { ticketId });
      }
      results.set(destination.id, {
        destinationId: destination.id, query: ticket.query,
        items: matches.map(item => ({ sourceId: item.sourceId })),
      });
      return receipt("ok", "search-delivered", "The newest search result reached its intended appearance.", {
        ...context(origin), ticketId, destinationId: destination.id,
      });
    },
  };
}
