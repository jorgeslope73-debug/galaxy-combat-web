'use strict';
const CACHE='galaxy-combat-v10-1';
const CORE=[
  './','./index.html','./style.css','./menu-portada.css','./voz.css','./config.js',
  './audio.js','./input.js','./network.js','./impactos.js','./voz.js','./game.js',
  './manifest.webmanifest','./assets/sprites/fondo_1280.png','./assets/sprites/INTRO.png',
  './assets/sonido/laser_1.mp3','./assets/sonido/impacto1.mp3','./assets/sonido/carga3.wav','./assets/sonido/inicio.wav'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function networkFirst(request,fallbackKey){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(request,clone));}
    return response;
  }catch(_){
    return (await caches.match(request))||(fallbackKey?await caches.match(fallbackKey):undefined)||Response.error();
  }
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(networkFirst(event.request,'./index.html'));
    return;
  }
  if(/\.(?:js|css|webmanifest)$/i.test(url.pathname)){
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response&&response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));}
    return response;
  })));
});
