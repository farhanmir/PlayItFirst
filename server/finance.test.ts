import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTransaction, attachNessieAccount, createFinance, reconcileNessie } from "./finance";
const response = (value: object) => Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
const flush = async () => { for (let i = 0; i < 15; i++) await new Promise((r) => setTimeout(r, 0)); };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Nessie v2 mirroring", () => {
  it("keeps the local ledger independent when no key is configured", () => {
    vi.stubEnv("NESSIE_KEY", ""); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const finance = createFinance(100); attachNessieAccount(finance);
    expect(applyTransaction(finance, "Coffee", 7, "sales").balance).toBe(107);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("provisions current opening cents and preserves sales during provisioning", async () => {
    vi.stubEnv("NESSIE_KEY", "nsk_test");
    const fetcher = vi.fn().mockImplementationOnce(() => response({ id: "customer" }))
      .mockImplementationOnce(() => response({ id: "account" }))
      .mockImplementationOnce(() => response({ id: "sale", amount_cents: 750, status: "pending" }));
    vi.stubGlobal("fetch", fetcher);
    const finance = createFinance(4842.50); attachNessieAccount(finance); attachNessieAccount(finance);
    const next = applyTransaction(finance, "Coffee", 7.5, "sales"); await flush();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).balance_cents).toBe(484250);
    const [url, options] = fetcher.mock.calls[2];
    expect(url).toBe("https://v2-prod-api.nessieisreal.com/accounts/account/deposits");
    expect(options.headers.Authorization).toBe("Bearer nsk_test");
    expect(JSON.parse(options.body)).toEqual({ amount_cents: 750, medium: "balance", description: `playitfirst:${next.transactions[0].id}` });
    expect(next.nessieSync?.records[0].status).toBe("pending"); expect(next.balance).toBe(4850);
  });
  it("never retries an ambiguous write and confirms only a matching fetched receipt", async () => {
    vi.stubEnv("NESSIE_KEY", "nsk_test");
    const fetcher = vi.fn().mockImplementationOnce(() => response({id:"customer"})).mockImplementationOnce(() => response({id:"account"})).mockRejectedValueOnce(new Error("timeout"));
    vi.stubGlobal("fetch", fetcher);
    let finance = createFinance(100); attachNessieAccount(finance); await flush();
    finance = applyTransaction(finance, "Coffee", 7, "sales"); await flush();
    const id = finance.transactions[0].id;
    finance = applyTransaction(finance, "Supply", -35, "inventory"); await flush();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(finance.nessieSync?.records[0].status).toBe("unknown");
    fetcher.mockImplementationOnce(() => response({balance_cents:10700})).mockImplementationOnce(() => response({items:[{id:"remote",description:`playitfirst:${id}`,kind:"deposit",amount_cents:700,status:"completed"}]}));
    await reconcileNessie(finance);
    expect(finance.nessieSync?.records[0].status).toBe("confirmed");
    expect(finance.nessieSync?.differenceCents).toBe(3500); expect(finance.balance).toBe(72);
    expect(fetcher.mock.calls.slice(3).every(([,options]) => options.method === "GET")).toBe(true);
  });
  it("reports explicit provider rejection without claiming completion", async () => {
    vi.stubEnv("NESSIE_KEY", "nsk_test");
    const fetcher = vi.fn().mockImplementationOnce(() => response({id:"customer"})).mockImplementationOnce(() => response({id:"account"}))
      .mockResolvedValueOnce(new Response("{}", {status:422}));
    vi.stubGlobal("fetch", fetcher);
    let finance = createFinance(100); attachNessieAccount(finance); await flush();
    finance = applyTransaction(finance, "Supply", -35, "inventory"); await flush();
    expect(finance.balance).toBe(65); expect(finance.nessieSync?.records[0].status).toBe("failed");
    expect(finance.nessieSync?.error).toContain("422");
  });
  it("does not accept duplicate or mismatched fetched receipts", async () => {
    vi.stubEnv("NESSIE_KEY", "nsk_test");
    const finance = createFinance(100);
    finance.nessieSync = {status:"ready",openingCents:10000,accountId:"account",records:[{localId:"local",amountCents:700,status:"unknown"}]};
    const tx = {id:"remote",description:"playitfirst:local",kind:"deposit",amount_cents:700,status:"completed"};
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => response({balance_cents:11400})).mockImplementationOnce(() => response({items:[tx,{...tx,id:"duplicate"}]})));
    await reconcileNessie(finance);
    expect(finance.nessieSync.records[0].status).toBe("failed");
    expect(finance.nessieSync.error).toContain("Duplicate");
    expect(finance.balance).toBe(100);
  });
  it("bounds retained mirror work and reports overflow without losing local transactions", () => {
    vi.stubEnv("NESSIE_KEY", "nsk_test"); vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    let finance = createFinance(100); attachNessieAccount(finance);
    for (let i=0;i<45;i++) finance=applyTransaction(finance,"Coffee",1,"sales");
    expect(finance.balance).toBe(145); expect(finance.nessieSync?.records).toHaveLength(40);
    expect(finance.nessieSync?.overflow).toBe(true);
  });
});
