'use strict';
const {WebSocketServer}=require('ws');
const {clamp}=require('./physics');
const {safeChatText,roomCode,MAX_PLAYERS}=require('./gameplay');
const {MAX_PAYLOAD,isAllowedOrigin,clientIp,allowRate,allowIpCreate}=require('./security');

const {send,broadcast,broadcastState,emitSound,sendToPlayer,broadcastVoicePresence}=require('./transport');

function publicRoomsSnapshot(rooms){
  const list=[];for(const room of rooms.values()){if(!room.isPublic||room.mode!=='online'||room.started||room.finished)continue;const humans=room.players.filter(p=>!p.cpu);if(!humans.length||humans.length>=MAX_PLAYERS)continue;const host=humans.find(p=>p.isHost)||humans[0];list.push({code:room.code,host:host?host.name:'JUGADOR',players:humans.length,maxPlayers:MAX_PLAYERS,createdAt:room.createdAt});}
  list.sort((a,b)=>b.players-a.players||a.createdAt-b.createdAt);return list.map(({createdAt,...room})=>room);
}
function createRealtimeServer({server,rooms,clientInfo,createRoom}){
  let wss=null;
  const sendPublicRooms=ws=>send(ws,{t:'public-rooms',rooms:publicRoomsSnapshot(rooms)});
  const broadcastPublicRooms=()=>{if(!wss)return;const data=JSON.stringify({t:'public-rooms',rooms:publicRoomsSnapshot(rooms)});for(const client of wss.clients)if(client.readyState===client.OPEN){try{client.send(data);}catch(_){}}};
  function removePlayer(ws){
    const info=clientInfo.get(ws);if(!info)return;const room=rooms.get(info.code);if(!room){clientInfo.delete(ws);return;}const p=room.players.find(x=>x.ws===ws);if(!p){clientInfo.delete(ws);return;}
    if(p.voiceReady)broadcastVoicePresence(room,p.index,'voice-left');room.players=room.players.filter(x=>x!==p);room.controls.delete(p.index);clientInfo.delete(ws);
    if(p.isHost){broadcast(room,{t:'closed',reason:'El anfitrion cerro la sala.'});rooms.delete(room.code);}else broadcast(room,{t:'lobby',code:room.code,players:room.players.map(x=>({i:x.index,n:x.name,cpu:x.cpu})),canStart:room.canStart()});broadcastPublicRooms();
  }
  function rejectIfInRoom(ws){if(!clientInfo.has(ws))return false;send(ws,{t:'error',message:'Ya estas en una sala. Sal primero para crear o unirte a otra.'});return true;}
  wss=new WebSocketServer({server,path:'/ws',perMessageDeflate:false,maxPayload:MAX_PAYLOAD,verifyClient:info=>isAllowedOrigin(info.origin)});
  wss.on('connection',(ws,req)=>{
    ws._galaxyIp=clientIp(req);send(ws,{t:'hello'});sendPublicRooms(ws);
    ws.on('message',raw=>{
      if(!allowRate(ws,'all',700,10000)){send(ws,{t:'error',message:'Demasiados mensajes.'});return;}
      let msg;try{msg=JSON.parse(String(raw));}catch(_){return;}if(!msg||typeof msg!=='object'||typeof msg.t!=='string')return;
      if(msg.t==='create'){
        if(rejectIfInRoom(ws))return;if(!allowRate(ws,'create',3,60000)||!allowIpCreate(ws._galaxyIp)){send(ws,{t:'error',message:'Demasiadas salas creadas. Espera un momento.'});return;}
        const code=roomCode(rooms),room=createRoom(code,'online','medio',!!msg.public);rooms.set(code,room);const p=room.addHuman(ws,msg.name,true);clientInfo.set(ws,{code,index:p.index});send(ws,{t:'created',code,index:p.index,public:room.isPublic});send(ws,{t:'chat-history',messages:room.chatMessages});broadcast(room,{t:'lobby',code,players:room.players.map(x=>({i:x.index,n:x.name,cpu:x.cpu})),canStart:room.canStart()});broadcastPublicRooms();
      }else if(msg.t==='cpu'){
        if(rejectIfInRoom(ws))return;if(!allowRate(ws,'create',3,60000)||!allowIpCreate(ws._galaxyIp)){send(ws,{t:'error',message:'Demasiadas partidas creadas. Espera un momento.'});return;}
        const code=roomCode(rooms),room=createRoom(code,'cpu',String(msg.difficulty||'dificil'),false);rooms.set(code,room);const p=room.addHuman(ws,msg.name,true);room.addCpu('CPU',room.difficulty);clientInfo.set(ws,{code,index:p.index});send(ws,{t:'created',code,index:p.index,cpu:true});room.start();
      }else if(msg.t==='join'){
        if(rejectIfInRoom(ws))return;if(!allowRate(ws,'join',20,60000)){send(ws,{t:'error',message:'Demasiados intentos de union.'});return;}
        const code=String(msg.code||'').trim().toUpperCase(),room=rooms.get(code);if(!room||room.started||room.mode!=='online'){send(ws,{t:'error',message:'Sala no disponible.'});return;}const p=room.addHuman(ws,msg.name,false);if(!p){send(ws,{t:'error',message:'Sala llena.'});return;}clientInfo.set(ws,{code,index:p.index});send(ws,{t:'joined',code,index:p.index,public:room.isPublic});send(ws,{t:'chat-history',messages:room.chatMessages});broadcast(room,{t:'lobby',code,players:room.players.map(x=>({i:x.index,n:x.name,cpu:x.cpu})),canStart:room.canStart()});broadcastPublicRooms();
      }else if(msg.t==='start'){
        const info=clientInfo.get(ws),room=info&&rooms.get(info.code),p=room&&room.players.find(x=>x.ws===ws);if(room&&p&&p.isHost&&room.start())broadcastPublicRooms();
      }else if(msg.t==='public-rooms')sendPublicRooms(ws);
      else if(msg.t==='chat'){
        const info=clientInfo.get(ws),room=info&&rooms.get(info.code),p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p||p.cpu||room.mode!=='online'||room.started||room.finished)return;const now=Date.now();if(now-(p.lastChatAt||0)<600)return;const text=safeChatText(msg.text);if(!text)return;p.lastChatAt=now;const chat={t:'chat',id:++room.chatSeq,i:p.index,n:p.name,text};room.chatMessages.push({id:chat.id,i:chat.i,n:chat.n,text:chat.text});if(room.chatMessages.length>24)room.chatMessages.splice(0,room.chatMessages.length-24);broadcast(room,chat);
      }else if(msg.t==='ctrl'){
        if(!allowRate(ws,'ctrl',45,1000))return;const info=clientInfo.get(ws),room=info&&rooms.get(info.code);if(!room||!room.started)return;room.setHumanControl(info.index,{turn:clamp(Number(msg.turn)||0,-1,1),thrust:!!msg.thrust,fire:!!msg.fire});
      }else if(msg.t==='voice-ready'){
        const info=clientInfo.get(ws),room=info&&rooms.get(info.code),p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p||p.cpu)return;p.voiceReady=true;send(ws,{t:'voice-peers',peers:room.players.filter(x=>!x.cpu&&x.index!==p.index&&x.voiceReady).map(x=>x.index)});broadcastVoicePresence(room,p.index,'voice-ready');
      }else if(msg.t==='voice-offline'){
        const info=clientInfo.get(ws),room=info&&rooms.get(info.code),p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p)return;p.voiceReady=false;broadcastVoicePresence(room,p.index,'voice-offline');
      }else if(msg.t==='voice-offer'||msg.t==='voice-answer'||msg.t==='voice-ice'){
        if(!allowRate(ws,'voice-signal',80,10000))return;const info=clientInfo.get(ws),room=info&&rooms.get(info.code),p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p||p.cpu||!p.voiceReady)return;const to=Number(msg.to);if(!Number.isInteger(to)||to===p.index)return;const target=room.players.find(x=>x.index===to&&!x.cpu&&x.voiceReady);if(!target)return;sendToPlayer(room,to,{t:msg.t,from:p.index,data:msg.data});
      }else if(msg.t==='voice-talking'){
        const info=clientInfo.get(ws),room=info&&rooms.get(info.code),p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p||p.cpu||!p.voiceReady)return;broadcastVoicePresence(room,p.index,'voice-talking',{on:!!msg.on});
      }else if(msg.t==='leave')removePlayer(ws);
    });
    ws.on('close',()=>removePlayer(ws));
  });
  return{wss,sendPublicRooms,broadcastPublicRooms,removePlayer};
}
module.exports={send,broadcast,broadcastState,emitSound,sendToPlayer,broadcastVoicePresence,publicRoomsSnapshot,createRealtimeServer};
