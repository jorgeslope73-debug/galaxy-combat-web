'use strict';
(() => {
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:false,desynchronized:true})||canvas.getContext('2d');
  const menu=document.getElementById('menu'),lobby=document.getElementById('lobby'),victory=document.getElementById('victory');
  const statusEl=document.getElementById('status'),roomCodeEl=document.getElementById('roomCode'),playersEl=document.getElementById('players'),startBtn=document.getElementById('start'),topbar=document.getElementById('topbar'),roomMini=document.getElementById('roomMini');
  const lobbyChatLog=document.getElementById('lobbyChatLog'),lobbyChatEmpty=document.getElementById('lobbyChatEmpty'),lobbyChatInput=document.getElementById('lobbyChatInput'),lobbyChatSend=document.getElementById('lobbyChatSend');
  const serverWait=document.getElementById('serverWait'),serverWaitText=document.getElementById('serverWaitText');
  const roomTypeDialog=document.getElementById('roomTypeDialog'),publicRoomsDialog=document.getElementById('publicRoomsDialog'),publicRoomsList=document.getElementById('publicRoomsList'),joinCodeDialog=document.getElementById('joinCodeDialog');
  const W=1920,H=1080;
  const playerColors=['#5ae1ff','#ff50a5','#5aff78','#ffdc46'];
  const images={};
  let state=null,previousState=null,myIndex=null,isHost=false,roomCode='',inGame=false,lastStateTime=0,previousStateTime=0;
  const NET_FRAME_MS=1000/30;
  const previousLookup={players:new Map(),asteroids:new Map(),pickups:new Map(),meteors:new Map()};
  let lastControlTurn=0,lastVoicePlayersSig='',renderScale=1;
  let lastUniqueLeader=null,leaderAnnouncement=null;
  let killHudFlashStart=0,killHudFlashUntil=0,killScoreFxStart=0,killScoreFxUntil=0;
  let crashScoreFxStart=0,crashScoreFxUntil=0;
  let penaltyMessageUntil=0;
  let publicRooms=[];
  const impactFX=typeof window.GalaxyImpactFX==='function'?new window.GalaxyImpactFX():null;
  const serverButtons=['cpu','create','join'].map(id=>document.getElementById(id));
  const isMobile=(matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  // Tamano visual de las naves. Solo cambia el dibujo: fisica, colisiones y red quedan iguales.
  const SHIP_DRAW_SIZE=isMobile?86:72;
  const SHIELD_DRAW_RADIUS=isMobile?48:43;
  const voice=typeof window.GalaxyVoice==='function'?new window.GalaxyVoice({send:o=>send(o),isMobile}):null;
  function updateCanvasResolution(){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    // En movil 720p de buffer es suficiente para una pantalla pequena y reduce
    // a menos de la mitad los pixeles que Canvas debe repintar cada frame.
    const maxWidth=isMobile?1280:W;
    const dpr=Math.min(window.devicePixelRatio||1,isMobile?1.35:1.6);
    const fitScale=Math.min(1,maxWidth/W,(rect.width*dpr)/W,(rect.height*dpr)/H);
    const safeScale=Math.max(1/3,fitScale);
    const targetW=Math.max(640,Math.min(maxWidth,Math.round((W*safeScale)/2)*2));
    const targetH=Math.round(targetW*H/W);
    if(canvas.width!==targetW||canvas.height!==targetH){
      canvas.width=targetW;canvas.height=targetH;
    }
    renderScale=canvas.width/W;
  }
  let resizeRaf=0;
  function scheduleCanvasResolution(){
    if(resizeRaf)return;
    resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;updateCanvasResolution();});
  }
  const mobileExit=document.getElementById('mobileExit');
  const input=typeof window.GalaxyInput==='function'?new window.GalaxyInput({
    isMobile,
    onEscape:()=>{
      if((roomTypeDialog&&!roomTypeDialog.classList.contains('hidden'))||(publicRoomsDialog&&!publicRoomsDialog.classList.contains('hidden')))closeRoomDialogs();
      else if(inGame)returnToMainMenu();
    }
  }):null;


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
  function hudPlayerName(p){
    const raw=sinTildes(p&&p.n!=null?p.n:'').trim();
    const upper=raw.toUpperCase();
    const defaultNumber=`JUGADOR ${Number(p&&p.i)+1}`;
    if(!raw||upper==='JUGADOR'||upper===defaultNumber)return `J${Number(p&&p.i)+1}`;
    return raw;
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
    bg:isMobile?'assets/sprites/fondo_1280.png':'assets/sprites/fondo.png', giant:'assets/sprites/asteroidegrande_270.png',
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
    im.decoding='async';
    im.onerror=()=>reportImageFailure(im);
    im.onload=()=>{if(typeof im.decode==='function')im.decode().catch(()=>{});};
    im.src=url;
    images[k]=im;
  }
  const audio=typeof window.GalaxyAudio==='function'?new window.GalaxyAudio({isMobile,menu}):null;
  const playSound=k=>audio&&audio.playSound(k);
  const startMusic=()=>audio&&audio.startMusic();
  const stopMusic=()=>audio&&audio.stopMusic();
  const renderUtils=window.GalaxyRenderUtils&&window.GalaxyRenderUtils.create?window.GalaxyRenderUtils.create({ctx,W,H,reportImageFailure}):null;
  const {imageReady,drawImageSafely,drawImageCentered,clamp,lerp,lerpAngle,lerpWrapped}=renderUtils;
  const interpolationAlphaFor=(now)=>renderUtils.interpolationAlpha(previousState,state,lastStateTime,previousStateTime,now,NET_FRAME_MS);
  const hudRenderer=window.GalaxyHud&&window.GalaxyHud.create?window.GalaxyHud.create({ctx,W,H,isMobile,images,playerColors,drawImageSafely,hudPlayerName,clamp}):null;




  function setServerReady(ready){
    for(const b of serverButtons)b.disabled=!ready;
    statusEl.classList.toggle('ready',ready);
    statusEl.classList.toggle('waking',!ready);
    if(serverWait)serverWait.classList.toggle('hidden',ready);
  }
  function setNetworkStatus(text,final=false){
    statusEl.textContent=text;if(serverWaitText)serverWaitText.textContent=text;
    if(final&&text.startsWith('Falta'))statusEl.classList.remove('waking');
  }
  let network=null;
  function send(o){return network?network.send(o):false;}
  function sendControl(turn,thrust,fire){return network?network.sendControl(turn,thrust,fire):false;}

  function uniqueLeaderFrom(players){
    if(!Array.isArray(players)||!players.length)return null;
    let max=0,leader=null,tied=false;
    for(const p of players){
      const score=Number(p&&p.k)||0;
      if(score>max){max=score;leader=p;tied=false;}
      else if(score===max&&score>0){tied=true;}
    }
    return max>0&&!tied?leader:null;
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
  function rebuildPreviousLookup(snapshot){
    previousLookup.players.clear();previousLookup.asteroids.clear();previousLookup.pickups.clear();previousLookup.meteors.clear();
    if(!snapshot)return;
    for(const p of snapshot.players||[])previousLookup.players.set(p.i,p);
    for(const a of snapshot.asteroids||[])previousLookup.asteroids.set(a.id,a);
    for(const p of snapshot.pickups||[])previousLookup.pickups.set(p.id,p);
    for(const m of snapshot.meteors||[])previousLookup.meteors.set(m.id,m);
  }
  function syncVoicePlayers(players,force=false){
    if(!voice)return;
    let sig='';
    if(Array.isArray(players))for(const p of players)if(p&&!p.cpu)sig+=String(p.i)+',';
    if(!force&&sig===lastVoicePlayersSig)return;
    lastVoicePlayersSig=sig;
    voice.syncPlayers(players);
  }
  function closeRoomDialogs(){
    if(roomTypeDialog)roomTypeDialog.classList.add('hidden');
    if(publicRoomsDialog)publicRoomsDialog.classList.add('hidden');
    if(menu)menu.classList.remove('submenu-open');
  }
  function renderPublicRooms(){
    if(!publicRoomsList)return;
    publicRoomsList.textContent='';
    if(!publicRooms.length){
      const p=document.createElement('p');p.className='public-rooms-empty';p.textContent='NO HAY PARTIDAS PUBLICAS ESPERANDO';publicRoomsList.appendChild(p);return;
    }
    for(const room of publicRooms){
      const row=document.createElement('div');row.className='public-room-row';
      const info=document.createElement('div');info.className='public-room-info';
      const host=document.createElement('span');host.className='public-room-host';host.textContent=sinTildes(room.host||'JUGADOR');
      const code=document.createElement('span');code.className='public-room-code';code.textContent='SALA '+String(room.code||'');
      info.append(host,code);
      const count=document.createElement('span');count.className='public-room-count';count.textContent=`${Number(room.players)||0}/${Number(room.maxPlayers)||4}`;
      const joinBtn=document.createElement('button');joinBtn.type='button';joinBtn.className='public-room-join';joinBtn.textContent='UNIRSE';
      joinBtn.addEventListener('click',()=>joinRoomByCode(room.code));
      row.append(info,count,joinBtn);publicRoomsList.appendChild(row);
    }
  }
  function showRoomTypeDialog(){
    if(menu)menu.classList.add('submenu-open');
    if(roomTypeDialog)roomTypeDialog.classList.remove('hidden');
  }
  function showPublicRoomsDialog(){
    if(joinCodeDialog)joinCodeDialog.value='';
    if(menu)menu.classList.add('submenu-open');
    if(publicRoomsDialog)publicRoomsDialog.classList.remove('hidden');
    renderPublicRooms();send({t:'public-rooms'});
  }
  async function prepareMobileControls(){if(input)await input.prepareForGame();}
  async function createOnlineRoom(isPublic){
    startMusic();await prepareMobileControls();closeRoomDialogs();
    send({t:'create',name:sinTildes(campoNombre.value),public:!!isPublic});
  }
  async function joinRoomByCode(code){
    const clean=String(code||'').trim().toUpperCase();
    if(!clean){showPublicRoomsDialog();return;}
    startMusic();await prepareMobileControls();closeRoomDialogs();
    send({t:'join',name:sinTildes(campoNombre.value),code:clean});
  }
  function updateLobbyStartButton(canStart=false){
    if(!startBtn)return;
    // Solo el anfitrion necesita un control para iniciar la partida.
    startBtn.textContent='EMPEZAR';
    startBtn.classList.toggle('hidden',!isHost);
    startBtn.disabled=isHost?!canStart:true;
  }
  function clearLobbyChat(){
    if(!lobbyChatLog)return;
    lobbyChatLog.querySelectorAll('.lobby-chat-line').forEach(el=>el.remove());
    if(lobbyChatEmpty)lobbyChatEmpty.classList.remove('hidden');
    lobbyChatLog.scrollTop=lobbyChatLog.scrollHeight;
    if(lobbyChatInput)lobbyChatInput.value='';
  }
  function appendLobbyChatMessage(msg){
    if(!lobbyChatLog||!msg)return;
    const text=String(msg.text||'').trim();
    if(!text)return;
    if(lobbyChatEmpty)lobbyChatEmpty.classList.add('hidden');
    const line=document.createElement('div');line.className='lobby-chat-line';
    const who=document.createElement('span');who.className='lobby-chat-name';
    const idx=Number(msg.i);who.style.color=playerColors[idx]||'#fff';
    who.textContent=`J${Number.isFinite(idx)?idx+1:'?'} ${sinTildes(msg.n||'JUGADOR')}:`;
    const body=document.createElement('span');body.className='lobby-chat-text';body.textContent=sinTildes(text);
    line.append(who,body);lobbyChatLog.appendChild(line);
    while(lobbyChatLog.querySelectorAll('.lobby-chat-line').length>24){
      const first=lobbyChatLog.querySelector('.lobby-chat-line');if(!first)break;first.remove();
    }
    lobbyChatLog.scrollTop=lobbyChatLog.scrollHeight;
  }
  function loadLobbyChatHistory(messages){
    clearLobbyChat();
    for(const msg of (Array.isArray(messages)?messages:[]))appendLobbyChatMessage(msg);
  }
  function sendLobbyChat(){
    if(!roomCode||inGame||!lobbyChatInput)return;
    const text=sinTildes(String(lobbyChatInput.value||'').trim()).slice(0,120);
    if(!text)return;
    if(send({t:'chat',text}))lobbyChatInput.value='';
  }
  function handle(m){
    if(m.t==='public-rooms'){
      publicRooms=Array.isArray(m.rooms)?m.rooms:[];renderPublicRooms();return;
    }
    if(m.t==='chat-history'){loadLobbyChatHistory(m.messages);return;}
    if(m.t==='chat'){appendLobbyChatMessage(m);return;}
    if(m.t==='created'||m.t==='joined'){
      closeRoomDialogs();
      if(impactFX)impactFX.reset();resetLeaderAnnouncement();
      state=null;previousState=null;lastStateTime=0;previousStateTime=0;lastVoicePlayersSig='';rebuildPreviousLookup(null);
      roomCode=m.code;myIndex=m.index;isHost=m.t==='created';clearLobbyChat();updateLobbyStartButton(false);if(voice)voice.setSession(roomCode,myIndex,!!m.cpu);roomCodeEl.textContent=roomCode;roomMini.textContent='';stopMusic();menu.classList.add('hidden');if(!m.cpu)lobby.classList.remove('hidden');
    }
    else if(m.t==='lobby'){roomCode=m.code;syncVoicePlayers(m.players,true);roomCodeEl.textContent=m.code;playersEl.innerHTML=m.players.map(p=>`<div style="color:${playerColors[p.i]||'#fff'}">J${p.i+1} · ${escapeHtml(sinTildes(p.n))}${p.cpu?' · CPU':''}</div>`).join('');updateLobbyStartButton(!!m.canStart);}
    else if(m.t==='start'){beginGame();playSound('start');}
    else if(m.t==='state'){
      const now=performance.now();
      if(impactFX)impactFX.consume(m,myIndex,now);
      updateLeaderAnnouncement(m,now);
      const oldLocal=state&&Array.isArray(state.players)?state.players.find(p=>p.i===myIndex):null;
      const newLocal=Array.isArray(m.players)?m.players.find(p=>p.i===myIndex):null;
      if(oldLocal&&newLocal&&Number(newLocal.k)>Number(oldLocal.k)){
        // Confirmacion visual local de baja: no se envia por red y solo la ve
        // el jugador que acaba de sumar una muerte.
        killHudFlashStart=now;
        killHudFlashUntil=now+450;
        // El marcador espera dos segundos desde la baja y luego hace un pulso
        // grande durante otros dos segundos. Solo existe en este cliente.
        killScoreFxStart=now+2000;
        killScoreFxUntil=killScoreFxStart+2000;
      } else if(oldLocal&&newLocal&&Number(newLocal.k)<Number(oldLocal.k)){
        // Penalizacion por estrellarse: el servidor ya ha descontado la baja.
        // Esta explosion del marcador es exclusivamente local y solo la ve
        // el jugador al que se le acaba de restar el punto.
        crashScoreFxStart=now;
        crashScoreFxUntil=now+950;
        penaltyMessageUntil=now+2000;
      }
      previousState=state;
      previousStateTime=lastStateTime;
      rebuildPreviousLookup(previousState);
      state=m;lastStateTime=now;
      if(!previousState){previousState=m;previousStateTime=now-NET_FRAME_MS;rebuildPreviousLookup(m);}
      syncVoicePlayers(m.players);
      if(!inGame&&m.started&&!m.finished)beginGame();
    }
    else if(m.t==='sound'){playSound(m.kind);}
    else if(m.t==='victory'){if(state)state.winner=m.winner;showVictory(m.winner);}
    else if(m.t==='error'){statusEl.textContent=sinTildes(m.message||'Error');}
    else if(m.t==='closed'){alert(sinTildes(m.reason||'Sala cerrada'));location.reload();}
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function beginGame(){stopMusic();inGame=true;menu.classList.add('hidden');lobby.classList.add('hidden');victory.classList.add('hidden');topbar.classList.remove('hidden');if(input)input.enterGame();if(isMobile&&mobileExit)mobileExit.classList.remove('hidden');scheduleCanvasResolution();}
  function showVictory(i){if(!inGame)return;inGame=false;leaderAnnouncement=null;topbar.classList.add('hidden');if(input)input.exitGame();if(mobileExit)mobileExit.classList.add('hidden');const p=state&&state.players.find(x=>x.i===i);document.getElementById('victoryText').textContent=p?`GANA ${sinTildes(p.n)}`:`GANA J${i+1}`;victory.classList.remove('hidden');}

  menu.addEventListener('pointerdown',startMusic,{passive:true});
  menu.addEventListener('keydown',startMusic);

  document.getElementById('create').addEventListener('click',()=>{startMusic();showRoomTypeDialog();});
  document.getElementById('cpu').addEventListener('click',async()=>{startMusic();await prepareMobileControls();send({t:'cpu',name:sinTildes(campoNombre.value),difficulty:document.getElementById('difficulty').value});});
  document.getElementById('join').addEventListener('click',()=>{startMusic();showPublicRoomsDialog();});
  document.getElementById('createPublic').addEventListener('click',()=>createOnlineRoom(true));
  document.getElementById('createPrivate').addEventListener('click',()=>createOnlineRoom(false));
  document.getElementById('closeRoomType').addEventListener('click',closeRoomDialogs);
  document.getElementById('closePublicRooms').addEventListener('click',closeRoomDialogs);
  document.getElementById('joinByCodeDialog').addEventListener('click',()=>joinRoomByCode(joinCodeDialog&&joinCodeDialog.value));
  if(joinCodeDialog)joinCodeDialog.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();joinRoomByCode(joinCodeDialog.value);}});
  if(roomTypeDialog)roomTypeDialog.addEventListener('pointerdown',e=>{if(e.target===roomTypeDialog)closeRoomDialogs();});
  if(publicRoomsDialog)publicRoomsDialog.addEventListener('pointerdown',e=>{if(e.target===publicRoomsDialog)closeRoomDialogs();});
  if(lobbyChatSend)lobbyChatSend.addEventListener('click',sendLobbyChat);
  if(lobbyChatInput)lobbyChatInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendLobbyChat();}
    // Evita que las teclas escritas en el chat controlen la nave si cambia el estado.
    e.stopPropagation();
  });
  if(lobbyChatInput)lobbyChatInput.addEventListener('keyup',e=>e.stopPropagation());

  window.addEventListener('resize',scheduleCanvasResolution,{passive:true});
  window.addEventListener('orientationchange',scheduleCanvasResolution,{passive:true});
  scheduleCanvasResolution();
  startBtn.addEventListener('click',()=>send({t:'start'}));
  function returnToMainMenu(){
    if(roomCode)send({t:'leave'});
    if(voice)voice.clearSession();
    inGame=false;state=null;previousState=null;lastStateTime=0;previousStateTime=0;
    roomCode='';myIndex=null;isHost=false;lastVoicePlayersSig='';rebuildPreviousLookup(null);
    lobby.classList.add('hidden');victory.classList.add('hidden');topbar.classList.add('hidden');
    if(input)input.exitGame();if(mobileExit)mobileExit.classList.add('hidden');
    roomCodeEl.textContent='';roomMini.textContent='';playersEl.innerHTML='';clearLobbyChat();updateLobbyStartButton(false);
    menu.classList.remove('hidden');startMusic();scheduleCanvasResolution();
  }
  document.getElementById('leaveRoom').addEventListener('click',returnToMainMenu);
  if(mobileExit){
    mobileExit.addEventListener('pointerdown',e=>{e.stopPropagation();},{passive:true});
    mobileExit.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();returnToMainMenu();});
  }
  document.getElementById('back').addEventListener('click',()=>returnToMainMenu());
  window.addEventListener('beforeunload',()=>{if(voice)voice.shutdown(true);if(network)network.close();});

  setInterval(()=>{
    if(!inGame||!input)return;
    const control=input.getControl();
    lastControlTurn=control.turn;
    sendControl(control.turn,control.thrust,control.fire);
  },1000/30);



  function drawShip(p,previous,blend,now){
    const local=p.i===myIndex;
    let x=p.x,y=p.y,r=p.r;
    if(local){
      // La nave local no espera un snapshot extra: extrapolamos solo unas
      // decenas de ms con la velocidad autoritativa para suavizar el refresco.
      const age=Math.min(.05,Math.max(0,(now-lastStateTime)/1000));
      x=(p.x+p.vx*age+W)%W;y=(p.y+p.vy*age+H)%H;
      r=(p.r+lastControlTurn*240*age+360)%360;
    }else if(previous&&!previous.dead){
      x=lerpWrapped(previous.x,p.x,W,blend);
      y=lerpWrapped(previous.y,p.y,H,blend);
      r=lerpAngle(previous.r,p.r,blend);
    }
    // The short explosion is drawn by impactFX, never from a PNG download.
    if(p.dead)return;
    if(p.camo>0&&!local)return;
    let alpha=1;
    if(p.camo>0&&local){alpha=.42;if(p.camo<=3)alpha=(Math.floor(now/160)%2===0)?.55:.22;}
    if(p.prot>0)alpha*=spawnProtectionAlpha(p.prot);
    if(p.shield>0){
      let shieldAlpha=alpha;
      // Aviso visual en los ultimos 3 segundos: el escudo parpadea suavemente
      // sin modificar su duracion ni la proteccion real en el servidor.
      if(p.shield<=3){
        const shieldPulse=.38+.62*(.5+.5*Math.sin(now*.012));
        shieldAlpha*=shieldPulse;
      }
      ctx.save();ctx.globalAlpha=shieldAlpha;ctx.strokeStyle='rgba(130,245,255,.95)';ctx.fillStyle='rgba(80,220,255,.12)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,SHIELD_DRAW_RADIUS,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
    }
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
    drawImageCentered(im,x,y,SHIP_DRAW_SIZE,-r,alpha);
  }
  function drawHud(now){if(hudRenderer)hudRenderer.draw({state,now,myIndex,fx:{killHudFlashStart,killHudFlashUntil,killScoreFxStart,killScoreFxUntil,crashScoreFxStart,crashScoreFxUntil}});}


  function drawPenaltyAnnouncement(now){
    if(!penaltyMessageUntil||now>=penaltyMessageUntil)return;
    const remaining=penaltyMessageUntil-now;
    const age=2000-remaining;
    const fadeIn=clamp(age/180,0,1);
    const fadeOut=clamp(remaining/320,0,1);
    const alpha=Math.min(fadeIn,fadeOut);
    const pulse=.94+.06*Math.sin(age*.012);
    ctx.save();
    try{
      ctx.translate(W/2,105);
      ctx.scale(pulse,pulse);
      ctx.font='26px Flashback,Arial';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.globalAlpha=alpha;
      ctx.fillStyle='#ff6a32';
      ctx.strokeStyle='rgba(0,0,0,.82)';
      ctx.lineWidth=5;
      ctx.shadowColor='rgba(255,70,20,.9)';
      ctx.shadowBlur=14;
      const text='PENALIZACION -1';
      ctx.strokeText(text,0,0);
      ctx.fillText(text,0,0);
    }finally{
      ctx.restore();
    }
  }

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
      // Tipografia solida y legible en movil, manteniendo el aspecto semitransparente.
      ctx.font='800 30px Arial,Helvetica,sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillStyle='rgba(255,255,255,1)';
      ctx.shadowColor='rgba(0,0,0,.65)';
      ctx.shadowBlur=4;
      // En reposo siguen discretos; al pulsar se hacen bastante mas visibles.
      const visual=input?input.getVisualState():{fire:false,thrust:false,mode:'tilt'};
      if(visual.mode!=='tilt')return;
      ctx.globalAlpha=visual.fire?.78:.32;
      ctx.fillText('DISPARO',W*.24,H-72);
      ctx.globalAlpha=visual.thrust?.78:.32;
      ctx.fillText('ACELERAR',W*.76,H-72);
    }finally{
      ctx.restore();
    }
  }
  function drawMobileVoiceControl(){
    if(!isMobile||!inGame||!voice||!voice.enabled||voice.cpuMode)return;
    const x=W/2,y=H-72;
    const talking=!!voice.talking;
    ctx.save();
    try{
      // El control visual se pinta en el canvas, justo encima del fondo.
      // Las naves, meteoritos, balas y mejoras se dibujan despues y por tanto
      // siempre pasan por encima del icono.
      ctx.globalAlpha=talking?.52:.24;
      ctx.fillStyle=talking?'rgba(95,255,150,.72)':'rgba(255,255,255,.42)';
      ctx.strokeStyle=talking?'rgba(150,255,188,.92)':'rgba(255,255,255,.52)';
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(x,y,31,0,Math.PI*2);ctx.fill();ctx.stroke();

      ctx.globalAlpha=talking?.78:.48;
      ctx.strokeStyle='#ffffff';
      ctx.fillStyle='#ffffff';
      ctx.lineWidth=4;
      ctx.lineCap='round';ctx.lineJoin='round';
      // Capsula del microfono.
      ctx.beginPath();
      ctx.roundRect(x-8,y-16,16,25,8);
      ctx.fill();
      // Arco inferior, pie y base.
      ctx.beginPath();
      ctx.arc(x,y-2,14,0,Math.PI,false);
      ctx.stroke();
      ctx.beginPath();ctx.moveTo(x,y+12);ctx.lineTo(x,y+20);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-8,y+20);ctx.lineTo(x+8,y+20);ctx.stroke();
    }finally{
      ctx.restore();
    }
  }
  function render(){
    requestAnimationFrame(render);
    // Limpiar en pixeles fisicos y dibujar despues en coordenadas logicas
    // 1920x1080. En movil el buffer puede ser 1280x720 sin cambiar la fisica.
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha=1;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(renderScale,0,0,renderScale,0,0);
    if(!drawImageSafely(images.bg,0,0,W,H)){ctx.fillStyle='#020714';ctx.fillRect(0,0,W,H);}
    if(!state)return;

    const now=performance.now();
    const blend=interpolationAlphaFor(now);
    const prev=previousState||state;

    // Capa de controles visuales movil: despues del fondo y antes de cualquier
    // objeto de juego, asi todos los elementos de la partida pasan por encima.
    drawMobileControlLabels();
    drawMobileVoiceControl();

    for(const a of state.asteroids){
      const old=previousLookup.asteroids.get(a.id);
      const x=old?lerp(old.x,a.x,blend):a.x;
      const y=old?lerp(old.y,a.y,blend):a.y;
      drawImageCentered(images[`asteroid${a.type}`]||images.asteroid1,x,y,a.type===5?60:90);
    }
    for(const pk of state.pickups){
      const old=previousLookup.pickups.get(pk.id);
      drawPickup(pk,old?lerp(old.x,pk.x,blend):pk.x,old?lerp(old.y,pk.y,blend):pk.y);
    }
    for(const m of state.meteors){
      const old=previousLookup.meteors.get(m.id);
      const x=old?lerp(old.x,m.x,blend):m.x;
      const y=old?lerp(old.y,m.y,blend):m.y;
      const angle=old?lerpAngle(old.a,m.a,blend):m.a;
      drawImageCentered(images[`asteroid${m.type}`]||images.asteroid1,x,y,[0,22,27,31][m.type]||25,angle);
    }
    if(state.giant){
      const old=prev.giant;
      drawImageCentered(images.giant,old?lerp(old.x,state.giant.x,blend):state.giant.x,old?lerp(old.y,state.giant.y,blend):state.giant.y,270,0,1);
    }

    // Las balas ya traen velocidad: una extrapolacion muy corta evita el efecto
    // de avance a saltos sin alterar nunca la posicion autoritativa del servidor.
    const age=Math.min(.05,Math.max(0,(now-lastStateTime)/1000));
    for(const b of state.bullets){
      const x=b.x+b.vx*age,y=b.y+b.vy*age;
      const sp=Math.hypot(b.vx,b.vy)||1;
      ctx.strokeStyle='#50ff78';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-b.vx/sp*12,y-b.vy/sp*12);ctx.lineTo(x,y);ctx.stroke();
    }
    for(const p of state.players){
      const old=previousLookup.players.get(p.i);
      drawShip(p,old,blend,now);
    }
    if(impactFX)impactFX.draw(ctx,now);
    drawHud(now);
    drawPenaltyAnnouncement(now);
    drawLeaderAnnouncement(now);
    if(state.shower>0){
      const pulse=.58+.42*(.5+.5*Math.sin(performance.now()*.005));
      ctx.save();
      ctx.globalAlpha=pulse;
      ctx.font='22px Flashback,Arial';
      ctx.textAlign='center';
      ctx.fillStyle='rgb(255,170,70)';
      ctx.shadowColor='rgba(255,135,35,.65)';
      ctx.shadowBlur=8+5*(1-pulse);
      ctx.fillText('LLUVIA DE METEORITOS',W/2,185);
      ctx.restore();
    }
  }
  network=typeof window.GalaxyNetwork==='function'?new window.GalaxyNetwork({
    onMessage:m=>{if(voice&&voice.isSignal(m)){voice.handleSignal(m);return;}handle(m);},
    onReady:setServerReady,
    onWakeStatus:setNetworkStatus,
    onDisconnect:()=>{statusEl.textContent='Se perdio la conexion con la partida';setTimeout(()=>location.reload(),1500);},
    isInGame:()=>inGame
  }):null;
  if(network)network.connect();render();
})();
