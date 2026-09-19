'use strict';
const MAX_PAYLOAD=32*1024;
const DEFAULT_ORIGINS=['https://jorgeslope73-debug.github.io'];
const configured=String(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
const allowedOrigins=new Set(configured.length?configured:DEFAULT_ORIGINS);
function isAllowedOrigin(origin){
  if(!origin)return process.env.NODE_ENV!=='production';
  try{const u=new URL(origin);if(u.hostname==='localhost'||u.hostname==='127.0.0.1')return true;return allowedOrigins.has(u.origin);}catch(_){return false;}
}
function clientIp(req){const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();return forwarded||req.socket?.remoteAddress||'unknown';}
function allowRate(holder,key,limit,windowMs){
  const now=Date.now();holder._galaxyRates=holder._galaxyRates||new Map();let r=holder._galaxyRates.get(key);
  if(!r||now-r.start>=windowMs){r={start:now,count:0};holder._galaxyRates.set(key,r);}r.count++;return r.count<=limit;
}
const ipCreateRates=new Map();
function allowIpCreate(ip,limit=8,windowMs=60000){const now=Date.now();let r=ipCreateRates.get(ip);if(!r||now-r.start>=windowMs){r={start:now,count:0};ipCreateRates.set(ip,r);}r.count++;return r.count<=limit;}
setInterval(()=>{const now=Date.now();for(const [ip,r] of ipCreateRates)if(now-r.start>120000)ipCreateRates.delete(ip);},60000).unref?.();
module.exports={MAX_PAYLOAD,isAllowedOrigin,clientIp,allowRate,allowIpCreate};
