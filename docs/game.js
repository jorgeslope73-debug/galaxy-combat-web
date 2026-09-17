'use strict';
(() => {
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
  const menu=document.getElementById('menu'),lobby=document.getElementById('lobby'),victory=document.getElementById('victory');
  const statusEl=document.getElementById('status'),roomCodeEl=document.getElementById('roomCode'),playersEl=document.getElementById('players'),startBtn=document.getElementById('start'),topbar=document.getElementById('topbar'),roomMini=document.getElementById('roomMini');
  const W=1920,H=1080;
  const playerColors=['#5ae1ff','#ff50a5','#5aff78','#ffdc46'];
  const images={},sounds={}; let state=null,myIndex=null,isHost=false,roomCode='',inGame=false,lastStateTime=0;
  const keys=new Set(); let ws=null,reconnectTimer=null,musicStarted=false;
  let connectAttempt=0,wakeStartedAt=0,manualClose=false;
  const serverButtons=['cpu','create','join'].map(id=>document.getElementById(id));
  const isMobile=(matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  const mobileSetup=document.getElementById('mobileSetup'),enableMotionBtn=document.getElementById('enableMotion'),motionStatus=document.getElementById('motionStatus');
  const mobileControls=document.getElementById('mobileControls'),fireZone=document.querySelector('.fire-zone'),thrustZone=document.querySelector('.thrust-zone');
  let motionEnabled=false,motionTurn=0,motionNeutral=null,motionLastRaw=0;
  let mobileFire=false,mobileThrust=false;
  const touchSides=new Map();

  const assetList={
    bg:'assets/sprites/fondo.png', giant:'assets/sprites/asteroidegrande.png',
    pantA:'assets/sprites/pantA.png',pantB:'assets/sprites/pantB.png',
    ammo1:'assets/sprites/municion1.png',ammo3:'assets/sprites/municion3.png',cadence:'assets/sprites/cadencia.png',speed:'assets/sprites/velocidad.png',
    asteroid1:'assets/sprites/asteroide1.png',asteroid2:'assets/sprites/asteroide2.png',asteroid3:'assets/sprites/asteroide3.png',asteroid4:'assets/sprites/asteroide5.png',asteroid5:'assets/sprites/asteroide6.png',asteroid6:'assets/sprites/dos.png'
  };
  for(let i=1;i<=4;i++){
    assetList[`ship${i}`]=`assets/sprites/coete${i}.png`;
    assetList[`ship${i}a`]=`assets/sprites/coete${i}a.png`;
    assetList[`ship${i}f`]=`assets/sprites/coete${i}f.png`;
  }
  // Fixed frame 8: safe filename for static hosting (no leading underscore).
  assetList.boom8='assets/sprites/boom/explosion8.png';
  const warnedImages=new WeakSet();
  function reportImageFailure(im,error){
    if(!im||warnedImages.has(im))return;
    warnedImages.add(im);
    console.warn('[Galaxy Combat] Image unavailable; continuing without blocking the game.',im.currentSrc||im.src,error||'');
  }
  for(const [k,url] of Object.entries(assetList)){
    const im=new Image();
    im.onerror=()=>reportImageFailure(im);
    im.src=url;
    images[k]=im;
  }
  // Same original _8.png embedded as a backup. It does not depend on a
  // successful asset request or on how GitHub Pages builds the asset folder.
  const explosionFrame8Backup=new Image();
  explosionFrame8Backup.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAHEGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4xLWMwMDAgNzkuZWRhMmIzZiwgMjAyMS8xMS8xNC0xMjozMDo0MiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIzLjEgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMi0wMi0yM1QxOToxNTo1MyswMTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjItMDItMjNUMjA6NTI6MzMrMDE6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjItMDItMjNUMjA6NTI6MzMrMDE6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iQWRvYmUgUkdCICgxOTk4KSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyZTlmYzc1ZC02NzU3LTEyNDAtODMzMC1mZDYyN2ZkZmM1MGYiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDplYzA1MGI5MS05MTM2LTAxNDItYTIyYy1hZWIwMmM1OWIxMGIiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo5NzdiOGI2NC1mMWE2LTE0NDUtODRmMC1mNGE1MjY4YTU4N2YiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjk3N2I4YjY0LWYxYTYtMTQ0NS04NGYwLWY0YTUyNjhhNTg3ZiIgc3RFdnQ6d2hlbj0iMjAyMi0wMi0yM1QxOToxNTo1MyswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDIzLjEgKFdpbmRvd3MpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gaW1hZ2UvZ2lmIHRvIGltYWdlL3BuZyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6M2Y0Y2ZlMGItNWUxMi1kMDQ3LWJiMzgtYjMzNDBkMGE4MDU2IiBzdEV2dDp3aGVuPSIyMDIyLTAyLTIzVDIwOjQ0OjQ5KzAxOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjMuMSAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjJlOWZjNzVkLTY3NTctMTI0MC04MzMwLWZkNjI3ZmRmYzUwZiIgc3RFdnQ6d2hlbj0iMjAyMi0wMi0yM1QyMDo1MjozMyswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDIzLjEgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pllrw/QAAA+USURBVGiB7Zp5lBXVnce/tdd7VW9fuh+90wu7EloFTgIEkCgjRMjghojEozHu0Ul0VBIMSTQ6UWcwZMS4oA4amiCLI3CIGkDDIkpYW5qmm6bX1/32flvtd/5oacXQBAiZcHL8nvM7p17V/dW7n/rdpX73FkUIwT+D6H90Bc6XvgK50PRPA8KeONi354MzdrIsDjyfgiT2gOcy4NgsDEtATgkgnSkBAFCU9YWyvXA7msEyChi7hYaNk9C+bRhETxpSWQYENLJNMni/BjNPgeEJbMU59B52gqIBYkHWe9mpag9/tRDQjhReGX7qG7NGWKcEuVBELIBiCQS/Boolod56x0NajJ+vJTmPmQcoBoBFOzELj3zR78ICIQDnNECz4CPb/E/2bPN9X0uwIs0BtAjwAqCngVybbfiXXS8MEAJQNAHv1aB0idO6tvl+m23hy1g7wLn6rgOAZfQd+78e3QQUn3SLfzwIAVjZAOcyEdvlfS66w3W3kf4MgEI/BChATwFShRGVBudWfPk25w2EEAaWxX7p308PAAC8V4OWEsd0bgisSDewQ6XBBK7h+XdY2WjUk/yQfKc4/YSLpQEFU8OPSeXZ9HkGITBNARQIaEYr47nMoBxl7iGgVIoiIIT6DOyEfeZlUaAFC2Khitgu34/b1wUXgwbKb4o8K1Vkn822SW2CR4MQVAJNL1T2EBNQY4BvbK6t/LrGpZZK/UVNzhGEAKCgGU74HEfnOlwNP+W5VFU+V3wsmyucoemOeprRQAgDQlhQlGEzLRYgUp4YJjinAYqiq9rXFb6e/pQf5xub/UNgYvx+MagcyocFWBoN/4QIojv8s7U4wNgBWID30viVjGjAzP1ltc8JhICGqrkRcNcv8oXefQwWj2Tsaw+quufXpiEqFuEBRoVdjsMwBXBWZkTIv2u3ToT3Tc7169ihGfqRF+1v+4fpKJ/Xs0Aqz70KEOQ7bKBFA8FvdsPSaUS2BH4JAMQAPGOUh2jWqjfS3Clb7lmC9EVCUX0oDu5YGCxZ9xg0N1pbZy0gwKuSrRugAV7KI3fchWQyACGogpawb3D1+29z+GgmiH9Kzcg16PjGbXXlc2J3QtNimWYHxKACWjDhHJqCvSSH+idG/VfqkOABgIKpye1SWfYpNc5/sYWepLN8RaGgGTL87kMXl5av/BkMCe1t316Qypa9KgoxUBQB78kjvi+I3gYfehu9aFs9GPE9QX3b737wSHzvRMAAqmbV4Yb1z/ZIw3Mx1q6Bd2ugGAJWNmErzCO2M3BTcq98LzEB5zAlWj6v+XI9zQHWwDU7KxDTFMAxeVSVrlsNLo5o15TH4+mKVwUuAU5UIBUkkDocQPe2YlCsAd6twjYoj0y9berWW4cf+GTl9a3gskC+GLK4/e5AUf0Yz4ReFE45DmIBnEuH0m0rOfp85WtqBBALgIp5x6cygpk3MuyA0TgJxLLY0xthoGhe+F1HHqAdDZVK/NLN0XT1ozY+AZsjCTXnwsH109HzcQlYUQUrGRADKlKfOn7RsSHw7pC5sZ9wtb4qNTPmCJg8YBIUOT98xdR56IodDG+CmLA3Lh2yM32Ugr2UoPKWlimMZOxX4wIo5vRDen8fke1dpy1oERYin8Sgwvd/buaLcKRlzjzdtMNmjwIZgo6dYxE7XA45GAHl4sA6TLSvKVoT2+GcNfjmjuudNemVBm9HLDls2aDCw09D8cPuOnJREdk+valp4kZaptC2qnRzZLs4SCoFBs0IX84H8n/UkjzsUu6vtpb+iGi6Y2AzZKRzxXA5jt1Gy422dOLiVaohR2hKh245kIqXQU3JkPwxsA4DtKSj/eURO0ize3LlTbFKR5myUonysDmTiKWG/NbMhQgYFbAoFAY/+rHgVtC5MbQ68ifb1wUvUHJtx022UO49pUcERZ9ZKt4PohvSgKbpDlgmB6e97VFYEkAbKwKegwG/++DPJEcrRDYCQihwbh2WRg+O1BWlIqnwuNTs50fTBc3NmS4anI2CzZ1ALuNLJ3trNoHJATwAdI3vXBPY3/Ue/x1WBkpv6LrXWd37P0qPcMYQJ4HQtDGgWRYLh9ReJUvtZdBlmIZwSVFgx25OUNy9yUpE9pfBFsxBiwqjm1+qaBo0nNm4xXfPvBVb/+PhDm4Ldkc2AN6DqKg4gKBnLwjIajAA6AQ+euY+HFpWOkp0AoMXdC72XRJ5Lh8WzxjghPr7iFM6PmAhzZDgko9/A4wC6A54PIcWEl2EIdjv0ZoBTZOBtDE9vrJoQ/UU/Mo7Ifmj3FIdc6+7fVtl+cXwMhIEkUYskgNhCNK50k1+Zj0a6m7HO/82HTYHLG+t/pRzWGqRGhNPTFfnBmK3dQ9YSDBFSLZwOQgNEAa0GEZCmbi0u2E4st0e5FqEOen3Slbpk3fd2FjU8kZF8yQUeErgZmvaqLyT9XtlA5ofjR8WwVkUR+W0XR1H3vlew5pbbx7CAJi4aEurdBl5OBkuhaGyUNIS9BQPRkqBsZtnB+KSB44IITRYJu+ExQGUAehOmKzttd6WAnRvD82jj4uvW9O2Llu8deoltcVXrB4SOqDWjhkKgaaoux68Izb/2vn3Tp086dVctwtGzobGNy958MO7akO5NHDt8uUYefMq1/HITYytMG0aaQZqQkL6uBeq6oSmyGAUDpmoD5yqQzdlmMZpQAS5aWBc2gB0WYfuArgMLMvTE4mN+Siy3X9n5D1x6bif9I7vCSV22tdXqt+59aonnW6xe+vO3di0Yz0ZNbL6aZ9P3RfriMNdLiKxX567Z9GQJ3MZ4Lo3X8OI658D1OGsrDZzDsk0Ga8BptoAuYyCknRBSTthgUNwgQSaM+GQe0HsAHDJqUFSsdoBOSyLh02McqLYA/B55HNDV//58cvuS3xg+8/q27tmZG3xnWymAAsfXihMnjaatnF2bN9Tjz/t3YElTyxaPJSdCZVikOuyZtY/W7rCMoAb3nrZGjr7RRpqNSyVgyyFT8Qf0AFQgM0dBR3QAQugh/edNJLCKftPP0hb96STLnwxPVI1N0L+3T2D5BaAzqBp7agZR16y3THul8fneCrJOx1tvci59yOZSWHjGt0aXT0ZU0q+B2nmEFgRB8ggJ9KNzDXHVvjq8lHgokfDvxk6e/VVMEJlMCiYhCfhaC0A0r/68tdU6hoAJOA/2Pc8TAqs3QAYwMyyYOw61KwDIh9vhCkCRIUv1FIy6kepq6SK7AYYPih8OuB0CwUd4ejBrVuPYOIj1yLP5XHlsNtguLoRa1NmHXm+rM7MAFV35u8YdePm50HEf4UiAjQBTZlhp9Sm9iXv57YW/XlEDl8GAGBEC7k2GyyFhmtYAmaSguDLgypmtoOjAMWLoqm7rIurRu6MtNQgEd6Po63bJ9Kd7ISOrsiyvJmpaWzfv47TCmHKWeQ6+SnNL5atsTSg/JbexQXjW58PeXeC6KxGUTQAA4TQjEUYQtMGznrc/TJIJloAoC+H7tlbACPOgh/UjM53y+CpjaPlD2NmSjMb4BreCBg67eEPPGcM8t1IjFYMrQ6t7VWE1cvfXP7i9G+PK7G5s+uIpkPp8lxzdFmwztKAwTdH7hNL1CW0YKA9ORGl1Ltuhs0AXBZKpizS3HElBC6NM8r3AXhCJ//un9lZQQUrqGBYDYIzB8GTA81pcFYnkGuxz/740cJlHR8PA+gEoDnhc+2by5Eutyc4AioxzFG1Jbjrvvk/qAgOv2JUySSkD/gWfrokWEcsoOaetgW2wvwSllHAlAmQmO7XGbHbAUsAYKI3W7YRhAZFmWdsA0bkyyIWBd6pw8yzo5r+O/SWXI4W2xhuDcDdD4sHhCgEuufxFDXyzrLQEPT8sQxDB8kZjabZD5dqy5vr/DeydqDm7rbrxGC+TkvwkMbo8EgNE4L+bfNgyACbhZUvVLvjo39D0zpMkz+jaJxKp0ysiEWBc+gAKPnY8uJdahyonJser7oKH4DuB7gUoHlQXLzl6pEVT8De6wVlBWBPV43Nbbj02KcvyTc6aoxczb0d01lJr9NSHAomdkB0plHs3PoGGAUwRYDNoCc+5kVF9UY5NgeKss7YzgiEEUyAUGhcNuz92F7aVvnd6O9rvrs7nI160N467T5iCQCbAcQWona6Ee6ogKUoDxx41rez4wMUl87M7q++49gQVtI35cM2+MZHYXPHUeVfu8jmaiqG6gG4NKAGEI6NWShwvZ8tHZ27+kGIRYFYFEAoCH4FkZ3BX7Su8lzqG01QecvhuzmXCp7NIEsVLemMXzHZ5PxbAceOQzvmlHZt9rzR8krB05YO1NwZfqZ8fsvFlk61qzERvtpuUE4WohW7WvbuewwACOEBNov28KQfKponyTL5vwkC+EIfoWjSt3wp6dBTrknJfdwjFAuM+PdD87yje7pb11Yi3eiGzZdCb7l/S1f9yG/GP/E+1FRXdSx3BLRUaZmVt7TMcQ7rXZvrkJAP2+Eb3QXH8BSQ1YeWVm9aC0ZBuHXWC065dTJnisUdkXFPC1wS5ByH3FOCOEpjYCUdpspRnf9b9LaeBEIzcgeCk8MrOjaXIfHnAAgNaPlCpLussZ2bCxcn9+FbtAWEZmR2hL7VPZ8R1aNKlwhTYcDZNcglUViKAJfUNgNsHj3tM++O9w5ZHvTtyTS2zp4EEDCMBkL+9v2mfpB8xAG7mEXb2rJfJfaxDjEElF1z7P5Ugw+dm0shhTLgvJo9ut3/w+R+10/TDYAUAvzjE8uCk2Lfp3kDakQA79YBAtC8CdMUYREOabP0zUh40u97syUtHmfDI3kl8GZe8W/jucx5gTgJBBSNdKNHbl9X/AAA+Memmzin+l50ewD2UA5qnL8m/H5wSXK/rdDSAU+tFiu8vOcWMZhbr6V4sCI+T02pz/scxRBYhOkwLQ5uuQlppfAVNeHpEoUEcor/XCfygUHsxWm0v1X6QL4DYCXAUZN6IVXvRaZZvtJIM/ckDzj/RQkDYgBwX5R+2XtZ4n7eq/aqXQIoEaetUN+QaYIAIKC7aOoUCcX5AlHjNkR3BW5jxL69iVS9Z5qRZa/ItwtTtCRATMA1QssUXh65jRGs31kKDT3FneUTpUCBgDrHF8MzAknu8QzLt4vFnBtgeCD1qXQ50QBL74uQpza1Mjghci/r1Hvie3zgZB3MeWoW50P9INnj8nQ9DfCevi0uKw9QHOAcmv/EU5v4uTw4t9ZI0yAWB+oCAjihfhBTpacaaYCi+3ZO5ar8Qc/XEs9wLusVVtagxTmAENDCmSU+/9/6fDloSPppudLht4W0VkdVZhXv0+t4l4J0kxMgFmienLcR5u8h6quvgy4wfQVyoen/AAVtOEJ7PeJ2AAAAAElFTkSuQmCC';
  sounds.laser=new Audio('assets/sonido/laser_1.mp3');sounds.impact=new Audio('assets/sonido/impacto1.mp3');sounds.pickup=new Audio('assets/sonido/carga3.wav');sounds.start=new Audio('assets/sonido/inicio.wav');sounds.music=new Audio('assets/sonido/musica.mp3');sounds.music.loop=true;sounds.music.volume=.35;
  function playSound(k){const a=sounds[k];if(!a)return;try{const b=a.cloneNode();b.volume=k==='laser'?.55:.75;b.play().catch(()=>{});}catch(_){}}
  function startMusic(){if(musicStarted)return;musicStarted=true;sounds.music.play().catch(()=>{});}

  function screenAngle(){
    if(screen.orientation&&Number.isFinite(screen.orientation.angle))return screen.orientation.angle;
    return Number.isFinite(window.orientation)?window.orientation:0;
  }
  function lateralTilt(ev){
    const beta=Number(ev.beta)||0,gamma=Number(ev.gamma)||0;
    let a=((screenAngle()%360)+360)%360;
    if(a===90)return beta;
    if(a===270)return -beta;
    if(a===180)return -gamma;
    return gamma;
  }
  function onDeviceOrientation(ev){
    const raw=lateralTilt(ev);
    motionLastRaw=raw;
    if(motionNeutral===null)motionNeutral=raw;
    let delta=raw-motionNeutral;
    // Compensa el salto de -180/180 en sensores que lo necesiten.
    if(delta>180)delta-=360;
    if(delta<-180)delta+=360;
    const dead=3.0;
    if(Math.abs(delta)<=dead){motionTurn=0;return;}
    const signed=delta>0?delta-dead:delta+dead;
    motionTurn=-clamp(signed/22,-1,1);
  }
  async function enableMobileMotion(){
    if(!isMobile)return true;
    try{
      if(typeof DeviceOrientationEvent==='undefined'){
        motionStatus.textContent='Este navegador no ofrece sensor de orientación.';
        return false;
      }
      if(typeof DeviceOrientationEvent.requestPermission==='function'){
        const result=await DeviceOrientationEvent.requestPermission();
        if(result!=='granted')throw new Error('Permiso de movimiento denegado');
      }
      window.removeEventListener('deviceorientation',onDeviceOrientation);
      window.addEventListener('deviceorientation',onDeviceOrientation,{passive:true});
      motionNeutral=null;motionTurn=0;motionEnabled=true;
      motionStatus.textContent='Control móvil activo · giro invertido · posición actual calibrada como centro.';
      enableMotionBtn.textContent='RECALIBRAR GIRO';
      return true;
    }catch(err){
      motionStatus.textContent='No se pudo activar el giro: '+(err&&err.message?err.message:'permiso no disponible');
      return false;
    }
  }
  function refreshTouchControls(){
    mobileFire=false;mobileThrust=false;
    for(const side of touchSides.values()){
      if(side==='fire')mobileFire=true;
      if(side==='thrust')mobileThrust=true;
    }
    if(fireZone)fireZone.classList.toggle('active',mobileFire);
    if(thrustZone)thrustZone.classList.toggle('active',mobileThrust);
  }
  function mobilePointerDown(e){
    if(!isMobile||!inGame)return;
    // Los controles ocupan las mitades izquierda/derecha de la pantalla.
    const side=e.clientX<window.innerWidth/2?'fire':'thrust';
    touchSides.set(e.pointerId,side);refreshTouchControls();
    try{e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
  }
  function mobilePointerEnd(e){
    if(touchSides.delete(e.pointerId))refreshTouchControls();
    if(inGame)e.preventDefault();
  }

  function websocketUrl(){
    const configured=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').trim();
    if(configured){
      try{
        const u=new URL(configured,location.href);
        u.protocol=u.protocol==='https:'?'wss:':'ws:';
        u.pathname='/ws';u.search='';u.hash='';
        return u.toString();
      }catch(_){return null;}
    }
    // En desarrollo/local puede compartir origen con Node. GitHub Pages no
    // ejecuta WebSocket, por lo que alli hay que rellenar config.js.
    if(location.hostname.endsWith('github.io'))return null;
    const proto=location.protocol==='https:'?'wss:':'ws:';
    return `${proto}//${location.host}/ws`;
  }
  function setServerReady(ready){
    for(const b of serverButtons)b.disabled=!ready;
    statusEl.classList.toggle('ready',ready);
    statusEl.classList.toggle('waking',!ready);
  }
  function wakeStatus(){
    const secs=wakeStartedAt?Math.max(0,Math.floor((Date.now()-wakeStartedAt)/1000)):0;
    const dots='.'.repeat((connectAttempt%3)+1);
    statusEl.textContent=secs<8
      ? `Conectando con el servidor${dots}`
      : `Despertando servidor${dots} puede tardar hasta un minuto (${secs}s)`;
  }
  function scheduleReconnect(delay=2200){
    clearTimeout(reconnectTimer);
    reconnectTimer=setTimeout(connect,delay);
  }
  function connect(){
    const url=websocketUrl();
    if(!url){
      setServerReady(false);
      statusEl.classList.remove('waking');
      statusEl.textContent='Falta configurar el servidor de partida en config.js';
      return;
    }
    if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))return;
    if(!wakeStartedAt)wakeStartedAt=Date.now();
    connectAttempt++;
    setServerReady(false);
    wakeStatus();
    try{ws=new WebSocket(url);}catch(_){scheduleReconnect();return;}
    ws.onopen=()=>{
      clearTimeout(reconnectTimer);
      connectAttempt=0;wakeStartedAt=0;
      setServerReady(true);
      statusEl.textContent='Servidor conectado · listo para jugar';
    };
    ws.onclose=()=>{
      setServerReady(false);
      if(manualClose)return;
      if(inGame){
        statusEl.textContent='Se perdió la conexión con la partida';
        setTimeout(()=>location.reload(),1500);
      }else{
        wakeStatus();
        scheduleReconnect();
      }
    };
    ws.onerror=()=>{
      setServerReady(false);
      wakeStatus();
      // onclose programa el siguiente intento. No mostramos un error definitivo
      // porque un Render gratuito puede estar arrancando todavía.
    };
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}handle(m);};
  }
  function send(o){
    if(ws&&ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify(o));return true;}
    if(!inGame){setServerReady(false);if(!wakeStartedAt)wakeStartedAt=Date.now();wakeStatus();connect();}
    return false;
  }
  function handle(m){
    if(m.t==='created'||m.t==='joined'){roomCode=m.code;myIndex=m.index;isHost=m.t==='created';roomCodeEl.textContent=roomCode;roomMini.textContent=`SALA ${roomCode}`;menu.classList.add('hidden');if(!m.cpu)lobby.classList.remove('hidden');startMusic();}
    else if(m.t==='lobby'){roomCode=m.code;roomCodeEl.textContent=m.code;playersEl.innerHTML=m.players.map(p=>`<div style="color:${playerColors[p.i]||'#fff'}">J${p.i+1} · ${escapeHtml(p.n)}${p.cpu?' · CPU':''}</div>`).join('');startBtn.disabled=!(isHost&&m.canStart);}
    else if(m.t==='start'){beginGame();playSound('start');}
    else if(m.t==='state'){state=m;lastStateTime=performance.now();if(!inGame&&m.started)beginGame();}
    else if(m.t==='sound'){playSound(m.kind);}
    else if(m.t==='victory'){if(state)state.winner=m.winner;showVictory(m.winner);}
    else if(m.t==='error'){statusEl.textContent=m.message||'Error';}
    else if(m.t==='closed'){alert(m.reason||'Sala cerrada');location.reload();}
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function beginGame(){inGame=true;menu.classList.add('hidden');lobby.classList.add('hidden');victory.classList.add('hidden');topbar.classList.remove('hidden');if(isMobile)mobileControls.classList.remove('hidden');startMusic();}
  function showVictory(i){if(!inGame)return;inGame=false;topbar.classList.add('hidden');mobileControls.classList.add('hidden');touchSides.clear();refreshTouchControls();const p=state&&state.players.find(x=>x.i===i);document.getElementById('victoryText').textContent=p?`GANA ${p.n}`:`GANA J${i+1}`;victory.classList.remove('hidden');}

  document.getElementById('create').addEventListener('click',async()=>{startMusic();if(isMobile&&!motionEnabled)await enableMobileMotion();send({t:'create',name:document.getElementById('name').value});});
  document.getElementById('cpu').addEventListener('click',async()=>{startMusic();if(isMobile&&!motionEnabled)await enableMobileMotion();send({t:'cpu',name:document.getElementById('name').value,difficulty:document.getElementById('difficulty').value});});
  document.getElementById('join').addEventListener('click',async()=>{startMusic();if(isMobile&&!motionEnabled)await enableMobileMotion();send({t:'join',name:document.getElementById('name').value,code:document.getElementById('code').value});});
  if(isMobile){
    mobileSetup.classList.remove('hidden');
    enableMotionBtn.addEventListener('click',enableMobileMotion);
    document.getElementById('app').addEventListener('pointerdown',mobilePointerDown,{passive:false});
    document.getElementById('app').addEventListener('pointerup',mobilePointerEnd,{passive:false});
    document.getElementById('app').addEventListener('pointercancel',mobilePointerEnd,{passive:false});
    document.getElementById('app').addEventListener('pointerleave',e=>{if(e.pointerType==='touch')mobilePointerEnd(e);},{passive:false});
    window.addEventListener('orientationchange',()=>{motionNeutral=null;motionTurn=0;});
    if(screen.orientation)screen.orientation.addEventListener?.('change',()=>{motionNeutral=null;motionTurn=0;});
  }
  startBtn.addEventListener('click',()=>send({t:'start'}));
  document.getElementById('back').addEventListener('click',()=>location.reload());
  window.addEventListener('keydown',e=>{keys.add(e.code);if(['ArrowUp','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&inGame)location.reload();});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('beforeunload',()=>{manualClose=true;clearTimeout(reconnectTimer);try{if(ws)ws.close();}catch(_){}});

  setInterval(()=>{
    if(!inGame)return;
    const left=keys.has('KeyA')||keys.has('ArrowLeft'),right=keys.has('KeyD')||keys.has('ArrowRight');
    const keyboardTurn=(left?1:0)-(right?1:0);
    const turn=(isMobile&&motionEnabled)?motionTurn:keyboardTurn;
    const thrust=(isMobile?mobileThrust:false)||keys.has('KeyW')||keys.has('ArrowUp');
    const fire=(isMobile?mobileFire:false)||keys.has('Space')||keys.has('ControlLeft')||keys.has('ControlRight');
    send({t:'ctrl',turn,thrust,fire});
  },1000/30);

  function imageReady(im){
    // complete is ALSO true after a failed download. Check decoded dimensions.
    return Boolean(im&&im.complete&&im.naturalWidth>0&&im.naturalHeight>0);
  }
  function drawImageSafely(im,x,y,width,height){
    if(!imageReady(im))return false;
    try{
      if(width===undefined){ctx.drawImage(im,x,y);}
      else {ctx.drawImage(im,x,y,width,height);}
      return true;
    }catch(error){
      reportImageFailure(im,error);
      return false;
    }
  }
  function drawImageCentered(im,x,y,size,rot=0,alpha=1){
    if(!imageReady(im)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(rot))return false;
    ctx.save();
    try{
      ctx.globalAlpha=alpha;
      ctx.translate(x,y);
      ctx.rotate(rot*Math.PI/180);
      if(size)return drawImageSafely(im,-size/2,-size/2,size,size);
      return drawImageSafely(im,-im.naturalWidth/2,-im.naturalHeight/2);
    }finally{
      // An image error must never leave translate/rotate/alpha on the canvas.
      ctx.restore();
    }
  }
  function drawPickup(pk){
    const map={ammo1:'ammo1',ammo3:'ammo3',cadence:'cadence',speed:'speed'};
    if(map[pk.type]){drawImageCentered(images[map[pk.type]],pk.x,pk.y,46);return;}
    ctx.save();ctx.translate(pk.x,pk.y);
    if(pk.type==='shield'){ctx.strokeStyle='#8ff5ff';ctx.lineWidth=4;ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.25;ctx.fillStyle='#5adfff';ctx.fill();}
    else if(pk.type==='camo'){ctx.strokeStyle='#d1b4ff';ctx.fillStyle='rgba(160,100,255,.18)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.globalAlpha=.9;ctx.font='18px Arial';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('C',0,1);}
    ctx.restore();
  }
  function drawShip(p){
    const local=p.i===myIndex;
    if(p.dead){
      // Explosion fija: usamos el fotograma 8 durante todo el tiempo de
      // reaparicion. Es mas robusto que depender de una animacion temporal.
      if(!drawImageCentered(images.boom8,p.x,p.y,null,0,1)){
        drawImageCentered(explosionFrame8Backup,p.x,p.y,null,0,1);
      }
      return;
    }
    if(p.camo>0&&!local)return;
    let alpha=1;
    if(p.camo>0&&local){alpha=.42;if(p.camo<=3)alpha=(Math.floor(performance.now()/160)%2===0)?.55:.22;}
    if(p.prot>0)alpha*=.75;
    if(p.shield>0){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='rgba(130,245,255,.95)';ctx.fillStyle='rgba(80,220,255,.12)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,39,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
    const im=images[`ship${p.i+1}${Math.hypot(p.vx,p.vy)>40?'a':''}`]||images[`ship${p.i+1}`];
    // Los PNG originales de las naves apuntan hacia ARRIBA.
    // La física usa rot=0 arriba, 90 izquierda, 180 abajo y 270 derecha.
    // Canvas gira en el sentido visual contrario a esa convención, por eso
    // dibujamos con -rot. Así el morro coincide exactamente con el avance.
    drawImageCentered(im,p.x,p.y,null,-p.r,alpha);
  }
  function drawHud(){
    if(!state)return;const max=Math.max(0,...state.players.map(p=>p.k));const leaders=state.players.filter(p=>p.k===max&&max>0);const leader=leaders.length===1?leaders[0].i:null;
    state.players.forEach(p=>{
      const left=p.i%2===0,top=p.i<2;const px=left?10:W-216,py=top?5:H-190;const color=playerColors[p.i];
      const panel=images[left?'pantA':'pantB'];drawImageSafely(panel,px,py,128,153);
      ctx.font='20px Flashback,Arial';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='top';let alpha=1;if(leader===p.i)alpha=.62+.38*(.5+.5*Math.sin(performance.now()*.0042));ctx.globalAlpha=alpha;ctx.fillText(`J${p.i+1} · ${p.n}`,px+64,py+157);ctx.globalAlpha=1;
      const tx=left?60:W-170;ctx.textAlign='left';ctx.fillStyle=color;ctx.fillText(String(p.ammo),tx,py+15);ctx.fillText('x'+p.spd,tx,py+80);ctx.fillText(`${p.k}/${state.scoreToWin}`,tx,py+115);
      ctx.fillStyle='#be0000';ctx.fillRect(tx,py+53,Math.max(0,(30-p.cad)*2.3),7);ctx.fillRect(tx,py+105,67*clamp((p.spd-1),0,1),7);
    });
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function render(){
    requestAnimationFrame(render);
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha=1;
    ctx.clearRect(0,0,W,H);
    if(!drawImageSafely(images.bg,0,0,W,H)){ctx.fillStyle='#020714';ctx.fillRect(0,0,W,H);}
    if(!state)return;
    for(const a of state.asteroids){drawImageCentered(images[`asteroid${a.type}`]||images.asteroid1,a.x,a.y,a.type===5?60:90);}
    for(const pk of state.pickups)drawPickup(pk);
    for(const m of state.meteors)drawImageCentered(images[`asteroid${m.type}`]||images.asteroid1,m.x,m.y,[0,22,27,31][m.type]||25,m.a);
    if(state.giant)drawImageCentered(images.giant,state.giant.x,state.giant.y,270,0,1);
    for(const b of state.bullets){const sp=Math.hypot(b.vx,b.vy)||1;ctx.strokeStyle='#50ff78';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-b.vx/sp*12,b.y-b.vy/sp*12);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const p of state.players)drawShip(p);
    drawHud();
    if(state.shower>0){ctx.font='22px Flashback,Arial';ctx.textAlign='center';ctx.fillStyle='rgba(255,170,70,.85)';ctx.fillText('LLUVIA DE METEORITOS',W/2,185);}
  }
  connect();render();
})();
