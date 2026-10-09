/* BARBERCRAFT discovery: Google Places is optional; in-app bookings remain partner-only. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
function css(el,styles){Object.assign(el.style,styles);return el}
function link(label,href,cls){const a=document.createElement("a");a.textContent=label;a.href=href;a.className=cls||"";a.rel="noopener noreferrer";return a}
function msg(root,text){root.textContent=text}
function normal(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("ro-RO").trim()}
const home=$("home"),search=$("search");if(!home||!search)return;
const toolbar=document.createElement("div");toolbar.className="bcGeoToolbar";
const gps=document.createElement("button");gps.type="button";gps.className="bcGeoBtn";gps.textContent="⌖ Locația mea";
const google=document.createElement("button");google.type="button";google.className="bcGeoBtn";google.textContent="⌕ Caută adresă Google";
const loc=document.createElement("div");loc.className="bcGeoStatus";loc.setAttribute("role","status");loc.textContent="Caută după salon, serviciu sau cartier. Adresele Google sunt o căutare separată.";
const placeMount=document.createElement("div");placeMount.className="bcPlacesMount";placeMount.hidden=true;
const other=document.createElement("span");other.className="bcGeoExternal";other.append(link("Vezi toate frizeriile pe Google Maps ↗","https://www.google.com/maps/search/?api=1&query="+encodeURIComponent("frizerii București"),"bcMapsLink"));
toolbar.append(gps,google,other);home.querySelector(".search").after(toolbar,placeMount,loc);
const partnerTitle=document.createElement("div");partnerTitle.className="bcPartnerLabel";partnerTitle.textContent="Doar saloanele înscrise în BARBERCRAFT permit programări aici.";
home.querySelector("#salongrid")?.before(partnerTitle);
const game=document.createElement("aside");game.className="bcGameTeaser";
const gHead=document.createElement("div"),gIcon=document.createElement("span");gIcon.className="bcGameIcon";gIcon.textContent="♛";
const gTitle=document.createElement("strong");gTitle.textContent="Bătălia Zonelor";const gDesc=document.createElement("p");gDesc.textContent="Susține zona ta, adună XP din vizite confirmate și descoperă recompensele comunității.";
gHead.append(gTitle,gDesc);game.append(gIcon,gHead,link("Descoperă →","./territory-war.html","bcGameLink"));
home.querySelector("#salongrid")?.after(game);
const passport=document.createElement("a");passport.className="bcPassportShortcut";passport.href="./passport.html";
passport.append(document.createTextNode("♛  Barber Passport"),document.createElement("span"));passport.lastChild.textContent="Istoric · XP · Recompense  →";
const account=$("account");account?.querySelector("#accountUser")?.prepend(passport);
let mapsLoaded=false,placeWidget=null,selectedCoords=null;
async function initMaps(){
 if(mapsLoaded)return;
 const key=String(window.BC_GOOGLE_MAPS_API_KEY||"").trim();
 if(!key){msg(loc,"Pentru sugestii complete de adrese Google este necesară cheia Google Maps din maps-config.js. Căutarea BARBERCRAFT funcționează independent.");throw new Error("Google Maps API key is missing");}
 if(!window.google?.maps){
  await new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&v=weekly&loading=async&libraries=places&language=ro&region=RO";
    script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error("Google Maps nu a putut fi încărcat"));document.head.append(script);
  });
 }
 mapsLoaded=true;
}
function selectCity(city){
 const field=$("cityFilter"),query=normal(city);if(!field)return false;
 const match=[...field.options].find(o=>o.value&&normal(o.value)===query);
 field.value=match?.value||"";return !!match;
}
function cityFromComponents(comps){for(const type of ["locality","administrative_area_level_2","administrative_area_level_1"]){
 const c=comps?.find(x=>x.types?.includes(type));if(c)return c.longText||c.long_name||"";}return "";}
async function initAutocomplete(){
 await initMaps();if(placeWidget)return;
 const {PlaceAutocompleteElement}=await window.google.maps.importLibrary("places");
 placeWidget=new PlaceAutocompleteElement();placeWidget.placeholder="Caută oraș, stradă sau adresă…";
 placeWidget.includedRegionCodes=["ro"];placeWidget.className="bcGooglePlace";
 placeMount.append(placeWidget);
 placeWidget.addEventListener("gmp-select",async event=>{
  try{const place=event.placePrediction.toPlace();await place.fetchFields({fields:["displayName","formattedAddress","location","addressComponents"]});
    const city=cityFromComponents(place.addressComponents),matched=selectCity(city);
    const address=place.formattedAddress||place.displayName||city;
    // Address selection is for city scope, not an unauthorized import of Google businesses.
    search.value="";
    if(typeof window.BCRefreshSearch==="function")window.BCRefreshSearch();
    else search.dispatchEvent(new Event("input",{bubbles:true}));
    selectedCoords=place.location?{lat:place.location.lat(),lng:place.location.lng()}:null;
    msg(loc,matched?"Cauți saloane BARBERCRAFT din "+city+". Adresă selectată: "+address:"Adresă Google: "+address+". Nu există încă parteneri listați pentru această locație; poți explora Google Maps separat.");
    const ext=other.querySelector("a");ext.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent("frizerii "+address);
  }catch(e){msg(loc,"Adresa nu a putut fi preluată: "+e.message)}
 });
}
google.addEventListener("click",async()=>{
 placeMount.hidden=!placeMount.hidden;
 if(!placeMount.hidden){try{await initAutocomplete();placeWidget?.focus()}catch(e){placeMount.hidden=true}}
});
gps.addEventListener("click",()=>{
 if(!navigator.geolocation){msg(loc,"Acest dispozitiv nu oferă acces la geolocalizare.");return}
 gps.disabled=true;msg(loc,"Se solicită permisiunea de localizare…");
 navigator.geolocation.getCurrentPosition(async pos=>{
  gps.disabled=false;const {latitude:lat,longitude:lng}=pos.coords;selectedCoords={lat,lng};
  const ext=other.querySelector("a");ext.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent("barbershop")+"&center="+lat+","+lng;
  try{await initMaps();const geocoder=new google.maps.Geocoder();const result=await geocoder.geocode({location:{lat,lng}});
   const city=cityFromComponents(result.results?.[0]?.address_components?.map(c=>({...c,longText:c.long_name})));
   const matched=selectCity(city);search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));
   msg(loc,matched?"Ești în apropiere de "+city+". Saloanele partenere din oraș sunt afișate mai jos.":"Locație detectată: "+(city||"România")+". Nu există încă saloane partenere în catalog pentru acest oraș.");
  }catch(e){msg(loc,"Locația a fost detectată. Pentru identificarea adresei pe hartă configurează Google Maps API; poți totuși deschide Google Maps.")}}
  ,err=>{gps.disabled=false;msg(loc,err.code===1?"Nu ai acordat permisiunea de localizare. Poți selecta orașul manual.":"Locația nu este disponibilă în acest moment.")},{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
});
window.BCGeo={getSelectedLocation:()=>selectedCoords,normal};
})();