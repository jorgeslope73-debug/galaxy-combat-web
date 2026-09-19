'use strict';
const SCORE_TO_WIN=5,MAX_PLAYERS=4,SPAWN_PROTECTION_SECONDS=3,CONTROL_TIMEOUT_MS=300;
const IDLE_CONTROL=Object.freeze({turn:0,thrust:false,fire:false,at:0});
function roomCode(rooms){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let tries=0;tries<100;tries++){let c='';for(let i=0;i<4;i++)c+=alphabet[Math.floor(Math.random()*alphabet.length)];if(!rooms.has(c))return c;}
  return String(Date.now()).slice(-4);
}
function safeName(v,fallback='JUGADOR'){const s=String(v||'').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,16);return s||fallback;}
function safeChatText(v){return String(v||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/[áàäâÁÀÄÂ]/g,c=>c===c.toUpperCase()?'A':'a').replace(/[éèëêÉÈËÊ]/g,c=>c===c.toUpperCase()?'E':'e').replace(/[íìïîÍÌÏÎ]/g,c=>c===c.toUpperCase()?'I':'i').replace(/[óòöôÓÒÖÔ]/g,c=>c===c.toUpperCase()?'O':'o').replace(/[úùüûÚÙÜÛ]/g,c=>c===c.toUpperCase()?'U':'u').replace(/\s+/g,' ').trim().slice(0,120);}
module.exports={SCORE_TO_WIN,MAX_PLAYERS,SPAWN_PROTECTION_SECONDS,CONTROL_TIMEOUT_MS,IDLE_CONTROL,roomCode,safeName,safeChatText};
