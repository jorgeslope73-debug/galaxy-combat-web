'use strict';
(() => {
  const CONTROL_MODES=new Set(['tilt','buttons','joystick']);
  class GalaxyInput {
    constructor({isMobile=false,onEscape=()=>{}}={}){
      this.isMobile=!!isMobile;
      this.onEscape=onEscape;
      this.keys=new Set();
      this.inGame=false;
      this.mode=this.loadMode();
      this.motionEnabled=false;this.motionTurn=0;this.motionNeutral=null;
      this.tiltTouches=new Map();this.mobileFire=false;this.mobileThrust=false;
      this.btnLeft=false;this.btnRight=false;this.btnFire=false;this.btnThrust=false;
      this.joyPointer=null;this.joyX=0;this.joyY=0;this.joyFire=false;
      this.app=document.getElementById('app');
      this.mobileSetup=document.getElementById('mobileSetup');
      this.enableMotionBtn=document.getElementById('enableMotion');
      this.motionStatus=document.getElementById('motionStatus');
      this.mobileControls=document.getElementById('mobileControls');
      this.fireZone=document.querySelector('.fire-zone');
      this.thrustZone=document.querySelector('.thrust-zone');
      this.rotateOverlay=document.getElementById('rotateDevice');
      this.mobileGuide=document.querySelector('.mobile-guide-main');
      this.modeButtons=[...document.querySelectorAll('[data-control-mode]')];
      this.buttonPad=document.getElementById('buttonControls');
      this.joystickPad=document.getElementById('joystickControls');
      this.joystickBase=document.getElementById('joystickBase');
      this.joystickStick=document.getElementById('joystickStick');
      this.joystickFire=document.getElementById('joystickFire');
      this.bindKeyboard();
      if(this.isMobile)this.bindMobile();
      this.applyMode();this.updateOrientationPrompt();
    }
    loadMode(){
      try{const v=localStorage.getItem('galaxyControlMode');if(CONTROL_MODES.has(v))return v;}catch(_){}
      return 'tilt';
    }
    saveMode(){try{localStorage.setItem('galaxyControlMode',this.mode);}catch(_){} }
    bindKeyboard(){
      window.addEventListener('keydown',e=>{
        this.keys.add(e.code);
        if(['ArrowUp','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();
        if(e.code==='Escape')this.onEscape(e);
      });
      window.addEventListener('keyup',e=>this.keys.delete(e.code));
      const clear=()=>this.keys.clear();
      window.addEventListener('blur',clear);
      document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
    }
    bindMobile(){
      this.mobileSetup?.classList.remove('hidden');
      this.enableMotionBtn?.addEventListener('click',()=>this.enableMotion());
      for(const b of this.modeButtons)b.addEventListener('click',()=>this.setMode(b.dataset.controlMode));
      this.app?.addEventListener('pointerdown',e=>this.onAppPointerDown(e),{passive:false});
      this.app?.addEventListener('pointerup',e=>this.onAppPointerEnd(e),{passive:false});
      this.app?.addEventListener('pointercancel',e=>this.onAppPointerEnd(e),{passive:false});
      this.app?.addEventListener('pointerleave',e=>{if(e.pointerType==='touch')this.onAppPointerEnd(e);},{passive:false});
      document.querySelectorAll('[data-mobile-action]').forEach(el=>{
        const action=el.dataset.mobileAction;
        const down=e=>{if(!this.inGame||this.mode!=='buttons')return;e.preventDefault();e.stopPropagation();this.setButtonAction(action,true);try{el.setPointerCapture?.(e.pointerId);}catch(_){}};
        const up=e=>{e.preventDefault();e.stopPropagation();this.setButtonAction(action,false);};
        el.addEventListener('pointerdown',down,{passive:false});
        el.addEventListener('pointerup',up,{passive:false});el.addEventListener('pointercancel',up,{passive:false});el.addEventListener('lostpointercapture',()=>this.setButtonAction(action,false));
      });
      if(this.joystickBase){
        this.joystickBase.addEventListener('pointerdown',e=>this.joyStart(e),{passive:false});
        this.joystickBase.addEventListener('pointermove',e=>this.joyMove(e),{passive:false});
        this.joystickBase.addEventListener('pointerup',e=>this.joyEnd(e),{passive:false});
        this.joystickBase.addEventListener('pointercancel',e=>this.joyEnd(e),{passive:false});
      }
      if(this.joystickFire){
        const down=e=>{if(!this.inGame||this.mode!=='joystick')return;e.preventDefault();e.stopPropagation();this.joyFire=true;this.joystickFire.classList.add('active');try{this.joystickFire.setPointerCapture?.(e.pointerId);}catch(_){}};
        const up=e=>{e.preventDefault();e.stopPropagation();this.joyFire=false;this.joystickFire.classList.remove('active');};
        this.joystickFire.addEventListener('pointerdown',down,{passive:false});this.joystickFire.addEventListener('pointerup',up,{passive:false});this.joystickFire.addEventListener('pointercancel',up,{passive:false});this.joystickFire.addEventListener('lostpointercapture',()=>{this.joyFire=false;this.joystickFire.classList.remove('active');});
      }
      window.addEventListener('orientationchange',()=>this.orientationChanged(),{passive:true});
      screen.orientation?.addEventListener?.('change',()=>this.orientationChanged());
      window.addEventListener('resize',()=>this.updateOrientationPrompt(),{passive:true});
    }
    setMode(mode){
      if(!CONTROL_MODES.has(mode))return;
      this.mode=mode;this.saveMode();this.resetMobileState();this.applyMode();
      if(mode==='tilt'&&this.motionEnabled)this.recalibrate();
    }
    applyMode(){
      if(this.mobileSetup)this.mobileSetup.classList.toggle('hidden',!(this.isMobile&&this.mode==='tilt'));
      for(const b of this.modeButtons)b.classList.toggle('active',b.dataset.controlMode===this.mode);
      this.enableMotionBtn?.classList.toggle('hidden',this.mode!=='tilt');
      if(this.mobileGuide){
        this.mobileGuide.textContent=this.mode==='tilt'?'Inclina para girar · izquierda: disparo · derecha: acelerar.':this.mode==='buttons'?'Botones: gira, acelera y dispara desde la pantalla.':'Joystick: mueve para girar y acelerar · boton derecho: disparo.';
      }
      this.mobileControls?.classList.toggle('mode-tilt',this.mode==='tilt');
      this.mobileControls?.classList.toggle('mode-buttons',this.mode==='buttons');
      this.mobileControls?.classList.toggle('mode-joystick',this.mode==='joystick');
      this.buttonPad?.classList.toggle('hidden',!(this.isMobile&&this.inGame&&this.mode==='buttons'));
      this.joystickPad?.classList.toggle('hidden',!(this.isMobile&&this.inGame&&this.mode==='joystick'));
      if(this.motionStatus&&this.mode!=='tilt')this.motionStatus.textContent='';
    }
    screenAngle(){if(screen.orientation&&Number.isFinite(screen.orientation.angle))return screen.orientation.angle;return Number.isFinite(window.orientation)?window.orientation:0;}
    lateralTilt(ev){const beta=Number(ev.beta)||0,gamma=Number(ev.gamma)||0;const a=((this.screenAngle()%360)+360)%360;if(a===90)return beta;if(a===270)return -beta;if(a===180)return -gamma;return gamma;}
    onDeviceOrientation=(ev)=>{
      const raw=this.lateralTilt(ev);if(this.motionNeutral===null)this.motionNeutral=raw;
      let delta=raw-this.motionNeutral;if(delta>180)delta-=360;if(delta<-180)delta+=360;
      const dead=3;if(Math.abs(delta)<=dead){this.motionTurn=0;return;}
      const signed=delta>0?delta-dead:delta+dead;this.motionTurn=-Math.max(-1,Math.min(1,signed/22));
    };
    async enableMotion(){
      if(!this.isMobile)return true;
      try{
        if(typeof DeviceOrientationEvent==='undefined'){if(this.motionStatus)this.motionStatus.textContent='Este navegador no ofrece sensor de orientacion.';return false;}
        if(typeof DeviceOrientationEvent.requestPermission==='function'){
          const result=await DeviceOrientationEvent.requestPermission();if(result!=='granted')throw new Error('Permiso de movimiento denegado');
        }
        window.removeEventListener('deviceorientation',this.onDeviceOrientation);window.addEventListener('deviceorientation',this.onDeviceOrientation,{passive:true});
        this.motionEnabled=true;this.recalibrate();
        if(this.motionStatus)this.motionStatus.textContent='Giro activo · posicion actual calibrada como centro.';
        if(this.enableMotionBtn)this.enableMotionBtn.textContent='RECALIBRAR GIRO';
        return true;
      }catch(err){if(this.motionStatus)this.motionStatus.textContent='No se pudo activar el giro: '+String(err?.message||'permiso no disponible');return false;}
    }
    recalibrate(){this.motionNeutral=null;this.motionTurn=0;}
    onAppPointerDown(e){
      if(!this.inGame||this.mode!=='tilt')return;
      if(e.target.closest?.('button,input,select,.voice-ptt,.mobile-exit'))return;
      const side=e.clientX<window.innerWidth/2?'fire':'thrust';this.tiltTouches.set(e.pointerId,side);this.refreshTilt();
      try{e.target.setPointerCapture?.(e.pointerId);}catch(_){}e.preventDefault();
    }
    onAppPointerEnd(e){if(this.mode!=='tilt')return;if(e.target.closest?.('button,input,select,.voice-ptt,.mobile-exit'))return;if(this.tiltTouches.delete(e.pointerId))this.refreshTilt();if(this.inGame)e.preventDefault();}
    refreshTilt(){
      this.mobileFire=false;this.mobileThrust=false;
      for(const side of this.tiltTouches.values()){if(side==='fire')this.mobileFire=true;if(side==='thrust')this.mobileThrust=true;}
      this.fireZone?.classList.toggle('active',this.mobileFire);this.thrustZone?.classList.toggle('active',this.mobileThrust);
    }
    setButtonAction(action,on){if(action==='left')this.btnLeft=on;if(action==='right')this.btnRight=on;if(action==='fire')this.btnFire=on;if(action==='thrust')this.btnThrust=on;}
    joyStart(e){if(!this.inGame||this.mode!=='joystick')return;e.preventDefault();e.stopPropagation();this.joyPointer=e.pointerId;try{this.joystickBase.setPointerCapture?.(e.pointerId);}catch(_){}this.updateJoy(e);}
    joyMove(e){if(e.pointerId!==this.joyPointer)return;e.preventDefault();e.stopPropagation();this.updateJoy(e);}
    joyEnd(e){if(e.pointerId!==this.joyPointer)return;e.preventDefault();e.stopPropagation();this.joyPointer=null;this.joyX=0;this.joyY=0;this.paintJoy();}
    updateJoy(e){
      const r=this.joystickBase.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const radius=Math.max(1,r.width*.34);const len=Math.hypot(dx,dy);if(len>radius){dx=dx/len*radius;dy=dy/len*radius;}this.joyX=Math.max(-1,Math.min(1,dx/radius));this.joyY=Math.max(-1,Math.min(1,dy/radius));this.paintJoy();
    }
    paintJoy(){if(!this.joystickStick)return;this.joystickStick.style.transform=`translate(${this.joyX*34}px,${this.joyY*34}px)`;}
    async prepareForGame(){
      if(!this.isMobile)return true;
      if(this.mode==='tilt'&&!this.motionEnabled)await this.enableMotion();
      await this.tryFullscreenLandscape();this.updateOrientationPrompt();return true;
    }
    async tryFullscreenLandscape(){
      try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch(_){}
      try{if(screen.orientation?.lock)await screen.orientation.lock('landscape');}catch(_){}
    }
    isPortrait(){return this.isMobile&&window.innerHeight>window.innerWidth;}
    updateOrientationPrompt(){if(!this.rotateOverlay)return;this.rotateOverlay.classList.toggle('hidden',!(this.isMobile&&this.inGame&&this.isPortrait()));}
    orientationChanged(){this.recalibrate();this.updateOrientationPrompt();}
    enterGame(){this.inGame=true;if(this.isMobile)this.mobileControls?.classList.remove('hidden');else this.mobileControls?.classList.add('hidden');this.applyMode();this.updateOrientationPrompt();}
    exitGame(){this.inGame=false;this.mobileControls?.classList.add('hidden');this.rotateOverlay?.classList.add('hidden');this.resetMobileState();this.applyMode();}
    resetMobileState(){this.tiltTouches.clear();this.mobileFire=false;this.mobileThrust=false;this.btnLeft=this.btnRight=this.btnFire=this.btnThrust=false;this.joyPointer=null;this.joyX=this.joyY=0;this.joyFire=false;this.refreshTilt();this.paintJoy();document.querySelectorAll('[data-mobile-action].active,#joystickFire.active').forEach(e=>e.classList.remove('active'));}
    getControl(){
      const leftKey=this.keys.has('KeyA')||this.keys.has('ArrowLeft'),rightKey=this.keys.has('KeyD')||this.keys.has('ArrowRight');
      let turn=(leftKey?1:0)-(rightKey?1:0),thrust=this.keys.has('KeyW')||this.keys.has('ArrowUp'),fire=this.keys.has('Space')||this.keys.has('ControlLeft')||this.keys.has('ControlRight');
      if(this.isMobile){
        if(this.mode==='tilt'){if(this.motionEnabled)turn=this.motionTurn;thrust=thrust||this.mobileThrust;fire=fire||this.mobileFire;}
        else if(this.mode==='buttons'){turn=(this.btnLeft?1:0)-(this.btnRight?1:0);thrust=thrust||this.btnThrust;fire=fire||this.btnFire;}
        else{turn=-this.joyX;thrust=thrust||this.joyY<-.28;fire=fire||this.joyFire;}
      }
      return {turn,thrust,fire};
    }
    getVisualState(){const c=this.getControl();return {fire:c.fire,thrust:c.thrust,mode:this.mode};}
  }
  window.GalaxyInput=GalaxyInput;
})();
