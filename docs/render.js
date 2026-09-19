'use strict';
(() => {
  function createRenderUtils({ctx,W,H,reportImageFailure=()=>{}}){
    function imageReady(im){return Boolean(im&&im.complete&&im.naturalWidth>0&&im.naturalHeight>0);}
    function drawImageSafely(im,x,y,width,height){
      if(!imageReady(im))return false;
      try{
        if(width===undefined)ctx.drawImage(im,x,y);
        else ctx.drawImage(im,x,y,width,height);
        return true;
      }catch(error){reportImageFailure(im,error);return false;}
    }
    function drawImageCentered(im,x,y,size,rot=0,alpha=1){
      if(!imageReady(im)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(rot))return false;
      ctx.save();
      try{
        ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rot*Math.PI/180);
        if(size)return drawImageSafely(im,-size/2,-size/2,size,size);
        return drawImageSafely(im,-im.naturalWidth/2,-im.naturalHeight/2);
      }finally{ctx.restore();}
    }
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const lerp=(a,b,t)=>a+(b-a)*t;
    function lerpAngle(a,b,t){const delta=((b-a+540)%360)-180;return (a+delta*t+360)%360;}
    function lerpWrapped(a,b,size,t){let delta=b-a;if(delta>size/2)delta-=size;else if(delta<-size/2)delta+=size;return (a+delta*t+size)%size;}
    function interpolationAlpha(previousState,state,lastStateTime,previousStateTime,now,netFrameMs=1000/30){
      if(!previousState||previousState===state||!lastStateTime)return 1;
      const measured=lastStateTime-previousStateTime;
      const frameMs=clamp(Number.isFinite(measured)&&measured>0?measured:netFrameMs,20,80);
      return clamp((now-lastStateTime)/frameMs,0,1);
    }
    return {imageReady,drawImageSafely,drawImageCentered,clamp,lerp,lerpAngle,lerpWrapped,interpolationAlpha};
  }
  window.GalaxyRenderUtils={create:createRenderUtils};
})();
