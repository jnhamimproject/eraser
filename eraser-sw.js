/* Offline cache + cross-origin isolation (multi-thread WASM) for GitHub Pages */
const C="eraser-v2";
const PRE=["./", "./index.html", "./manifest.json", "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort.min.js"];
const CDN=["cdnjs.cloudflare.com","cdn.jsdelivr.net"];
const coi=res=>{
  if(res.status===0||res.type==="opaque")return res;
  const h=new Headers(res.headers);
  h.set("Cross-Origin-Embedder-Policy","credentialless");
  h.set("Cross-Origin-Opener-Policy","same-origin");
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
};
self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c=>Promise.allSettled(PRE.map(u=>c.add(new URL(u,self.registration.scope).href)))));
});
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k==="app-v1"||(k.startsWith("eraser-")&&k!==C))await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET"||(r.cache==="only-if-cached"&&r.mode!=="same-origin"))return;
  const u=new URL(r.url),same=u.origin===self.location.origin;
  if(!same&&!CDN.includes(u.hostname))return;
  e.respondWith((async()=>{
    const c=await caches.open(C);
    if(!same){
      const m=await c.match(r.url);if(m)return coi(m);
      try{const res=await fetch(r.mode==="no-cors"?new Request(r.url,{mode:"cors",credentials:"omit"}):r);
        if(res.status===200)c.put(r.url,res.clone());return coi(res)}catch(x){return Response.error()}
    }
    try{
      const res=await Promise.race([fetch(r),new Promise((_,j)=>setTimeout(j,3000))]);
      if(res.status===200)c.put(r,res.clone());
      return coi(res);
    }catch(x){
      const m=(await c.match(r,{ignoreSearch:true}))||(r.mode==="navigate"&&await c.match(new URL("./index.html",self.registration.scope).href));
      return m?coi(m):Response.error();
    }
  })());
});
