import { afterEach, describe, expect, it, vi } from "vitest";
import http, { type IncomingMessage, type Server } from "node:http";
import { clientAddress, createPropertyRefreshLimiter, createRoomRateLimiter, FixedWindowLimiter, readJsonBody, readRawBody, respondHttpInputError } from "./httpLimits";
const servers: Server[] = [];
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(servers.splice(0).map(s => new Promise<void>(r => { s.closeAllConnections(); s.close(() => r()); }))); });
async function start(raw = false, timeoutMs = 1000) {
  const failures: string[] = [];
  const server = http.createServer(async (req, res) => {
    try { const body = raw ? await readRawBody(req, { timeoutMs }) : await readJsonBody(req, { timeoutMs }); res.end(JSON.stringify(raw ? { bytes: (body as Buffer).length, hex: (body as Buffer).toString("hex") } : body)); }
    catch (e) { failures.push(String(e)); if (!respondHttpInputError(req, res, e)) { res.statusCode = 500; res.end(); } }
  }); servers.push(server); await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  return { port: (server.address() as {port:number}).port, failures };
}
function post(port: number, chunks: (string | Buffer)[], headers: Record<string,string> = {}, finish = true): Promise<{status:number; body:string}> {
  return new Promise((resolve,reject) => {
    const req=http.request({port,host:"127.0.0.1",method:"POST",headers},res=>{let body="";res.on("data",b=>body+=b);res.on("end",()=>{req.destroy();resolve({status:res.statusCode!,body});});});
    req.on("error",reject); req.flushHeaders(); for(const c of chunks) req.write(c); if(finish) req.end();
  });
}
describe("bounded HTTP bodies over real sockets",()=>{
  it("accepts object JSON and rejects malformed JSON or non-object shapes",async()=>{
    const {port}=await start();expect(await post(port,['{"name":"café"}'])).toEqual({status:200,body:'{"name":"café"}'});
    for(const value of ['{broken','null','[]','42']) expect((await post(port,[value])).status).toBe(400);
  });
  it("rejects declared and chunked oversized JSON before parsing",async()=>{
    const {port}=await start(); expect((await post(port,[],{"content-length":"20000"},false)).status).toBe(413);
    expect((await post(port,["x".repeat(9000),"x".repeat(9000)])).status).toBe(413);
    expect((await post(port,['{"x":"'+'é'.repeat(9000)+'"}'])).status).toBe(413);
  });
  it("preserves exact raw bytes and bounds webhook requests at 64 KiB",async()=>{
    const {port}=await start(true);const bytes=Buffer.from([0,255,10,13,128]);
    expect(JSON.parse((await post(port,[bytes])).body)).toEqual({bytes:5,hex:bytes.toString('hex')});
    expect((await post(port,[Buffer.alloc(65536)])).status).toBe(200);
    expect((await post(port,[Buffer.alloc(65537)])).status).toBe(413);
  });
  it("returns 408 on a stalled body and terminates the connection",async()=>{
    const {port}=await start(false,40);const result=await post(port,['{'],{"content-length":"20"},false);expect(result.status).toBe(408);
  });
  it("settles aborted uploads instead of leaving the handler pending",async()=>{
    const {port,failures}=await start();
    const req=http.request({port,host:"127.0.0.1",method:"POST",headers:{'content-length':'20'}}); req.on('error',()=>{});req.write('{');
    await new Promise(r=>setTimeout(r,30));req.destroy();
    await vi.waitFor(()=>expect(failures).toHaveLength(1));expect(failures[0]).toMatch(/aborted|interrupted/);
  });
});
describe("bounded fixed window quotas",()=>{
  it("enforces room per-client and global caps and resets after a minute",()=>{
    const limiter=createRoomRateLimiter();for(let i=0;i<6;i++)expect(limiter.take('one',100).allowed).toBe(true);
    expect(limiter.take('one',100)).toEqual({allowed:false,retryAfterSeconds:60});
    for(let i=0;i<24;i++)expect(limiter.take('client'+i,100).allowed).toBe(true);
    expect(limiter.take('another',100).allowed).toBe(false);expect(limiter.take('one',60100).allowed).toBe(true);
  });
  it("never evicts active keys to bypass caps and reclaims expired entries",()=>{
    const limiter=new FixedWindowLimiter({perKey:1,global:100,maxKeys:2});
    expect(limiter.take('a',0).allowed).toBe(true);expect(limiter.take('b',0).allowed).toBe(true);
    for(let i=0;i<100;i++)expect(limiter.take(String(i),0).allowed).toBe(false);
    expect(limiter.keyCount).toBe(2);expect(limiter.take('a',0).allowed).toBe(false);
    expect(limiter.take('new',60000).allowed).toBe(true);expect(limiter.keyCount).toBe(1);
  });
  it("allows only one property refresh globally per minute",()=>{
    const limiter=createPropertyRefreshLimiter();expect(limiter.take('refresh',0).allowed).toBe(true);
    expect(limiter.take('other',0).allowed).toBe(false);expect(limiter.take('refresh',60000).allowed).toBe(true);
  });
});
it("does not trust forged forwarded headers outside explicit Render ingress",()=>{
  const req={headers:{'x-forwarded-for':'1.2.3.4, 5.6.7.8'},socket:{remoteAddress:'::ffff:127.0.0.1'}} as unknown as IncomingMessage;
  vi.stubEnv('RENDER','true');expect(clientAddress(req)).toBe('127.0.0.1');expect(clientAddress(req,{trustRenderProxy:true})).toBe('5.6.7.8');
  req.headers['x-forwarded-for']='1.2.3.4, garbage';expect(clientAddress(req,{trustRenderProxy:true})).toBe('127.0.0.1');
  vi.stubEnv('RENDER','false');req.headers['x-forwarded-for']='1.2.3.4';expect(clientAddress(req,{trustRenderProxy:true})).toBe('127.0.0.1');
});
