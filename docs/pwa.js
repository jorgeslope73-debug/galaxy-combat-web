'use strict';
(() => {
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('[Galaxy Combat] Service worker no disponible.',err)));}
})();
