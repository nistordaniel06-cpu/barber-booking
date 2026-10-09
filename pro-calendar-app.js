/* BARBERCRAFT PRO: standalone fullscreen appointment calendar. No client/admin fallback. */
(async()=>{
"use strict";
const $=id=>document.getElementById(id);
const sb=window.BCAuthClient?.("pro",{detectSessionInUrl:false});
const state={user:null,access:[],salon:null,staff:[],filter:"all",mode:"day",day:new Date(),events:[],sequence:0,selection:null,editId:null,editSource:null,kind:"confirmed",gesture:null};
const scroller=$("calendarScroll"),timeline=$("timeline");
const hourRows=96,zoomKey="barbercraft-pro-calendar-zoom-v1";
const minimumQuarterHeight=9,maximumQuarterHeight=42,normalQuarterHeight=19;
function restoreQuarterHeight(){
 try{
  const saved=Number(localStorage.getItem(zoomKey));
  return Number.isFinite(saved)&&saved>=minimumQuarterHeight&&saved<=maximumQuarterHeight?saved:normalQuarterHeight;
 }catch(_){return normalQuarterHeight}
}
let pixelPerQuarter=restoreQuarterHeight();
timeline.style.setProperty("--quarter-height",pixelPerQuarter+"px");
let toastTimer=null,reloadTimer=null,pollTimer=null;
const pad=n=>String(n).padStart(2,"0");
const iso=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-");
const hourLabel=d=>d.toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"});
const datetime=d=>iso(d)+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
const parseDate=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12,0,0,0)};
const sameDate=(a,b)=>iso(a)===iso(b);
const onScreen=(date,offset=0)=>{const d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return d};
const monday=d=>{const x=onScreen(d);x.setDate(x.getDate()-(x.getDay()+6)%7);return x};
const days=()=>state.mode==="day"?[onScreen(state.day)]:
 state.mode==="three"?Array.from({length:3},(_,i)=>onScreen(state.day,i)):
 Array.from({length:7},(_,i)=>onScreen(monday(state.day),i));
