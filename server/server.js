'use strict';

const http = require('http');
const { randomBytes } = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const W = 1920;
const H = 1080;
const TICK_HZ = 60;
const NET_HZ = 30;
const DT = 1 / TICK_HZ;
const STEP_MS = 1000 / TICK_HZ;
const SNAP_EVERY_TICKS = Math.max(1, Math.round(TICK_HZ / NET_HZ));
const DRAG_PER_TICK = Math.pow(0.35, DT);
const MAX_STATE_BUFFER = 128 * 1024;
const IDLE_CONTROL = Object.freeze({turn:0, thrust:false, fire:false});
const SCORE_TO_WIN = 5;
const MAX_PLAYERS = 4;
const RECONNECT_GRACE_MS = 30000;

const SHIP_RADIUS = 24;
const ASTEROID_RADIUS = 45;
const GIANT_RADIUS = 135;
const PICKUP_RADIUS = 22;
const BULLET_RADIUS = 4;
const SMALL_METEOR_RADIUS = 14;

const SPAWN_PROTECTION_SECONDS = 3;

// The HUD is drawn at (10 / W-216, 5 / H-190), size 128 x 153.
// Reserve the name line too. Leave extra breathing room so the ships do not
// start visually glued to the HUD, including the larger mobile HUD. Spawns
// stay under the top panels and above the bottom panels.
function spawnArea(index) {
  const left = index % 2 === 0;
  const top = index < 2;
  const panelX = left ? 10 : W - 216;
  const panelY = top ? 5 : H - 190;
  const centerX = panelX + 64;
  const gap = 90;
  const spreadY = 100;
  const nearY = top
    ? panelY + 153 + 28 + SHIP_RADIUS + gap
    : panelY - SHIP_RADIUS - gap;
  return {
    minX: Math.max(SHIP_RADIUS + 12, centerX - 28),
    maxX: Math.min(W - SHIP_RADIUS - 12, centerX + 28),
    minY: top ? nearY : nearY - spreadY,
    maxY: top ? nearY + spreadY : nearY,
    rot: left ? 270 : 90
  };
}

const ASTEROID_STARTS = [
  [160, 430, 300, 1], [30, 930, 10, 3], [1800, 30, 210, 4],
  [1500, 150, 160, 2], [500, 430, 160, 5], [1300, 430, 200, 6]
];

const rooms = new Map();
const activeRoomByIp = new Map();
const clientInfo = new WeakMap();
let nextEntityId = 1;

function uid() { return nextEntityId++; }
function newPlayerToken() { return randomBytes(24).toString('hex'); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randint(a, b) { return Math.floor(rand(a, b + 1)); }
function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy; }
function circles(a, ar, b, br) { const rr = ar + br; return dist2(a, b) <= rr * rr; }
function dirFromRot(rot) {
  const r = rot * Math.PI / 180;
  return { x: -Math.sin(r), y: -Math.cos(r) };
}
function normalize(x, y) {
  const l = Math.hypot(x, y) || 1;
  return { x: x/l, y: y/l };
}
function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tries=0; tries<100; tries++) {
    let c = '';
    for (let i=0;i<4;i++) c += alphabet[Math.floor(Math.random()*alphabet.length)];
    if (!rooms.has(c)) return c;
  }
  return String(Date.now()).slice(-4);
}
function safeName(v, fallback='JUGADOR') {
  const s = String(v || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0,16);
  return s || fallback;
}
function normalizeClientIp(value) {
  let ip = String(value || '').trim();
  if (!ip) return 'unknown';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1,-1);
  return ip || 'unknown';
}
function clientIpFromRequest(req) {
  const forwarded = req && req.headers ? req.headers['x-forwarded-for'] : '';
  const raw = Array.isArray(forwarded) ? forwarded[0] : (forwarded || (req && req.socket && req.socket.remoteAddress));
  return normalizeClientIp(raw);
}
function activeRoomForIp(ip) {
  const code = activeRoomByIp.get(ip);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) { activeRoomByIp.delete(ip); return null; }
  return room;
}
// Si el creador perdio su WebSocket, conservamos la sala durante la ventana
// de reconexion. Pero una peticion explicita para CREAR desde la misma IP
// significa que el usuario ha abandonado esa sesion y quiere empezar otra.
// En ese caso cerramos la sala huerfana y liberamos la IP inmediatamente.
function releaseAbandonedRoomForIp(ip) {
  const room = activeRoomForIp(ip);
  if (!room) return false;
  const host = room.players.find(p => !p.cpu && p.isHost);
  if (!host || host.ws || !host.disconnectedAt) return false;
  broadcast(room,{t:'closed',reason:'La sala anterior fue reemplazada por una nueva sesion.'});
  deleteRoom(room.code);
  broadcastPublicRooms();
  return true;
}
function registerRoomCreator(room, ip) {
  room.creatorIp = ip;
  activeRoomByIp.set(ip, room.code);
}
function releaseRoomCreator(room) {
  if (!room || !room.creatorIp) return;
  if (activeRoomByIp.get(room.creatorIp) === room.code) activeRoomByIp.delete(room.creatorIp);
}
function deleteRoom(code) {
  const room = rooms.get(code);
  if (!room) return false;
  releaseRoomCreator(room);
  rooms.delete(code);
  return true;
}

function safeChatText(v) {
  return String(v || '')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/[áàäâÁÀÄÂ]/g, c => c===c.toUpperCase()?'A':'a')
    .replace(/[éèëêÉÈËÊ]/g, c => c===c.toUpperCase()?'E':'e')
    .replace(/[íìïîÍÌÏÎ]/g, c => c===c.toUpperCase()?'I':'i')
    .replace(/[óòöôÓÒÖÔ]/g, c => c===c.toUpperCase()?'O':'o')
    .replace(/[úùüûÚÙÜÛ]/g, c => c===c.toUpperCase()?'U':'u')
    .replace(/\s+/g, ' ').trim().slice(0,120);
}
function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (_) {}
  }
}
function broadcast(room, obj) {
  const data = JSON.stringify(obj);
  for (const p of room.players) {
    if (p.ws && p.ws.readyState === p.ws.OPEN) {
      try { p.ws.send(data); } catch (_) {}
    }
  }
}
// Los estados son reemplazables: si un cliente esta momentaneamente atrasado,
// saltamos snapshots antiguos en vez de llenar la cola TCP y crear segundos de lag.
function broadcastState(room, obj) {
  const data = JSON.stringify(obj);
  for (const p of room.players) {
    if (!p.ws || p.ws.readyState !== p.ws.OPEN) continue;
    if (Number(p.ws.bufferedAmount || 0) > MAX_STATE_BUFFER) continue;
    try { p.ws.send(data); } catch (_) {}
  }
}
function emitSound(room, kind) {
  room.soundSeq++;
  broadcast(room, { t:'sound', kind, seq:room.soundSeq });
}
function sendToPlayer(room,index,obj) {
  const p=room&&room.players.find(x=>x.index===index&&!x.cpu);
  if(!p||!p.ws)return false;
  send(p.ws,obj);return true;
}
function broadcastVoicePresence(room,from,type,extra={}) {
  for(const p of room.players){
    if(p.cpu||p.index===from||!p.ws)continue;
    send(p.ws,{t:type,from,...extra});
  }
}

