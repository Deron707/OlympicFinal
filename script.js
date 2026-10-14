const GRAVITY = 9.81;
const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const angleInput = document.getElementById('angle');
const speedInput = document.getElementById('speed');
const releaseHeightInput = document.getElementById('releaseHeight');
const throwerImage = new Image();
throwerImage.src = 'assets/thrower-study.png';
throwerImage.onload = () => drawField(lastResult);
const el = id => document.getElementById(id);
const fmt = (n, digits = 2) => Number(n).toFixed(digits);

const levels = [
  {name:'Rookie', target:30, icon:'🌱', subtitle:'Warm-up throw'},
  {name:'Sprinter', target:45, icon:'⚡', subtitle:'Build momentum'},
  {name:'Champion', target:60, icon:'🥉', subtitle:'Medal distance'},
  {name:'Elite', target:75, icon:'🥈', subtitle:'Precision matters'},
  {name:'Olympian', target:90, icon:'🥇', subtitle:'Final challenge'}
];
let unlockedLevel = 0, currentLevel = 0, cleared = new Set();
let attempts = 0, hits = 0, points = 0, best = 0, lastResult = null, animationFrame = null;

function targetDistance() { return levels[currentLevel].target; }
function getPhysics() {
  const angleDeg = Number(angleInput.value), speed = Number(speedInput.value);
  const releaseHeight = Number(releaseHeightInput.value);
  const angle = angleDeg * Math.PI / 180;
  const vx = speed * Math.cos(angle), vy = speed * Math.sin(angle);
  // Solve y0 + vy*t - 1/2*g*t² = 0 for the positive landing time.
  const flightTime = (vy + Math.sqrt(vy*vy + 2*GRAVITY*releaseHeight)) / GRAVITY;
  // Ideal projectile motion: ignore wind resistance and all horizontal forces.
  const finalVx = vx;
  const range = vx * flightTime;
  const maxHeight = releaseHeight + vy * vy / (2 * GRAVITY);
  const finalVy = vy - GRAVITY * flightTime;
  const finalSpeed = Math.hypot(finalVx, finalVy);
  return {angleDeg, speed, vx, vy, flightTime, range, maxHeight, finalSpeed, finalVy, releaseHeight, windAccel:0, finalVx, specificEnergy:0.5*speed*speed};
}
function renderLevels() {
  el('levelList').innerHTML = levels.map((level, i) => {
    const locked = i > unlockedLevel, isCleared = cleared.has(i), active = i === currentLevel;
    return `<button class="level-card ${active?'active ':''}${isCleared?'cleared':''}" data-level="${i}" ${locked?'disabled':''}>
      <span class="level-top"><span>LEVEL ${i+1}</span><span>${locked?'🔒':isCleared?'✓':'OPEN'}</span></span>
      <span class="level-icon">${locked?'🔒':level.icon}</span><strong>${level.target} m</strong><small>${locked?'Clear previous level':level.name}</small>
    </button>`;
  }).join('');
  el('levelList').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    currentLevel = Number(btn.dataset.level); lastResult = null;
    el('targetLabel').textContent = targetDistance();
    el('targetProgress').textContent = `Target: ${targetDistance()} m`;
    el('missionName').textContent = `Level ${currentLevel+1} · ${levels[currentLevel].name}`;
    el('status').textContent = 'LEVEL SELECTED';
    el('distance').textContent = '—';
    el('resultMessage').textContent = `Target ${targetDistance()} m. Set your angle and speed, then throw!`;
    el('progressBar').style.width = '0%';
    ['initialV','vx','vy','flightTime','finalV','dx','maxHeight','finalVy','targetError','releaseHeightMetric','windMetric','finalVx','specificEnergy'].forEach(id => el(id).textContent='—');
    el('dy').textContent='0.00 m'; el('working').textContent='Throw once to see the calculations.';
    renderLevels(); drawField(null);
  }));
  el('levelCount').textContent = `${unlockedLevel+1} / ${levels.length} unlocked`;
  el('levelProgressBar').style.width = `${((unlockedLevel+1)/levels.length)*100}%`;
}
function updatePhysicsDisplay(p) {
  el('initialV').textContent = `${fmt(p.speed)} m/s`;
  el('vx').textContent = `${fmt(p.vx)} m/s`;
  el('vy').textContent = `${fmt(p.vy)} m/s`;
  el('accel').textContent = '9.81 m/s²';
  el('ax').textContent = '0.00 m/s²';
  el('flightTime').textContent = `${fmt(p.flightTime)} s`;
  el('finalV').textContent = `${fmt(p.finalSpeed)} m/s`;
  el('finalVy').textContent = `${fmt(p.finalVy)} m/s`;
  el('dx').textContent = `${fmt(p.range)} m`;
  el('dy').textContent = '0.00 m';
  el('maxHeight').textContent = `${fmt(p.maxHeight)} m`;
  el('targetError').textContent = `${fmt(Math.abs(p.range-targetDistance()))} m`;
  el('releaseHeightMetric').textContent = `${fmt(p.releaseHeight)} m`;
  el('windMetric').textContent = 'Ignored';
  el('finalVx').textContent = `${fmt(p.finalVx)} m/s`;
  el('specificEnergy').textContent = `${fmt(p.specificEnergy)} J/kg`;
  el('working').innerHTML =
    `<p><b>1. Resolve initial velocity</b><br><code>vₓ = v₀ cos θ = ${fmt(p.speed)} × cos(${p.angleDeg}°) = ${fmt(p.vx)} m/s</code><br><code>vᵧ = v₀ sin θ = ${fmt(p.speed)} × sin(${p.angleDeg}°) = ${fmt(p.vy)} m/s</code></p>`+
    `<p><b>2. Time of flight (release height included)</b><br><code>t = (vᵧ + √(vᵧ² + 2gy₀))/g = ${fmt(p.flightTime)} s</code></p>`+
    `<p><b>3. Horizontal displacement (ideal motion)</b><br><code>Δx = vₓt = ${fmt(p.vx)} × ${fmt(p.flightTime)} = ${fmt(p.range)} m</code><br><code>aₓ = 0 m/s²; vₓ(final) = ${fmt(p.finalVx)} m/s</code></p>`+
    `<p><b>4. Maximum height</b><br><code>H = y₀ + vᵧ²/(2g) = ${fmt(p.maxHeight)} m</code></p>`+
    `<p><b>5. Acceleration and final velocity</b><br><code>aₓ = 0 m/s²; aᵧ = −9.81 m/s²</code><br><code>vₓ(final) = ${fmt(p.finalVx)} m/s; vᵧ(final) = ${fmt(p.finalVy)} m/s</code><br><code>|v(final)| = ${fmt(p.finalSpeed)} m/s</code></p>`+
    `<p><b>6. Target error</b><br><code>|${fmt(p.range)} − ${targetDistance()}| = ${fmt(Math.abs(p.range-targetDistance()))} m</code></p>`;
}
function resizeCanvas() {
  const rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.round(rect.width*dpr)); canvas.height=Math.max(1,Math.round(rect.height*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0); drawField(lastResult);
}
function drawBuilding(x, baseY, width, height, style=0) {
  ctx.fillStyle = ['#8da8c9','#a5b8d0','#6f8eb7','#bdc9dc'][style%4];
  ctx.fillRect(x,baseY-height,width,height);
  ctx.fillStyle = '#dce9f8';
  const cols=Math.max(2,Math.floor(width/12));
  for(let c=0;c<cols;c++) for(let y=baseY-height+9;y<baseY-7;y+=15) {
    ctx.fillRect(x+5+c*10,y,4,6);
  }
  if(style===2){ctx.fillStyle='#607da8';ctx.beginPath();ctx.moveTo(x-3,baseY-height);ctx.lineTo(x+width/2,baseY-height-10);ctx.lineTo(x+width+3,baseY-height);ctx.fill();}
}
function drawField(p, fraction=1) {
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  ctx.clearRect(0,0,w,h);
  // Olympic stadium backdrop: open sky, floodlights, packed grandstands and running track
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#6ab4e8');sky.addColorStop(.48,'#c9e9f8');sky.addColorStop(1,'#f0f8ff');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  // Sun glow and soft clouds
  const glow=ctx.createRadialGradient(w*.78,42,2,w*.78,42,70);glow.addColorStop(0,'#fff9d8cc');glow.addColorStop(1,'#fff9d800');ctx.fillStyle=glow;ctx.fillRect(w*.78-70,-28,140,140);
  ctx.fillStyle='#fff3bf';ctx.beginPath();ctx.arc(w*.78,42,17,0,Math.PI*2);ctx.fill();
  for(const [cx,cy,sc] of [[w*.19,43,1],[w*.46,66,.7],[w*.91,78,.75]]){ctx.fillStyle='#ffffffb8';ctx.beginPath();ctx.ellipse(cx,cy,27*sc,8*sc,0,0,Math.PI*2);ctx.ellipse(cx-12*sc,cy-5*sc,13*sc,10*sc,0,0,Math.PI*2);ctx.ellipse(cx+7*sc,cy-7*sc,17*sc,12*sc,0,0,Math.PI*2);ctx.fill();}
  const padL=44,padR=20,padT=35,groundY=h-48,plotW=w-padL-padR,plotH=groundY-padT;
  const target=targetDistance(), range=p?p.range:getPhysics().range;
  const maxX=Math.max(target*1.22,range*1.15,35), maxH=Math.max(p?p.maxHeight*1.28:24,10);
  const xToPx=x=>padL+x/maxX*plotW, yToPx=y=>groundY-y/maxH*plotH;
  // Huge stadium bowl behind the throwing sector
  ctx.fillStyle='#24456f';ctx.beginPath();ctx.moveTo(0,groundY-8);ctx.lineTo(0,groundY-88);ctx.quadraticCurveTo(w*.25,groundY-39,w*.48,groundY-68);ctx.quadraticCurveTo(w*.73,groundY-104,w,groundY-72);ctx.lineTo(w,groundY-8);ctx.closePath();ctx.fill();
  // Tiered seating bands with Olympic-inspired colors
  const bandColors=['#d94f50','#f3c64e','#e8f2fb','#318bba','#42b89a'];
  for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(0,groundY-17-i*12);ctx.quadraticCurveTo(w*.25,groundY-51-i*9,w*.49,groundY-31-i*12);ctx.quadraticCurveTo(w*.75,groundY-77-i*9,w,groundY-37-i*12);ctx.strokeStyle=bandColors[i];ctx.lineWidth=7;ctx.stroke();}
  // Tiny crowd silhouettes create a busy Olympic final atmosphere
  for(let i=0;i<190;i++){const x=(i/190)*w;const curve=groundY-36-18*Math.sin((x/w)*Math.PI)-13*Math.sin((x/w)*Math.PI*2);const y=curve-(i%3)*3;ctx.fillStyle=['#f8e8c2','#e8f4ff','#24344f','#f4a99a','#65d0c0'][i%5];ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();}
  // Stadium floodlight towers
  for(const lx of [padL+18,w-padR-18]){ctx.strokeStyle='#eaf6ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(lx,groundY-86);ctx.lineTo(lx,groundY-137);ctx.stroke();ctx.fillStyle='#f7fbff';ctx.fillRect(lx-12,groundY-143,24,8);for(let j=0;j<5;j++){ctx.fillStyle='#fff7c7';ctx.fillRect(lx-9+j*4,groundY-141,2,3);}}
  // Grid and distance markers
  ctx.font='10px DM Sans, sans-serif';ctx.textAlign='center';
  for(let d=0;d<=maxX;d+=10){const x=xToPx(d);ctx.strokeStyle='#567da51c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,padT);ctx.lineTo(x,groundY);ctx.stroke();ctx.fillStyle='#526b8a';ctx.fillText(`${d}m`,x,groundY+19);}
  // Track surface
  ctx.fillStyle='#b9e0d0';ctx.fillRect(padL,groundY,plotW,h-groundY);ctx.fillStyle='#70bca5';ctx.fillRect(padL,groundY+7,plotW,h-groundY-7);
  ctx.fillStyle='#3c947c';ctx.fillRect(padL,groundY,plotW,3);
  // Target distance zone plus a javelin-style bullseye landing marker
  const tx=xToPx(target), zone=Math.max(2,target*.05), zx=xToPx(Math.max(0,target-zone)), zw=Math.max(4,xToPx(target+zone)-zx);
  ctx.fillStyle='#ffd65a30';ctx.fillRect(zx,padT,zw,groundY-padT);
  ctx.strokeStyle='#ffe28a';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(tx,padT);ctx.lineTo(tx,groundY);ctx.stroke();ctx.setLineDash([]);
  // Perspective target rings placed directly on the field at the mission distance
  const targetY=groundY-2, ringRx=Math.max(13,Math.min(25,plotW*.027)), ringRy=8;
  ctx.save();ctx.translate(tx,targetY);
  ctx.fillStyle='#f8fbff';ctx.beginPath();ctx.ellipse(0,0,ringRx+8,ringRy+5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e34b4b';ctx.beginPath();ctx.ellipse(0,0,ringRx+5,ringRy+3,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f8fbff';ctx.beginPath();ctx.ellipse(0,0,ringRx,ringRy,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e34b4b';ctx.beginPath();ctx.ellipse(0,0,ringRx*.66,ringRy*.66,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffd65a';ctx.beginPath();ctx.ellipse(0,0,ringRx*.32,ringRy*.32,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#17345e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-ringRx-11,0);ctx.lineTo(ringRx+11,0);ctx.moveTo(0,-ringRy-8);ctx.lineTo(0,ringRy+8);ctx.stroke();ctx.restore();
  // Javelin silhouette above the target and label
  ctx.save();ctx.translate(tx,Math.max(padT+12,groundY-43));ctx.rotate(-.14);ctx.strokeStyle='#f8fbff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(14,0);ctx.stroke();ctx.fillStyle='#f8fbff';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(10,-4);ctx.lineTo(10,4);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle='#102c4c';ctx.font='bold 10px DM Sans';ctx.textAlign='center';ctx.fillText(`🎯 TARGET ${target} m`,Math.max(58,Math.min(w-62,tx)),Math.max(12,groundY-59));
  // Thrower: use the user's classical javelin motion-study image as the athlete sprite.
  const sx=padL+7,sy=groundY;
  if(throwerImage.complete && throwerImage.naturalWidth){
    ctx.save();ctx.globalAlpha=0.98;
    // First pose is the ready-to-throw stance; crop away the other sequence poses.
    ctx.drawImage(throwerImage,0,150,500,590,sx-12,sy-126,108,126);
    ctx.restore();
  } else {
    ctx.strokeStyle='#17345e';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(sx,sy-5);ctx.lineTo(sx+4,sy-24);ctx.lineTo(sx+16,sy-34);ctx.moveTo(sx+4,sy-24);ctx.lineTo(sx-4,sy-10);ctx.moveTo(sx+4,sy-24);ctx.lineTo(sx+17,sy-14);ctx.stroke();ctx.fillStyle='#17345e';ctx.beginPath();ctx.arc(sx+4,sy-34,5,0,Math.PI*2);ctx.fill();
  }
  if(!p){ctx.fillStyle='#28476f';ctx.textAlign='left';ctx.font='bold 12px DM Sans';ctx.fillText('OLYMPIC JAVELIN FINAL • READY',padL+16,padT+20);return;}
  const pts=[],steps=120;for(let i=0;i<=steps;i++){const t=p.flightTime*i/steps,x=p.vx*t,y=Math.max(0,p.vy*t-.5*GRAVITY*t*t);pts.push({x:xToPx(x),y:yToPx(y),t});}
  const visible=Math.max(2,Math.floor(pts.length*fraction));
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<visible;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.strokeStyle='#214fe0';ctx.lineWidth=3;ctx.lineCap='round';ctx.stroke();
  // Apex indicator and height line
  const apexX=p.range/2, apexY=p.maxHeight, ax=xToPx(apexX), ay=yToPx(apexY);
  ctx.strokeStyle='#20a99e';ctx.setLineDash([3,4]);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax,groundY);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#087f78';ctx.beginPath();ctx.arc(ax,ay,4,0,Math.PI*2);ctx.fill();ctx.textAlign='center';ctx.font='bold 10px DM Sans';ctx.fillText(`APEX ${fmt(p.maxHeight)}m`,Math.max(45,Math.min(w-48,ax)),Math.max(13,ay-10));
  // Launch angle guide
  const angle=p.angleDeg*Math.PI/180, guide=32;ctx.strokeStyle='#ed775e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx+13,sy-25);ctx.lineTo(sx+13+guide*Math.cos(angle),sy-25-guide*Math.sin(angle));ctx.stroke();ctx.beginPath();ctx.arc(sx+13,sy-25,16,-angle,0);ctx.stroke();ctx.fillStyle='#b94d37';ctx.font='bold 10px DM Sans';ctx.fillText(`${p.angleDeg}°`,sx+35,sy-38);
  // Landing marker and measured range
  const lx=xToPx(p.range);ctx.fillStyle='#214fe0';ctx.beginPath();ctx.arc(lx,groundY,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#214fe0';ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(sx+20,groundY+5);ctx.lineTo(lx,groundY+5);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#163ba9';ctx.font='bold 11px DM Sans';ctx.fillText(`${fmt(p.range)} m`,Math.max(padL+27,Math.min(w-padR-25,lx)),groundY-12);
  // Draw the javelin at the current animation point
  const point=pts[Math.min(visible-1,pts.length-1)], prev=pts[Math.max(0,Math.min(visible-2,pts.length-2))], a=Math.atan2(point.y-prev.y,point.x-prev.x);
  ctx.save();ctx.translate(point.x,point.y);ctx.rotate(a);ctx.strokeStyle='#d64d38';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-16,0);ctx.lineTo(15,0);ctx.stroke();ctx.fillStyle='#d64d38';ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(8,-4);ctx.lineTo(8,4);ctx.closePath();ctx.fill();ctx.restore();
}
function throwJavelin() {
  if(animationFrame)cancelAnimationFrame(animationFrame);
  const p=getPhysics(),target=targetDistance(),margin=Math.max(2,target*.05),error=Math.abs(p.range-target),hit=error<=margin;
  lastResult=p;attempts++;best=Math.max(best,p.range);
  if(hit){hits++;points+=100;if(!cleared.has(currentLevel)){cleared.add(currentLevel);unlockedLevel=Math.max(unlockedLevel,Math.min(levels.length-1,currentLevel+1));}}
  else if(p.range>=target*.9)points+=25;
  el('attempts').textContent=attempts;el('hits').textContent=hits;el('best').textContent=fmt(best);el('points').textContent=points;el('distance').textContent=fmt(p.range);
  if(hit){el('status').textContent='🎯 LEVEL CLEARED!';el('resultMessage').textContent=`Perfect! ${fmt(p.range)} m is within ±${fmt(margin)} m of the ${target} m target. +100 points! ${currentLevel===levels.length-1?'You conquered every level!':'Next level unlocked!'}`;}
  else if(p.range<target){el('status').textContent='THROW COMPLETE';el('resultMessage').textContent=`${fmt(target-p.range)} m short. Try a higher speed or adjust the launch angle.`;}
  else{el('status').textContent='THROW COMPLETE';el('resultMessage').textContent=`Overshot by ${fmt(p.range-target)} m. Reduce speed or adjust the angle.`;}
  el('progressBar').style.width=`${Math.min(100,p.range/target*100)}%`;updatePhysicsDisplay(p);renderLevels();
  let start=null;function animate(ts){if(!start)start=ts;const f=Math.min(1,(ts-start)/800);drawField(p,f);if(f<1)animationFrame=requestAnimationFrame(animate);else animationFrame=null;}animationFrame=requestAnimationFrame(animate);
}
function resetGame(){if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=null;lastResult=null;attempts=hits=points=best=0;unlockedLevel=0;currentLevel=0;cleared.clear();['attempts','hits','points'].forEach(id=>el(id).textContent='0');el('best').textContent='0.00';el('distance').textContent='—';el('resultMessage').textContent='Choose your angle and speed, then throw!';el('progressBar').style.width='0%';el('status').textContent='READY TO THROW';['initialV','vx','vy','flightTime','finalV','dx','maxHeight','finalVy','targetError'].forEach(id=>el(id).textContent='—');el('dy').textContent='0.00 m';el('working').textContent='Throw once to see the calculations.';el('targetLabel').textContent=targetDistance();el('targetProgress').textContent=`Target: ${targetDistance()} m`;el('missionName').textContent=`Level 1 · ${levels[0].name}`;renderLevels();drawField(null);}
function updateControls(){el('angleValue').textContent=angleInput.value;el('speedValue').textContent=speedInput.value;el('releaseHeightValue').textContent=Number(releaseHeightInput.value).toFixed(1);if(lastResult)updatePhysicsDisplay(lastResult);drawField(lastResult);}
angleInput.max='90';angleInput.addEventListener('input',updateControls);speedInput.addEventListener('input',updateControls);releaseHeightInput.addEventListener('input',updateControls);el('throwBtn').addEventListener('click',throwJavelin);el('resetBtn').addEventListener('click',resetGame);window.addEventListener('resize',resizeCanvas);
renderLevels();resizeCanvas();updateControls();
