'use strict';
(() => {
  class GalaxyNetwork {
    constructor({onMessage=()=>{},onReady=()=>{},onWakeStatus=()=>{},onDisconnect=()=>{},isInGame=()=>false}={}){
      this.onMessage=onMessage;this.onReady=onReady;this.onWakeStatus=onWakeStatus;this.onDisconnect=onDisconnect;this.isInGame=isInGame;
      this.ws=null;this.reconnectTimer=null;this.connectAttempt=0;this.wakeStartedAt=0;this.manualClose=false;
    }
    websocketUrl(){
      const configured=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').trim();
      if(configured){try{const u=new URL(configured,location.href);u.protocol=u.protocol==='https:'?'wss:':'ws:';u.pathname='/ws';u.search='';u.hash='';return u.toString();}catch(_){return null;}}
      if(location.hostname.endsWith('github.io'))return null;
      const proto=location.protocol==='https:'?'wss:':'ws:';return `${proto}//${location.host}/ws`;
    }
    wakeText(){
      const secs=this.wakeStartedAt?Math.max(0,Math.floor((Date.now()-this.wakeStartedAt)/1000)):0;
      const dots='.'.repeat((this.connectAttempt%3)+1);
      return secs<8?`Conectando con el servidor${dots} espera un momento.`:`El servidor se esta iniciando${dots} Puede tardar hasta un minuto (${secs}s).`;
    }
    scheduleReconnect(delay=2200){clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>this.connect(),delay);}
    connect(){
      const url=this.websocketUrl();
      if(!url){this.onReady(false);this.onWakeStatus('Falta configurar el servidor de partida en config.js',true);return;}
      if(this.ws&&(this.ws.readyState===WebSocket.OPEN||this.ws.readyState===WebSocket.CONNECTING))return;
      if(!this.wakeStartedAt)this.wakeStartedAt=Date.now();this.connectAttempt++;this.onReady(false);this.onWakeStatus(this.wakeText(),false);
      try{this.ws=new WebSocket(url);}catch(_){this.scheduleReconnect();return;}
      this.ws.onopen=()=>{clearTimeout(this.reconnectTimer);this.connectAttempt=0;this.wakeStartedAt=0;this.onReady(true);this.onWakeStatus('Servidor conectado · listo para jugar',true);this.send({t:'public-rooms'});};
      this.ws.onclose=()=>{this.onReady(false);if(this.manualClose)return;if(this.isInGame())this.onDisconnect(true);else{this.onWakeStatus(this.wakeText(),false);this.scheduleReconnect();}};
      this.ws.onerror=()=>{this.onReady(false);this.onWakeStatus(this.wakeText(),false);};
      this.ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}this.onMessage(m);};
    }
    send(obj){
      if(this.ws&&this.ws.readyState===WebSocket.OPEN){try{this.ws.send(JSON.stringify(obj));return true;}catch(_){} }
      if(!this.isInGame()){this.onReady(false);if(!this.wakeStartedAt)this.wakeStartedAt=Date.now();this.onWakeStatus(this.wakeText(),false);this.connect();}
      return false;
    }
    sendControl(turn,thrust,fire){
      const ws=this.ws;if(!ws||ws.readyState!==WebSocket.OPEN)return false;
      if(Number(ws.bufferedAmount||0)>32*1024)return false;
      try{ws.send(JSON.stringify({t:'ctrl',turn,thrust,fire}));return true;}catch(_){return false;}
    }
    close(){this.manualClose=true;clearTimeout(this.reconnectTimer);try{this.ws?.close();}catch(_){} }
  }
  window.GalaxyNetwork=GalaxyNetwork;
})();
