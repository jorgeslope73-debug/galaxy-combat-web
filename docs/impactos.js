/* Small, image-free impact bursts. Pure rendering: no changes to game physics. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GalaxyImpactFX = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const MAX_BURSTS = 32;
  const MAX_SEEN = 256;
  const durationFor = kind => kind === 'explosion' ? 420 : 260;
  const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

  class GalaxyImpactFX {
    constructor() { this.reset(); }

    reset() {
      this.bursts = [];
      this.seen = new Set();
      this.previousPlayers = new Map();
      this.room = '';
      this.lastSeq = -1;
    }

    remember(key) {
      if (this.seen.has(key)) return false;
      this.seen.add(key);
      while (this.seen.size > MAX_SEEN) this.seen.delete(this.seen.values().next().value);
      return true;
    }

    enqueue(event, key, localIndex, now) {
      if (!this.remember(key)) return;
      if (event.hidden && event.i !== localIndex) return;
      if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) return;
      if (Math.abs(event.x) > 10000 || Math.abs(event.y) > 10000) return;
      const kind = event.kind === 'explosion' ? 'explosion' : 'hit';
      const duration = durationFor(kind);
      const age = Number.isFinite(event.age) ? Math.max(0, event.age) : 0;
      if (age >= duration) return;
      let seed = 2166136261;
      for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619);
      const random = () => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
      };
      // Particle shapes are generated once, not randomly changed every frame.
      const count = kind === 'explosion' ? 12 : 7;
      const particles = [];
      for (let i = 0; i < count; i++) {
        const angle = TAU * (i + random() * 0.65) / count;
        particles.push({
          dx: Math.cos(angle), dy: Math.sin(angle),
          distance: kind === 'explosion' ? 16 + random() * 18 : 9 + random() * 12,
          size: 1.2 + random() * (kind === 'explosion' ? 2.1 : 1.0),
          hot: random() > 0.45
        });
      }
      this.bursts.push({ x: event.x, y: event.y, kind, duration,
        born: now - age, particles, key });
      if (this.bursts.length > MAX_BURSTS) this.bursts.splice(0, this.bursts.length - MAX_BURSTS);
    }

    consume(snapshot, localIndex, now = clock()) {
      if (!snapshot || !Array.isArray(snapshot.players) || !Number.isFinite(now)) return;
      if (typeof snapshot.code === 'string' && snapshot.code !== this.room) {
        this.reset(); this.room = snapshot.code;
      }
      if (Number.isFinite(snapshot.seq)) {
        // WebSocket preserves message order. A lower sequence therefore means
        // the room started a new match/epoch (restart() resets seq and fx ids).
        // Clear the dedup history immediately so new impacts are not mistaken
        // for old events from the previous match.
        if (snapshot.seq < this.lastSeq) {
          this.bursts = [];
          this.seen.clear();
          this.previousPlayers.clear();
          this.lastSeq = -1;
        }
        if (snapshot.seq === this.lastSeq) return;
        this.lastSeq = snapshot.seq;
      }
      const serverExplosions = new Set();
      if (snapshot.fxVersion === 1 && Array.isArray(snapshot.fx)) {
        for (const event of snapshot.fx.slice(-MAX_BURSTS)) {
          if (!event || !Number.isSafeInteger(event.id) || event.id < 1) continue;
          if (!Number.isInteger(event.i) || event.i < 0 || event.i > 3) continue;
          if (event.kind !== 'explosion' && event.kind !== 'hit') continue;
          // Record only still-visible explosion events. If one was lost/delayed,
          // the state transition fallback below will recreate the death burst.
          if (event.kind === 'explosion') {
            const age = Number.isFinite(event.age) ? Math.max(0, event.age) : 0;
            if (age < durationFor('explosion')) serverExplosions.add(event.i);
          }
          this.enqueue(event, 'fx:' + event.id, localIndex, now);
        }
      }

      // Robust death fallback: even with fxVersion=1, a transient WebSocket/state
      // hiccup must not make the ship vanish without exploding. If a player has
      // just changed from alive to dead and this snapshot carries no usable
      // explosion event for that player, create the same short burst locally.
      for (const player of snapshot.players) {
        if (!player || !Number.isInteger(player.i)) continue;
        const previous = this.previousPlayers.get(player.i);
        const deathCount = Number.isFinite(player.d) ? player.d : 0;
        const justDied = player.dead && (!previous || !previous.dead || previous.deaths < deathCount);
        if (justDied && !serverExplosions.has(player.i)) {
          const age = Number.isFinite(player.respawn) ? Math.max(0, (0.7 - player.respawn) * 1000) : 0;
          this.enqueue({i: player.i, x: player.x, y: player.y,
            kind: 'explosion', age}, 'death-fallback:' + (snapshot.code || '') + ':' + player.i + ':' + deathCount, localIndex, now);
        }
      }
      this.previousPlayers.clear();
      for (const player of snapshot.players) {
        if (player && Number.isInteger(player.i)) this.previousPlayers.set(player.i,
          {dead: !!player.dead, deaths: Number.isFinite(player.d) ? player.d : 0});
      }
    }

    draw(ctx, now = clock()) {
      if (!ctx || !Number.isFinite(now)) return;
      let write=0;
      for(const e of this.bursts)if(now-e.born<e.duration)this.bursts[write++]=e;
      this.bursts.length=write;
      if (!this.bursts.length) return;
      ctx.save();
      try {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const burst of this.bursts) {
          const t = Math.max(0, Math.min(1, (now - burst.born) / burst.duration));
          const fade = (1 - t) * (1 - t);
          const large = burst.kind === 'explosion';
          const eased = 1 - Math.pow(1 - t, 2);
          const radius = (large ? 9 : 5) + eased * (large ? 20 : 11);
          const glow = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, radius);
          glow.addColorStop(0, 'rgba(255,250,215,0.95)');
          glow.addColorStop(0.28, 'rgba(255,201,85,0.8)');
          glow.addColorStop(0.62, 'rgba(255,94,32,0.38)');
          glow.addColorStop(1, 'rgba(235,45,12,0)');
          ctx.globalAlpha = fade;
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(burst.x, burst.y, radius, 0, TAU); ctx.fill();

          ctx.lineWidth = large ? 1.8 : 1.2;
          ctx.strokeStyle = '#ffc56c'; ctx.globalAlpha = fade * 0.65;
          ctx.beginPath(); ctx.arc(burst.x, burst.y, (large ? 4 : 2) + eased * (large ? 26 : 15), 0, TAU); ctx.stroke();
          for (const p of burst.particles) {
            const distance = 3 + p.distance * eased;
            const x = burst.x + p.dx * distance, y = burst.y + p.dy * distance;
            ctx.globalAlpha = fade;
            ctx.strokeStyle = p.hot ? '#ffe6a1' : '#ff963f';
            ctx.lineWidth = p.size * (1 - t * 0.65);
            ctx.beginPath(); ctx.moveTo(x - p.dx * (large ? 5 : 3), y - p.dy * (large ? 5 : 3)); ctx.lineTo(x, y); ctx.stroke();
          }
          if (t < 0.24) {
            ctx.globalAlpha = (1 - t / 0.24) * 0.8;
            ctx.fillStyle = '#fff8e2'; ctx.beginPath();
            ctx.arc(burst.x, burst.y, (large ? 5 : 3) * (1 - t), 0, TAU); ctx.fill();
          }
        }
      } finally {
        ctx.restore();
      }
    }
  }
  return GalaxyImpactFX;
});