class GameRoom {
  constructor(code, mode='online', difficulty='medio', isPublic=false) {
    this.code = code;
    this.mode = mode;
    this.difficulty = difficulty;
    this.isPublic = mode==='online' && !!isPublic;
    this.players = [];
    this.started = false;
    this.finished = false;
    this.winner = null;
    this.seq = 0;
    this.soundSeq = 0;
    this.chatSeq = 0;
    this.chatMessages = [];
    // Cosmetic events only. No forces, damage or timers are changed by FX.
    this.fxClock = 0;
    this.fxSeq = 0;
    this.fxEvents = [];
    this.fxLastHit = new Map();
    this.bullets = [];
    this.pickups = [];
    this.meteors = [];
    this.giant = null;
    this.asteroids = [];
    this.nextPickup = 1;
    this.firstShower = rand(30,40);
    this.showerLeft = 0;
    this.nextMeteor = 0;
    this.nextShower = 0;
    this.noDeathTime = 0;
    this.nextGiant = rand(50,80);
    this.controls = new Map();
    this.createdAt = Date.now();
    this.creatorIp = '';
    this.resetAsteroids();
  }

  resetAsteroids() {
    this.asteroids = ASTEROID_STARTS.map(([x,y,rot,type]) => {
      const d = dirFromRot(rot);
      return { id:uid(), x,y,rot,type, vx:d.x*80, vy:d.y*80, r:ASTEROID_RADIUS };
    });
  }

  addHuman(ws, name, isHost=false) {
    if (this.players.filter(p=>!p.cpu).length >= MAX_PLAYERS) return null;
    const used = new Set(this.players.map(p=>p.index));
    let index=0; while (used.has(index)) index++;
    const p = this.makePlayer(index, name, false);
    p.ws = ws; p.isHost = isHost; p.playerToken = newPlayerToken(); p.disconnectedAt = 0;
    this.placeAtSpawn(p);
    this.players.push(p);
    this.controls.set(index, { turn:0, thrust:false, fire:false });
    return p;
  }

  addCpu(name='CPU', difficulty='dificil') {
    const index = 1;
    const p = this.makePlayer(index, name, true);
    p.difficulty = difficulty;
    this.placeAtSpawn(p);
    this.players.push(p);
    this.controls.set(index, { turn:0, thrust:false, fire:false });
    return p;
  }

  makePlayer(index, name, cpu) {
    return {
      index, name:safeName(name, cpu?'CPU':`JUGADOR ${index+1}`), cpu,
      ws:null, isHost:false, x:0,y:0,rot:0,vx:0,vy:0,
      bullets:1, cadence:30, speed:1, kills:0, deaths:0,
      reload:0, shield:0, camo:0, protection:SPAWN_PROTECTION_SECONDS,
      dead:false, respawn:0, fireLatch:false, voiceReady:false, lastChatAt:0, lastControlAt:Date.now(),
      playerToken:'', disconnectedAt:0
    };
  }

  canStart() {
    if (this.mode === 'cpu') return this.players.length === 2;
    return this.players.filter(p=>!p.cpu).length >= 2;
  }

  start() {
    if (!this.canStart()) return false;
    this.started = true; this.finished = false; this.winner = null;
    broadcast(this, { t:'start', code:this.code });
    return true;
  }


  restart() {
    if (!this.finished || !this.canStart()) return false;

    this.started = false;
    this.finished = false;
    this.winner = null;
    this.seq = 0;
    this.fxClock = 0;
    this.fxSeq = 0;
    this.fxEvents = [];
    this.fxLastHit.clear();
    this.bullets = [];
    this.pickups = [];
    this.meteors = [];
    this.giant = null;
    this.nextPickup = 1;
    this.firstShower = rand(30,40);
    this.showerLeft = 0;
    this.nextMeteor = 0;
    this.nextShower = 0;
    this.noDeathTime = 0;
    this.nextGiant = rand(50,80);
    this.resetAsteroids();

    // Marcamos a todos temporalmente como muertos para que el primer spawn
    // no considere las posiciones antiguas de los demas jugadores.
    for (const p of this.players) p.dead = true;
    for (const p of this.players) {
      p.bullets = 1;
      p.cadence = 30;
      p.speed = 1;
      p.kills = 0;
      p.deaths = 0;
      p.reload = 0;
      p.shield = 0;
      p.camo = 0;
      p.protection = SPAWN_PROTECTION_SECONDS;
      p.respawn = 0;
      p.fireLatch = false;
      p.lastControlAt = Date.now();
      p.lastSpawn = null;
      this.controls.set(p.index, { turn:0, thrust:false, fire:false });
      this.placeAtSpawn(p);
      p.dead = false;
    }

    this.started = true;
    broadcast(this, { t:'restarted', code:this.code });
    return true;
  }

  emitShipImpact(player, source=null, destroyed=false) {
    if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
    if (player.dead && !destroyed) return;
    // A sustained contact produces brief sparks, not one burst per tick.
    if (!destroyed) {
      const last = this.fxLastHit.get(player.index);
      if (last !== undefined && this.fxClock - last < 0.18) return;
      this.fxLastHit.set(player.index, this.fxClock);
    }
    let x = player.x, y = player.y;
    if (!destroyed && source && Number.isFinite(source.x) && Number.isFinite(source.y)) {
      const n = normalize(source.x - x, source.y - y);
      x += n.x * SHIP_RADIUS;
      y += n.y * SHIP_RADIUS;
    }
    this.fxEvents.push({
      id: ++this.fxSeq, i: player.index,
      x: +x.toFixed(1), y: +y.toFixed(1),
      kind: destroyed ? 'explosion' : 'hit',
      // A nonlethal contact must not expose a camouflaged ship to opponents.
      hidden: !destroyed && player.camo > 0,
      at: this.fxClock
    });
    if (this.fxEvents.length > 32) this.fxEvents.splice(0, this.fxEvents.length - 32);
  }

