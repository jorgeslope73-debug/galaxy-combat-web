'use strict';
const CACHE='galaxy-combat-v10';
const CORE=[
  './','./index.html','./style.css','./menu-portada.css','./voz.css','./config.js',
  './audio.js','./input.js','./network.js','./render.js','./hud.js','./impactos.js','./voz.js','./game.js',
  './manifest.webmanifest','./assets/sprites/fondo_1280.png','./assets/sprites/INTRO.png',
  './assets/sonido/laser_1.mp3','./assets/sonido/impacto1.mp3','./assets/sonido/carga3.wav','./assets/sonido/inicio.wav'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/config.js')){
    event.respondWith(fetch(event.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(event.request,c));}return r;}).catch(()=>caches.match(event.request)));
    return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put('./index.html',c));return r;}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(event.request,c));}return r;})));
});
