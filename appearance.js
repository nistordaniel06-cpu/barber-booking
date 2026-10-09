(function(){
const KEY="barbercraft-appearance";
let settings={brand_name:"BARBERCRAFT",accent_color:"#FFCE38",headline:"Stilul tău. În mâini bune.",show_hero:true,show_recommended:true,default_theme:"system"};
const local=()=>{try{return localStorage.getItem(KEY)||localStorage.getItem("bc-theme")}catch{return null}};
function setMode(mode,persist=true){
 const resolved=mode==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):mode;
 document.documentElement.dataset.theme=resolved;
 document.documentElement.style.colorScheme=resolved;
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=resolved==="dark"?"#08080a":"#ffffff";
 if(persist){try{localStorage.setItem(KEY,mode)}catch{}}
 document.querySelectorAll("[data-bc-theme-toggle]").forEach(b=>{b.textContent=resolved==="dark"?"☀":"☾";b.setAttribute("aria-label",resolved==="dark"?"Activează tema luminoasă":"Activează tema întunecată")});
 const existing=document.getElementById("themeBtn");if(existing){existing.textContent=resolved==="dark"?"☀":"☾"}
}
function apply(s){
 settings={...settings,...s};
 if(/^#[0-9a-f]{6}$/i.test(settings.accent_color)){document.documentElement.style.setProperty("--yellow",settings.accent_color);document.documentElement.style.setProperty("--bc-accent",settings.accent_color)}
 document.querySelectorAll("[data-bc-brand]").forEach(el=>{el.textContent=settings.brand_name});
 const hero=document.querySelector(".hero");if(hero)hero.hidden=settings.show_hero===false;
 const recommended=document.querySelector("[data-bc-recommended]");if(recommended)recommended.hidden=settings.show_recommended===false;
 const headline=document.querySelector("[data-bc-headline]");if(headline)headline.textContent=settings.headline;
 setMode(local()||settings.default_theme||"system",false);
}
async function load(){
 if(!window.supabase||!window.BARBERCRAFT_SUPABASE_URL)return;
 try{const c=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
 const {data,error}=await c.from("bc_site_settings").select("brand_name,accent_color,headline,show_hero,show_recommended,default_theme").eq("id",1).single();
 if(!error&&data)apply(data);}catch(e){console.warn("Brand settings unavailable",e)}
}
window.BarbercraftAppearance={setMode,apply,load,getSettings:()=>({...settings})};
setMode(local()||"system",false);
document.addEventListener("DOMContentLoaded",()=>{document.querySelectorAll("[data-bc-theme-toggle]").forEach(b=>b.addEventListener("click",()=>setMode(document.documentElement.dataset.theme==="dark"?"light":"dark")));load()});
})();
