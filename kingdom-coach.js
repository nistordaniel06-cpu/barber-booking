/* Guided progression, accessible three-tab navigation; all game logic remains server-authoritative. */
(()=>{"use strict";
const $=id=>document.getElementById(id),tabs=[...document.querySelectorAll("[data-king-tab]")],
panels=[...document.querySelectorAll("[data-king-panel]")];
if(!$("kingControls"))return;
let latest=null;
const names={village:"sat",alliance:"alianta",expedition:"expeditii"};
const lookup=Object.fromEntries(Object.entries(names).map(([key,value])=>[value,key]));
function openTab(name,scroll=true){
 if(!names[name])name="village";
 for(const t of tabs){const on=t.dataset.kingTab===name;
 t.classList.toggle("active",on);t.setAttribute("aria-selected",String(on));t.tabIndex=on?0:-1}
 for(const p of panels)p.hidden=p.dataset.kingPanel!==name;
 history.replaceState(null,"","#"+names[name]);
 if(scroll)document.querySelector(".kingNav")?.scrollIntoView({behavior:"smooth",block:"start"});
}
tabs.forEach((b,i)=>{
 b.onclick=()=>openTab(b.dataset.kingTab);
 b.onkeydown=e=>{
  if(!["ArrowLeft","ArrowRight"].includes(e.key))return;
  e.preventDefault();const next=(i+(e.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();openTab(tabs[next].dataset.kingTab,false);
 };
});
openTab(lookup[location.hash.substring(1)]||"village",false);
window.addEventListener("hashchange",()=>{
 const name=lookup[location.hash.slice(1)];if(name)openTab(name,false)
});
for(const button of document.querySelectorAll("[data-focus-building]")){
 button.onclick=()=>{
  const kind=button.dataset.focusBuilding;
  openTab("village",false);
  const target=[...document.querySelectorAll(".kingBuilding")].find(x=>x.dataset.kind===kind);
  if(target){target.scrollIntoView({behavior:"smooth",block:"center"});target.classList.add("kingBuildingHighlight");
   setTimeout(()=>target.classList.remove("kingBuildingHighlight"),1400)}
 };
}
let guide=null;
window.addEventListener("bc-kingdom-updated",e=>{
 const d=e.detail;latest=d;
 const guideTitle=$("kingNextAction"),description=$("kingNextDescription"),go=$("kingGuideGo");
 const affordable=Object.keys(d.buildings||{}).find(k=>{
  const lvl=Number(d.buildings[k]||1);
  return lvl<10&&d.wood>=30*lvl*lvl&&d.stone>=25*lvl*lvl&&d.iron>=20*lvl*lvl;
 });
 if(d.mission_available){
  guide={tab:"village",target:"kingMission"};
  guideTitle.textContent="Colectează proviziile de azi";
  description.textContent="Primești resurse gratuite o singură dată pe zi. Începe de aici.";
  go.textContent="Colectează →";
 }else if(affordable){
  guide={tab:"village",building:affordable};
  guideTitle.textContent="Poți îmbunătăți o clădire!";
  description.textContent="Ai suficiente resurse pentru un nivel în plus. Alege o clădire.";
  go.textContent="Vezi clădirea →";
 }else if(d.iron>=18&&d.food>=12){
  guide={tab:"village",target:"kingTroops"};
  guideTitle.textContent="Pregătește-ți armata";
  description.textContent="Poți antrena soldați în cazarmă pentru o expediție.";
  go.textContent="Mergi la cazarmă →";
 }else{
  guide={tab:"village",target:"kingBuildings"};
  guideTitle.textContent="Satul tău produce resurse";
  description.textContent="Revino după ce se adună lemn, piatră și fier. Nu trebuie să stai conectat.";
  go.textContent="Vezi construcțiile →";
 }
});
$("kingGuideGo").onclick=()=>{
 if(!guide)return;
 openTab(guide.tab,false);
 if(guide.building){
  const el=document.querySelector('[data-focus-building="'+guide.building+'"]');el?.click();return;
 }
 if(guide.target==="kingMission"){
  const btn=$("kingMission");if(btn&&!btn.disabled){btn.click();return}
 }
 const el=$(guide.target);el?.scrollIntoView({behavior:"smooth",block:"center"});
};
const highlightStyle=document.createElement("style");
highlightStyle.textContent=".kingBuildingHighlight{outline:3px solid #ffe4a5!important;box-shadow:0 0 0 9px #eec46433!important}";
document.head.append(highlightStyle);
})();