  destroyShip(victim, attacker=null) {
    if (victim.dead || this.finished) return;
    if (victim.protection>0 || victim.shield>0) {
      this.emitShipImpact(victim, attacker, false);
      return;
    }
    victim.dead = true;
    victim.respawn = 0.7;
    victim.vx = victim.vy = 0;
    victim.deaths++;
    // Castigo por estrellarse o morir contra un peligro del escenario:
    // pierde una baja conseguida, pero la puntuacion nunca baja de cero.
    // Si existe un atacante real, la muerte sigue contando de la forma normal.
    if (!attacker || attacker === victim) victim.kills = Math.max(0, victim.kills - 1);
    victim.bullets = 0;
    victim.cadence = 30;
    victim.speed = 1;
    victim.shield = 0;
    victim.camo = 0;
    victim.reload = 0;
    this.noDeathTime = 0;
    this.emitShipImpact(victim, null, true);
    emitSound(this,'impact');
    if (attacker && attacker !== victim) {
      attacker.kills++;
      if (attacker.kills >= SCORE_TO_WIN) {
        this.finished = true;
        this.winner = attacker.index;
        broadcast(this,{t:'victory', winner:this.winner});
      }
    }
  }

  placeAtSpawn(p) {
    const area = spawnArea(p.index);
    const obstacles = this.asteroids.map(a => ({ x:a.x, y:a.y, r:a.r }));
    for (const m of this.meteors) {
      obstacles.push({ x:m.x, y:m.y, r:SMALL_METEOR_RADIUS });
    }
    if (this.giant) {
      obstacles.push({ x:this.giant.x, y:this.giant.y, r:GIANT_RADIUS });
    }
    for (const other of this.players) {
      if (other.index !== p.index && !other.dead) {
        obstacles.push({ x:other.x, y:other.y, r:SHIP_RADIUS });
      }
    }

    // Bounded search: prefer a clear point, not the previous spawn position.
    // If the whole zone is obstructed, choose the least crowded candidate;
    // the three-second protection still lets the player move out safely.
    let best = null;
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = { x:rand(area.minX,area.maxX), y:rand(area.minY,area.maxY) };
      let clearance = Infinity;
      for (const o of obstacles) {
        clearance = Math.min(clearance,
          Math.hypot(candidate.x-o.x,candidate.y-o.y) - SHIP_RADIUS - o.r - 12);
      }
      const tooSimilar = p.lastSpawn && dist2(candidate,p.lastSpawn) < 28*28;
      const score = (clearance >= 0 ? 10000 : 0) + Math.min(1000,clearance) - (tooSimilar ? 1000 : 0);
      if (score > bestScore) { best=candidate; bestScore=score; }
      if (clearance >= 0 && !tooSimilar) { best=candidate; break; }
    }
    p.x=best.x; p.y=best.y; p.rot=area.rot; p.vx=0; p.vy=0;
    p.lastSpawn={ x:p.x, y:p.y };
  }

  respawnPlayer(p) {
    this.placeAtSpawn(p);
    p.dead=false; p.respawn=0;
    p.protection=SPAWN_PROTECTION_SECONDS;
    p.bullets=0; p.cadence=30; p.speed=1;
    p.shield=0; p.camo=0; p.reload=0;
  }

  chooseCpuControls(cpu) {
    let rival=null;
    for(const p of this.players){if(!p.cpu&&!p.dead){rival=p;break;}}
    if (!rival || cpu.dead) return IDLE_CONTROL;

    const dx=rival.x-cpu.x, dy=rival.y-cpu.y;
    const distance=Math.hypot(dx,dy);
    const targetRot=(Math.atan2(-dx,-dy)*180/Math.PI+360)%360;
    let err=((targetRot-cpu.rot+540)%360)-180;
    let desiredX=rival.x, desiredY=rival.y;
    let seekPickup=null;

    const dangerousCamo = rival.shield>0;
    const difficultNoAmmo = cpu.difficulty==='dificil' && cpu.bullets===0;

    // En DIFICIL, quedarse sin balas cambia por completo la prioridad:
    // 1) buscar la municion mas cercana; 2) mantenerse lejos del rival.
    // No persigue otras mejoras hasta volver a estar armado.
    if (difficultNoAmmo) {
      let bestD2=Infinity;
      for(const pk of this.pickups){
        if(!pk.type.startsWith('ammo'))continue;
        const d2=dist2(cpu,pk);
        if(d2<bestD2){bestD2=d2;seekPickup=pk;}
      }
      if (seekPickup) {
        desiredX=seekPickup.x;
        desiredY=seekPickup.y;
        // Si el rival esta cerca, sesga la ruta hacia el lado contrario sin
        // dejar de tener la municion como objetivo principal.
        if(distance<700){
          const inv=1/(distance||1);
          const flee=(700-distance)*0.75;
          desiredX+=(cpu.x-rival.x)*inv*flee;
          desiredY+=(cpu.y-rival.y)*inv*flee;
        }
      } else {
        // Si no hay municion flotando, huye hasta que aparezca alguna.
        desiredX=cpu.x-dx*2;
        desiredY=cpu.y-dy*2;
      }
    } else if (dangerousCamo) {
      let bestD2=Infinity;
      for(const pk of this.pickups){
        if(pk.type!=='shield'&&!pk.type.startsWith('ammo'))continue;
        const d2=dist2(cpu,pk);
        if(d2<bestD2){bestD2=d2;seekPickup=pk;}
      }
      if (!seekPickup) { desiredX=cpu.x-dx; desiredY=cpu.y-dy; }
    } else if (cpu.difficulty==='dificil') {
      const excellentShot = Math.abs(err) < 5 && distance < 850;
      const closeFight = cpu.bullets>0 && distance < 500;
      if (!excellentShot && !closeFight) {
        let bestScore=10;
        for(const pk of this.pickups){
          let value=0;
          if (pk.type.startsWith('ammo')) value = cpu.bullets===0?120:(cpu.bullets<=2?85:25);
          else if (pk.type==='cadence') value = cpu.cadence>=20?100:35;
          else if (pk.type==='speed') value = cpu.speed<2?55:10;
          else if (pk.type==='shield') value = cpu.shield<=0?95:20;
          const score=value-Math.sqrt(dist2(cpu,pk))*0.06;
          if(score>bestScore){bestScore=score;seekPickup=pk;}
        }
      }
    } else if (cpu.bullets===0) {
      let bestD2=Infinity;
      for(const pk of this.pickups){
        if(!pk.type.startsWith('ammo'))continue;
        const d2=dist2(cpu,pk);
        if(d2<bestD2){bestD2=d2;seekPickup=pk;}
      }
    }

    if (seekPickup) { desiredX=seekPickup.x; desiredY=seekPickup.y; }
    const ddx=desiredX-cpu.x, ddy=desiredY-cpu.y;
    const dRot=(Math.atan2(-ddx,-ddy)*180/Math.PI+360)%360;
    err=((dRot-cpu.rot+540)%360)-180;

    // Evasion sin construir arrays ni closures temporales en cada tick.
    let avoidX=0, avoidY=0;
    for(const h of this.asteroids){
      const hx=cpu.x-h.x,hy=cpu.y-h.y,d=Math.hypot(hx,hy),safe=(h.r||ASTEROID_RADIUS)+90;
      if(d<safe&&d>1){avoidX+=hx/d*(safe-d);avoidY+=hy/d*(safe-d);}
    }
    for(const h of this.meteors){
      const hx=cpu.x-h.x,hy=cpu.y-h.y,d=Math.hypot(hx,hy),safe=(h.r||30)+90;
      if(d<safe&&d>1){avoidX+=hx/d*(safe-d);avoidY+=hy/d*(safe-d);}
    }
    if(this.giant){
      const h=this.giant,hx=cpu.x-h.x,hy=cpu.y-h.y,d=Math.hypot(hx,hy),safe=(h.r||GIANT_RADIUS)+90;
      if(d<safe&&d>1){avoidX+=hx/d*(safe-d);avoidY+=hy/d*(safe-d);}
    }
    const avoidMag=Math.hypot(avoidX,avoidY);
    if(avoidMag>20){
      const ar=(Math.atan2(-avoidX,-avoidY)*180/Math.PI+360)%360;
      err=((ar-cpu.rot+540)%360)-180;
    }

    const turn=clamp(err/38,-1,1);
    const thrust=Math.abs(err)<60 && (seekPickup||distance>280||avoidMag>20);
    const fire=!dangerousCamo && !seekPickup && cpu.bullets>0 && cpu.reload<=0 && Math.abs(err)<6 && distance<1350;
    return {turn,thrust,fire};
  }

  update(dt) {
    if (!this.started || this.finished) return;
    this.noDeathTime += dt;
    this.fxClock += dt;
    let fxWrite=0;
    for(const e of this.fxEvents)if(this.fxClock-e.at<=0.8)this.fxEvents[fxWrite++]=e;
    this.fxEvents.length=fxWrite;

    for (const p of this.players) {
      // Avoid a floating-point remainder prolonging immunity by one tick.
      p.protection=p.protection-dt>1e-9 ? p.protection-dt : 0;
      p.shield=Math.max(0,p.shield-dt);
      p.camo=Math.max(0,p.camo-dt);
      p.reload=Math.max(0,p.reload-dt);
      if (p.dead) {
        p.respawn -= dt;
        if (p.respawn<=0) this.respawnPlayer(p);
        continue;
      }
      const storedControl=this.controls.get(p.index)||IDLE_CONTROL;
      const c=p.cpu ? this.chooseCpuControls(p) : ((Date.now()-(p.lastControlAt||0)<=300) ? storedControl : IDLE_CONTROL);
      p.rot=(p.rot+c.turn*240*dt+360)%360;
      const d=dirFromRot(p.rot);
      if(c.thrust){ p.vx+=d.x*(240*p.speed)*dt; p.vy+=d.y*(240*p.speed)*dt; }
      p.vx*=DRAG_PER_TICK; p.vy*=DRAG_PER_TICK;
      const vmax=330*p.speed; const sp=Math.hypot(p.vx,p.vy); if(sp>vmax){p.vx=p.vx/sp*vmax;p.vy=p.vy/sp*vmax;}
      p.x=(p.x+p.vx*dt+W)%W; p.y=(p.y+p.vy*dt+H)%H;
      if(c.fire && p.bullets>0 && p.reload<=0){
        this.bullets.push({id:uid(),owner:p.index,x:p.x+d.x*35,y:p.y+d.y*35,vx:d.x*this.bulletSpeed(p),vy:d.y*this.bulletSpeed(p),age:0});
        p.bullets--; p.reload=Math.max(0.125,p.cadence/8); emitSound(this,'laser');
      }
    }

    this.updateAsteroids(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateShower(dt);
    this.updateMeteors(dt);
    this.updateGiant(dt);
    this.shipCollisions();
  }

  bulletSpeed(p){ return p.cadence>=30?500:p.cadence>=20?960:p.cadence>=10?1150:1250; }

  updateAsteroids(dt){
    for(const a of this.asteroids){
      a.x+=a.vx*dt;a.y+=a.vy*dt;
      if(a.x<-190&&a.vx<0)a.vx*=-1; else if(a.x>W+190&&a.vx>0)a.vx*=-1;
      if(a.y<-190&&a.vy<0)a.vy*=-1; else if(a.y>H+190&&a.vy>0)a.vy*=-1;
    }
    for(let i=0;i<this.asteroids.length;i++)for(let j=i+1;j<this.asteroids.length;j++){
      const a=this.asteroids[i],b=this.asteroids[j];
      if(circles(a,a.r,b,b.r)){
        const n=normalize(b.x-a.x,b.y-a.y); const rel=(a.vx-b.vx)*n.x+(a.vy-b.vy)*n.y;
        if(rel>0){ const an=a.vx*n.x+a.vy*n.y,bn=b.vx*n.x+b.vy*n.y; a.vx+=(bn-an)*n.x;a.vy+=(bn-an)*n.y;b.vx+=(an-bn)*n.x;b.vy+=(an-bn)*n.y; }
        a.x-=n.x*2;b.x+=n.x*2;a.y-=n.y*2;b.y+=n.y*2;
      }
    }
    // Los asteroides grandes destruyen cualquier elemento flotante que atraviesen.
    // El asteroide permanece; solo desaparece la municion o mejora alcanzada.
    for(let i=this.pickups.length-1;i>=0;i--){
      const pk=this.pickups[i];
      for(const a of this.asteroids){
        if(circles(a,a.r,pk,PICKUP_RADIUS)){
          this.pickups.splice(i,1);
          break;
        }
      }
    }
  }

  updateBullets(dt){
    for(const b of this.bullets) { b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt; }
    for(let i=this.bullets.length-1;i>=0;i--){
      const b=this.bullets[i]; let remove=b.age>3||b.x<-20||b.y<-20||b.x>W+20||b.y>H+20;
      if(!remove){
        for(const p of this.players){
          if(p.index===b.owner||p.dead||p.protection>0)continue;
          if(circles(b,BULLET_RADIUS,p,SHIP_RADIUS)){
            if(p.shield<=0) this.destroyShip(p,this.players.find(q=>q.index===b.owner)||null);
            else this.emitShipImpact(p,b,false);
            remove=true;break;
          }
        }
      }
      if(!remove){for(const a of this.asteroids){if(circles(b,BULLET_RADIUS,a,a.r)){remove=true;break;}}}
      if(!remove&&this.giant&&circles(b,BULLET_RADIUS,this.giant,GIANT_RADIUS)){remove=true;emitSound(this,'impact');}
      if(!remove){
        for(let m=this.meteors.length-1;m>=0;m--){if(circles(b,BULLET_RADIUS,this.meteors[m],SMALL_METEOR_RADIUS)){this.meteors.splice(m,1);remove=true;emitSound(this,'impact');break;}}
      }
      if(!remove){
        for(let p=this.pickups.length-1;p>=0;p--){if(circles(b,BULLET_RADIUS,this.pickups[p],PICKUP_RADIUS)){this.pickups.splice(p,1);remove=true;break;}}
      }
      if(remove)this.bullets.splice(i,1);
    }
  }

  updatePickups(dt){
    this.nextPickup-=dt;
    if(this.nextPickup<=0){
      const roll=randint(1,28); let type;
      if(roll<=7)type='ammo3'; else if(roll<=16)type='ammo1'; else if(roll<=19)type='cadence'; else if(roll<=22)type='speed'; else if(roll<=25)type='shield'; else type='camo';
      // camuflaje solo online
      if(this.mode!=='online'&&type==='camo')type='shield';
      this.pickups.push({id:uid(),type,x:rand(100,W-100),y:rand(100,H-100),phase:rand(0,Math.PI*2)});
      if(this.pickups.length>5)this.pickups.shift();
      this.nextPickup=rand(2,5);
    }
    for(const pk of this.pickups)pk.phase+=dt*3;
    for(let i=this.pickups.length-1;i>=0;i--){
      const pk=this.pickups[i];
      let taken=false;
      for(const p of this.players){
        if(p.dead)continue;
        if(circles(pk,PICKUP_RADIUS,p,SHIP_RADIUS)){
          if(pk.type==='ammo3')p.bullets+=3; else if(pk.type==='ammo1')p.bullets+=1;
          else if(pk.type==='cadence')p.cadence=Math.max(1,p.cadence-10);
          else if(pk.type==='speed')p.speed=Math.min(2,p.speed+0.5);
          else if(pk.type==='shield')p.shield=10;
          else if(pk.type==='camo')p.camo=10;
          emitSound(this,'pickup'); taken=true; break;
        }
      }
      if(taken)this.pickups.splice(i,1);
    }
  }

  updateShower(dt){
    if(this.showerLeft<=0){
      this.firstShower-=dt;
      if(this.firstShower<=0){this.showerLeft=7;this.nextMeteor=0;this.firstShower=999999;}
      else if(this.nextShower>0){this.nextShower-=dt;if(this.nextShower<=0){this.showerLeft=7;this.nextMeteor=0;}}
    }
    if(this.showerLeft>0){
      this.showerLeft=Math.max(0,this.showerLeft-dt);this.nextMeteor-=dt;
      while(this.nextMeteor<=0&&this.showerLeft>0){
        const left=Math.random()<0.5; const vx=(left?1:-1)*rand(110,220),vy=rand(-55,55);
        this.meteors.push({id:uid(),type:randint(1,3),x:left?-40:W+40,y:rand(40,H-40),vx,vy,angle:rand(0,360)});
        this.nextMeteor+=rand(0.28,0.42);
      }
      if(this.showerLeft<=0)this.nextShower=rand(45,60);
    }
  }

  updateMeteors(dt){
    for(let i=this.meteors.length-1;i>=0;i--){
      const m=this.meteors[i];m.x+=m.vx*dt;m.y+=m.vy*dt;m.angle=(m.angle+120*dt)%360;
      for(const a of this.asteroids){if(circles(m,SMALL_METEOR_RADIUS,a,a.r)){const n=normalize(m.x-a.x,m.y-a.y);const dot=m.vx*n.x+m.vy*n.y;if(dot<0){m.vx-=2*dot*n.x;m.vy-=2*dot*n.y;}m.x+=n.x*4;m.y+=n.y*4;}}
      // La lluvia rebota contra el meteorito gigante en vez de atravesarlo.
      // Se refleja la velocidad relativa para que el rebote siga siendo estable
      // aunque el gigante este moviendose lentamente.
      if(this.giant&&circles(m,SMALL_METEOR_RADIUS,this.giant,GIANT_RADIUS)){
        const g=this.giant;
        const n=normalize(m.x-g.x,m.y-g.y);
        const rvx=m.vx-g.vx,rvy=m.vy-g.vy;
        const dot=rvx*n.x+rvy*n.y;
        if(dot<0){
          m.vx=g.vx+(rvx-2*dot*n.x);
          m.vy=g.vy+(rvy-2*dot*n.y);
        }
        const dx=m.x-g.x,dy=m.y-g.y;
        const dist=Math.hypot(dx,dy)||1;
        const overlap=SMALL_METEOR_RADIUS+GIANT_RADIUS-dist;
        if(overlap>0){m.x+=n.x*(overlap+2);m.y+=n.y*(overlap+2);}
      }
      // Los meteoritos barren los elementos flotantes que atraviesan.
      // El meteorito continua su trayectoria; solo desaparece la mejora/municion.
      for(let k=this.pickups.length-1;k>=0;k--){
        if(circles(m,SMALL_METEOR_RADIUS,this.pickups[k],PICKUP_RADIUS))this.pickups.splice(k,1);
      }
      let removed=false;
      for(const p of this.players){if(!p.dead&&circles(m,SMALL_METEOR_RADIUS,p,SHIP_RADIUS)){if(p.shield>0){this.emitShipImpact(p,m,false);const n=normalize(m.x-p.x,m.y-p.y);const dot=m.vx*n.x+m.vy*n.y;m.vx-=2*dot*n.x;m.vy-=2*dot*n.y;}else{this.destroyShip(p,null);this.meteors.splice(i,1);removed=true;}break;}}
      if(removed)continue;
      if(m.x<-100||m.x>W+100||m.y<-100||m.y>H+100)this.meteors.splice(i,1);
    }
  }

  updateGiant(dt){
    if(!this.giant){
      this.nextGiant-=dt;
      if(this.nextGiant<=0){
        const side=randint(0,3),speed=rand(42,52); let x,y,tx,ty;
        if(side===0){x=-180;y=rand(160,H-160);tx=W+180;ty=clamp(y+rand(-220,220),160,H-160);}
        else if(side===1){x=W+180;y=rand(160,H-160);tx=-180;ty=clamp(y+rand(-220,220),160,H-160);}
        else if(side===2){x=rand(180,W-180);y=-180;tx=clamp(x+rand(-300,300),180,W-180);ty=H+180;}
        else{x=rand(180,W-180);y=H+180;tx=clamp(x+rand(-300,300),180,W-180);ty=-180;}
        const n=normalize(tx-x,ty-y);this.giant={id:uid(),x,y,vx:n.x*speed,vy:n.y*speed,r:GIANT_RADIUS,entered:false};
      }
      return;
    }
    const g=this.giant;g.x+=g.vx*dt;g.y+=g.vy*dt;if(g.x>-GIANT_RADIUS&&g.x<W+GIANT_RADIUS&&g.y>-GIANT_RADIUS&&g.y<H+GIANT_RADIUS)g.entered=true;
    for(const p of this.players){if(!p.dead&&circles(g,GIANT_RADIUS,p,SHIP_RADIUS)){if(p.shield>0||p.protection>0){this.emitShipImpact(p,g,false);const n=normalize(p.x-g.x,p.y-g.y);p.vx=n.x*130;p.vy=n.y*130;p.x+=n.x*8;p.y+=n.y*8;}else this.destroyShip(p,null);}}
    for(const a of this.asteroids){if(circles(g,GIANT_RADIUS,a,a.r)){const n=normalize(a.x-g.x,a.y-g.y);a.vx+=n.x*25;a.vy+=n.y*25;a.x+=n.x*5;a.y+=n.y*5;}}
    for(let i=this.pickups.length-1;i>=0;i--)if(circles(g,GIANT_RADIUS,this.pickups[i],PICKUP_RADIUS))this.pickups.splice(i,1);
    if(g.entered&&(g.x<-350||g.x>W+350||g.y<-350||g.y>H+350)){this.giant=null;this.nextGiant=rand(130,190);}
  }

  shipCollisions(){
    for(const p of this.players){
      if(p.dead)continue;
      for(const a of this.asteroids){if(circles(p,SHIP_RADIUS,a,a.r)){if(p.shield>0){this.emitShipImpact(p,a,false);const n=normalize(p.x-a.x,p.y-a.y);const dot=p.vx*n.x+p.vy*n.y;if(dot<0){p.vx-=1.85*dot*n.x;p.vy-=1.85*dot*n.y;}p.x+=n.x*5;p.y+=n.y*5;}else this.destroyShip(p,null);}}
    }
    for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
      const a=this.players[i],b=this.players[j];if(a.dead||b.dead||!circles(a,SHIP_RADIUS,b,SHIP_RADIUS))continue;
      if(a.shield>0 || a.protection>0)this.emitShipImpact(a,b,false);
      if(b.shield>0 || b.protection>0)this.emitShipImpact(b,a,false);
      if(a.shield>0&&b.shield<=0)this.destroyShip(b,a); else if(b.shield>0&&a.shield<=0)this.destroyShip(a,b); else if(a.shield<=0&&b.shield<=0){this.destroyShip(a,null);this.destroyShip(b,null);} else {const n=normalize(a.x-b.x,a.y-b.y);a.vx=n.x*120;a.vy=n.y*120;b.vx=-n.x*120;b.vy=-n.y*120;}
    }
  }

  publicState() {
    return {
      t:'state',seq:++this.seq,code:this.code,mode:this.mode,started:this.started,finished:this.finished,winner:this.winner,
      w:W,h:H,scoreToWin:SCORE_TO_WIN,
      fxVersion:1,
      fx:this.fxEvents.map(e=>({
        id:e.id,i:e.i,x:e.x,y:e.y,kind:e.kind,hidden:e.hidden,
        age:Math.max(0,Math.round((this.fxClock-e.at)*1000))
      })),
      players:this.players.map(p=>({i:p.index,n:p.name,cpu:p.cpu,x:+p.x.toFixed(1),y:+p.y.toFixed(1),r:+p.rot.toFixed(1),vx:+p.vx.toFixed(1),vy:+p.vy.toFixed(1),ammo:p.bullets,armed:!p.dead&&p.bullets>0&&p.reload<=0,cad:p.cadence,spd:p.speed,k:p.kills,d:p.deaths,shield:+p.shield.toFixed(2),camo:+p.camo.toFixed(2),prot:+p.protection.toFixed(2),dead:p.dead,respawn:+p.respawn.toFixed(3)})),
      asteroids:this.asteroids.map(a=>({id:a.id,x:+a.x.toFixed(1),y:+a.y.toFixed(1),type:a.type})),
      bullets:this.bullets.map(b=>({id:b.id,o:b.owner,x:+b.x.toFixed(1),y:+b.y.toFixed(1),vx:+b.vx.toFixed(1),vy:+b.vy.toFixed(1)})),
      pickups:this.pickups.map(p=>({id:p.id,type:p.type,x:+p.x.toFixed(1),y:+(p.y+Math.cos(p.phase)*3).toFixed(1)})),
      meteors:this.meteors.map(m=>({id:m.id,type:m.type,x:+m.x.toFixed(1),y:+m.y.toFixed(1),a:+m.angle.toFixed(1)})),
      giant:this.giant?{x:+this.giant.x.toFixed(1),y:+this.giant.y.toFixed(1)}:null,
      shower:+this.showerLeft.toFixed(2),nextShower:this.showerLeft>0?0:+Math.max(0,Math.min(this.firstShower,this.nextShower||999999)).toFixed(1)
    };
  }
}

