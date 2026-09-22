import { Plus } from "lucide-react";
import type { Client, Order } from "../../../types";
import { formatKz } from "../../../lib/engine";
import { PaymentDetails } from "../../../components/PaymentDetails";
import { useT } from "../../../lib/i18n";

// ---------- Orders ----------

export function OrdersTab({
  orders,
  clients,
  onNew,
  onMarkPaid,
}: {
  orders: Order[];
  clients: Client[];
  onNew: (e: React.FormEvent<HTMLFormElement>) => void;
  onMarkPaid: (id: string) => void;
}) {
  const t = useT();
  const methodLabel = (method: string): string => {
    const key = `dash.orders.methods.${method}`;
    const v = t(key);
    return v === key ? method : v;
  };
  return (
    <div className="mt-8 space-y-6">
      <form onSubmit={onNew} className="card grid gap-4 p-6 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">{t("dash.orders.client")}</label>
          <select name="client_id" className="input">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="">{t("dash.orders.walkin")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("dash.orders.amount")}</label>
          <input name="amount" type="number" min="1000" step="1" required className="input" placeholder="29160" />
        </div>
        <div>
          <label className="label">{t("dash.orders.method")}</label>
          <select name="method" className="input">
            <option value="multicaixa">{t("dash.orders.methods.multicaixa")}</option>
            <option value="paypay">{t("dash.orders.methods.paypay")}</option>
            <option value="card">{t("dash.orders.methods.card")}</option>
            <option value="wire_usd">{t("dash.orders.methods.wire_usd")}</option>
            <option value="wire_eur">{t("dash.orders.methods.wire_eur")}</option>
          </select>
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            <Plus size={16} /> {t("dash.orders.create")}
          </button>
        </div>
      </form>

      {/* Official receiving accounts for invoicing / customer support */}
      <div className="card p-6">
        <PaymentDetails detailed />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-4">{t("dash.orders.thRef")}</th>
              <th className="px-5 py-4">{t("dash.orders.thClient")}</th>
              <th className="px-5 py-4">{t("dash.orders.thAmount")}</th>
              <th className="px-5 py-4">{t("dash.orders.thMethod")}</th>
              <th className="px-5 py-4">{t("dash.orders.thStatus")}</th>
              <th className="px-5 py-4">{t("dash.orders.thAction")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-white/5 transition hover:bg-white/5">
                <td className="px-5 py-4 font-mono text-xs text-zinc-300">{o.reference}</td>
                <td className="px-5 py-4 text-zinc-200">{o.client_name}</td>
                <td className="px-5 py-4 font-semibold text-zinc-100">{formatKz(o.amount)}</td>
                <td className="px-5 py-4 text-zinc-400">{methodLabel(o.method)}</td>
                <td className="px-5 py-4">
                  <span
                    className={`badge ${
                      o.status === "paid"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : o.status === "refunded"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {t(`dash.statusOrder.${o.status}`)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {o.status === "pending" ? (
                    <button
                      onClick={() => onMarkPaid(o.id)}
                      className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                    >
                      {t("dash.orders.markPaid")}
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

