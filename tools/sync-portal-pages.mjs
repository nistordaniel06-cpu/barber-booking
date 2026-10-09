// BARBERCRAFT GitHub Pages: build real, distinct portal entrypoints.
// Run node tools/sync-portal-pages.mjs when any root portal page changes.
import fs from "node:fs";
import path from "node:path";
export const portals={client:"index.html",pro:"professionals.html",admin:"admin.html"};
export function portalDocument(html,portal){
  // All CSS, JS, image and internal application links remain relative to repo root.
  // Fragment-only anchors must remain on the chosen portal (base changes them).
  if(!html.includes("<head>"))throw new Error("Missing head for "+portal);
  return html.replace("<head>",'<head><base href="../"><meta name="barbercraft-portal" content="'+portal+'">')
    .replace(/href="#/g,'href="./'+portal+'/#');
}
const runningAsScript=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname);
if(runningAsScript){
  for(const [portal,source] of Object.entries(portals)){
    const target=path.join(portal,"index.html");
    fs.mkdirSync(portal,{recursive:true});
    fs.writeFileSync(target,portalDocument(fs.readFileSync(source,"utf8"),portal));
    console.log("Synced",target,"from",source);
  }
}
