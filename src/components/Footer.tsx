import { Link } from "react-router-dom";
import { Bot } from "lucide-react";

export function Footer() {
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
          <p className="mt-3 max-w-sm text-sm text-zinc-400">
            The autonomous AI admin that hunts leads, closes sales and runs your
            business operations 24/7.
          </p>
        </div>
        <div className="text-sm text-zinc-400">
          <p className="mb-2 font-semibold text-zinc-200">Contact</p>
          <p>📧 support@ia-admin-adjunta.com</p>
          <p className="mt-1">💬 WhatsApp: +244 923 012 293</p>
          <p className="mt-1">Payments: Multicaixa Express · PayPay · <Link to="/#payments" className="hover:text-gold-400">USD/EUR accounts</Link></p>
        </div>
        <div className="text-sm text-zinc-400">
          <p className="mb-2 font-semibold text-zinc-200">Company</p>
          <p>Fontes AI Admin Adjunta Solutions</p>
          <p className="mt-1">© 2026 · All rights reserved</p>
          <p className="mt-1">30-day money-back guarantee</p>
        </div>
      </div>
    </footer>
  );
}