function publicRoomsSnapshot() {
  const list=[];
  for(const room of rooms.values()){
    if(!room.isPublic||room.mode!=='online'||room.started||room.finished)continue;
    const humans=room.players.filter(p=>!p.cpu);
    if(!humans.length||humans.length>=MAX_PLAYERS)continue;
    const host=humans.find(p=>p.isHost)||humans[0];
    list.push({code:room.code,host:host?host.name:'JUGADOR',players:humans.length,maxPlayers:MAX_PLAYERS,createdAt:room.createdAt});
  }
  list.sort((a,b)=>b.players-a.players||a.createdAt-b.createdAt);
  return list.map(({createdAt,...room})=>room);
}
function sendPublicRooms(ws){send(ws,{t:'public-rooms',rooms:publicRoomsSnapshot()});}
function broadcastPublicRooms(){
  if(!wss)return;
  const data=JSON.stringify({t:'public-rooms',rooms:publicRoomsSnapshot()});
  for(const client of wss.clients){
    if(client.readyState===client.OPEN){try{client.send(data);}catch(_){}}
  }
}

function removePlayer(ws) {
  const info=clientInfo.get(ws); if(!info)return;
  const room=rooms.get(info.code); if(!room)return;
  const p=room.players.find(x=>x.index===info.index&&x.ws===ws); if(!p)return;
  if(p.voiceReady)broadcastVoicePresence(room,p.index,'voice-left');
  room.players=room.players.filter(x=>x!==p);room.controls.delete(p.index);
  clientInfo.delete(ws);
  if(p.isHost){broadcast(room,{t:'closed',reason:'El anfitrión cerró la sala.'});deleteRoom(room.code);}
  else broadcast(room,{t:'lobby',code:room.code,players:room.players.map(x=>({i:x.index,n:x.name,cpu:x.cpu})),canStart:room.canStart()});
  broadcastPublicRooms();
}

