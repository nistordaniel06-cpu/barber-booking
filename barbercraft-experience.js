/* Essential consent + language infrastructure; no analytics is loaded. */
(()=>{"use strict";
const readCookie=key=>decodeURIComponent((document.cookie.match(new RegExp("(?:^|; )"+key+"=([^;]*)"))||[])[1]||"");
const writeCookie=(key,value)=>{
 document.cookie=key+"="+encodeURIComponent(value)+"; Path=/barber-booking/; Max-Age=31536000; SameSite=Lax; Secure";
};
const supported=["ro","en"];
const system=(navigator.languages||[navigator.language||"ro"]).map(l=>l.split("-")[0].toLowerCase()).find(l=>supported.includes(l))||"ro";
let language=readCookie("bc_lang")||system;
if(!supported.includes(language))language=system;
document.documentElement.lang=language;
const translations={
 ro:{"go_discover":"Descoperă","go_bookings":"Rezervări","go_favorites":"Favorite","go_account":"Contul meu",
 "login":"Autentificare","create":"Creează cont de client","filters":"Filtre suplimentare","consent":"Folosim stocare locală și cookie-uri necesare pentru temă, limbă, sesiune și setări. Nu încărcăm analytics sau publicitate."},
 en:{"go_discover":"Discover","go_bookings":"Bookings","go_favorites":"Favorites","go_account":"My account",
 "login":"Sign in","create":"Create Client account","filters":"More filters","consent":"We use necessary local storage and cookies for your theme, language, login session and preferences. No analytics or ads are loaded."}
};
function translate(){
 document.documentElement.lang=language;
 const tr=translations[language];
 const menu=document.querySelectorAll(".bottom .nav");
 ["go_discover","go_bookings","go_favorites","go_account"].forEach((key,i)=>{
  const el=menu[i];if(!el)return;for(const child of el.childNodes)if(child.nodeType===Node.TEXT_NODE&&child.textContent.trim())child.textContent=tr[key];
 });
 const signIn=document.getElementById("loginBtn");if(signIn)signIn.textContent=tr.login;
 const signUp=document.getElementById("signUpBtn");if(signUp)signUp.textContent=tr.create;
 const privacy=document.getElementById("bcCookieNotice");if(privacy)privacy.querySelector("#bcCookieText").textContent=tr.consent;
}
function languageSelector(){
 const section=document.querySelector("#accountGuest")||document.querySelector("#member")||document.querySelector("#dashboard");
 if(!section)return;
 const row=document.createElement("label");row.className="bcLanguageSelect";
 const label=document.createElement("span");label.textContent="Limbă / Language";
 const choose=document.createElement("select");choose.setAttribute("aria-label","Limba aplicației");
 for(const [value,caption] of [["ro","Română"],["en","English"]]){
  const opt=new Option(caption,value);choose.add(opt);
 }
 choose.value=language;
 choose.onchange=()=>{language=choose.value;writeCookie("bc_lang",language);translate()};
 row.append(label,choose);section.append(row);
}
function consent(){
 if(readCookie("bc_cookie_consent"))return;
 const aside=document.createElement("aside");aside.className="bcCookieNotice";aside.id="bcCookieNotice";
 aside.setAttribute("role","dialog");aside.setAttribute("aria-label","Confidențialitate și cookie-uri");
 const message=document.createElement("p");message.id="bcCookieText";message.textContent=translations[language].consent;
 const actions=document.createElement("div");
 const docs=document.createElement("a");docs.href="./privacy.html";docs.textContent="Detalii privind datele";docs.target="_blank";docs.rel="noopener noreferrer";
 const accept=document.createElement("button");accept.type="button";accept.textContent="Am înțeles";
 accept.onclick=()=>{writeCookie("bc_cookie_consent","essential");aside.remove()};
 actions.append(docs,accept);aside.append(message,actions);document.body.append(aside);
}
function boot(){translate();languageSelector();consent()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
