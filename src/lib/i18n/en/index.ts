// EN dictionary — mirrors every key of the PT source of truth
// (src/lib/i18n/pt/), split per domain. Key parity is enforced by
// src/lib/i18n.parity.test.tsx.
import type { Dict } from "../pt";

import { nav } from "./nav";
import { lang } from "./lang";
import { agents } from "./agents";
import { ops } from "./ops";
import { academy } from "./academy";
import { hero } from "./hero";
import { features } from "./features";
import { eco } from "./eco";
import { lab } from "./lab";
import { how } from "./how";
import { pricing } from "./pricing";
import { cta } from "./cta";
import { auth } from "./auth";
import { footer } from "./footer";
import { setup } from "./setup";
import { leadForm } from "./leadForm";
import { pay } from "./pay";
import { dash } from "./dash";

export const en: Dict = {
  nav,
  lang,
  agents,
  ops,
  academy,
  hero,
  features,
  eco,
  lab,
  how,
  pricing,
  cta,
  auth,
  footer,
  setup,
  leadForm,
  pay,
  dash,
};
