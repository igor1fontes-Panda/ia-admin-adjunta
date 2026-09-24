/**
 * EN dictionary — mirrors every key of the PT source of truth.
 * Split per domain under src/lib/i18n/en/ and re-assembled here so existing
 * `./en` imports keep working. Key parity is enforced by
 * src/lib/i18n.parity.test.tsx.
 */
export { en } from "./en/index";
