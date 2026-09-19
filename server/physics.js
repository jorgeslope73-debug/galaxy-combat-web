'use strict';
const W=1920,H=1080;
const TICK_HZ=60,NET_HZ=30,DT=1/TICK_HZ,STEP_MS=1000/TICK_HZ;
const SNAP_EVERY_TICKS=Math.max(1,Math.round(TICK_HZ/NET_HZ));
const DRAG_PER_TICK=Math.pow(0.35,DT);
const SHIP_RADIUS=24,ASTEROID_RADIUS=45,GIANT_RADIUS=135,PICKUP_RADIUS=22,BULLET_RADIUS=4,SMALL_METEOR_RADIUS=14;
const ASTEROID_STARTS=[[160,430,300,1],[30,930,10,3],[1800,30,210,4],[1500,150,160,2],[500,430,160,5],[1300,430,200,6]];
let nextEntityId=1;
const uid=()=>nextEntityId++;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const randint=(a,b)=>Math.floor(rand(a,b+1));
const dist2=(a,b)=>{const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;};
const circles=(a,ar,b,br)=>{const rr=ar+br;return dist2(a,b)<=rr*rr;};
function dirFromRot(rot){const r=rot*Math.PI/180;return{x:-Math.sin(r),y:-Math.cos(r)};}
function normalize(x,y){const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}
function spawnArea(index){
  const left=index%2===0,top=index<2,panelX=left?10:W-216,panelY=top?5:H-190,centerX=panelX+64,gap=90,spreadY=100;
  const nearY=top?panelY+153+28+SHIP_RADIUS+gap:panelY-SHIP_RADIUS-gap;
  return{minX:Math.max(SHIP_RADIUS+12,centerX-28),maxX:Math.min(W-SHIP_RADIUS-12,centerX+28),minY:top?nearY:nearY-spreadY,maxY:top?nearY+spreadY:nearY,rot:left?270:90};
}
module.exports={W,H,TICK_HZ,NET_HZ,DT,STEP_MS,SNAP_EVERY_TICKS,DRAG_PER_TICK,SHIP_RADIUS,ASTEROID_RADIUS,GIANT_RADIUS,PICKUP_RADIUS,BULLET_RADIUS,SMALL_METEOR_RADIUS,ASTEROID_STARTS,uid,clamp,rand,randint,dist2,circles,dirFromRot,normalize,spawnArea};
