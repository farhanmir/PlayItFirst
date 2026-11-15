import { afterEach, beforeEach, expect, it, vi } from "vitest";
let doc: EventTarget & { hidden: boolean };
let activation: { isActive: boolean };
let media: { paused: boolean; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }[];
let starts: ReturnType<typeof vi.fn>[];
let storage: Map<string,string>;
beforeEach(() => {
  vi.resetModules(); media=[]; starts=[]; storage=new Map(); doc=Object.assign(new EventTarget(),{hidden:false}); activation={isActive:false};
  class Gain { gain={value:0,setTargetAtTime:vi.fn(),setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()};connect(){return this}disconnect(){} }
  class Context {state="running";currentTime=1;destination={};createGain(){return new Gain()}createMediaElementSource(){return new Gain()}resume(){return Promise.resolve()}decodeAudioData(){return Promise.resolve({duration:1})}createBufferSource(){const start=vi.fn();starts.push(start);return{buffer:null,onended:null,connect:vi.fn(),disconnect:vi.fn(),start,stop:vi.fn()}}}
  class Media {paused=true;loop=false;preload="";play=vi.fn(async()=>{this.paused=false});pause=vi.fn(()=>{this.paused=true});setAttribute(){}constructor(){media.push(this)}}
  vi.stubGlobal('window',Object.assign(new EventTarget(),{AudioContext:Context}));vi.stubGlobal('document',doc);vi.stubGlobal('navigator',{userActivation:activation});vi.stubGlobal('Audio',Media);
  vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k),setItem:(k:string,v:string)=>storage.set(k,v)});
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})));
});
afterEach(()=>vi.unstubAllGlobals());
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
it('does not fetch, create audio or autoplay during automatic entry',async()=>{const audio=await import('./audio');await audio.unlockAudio();audio.play('brew');expect(fetch).not.toHaveBeenCalled();expect(media).toHaveLength(0)});
it('starts from activation, prevents repeated recordings stacking, persists mute and pauses hidden pages',async()=>{
 const audio=await import('./audio');activation.isActive=true;await audio.unlockAudio();await flush();expect(media[0].paused).toBe(false);expect(fetch).toHaveBeenCalledTimes(4);
 for(let i=0;i<30;i++)audio.play('brew');expect(starts).toHaveLength(1);expect(starts[0]).toHaveBeenCalledTimes(1);
 audio.setMuted(true);expect(media[0].paused).toBe(true);expect(storage.get('playitfirst.audio.muted')).toBe('true');audio.play('coin');expect(starts).toHaveLength(1);
 audio.setMuted(false);await flush();expect(media[0].paused).toBe(false);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));expect(media[0].paused).toBe(true);
});
it('respects stored mute before any load',async()=>{storage.set('playitfirst.audio.muted','true');activation.isActive=true;const audio=await import('./audio');await audio.unlockAudio();expect(audio.isMuted()).toBe(true);expect(fetch).not.toHaveBeenCalled();expect(media).toHaveLength(0)});
