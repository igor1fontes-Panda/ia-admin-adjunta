import { describe, expect, it } from "vitest";
import { mockData } from "./lib/data.mock";

describe("offline mock data", () => {
  it("provides valid records for every dashboard collection", () => {
    expect(mockData.leads[0]).toMatchObject({
      id: expect.any(String),
      status: expect.any(String),
      score: expect.any(Number),
    });
    expect(mockData.clients[0]).toMatchObject({
      id: expect.any(String),
      plan: expect.any(String),
      mrr: expect.any(Number),
    });
    expect(mockData.orders[0]).toMatchObject({
      id: expect.any(String),
      amount: expect.any(Number),
      status: expect.any(String),
    });
    expect(mockData.activity[0]).toMatchObject({ id: expect.any(String), message: expect.any(String) });
  });
});
