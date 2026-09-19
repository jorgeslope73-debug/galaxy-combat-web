'use strict';
(() => {
  class GalaxyAudio {
    constructor({isMobile=false,menu=null}={}){
      this.isMobile=!!isMobile;
      this.menu=menu;
      this.musicStarted=false;
      this.gameVolume=this.isMobile?0.45:0.75;
      this.soundPools={};
      this.sounds={};
      const defs={
        laser:{url:'assets/sonido/laser_1.mp3',size:8,volume:.55},
        impact:{url:'assets/sonido/impacto1.mp3',size:5,volume:.75},
        pickup:{url:'assets/sonido/carga3.wav',size:3,volume:.75},
        start:{url:'assets/sonido/inicio.wav',size:1,volume:.75}
      };
      for(const [key,def] of Object.entries(defs)){
        const items=[];
        for(let i=0;i<def.size;i++){
          const a=new Audio(def.url);
          a.preload='auto';
          a.volume=def.volume*this.gameVolume;
          items.push(a);
        }
        this.soundPools[key]={items,next:0};
      }
      const music=new Audio('assets/sonido/musica.mp3');
      music.preload='auto';music.loop=true;music.volume=.35*this.gameVolume;
      this.sounds.music=music;
    }
    playSound(key){
      const pool=this.soundPools[key];
      if(!pool||!pool.items.length)return;
      const a=pool.items[pool.next++%pool.items.length];
      try{a.currentTime=0;const p=a.play();if(p&&p.catch)p.catch(()=>{});}catch(_){}
    }
    startMusic(){
      const music=this.sounds.music;
      if(!this.menu||this.menu.classList.contains('hidden')||!music||!music.paused)return;
      music.play().then(()=>{this.musicStarted=true;}).catch(()=>{this.musicStarted=false;});
    }
    stopMusic(){
      const music=this.sounds.music;if(!music)return;
      try{music.pause();music.currentTime=0;}catch(_){}
      this.musicStarted=false;
    }
  }
  window.GalaxyAudio=GalaxyAudio;
})();