function disconnectPlayer(ws) {
  const info=clientInfo.get(ws); if(!info)return;
  const room=rooms.get(info.code); if(!room){clientInfo.delete(ws);return;}
  const p=room.players.find(x=>x.index===info.index&&x.ws===ws); if(!p){clientInfo.delete(ws);return;}
  // En el lobby mantenemos el comportamiento clasico. La reserva temporal se
  // usa solo cuando la partida ya ha empezado (o acaba de terminar).
  if(!room.started&&!room.finished){removePlayer(ws);return;}
  if(p.voiceReady)broadcastVoicePresence(room,p.index,'voice-left');
  p.voiceReady=false;
  p.ws=null;
  p.disconnectedAt=Date.now();
  p.lastControlAt=0;
  room.controls.set(p.index,IDLE_CONTROL);
  clientInfo.delete(ws);
}

function expireDisconnectedPlayers() {
  const now=Date.now();
  for(const room of [...rooms.values()]){
    const expired=room.players.filter(p=>!p.cpu&&!p.ws&&p.disconnectedAt&&now-p.disconnectedAt>=RECONNECT_GRACE_MS);
    if(!expired.length)continue;
    let roomDeleted=false;
    for(const p of expired){
      room.players=room.players.filter(x=>x!==p);
      room.controls.delete(p.index);
      if(p.isHost){
        broadcast(room,{t:'closed',reason:'El anfitrión perdió la conexión.'});
        deleteRoom(room.code);
        roomDeleted=true;
        break;
      }
    }
    if(!roomDeleted&&room.players.filter(p=>!p.cpu).length===0)deleteRoom(room.code);
  }
}

