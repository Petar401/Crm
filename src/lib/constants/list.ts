/**
 * Hard row cap for workspace-scoped list queries. Before this cap, every
 * `queries.ts` list read was unbounded, so a workspace with N companies /
 * contacts / deals sent all N rows over the wire (and re-fetched them on
 * every page render since dashboard pages are `force-dynamic`).
 *
 * The cap is intentionally generous — larger than any realistic single-tenant
 * workspace we expect to see this year — so it never truncates a real user's
 * view. The next step is proper `?page=` pagination on each list route,
 * which will replace the cap with a page-size × page-index range.
 */
export const LIST_LIMIT = 500;

/** Options endpoints (comboboxes / selects). */
export const OPTIONS_LIMIT = 100;
