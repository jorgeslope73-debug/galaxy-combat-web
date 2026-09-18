'use strict';
(() => {
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
  const menu=document.getElementById('menu'),lobby=document.getElementById('lobby'),victory=document.getElementById('victory');
  const statusEl=document.getElementById('status'),roomCodeEl=document.getElementById('roomCode'),playersEl=document.getElementById('players'),startBtn=document.getElementById('start'),topbar=document.getElementById('topbar'),roomMini=document.getElementById('roomMini');
  const serverWait=document.getElementById('serverWait'),serverWaitText=document.getElementById('serverWaitText');
  const W=1920,H=1080;
  const playerColors=['#5ae1ff','#ff50a5','#5aff78','#ffdc46'];
  const images={},sounds={}; let state=null,myIndex=null,isHost=false,roomCode='',inGame=false,lastStateTime=0;
  let lastUniqueLeader=null,leaderAnnouncement=null;
  const keys=new Set(); let ws=null,reconnectTimer=null,musicStarted=false;
  const impactFX=typeof window.GalaxyImpactFX==='function'?new window.GalaxyImpactFX():null;
  let connectAttempt=0,wakeStartedAt=0,manualClose=false;
  const serverButtons=['cpu','create','join'].map(id=>document.getElementById(id));
  const isMobile=(matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  const voice=typeof window.GalaxyVoice==='function'?new window.GalaxyVoice({send:o=>send(o),isMobile}):null;
  const mobileSetup=document.getElementById('mobileSetup'),enableMotionBtn=document.getElementById('enableMotion'),motionStatus=document.getElementById('motionStatus');
  const mobileControls=document.getElementById('mobileControls'),fireZone=document.querySelector('.fire-zone'),thrustZone=document.querySelector('.thrust-zone');
  // En movil las zonas tactiles siguen por encima del canvas para recibir los toques,
  // pero sus textos HTML se ocultan: los dibujamos dentro del canvas justo encima
  // del fondo para que naves, meteoritos, balas y mejoras pasen visualmente por encima.
  if(isMobile){
    const fireLabel=fireZone&&fireZone.querySelector('span');
    const thrustLabel=thrustZone&&thrustZone.querySelector('span');
    if(fireLabel)fireLabel.style.visibility='hidden';
    if(thrustLabel)thrustLabel.style.visibility='hidden';
  }
  let motionEnabled=false,motionTurn=0,motionNeutral=null,motionLastRaw=0;
  let mobileFire=false,mobileThrust=false;
  const touchSides=new Map();

  // Solo quitamos el acento de las vocales; se conserva la letra enie.
  // NFC admite nombres escritos o pegados con acentos combinados.
  const vocalesSinTilde={
    '\u00e1':'a','\u00e9':'e','\u00ed':'i','\u00f3':'o','\u00fa':'u',
    '\u00c1':'A','\u00c9':'E','\u00cd':'I','\u00d3':'O','\u00da':'U'
  };
  function sinTildes(valor){
    return String(valor==null?'':valor).normalize('NFC').replace(
      /[\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da]/g,
      letra=>vocalesSinTilde[letra]
    );
  }
  const campoNombre=document.getElementById('name');
  function normalizarNombreVisible(){
    const anterior=campoNombre.value,nuevo=sinTildes(anterior);
    if(nuevo===anterior)return;
    const inicio=campoNombre.selectionStart,fin=campoNombre.selectionEnd;
    campoNombre.value=nuevo;
    if(inicio!==null&&fin!==null){
      campoNombre.setSelectionRange(
        sinTildes(anterior.slice(0,inicio)).length,
        sinTildes(anterior.slice(0,fin)).length
      );
    }
  }
  campoNombre.addEventListener('input',e=>{
    if(!e.isComposing)normalizarNombreVisible();
  });
  campoNombre.addEventListener('compositionend',normalizarNombreVisible);

  const assetList={
    bg:'assets/sprites/fondo.png', giant:'assets/sprites/asteroidegrande.png',
    pantA:'assets/sprites/pantA.png',pantB:'assets/sprites/pantB.png',
    ammo1:'assets/sprites/municion1.png',ammo3:'assets/sprites/municion3.png',cadence:'assets/sprites/cadencia.png',speed:'assets/sprites/velocidad.png',
    asteroid1:'assets/sprites/asteroide1.png',asteroid2:'assets/sprites/asteroide2.png',asteroid3:'assets/sprites/asteroide3.png',asteroid4:'assets/sprites/asteroide5.png',asteroid5:'assets/sprites/asteroide6.png',asteroid6:'assets/sprites/dos.png'
  };
  for(let i=1;i<=4;i++){
    assetList[`ship${i}`]=`assets/sprites/coete${i}.png`;
    assetList[`ship${i}a`]=`assets/sprites/coete${i}a.png`;
    assetList[`ship${i}f`]=`assets/sprites/coete${i}f.png`;
    assetList[`ship${i}af`]=`assets/sprites/coete${i}af.png`;
  }
  const warnedImages=new WeakSet();
  function reportImageFailure(im,error){
    if(!im||warnedImages.has(im))return;
    warnedImages.add(im);
    console.warn('[Galaxy Combat] Image unavailable; continuing without blocking the game.',im.currentSrc||im.src,error||'');
  }
  for(const [k,url] of Object.entries(assetList)){
    const im=new Image();
    im.onerror=()=>reportImageFailure(im);
    im.src=url;
    images[k]=im;
  }
  sounds.laser=new Audio('assets/sonido/laser_1.mp3');sounds.impact=new Audio('assets/sonido/impacto1.mp3');sounds.pickup=new Audio('assets/sonido/carga3.wav');sounds.start=new Audio('assets/sonido/inicio.wav');sounds.music=new Audio('assets/sonido/musica.mp3');sounds.music.loop=true;sounds.music.volume=.35;
  function playSound(k){const a=sounds[k];if(!a)return;try{const b=a.cloneNode();b.volume=k==='laser'?.55:.75;b.play().catch(()=>{});}catch(_){}}
  function startMusic(){
    if(!menu||menu.classList.contains('hidden')||!sounds.music||!sounds.music.paused)return;
    sounds.music.play().then(()=>{musicStarted=true;}).catch(()=>{musicStarted=false;});
  }
  function stopMusic(){
    if(!sounds.music)return;
    try{sounds.music.pause();sounds.music.currentTime=0;}catch(_){}
    musicStarted=false;
  }

  function screenAngle(){
    if(screen.orientation&&Number.isFinite(screen.orientation.angle))return screen.orientation.angle;
    return Number.isFinite(window.orientation)?window.orientation:0;
  }
  function lateralTilt(ev){
    const beta=Number(ev.beta)||0,gamma=Number(ev.gamma)||0;
    let a=((screenAngle()%360)+360)%360;
    if(a===90)return beta;
    if(a===270)return -beta;
    if(a===180)return -gamma;
    return gamma;
  }
  function onDeviceOrientation(ev){
    const raw=lateralTilt(ev);
    motionLastRaw=raw;
    if(motionNeutral===null)motionNeutral=raw;
    let delta=raw-motionNeutral;
    // Compensa el salto de -180/180 en sensores que lo necesiten.
    if(delta>180)delta-=360;
    if(delta<-180)delta+=360;
    const dead=3.0;
    if(Math.abs(delta)<=dead){motionTurn=0;return;}
    const signed=delta>0?delta-dead:delta+dead;
    motionTurn=-clamp(signed/22,-1,1);
  }
  async function enableMobileMotion(){
    if(!isMobile)return true;
    try{
      if(typeof DeviceOrientationEvent==='undefined'){
        motionStatus.textContent='Este navegador no ofrece sensor de orientacion.';
        return false;
      }
      if(typeof DeviceOrientationEvent.requestPermission==='function'){
        const result=await DeviceOrientationEvent.requestPermission();
        if(result!=='granted')throw new Error('Permiso de movimiento denegado');
      }
      window.removeEventListener('deviceorientation',onDeviceOrientation);
      window.addEventListener('deviceorientation',onDeviceOrientation,{passive:true});
      motionNeutral=null;motionTurn=0;motionEnabled=true;
      motionStatus.textContent='Control movil activo · giro corregido · posicion actual calibrada como centro.';
      enableMotionBtn.textContent='RECALIBRAR GIRO';
      return true;
    }catch(err){
      motionStatus.textContent='No se pudo activar el giro: '+sinTildes(err&&err.message?err.message:'permiso no disponible');
      return false;
    }
  }
  function refreshTouchControls(){
    mobileFire=false;mobileThrust=false;
    for(const side of touchSides.values()){
      if(side==='fire')mobileFire=true;
      if(side==='thrust')mobileThrust=true;
    }
    if(fireZone)fireZone.classList.toggle('active',mobileFire);
    if(thrustZone)thrustZone.classList.toggle('active',mobileThrust);
  }
  function mobilePointerDown(e){
    if(!isMobile||!inGame)return;
    // Los controles ocupan las mitades izquierda/derecha de la pantalla.
    const side=e.clientX<window.innerWidth/2?'fire':'thrust';
    touchSides.set(e.pointerId,side);refreshTouchControls();
    try{e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
  }
  function mobilePointerEnd(e){
    if(touchSides.delete(e.pointerId))refreshTouchControls();
    if(inGame)e.preventDefault();
  }

  function websocketUrl(){
    const configured=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').trim();
    if(configured){
      try{
        const u=new URL(configured,location.href);
        u.protocol=u.protocol==='https:'?'wss:':'ws:';
        u.pathname='/ws';u.search='';u.hash='';
        return u.toString();
      }catch(_){return null;}
    }
    // En desarrollo/local puede compartir origen con Node. GitHub Pages no
    // ejecuta WebSocket, por lo que alli hay que rellenar config.js.
    if(location.hostname.endsWith('github.io'))return null;
    const proto=location.protocol==='https:'?'wss:':'ws:';
    return `${proto}//${location.host}/ws`;
  }
  function setServerReady(ready){
    for(const b of serverButtons)b.disabled=!ready;
    statusEl.classList.toggle('ready',ready);
    statusEl.classList.toggle('waking',!ready);
    if(serverWait)serverWait.classList.toggle('hidden',ready);
  }
  function wakeStatus(){
    const secs=wakeStartedAt?Math.max(0,Math.floor((Date.now()-wakeStartedAt)/1000)):0;
    const dots='.'.repeat((connectAttempt%3)+1);
    const msg=secs<8
      ? `Conectando con el servidor${dots} espera un momento.`
      : `El servidor se esta iniciando${dots} Puede tardar hasta un minuto (${secs}s).`;
    statusEl.textContent=msg;
    if(serverWaitText)serverWaitText.textContent=msg;
  }
  function scheduleReconnect(delay=2200){
    clearTimeout(reconnectTimer);
    reconnectTimer=setTimeout(connect,delay);
  }
  function connect(){
    const url=websocketUrl();
    if(!url){
      setServerReady(false);
      statusEl.classList.remove('waking');
      statusEl.textContent='Falta configurar el servidor de partida en config.js';
      return;
    }
    if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))return;
    if(!wakeStartedAt)wakeStartedAt=Date.now();
    connectAttempt++;
    setServerReady(false);
    wakeStatus();
    try{ws=new WebSocket(url);}catch(_){scheduleReconnect();return;}
    ws.onopen=()=>{
      clearTimeout(reconnectTimer);
      connectAttempt=0;wakeStartedAt=0;
      setServerReady(true);
      statusEl.textContent='Servidor conectado · listo para jugar';
    };
    ws.onclose=()=>{
      setServerReady(false);
      if(manualClose)return;
      if(inGame){
        statusEl.textContent='Se perdio la conexion con la partida';
        setTimeout(()=>location.reload(),1500);
      }else{
        wakeStatus();
        scheduleReconnect();
      }
    };
    ws.onerror=()=>{
      setServerReady(false);
      wakeStatus();
      // onclose programa el siguiente intento. No mostramos un error definitivo
      // porque un Render gratuito puede estar arrancando todavia.
    };
    ws.onmessage=e=>{
      let m;try{m=JSON.parse(e.data);}catch(_){return;}
      if(voice&&voice.isSignal(m)){voice.handleSignal(m);return;}
      handle(m);
    };
  }
  function send(o){
    if(ws&&ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify(o));return true;}
    if(!inGame){setServerReady(false);if(!wakeStartedAt)wakeStartedAt=Date.now();wakeStatus();connect();}
    return false;
  }
  function uniqueLeaderFrom(players){
    if(!Array.isArray(players)||!players.length)return null;
    const max=Math.max(0,...players.map(p=>Number(p.k)||0));
    if(max<=0)return null;
    const leaders=players.filter(p=>(Number(p.k)||0)===max);
    return leaders.length===1?leaders[0]:null;
  }
  function updateLeaderAnnouncement(nextState,now){
    const leader=uniqueLeaderFrom(nextState&&nextState.players);
    const nextId=leader?leader.i:null;
    if(nextId!==lastUniqueLeader){
      lastUniqueLeader=nextId;
      if(leader){
        leaderAnnouncement={
          i:leader.i,
          name:sinTildes(leader.n),
          until:now+4000
        };
      }
    }
  }
  function resetLeaderAnnouncement(){lastUniqueLeader=null;leaderAnnouncement=null;}
  function handle(m){
    if(m.t==='created'||m.t==='joined'){if(impactFX)impactFX.reset();resetLeaderAnnouncement();roomCode=m.code;myIndex=m.index;isHost=m.t==='created';if(voice)voice.setSession(roomCode,myIndex,!!m.cpu);roomCodeEl.textContent=roomCode;roomMini.textContent=`SALA ${roomCode}`;stopMusic();menu.classList.add('hidden');if(!m.cpu)lobby.classList.remove('hidden');}
    else if(m.t==='lobby'){roomCode=m.code;if(voice)voice.syncPlayers(m.players);roomCodeEl.textContent=m.code;playersEl.innerHTML=m.players.map(p=>`<div style="color:${playerColors[p.i]||'#fff'}">J${p.i+1} · ${escapeHtml(sinTildes(p.n))}${p.cpu?' · CPU':''}</div>`).join('');startBtn.disabled=!(isHost&&m.canStart);}
    else if(m.t==='start'){beginGame();playSound('start');}
    else if(m.t==='state'){
      const now=performance.now();
      if(impactFX)impactFX.consume(m,myIndex,now);
      updateLeaderAnnouncement(m,now);
      state=m;lastStateTime=now;
      if(voice)voice.syncPlayers(m.players);
      if(!inGame&&m.started&&!m.finished)beginGame();
    }
    else if(m.t==='sound'){playSound(m.kind);}
    else if(m.t==='victory'){if(state)state.winner=m.winner;showVictory(m.winner);}
    else if(m.t==='error'){statusEl.textContent=sinTildes(m.message||'Error');}
    else if(m.t==='closed'){alert(sinTildes(m.reason||'Sala cerrada'));location.reload();}
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function beginGame(){stopMusic();inGame=true;menu.classList.add('hidden');lobby.classList.add('hidden');victory.classList.add('hidden');topbar.classList.remove('hidden');if(isMobile)mobileControls.classList.remove('hidden');}
  function showVictory(i){if(!inGame)return;inGame=false;leaderAnnouncement=null;topbar.classList.add('hidden');mobileControls.classList.add('hidden');touchSides.clear();refreshTouchControls();const p=state&&state.players.find(x=>x.i===i);document.getElementById('victoryText').textContent=p?`GANA ${sinTildes(p.n)}`:`GANA J${i+1}`;victory.classList.remove('hidden');}

  menu.addEventListener('pointerdown',startMusic,{passive:true});
  menu.addEventListener('keydown',startMusic);

  document.getElementById('create').addEventListener('click',async()=>{startMusic();if(isMobile&&!motionEnabled)await enableMobileMotion();send({t:'create',name:sinTildes(campoNombre.value)});});
  document.getElementById('cpu').addEventListener('click',async()=>{startMusic();if(isMobile&&!motionEnabled)await enableMobileMotion();send({t:'cpu',name:sinTildes(campoNombre.value),difficulty:document.getElementById('difficulty').value});});
  document.getElementById('join').addEventListener('click',async()=>{startMusic();if(isMobile&&!motionEnabled)await enableMobileMotion();send({t:'join',name:sinTildes(campoNombre.value),code:document.getElementById('code').value});});
  if(isMobile){
    mobileSetup.classList.remove('hidden');
    enableMotionBtn.addEventListener('click',enableMobileMotion);
    document.getElementById('app').addEventListener('pointerdown',mobilePointerDown,{passive:false});
    document.getElementById('app').addEventListener('pointerup',mobilePointerEnd,{passive:false});
    document.getElementById('app').addEventListener('pointercancel',mobilePointerEnd,{passive:false});
    document.getElementById('app').addEventListener('pointerleave',e=>{if(e.pointerType==='touch')mobilePointerEnd(e);},{passive:false});
    window.addEventListener('orientationchange',()=>{motionNeutral=null;motionTurn=0;});
    if(screen.orientation)screen.orientation.addEventListener?.('change',()=>{motionNeutral=null;motionTurn=0;});
  }
  startBtn.addEventListener('click',()=>send({t:'start'}));
  document.getElementById('back').addEventListener('click',()=>location.reload());
  window.addEventListener('keydown',e=>{keys.add(e.code);if(['ArrowUp','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&inGame)location.reload();});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('beforeunload',()=>{manualClose=true;clearTimeout(reconnectTimer);if(voice)voice.shutdown(true);try{if(ws)ws.close();}catch(_){}});

  setInterval(()=>{
    if(!inGame)return;
    const left=keys.has('KeyA')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight');
    const keyboardTurn=(left?1:0)-(right?1:0);
    const turn=(isMobile&&motionEnabled)?motionTurn:keyboardTurn;
    const thrust=(isMobile?mobileThrust:false)||keys.has('KeyW')||keys.has('ArrowUp');
    const fire=(isMobile?mobileFire:false)||keys.has('Space')||keys.has('ControlLeft')||keys.has('ControlRight');
    send({t:'ctrl',turn,thrust,fire});
  },1000/30);

  function imageReady(im){
    // complete is ALSO true after a failed download. Check decoded dimensions.
    return Boolean(im&&im.complete&&im.naturalWidth>0&&im.naturalHeight>0);
  }
  function drawImageSafely(im,x,y,width,height){
    if(!imageReady(im))return false;
    try{
      if(width===undefined){ctx.drawImage(im,x,y);}
      else {ctx.drawImage(im,x,y,width,height);}
      return true;
    }catch(error){
      reportImageFailure(im,error);
      return false;
    }
  }
  function drawImageCentered(im,x,y,size,rot=0,alpha=1){
    if(!imageReady(im)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(rot))return false;
    ctx.save();
    try{
      ctx.globalAlpha=alpha;
      ctx.translate(x,y);
      ctx.rotate(rot*Math.PI/180);
      if(size)return drawImageSafely(im,-size/2,-size/2,size,size);
      return drawImageSafely(im,-im.naturalWidth/2,-im.naturalHeight/2);
    }finally{
      // An image error must never leave translate/rotate/alpha on the canvas.
      ctx.restore();
    }
  }
  function drawPickup(pk){
    const map={ammo1:'ammo1',ammo3:'ammo3',cadence:'cadence',speed:'speed'};
    if(map[pk.type]){drawImageCentered(images[map[pk.type]],pk.x,pk.y,46);return;}
    ctx.save();ctx.translate(pk.x,pk.y);
    if(pk.type==='shield'){ctx.strokeStyle='#8ff5ff';ctx.lineWidth=4;ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.25;ctx.fillStyle='#5adfff';ctx.fill();}
    else if(pk.type==='camo'){ctx.strokeStyle='#d1b4ff';ctx.fillStyle='rgba(160,100,255,.18)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.globalAlpha=.9;ctx.font='18px Arial';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('C',0,1);}
    ctx.restore();
  }
  function spawnProtectionAlpha(secondsLeft){
    if(!Number.isFinite(secondsLeft)||secondsLeft<=0)return 1;
    // Six soft pulses over three seconds. The ship never disappears fully.
    // Use the server timer, so all players see the same protection state.
    const elapsed=Math.max(0,3-secondsLeft);
    return .35+.65*(.5+.5*Math.cos(elapsed*Math.PI*4));
  }
  function drawShip(p){
    const local=p.i===myIndex;
    // The short explosion is drawn by impactFX, never from a PNG download.
    if(p.dead)return;
    if(p.camo>0&&!local)return;
    let alpha=1;
    if(p.camo>0&&local){alpha=.42;if(p.camo<=3)alpha=(Math.floor(performance.now()/160)%2===0)?.55:.22;}
    if(p.prot>0)alpha*=spawnProtectionAlpha(p.prot);
    if(p.shield>0){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='rgba(130,245,255,.95)';ctx.fillStyle='rgba(80,220,255,.12)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,39,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
    // Python: armado = balas > 0 y recarga terminada. El servidor confirma
    // ese estado; no cambiamos el movimiento ni el efecto de propulsion web.
    const shipKey=`ship${p.i+1}`;
    const motionSuffix=Math.hypot(p.vx,p.vy)>40?'a':'';
    const readySuffix=p.armed===true?'f':'';
    const selected=images[shipKey+motionSuffix+readySuffix];
    const normal=images[shipKey+motionSuffix]||images[shipKey];
    // Si el PNG aun no esta disponible, dibujar la nave normal sin bloquear.
    const im=imageReady(selected)?selected:normal;
    // Los PNG originales de las naves apuntan hacia ARRIBA.
    // La fisica usa rot=0 arriba, 90 izquierda, 180 abajo y 270 derecha.
    // Canvas gira en el sentido visual contrario a esa convencion, por eso
    // dibujamos con -rot. Asi el morro coincide exactamente con el avance.
    drawImageCentered(im,p.x,p.y,null,-p.r,alpha);
  }
  function drawHud(){
    if(!state)return;const max=Math.max(0,...state.players.map(p=>p.k));const leaders=state.players.filter(p=>p.k===max&&max>0);const leader=leaders.length===1?leaders[0].i:null;
    state.players.forEach(p=>{
      const left=p.i%2===0,top=p.i<2;const px=left?10:W-216,py=top?5:H-190;const color=playerColors[p.i];
      const panel=images[left?'pantA':'pantB'];drawImageSafely(panel,px,py,128,153);
      ctx.font='20px Flashback,Arial';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='top';let alpha=1;if(leader===p.i)alpha=.62+.38*(.5+.5*Math.sin(performance.now()*.0042));ctx.globalAlpha=alpha;ctx.fillText(`J${p.i+1} · ${sinTildes(p.n)}`,px+64,py+157);ctx.globalAlpha=1;
      const tx=left?60:W-170;ctx.textAlign='left';ctx.fillStyle=color;ctx.fillText(String(p.ammo),tx,py+15);ctx.fillText('x'+p.spd,tx,py+80);ctx.fillText(`${p.k}/${state.scoreToWin}`,tx,py+115);
      ctx.fillStyle='#be0000';ctx.fillRect(tx,py+53,Math.max(0,(30-p.cad)*2.3),7);ctx.fillRect(tx,py+105,67*clamp((p.spd-1),0,1),7);
    });
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function drawLeaderAnnouncement(now){
    if(!leaderAnnouncement)return;
    if(now>=leaderAnnouncement.until){leaderAnnouncement=null;return;}
    const color=playerColors[leaderAnnouncement.i]||'#fff';
    ctx.save();
    try{
      ctx.font='27px Flashback,Arial';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillStyle=color;
      ctx.shadowColor='rgba(0,0,0,.9)';
      ctx.shadowBlur=7;
      ctx.lineWidth=4;
      ctx.strokeStyle='rgba(0,0,0,.78)';
      const text=`LIDER "${leaderAnnouncement.name}"`;
      ctx.strokeText(text,W/2,145);
      ctx.fillText(text,W/2,145);
    }finally{
      ctx.restore();
    }
  }
  function drawMobileControlLabels(){
    if(!isMobile||!inGame)return;
    ctx.save();
    try{
      ctx.font='24px Flashback,Arial';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillStyle='rgba(255,255,255,1)';
      // Muy discretos en reposo y algo mas visibles mientras se pulsa la zona.
      ctx.globalAlpha=mobileFire?.42:.22;
      ctx.fillText('DISPARO',W*.24,H-72);
      ctx.globalAlpha=mobileThrust?.42:.22;
      ctx.fillText('ACELERAR',W*.76,H-72);
    }finally{
      ctx.restore();
    }
  }
  function render(){
    requestAnimationFrame(render);
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha=1;
    ctx.clearRect(0,0,W,H);
    if(!drawImageSafely(images.bg,0,0,W,H)){ctx.fillStyle='#020714';ctx.fillRect(0,0,W,H);}
    if(!state)return;
    // Capa de controles visuales movil: despues del fondo y antes de cualquier
    // objeto de juego, asi todos los elementos de la partida pasan por encima.
    drawMobileControlLabels();
    for(const a of state.asteroids){drawImageCentered(images[`asteroid${a.type}`]||images.asteroid1,a.x,a.y,a.type===5?60:90);}
    for(const pk of state.pickups)drawPickup(pk);
    for(const m of state.meteors)drawImageCentered(images[`asteroid${m.type}`]||images.asteroid1,m.x,m.y,[0,22,27,31][m.type]||25,m.a);
    if(state.giant)drawImageCentered(images.giant,state.giant.x,state.giant.y,270,0,1);
    for(const b of state.bullets){const sp=Math.hypot(b.vx,b.vy)||1;ctx.strokeStyle='#50ff78';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-b.vx/sp*12,b.y-b.vy/sp*12);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const p of state.players)drawShip(p);
    const now=performance.now();
    if(impactFX)impactFX.draw(ctx,now);
    drawHud();
    drawLeaderAnnouncement(now);
    if(state.shower>0){ctx.font='22px Flashback,Arial';ctx.textAlign='center';ctx.fillStyle='rgba(255,170,70,.85)';ctx.fillText('LLUVIA DE METEORITOS',W/2,185);}
  }
  connect();render();
})();
