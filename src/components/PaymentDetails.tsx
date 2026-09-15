import { Copy, Check, Landmark, Globe } from "lucide-react";
import { useState } from "react";

const USD_ACCOUNT = {
  currency: "USD",
  bank: "Lead Bank",
  type: "Checking (Corrente)",
  account: "210056540304",
  routing: "101019644",
  beneficiary: "IGOR ANDRÉ MAXIMIANO RUSSO FONTES",
  beneficiaryAddress: "Kifika, Luanda, LUANDA 0000, Angola",
  bankAddress: "1801 Main St., Kansas City, MO 64108, USA",
};

const EUR_ACCOUNT = {
  currency: "EUR",
  bank: "Banking Circle S.A.",
  type: "SEPA / SWIFT",
  iban: "LU154080000048747984",
  bic: "BCIRLULL",
  beneficiary: "IGOR ANDRE MAXIMIANO RUSSO FONTES",
  bankAddress: "2 Boulevard de la Foire, L-1528 Luxembourg",
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-gold-500/40"
      title="Copy"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="block truncate font-mono text-sm text-zinc-100">{value}</span>
      </span>
      {copied ? (
        <Check size={14} className="shrink-0 text-emerald-400" />
      ) : (
        <Copy size={14} className="shrink-0 text-zinc-500 transition group-hover:text-gold-400" />
      )}
    </button>
  );
}

function AccountCard({ acc }: { acc: typeof USD_ACCOUNT | typeof EUR_ACCOUNT }) {
  const isUsd = acc.currency === "USD";
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 text-gold-400">
            <Landmark size={20} />
          </span>
          <div>
            <p className="font-semibold text-zinc-50">{acc.bank}</p>
            <p className="text-xs text-zinc-500">{acc.bankAddress}</p>
          </div>
        </div>
        <span className="badge bg-gold-500/15 font-bold text-gold-300">{acc.currency}</span>
      </div>

      <div className="mt-4 space-y-2">
        {isUsd ? (
          <>
            <CopyField label="Account number" value={(acc as typeof USD_ACCOUNT).account} />
            <CopyField label="Routing (ABA)" value={(acc as typeof USD_ACCOUNT).routing} />
          </>
        ) : (
          <>
            <CopyField label="IBAN" value={(acc as typeof EUR_ACCOUNT).iban} />
            <CopyField label="BIC / SWIFT" value={(acc as typeof EUR_ACCOUNT).bic} />
          </>
        )}
        <CopyField label="Beneficiary" value={acc.beneficiary} />
        {isUsd ? (
          <p className="text-xs text-zinc-500">
            {acc.type} · Beneficiary address: {(acc as typeof USD_ACCOUNT).beneficiaryAddress}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Official receiving accounts for products purchased on this app/website.
 * Shown on the public site (compact intro) and inside the command center
 * (orders tab) so staff can share exact details when invoicing.
 */
export function PaymentDetails({ detailed = false }: { detailed?: boolean }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-400">
          <Globe size={18} />
        </span>
        <div>
          <h3 className="text-lg font-bold text-zinc-50">International payments (USD / EUR)</h3>
          <p className="mt-1 text-sm text-zinc-400">
            These accounts receive payments for products purchased on our app/website.
            Always include your <span className="font-semibold text-gold-300">order reference</span> in
            the transfer description so the payment is matched automatically.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AccountCard acc={USD_ACCOUNT} />
        <AccountCard acc={EUR_ACCOUNT} />
      </div>

      {detailed ? (
        <p className="mt-4 text-xs text-zinc-500">
          Local payments: Multicaixa Express and PayPay references are generated automatically with each
          order. International transfers are confirmed manually after the funds arrive — contact support
          with the transfer receipt if you need expedited activation.
        </p>
      ) : null}
    </div>
  );
}
