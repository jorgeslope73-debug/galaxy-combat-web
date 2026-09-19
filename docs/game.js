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
  const images={},sounds={};
  let state=null,previousState=null,myIndex=null,isHost=false,roomCode='',playerToken='',inGame=false,lastStateTime=0,previousStateTime=0;
  const RESUME_STORAGE_KEY='galaxyCombatResumeV1';
  const RESUME_WINDOW_MS=30000;
  let resumeStartedAt=0,resumeExpiryTimer=null;
  function loadResumeSession(){
    try{
      const v=JSON.parse(sessionStorage.getItem(RESUME_STORAGE_KEY)||'null');
      if(v&&typeof v.code==='string'&&typeof v.token==='string'&&v.code&&v.token)return {code:v.code,token:v.token};
    }catch(_){}
    return null;
  }
  function saveResumeSession(){
    if(!roomCode||!playerToken)return;
    try{sessionStorage.setItem(RESUME_STORAGE_KEY,JSON.stringify({code:roomCode,token:playerToken}));}catch(_){}
  }
  function clearResumeSession(){
    try{sessionStorage.removeItem(RESUME_STORAGE_KEY);}catch(_){}
  }
  function stopResumeWindow(){
    resumeStartedAt=0;
    clearTimeout(resumeExpiryTimer);resumeExpiryTimer=null;
    if(roomMini&&roomMini.textContent==='RECONECTANDO...')roomMini.textContent='';
  }
  const NET_FRAME_MS=1000/30;
  const previousLookup={players:new Map(),asteroids:new Map(),pickups:new Map(),meteors:new Map()};
  let lastControlTurn=0,lastVoicePlayersSig='',renderScale=1;
  let lastUniqueLeader=null,leaderAnnouncement=null;
  let killHudFlashStart=0,killHudFlashUntil=0,killScoreFxStart=0,killScoreFxUntil=0;
  // Mantiene visualmente el contador anterior hasta que empieza el pop de escala.
  // La puntuacion real del servidor sigue actualizandose al instante.
  let killScoreHeldValue=null,killScorePendingValue=null;
  let crashScoreFxStart=0,crashScoreFxUntil=0;
  // En penalizacion mantenemos el valor anterior hasta que termina el aviso.
  // Entonces aparece la resta junto con el efecto de escala/explosion del HUD.
  let crashScoreHeldValue=null,crashScorePendingValue=null;
  let penaltyMessageUntil=0;
  let brutalFxStart=0,brutalFxUntil=0,brutalDistance=0;
  let publicRooms=[];
  const keys=new Set(); let ws=null,reconnectTimer=null,musicStarted=false;
  const impactFX=typeof window.GalaxyImpactFX==='function'?new window.GalaxyImpactFX():null;
  let connectAttempt=0,wakeStartedAt=0,manualClose=false;
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
  const mobileSetup=document.getElementById('mobileSetup'),enableMotionBtn=document.getElementById('enableMotion'),motionStatus=document.getElementById('motionStatus');
  const mobileControls=document.getElementById('mobileControls'),fireZone=document.querySelector('.fire-zone'),thrustZone=document.querySelector('.thrust-zone');
  const mobileExit=document.getElementById('mobileExit');
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
  const soundDefs={
    laser:{url:'assets/sonido/laser_1.mp3',size:8,volume:.55},
    impact:{url:'assets/sonido/impacto1.mp3',size:5,volume:.75},
    pickup:{url:'assets/sonido/carga3.wav',size:3,volume:.75},
    start:{url:'assets/sonido/inicio.wav',size:1,volume:.75}
  };
  // V2: sin slider de volumen. Usamos un nivel fijo para evitar que un valor
  // antiguo guardado en localStorage pueda dejar el juego mudo en el movil.
  const gameVolume=isMobile?0.45:0.75;
  const soundPools={};
  for(const [key,def] of Object.entries(soundDefs)){
    const items=[];
    for(let i=0;i<def.size;i++){
      const a=new Audio(def.url);a.preload='auto';a.volume=def.volume*gameVolume;items.push(a);
    }
    soundPools[key]={items,next:0};
  }
  sounds.music=new Audio('assets/sonido/musica.mp3');sounds.music.preload='auto';sounds.music.loop=true;sounds.music.volume=.35*gameVolume;
  function playSound(k){
    const pool=soundPools[k];if(!pool||!pool.items.length)return;
    const a=pool.items[pool.next++%pool.items.length];
    try{a.currentTime=0;const promise=a.play();if(promise&&promise.catch)promise.catch(()=>{});}catch(_){}
  }
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
      const saved=(roomCode&&playerToken)?{code:roomCode,token:playerToken}:loadResumeSession();
      if(saved){
        if(roomMini)roomMini.textContent='RECONECTANDO...';
        send({t:'resume',code:saved.code,token:saved.token});
      }else{
        send({t:'public-rooms'});
      }
    };
    ws.onclose=()=>{
      setServerReady(false);
      if(manualClose)return;
      const saved=(roomCode&&playerToken)?{code:roomCode,token:playerToken}:loadResumeSession();
      if(saved&&(inGame||roomCode)){
        statusEl.textContent='Reconectando con la partida...';
        if(roomMini)roomMini.textContent='RECONECTANDO...';
        if(!resumeStartedAt){
          resumeStartedAt=Date.now();
          clearTimeout(resumeExpiryTimer);
          resumeExpiryTimer=setTimeout(()=>{
            if(!resumeStartedAt)return;
            clearResumeSession();playerToken='';
            alert('No se pudo recuperar la partida.');
            returnToMainMenu(false);
          },RESUME_WINDOW_MS+1500);
        }
        scheduleReconnect(500);
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
  function sendControl(turn,thrust,fire){
    if(!ws||ws.readyState!==WebSocket.OPEN)return false;
    // Los controles caducan enseguida. Si la salida esta congestionada, es
    // mejor omitir uno y mandar el mas reciente 33 ms despues que acumular lag.
    if(Number(ws.bufferedAmount||0)>32*1024)return false;
    try{ws.send(JSON.stringify({t:'ctrl',turn,thrust,fire}));return true;}catch(_){return false;}
  }
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
  async function prepareMobileControls(){
    if(isMobile&&!motionEnabled)await enableMobileMotion();
  }
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
      roomCode=m.code;myIndex=m.index;playerToken=String(m.playerToken||'');isHost=m.t==='created';saveResumeSession();stopResumeWindow();clearLobbyChat();updateLobbyStartButton(false);if(voice)voice.setSession(roomCode,myIndex,!!m.cpu);roomCodeEl.textContent=roomCode;roomMini.textContent='';stopMusic();menu.classList.add('hidden');if(!m.cpu)lobby.classList.remove('hidden');
    }
    else if(m.t==='resumed'){
      roomCode=String(m.code||roomCode);myIndex=Number(m.index);playerToken=String(m.playerToken||playerToken);isHost=!!m.host;saveResumeSession();stopResumeWindow();
      roomCodeEl.textContent=roomCode;if(roomMini)roomMini.textContent='';stopMusic();menu.classList.add('hidden');
      if(voice)voice.setSession(roomCode,myIndex,!!m.cpu);
      if(m.started){lobby.classList.add('hidden');if(!inGame)beginGame();}
      else if(!m.cpu){lobby.classList.remove('hidden');}
    }
    else if(m.t==='resume-failed'){
      stopResumeWindow();clearResumeSession();playerToken='';
      if(inGame||roomCode){alert(sinTildes(m.message||'No se pudo recuperar la partida.'));returnToMainMenu(false);}
      else send({t:'public-rooms'});
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
        // El servidor suma la baja inmediatamente, pero visualmente mantenemos
        // el valor anterior hasta que empieza el pop de escala. De este modo
        // numero nuevo y animacion aparecen exactamente a la vez.
        // Si la baja anterior ya habia sido revelada, el nuevo valor de espera
        // parte del marcador que el jugador ya estaba viendo.
        if(killScoreHeldValue===null||now>=killScoreFxStart)killScoreHeldValue=Number(oldLocal.k)||0;
        killScorePendingValue=Number(newLocal.k)||0;
        killScoreFxStart=now+2000;
        killScoreFxUntil=killScoreFxStart+2000;
      } else if(oldLocal&&newLocal&&Number(newLocal.k)<Number(oldLocal.k)){
        killScoreHeldValue=null;
        killScorePendingValue=null;
        // El servidor descuenta la baja inmediatamente, pero visualmente primero
        // mostramos PENALIZACION -1. Durante ese aviso se conserva el valor
        // anterior; al terminar, aparece la resta con el efecto del HUD.
        crashScoreHeldValue=Number(oldLocal.k)||0;
        crashScorePendingValue=Number(newLocal.k)||0;
        penaltyMessageUntil=now+2000;
        crashScoreFxStart=penaltyMessageUntil;
        crashScoreFxUntil=crashScoreFxStart+950;
      }
      previousState=state;
      previousStateTime=lastStateTime;
      rebuildPreviousLookup(previousState);
      state=m;lastStateTime=now;
      if(!previousState){previousState=m;previousStateTime=now-NET_FRAME_MS;rebuildPreviousLookup(m);}
      syncVoicePlayers(m.players);
      if(!inGame&&m.started&&!m.finished)beginGame();
    }
    else if(m.t==='brutal'){brutalFxStart=performance.now();brutalFxUntil=brutalFxStart+1650;brutalDistance=Number(m.distance)||0;}
    else if(m.t==='sound'){playSound(m.kind);}
    else if(m.t==='victory'){if(state)state.winner=m.winner;showVictory(m.winner);}
    else if(m.t==='restarted'){state=null;previousState=null;lastStateTime=0;previousStateTime=0;rebuildPreviousLookup(null);killHudFlashStart=0;killHudFlashUntil=0;killScoreFxStart=0;killScoreFxUntil=0;killScoreHeldValue=null;killScorePendingValue=null;crashScoreFxStart=0;crashScoreFxUntil=0;crashScoreHeldValue=null;crashScorePendingValue=null;penaltyMessageUntil=0;brutalFxStart=0;brutalFxUntil=0;brutalDistance=0;victory.classList.add('hidden');beginGame();}
    else if(m.t==='error'){statusEl.textContent=sinTildes(m.message||'Error');}
    else if(m.t==='closed'){stopResumeWindow();clearResumeSession();playerToken='';alert(sinTildes(m.reason||'Sala cerrada'));location.reload();}
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function beginGame(){stopMusic();inGame=true;menu.classList.add('hidden');lobby.classList.add('hidden');victory.classList.add('hidden');topbar.classList.remove('hidden');if(isMobile){mobileControls.classList.remove('hidden');if(mobileExit)mobileExit.classList.remove('hidden');}scheduleCanvasResolution();}
  function showVictory(i){if(!inGame)return;inGame=false;leaderAnnouncement=null;topbar.classList.add('hidden');mobileControls.classList.add('hidden');if(mobileExit)mobileExit.classList.add('hidden');touchSides.clear();refreshTouchControls();const p=state&&state.players.find(x=>x.i===i);document.getElementById('victoryText').textContent=p?`GANA ${sinTildes(p.n)}`:`GANA J${i+1}`;const restartBtn=document.getElementById('restartMatch');if(restartBtn){restartBtn.disabled=false;restartBtn.textContent='REPETIR PARTIDA';}victory.classList.remove('hidden');}

  menu.addEventListener('pointerdown',startMusic,{passive:true});
  menu.addEventListener('keydown',startMusic);

  document.getElementById('create').addEventListener('click',()=>{startMusic();showRoomTypeDialog();});
  document.getElementById('cpu').addEventListener('click',async()=>{startMusic();if(isMobile&&!motionEnabled)await enableMobileMotion();send({t:'cpu',name:sinTildes(campoNombre.value),difficulty:document.getElementById('difficulty').value});});
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
  if(isMobile){
    mobileSetup.classList.remove('hidden');
    enableMotionBtn.addEventListener('click',enableMobileMotion);
    document.getElementById('app').addEventListener('pointerdown',mobilePointerDown,{passive:false});
    document.getElementById('app').addEventListener('pointerup',mobilePointerEnd,{passive:false});
    document.getElementById('app').addEventListener('pointercancel',mobilePointerEnd,{passive:false});
    document.getElementById('app').addEventListener('pointerleave',e=>{if(e.pointerType==='touch')mobilePointerEnd(e);},{passive:false});
    window.addEventListener('orientationchange',()=>{
      motionNeutral=null;motionTurn=0;
      touchSides.clear();refreshTouchControls();
      keys.clear();
    });
    if(screen.orientation)screen.orientation.addEventListener?.('change',()=>{motionNeutral=null;motionTurn=0;});
  }
  window.addEventListener('resize',scheduleCanvasResolution,{passive:true});
  window.addEventListener('orientationchange',scheduleCanvasResolution,{passive:true});
  scheduleCanvasResolution();
  startBtn.addEventListener('click',()=>send({t:'start'}));
  function returnToMainMenu(notifyServer=true){
    if(notifyServer&&roomCode)send({t:'leave'});
    if(voice)voice.clearSession();
    stopResumeWindow();clearResumeSession();playerToken='';
    inGame=false;state=null;previousState=null;lastStateTime=0;previousStateTime=0;
    killScoreHeldValue=null;killScorePendingValue=null;killScoreFxStart=0;killScoreFxUntil=0;
    roomCode='';myIndex=null;isHost=false;lastVoicePlayersSig='';rebuildPreviousLookup(null);
    lobby.classList.add('hidden');victory.classList.add('hidden');topbar.classList.add('hidden');
    mobileControls.classList.add('hidden');if(mobileExit)mobileExit.classList.add('hidden');touchSides.clear();refreshTouchControls();
    roomCodeEl.textContent='';roomMini.textContent='';playersEl.innerHTML='';clearLobbyChat();updateLobbyStartButton(false);
    menu.classList.remove('hidden');startMusic();scheduleCanvasResolution();
  }
  document.getElementById('leaveRoom').addEventListener('click',returnToMainMenu);
  if(mobileExit){
    mobileExit.addEventListener('pointerdown',e=>{e.stopPropagation();},{passive:true});
    mobileExit.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();returnToMainMenu();});
  }
  const restartMatchBtn=document.getElementById('restartMatch');
  if(restartMatchBtn)restartMatchBtn.addEventListener('click',()=>{
    restartMatchBtn.disabled=true;
    restartMatchBtn.textContent='REINICIANDO...';
    if(!send({t:'restart'})){restartMatchBtn.disabled=false;restartMatchBtn.textContent='REPETIR PARTIDA';}
  });
  document.getElementById('back').addEventListener('click',returnToMainMenu);
  window.addEventListener('keydown',e=>{keys.add(e.code);if(['ArrowUp','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'){if((roomTypeDialog&&!roomTypeDialog.classList.contains('hidden'))||(publicRoomsDialog&&!publicRoomsDialog.classList.contains('hidden'))){closeRoomDialogs();}else if(inGame)returnToMainMenu();}});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  // Si el navegador pierde el foco, puede no llegar el keyup de una tecla que
  // estaba pulsada. Limpiamos el estado para evitar giro/aceleracion/disparo
  // pegados al volver a la ventana.
  function clearHeldKeys(){
    keys.clear();
    lastControlTurn=0;
    if(inGame&&!isMobile)sendControl(0,false,false);
  }
  window.addEventListener('blur',clearHeldKeys);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeldKeys();});
  window.addEventListener('beforeunload',()=>{manualClose=true;clearTimeout(reconnectTimer);if(voice)voice.shutdown(true);try{if(ws)ws.close();}catch(_){}});

  setInterval(()=>{
    if(!inGame)return;
    const left=keys.has('KeyA')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight');
    const keyboardTurn=(left?1:0)-(right?1:0);
    const turn=(isMobile&&motionEnabled)?motionTurn:keyboardTurn;
    const thrust=(isMobile?mobileThrust:false)||keys.has('KeyW')||keys.has('ArrowUp');
    const fire=(isMobile?mobileFire:false)||keys.has('Space')||keys.has('ControlLeft')||keys.has('ControlRight');
    lastControlTurn=turn;
    sendControl(turn,thrust,fire);
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
  const pickupSpriteMap={ammo1:'ammo1',ammo3:'ammo3',cadence:'cadence',speed:'speed'};
  function pickupExpiryAlpha(pk){
    const raw=pk&&pk.expiresIn;
    // null significa que esta mejora NO esta pendiente de desaparecer.
    // Importante: Number(null) === 0, por eso hay que comprobar null antes.
    if(raw===null||raw===undefined)return 1;
    const left=Number(raw);
    // Durante toda su vida permanece al 100%. Solo en los ultimos 2 segundos
    // parpadea de forma regular entre 50% y 100% de opacidad.
    if(!Number.isFinite(left)||left>2)return 1;
    const now=performance.now()/1000;
    const pulse=.5+.5*Math.sin(now*Math.PI*2*3);
    return .5+.5*pulse;
  }
  function drawPickup(pk,x=pk.x,y=pk.y){
    const alpha=pickupExpiryAlpha(pk);
    if(pickupSpriteMap[pk.type]){drawImageCentered(images[pickupSpriteMap[pk.type]],x,y,46,0,alpha);return;}
    ctx.save();ctx.translate(x,y);
    if(pk.type==='shield'){
      ctx.strokeStyle='#8ff5ff';ctx.lineWidth=4;ctx.globalAlpha=.9*alpha;ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=.25*alpha;ctx.fillStyle='#5adfff';ctx.fill();
    }
    else if(pk.type==='camo'){
      ctx.globalAlpha=alpha;ctx.strokeStyle='#d1b4ff';ctx.fillStyle='rgba(160,100,255,.18)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.globalAlpha=.9*alpha;ctx.font='18px Arial';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('C',0,1);
    }
    ctx.restore();
  }
  function spawnProtectionAlpha(secondsLeft){
    if(!Number.isFinite(secondsLeft)||secondsLeft<=0)return 1;
    // Six soft pulses over three seconds. The ship never disappears fully.
    // Use the server timer, so all players see the same protection state.
    const elapsed=Math.max(0,3-secondsLeft);
    return .35+.65*(.5+.5*Math.cos(elapsed*Math.PI*4));
  }
  function lerp(a,b,t){return a+(b-a)*t;}
  function lerpAngle(a,b,t){
    const delta=((b-a+540)%360)-180;
    return (a+delta*t+360)%360;
  }
  function lerpWrapped(a,b,size,t){
    let delta=b-a;
    if(delta>size/2)delta-=size;else if(delta<-size/2)delta+=size;
    return (a+delta*t+size)%size;
  }
  function interpolationAlpha(now){
    if(!previousState||previousState===state||!lastStateTime)return 1;
    const measured=lastStateTime-previousStateTime;
    const frameMs=clamp(Number.isFinite(measured)&&measured>0?measured:NET_FRAME_MS,20,80);
    return clamp((now-lastStateTime)/frameMs,0,1);
  }
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
  function drawHud(now){
    if(!state)return;
    let max=0,leader=null,tied=false;
    for(const p of state.players){
      const score=Number(p.k)||0;
      if(score>max){max=score;leader=p.i;tied=false;}
      else if(score===max&&score>0){tied=true;}
    }
    if(max<=0||tied)leader=null;
    state.players.forEach(p=>{
      // HUD ligeramente mayor en ambas plataformas para mejorar la lectura.
      // Movil conserva un refuerzo extra porque muestra todo el campo 16:9.
      const hudScale=isMobile?1.60:1.12;
      const panelW=128*hudScale,panelH=153*hudScale;
      const left=p.i%2===0,top=p.i<2;
      const px=left?10:W-88-panelW;
      const bottomHudMargin=isMobile?45:36;
      const py=top?5:H-bottomHudMargin-157*hudScale;
      const color=playerColors[p.i];
      const localKillFlash=p.i===myIndex&&now<killHudFlashUntil;
      const flashElapsed=localKillFlash?Math.max(0,now-killHudFlashStart):0;
      const localKillScoreFx=p.i===myIndex&&now>=killScoreFxStart&&now<killScoreFxUntil;
      const scoreFxElapsed=localKillScoreFx?Math.max(0,now-killScoreFxStart):0;
      const localCrashScoreFx=p.i===myIndex&&now>=crashScoreFxStart&&now<crashScoreFxUntil;
      const crashFxElapsed=localCrashScoreFx?Math.max(0,now-crashScoreFxStart):0;
      const panel=images[left?'pantA':'pantB'];
      if(localKillFlash){
        const flash=1-flashElapsed/450;
        ctx.save();
        ctx.shadowColor=color;
        ctx.shadowBlur=34*flash*hudScale;
        ctx.globalAlpha=1;
        drawImageSafely(panel,px,py,panelW,panelH);
        ctx.globalCompositeOperation='screen';
        ctx.globalAlpha=.32*flash;
        drawImageSafely(panel,px,py,panelW,panelH);
        ctx.restore();
      }else{
        drawImageSafely(panel,px,py,panelW,panelH);
      }
      const rightHud=p.i===1||p.i===3;
      const nameX=rightHud?px+panelW-4*hudScale:px+4*hudScale;
      ctx.font=isMobile?`800 ${22*hudScale}px Arial,Helvetica,sans-serif`:`${20*hudScale}px Flashback,Arial`;ctx.fillStyle=color;ctx.textAlign=rightHud?'right':'left';ctx.textBaseline='top';let alpha=1;if(leader===p.i)alpha=.62+.38*(.5+.5*Math.sin(now*.0042));ctx.globalAlpha=alpha;ctx.fillText(hudPlayerName(p),nameX,py+157*hudScale);ctx.globalAlpha=1;
      const tx=px+(left?50:46)*hudScale;ctx.textAlign='left';ctx.fillStyle=color;if(isMobile)ctx.font=`800 ${23*hudScale}px Arial,Helvetica,sans-serif`;ctx.fillText(String(p.ammo),tx,py+15*hudScale);ctx.fillText('x'+p.spd,tx,py+80*hudScale);
      let displayedKills=Number(p.k)||0;
      if(p.i===myIndex&&killScorePendingValue!==null){
        if(now<killScoreFxStart){
          displayedKills=killScoreHeldValue===null?displayedKills:killScoreHeldValue;
        }else{
          // El nuevo valor aparece justo al comenzar el escalado del marcador.
          displayedKills=killScorePendingValue;
          if(now>=killScoreFxUntil){
            killScoreHeldValue=null;
            killScorePendingValue=null;
          }
        }
      }
      if(p.i===myIndex&&crashScorePendingValue!==null){
        if(now<crashScoreFxStart){
          // Mientras se ve PENALIZACION -1, el HUD conserva el valor anterior.
          displayedKills=crashScoreHeldValue===null?displayedKills:crashScoreHeldValue;
        }else{
          // La resta aparece exactamente cuando comienza el efecto del HUD.
          displayedKills=crashScorePendingValue;
          if(now>=crashScoreFxUntil){
            crashScoreHeldValue=null;
            crashScorePendingValue=null;
          }
        }
      }
      const killText=`${displayedKills}/${state.scoreToWin}`;
      if(localCrashScoreFx){
        // Explosion local del contador cuando una colision propia resta una baja.
        // El nuevo valor ya viene del servidor; aqui solo reforzamos visualmente
        // la penalizacion sin alterar puntuacion, fisica ni red.
        const duration=950;
        const t=clamp(crashFxElapsed/duration,0,1);
        const envelope=1-t;
        const burst=Math.sin(Math.min(1,t*2.4)*Math.PI);
        const kx=tx,ky=py+115*hudScale;
        const shake=envelope*5*hudScale;
        const sx=Math.sin(crashFxElapsed*.12)*shake;
        const sy=Math.cos(crashFxElapsed*.10)*shake*.55;
        ctx.save();
        ctx.translate(kx+sx,ky+sy);
        const scoreScale=1+0.72*burst*envelope;
        ctx.scale(scoreScale,scoreScale);
        ctx.shadowColor='rgba(255,70,20,.95)';
        ctx.shadowBlur=(18+42*envelope)*hudScale;
        ctx.fillStyle='#ff5b2d';
        ctx.globalAlpha=.75+.25*envelope;
        ctx.fillText(killText,0,0);
        ctx.restore();

        // Onda expansiva y chispas alrededor del contador.
        ctx.save();
        ctx.translate(kx,ky+7*hudScale);
        ctx.globalAlpha=Math.max(0,envelope);
        ctx.strokeStyle='#ff7a2f';
        ctx.lineWidth=3*hudScale;
        ctx.shadowColor='rgba(255,80,20,.9)';
        ctx.shadowBlur=14*hudScale*envelope;
        ctx.beginPath();
        ctx.arc(0,0,(10+42*t)*hudScale,0,Math.PI*2);
        ctx.stroke();
        for(let n=0;n<12;n++){
          const a=(Math.PI*2*n/12)+0.18;
          const inner=(12+28*t)*hudScale;
          const outer=(24+58*t)*hudScale;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);
          ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);
          ctx.stroke();
        }
        ctx.restore();
      }else if(localKillScoreFx){
        // Dos segundos despues de la baja, el marcador hace un efecto muy
        // evidente: entrada rapida, gran escala, dos pulsos y brillo fuerte.
        // La animacion completa dura dos segundos.
        const t=clamp(scoreFxElapsed/2000,0,1);
        const intro=clamp(scoreFxElapsed/160,0,1);
        const after=clamp((scoreFxElapsed-160)/1840,0,1);
        const introEase=1-Math.pow(1-intro,3);
        // V16.4.6: pop mucho mas exagerado. El numero entra pequeno y salta
        // hasta unas 3 veces su tamano antes de asentarse con rebotes visibles.
        let scale=.42+2.58*introEase;
        if(scoreFxElapsed>=160){
          const elastic=Math.exp(-after*4.1)*(0.55+0.45*Math.cos(after*18));
          scale=1+2.0*elastic;
        }
        const pulse=.5+.5*Math.sin(scoreFxElapsed*.018);
        const envelope=1-t;
        const kx=tx,ky=py+115*hudScale;
        ctx.save();
        ctx.translate(kx,ky);
        ctx.scale(scale,scale);
        ctx.shadowColor=color;
        ctx.shadowBlur=(34+74*envelope*(.55+.45*pulse))*hudScale;
        ctx.fillStyle=color;
        ctx.globalAlpha=.94+.06*pulse;
        ctx.fillText(killText,0,0);
        ctx.restore();

        // Anillo expansivo adicional para remarcar el momento exacto del cambio.
        if(scoreFxElapsed<720){
          const rt=clamp(scoreFxElapsed/720,0,1);
          ctx.save();
          ctx.translate(kx,ky+7*hudScale);
          ctx.globalAlpha=(1-rt)*.72;
          ctx.strokeStyle=color;
          ctx.lineWidth=3*hudScale;
          ctx.shadowColor=color;
          ctx.shadowBlur=22*hudScale*(1-rt);
          ctx.beginPath();
          ctx.arc(0,0,(12+58*rt)*hudScale,0,Math.PI*2);
          ctx.stroke();
          ctx.restore();
        }
      }else{
        ctx.fillText(killText,tx,py+115*hudScale);
      }
      ctx.fillStyle='#be0000';ctx.fillRect(tx,py+53*hudScale,Math.max(0,(30-p.cad)*2.3*hudScale),7*hudScale);ctx.fillRect(tx,py+105*hudScale,67*clamp((p.spd-1),0,1)*hudScale,7*hudScale);
    });
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

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
      ctx.font=isMobile?'34px Flashback,Arial':'26px Flashback,Arial';
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

  function drawBrutalAnnouncement(now){
    if(!brutalFxUntil||now>=brutalFxUntil)return;
    const age=now-brutalFxStart;
    const total=1650;
    const t=clamp(age/total,0,1);
    const fadeIn=clamp(age/120,0,1);
    const fadeOut=clamp((total-age)/320,0,1);
    const alpha=Math.min(fadeIn,fadeOut);
    const intro=clamp(age/180,0,1);
    const introEase=1-Math.pow(1-intro,3);
    const wobble=Math.sin(age*.035)*Math.max(0,1-t)*.055;
    const scale=(.28+1.72*introEase)*(1+wobble);
    const y=H*.43-Math.min(32,age*.025);
    ctx.save();
    try{
      ctx.translate(W/2,y);
      ctx.rotate(Math.sin(age*.025)*.025*(1-t));
      ctx.scale(scale,scale);
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font=isMobile?'900 72px Arial Black,Arial,sans-serif':'900 64px Arial Black,Arial,sans-serif';
      // BRUTAL conserva el fade de entrada/salida, pero nunca llega a ser
      // completamente opaco para que no tape la accion.
      ctx.globalAlpha=alpha*.82;
      ctx.lineWidth=10;
      ctx.strokeStyle='rgba(0,0,0,.86)';
      ctx.shadowColor='rgba(255,85,20,.95)';
      ctx.shadowBlur=34+28*(1-t);
      ctx.fillStyle='#ffdb35';
      ctx.strokeText('BRUTAL',0,0);
      ctx.fillText('BRUTAL',0,0);
      if(brutalDistance>0){
        ctx.shadowBlur=10;
        ctx.font=isMobile?'800 24px Arial,Helvetica,sans-serif':'800 20px Arial,Helvetica,sans-serif';
        ctx.fillStyle='#ffffff';
        // Escala fisica del juego: diametro de colision de nave = 48 px = 8 m.
        const brutalMeters=brutalDistance*(8/48);
        ctx.fillText(Math.round(brutalMeters)+' m',0,58);
      }
    }finally{ctx.restore();}
  }

  function drawLeaderAnnouncement(now){
    if(!leaderAnnouncement)return;
    if(now>=leaderAnnouncement.until){leaderAnnouncement=null;return;}
    const color=playerColors[leaderAnnouncement.i]||'#fff';
    ctx.save();
    try{
      ctx.font=isMobile?'36px Flashback,Arial':'27px Flashback,Arial';
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
      // El alpha va directamente en el color para que la transparencia sea
      // inequívoca en Safari/iOS. Sin sombra, que hacía parecer el texto más opaco.
      ctx.font='800 36px Arial,Helvetica,sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.globalAlpha=1;
      ctx.shadowColor='transparent';
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,255,255,0.20)';
      // Al pulsar una zona no reducimos el alpha: simplemente no dibujamos
      // ese texto, así desaparece completamente.
      if(!mobileFire)ctx.fillText('DISPARO',W*.24,H-72);
      if(!mobileThrust)ctx.fillText('ACELERAR',W*.76,H-72);
    }finally{
      ctx.restore();
    }
  }
  function drawMobileExitControl(){
    if(!isMobile||!inGame)return;
    const x=W/2,y=28;
    ctx.save();
    try{
      // V16.4.5: el boton visible vive en el canvas, en la capa baja.
      // La zona HTML sigue encima pero es invisible y solo sirve para pulsarlo.
      ctx.globalAlpha=.50;
      ctx.font='800 16px Arial,Helvetica,sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.lineWidth=1.5;
      ctx.strokeStyle='rgba(255,255,255,.45)';
      ctx.fillStyle='rgba(5,7,15,.48)';
      const bw=78,bh=30,r=7;
      ctx.beginPath();
      ctx.roundRect(x-bw/2,y-bh/2,bw,bh,r);
      ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.90)';
      ctx.fillText('SALIR',x,y+1);
    }finally{ctx.restore();}
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
    const blend=interpolationAlpha(now);
    const prev=previousState||state;

    // Capa de controles visuales movil: despues del fondo y antes de cualquier
    // objeto de juego, asi todos los elementos de la partida pasan por encima.
    drawMobileControlLabels();
    drawMobileExitControl();
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
    drawBrutalAnnouncement(now);
    if(state.shower>0){
      const pulse=.58+.42*(.5+.5*Math.sin(performance.now()*.005));
      ctx.save();
      ctx.globalAlpha=pulse;
      ctx.font=isMobile?'30px Flashback,Arial':'22px Flashback,Arial';
      ctx.textAlign='center';
      ctx.fillStyle='rgb(255,170,70)';
      ctx.shadowColor='rgba(255,135,35,.65)';
      ctx.shadowBlur=8+5*(1-pulse);
      ctx.fillText('LLUVIA DE METEORITOS',W/2,185);
      ctx.restore();
    }
  }
  connect();render();
})();
