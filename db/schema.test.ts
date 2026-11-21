// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { schema } from "./schema";

const productionSchema = {
  leads: {
    columns: {
      id: ["uuid", true],
      company: ["text", true],
      contact_name: ["text", true],
      email: ["text", true],
      niche: ["text", true],
      channel: ["text", true],
      score: ["integer", true],
      status: ["text", true],
      ai_action: ["text", false],
      created_at: ["timestamp with time zone", true],
    },
    indexes: ["leads_created_idx"],
    foreignKeys: [],
  },
  clients: {
    columns: {
      id: ["uuid", true],
      name: ["text", true],
      email: ["text", true],
      plan: ["text", true],
      mrr: ["numeric(12, 2)", true],
      status: ["text", true],
      created_at: ["timestamp with time zone", true],
    },
    indexes: ["clients_created_idx"],
    foreignKeys: [],
  },
  orders: {
    columns: {
      id: ["uuid", true],
      client_id: ["uuid", false],
      client_name: ["text", true],
      amount: ["numeric(12, 2)", true],
      currency: ["text", true],
      method: ["text", true],
      status: ["text", true],
      reference: ["text", true],
      created_at: ["timestamp with time zone", true],
    },
    indexes: ["orders_created_idx", "orders_reference_unique"],
    foreignKeys: ["orders_client_id_clients_id_fk"],
  },
  activity_log: {
    columns: {
      id: ["uuid", true],
      kind: ["text", true],
      message: ["text", true],
      created_at: ["timestamp with time zone", true],
    },
    indexes: ["activity_created_idx"],
    foreignKeys: [],
  },
  agent_memory: {
    columns: {
      id: ["uuid", true],
      agent: ["text", true],
      key: ["text", true],
      value: ["jsonb", true],
      updated_at: ["timestamp with time zone", true],
    },
    indexes: ["agent_memory_agent_key_unique"],
    foreignKeys: [],
  },
  delivery_status: {
    columns: {
      id: ["uuid", true],
      client_id: ["uuid", false],
      order_id: ["uuid", false],
      client_name: ["text", true],
      pack: ["text", true],
      method: ["text", true],
      amount: ["numeric(12, 2)", true],
      qa_status: ["text", true],
      checks: ["jsonb", true],
      notes: ["text", false],
      verified_at: ["timestamp with time zone", false],
      created_at: ["timestamp with time zone", true],
      updated_at: ["timestamp with time zone", true],
    },
    indexes: ["idx_delivery_status_order", "idx_delivery_status_status"],
    foreignKeys: ["delivery_status_client_id_clients_id_fk", "delivery_status_order_id_orders_id_fk"],
  },
} as const;

describe("Drizzle business schema compatibility", () => {
  it("maps only the six existing public business tables", () => {
    expect(Object.keys(schema).sort()).toEqual(Object.keys(productionSchema).sort());
  });

  it("matches production column names, SQL types, and nullability", () => {
    for (const [model, expected] of Object.entries(productionSchema)) {
      const table = schema[model as keyof typeof schema];
      expect(getTableName(table)).toBe(model);
      const columns = getTableColumns(table);
      expect(Object.keys(columns).sort()).toEqual(Object.keys(expected.columns).sort());
      for (const [name, [sqlType, notNull]] of Object.entries(expected.columns)) {
        expect(columns[name as keyof typeof columns].getSQLType()).toBe(sqlType);
        expect(columns[name as keyof typeof columns].notNull).toBe(notNull);
      }
      expect(columns.id.primary).toBe(true);
    }
  });

  it("matches production secondary indexes and foreign keys", () => {
    for (const [model, expected] of Object.entries(productionSchema)) {
      const config = getTableConfig(schema[model as keyof typeof schema]);
      expect(config.indexes.map((index) => index.config.name).sort()).toEqual([...expected.indexes].sort());
      expect(config.foreignKeys.map((foreignKey) => foreignKey.getName()).sort()).toEqual(
        [...expected.foreignKeys].sort(),
      );
    }
  });
});
