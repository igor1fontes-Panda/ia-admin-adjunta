// Dicionário PT — fonte da verdade, dividido por domínio em src/lib/i18n/pt/.
// O EN (src/lib/i18n/en/) tem de ter exatamente a mesma forma de chaves
// (verificado por src/lib/i18n.parity.test.tsx).
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

export const pt = {
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
} as const;

/**
 * Versão "widened" do dicionário PT: converte literais em string/number
 * recursivamente para que o EN possa diferir nos valores sem quebrar tipos.
 */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends readonly unknown[]
      ? { [K in keyof T]: Widen<T[K]> } extends infer M
        ? { [K in keyof M]: M[K] }
        : never
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;

export type Dict = Widen<typeof pt>;
