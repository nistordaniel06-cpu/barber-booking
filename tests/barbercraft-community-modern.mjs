import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Node {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.listeners={};this.hidden=false;this.style={};this.className='';this.textContent='';this.classList={contains:c=>this.className.split(' ').includes(c),toggle:(c,b)=>{const s=new Set(this.className.split(' ').filter(Boolean));if(b)s.add(c);else s.delete(c);this.className=[...s].join(' ')},remove:()=>{}}}
 append(...nodes){this.children.push(...nodes)}
 prepend(...nodes){this.children.unshift(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
 setAttribute(k,v){this.attributes[k]=v}
 getAttribute(k){return this.attributes[k]??null}
 addEventListener(k,fn){this.listeners[k]=fn}
 contains(n){return this===n||this.children.some(x=>typeof x==='object'&&x.contains?.(n))}
 querySelector(){return null}
 querySelectorAll(){return []}
 focus(){}
}
const docEvents={};
const doc={readyState:'loading',hidden:false,body:new Node('body'),createElement:t=>new Node(t),createTextNode:s=>s,getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(k,fn)=>{docEvents[k]=fn}};
let saved=false,reads=0;
const sb={auth:{getUser:async()=>({data:{user:{id:'client'}}})},rpc:async(name,args)=>{
 if(name==='bc_favorite_set'){saved=args.p_saved;return{data:{saved,count:saved?1:0}}}
 if(name==='bc_favorite_state'){reads++;return{data:{saved,count:saved?1:0}}}
 throw Error('unexpected RPC '+name);
}};
const sandbox={document:doc,window:{addEventListener() {},BCAuthClient:()=>sb},location:{pathname:'/client/',search:''},URLSearchParams,setInterval:()=>0,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null,setItem(){}},MutationObserver:class{observe(){}},navigator:{},Node:{TEXT_NODE:3},TextEncoder,File,Blob,URL};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('community-kit.js','utf8'),sandbox);
const ranks=sandbox.window.BCVisitRank;
assert.equal(ranks.rank(0).next.name,'Bronz 1');
assert.equal(ranks.rank(0).total,3);
assert.equal(ranks.rank(3).current.name,'Bronz 1');
assert.equal(ranks.rank(6).current.name,'Bronz 2');
assert.equal(ranks.rank(12).current.name,'Silver 1');
assert.equal(ranks.rank(30).current.name,'Gold 1');
assert.equal(ranks.rank(65).current.name,'Premium');
assert.equal(ranks.rank(80).current.name,'Platinum');
assert.equal(ranks.rank(80).next,undefined);
assert.equal(ranks.rank(-4).visits,0);
const row=new Node();
await sandbox.window.BCFavorites.mount(row,'client','client');
assert.equal(row.children.length,0,'Clients never receive a favorite control');
const heart=await sandbox.window.BCFavorites.mount(row,'salon','salon');
assert.equal(reads,1);
assert.equal(heart.disabled,false);
assert.equal(heart.attributes['aria-pressed'],'false');
await heart.onclick();assert.equal(saved,true);assert.equal(heart.textContent,'♥ 1');
await heart.onclick();assert.equal(saved,false);assert.equal(heart.textContent,'♡ 0');
vm.runInContext(fs.readFileSync('barbercraft-assistant.js','utf8'),sandbox);
const assistant=doc.body.children.at(-1),bubble=assistant.children[1],chat=assistant.children[2];
assert.equal(chat.hidden,true);
bubble.listeners.click();assert.equal(chat.hidden,false);
docEvents.pointerdown({target:bubble});assert.equal(chat.hidden,false,'Touches inside do not dismiss');
docEvents.pointerdown({target:new Node()});assert.equal(chat.hidden,true,'Outside touch minimizes');
bubble.listeners.click();docEvents.keydown({key:'Escape'});assert.equal(chat.hidden,true);
assert.equal(bubble.listeners.pointermove,undefined,'No draggable assistant');
const tools=chat.children[0].children[1],mute=tools.children[0];
mute.onclick();assert.equal(mute.attributes['aria-pressed'],'true');
assert.match(mute.innerHTML,/M3 3l18 18/,'Muted bell has diagonal strike');
mute.onclick();assert.equal(mute.attributes['aria-pressed'],'false');
let exported;
sandbox.navigator.canShare=()=>true;
sandbox.navigator.share=async v=>{exported=v.files[0]};
vm.runInContext(fs.readFileSync('native-calendar.js','utf8'),sandbox);
await sandbox.window.BCNativeCalendar.sync({id:'booking',start:'2026-10-10T10:00:00Z',end:'2026-10-10T10:45:00Z',salon:'Salon, unu',service:'Tuns; barbă',location:'Strada\nNr. 1'});
const calendar=await exported.text();
assert.match(calendar,/DTSTART:20261010T100000Z/);
assert.match(calendar,/DTEND:20261010T104500Z/);
assert.ok(calendar.includes('Tuns\\; barbă · Salon\\, unu'));
assert.ok(calendar.includes('LOCATION:Strada\\nNr. 1'));
assert.match(calendar,/STATUS:CONFIRMED/);
await assert.rejects(()=>sandbox.window.BCNativeCalendar.sync({start:'invalid',end:'invalid'}),/invalid/);
console.log('PASS: rank boundaries, favorite type restriction/toggle, assistant outside click/mute/fixed position, native calendar escaping and times');
