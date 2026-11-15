import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTransaction, attachNessieAccount, createFinance, reconcileNessie, refreshNessie } from "./finance";
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
  it("publishes background reconciliation results through onChange", async () => {
    vi.stubEnv("NESSIE_KEY", "nsk_test");
    const fetcher = vi.fn().mockImplementationOnce(() => response({ id: "customer" })).mockImplementationOnce(() => response({ id: "account" }))
      .mockImplementationOnce(() => response({ balance_cents: 10000 })).mockImplementationOnce(() => response({ items: [] }));
    vi.stubGlobal("fetch", fetcher);
    const finance = createFinance(100); attachNessieAccount(finance); await flush();
    const published = vi.fn();
    refreshNessie(finance, published); await flush();
    expect(published).toHaveBeenCalledTimes(1);
    expect(finance.nessieSync?.checkedAt).toBeTypeOf("number");
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

describe("business banking resources", () => {
  it("uses merchant purchases for supply/equipment and does not provision a merchant twice", async () => {
    vi.stubEnv("NESSIE_KEY", "nsk_test");
    const calls: { url: string; body: any }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      const body = JSON.parse(options.body ?? "{}"); calls.push({ url, body });
      if (url.endsWith("/customers")) return response({ id: "customer" });
      if (url.endsWith("/accounts")) return response({ id: "account" });
      if (url.endsWith("/merchants")) return response({ id: `merchant-${body.category}` });
      return response({ id: `purchase-${calls.length}`, amount_cents: body.amount_cents, status: "pending" });
    }));
    let f = createFinance(5000); attachNessieAccount(f); await flush();
    f = applyTransaction(f, "Supply", -35, "inventory"); await flush();
    f = applyTransaction(f, "Supply", -35, "inventory"); await flush();
    f = applyTransaction(f, "Machine", -1800, "equipment"); await flush();
    expect(calls.filter(c => c.url.endsWith("/merchants"))).toHaveLength(2);
    const purchases = calls.filter(c => c.url.endsWith("/purchases"));
    expect(purchases.map(c => c.body.amount_cents)).toEqual([3500, 3500, 180000]);
    expect(purchases[0].body.merchant_id).toBe("merchant-inventory");
    expect(f.nessieSync?.records.every(r => r.kind === "purchase" && r.status === "pending")).toBe(true);
  });
  it("creates upcoming recurring rent in dollars without a payment or second local rent charge", async () => {
    vi.stubEnv("NESSIE_KEY", "nsk_test");
    const fetcher = vi.fn().mockImplementationOnce(() => response({id:"customer"})).mockImplementationOnce(() => response({id:"account"}))
      .mockImplementationOnce((_url, options) => { const b=JSON.parse(options.body); return response({id:"rent",account_id:"account",payee:b.payee,payment_amount:b.payment_amount,upcoming_payment_date:b.payment_date,status:b.status}); });
    vi.stubGlobal("fetch",fetcher);
    const f=createFinance(4842.50); attachNessieAccount(f,()=>{},{monthlyRent:11047.50}); await flush();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({payment_amount:11047.50,recurring_date:1,status:"recurring"});
    expect(f.balance).toBe(4842.50); expect(f.transactions).toHaveLength(0);
    expect(f.nessieSync?.bills?.[0].amountCents).toBe(1104750);
    expect(f.nessieSync?.bills?.[0].dueDate).toBe(new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth()+1,1)).toISOString().slice(0,10));
  });
  it("fetches actual upcoming bills and available funds without paying them", async () => {
    vi.stubEnv("NESSIE_KEY","nsk_test");
    const f=createFinance(100); f.nessieSync={status:"ready",openingCents:10000,accountId:"account",records:[],billSetupStatus:"confirmed"};
    const fetcher=vi.fn().mockImplementationOnce(()=>response({balance_cents:10000,available_cents:6500})).mockImplementationOnce(()=>response({items:[]}))
      .mockImplementationOnce(()=>response({items:[{id:"bill",account_id:"account",payee:"Rent",payment_amount:1500.25,upcoming_payment_date:"2026-12-01",status:"recurring"}]}));
    vi.stubGlobal("fetch",fetcher); await reconcileNessie(f);
    expect(f.nessieSync.remoteAvailableCents).toBe(6500); expect(f.nessieSync.bills?.[0].amountCents).toBe(150025);
    expect(f.nessieSync.billsCheckedAt).toBeGreaterThan(0); expect(fetcher.mock.calls.every(([,o])=>o.method==="GET")).toBe(true);
  });
  it("rejects non-sandbox URLs before sending credentials", async () => {
    vi.stubEnv("NESSIE_KEY","nsk_test"); vi.stubEnv("NESSIE_URL","https://example.com");
    const fetcher=vi.fn(); vi.stubGlobal("fetch",fetcher); const f=createFinance(100); attachNessieAccount(f); await flush();
    expect(fetcher).not.toHaveBeenCalled(); expect(f.nessieSync?.status).toBe("unknown");
  });
  it("does not recreate an attached account after repeated attach or simulate restart recovery", async () => {
    vi.stubEnv("NESSIE_KEY","nsk_test"); const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    const f=createFinance(100);f.nessieSync={status:"unknown",openingCents:10000,records:[]};
    attachNessieAccount(f); attachNessieAccount(f); await flush(); expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("purchase safety", () => {
  it.each(["insufficient", "declined"])("preserves local purchase and reports %s provider funds outcome", async (outcome) => {
    vi.stubEnv("NESSIE_KEY","nsk_test");
    const fetcher=vi.fn().mockImplementationOnce(()=>response({id:"customer"})).mockImplementationOnce(()=>response({id:"account"}))
      .mockImplementationOnce(()=>response({id:"supplier"})).mockImplementationOnce(()=>outcome === "insufficient" ? Promise.resolve(new Response("{}",{status:422})) : response({id:"purchase",amount_cents:3500,status:"declined"}));
    vi.stubGlobal("fetch",fetcher);let f=createFinance(100);attachNessieAccount(f);await flush();
    f=applyTransaction(f,"Approved supply",-35,"inventory");await flush();
    expect(f.balance).toBe(65);expect(f.nessieSync?.records[0].status).toBe("failed");expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("compares against latest local funds when a sale arrives during a read", async () => {
    vi.stubEnv("NESSIE_KEY","nsk_test");
    let release!: (r: Response) => void;
    const fetcher=vi.fn().mockImplementationOnce(()=>response({id:"customer"})).mockImplementationOnce(()=>response({id:"account"}));
    vi.stubGlobal("fetch",fetcher);let f=createFinance(100);attachNessieAccount(f);await flush();
    fetcher.mockImplementationOnce(()=>new Promise<Response>(resolve=>{release=resolve;})).mockImplementationOnce(()=>response({items:[]}))
      .mockImplementationOnce(()=>response({id:"sale",amount_cents:700,status:"pending"}));
    const check=reconcileNessie(f);f=applyTransaction(f,"Coffee",7,"sales");release(new Response(JSON.stringify({balance_cents:10000,available_cents:10000})));await check;
    expect(f.nessieSync?.differenceCents).toBe(-700);
  });
});
