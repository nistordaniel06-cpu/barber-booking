/* BARBERCRAFT PRO: touch-friendly scroll-wheel clock for both salon and barber schedules. */
(()=>{"use strict";
const root=document.getElementById("member");if(!root)return;
const picker=document.createElement("dialog");
picker.className="bcWorkTimeWheel";picker.id="bcWorkTimeWheel";picker.setAttribute("aria-label","Selectează ora");
picker.innerHTML='<div class="bcWheelHead"><div><small>PROGRAM DE LUCRU</small><h2>Alege ora</h2></div><div class="bcWheelTools"><button id="bcWheelClose" type="button" aria-label="Închide">✕</button></div></div><div class="bcWheelColumns"><div><strong>Ora</strong><div id="bcWheelHours" class="bcWheelList" role="listbox" aria-label="Ore"></div></div><div><strong>Minute</strong><div id="bcWheelMinutes" class="bcWheelList" role="listbox" aria-label="Minute"></div></div></div><p id="bcWheelPreview" class="bcWheelPreview"></p><button id="bcWheelSave" type="button" class="bcWheelSave">Aplică ora</button>';
document.body.append(picker);
const $=id=>document.getElementById(id),hours=$("bcWheelHours"),minutes=$("bcWheelMinutes");
let target=null,hour=9,minute=0,previousFocus=null;
function populate(list,count,isHour){
 const spacer=document.createElement("div");spacer.className="bcWheelSpacer";list.append(spacer);
 for(let index=0;index<count;index++){
  const value=isHour?index:index*5;
  const button=document.createElement("button");button.type="button";button.className="bcWheelOption";
  button.dataset.value=String(value);button.textContent=String(value).padStart(2,"0");
  button.onclick=()=>list.scrollTo({top:index*50,behavior:"smooth"});
  list.append(button);
 }
 list.append(spacer.cloneNode());
}
populate(hours,24,true);populate(minutes,12,false);
function paint(){
 $("bcWheelPreview").textContent=String(hour).padStart(2,"0")+":"+String(minute).padStart(2,"0");
 for(const [list,value] of [[hours,hour],[minutes,minute]]){
  list.querySelectorAll("button").forEach(button=>{
   const selected=Number(button.dataset.value)===value;
   button.classList.toggle("active",selected);
   button.setAttribute("aria-selected",String(selected));
  });
 }
}
for(const [list,isHour] of [[hours,true],[minutes,false]]){
 list.addEventListener("scroll",()=>{
  const position=Math.max(0,Math.min(isHour?23:11,Math.round(list.scrollTop/50)));
  if(isHour)hour=position;else minute=position*5;paint();
 },{passive:true});
}
function isWorkingHourInput(el){
 return el instanceof HTMLInputElement&&el.type==="time"&&
  !!el.closest(".hoursCard,.staffDayRow")&&root.contains(el);
}
function refreshInputs(){
 root.querySelectorAll('.hoursCard input[type="time"],.staffDayRow input[type="time"]').forEach(input=>{
  input.readOnly=true;input.inputMode="none";input.classList.add("bcTimeWheelInput");
  input.title="Alege ora prin glisare";
 });
}
new MutationObserver(refreshInputs).observe(root,{childList:true,subtree:true});
refreshInputs();
function show(input){
 if(input.disabled)return;
 previousFocus=document.activeElement;target=input;
 const [h,m]=(input.value||"09:00").split(":").map(Number);
 hour=Number.isInteger(h)?Math.max(0,Math.min(23,h)):9;
 minute=Number.isInteger(m)?Math.max(0,Math.min(55,Math.round(m/5)*5)):0;
 if(!picker.open)picker.showModal();
 requestAnimationFrame(()=>{
  hours.scrollTop=hour*50;minutes.scrollTop=minute/5*50;paint();
 });
}
for(const type of ["pointerdown","click"]){
 root.addEventListener(type,e=>{
  const el=e.target;
  if(!isWorkingHourInput(el)||el.disabled)return;
  e.preventDefault();e.stopPropagation();show(el);
 },true);
}
function close(){
 if(picker.open)picker.close();
 if(previousFocus&&previousFocus!==target)previousFocus.focus?.({preventScroll:true});
}
$("bcWheelClose").onclick=close;
$("bcWheelSave").onclick=()=>{
 if(!target)return;
 target.value=String(hour).padStart(2,"0")+":"+String(minute).padStart(2,"0");
 target.dispatchEvent(new Event("input",{bubbles:true}));
 target.dispatchEvent(new Event("change",{bubbles:true}));
 close();
};
picker.addEventListener("click",e=>{if(e.target===picker)close()});
})();
