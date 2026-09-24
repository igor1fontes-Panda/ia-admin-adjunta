import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { useT } from "../lib/i18n";

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500 text-ink-950">
              <Bot size={20} />
            </span>
            <span className="font-bold text-zinc-50">Fontes AI Admin Adjunta</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-zinc-400">{t("footer.tag")}</p>
        </div>
        <div className="text-sm text-zinc-400">
          <p className="mb-2 font-semibold text-zinc-200">{t("footer.contact")}</p>
          <p>📧 support@ia-admin-adjunta.com</p>
          <p className="mt-1">💬 WhatsApp: +244 923 012 293</p>
          <p className="mt-1">
            {t("footer.payments")}{" "}
            <Link to="/#payments" className="hover:text-gold-400">
              {t("footer.paymentsLink")}
            </Link>
          </p>
        </div>
        <div className="text-sm text-zinc-400">
          <p className="mb-2 font-semibold text-zinc-200">{t("footer.company")}</p>
          <p>Fontes AI Admin Adjunta Solutions</p>
          <p className="mt-1">{t("footer.rights")}</p>
          <p className="mt-1">{t("footer.terms")}</p>
        </div>
      </div>
    </footer>
  );
}
