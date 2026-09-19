'use strict';
const http=require('http');
const {DT,STEP_MS,SNAP_EVERY_TICKS}=require('./physics');
const {GameRoom}=require('./room');
const {createRealtimeServer}=require('./network');
const {broadcastState}=require('./transport');
const {isAllowedOrigin}=require('./security');

const PORT=Number(process.env.PORT||8080);
const rooms=new Map();
const clientInfo=new WeakMap();

function corsHeaders(req,res){
  const origin=String(req.headers.origin||'');
  if(origin&&isAllowedOrigin(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Cache-Control','no-store');
}
function rtcConfig(){
  const iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
  const urls=String(process.env.TURN_URLS||process.env.TURN_URL||'').split(',').map(s=>s.trim()).filter(Boolean);
  const username=String(process.env.TURN_USERNAME||'').trim();
  const credential=String(process.env.TURN_CREDENTIAL||'').trim();
  if(urls.length&&username&&credential)iceServers.push({urls:urls.length===1?urls[0]:urls,username,credential});
  return{iceServers,turnConfigured:iceServers.length>2};
}
const server=http.createServer((req,res)=>{
  corsHeaders(req,res);
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
  const url=(req.url||'/').split('?')[0];
  if(url==='/health'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({ok:true,service:'Galaxy Combat WebSocket',rooms:rooms.size}));return;}
  if(url==='/rtc-config'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(rtcConfig()));return;}
  res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end('Galaxy Combat WebSocket server online.\n');
});

const realtime=createRealtimeServer({
  server,rooms,clientInfo,
  createRoom:(code,mode,difficulty,isPublic)=>new GameRoom(code,mode,difficulty,isPublic)
});

let loopLast=performance.now(),loopAccumulator=0,simTick=0;
function gameLoop(){
  const now=performance.now();let elapsed=now-loopLast;loopLast=now;if(!Number.isFinite(elapsed)||elapsed<0)elapsed=STEP_MS;loopAccumulator+=Math.min(100,elapsed);
  let steps=0;
  while(loopAccumulator>=STEP_MS&&steps<5){
    for(const room of rooms.values())room.update(DT);
    loopAccumulator-=STEP_MS;simTick++;
    if(simTick%SNAP_EVERY_TICKS===0)for(const room of rooms.values())if(room.started)broadcastState(room,room.publicState());
    steps++;
  }
  if(steps===5&&loopAccumulator>=STEP_MS)loopAccumulator%=STEP_MS;
  const delay=Math.max(1,Math.min(STEP_MS,STEP_MS-loopAccumulator-.5));setTimeout(gameLoop,delay);
}
setTimeout(gameLoop,STEP_MS);
setInterval(()=>{const now=Date.now();let changed=false;for(const [code,room] of rooms){if(room.players.length===0||now-room.createdAt>12*60*60*1000){rooms.delete(code);changed=true;}}if(changed)realtime.broadcastPublicRooms();},30000).unref?.();

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`Galaxy Combat server online on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`TURN: ${rtcConfig().turnConfigured?'configured':'not configured (STUN only)'}`);
});
