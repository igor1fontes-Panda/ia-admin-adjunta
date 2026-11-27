/**
 * Isolated Supabase service-role compatibility smoke test for legacy bots.
 *
 * Required environment:
 *   SUPABASE_TEST_URL
 *   SUPABASE_TEST_SERVICE_KEY
 *   SUPABASE_TEST_PROJECT_REF
 *
 * Refuses the known production project. Run only against a disposable Supabase
 * development branch after migrations 0005 and 0006 have been applied there.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL || "";
const key = process.env.SUPABASE_TEST_SERVICE_KEY || "";
const projectRef = process.env.SUPABASE_TEST_PROJECT_REF || "";
const productionRef = "aebdqztoolszdzfbdlbp";

if (!url || !key || !projectRef) {
  throw new Error(
    "Set SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_KEY and SUPABASE_TEST_PROJECT_REF.",
  );
}
if (projectRef === productionRef) {
  throw new Error(
    "Refusing to run a write smoke test against the production project.",
  );
}
const parsedUrl = new URL(url);
if (parsedUrl.hostname !== `${projectRef}.supabase.co`) {
  throw new Error(
    "SUPABASE_TEST_URL host does not match SUPABASE_TEST_PROJECT_REF.",
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const created = {
  client: null,
  lead: null,
  order: null,
  activity: null,
  delivery: null,
  memoryKey: `__bot_compat_smoke_${runId}`,
};

async function checked(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function cleanup() {
  const operations = [
    created.delivery &&
      supabase.from("delivery_status").delete().eq("id", created.delivery.id),
    created.order &&
      supabase.from("orders").delete().eq("id", created.order.id),
    created.lead &&
      supabase.from("leads").delete().eq("id", created.lead.id),
    created.activity &&
      supabase.from("activity_log").delete().eq("id", created.activity.id),
    supabase
      .from("agent_memory")
      .delete()
      .eq("agent", "error_handler")
      .eq("key", created.memoryKey),
    created.client &&
      supabase.from("clients").delete().eq("id", created.client.id),
  ].filter(Boolean);
  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed) throw new Error(`Cleanup failed: ${failed.error.message}`);
}

try {
  // Reads exercise the table access patterns used by the bot helpers.
  const tables = [
    "leads",
    "clients",
    "orders",
    "activity_log",
    "agent_memory",
    "delivery_status",
  ];
  for (const table of tables) {
    const orderColumn = table === "agent_memory" ? "updated_at" : "created_at";
    await checked(
      `read ${table}`,
      supabase
        .from(table)
        .select("*")
        .order(orderColumn, { ascending: false })
        .limit(1),
    );
  }

  created.client = await checked(
    "insert client",
    supabase
      .from("clients")
      .insert({
        name: `Bot compatibility ${runId}`,
        email: `bot-compat-${runId}@example.invalid`,
        plan: "starter",
        mrr: 0,
        status: "active",
      })
      .select()
      .single(),
  );
  created.lead = await checked(
    "insert lead",
    supabase
      .from("leads")
      .insert({
        company: `Bot compatibility ${runId}`,
        contact_name: "Smoke Test",
        email: `lead-${runId}@example.invalid`,
        channel: "website",
      })
      .select()
      .single(),
  );
  created.order = await checked(
    "insert order",
    supabase
      .from("orders")
      .insert({
        client_id: created.client.id,
        client_name: created.client.name,
        amount: 100,
        currency: "AOA",
        method: "smoke_test",
        status: "pending",
        reference: `bot-compat-${runId}`,
      })
      .select()
      .single(),
  );
  created.activity = await checked(
    "insert activity",
    supabase
      .from("activity_log")
      .insert({
        kind: "system",
        message: `Bot compatibility smoke ${runId}`,
      })
      .select()
      .single(),
  );
  await checked(
    "upsert agent memory",
    supabase.from("agent_memory").upsert({
      agent: "error_handler",
      key: created.memoryKey,
      value: { smoke: true, run_id: runId },
      updated_at: new Date().toISOString(),
    }),
  );
  created.delivery = await checked(
    "insert delivery status",
    supabase
      .from("delivery_status")
      .insert({
        client_id: created.client.id,
        order_id: created.order.id,
        client_name: created.client.name,
        pack: "smoke-test",
        method: "smoke-test",
        amount: 100,
        qa_status: "pending",
      })
      .select()
      .single(),
  );

  const leadUpdate = await checked(
    "update lead",
    supabase
      .from("leads")
      .update({ score: 55 })
      .eq("id", created.lead.id)
      .select()
      .single(),
  );
  if (leadUpdate.id !== created.lead.id) {
    throw new Error("Lead update returned the wrong row.");
  }

  const deliveryUpdate = await checked(
    "update delivery QA",
    supabase
      .from("delivery_status")
      .update({
        qa_status: "passed",
        verified_at: new Date().toISOString(),
      })
      .eq("id", created.delivery.id)
      .select()
      .single(),
  );
  if (deliveryUpdate.id !== created.delivery.id) {
    throw new Error("Delivery update returned the wrong row.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        target: "isolated-supabase-branch",
        projectRef,
        operations: ["select", "insert", "update", "upsert", "delete-cleanup"],
        tables,
        credentials: "service-role-only",
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup();
}