const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','no-store');
  const url=(req.url||'/').split('?')[0];
  if(url==='/health'){
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify({ok:true,service:'Galaxy Combat WebSocket'}));
    return;
  }
  res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});
  res.end('Galaxy Combat WebSocket server online.\n');
});

const wss=new WebSocketServer({server,path:'/ws',perMessageDeflate:false});
wss.on('connection',(ws,req)=>{
  const clientIp=clientIpFromRequest(req);
  send(ws,{t:'hello'});
  sendPublicRooms(ws);
  ws.on('message',raw=>{
    let msg;try{msg=JSON.parse(String(raw));}catch(_){return;}
    if(msg.t==='create'){
      releaseAbandonedRoomForIp(clientIp);
      if(activeRoomForIp(clientIp)){send(ws,{t:'error',message:'YA TIENES UNA SALA ACTIVA.'});return;}
      const code=roomCode();const room=new GameRoom(code,'online','medio',!!msg.public);rooms.set(code,room);registerRoomCreator(room,clientIp);const p=room.addHuman(ws,msg.name,true);clientInfo.set(ws,{code,index:p.index});send(ws,{t:'created',code,index:p.index,public:room.isPublic,playerToken:p.playerToken});send(ws,{t:'chat-history',messages:room.chatMessages});broadcast(room,{t:'lobby',code,players:room.players.map(x=>({i:x.index,n:x.name,cpu:x.cpu})),canStart:room.canStart()});broadcastPublicRooms();
    } else if(msg.t==='cpu'){
      releaseAbandonedRoomForIp(clientIp);
      if(activeRoomForIp(clientIp)){send(ws,{t:'error',message:'YA TIENES UNA SALA ACTIVA.'});return;}
      const code=roomCode();const room=new GameRoom(code,'cpu',String(msg.difficulty||'dificil'));rooms.set(code,room);registerRoomCreator(room,clientIp);const p=room.addHuman(ws,msg.name,true);room.addCpu('CPU',room.difficulty);clientInfo.set(ws,{code,index:p.index});send(ws,{t:'created',code,index:p.index,cpu:true,playerToken:p.playerToken});room.start();
    } else if(msg.t==='join'){
      const code=String(msg.code||'').trim().toUpperCase();const room=rooms.get(code);if(!room||room.started||room.mode!=='online'){send(ws,{t:'error',message:'Sala no disponible.'});return;}const p=room.addHuman(ws,msg.name,false);if(!p){send(ws,{t:'error',message:'Sala llena.'});return;}clientInfo.set(ws,{code,index:p.index});send(ws,{t:'joined',code,index:p.index,public:room.isPublic,playerToken:p.playerToken});send(ws,{t:'chat-history',messages:room.chatMessages});broadcast(room,{t:'lobby',code,players:room.players.map(x=>({i:x.index,n:x.name,cpu:x.cpu})),canStart:room.canStart()});broadcastPublicRooms();
    } else if(msg.t==='resume'){
      const code=String(msg.code||'').trim().toUpperCase();
      const token=String(msg.token||'').trim();
      const room=rooms.get(code);
      const p=room&&room.players.find(x=>!x.cpu&&x.playerToken===token);
      if(!room||!p||!/^[a-f0-9]{48}$/i.test(token)||!room.started){send(ws,{t:'resume-failed',message:'La partida ya no se puede recuperar.'});return;}
      if(p.disconnectedAt&&Date.now()-p.disconnectedAt>=RECONNECT_GRACE_MS){send(ws,{t:'resume-failed',message:'Ha pasado el tiempo de reconexión.'});return;}
      const oldWs=p.ws;
      if(oldWs&&oldWs!==ws){
        clientInfo.delete(oldWs);
        try{oldWs.close(4001,'Sesion recuperada desde otra conexion');}catch(_){}
      }
      p.ws=ws;p.disconnectedAt=0;p.lastControlAt=Date.now();p.voiceReady=false;room.controls.set(p.index,IDLE_CONTROL);
      clientInfo.set(ws,{code,index:p.index});
      send(ws,{t:'resumed',code,index:p.index,cpu:room.mode==='cpu',host:!!p.isHost,started:room.started,finished:room.finished,playerToken:p.playerToken});
      send(ws,room.publicState());
      if(room.finished)send(ws,{t:'victory',winner:room.winner});
    } else if(msg.t==='start'){
      const info=clientInfo.get(ws);const room=info&&rooms.get(info.code);const p=room&&room.players.find(x=>x.ws===ws);if(room&&p&&p.isHost&&room.start())broadcastPublicRooms();
    } else if(msg.t==='restart'){
      const info=clientInfo.get(ws);const room=info&&rooms.get(info.code);const p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);
      if(room&&p&&!p.cpu&&room.finished&&room.restart())broadcastPublicRooms();
    } else if(msg.t==='public-rooms'){
      sendPublicRooms(ws);
    } else if(msg.t==='chat'){
      const info=clientInfo.get(ws);const room=info&&rooms.get(info.code);const p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);
      if(!room||!p||p.cpu||room.mode!=='online'||room.started||room.finished)return;
      const now=Date.now();if(now-(p.lastChatAt||0)<600)return;
      const text=safeChatText(msg.text);if(!text)return;p.lastChatAt=now;
      const chat={t:'chat',id:++room.chatSeq,i:p.index,n:p.name,text};
      room.chatMessages.push({id:chat.id,i:chat.i,n:chat.n,text:chat.text});
      if(room.chatMessages.length>24)room.chatMessages.splice(0,room.chatMessages.length-24);
      broadcast(room,chat);
    } else if(msg.t==='ctrl'){
      const info=clientInfo.get(ws);const room=info&&rooms.get(info.code);if(!room||!room.started)return;const p=room.players.find(x=>x.index===info.index&&x.ws===ws);if(!p||p.cpu)return;p.lastControlAt=Date.now();room.controls.set(info.index,{turn:clamp(Number(msg.turn)||0,-1,1),thrust:!!msg.thrust,fire:!!msg.fire});
    } else if(msg.t==='voice-ready'){
      const info=clientInfo.get(ws);const room=info&&rooms.get(info.code);const p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p||p.cpu)return;
      p.voiceReady=true;
      send(ws,{t:'voice-peers',peers:room.players.filter(x=>!x.cpu&&x.index!==p.index&&x.voiceReady).map(x=>x.index)});
      broadcastVoicePresence(room,p.index,'voice-ready');
    } else if(msg.t==='voice-offline'){
      const info=clientInfo.get(ws);const room=info&&rooms.get(info.code);const p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p)return;
      p.voiceReady=false;broadcastVoicePresence(room,p.index,'voice-offline');
    } else if(msg.t==='voice-offer'||msg.t==='voice-answer'||msg.t==='voice-ice'){
      const info=clientInfo.get(ws);const room=info&&rooms.get(info.code);const p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p||p.cpu||!p.voiceReady)return;
      const to=Number(msg.to);if(!Number.isInteger(to)||to===p.index)return;
      const target=room.players.find(x=>x.index===to&&!x.cpu&&x.voiceReady);if(!target)return;
      sendToPlayer(room,to,{t:msg.t,from:p.index,data:msg.data});
    } else if(msg.t==='voice-talking'){
      const info=clientInfo.get(ws);const room=info&&rooms.get(info.code);const p=room&&room.players.find(x=>x.index===info.index&&x.ws===ws);if(!room||!p||p.cpu||!p.voiceReady)return;
      broadcastVoicePresence(room,p.index,'voice-talking',{on:!!msg.on});
    } else if(msg.t==='leave'){removePlayer(ws);}
  });
  ws.on('close',()=>disconnectPlayer(ws));
});

