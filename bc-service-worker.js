/* BARBERCRAFT opt-in Web Push service worker: delivery is server-controlled. */
self.addEventListener("push",event=>{
 let value={};
 try{value=event.data?.json()||{}}catch(_){}
 const title=String(value.title||"BARBERCRAFT").slice(0,80);
 const body=String(value.body||"Ai o actualizare în aplicație.").slice(0,220);
 const url=new URL(String(value.url||"./client/"),self.registration.scope);
 // Only same-origin pages inside the BARBERCRAFT project are allowed.
 const safe=url.origin===self.location.origin&&url.pathname.startsWith(new URL(self.registration.scope).pathname)?
  url.href:new URL("./client/",self.registration.scope).href;
 event.waitUntil(self.registration.showNotification(title,{body,icon:"./assets/salon-placeholder.svg",tag:"barbercraft-update",
  data:{url:safe}}));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const url=event.notification.data?.url||new URL("./client/",self.registration.scope).href;
 event.waitUntil(self.clients.openWindow(url));
});
