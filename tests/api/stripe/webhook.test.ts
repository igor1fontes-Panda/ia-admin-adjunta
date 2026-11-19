import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    orders: [] as Array<Record<string, any>>,
    deliveries: [] as Array<Record<string, any>>,
    activities: [] as Array<Record<string, any>>,
    reset: () => {},
  };
  const schema = {
    orders: { id: "orders.id", reference: "orders.reference" },
    deliveryStatus: { id: "deliveryStatus.id", order_id: "deliveryStatus.order_id" },
    activityLog: "activity_log",
  };
  let transactionQueue = Promise.resolve();
  state.reset = () => {
    state.orders.length = 0;
    state.deliveries.length = 0;
    state.activities.length = 0;
    transactionQueue = Promise.resolve();
  };

  const tx = {
    insert(table: unknown) {
      return {
        values(value: Record<string, any>) {
          if (table === schema.orders) {
            return {
              onConflictDoNothing() {
                return {
                  returning: async () => {
                    const existing = state.orders.find((row) => row.reference === value.reference);
                    if (existing) return [];
                    const row = { id: `order-${state.orders.length + 1}`, ...value };
                    state.orders.push(row);
                    return [{ id: row.id }];
                  },
                };
              },
            };
          }
          if (table === schema.deliveryStatus) {
            state.deliveries.push(value);
            return Promise.resolve();
          }
          if (table === schema.activityLog) {
            state.activities.push(value);
            return Promise.resolve();
          }
          throw new Error("Unexpected insert table");
        },
      };
    },
    select() {
      return {
        from(table: unknown) {
          return {
            where(condition: { column: unknown; value: unknown }) {
              const query = {
                for: () => query,
                limit: async () => {
                  if (table === schema.orders && condition.column === schema.orders.reference) {
                    return state.orders.filter((row) => row.reference === condition.value).slice(0, 1);
                  }
                  if (table === schema.deliveryStatus && condition.column === schema.deliveryStatus.order_id) {
                    return state.deliveries.filter((row) => row.order_id === condition.value).slice(0, 1);
                  }
                  return [];
                },
              };
              return query;
            },
          };
        },
      };
    },
  };

  const db = {
    transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      const previous = transactionQueue;
      let release!: () => void;
      transactionQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback(tx);
      } finally {
        release();
      }
    },
  };

  return {
    state,
    schema,
    db,
    constructEvent: vi.fn(),
    retrieveSetupIntent: vi.fn(),
  };
});

vi.mock("../../../db", () => ({ db: mocks.db, isDbConfigured: true }));
vi.mock("../../../db/schema", () => mocks.schema);
vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));
vi.mock("stripe", () => ({
  default: class StripeMock {
    webhooks = { constructEvent: mocks.constructEvent };
    setupIntents = { retrieve: mocks.retrieveSetupIntent };
  },
}));

import handler from "../../../api/stripe/webhook";

function makeRequest() {
  return {
    method: "POST",
    headers: { "stripe-signature": "test-signature" },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from("{}");
    },
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function paidCheckoutEvent() {
  return {
    id: "evt_checkout_paid",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_idempotent_123",
        object: "checkout.session",
        payment_status: "paid",
        amount_total: 12500,
        currency: "eur",
        customer_details: { name: "Test Customer", email: "customer@example.com" },
      },
    },
  };
}

beforeEach(() => {
  mocks.state.reset();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_placeholder");
  mocks.constructEvent.mockReturnValue(paidCheckoutEvent());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Stripe checkout webhook idempotency", () => {
  it("creates one order, delivery record and sale log for repeated delivery", async () => {
    const first = makeResponse();
    const retry = makeResponse();

    await handler(makeRequest(), first);
    await handler(makeRequest(), retry);

    expect(first.statusCode).toBe(200);
    expect(retry.statusCode).toBe(200);
    expect(mocks.state.orders).toHaveLength(1);
    expect(mocks.state.deliveries).toHaveLength(1);
    expect(mocks.state.activities).toHaveLength(1);
  });

  it("keeps concurrent deliveries idempotent through serialized transactions", async () => {
    const responses = [makeResponse(), makeResponse()];

    await Promise.all(responses.map((res) => handler(makeRequest(), res)));

    expect(responses.map((res) => res.statusCode)).toEqual([200, 200]);
    expect(mocks.state.orders).toHaveLength(1);
    expect(mocks.state.deliveries).toHaveLength(1);
    expect(mocks.state.activities).toHaveLength(1);
  });

  it("rejects an invalid signature without writing order data", async () => {
    mocks.constructEvent.mockImplementationOnce(() => {
      throw new Error("signature mismatch");
    });
    const res = makeResponse();

    await handler(makeRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(mocks.state.orders).toHaveLength(0);
    expect(mocks.state.deliveries).toHaveLength(0);
    expect(mocks.state.activities).toHaveLength(0);
  });
});