let loopLast=performance.now(),loopAccumulator=0,simTick=0;
function gameLoop(){
  const now=performance.now();
  let elapsed=now-loopLast;loopLast=now;
  if(!Number.isFinite(elapsed)||elapsed<0)elapsed=STEP_MS;
  loopAccumulator+=Math.min(100,elapsed);

  let steps=0;
  while(loopAccumulator>=STEP_MS&&steps<5){
    for(const room of rooms.values())room.update(DT);
    loopAccumulator-=STEP_MS;
    simTick++;
    if(simTick%SNAP_EVERY_TICKS===0){
      for(const room of rooms.values())if(room.started)broadcastState(room,room.publicState());
    }
    steps++;
  }
  // Si el proceso se congela un instante, no intentamos reproducir cientos de
  // ticks atrasados: eso empeoraria el lag. Conservamos solo la fraccion util.
  if(steps===5&&loopAccumulator>=STEP_MS)loopAccumulator%=STEP_MS;
  const delay=Math.max(1,Math.min(STEP_MS,STEP_MS-loopAccumulator-.5));
  setTimeout(gameLoop,delay);
}
setTimeout(gameLoop,STEP_MS);
setInterval(expireDisconnectedPlayers,1000);
setInterval(()=>{const now=Date.now();let changed=false;for(const [code,room] of rooms){if(room.players.length===0||now-room.createdAt>12*60*60*1000){deleteRoom(code);changed=true;}}if(changed)broadcastPublicRooms();},30000);

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`Galaxy Combat WebSocket server online on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