const range=()=>{const a=days();return {from:new Date(a[0].getFullYear(),a[0].getMonth(),a[0].getDate()),to:new Date(a.at(-1).getFullYear(),a.at(-1).getMonth(),a.at(-1).getDate()+1)}};
const rpc=async(name,args={})=>{const {data,error}=await sb.rpc(name,args);if(error)throw error;return data};
function toast(message){
 const el=$("toast");el.textContent=message;el.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true},5000);
}
function gate(message){$("gate").hidden=false;$("gateText").textContent=message}
function hideGate(){$("gate").hidden=true}
// Each modal can be opened in its own tab. Only appointment IDs, barber IDs
// and dates go in the URL: never customer names, private tokens or unsaved notes.
const popupQueryKeys=["popup","from","to","staff","kind","event"];
function popupURL(kind){
 const url=new URL("./pro/calendar/",document.baseURI);
 url.searchParams.set("popup",kind);
 if(kind==="quick"&&state.selection){
  const selected=selectionText(state.selection);
  url.searchParams.set("from",datetime(selected.from));
  url.searchParams.set("to",datetime(selected.to));
  if(selected.staff)url.searchParams.set("staff",selected.staff);
 }else if(kind==="edit"){
  const from=$("startAt").value,to=$("endAt").value,staff=$("eventStaff").value;
  if(from)url.searchParams.set("from",from);
  if(to)url.searchParams.set("to",to);
  if(staff)url.searchParams.set("staff",staff);
  url.searchParams.set("kind",state.kind);
  if(state.editId)url.searchParams.set("event",state.editId);
 }
 return url.href;
}
function updatePopupLinks(){
 for(const [id,kind] of [["popupNewTabQuick","quick"],["popupNewTabEdit","edit"],["popupNewTabSync","sync"]]){
  const link=$(id);if(link)link.href=popupURL(kind);
 }
}
function discardPopupQuery(){
 const url=new URL(window.location.href);
 if(!url.searchParams.has("popup"))return;
 for(const key of popupQueryKeys)url.searchParams.delete(key);
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
function showSheet(name){
 $("sheetBackdrop").hidden=false;
 for(const id of ["quickSheet","editSheet","syncSheet"])$(id).hidden=id!==name;
 document.body.classList.add("modalOpen");
 updatePopupLinks();
}
function closeSheet(preserveRoute=false){
 $("sheetBackdrop").hidden=true;document.body.classList.remove("modalOpen");
 for(const id of ["quickSheet","editSheet","syncSheet"])$(id).hidden=true;
 state.selection=null;timeline.querySelectorAll(".timeCell.selected").forEach(x=>x.classList.remove("selected"));
 if(preserveRoute!==true)discardPopupQuery();
}
$("closeQuick").onclick=closeSheet;$("closeEdit").onclick=closeSheet;$("closeSync").onclick=closeSheet;
$("sheetBackdrop").addEventListener("click",e=>{if(e.target===$("sheetBackdrop"))closeSheet()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("sheetBackdrop").hidden)closeSheet()});
function specialistName(id){return id?state.staff.find(x=>x.id===id)?.name||"Specialist":"De atribuit"}
function columns(){
 const a=days();
 if(state.mode==="day"){
  let staff=state.filter==="all"?state.staff:state.staff.filter(s=>s.id===state.filter);
  if(!staff.length)staff=[{id:state.user?.id,name:"Eu"}];
  if(state.filter==="all"&&staff.length>1&&state.events.some(e=>e.status==="confirmed"&&!e.specialist_user_id&&sameDate(new Date(e.starts_at),a[0])))staff=[...staff,{id:null,name:"De atribuit"}];
  return staff.map(s=>({date:a[0],staff:s.id,title:s.name}));
 }
 const chosen=state.filter==="all"?(state.staff.find(s=>s.id===state.user?.id)||state.staff[0])?.id:state.filter;
 // Short labels keep all 3 or 7 days readable on the phone, no sideways scroll.
 return a.map(date=>({date,staff:chosen,title:state.mode==="week"
   ?["D","L","M","M","J","V","S"][date.getDay()]+" "+date.getDate()
   :date.toLocaleDateString("ro-RO",{weekday:"short",day:"numeric"})}));
}
function showFilter(){
 const box=$("staffBar");box.replaceChildren();
 const options=state.mode==="day"?[{id:"all",name:"Toți"},...state.staff]:state.staff;
 for(const s of options){
  const b=document.createElement("button");b.type="button";b.className=s.id===state.filter?"active":"";
  if(s.id!=="all"){const avatar=document.createElement("span");avatar.className="staffAvatar";avatar.textContent=s.name.slice(0,1).toUpperCase();b.append(avatar);}
  b.append(document.createTextNode(s.name));b.onclick=()=>{
   state.filter=s.id;
   showFilter();renderTimeline();
  };box.append(b);
 }
}
function setMode(mode){
 if(!["day","three","week"].includes(mode))return;
 state.mode=mode;
 if(mode==="day")state.filter="all";
 else if(state.filter==="all")state.filter=(state.staff.find(s=>s.id===state.user.id)||state.staff[0])?.id||"all";
 document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
 showFilter();void loadEvents();
}
const put=(parent,node)=>{parent.append(node);return node};
function makeElement(tag,cls,text){
 const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;
}
function selectionText(sel){
 const a=onScreen(sel.date),b=onScreen(sel.date);
 a.setHours(0,sel.from*15,0,0);b.setHours(0,sel.to*15,0,0);
 return {from:a,to:b,label:(sel.staff?specialistName(sel.staff):"Salon")+" · "+
 a.toLocaleDateString("ro-RO",{weekday:"short",day:"numeric",month:"short"})+" · "+hourLabel(a)+"–"+hourLabel(b)};
}
function paintSelection(){
 const s=state.selection;if(!s)return;
 timeline.querySelectorAll(".timeCell").forEach(cell=>{
  const same=Number(cell.dataset.col)===s.col,idx=Number(cell.dataset.q);
  cell.classList.toggle("selected",same&&idx>=s.from&&idx<s.to);
 });
}
// Two-finger pinch only changes the calendar's vertical time scale. The
// browser page, horizontal barber columns and the booking durations stay fixed.
const activeTouches=new Map();
let pinch=null,ignoreCalendarClickUntil=0,zoomNoticeTimer=null,outerPan=null;
let nativeTouchPinch=false,ignoreTouchPointersUntil=0;
const clampQuarterHeight=n=>Math.max(minimumQuarterHeight,Math.min(maximumQuarterHeight,n));
const fingerDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function showZoomNotice(){
 const label=$("calendarZoomLevel");
 if(!label)return;
 label.textContent="Zoom "+Math.round(pixelPerQuarter/normalQuarterHeight*100)+"%";
 label.hidden=false;
 clearTimeout(zoomNoticeTimer);
 zoomNoticeTimer=setTimeout(()=>label.hidden=true,900);
}
function focalScrollTop(anchorQuarter,quarterHeight,clientY,viewportTop){
 return Math.max(0,52+anchorQuarter*quarterHeight-(clientY-viewportTop));
}
function changeQuarterHeight(nextHeight,clientY,anchorQuarter){
 const height=clampQuarterHeight(nextHeight);
 if(Math.abs(height-pixelPerQuarter)<.01)return;
 const visibleTop=scroller.getBoundingClientRect().top;
 const anchor=anchorQuarter===undefined
  ?(scroller.scrollTop+scroller.clientHeight/2-52)/pixelPerQuarter
  :anchorQuarter;
 pixelPerQuarter=height;
 timeline.style.setProperty("--quarter-height",height+"px");
 // Keep the exact time beneath the fingers instead of jumping to the day start.
 const focusY=clientY===undefined?scroller.clientHeight/2:clientY-visibleTop;
 scroller.scrollTop=focalScrollTop(anchor,height,focusY+visibleTop,visibleTop);
 showZoomNotice();
}
function beginPinch(){
 if(activeTouches.size!==2||!$("sheetBackdrop").hidden)return;
 const fingers=[...activeTouches.values()];
 const distance=fingerDistance(fingers[0],fingers[1]);
 if(distance<12)return;
 if(state.gesture){
  clearTimeout(state.gesture.timer);
  state.gesture=null;
 }
 outerPan=null;
 state.selection=null;
 timeline.querySelectorAll(".timeCell.selected").forEach(cell=>cell.classList.remove("selected"));
 const midY=(fingers[0].y+fingers[1].y)/2;
 const rect=scroller.getBoundingClientRect();
 pinch={distance,initialHeight:pixelPerQuarter,
  focalQuarter:(scroller.scrollTop+midY-rect.top-52)/pixelPerQuarter};
 ignoreCalendarClickUntil=Date.now()+800;
}
function pointerDownOnCalendar(e){
 if(e.pointerType!=="touch"||nativeTouchPinch||Date.now()<ignoreTouchPointersUntil||!$("sheetBackdrop").hidden)return;
 activeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(activeTouches.size===2)beginPinch();
 else if(activeTouches.size===1&&!e.target.closest(".timeCell")){
  outerPan={id:e.pointerId,y:e.clientY,x:e.clientX,lastTick:performance.now(),velocityY:0,moved:false};
 }
}
// Android browsers may deliver touch events even when pointer capture keeps
// each finger on a different slot. Handle native two-finger gestures explicitly.
function nativePinchDistance(touches){
 const a=touches[0],b=touches[1];
 return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
}
function nativePinchMidpoint(touches){
 return (touches[0].clientY+touches[1].clientY)/2;
}
function startNativePinch(event){
 if(event.touches.length<2||!$("sheetBackdrop").hidden)return;
 const touches=event.touches,dist=nativePinchDistance(touches);
 if(dist<12)return;
 event.preventDefault();
 nativeTouchPinch=true;
 ignoreTouchPointersUntil=Date.now()+900;
 if(state.gesture){
  clearTimeout(state.gesture.timer);
  state.gesture=null;
 }
 outerPan=null;state.selection=null;
 timeline.querySelectorAll(".timeCell.selected").forEach(c=>c.classList.remove("selected"));
 const rect=scroller.getBoundingClientRect(),mid=nativePinchMidpoint(touches);
 pinch={
  distance:dist,initialHeight:pixelPerQuarter,
  focalQuarter:(scroller.scrollTop+mid-rect.top-52)/pixelPerQuarter
 };
 ignoreCalendarClickUntil=Date.now()+1000;
}
function moveNativePinch(event){
 if(!nativeTouchPinch||!pinch)return;
 event.preventDefault();
 if(event.touches.length<2)return;
 const distance=nativePinchDistance(event.touches);
 const mid=nativePinchMidpoint(event.touches);
 changeQuarterHeight(pinch.initialHeight*distance/pinch.distance,mid,pinch.focalQuarter);
}
function finishNativePinch(event){
 if(!nativeTouchPinch||event.touches.length>=2)return;
 event.preventDefault();
 nativeTouchPinch=false;pinch=null;
 ignoreTouchPointersUntil=Date.now()+900;
 ignoreCalendarClickUntil=Date.now()+900;
 activeTouches.clear();outerPan=null;
 if(state.gesture)clearTimeout(state.gesture.timer);
 state.gesture=null;state.selection=null;
 timeline.querySelectorAll(".timeCell.selected").forEach(c=>c.classList.remove("selected"));
 try{localStorage.setItem(zoomKey,String(Math.round(pixelPerQuarter*100)/100))}catch(_){}
}
scroller.addEventListener("touchstart",startNativePinch,{passive:false,capture:true});
scroller.addEventListener("touchmove",moveNativePinch,{passive:false,capture:true});
scroller.addEventListener("touchend",finishNativePinch,{passive:false,capture:true});
scroller.addEventListener("touchcancel",finishNativePinch,{passive:false,capture:true});
scroller.addEventListener("pointerdown",pointerDownOnCalendar,true);
scroller.addEventListener("click",event=>{
 if(Date.now()<ignoreCalendarClickUntil){
  event.preventDefault();event.stopImmediatePropagation();
 }
},true);
function handlePointerMove(e){
 if(e.pointerType==="touch"&&(nativeTouchPinch||Date.now()<ignoreTouchPointersUntil))return;
 if(activeTouches.has(e.pointerId)){
  activeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&activeTouches.size>=2){
   e.preventDefault();
   const touches=[...activeTouches.values()].slice(0,2);
   const midY=(touches[0].y+touches[1].y)/2;
   const distance=fingerDistance(touches[0],touches[1]);
   changeQuarterHeight(pinch.initialHeight*distance/pinch.distance,midY,pinch.focalQuarter);
   return;
  }
 }
 if(outerPan&&outerPan.id===e.pointerId&&!pinch){
  e.preventDefault();
  const now=performance.now(),dy=e.clientY-outerPan.y,dt=Math.max(1,now-outerPan.lastTick);
  scroller.scrollTop-=dy;scroller.scrollLeft-=e.clientX-outerPan.x;
  outerPan.moved||=Math.abs(dy)>3;
  outerPan.velocityY=dy/dt;outerPan.y=e.clientY;outerPan.x=e.clientX;outerPan.lastTick=now;
  return;
 }
 if(!pinch&&activeTouches.size<2)moveSelection(e);
}
function finishPointer(e,cancel){
 if(e.pointerType==="touch"&&(nativeTouchPinch||Date.now()<ignoreTouchPointersUntil)){
  activeTouches.delete(e.pointerId);
  if(state.gesture&&state.gesture.id===e.pointerId){
   clearTimeout(state.gesture.timer);state.gesture=null;state.selection=null;
  }
  return;
 }
 const wasPinching=!!pinch;
 if(wasPinching)ignoreCalendarClickUntil=Date.now()+650;
 if(!wasPinching&&outerPan&&outerPan.id===e.pointerId){
  const g=outerPan;outerPan=null;
  if(g.moved){
   ignoreCalendarClickUntil=Date.now()+250;
   if(!cancel)coastScroll({velocityY:g.velocityY});
  }
 }else if(!wasPinching)endSelection(e,cancel);
 activeTouches.delete(e.pointerId);
 if(wasPinching){
  pinch=null;state.gesture=null;state.selection=null;
  timeline.querySelectorAll(".timeCell.selected").forEach(cell=>cell.classList.remove("selected"));
  try{localStorage.setItem(zoomKey,String(Math.round(pixelPerQuarter*100)/100))}catch(_){}
 }
}
function startSelection(e,cell,column,q){
 if(e.button!==0||pinch||nativeTouchPinch||Date.now()<ignoreTouchPointersUntil||activeTouches.size>=2||!$("sheetBackdrop").hidden)return;
 e.preventDefault();
 const rect=scroller.getBoundingClientRect();
 const touch=e.pointerType==="touch"||e.pointerType==="pen";
 const g={id:e.pointerId,col:column,start:q,rect,startY:e.clientY,startX:e.clientX,
  lastY:e.clientY,lastX:e.clientX,lastTick:performance.now(),velocityY:0,mode:touch?"pending":"select",timer:null};
 state.gesture=g;
 state.selection={col:column,date:columns()[column].date,staff:columns()[column].staff,from:q,to:Math.min(hourRows,q+2)};
 cell.setPointerCapture(e.pointerId);
 if(touch){
  // Scroll with one finger by swiping any empty hour. Hold for 250 ms,
  // then slide to select a multi-hour range (no mode switch).
  g.timer=setTimeout(()=>{
   if(state.gesture!==g||g.mode!=="pending")return;
   g.mode="select";paintSelection();
   try{navigator.vibrate?.(8)}catch(_){}
  },250);
 }else paintSelection();
}
function positionFromPointer(e){
 const rect=scroller.getBoundingClientRect();
 const relative=e.clientY-rect.top+scroller.scrollTop-52;
 return Math.max(0,Math.min(hourRows-1,Math.floor(relative/pixelPerQuarter)));
}
function scrollByTouch(g,e){
 const now=performance.now(),dt=Math.max(1,now-g.lastTick),dy=e.clientY-g.lastY,dx=e.clientX-g.lastX;
 scroller.scrollTop-=dy;scroller.scrollLeft-=dx;
 g.velocityY=dy/dt;
 g.lastY=e.clientY;g.lastX=e.clientX;g.lastTick=now;
}
function moveSelection(e){
 const g=state.gesture;if(!g||e.pointerId!==g.id)return;
 e.preventDefault();
 if(g.mode==="pending"){
  if(Math.hypot(e.clientY-g.startY,e.clientX-g.startX)>9){
   clearTimeout(g.timer);g.mode="scroll";state.selection=null;scrollByTouch(g,e);
  }
  return;
 }
 if(g.mode==="scroll"){scrollByTouch(g,e);return}
 const q=positionFromPointer(e);
 state.selection.from=Math.min(g.start,q);
 state.selection.to=Math.min(hourRows,Math.max(g.start,q)+1);
 const r=scroller.getBoundingClientRect();
 if(e.clientY>r.bottom-30)scroller.scrollTop+=12;
 else if(e.clientY<r.top+65)scroller.scrollTop-=12;
 paintSelection();
}
function coastScroll(g){
 let velocity=g.velocityY*15,frames=0;
 function frame(){
  if(++frames>24||Math.abs(velocity)<.5||state.gesture||pinch||activeTouches.size>=2)return;
  scroller.scrollTop-=velocity;velocity*=.82;requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
function endSelection(e,cancel){
 const g=state.gesture;if(!g||e.pointerId!==g.id)return;
 clearTimeout(g.timer);
 if(!cancel&&g.mode==="select")moveSelection(e);
 state.gesture=null;
 if(cancel){state.selection=null;return}
 if(g.mode==="scroll"){coastScroll(g);return}
 // A simple tap opens the same two-action sheet with 30 minutes selected.
 if(!state.selection)return;
 const d=selectionText(state.selection);
 $("selectionLabel").textContent=d.label;
 showSheet("quickSheet");
}
window.addEventListener("pointermove",handlePointerMove,{passive:false});
window.addEventListener("pointerup",e=>finishPointer(e,false));
window.addEventListener("pointercancel",e=>finishPointer(e,true));
function dateTitle(){
 const a=days(),last=a.at(-1);
 $("dateLabel").textContent=a.length===1?a[0].toLocaleDateString("ro-RO",{day:"numeric",month:"short",year:"numeric"}):
 a[0].toLocaleDateString("ro-RO",{day:"numeric",month:"short"})+" – "+last.toLocaleDateString("ro-RO",{day:"numeric",month:"short"});
 $("pickDate").value=iso(state.day);
}
function renderTimeline(){
 dateTitle();
 const cols=columns(),count=cols.length;
 timeline.replaceChildren();
 // Multi-day grid always fits *exactly* the available viewport width.
 // Day view also fits staff where practical; 3 and 7 days never scroll sideways.
 const gutter=count>=7?30:count===3?40:48;
 timeline.dataset.view=state.mode;
 timeline.style.gridTemplateColumns=gutter+"px repeat("+count+",minmax(0,1fr))";
 timeline.style.width="100%";
 timeline.style.minWidth="0px";
 scroller.scrollLeft=0;
 const corner=makeElement("div","timeCorner","Ora");
 corner.style.gridColumn="1";corner.style.gridRow="1";put(timeline,corner);
 cols.forEach((col,i)=>{
  const head=makeElement("div","staffColumnHeader");
  head.style.gridColumn=String(i+2);head.style.gridRow="1";
  put(head,makeElement("strong","",col.title));
  const isDay=state.mode==="day";
  const n=state.events.filter(ev=>ev.status==="confirmed"&&
    (!ev.specialist_user_id||ev.specialist_user_id===col.staff)&&
    sameDate(new Date(ev.starts_at),col.date)).length;
  if(isDay)put(head,makeElement("small","",n+" programări"));
  else if(state.mode==="three")put(head,makeElement("small","",specialistName(col.staff)));
  put(timeline,head);
 });
 for(let q=0;q<hourRows;q++){
  const isHour=q%4===0,half=q%4===2;
  const label=makeElement("div","timeLabel"+(isHour?" hour":""),isHour?pad(Math.floor(q/4))+":00":"");
  label.style.gridRow=String(q+2);put(timeline,label);
  for(let col=0;col<count;col++){
   const cell=makeElement("div","timeCell"+(isHour?" hour":half?" half":""));
   cell.style.gridColumn=String(col+2);cell.style.gridRow=String(q+2);
   cell.dataset.q=String(q);cell.dataset.col=String(col);cell.tabIndex=0;cell.setAttribute("role","button");
   cell.setAttribute("aria-label",cols[col].title+" "+pad(Math.floor(q/4))+":"+pad((q%4)*15));
   cell.addEventListener("pointerdown",e=>startSelection(e,cell,col,q));
   cell.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){
     e.preventDefault();state.selection={col,date:cols[col].date,staff:cols[col].staff,from:q,to:Math.min(hourRows,q+2)};
     paintSelection();$("selectionLabel").textContent=selectionText(state.selection).label;showSheet("quickSheet");
    }
   });
   put(timeline,cell);
  }
 }
 const byDay=(ev,col)=>{
  const d=new Date(col.date);d.setHours(0,0,0,0);
  const n=new Date(d);n.setDate(n.getDate()+1);
  const st=new Date(ev.starts_at),en=new Date(ev.ends_at);
  if(!(st<n&&en>d))return false;
  if(state.mode==="day"&&state.filter==="all"&&state.staff.length>1){
   if(col.staff===null)return !ev.specialist_user_id&&ev.status==="confirmed";
   if(!ev.specialist_user_id)return ev.status==="busy";
  }
  return !ev.specialist_user_id||ev.specialist_user_id===col.staff;
 };
 for(const ev of state.events){
  if(ev.status==="cancelled")continue;
  const start=new Date(ev.starts_at),end=new Date(ev.ends_at);
  if(!(end>start))continue;
  for(let col=0;col<count;col++){
   const x=cols[col];if(!byDay(ev,x))continue;
   const midnight=new Date(x.date);midnight.setHours(0,0,0,0);
   const from=Math.max(0,(start-midnight)/60000),to=Math.min(1440,(end-midnight)/60000);
   if(to<=from)continue;
   const first=Math.floor(from/15),last=Math.ceil(to/15);
   const btn=makeElement("button","calendarEvent "+(ev.status==="busy"?"busy":"manual")+(ev.overlap_override?" overlap":""));
   btn.type="button";btn.style.gridColumn=String(col+2);btn.style.gridRow=(first+2)+" / span "+Math.max(1,last-first);
   btn.title=hourLabel(new Date(Math.max(start,midnight)))+"–"+hourLabel(new Date(Math.min(end,midnight.getTime()+86400000)))+" · "+(ev.client_display_name||"Ocupat");
   put(btn,makeElement("strong","",ev.status==="busy"?"▥ "+(ev.service_label||"Blocat"):ev.client_display_name||"Programare"));
   put(btn,makeElement("small","",hourLabel(start)+"–"+hourLabel(end)+" · "+(ev.service_label||"Interval")));
   btn.onclick=()=>{if(ev.source_provider!=="manual"){toast("Această programare provine dintr-o sursă sincronizată. O poți modifica în calendarul original.");return;}openEditor(ev.status,ev)};
   put(timeline,btn);
  }
 }
}
async function loadEvents(scrollToWorkHours=false){
 if(!state.salon)return;
 const request=++state.sequence,dates=range();
 try{
  const {data,error}=await sb.from("bc_pro_calendar_events")
   .select("id,starts_at,ends_at,client_display_name,service_label,status,source_provider,specialist_user_id,overlap_override")
   .eq("salon_id",state.salon).neq("status","cancelled")
   .lt("starts_at",dates.to.toISOString()).gt("ends_at",dates.from.toISOString())
   .order("starts_at",{ascending:true}).limit(700);
  if(request!==state.sequence)return;
  if(error)throw error;
  state.events=data||[];renderTimeline();
  if(scrollToWorkHours)requestAnimationFrame(()=>scroller.scrollTop=7*4*pixelPerQuarter);
 }catch(error){if(request===state.sequence)toast("Nu am putut încărca programările: "+error.message)}
}
async function selectSalon(){
 const {data,error}=await sb.rpc("bc_my_professional_access");
 if(error)throw error;
 state.access=data||[];
 if(!state.access.length)throw Error("Nu ai încă un salon PRO asociat.");
 state.salon=state.access[0].salon_id;
 const manager=["owner","manager"].includes(state.access[0].member_role);
 const [members,names]=await Promise.all([
  rpc("bc_pro_staff_settings",{p_salon:state.salon}),
  manager?rpc("bc_pro_team_list",{p_salon:state.salon}):Promise.resolve([])
 ]);
 const byId=new Map((names||[]).map(n=>[n.user_id,n.display_name||n.email?.split("@")[0]||"Specialist"]));
 state.staff=(members||[]).filter(m=>["owner","manager","staff"].includes(m.role)&&(manager||m.user_id===state.user.id))
  .map(m=>({id:m.user_id,name:byId.get(m.user_id)||(m.user_id===state.user.id?"Eu":"Specialist")}));
 if(!state.staff.length)state.staff=[{id:state.user.id,name:"Eu"}];
 state.filter="all";showFilter();
 const salonPicker=$("syncSalon");salonPicker.replaceChildren();
 for(const x of state.access){const opt=document.createElement("option");opt.value=x.salon_id;opt.textContent=x.salon_name;salonPicker.append(opt)}
}
function openEditor(kind,event=null){
 state.kind=kind;state.editId=event?.id||null;
 closeSheet(new URL(window.location.href).searchParams.get("popup")==="edit");
 showSheet("editSheet");
 $("editTitle").textContent=event?"Modifică intervalul":kind==="busy"?"Blochează timpul":"Programare nouă";
 $("clientField").hidden=kind==="busy";
 $("serviceField").querySelector("input").placeholder=kind==="busy"?"Ex. Pauză, training, concediu":"Ex. Tuns + barbă";
 const selected=event?{from:new Date(event.starts_at),to:new Date(event.ends_at),staff:event.specialist_user_id}:
  window.__bcDraftSelection||{from:new Date(),to:new Date(Date.now()+30*60000),staff:state.user.id};
 // Capture selection before closeSheet reset (stored by caller for new events).
 const initial=event?selected:window.__bcDraftSelection||selected;
 $("startAt").value=datetime(initial.from);$("endAt").value=datetime(initial.to);
 $("clientName").value=event?.status==="busy"?"":event?.client_display_name||"";
 $("serviceName").value=event?.service_label|| (kind==="busy"?"Pauză":"Tuns");
 $("saveNotice").textContent="";
 $("removeEvent").hidden=!event;$("eventStaff").replaceChildren();
 for(const member of state.staff){
  const opt=document.createElement("option");opt.value=member.id;opt.textContent=member.name;$("eventStaff").append(opt);
 }
 $("eventStaff").value=initial.staff||state.user.id;
 if(!$("eventStaff").value)$("eventStaff").selectedIndex=0;
 updatePopupLinks();
}
function openFromSelection(kind){
 if(!state.selection)return;
 window.__bcDraftSelection=selectionText(state.selection);
 openEditor(kind,null);
}
for(const id of ["startAt","endAt","eventStaff"])$(id).addEventListener("change",updatePopupLinks);
$("chooseBooking").onclick=()=>openFromSelection("confirmed");
$("chooseBusy").onclick=()=>openFromSelection("busy");
$("fastAdd").onclick=()=>{
 const d=new Date();d.setSeconds(0,0);d.setMinutes(Math.ceil(d.getMinutes()/15)*15);
 const e=new Date(d.getTime()+30*60000);
 window.__bcDraftSelection={from:d,to:e,staff:state.filter==="all"?state.user.id:state.filter};
 openEditor("confirmed",null);
};
$("eventForm").onsubmit=async event=>{
 event.preventDefault();
 const start=new Date($("startAt").value),end=new Date($("endAt").value),specialist=$("eventStaff").value||null;
 const status=$("saveNotice"),button=$("saveEvent");
 if(!specialist||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end){status.textContent="Verifică frizerul și orele programării.";return}
 const clientName=state.kind==="busy"?"Ocupat":$("clientName").value.trim();
 if(!clientName){status.textContent="Completează numele clientului.";return}
 const args={p_id:state.editId,p_salon:state.salon,p_start:start.toISOString(),p_end:end.toISOString(),
  p_client:clientName,p_service:$("serviceName").value.trim()||(state.kind==="busy"?"Pauză":"Tuns"),
  p_status:state.kind,p_specialist:specialist,p_allow_overlap:false,p_ack_ids:[]};
 button.disabled=true;status.textContent="Se salvează...";
 try{
  let result=await rpc("bc_pro_calendar_save",args);
  if(result?.blocked){status.textContent="Intervalul este blocat. Alege o altă oră.";return}
  if(result?.requires_confirmation){
   if(specialist!==state.user.id){status.textContent="Ora este ocupată. Doar frizerul poate aproba o suprapunere.";return}
   const conflicts=result.conflicts||[];
   if(!confirm("Atenție: există "+conflicts.length+" programări în același interval. Confirmi suprapunerea pentru acest frizer?")){status.textContent="Suprapunerea nu a fost salvată.";return}
   result=await rpc("bc_pro_calendar_save",{...args,p_allow_overlap:true,p_ack_ids:conflicts.map(c=>c.id)});
  }
  if(!result?.ok){status.textContent="Nu s-a putut salva. Încearcă altă oră.";return}
  closeSheet();await loadEvents();toast("Salvat în calendarul BARBERCRAFT. Dacă ai abonat calendarul telefonului, acesta se actualizează periodic.");
 }catch(e){status.textContent=e.message||"Nu am putut salva intervalul."}
 finally{button.disabled=false}
};
$("removeEvent").onclick=async()=>{
 if(!state.editId||!confirm("Anulezi acest interval?"))return;
 const notice=$("saveNotice");notice.textContent="Se anulează...";
 try{await rpc("bc_pro_calendar_cancel",{p_id:state.editId,p_salon:state.salon});closeSheet();await loadEvents();toast("Interval anulat.")}
 catch(e){notice.textContent="Nu s-a putut anula: "+e.message}
};
$("prev").onclick=()=>{state.day=onScreen(state.day,state.mode==="day"?-1:state.mode==="three"?-3:-7);void loadEvents()};
$("next").onclick=()=>{state.day=onScreen(state.day,state.mode==="day"?1:state.mode==="three"?3:7);void loadEvents()};
$("today").onclick=()=>{state.day=new Date();void loadEvents(true)};
$("pickDate").onchange=e=>{if(e.target.value){state.day=parseDate(e.target.value);void loadEvents(true)}};
document.querySelectorAll("[data-mode]").forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
$("settings").onclick=()=>{ $("feedResult").hidden=true;$("syncNotice").textContent="";showSheet("syncSheet") };
$("createFeed").onclick=async()=>{
 const salon=$("syncSalon").value;
 if(!salon)return;
 if(!confirm("Creezi un nou link privat de abonare? Un link anterior pentru acest salon nu va mai funcționa."))return;
 const btn=$("createFeed");btn.disabled=true;$("syncNotice").textContent="Se creează linkul...";
 try{
  const token=await rpc("bc_pro_create_calendar_feed",{p_salon:salon});
  const code=typeof token==="string"?token:token?.token;
  if(!/^[0-9a-f]{64}$/i.test(code||""))throw Error("Linkul de calendar nu a fost returnat.");
  const url=window.BARBERCRAFT_SUPABASE_URL+"/functions/v1/barbercraft-calendar-feed?token="+encodeURIComponent(code);
  $("feedUrl").value=url;$("appleSubscribe").href=url.replace(/^https:/i,"webcal:");
  $("feedResult").hidden=false;
  $("syncNotice").textContent="Link pregătit. Urmează instrucțiunile corespunzătoare telefonului.";
 }catch(e){$("syncNotice").textContent="Eroare: "+e.message}
 finally{btn.disabled=false}
};
$("copyFeed").onclick=async()=>{
 try{await navigator.clipboard.writeText($("feedUrl").value);$("syncNotice").textContent="Link copiat. Adaugă-l în calendarul Google pe web."}
 catch(e){$("feedUrl").focus();$("feedUrl").select();$("syncNotice").textContent="Selectează și copiază linkul din câmp."}
};
async function restorePopupFromURL(){
 const url=new URL(window.location.href),type=url.searchParams.get("popup");
 if(!["quick","edit","sync"].includes(type))return;
 if(type==="sync"){showSheet("syncSheet");return}
 const from=url.searchParams.get("from"),to=url.searchParams.get("to");
 if(!from||!to||!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(from)||!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(to)){
  toast("Linkul nu conține un interval de timp valid.");discardPopupQuery();return;
 }
 const start=new Date(from),end=new Date(to);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end-start>7*86400000){
  toast("Intervalul din link nu este valid.");discardPopupQuery();return;
 }
 state.day=new Date(start);state.mode="day";state.filter="all";showFilter();
 document.querySelectorAll("[data-mode]").forEach(button=>button.classList.toggle("active",button.dataset.mode==="day"));
 await loadEvents(true);
 if(type==="edit"){
  const eventId=url.searchParams.get("event");
  if(eventId){
   const match=state.events.find(e=>e.id===eventId&&e.source_provider==="manual");
   if(!match){toast("Programarea nu poate fi deschisă sau modificată.");discardPopupQuery();return}
   openEditor(match.status==="busy"?"busy":"confirmed",match);
  }else{
   const requestedStaff=url.searchParams.get("staff");
   window.__bcDraftSelection={from:start,to:end,staff:state.staff.some(x=>x.id===requestedStaff)?requestedStaff:state.user.id};
   openEditor(url.searchParams.get("kind")==="busy"?"busy":"confirmed");
  }
  return;
 }
 if(end-start>12*3600000||iso(start)!==iso(end)){
  toast("Intervalul trebuie să fie într-o singură zi.");discardPopupQuery();return;
 }
 const requestedStaff=url.searchParams.get("staff");
 const currentCols=columns();
 const col=Math.max(0,currentCols.findIndex(c=>c.staff===requestedStaff));
 const first=start.getHours()*4+start.getMinutes()/15;
 const last=end.getHours()*4+end.getMinutes()/15;
 if(!Number.isInteger(first)||!Number.isInteger(last)||last<=first||first<0||last>hourRows){
  toast("Selectează un interval de 15 minute.");discardPopupQuery();return;
 }
 state.selection={date:onScreen(start),staff:currentCols[col].staff,col,from:first,to:last};
 paintSelection();
 $("selectionLabel").textContent=selectionText(state.selection).label;
 showSheet("quickSheet");
}
async function begin(){
 if(!sb){gate("Autentificarea PRO este indisponibilă.");return}
 gate("Verificăm contul profesional...");
 try{
  const {data,error}=await sb.auth.getUser();
  if(error||!data.user){gate("Conectează-te în BARBERCRAFT PRO ca să vezi calendarul.");return}
  const permission=await rpc("bc_pro_portal_access");
  if(permission?.allowed!==true){gate("Contul folosit nu are acces PRO. Nu poți folosi calendarul salonului cu un cont Client.");return}
  state.user=data.user;await selectSalon();hideGate();await loadEvents(true);
  await restorePopupFromURL();
  pollTimer=setInterval(()=>{if(document.visibilityState==="visible"&&$("sheetBackdrop").hidden)void loadEvents()},60000);
  window.addEventListener("focus",()=>{if($("sheetBackdrop").hidden)void loadEvents()});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&$("sheetBackdrop").hidden)void loadEvents()});
 }catch(e){gate("Nu am putut deschide calendarul: "+(e.message||"Eroare de autentificare"))}
}
await begin();
})();