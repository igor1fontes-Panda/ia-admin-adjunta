import { useState } from "react";

export function CheckoutButton({ plan, label, primary = false }: { plan: string; label: string; primary?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, quantity: 1 }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout is unavailable.");
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout is unavailable.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={`${primary ? "btn-primary" : "btn-ghost"} w-full disabled:cursor-wait disabled:opacity-60`}
      >
        {loading ? "Opening secure checkout…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-amber-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
