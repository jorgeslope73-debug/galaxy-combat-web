'use strict';
(() => {
  const STORAGE_KEY='galaxyCombatLanguage';
  const dictionaries={
    es:{
      orientationTitle:'GIRA EL MÓVIL',orientationCopy:'Galaxy Combat se juega en horizontal.',
      yourName:'TU NOMBRE',defaultPlayer:'JUGADOR',playerNameAria:'Nombre del jugador',
      connectingWait:'Conectando con el servidor... espera un momento.',connectingShort:'Conectando con el servidor...',
      modesAria:'Modos de juego',modeCpu:'CONTRA LA MAQUINA',cpuDifficultyAria:'Dificultad CPU',easy:'FACIL',medium:'MEDIO',hard:'DIFICIL',play:'JUGAR',
      modeOnline:'ONLINE · 2-4 JUGADORES',createGame:'CREAR PARTIDA',modeJoin:'UNIRSE A UNA SALA',join:'UNIRSE',
      roomTypeTitle:'TIPO DE PARTIDA',roomTypeCopy:'PUBLICA aparece en la lista. PRIVADA solo se puede abrir con su codigo.',publicRoom:'PUBLICA',privateRoom:'PRIVADA',cancel:'CANCELAR',
      publicGames:'PARTIDAS PUBLICAS',searchingGames:'Buscando partidas...',orEnterCode:'O ENTRA POR CODIGO',codePlaceholder:'CODIGO',roomCodeAria:'Codigo de sala',close:'CERRAR',
      voiceChatAria:'Chat de voz',activateVoice:'ACTIVAR VOZ',voiceActive:'VOZ ACTIVA',voiceEnabled:'VOZ ACTIVADA',voiceDisabled:'VOZ DESACTIVADA',
      rotateControl:'GIRAR',orArrows:'o flechas',accelerate:'ACELERAR',fire:'DISPARAR',mobileGuide:'Inclina para girar · izquierda: disparo · derecha: acelerar.',
      room:'SALA',roomChat:'CHAT DE SALA',noMessages:'Sin mensajes',messagePlaceholder:'ESCRIBE MENSAJE...',messageAria:'Mensaje para la sala',send:'ENVIAR',start:'EMPEZAR',leaveRoom:'SALIR DE SALA',lobbyHelp:'Los demas abren esta misma direccion y escriben el codigo.',
      victory:'VICTORIA',rematch:'REPETIR PARTIDA',mainMenu:'MENU PRINCIPAL',escExit:'ESC: salir',holdToTalk:'Mantener para hablar',exit:'SALIR',exitAria:'Salir de la partida y volver al inicio',
      sensorUnsupported:'Este navegador no ofrece sensor de orientacion.',motionPermissionDenied:'Permiso de movimiento denegado',motionError:'No se pudo activar el giro: {detail}',permissionUnavailable:'permiso no disponible',
      connectingServer:'Conectando con el servidor{dots} espera un momento.',serverStarting:'El servidor se esta iniciando{dots} Puede tardar hasta un minuto ({secs}s).',serverConfigMissing:'Falta configurar el servidor de partida en config.js',serverReady:'Servidor conectado · listo para jugar',reconnecting:'RECONECTANDO...',reconnectingGame:'Reconectando con la partida...',resumeFailed:'No se pudo recuperar la partida.',
      noPublicRooms:'NO HAY PARTIDAS PUBLICAS ESPERANDO',roomPrefix:'SALA',winnerName:'GANA {name}',winnerIndex:'GANA J{index}',restarting:'REINICIANDO...',
      penalty:'PENALIZACION -1',brutal:'BRUTAL',leader:'LIDER "{name}"',ghost:'FANTASMA',fireControl:'DISPARO',thrustControl:'ACELERAR',meteorShower:'LLUVIA DE METEORITOS',
      microphoneUnavailable:'MICROFONO NO DISPONIBLE',requestingMicrophone:'SOLICITANDO MICROFONO...',microphoneDenied:'PERMISO DE MICROFONO DENEGADO',tapVoiceToHear:'TOCA ACTIVAR VOZ PARA OIR A LOS DEMAS',talk:'HABLAR',talkingPlayer:'J{index} HABLANDO',voiceHintTalking:'V · HABLANDO',voiceHintTalk:'V · HABLAR',
      error:'Error',roomUnavailable:'Sala no disponible.',roomFull:'Sala llena.',reconnectExpired:'Ha pasado el tiempo de reconexión.',matchNotRecoverable:'La partida ya no se puede recuperar.',hostClosed:'El anfitrión cerró la sala.',hostDisconnected:'El anfitrión perdió la conexión.',previousRoomReplaced:'La sala anterior fue reemplazada por una nueva sesion.',activeRoomExists:'YA TIENES UNA SALA ACTIVA.'
    },
    en:{
      orientationTitle:'ROTATE YOUR PHONE',orientationCopy:'Galaxy Combat is designed for landscape mode.',
      yourName:'YOUR NAME',defaultPlayer:'PLAYER',playerNameAria:'Player name',
      connectingWait:'Connecting to the server... please wait.',connectingShort:'Connecting to the server...',
      modesAria:'Game modes',modeCpu:'VS CPU',cpuDifficultyAria:'CPU difficulty',easy:'EASY',medium:'MEDIUM',hard:'HARD',play:'PLAY',
      modeOnline:'ONLINE · 2-4 PLAYERS',createGame:'CREATE GAME',modeJoin:'JOIN A ROOM',join:'JOIN',
      roomTypeTitle:'GAME TYPE',roomTypeCopy:'PUBLIC appears in the list. PRIVATE can only be opened with its code.',publicRoom:'PUBLIC',privateRoom:'PRIVATE',cancel:'CANCEL',
      publicGames:'PUBLIC GAMES',searchingGames:'Searching for games...',orEnterCode:'OR ENTER A CODE',codePlaceholder:'CODE',roomCodeAria:'Room code',close:'CLOSE',
      voiceChatAria:'Voice chat',activateVoice:'ENABLE VOICE',voiceActive:'VOICE ON',voiceEnabled:'VOICE ENABLED',voiceDisabled:'VOICE OFF',
      rotateControl:'TURN',orArrows:'or arrows',accelerate:'THRUST',fire:'FIRE',mobileGuide:'Tilt to turn · left: fire · right: thrust.',
      room:'ROOM',roomChat:'ROOM CHAT',noMessages:'No messages',messagePlaceholder:'TYPE A MESSAGE...',messageAria:'Message to the room',send:'SEND',start:'START',leaveRoom:'LEAVE ROOM',lobbyHelp:'The others open this same address and enter the code.',
      victory:'VICTORY',rematch:'PLAY AGAIN',mainMenu:'MAIN MENU',escExit:'ESC: exit',holdToTalk:'Hold to talk',exit:'EXIT',exitAria:'Leave the match and return to the main menu',
      sensorUnsupported:'This browser does not provide an orientation sensor.',motionPermissionDenied:'Motion permission denied',motionError:'Could not enable tilt controls: {detail}',permissionUnavailable:'permission unavailable',
      connectingServer:'Connecting to the server{dots} please wait.',serverStarting:'The server is starting{dots} It may take up to a minute ({secs}s).',serverConfigMissing:'The game server is not configured in config.js',serverReady:'Server connected · ready to play',reconnecting:'RECONNECTING...',reconnectingGame:'Reconnecting to the match...',resumeFailed:'The match could not be recovered.',
      noPublicRooms:'NO PUBLIC GAMES WAITING',roomPrefix:'ROOM',winnerName:'{name} WINS',winnerIndex:'J{index} WINS',restarting:'RESTARTING...',
      penalty:'PENALTY -1',brutal:'BRUTAL',leader:'LEADER "{name}"',ghost:'GHOST',fireControl:'FIRE',thrustControl:'THRUST',meteorShower:'METEOR SHOWER',
      microphoneUnavailable:'MICROPHONE UNAVAILABLE',requestingMicrophone:'REQUESTING MICROPHONE...',microphoneDenied:'MICROPHONE PERMISSION DENIED',tapVoiceToHear:'TAP ENABLE VOICE TO HEAR THE OTHERS',talk:'TALK',talkingPlayer:'J{index} TALKING',voiceHintTalking:'V · TALKING',voiceHintTalk:'V · TALK',
      error:'Error',roomUnavailable:'Room unavailable.',roomFull:'Room full.',reconnectExpired:'The reconnection window has expired.',matchNotRecoverable:'The match can no longer be recovered.',hostClosed:'The host closed the room.',hostDisconnected:'The host lost connection.',previousRoomReplaced:'The previous room was replaced by a new session.',activeRoomExists:'YOU ALREADY HAVE AN ACTIVE ROOM.'
    }
  };
  const serverMap={
    'YA TIENES UNA SALA ACTIVA.':'activeRoomExists',
    'Sala no disponible.':'roomUnavailable',
    'Sala llena.':'roomFull',
    'La partida ya no se puede recuperar.':'matchNotRecoverable',
    'Ha pasado el tiempo de reconexión.':'reconnectExpired',
    'El anfitrión cerró la sala.':'hostClosed',
    'El anfitrión perdió la conexión.':'hostDisconnected',
    'La sala anterior fue reemplazada por una nueva sesion.':'previousRoomReplaced'
  };
  let language='es';
  try{language=localStorage.getItem(STORAGE_KEY)==='en'?'en':'es';}catch(_){}
  function format(text,vars){
    if(!vars)return text;
    return String(text).replace(/\{([a-zA-Z0-9_]+)\}/g,(m,k)=>Object.prototype.hasOwnProperty.call(vars,k)?String(vars[k]):m);
  }
  function t(key,vars){
    const dict=dictionaries[language]||dictionaries.es;
    const fallback=dictionaries.es[key]||key;
    return format(dict[key]||fallback,vars);
  }
  function translateServerText(text){
    const raw=String(text==null?'':text);
    const key=serverMap[raw];
    return key?t(key):raw;
  }
  function apply(root=document){
    if(!root)return;
    root.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.setAttribute('placeholder',t(el.dataset.i18nPlaceholder));});
    root.querySelectorAll('[data-i18n-aria]').forEach(el=>{el.setAttribute('aria-label',t(el.dataset.i18nAria));});
    const nameEl=document.getElementById('name');
    if(nameEl){
      const oldDefault=nameEl.dataset.defaultPlayer||dictionaries.es.defaultPlayer;
      const nextDefault=t('defaultPlayer');
      if(!nameEl.value||nameEl.value===oldDefault)nameEl.value=nextDefault;
      nameEl.dataset.defaultPlayer=nextDefault;
    }
    document.documentElement.lang=language==='en'?'en':'es';
    document.querySelectorAll('[data-language]').forEach(btn=>{
      const active=btn.dataset.language===language;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
    });
  }
  function setLanguage(next,{notify=true}={}){
    language=next==='en'?'en':'es';
    try{localStorage.setItem(STORAGE_KEY,language);}catch(_){}
    apply(document);
    if(notify)window.dispatchEvent(new CustomEvent('galaxy-languagechange',{detail:{language}}));
  }
  window.GalaxyI18n={t,apply,setLanguage,getLanguage:()=>language,translateServerText};
  document.querySelectorAll('[data-language]').forEach(btn=>{
    btn.addEventListener('click',()=>setLanguage(btn.dataset.language));
  });
  apply(document);
})();
