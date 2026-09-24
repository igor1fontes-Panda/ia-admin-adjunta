/**
 * PT dictionary — source of truth for UI copy (PT is the default language).
 * The dictionary is split per domain under src/lib/i18n/pt/ (nav, dash,
 * academy, …) and re-assembled here so existing `./pt` imports keep working.
 * Key parity with EN is enforced by src/lib/i18n.parity.test.tsx.
 */
export { pt, type Dict } from "./pt/index";
