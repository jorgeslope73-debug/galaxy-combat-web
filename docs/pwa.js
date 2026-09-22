(() => {
  const installBtn=document.getElementById('installGame');
  const isHandheld=document.documentElement.classList.contains('handheld-device')
    || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent||'')
    || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let deferredPrompt=null;

  function isInstalled(){
    return window.matchMedia?.('(display-mode: standalone)').matches
      || window.matchMedia?.('(display-mode: fullscreen)').matches
      || navigator.standalone===true;
  }

  function showInstallMessage(text){
    const toast=document.getElementById('shareToast');
    if(toast){
      toast.textContent=String(text||'');
      toast.classList.remove('hidden');
      clearTimeout(showInstallMessage.timer);
      showInstallMessage.timer=setTimeout(()=>toast.classList.add('hidden'),6500);
    }else{
      alert(String(text||''));
    }
  }

  function refreshInstallButton(){
    if(!installBtn)return;
    const show=isHandheld&&!isInstalled();
    installBtn.classList.toggle('pwa-hidden',!show);
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    refreshInstallButton();
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    refreshInstallButton();
    showInstallMessage('GALAXY COMBAT INSTALADO. YA PUEDES ABRIRLO DESDE TU PANTALLA DE INICIO COMO UNA APP.');
  });

  if(installBtn){
    installBtn.addEventListener('click',async()=>{
      if(isInstalled()){
        refreshInstallButton();
        return;
      }
      if(deferredPrompt){
        const prompt=deferredPrompt;
        deferredPrompt=null;
        try{
          await prompt.prompt();
          const choice=await prompt.userChoice;
          if(choice&&choice.outcome==='accepted'){
            refreshInstallButton();
          }else{
            refreshInstallButton();
          }
        }catch(_){
          refreshInstallButton();
        }
        return;
      }
      if(isIOS){
        showInstallMessage('EN IPHONE/IPAD: PULSA COMPARTIR Y DESPUES "AÑADIR A PANTALLA DE INICIO". SE ABRIRA COMO UNA APP A PANTALLA COMPLETA.');
      }else{
        showInstallMessage('ABRE EL MENU DEL NAVEGADOR Y ELIGE "INSTALAR APP" O "AÑADIR A PANTALLA DE INICIO". DESPUES SE ABRIRA COMO UNA APP.');
      }
    });
  }

  refreshInstallButton();

  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => reg.update().catch(() => {}))
      .catch(err => console.warn('[PWA] Service worker no disponible:', err));
  });
})();