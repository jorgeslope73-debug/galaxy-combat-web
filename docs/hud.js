'use strict';
(() => {
  function createHudRenderer({ctx,W,H,isMobile,images,playerColors,drawImageSafely,hudPlayerName,clamp}){
    function draw({state,now,myIndex,fx}){
      if(!state)return;
      let max=0,leader=null,tied=false;
      for(const p of state.players){
        const score=Number(p.k)||0;
        if(score>max){max=score;leader=p.i;tied=false;}
        else if(score===max&&score>0){tied=true;}
      }
      if(max<=0||tied)leader=null;
      state.players.forEach(p=>{
        const hudScale=isMobile?1.48:1;
        const panelW=128*hudScale,panelH=153*hudScale;
        const left=p.i%2===0,top=p.i<2;
        const px=left?10:W-88-panelW;
        const py=top?5:H-33-157*hudScale;
        const color=playerColors[p.i];
        const localKillFlash=p.i===myIndex&&now<fx.killHudFlashUntil;
        const flashElapsed=localKillFlash?Math.max(0,now-fx.killHudFlashStart):0;
        const localKillScoreFx=p.i===myIndex&&now>=fx.killScoreFxStart&&now<fx.killScoreFxUntil;
        const scoreFxElapsed=localKillScoreFx?Math.max(0,now-fx.killScoreFxStart):0;
        const localCrashScoreFx=p.i===myIndex&&now>=fx.crashScoreFxStart&&now<fx.crashScoreFxUntil;
        const crashFxElapsed=localCrashScoreFx?Math.max(0,now-fx.crashScoreFxStart):0;
        const panel=images[left?'pantA':'pantB'];
        if(localKillFlash){
          const flash=1-flashElapsed/450;ctx.save();ctx.shadowColor=color;ctx.shadowBlur=34*flash*hudScale;ctx.globalAlpha=1;drawImageSafely(panel,px,py,panelW,panelH);ctx.globalCompositeOperation='screen';ctx.globalAlpha=.32*flash;drawImageSafely(panel,px,py,panelW,panelH);ctx.restore();
        }else drawImageSafely(panel,px,py,panelW,panelH);
        const rightHud=p.i===1||p.i===3;
        const nameX=rightHud?px+panelW-4*hudScale:px+4*hudScale;
        ctx.font=isMobile?`800 ${22*hudScale}px Arial,Helvetica,sans-serif`:`${20*hudScale}px Flashback,Arial`;
        ctx.fillStyle=color;ctx.textAlign=rightHud?'right':'left';ctx.textBaseline='top';let alpha=1;if(leader===p.i)alpha=.62+.38*(.5+.5*Math.sin(now*.0042));ctx.globalAlpha=alpha;ctx.fillText(hudPlayerName(p),nameX,py+157*hudScale);ctx.globalAlpha=1;
        const tx=px+(left?50:46)*hudScale;ctx.textAlign='left';ctx.fillStyle=color;if(isMobile)ctx.font=`800 ${23*hudScale}px Arial,Helvetica,sans-serif`;ctx.fillText(String(p.ammo),tx,py+15*hudScale);ctx.fillText('x'+p.spd,tx,py+80*hudScale);
        const killText=`${p.k}/${state.scoreToWin}`;
        if(localCrashScoreFx){
          const duration=950,t=clamp(crashFxElapsed/duration,0,1),envelope=1-t,burst=Math.sin(Math.min(1,t*2.4)*Math.PI),kx=tx,ky=py+115*hudScale,shake=envelope*5*hudScale,sx=Math.sin(crashFxElapsed*.12)*shake,sy=Math.cos(crashFxElapsed*.10)*shake*.55;
          ctx.save();ctx.translate(kx+sx,ky+sy);const scoreScale=1+0.72*burst*envelope;ctx.scale(scoreScale,scoreScale);ctx.shadowColor='rgba(255,70,20,.95)';ctx.shadowBlur=(18+42*envelope)*hudScale;ctx.fillStyle='#ff5b2d';ctx.globalAlpha=.75+.25*envelope;ctx.fillText(killText,0,0);ctx.restore();
          ctx.save();ctx.translate(kx,ky+7*hudScale);ctx.globalAlpha=Math.max(0,envelope);ctx.strokeStyle='#ff7a2f';ctx.lineWidth=3*hudScale;ctx.shadowColor='rgba(255,80,20,.9)';ctx.shadowBlur=14*hudScale*envelope;ctx.beginPath();ctx.arc(0,0,(10+42*t)*hudScale,0,Math.PI*2);ctx.stroke();
          for(let n=0;n<12;n++){const a=(Math.PI*2*n/12)+0.18,inner=(12+28*t)*hudScale,outer=(24+58*t)*hudScale;ctx.beginPath();ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);ctx.stroke();}ctx.restore();
        }else if(localKillScoreFx){
          const t=clamp(scoreFxElapsed/2000,0,1),appear=clamp(scoreFxElapsed/220,0,1),settle=1-Math.pow(1-t,2),pulse=.5+.5*Math.sin(scoreFxElapsed*.012),envelope=1-t,scale=(.72+1.05*appear)+.48*envelope*pulse-.17*settle,kx=tx,ky=py+115*hudScale;
          ctx.save();ctx.translate(kx,ky);ctx.scale(scale,scale);ctx.shadowColor=color;ctx.shadowBlur=(22+48*envelope*(.55+.45*pulse))*hudScale;ctx.fillStyle=color;ctx.globalAlpha=.9+.1*pulse;ctx.fillText(killText,0,0);ctx.restore();
        }else ctx.fillText(killText,tx,py+115*hudScale);
        ctx.fillStyle='#be0000';ctx.fillRect(tx,py+53*hudScale,Math.max(0,(30-p.cad)*2.3*hudScale),7*hudScale);ctx.fillRect(tx,py+105*hudScale,67*clamp((p.spd-1),0,1)*hudScale,7*hudScale);
      });
    }
    return {draw};
  }
  window.GalaxyHud={create:createHudRenderer};
})();
