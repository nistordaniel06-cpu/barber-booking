/* Barbercraft calendar focus: day-by-specialist, 3-day/week, drag-to-add. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
if(!$("proCalendar")||!$("calWeek"))return;
const panel=$("proCalendar"), grid=$("calWeek"),scroller=grid.parentElement;
const teamBar=document.createElement("div");
teamBar.className="bcTeamFilters";teamBar.id="bcTeamFilters";
teamBar.setAttribute("aria-label","Filtrează specialiștii");
const guide=document.createElement("p");guide.className="bcCalendarGuide";
guide.textContent="Atinge o oră sau glisează peste mai multe intervale · selecție de 15 minute. Trage pe coloana orelor pentru a derula.";
const mainFilter=document.createElement("div");mainFilter.className="bcCalendarFilterHeader";
mainFilter.innerHTML='<strong>Specialiști</strong><button type="button" id="bcCalendarMore" aria-expanded="false" aria-controls="bcCalendarAdvanced">⚙ Opțiuni</button>';
const toolbar=panel.querySelector(".calUtility");
const advanced=document.createElement("div");advanced.id="bcCalendarAdvanced";advanced.hidden=true;
const bulk=$("calendarBulkPanel");
toolbar.parentNode.insertBefore(mainFilter,toolbar);
toolbar.parentNode.insertBefore(teamBar,toolbar);
toolbar.parentNode.insertBefore(guide,toolbar);
toolbar.parentNode.insertBefore(advanced,toolbar);
advanced.append(toolbar,bulk,$("calendarFeedDetails"));
$("bcCalendarMore").onclick=()=>{
 advanced.hidden=!advanced.hidden;
 $("bcCalendarMore").setAttribute("aria-expanded",String(!advanced.hidden));
};
const quick=document.createElement("div");quick.className="bcCalendarQuick";quick.hidden=true;
quick.innerHTML='<div class="bcCalendarQuickCard" role="dialog" aria-modal="true" aria-label="Alege acțiunea"><div class="bcQuickTop"><span id="bcQuickSelection"></span><span class="bcPopupActions"><button id="bcQuickClose" type="button" aria-label="Închide" title="Închide">✕</button></span></div><button id="bcQuickBook" class="bcQuickPrimary" type="button">＋ Programare nouă</button><button id="bcQuickBlock" type="button">▧ Blochează timp</button></div>';
panel.append(quick);
const gridMask=document.createElement("div");gridMask.className="bcGridDragTip";gridMask.textContent="";
scroller.append(gridMask);
const originalOpen=calendarOpen;
const originalLoad=loadCalendar;
let team=[],selected="all",loadedSalon="",selection=null,gesture=null,lastViewKey="",timeJumped=false;
let pointerStart=0,actionStart=null,actionEnd=null,actionSpecialist=null;
let selectionDay=null;
const isManager=()=>currentProAccess.some(x=>x.salon_id===$("calSalon").value&&["owner","manager"].includes(x.member_role));
const roleCanEdit=()=>proCalendarEditable();
const hhmm=date=>date.toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"});
function columns(){
 const days=calendarDates();
 if(calendarMode==="day"){
  const visible=selected==="all"?team:team.filter(t=>t.id===selected);
  return visible.length?visible.map(t=>({day:days[0],user:t.id,label:t.name})):
   [{day:days[0],user:user?.id||null,label:"Calendar personal"}];
 }
 return days.map(day=>({day,user:selected==="all"?null:selected,label:day.toLocaleDateString("ro-RO",{weekday:"short",day:"numeric"})}));
}
function currentTeamCount(){return team.length||1}
function filterRender(){
 teamBar.replaceChildren();
 const all=document.createElement("button");all.type="button";
 all.className=selected==="all"?"active":"";all.textContent=calendarMode==="day"?"Toți ("+currentTeamCount()+")":"Toți";
 all.onclick=()=>{selected="all";filterRender();renderCalendar(calendarEvents)};
 teamBar.append(all);
 for(const m of team){
  const btn=document.createElement("button");btn.type="button";
  btn.className=selected===m.id?"active":"";
  const letter=document.createElement("span");letter.className="bcTeamAvatar";letter.textContent=m.name.slice(0,1).toUpperCase();
  const label=document.createElement("span");label.textContent=m.name;
  btn.append(letter,label);btn.onclick=()=>{
   selected=selected===m.id?"all":m.id;filterRender();renderCalendar(calendarEvents);
  };teamBar.append(btn);
 }
}
async function refreshTeam(){
 const salon=$("calSalon").value;
 if(!salon){team=[];loadedSalon="";filterRender();return}
 if(loadedSalon===salon)return;
 loadedSalon=salon;team=[];
 const member=await client.rpc("bc_pro_staff_settings",{p_salon:salon});
 if($("calSalon").value!==salon)return;
 const settings=Array.isArray(member.data)?member.data:[];
 let names=new Map();
 if(isManager()){
  const result=await client.rpc("bc_pro_team_list",{p_salon:salon});
  if($("calSalon").value!==salon)return;
  names=new Map((result.data||[]).map(m=>[m.user_id,m.display_name||m.email?.split("@")[0]||"Specialist"]));
 }
 team=settings.filter(m=>["owner","manager","staff"].includes(m.role)).map(m=>({
  id:m.user_id,
  name:m.user_id===user?.id?(names.get(m.user_id)||"Eu"):(names.get(m.user_id)||"Specialist")
 }));
 if(team.length===0&&user?.id)team=[{id:user.id,name:"Eu"}];
 if(!isManager())team=team.filter(t=>t.id===user?.id);
 selected="all";filterRender();timeJumped=false;
}
function hideQuick(){quick.hidden=true;selection=null;grid.querySelectorAll(".calSelected").forEach(n=>n.classList.remove("calSelected"))}
$("bcQuickClose").onclick=hideQuick;
quick.onclick=e=>{if(e.target===quick)hideQuick()};
const normalize=(n,min,max)=>Math.min(max,Math.max(min,n));
function atQuarter(day,q){
 const d=new Date(day);d.setHours(7,0,0,0);
 d.setMinutes(q*15);return d;
}
function updateHighlight(){
 const s=selection;if(!s)return;
 for(const cell of grid.querySelectorAll(".calCell")){
  const match=cell.dataset.col===String(s.col);
  const idx=Number(cell.dataset.quarterIndex);
  cell.classList.toggle("calSelected",match&&idx<s.last&&idx+2>s.first);
 }
 const from=atQuarter(s.day,s.first),to=atQuarter(s.day,s.last);
 gridMask.textContent=hhmm(from)+"–"+hhmm(to)+" · "+((to-from)/60000)+" min";
}
function openQuick(s){
 selection=s;updateHighlight();
 actionStart=atQuarter(s.day,s.first);actionEnd=atQuarter(s.day,s.last);
 actionSpecialist=s.user;selectionDay=s.day;
 const who=team.find(t=>t.id===s.user)?.name||(s.user?"Specialist":"Salon");
 $("bcQuickSelection").textContent=who+" · "+actionStart.toLocaleDateString("ro-RO",{day:"numeric",month:"short"})+" · "+hhmm(actionStart)+"–"+hhmm(actionEnd);
 const stamp=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+"T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
 const url=new URL("./pro/calendar/",document.baseURI);
 url.searchParams.set("popup","quick");url.searchParams.set("from",stamp(actionStart));url.searchParams.set("to",stamp(actionEnd));
 if(actionSpecialist)url.searchParams.set("staff",actionSpecialist);

 quick.hidden=false;
 $("bcQuickBook").focus({preventScroll:true});
}
async function selectAction(kind){
 const start=actionStart,end=actionEnd,member=actionSpecialist;
 hideQuick();
 await originalOpen(start,null,end);
 $("calEventKind").value=kind;
 $("calendarManualTitle").textContent=kind==="busy"?"Blochează timpul":"Programare nouă";
 $("calManualService").value=kind==="busy"?"Pauză":"Tuns";
 const picker=$("calManualSpecialist");
 if(member&&[...picker.options].some(x=>x.value===member))picker.value=member;
 if(kind==="confirmed"&&!picker.value&&user?.id&&[...picker.options].some(x=>x.value===user.id))picker.value=user.id;
 if(kind==="busy")$("calManualClient").value="Pauză";
 if(kind==="confirmed")$("calManualClient").focus();
}
$("bcQuickBook").onclick=()=>selectAction("confirmed");
$("bcQuickBlock").onclick=()=>selectAction("busy");
function startGesture(e,col,day,member,halfHourIndex){
 if(!roleCanEdit())return;
 if(e.button!==0||quick.hidden===false)return;
 if(member&&(!isManager()&&member!==user?.id))return;
 e.preventDefault();
 const rect=e.currentTarget.getBoundingClientRect();
 const rowHeight=rect.height;
 const q=normalize(halfHourIndex*2+Math.floor((e.clientY-rect.top)/(rowHeight/2)),0,63);
 gesture={id:e.pointerId,col,day,member,origin:q,startY:e.clientY,startRect:rect,halfHourIndex,rowHeight,scrollStart:scroller.scrollTop};
 selection={day,col,user:member,first:q,last:q+2};
 e.currentTarget.setPointerCapture(e.pointerId);
 updateHighlight();
}
function moveGesture(e){
 const g=gesture;if(!g||g.id!==e.pointerId)return;
 e.preventDefault();
 const relative=(e.clientY-g.startRect.top+scroller.scrollTop-g.scrollStart)/(g.rowHeight/2);
 const q=normalize(g.halfHourIndex*2+Math.floor(relative),0,63);
 selection.first=Math.min(g.origin,q);
 selection.last=Math.max(g.origin,q)+1;
 if(Math.abs(e.clientY-g.startY)<7)selection.last=Math.min(64,selection.first+2);
 updateHighlight();
 // Smooth autoscroll while the finger reaches the top or bottom.
 const box=scroller.getBoundingClientRect();
 if(e.clientY>box.bottom-35)scroller.scrollTop+=14;
 if(e.clientY<box.top+55)scroller.scrollTop-=14;
 if(e.clientY>box.bottom-35||e.clientY<box.top+55){
  const adjusted=(e.clientY-g.startRect.top+scroller.scrollTop-g.scrollStart)/(g.rowHeight/2);
  const nextQ=normalize(g.halfHourIndex*2+Math.floor(adjusted),0,63);
  selection.first=Math.min(g.origin,nextQ);selection.last=Math.max(g.origin,nextQ)+1;updateHighlight();
 }
}
function endGesture(e,cancel){
 if(!gesture||gesture.id!==e.pointerId)return;
 if(!cancel)moveGesture(e);
 const picked=selection;gesture=null;
 if(cancel||!picked){hideQuick();return;}
 openQuick(picked);
}
function eventVisible(event,col){
 if(event.status==="cancelled")return false;
 if(calendarMode==="day"){
  return !event.specialist_user_id||event.specialist_user_id===col.user;
 }
 return selected==="all"||!event.specialist_user_id||event.specialist_user_id===selected;
}
renderCalendar=function(events){
 calendarEvents=events||[];
 const cols=columns(),count=cols.length,days=calendarDates();
 grid.replaceChildren();
 grid.style.gridTemplateColumns="54px repeat("+count+", minmax("+(count>2?"132":"125")+"px,1fr))";
 grid.style.gridTemplateRows="68px repeat(32,52px)";
 grid.style.minWidth=(54+Math.max(count,1)*(count>2?132:125))+"px";
 grid.style.setProperty("--bc-row-height","52px");
 grid.classList.add("bcCalendarGrid","calDragActive");
 $("calWeekName").textContent=days.length===1?days[0].toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):days[0].toLocaleDateString("ro-RO",{day:"numeric",month:"short"})+" – "+days.at(-1).toLocaleDateString("ro-RO",{day:"numeric",month:"short"});
 const corner=document.createElement("div");corner.className="calDay bcCorner";corner.textContent="Ora";grid.append(corner);
 for(let col=0;col<count;col++){
  const t=cols[col],head=document.createElement("div");head.className="calDay bcSpecialistHead";
  const top=document.createElement("strong");top.textContent=t.label;head.append(top);
  if(calendarMode==="day"){
   const sub=document.createElement("small");sub.textContent="Programări · "+(calendarEvents||[]).filter(e=>e.status==="confirmed"&&e.specialist_user_id===t.user&&isoDay(new Date(e.starts_at))===isoDay(t.day)).length;
   head.append(sub);
  }
  head.style.gridColumn=String(col+2);head.style.gridRow="1";grid.append(head);
 }
 for(let index=0;index<32;index++){
  const hour=7+Math.floor(index/2),minute=index%2*30;
  const time=document.createElement("div");time.className="calTime bcTimeGutter";time.style.gridRow=String(index+2);
  time.textContent=minute?"":String(hour).padStart(2,"0")+":00";grid.append(time);
  for(let col=0;col<count;col++){
   const x=cols[col],cell=document.createElement("div");cell.className="calCell";
   cell.style.gridColumn=String(col+2);cell.style.gridRow=String(index+2);
   cell.dataset.day=isoDay(x.day);cell.dataset.col=String(col);cell.dataset.quarterIndex=String(index*2);
   cell.setAttribute("role","button");cell.tabIndex=0;
   cell.setAttribute("aria-label","Interval "+x.label+", "+time.textContent+" "+(minute?":30":""));
   cell.addEventListener("pointerdown",e=>startGesture(e,col,x.day,x.user,index));
   cell.addEventListener("pointermove",moveGesture);
   cell.addEventListener("pointerup",e=>endGesture(e,false));
   cell.addEventListener("pointercancel",e=>endGesture(e,true));
   cell.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){e.preventDefault();openQuick({day:x.day,col,user:x.user,first:index*2,last:index*2+2})}
   });
   grid.append(cell);
  }
 }
 for(const event of calendarEvents){
  const start=new Date(event.starts_at),end=new Date(event.ends_at);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)continue;
  for(let col=0;col<count;col++){
   const x=cols[col];if(!eventVisible(event,x))continue;
   const dayStart=new Date(x.day);dayStart.setHours(7,0,0,0);
   const dayEnd=new Date(x.day);dayEnd.setHours(23,0,0,0);
   if(start>=dayEnd||end<=dayStart)continue;
   const from=Math.max(start.getTime(),dayStart.getTime()),to=Math.min(end.getTime(),dayEnd.getTime());
   if(to<=from)continue;
   const fromMinutes=(from-dayStart)/60000,toMinutes=(to-dayStart)/60000;
   const row=Math.floor(fromMinutes/30)+2;
   const offset=(fromMinutes%30)/30*52;
   const size=Math.max(24,Math.round((toMinutes-fromMinutes)/30*52)-2);
   const button=document.createElement("button");button.type="button";
   button.className="calEvent "+(event.status==="busy"?"busy":"confirmed")+(event.overlap_override?" isOverlapped":"");
   button.style.gridColumn=String(col+2);button.style.gridRow=String(row);
   button.style.height=size+"px";button.style.top=offset+"px";button.style.alignSelf="start";
   const title=document.createElement("strong");title.textContent=event.status==="busy"?"▧ "+(event.service_label||"Blocat"):(event.client_display_name||"Programare");
   const sub=document.createElement("small");sub.textContent=hhmm(new Date(from))+"–"+hhmm(new Date(to))+" · "+(event.status==="busy"?"Indisponibil":event.service_label||"Tuns");
   button.append(title,sub);
   button.onclick=()=>event.source_provider==="manual"?originalOpen(start,event):($("calStatus").textContent="Eveniment sincronizat. Editează-l în calendarul sursă.");
   grid.append(button);
  }
 }
 const key=isoDay(days[0])+":"+calendarMode;
 if(!timeJumped||lastViewKey!==key){
  lastViewKey=key;timeJumped=true;
  // Start near the working hours, with the hourly scale immediately visible.
  requestAnimationFrame(()=>{scroller.scrollTop=Math.max(0,(9-7)*2*52-12)});
 }
};
loadCalendar=async function(){await refreshTeam();return originalLoad()};
calendarDragEnabled=true;
// A full salon overview works for one day. Multi-day views stay readable by
// automatically choosing a single specialist rather than overlapping everyone.
const originalSetCalendarMode=setCalendarMode;
setCalendarMode=function(mode){
 if(mode==="day")selected="all";
 else if(selected==="all")selected=(team.find(x=>x.id===user?.id)||team[0])?.id||"all";
 filterRender();
 return originalSetCalendarMode(mode);
};
const oldNavigate=proNavigate;
proNavigate=function(route){
 oldNavigate(route);
 document.body.classList.toggle("bcCalendarFocus",route==="calendar");
 if(route==="calendar"){
  hideQuick();
  refreshTeam().then(()=>{if(calendarEvents?.length)renderCalendar(calendarEvents)});
 }
};
$("calendarDragToggle").hidden=true;
$("calendarDragHelp").hidden=true;
const manualAdd=$("calendarManualAdd");
if(manualAdd)manualAdd.textContent="＋ Adaugă fără glisare";
if($("calViewDay")){
 $("calViewDay").classList.add("selected");$("calViewDay").setAttribute("aria-pressed","true");
 $("calViewThree").classList.remove("selected");$("calViewThree").setAttribute("aria-pressed","false");
}
calendarMode="day";
document.addEventListener("keydown",e=>{if(e.key==="Escape")hideQuick()});
window.BCCalendarFocus={columns,refreshTeam,filterRender,hideQuick};
})();

