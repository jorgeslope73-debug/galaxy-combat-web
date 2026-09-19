'use strict';
function send(ws,obj){if(ws&&ws.readyState===ws.OPEN){try{ws.send(JSON.stringify(obj));}catch(_){}}}
function broadcast(room,obj){const data=JSON.stringify(obj);for(const p of room.players){if(p.ws&&p.ws.readyState===p.ws.OPEN){try{p.ws.send(data);}catch(_){}}}}
function broadcastState(room,obj,maxStateBuffer=128*1024){const data=JSON.stringify(obj);for(const p of room.players){if(!p.ws||p.ws.readyState!==p.ws.OPEN)continue;if(Number(p.ws.bufferedAmount||0)>maxStateBuffer)continue;try{p.ws.send(data);}catch(_){}}}
function emitSound(room,kind){room.soundSeq++;broadcast(room,{t:'sound',kind,seq:room.soundSeq});}
function sendToPlayer(room,index,obj){const p=room&&room.players.find(x=>x.index===index&&!x.cpu);if(!p||!p.ws)return false;send(p.ws,obj);return true;}
function broadcastVoicePresence(room,from,type,extra={}){for(const p of room.players){if(p.cpu||p.index===from||!p.ws)continue;send(p.ws,{t:type,from,...extra});}}
module.exports={send,broadcast,broadcastState,emitSound,sendToPlayer,broadcastVoicePresence};
