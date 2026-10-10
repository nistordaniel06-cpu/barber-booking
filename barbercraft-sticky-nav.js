/* Shared persistent nav for the public companion pages only. */
(()=>{"use strict";
const body=document.body;
if(body.querySelector(".bottom,.proBottom,.bcAppBottom"))return;
if(body.classList.contains("bc-pro")||body.classList.contains("bc-admin"))return;
const path=location.pathname.toLowerCase();
const pages=[
{label:"Descoperă",symbol:"⌂",href:"./client/#home",active:/\/client\/|\/index\.html$/.test(path)},
{label:"Rezervări",symbol:"▦",href:"./client/#booking",active:false},
{label:"Comunitate",symbol:"♡",href:"./social.html",active:path.endsWith("/social.html")},
{label:"Passport",symbol:"♛",href:"./passport.html",active:path.endsWith("/passport.html")||path.endsWith("/passport-preview.html")},
{label:"Contul meu",symbol:"♙",href:"./client/#account",active:false}
];
const nav=document.createElement("nav");
nav.className="bcAppBottom";nav.setAttribute("aria-label","Navigație BARBERCRAFT");
for(const p of pages){const a=document.createElement("a");a.href=p.href;
a.textContent=p.label;const symbol=document.createElement("span");symbol.setAttribute("aria-hidden","true");
symbol.textContent=p.symbol;a.prepend(symbol);
if(p.active)a.setAttribute("aria-current","page");
nav.append(a)}
body.append(nav);
body.classList.add("bc-aux-client");
})();