/* =====================================================================
   2-render.js · 渲染
   边陲 v1.5 · 模块化拆分（原单文件第 2 部分）
   ===================================================================== */

/* =====================================================================
   5 · 相机与画布
   ===================================================================== */
const cv = $('cv'), ctx = cv.getContext('2d');
let vw = 0, vh = 0, dpr = 1;
function resize(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = window.innerWidth; vh = window.innerHeight;
  cv.width = Math.round(vw*dpr); cv.height = Math.round(vh*dpr);
  cv.style.width = vw+'px'; cv.style.height = vh+'px';
  /* 暗角：一次生成，逐帧复用 */
  vigGrad = cv.getContext('2d').createRadialGradient(
    vw/2, vh/2, Math.min(vw,vh)*0.42,
    vw/2, vh/2, Math.max(vw,vh)*0.78
  );
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, 'rgba(0,0,0,.42)');
}
window.addEventListener('resize', resize);

function clampCam(){
  const maxZ = 2.0, minZ = Math.max(0.42, Math.min(vw/(W*TS), vh/(H*TS)) * 0.98);
  cam.z = clamp(cam.z, minZ, maxZ);
  const halfW = vw/2/cam.z, halfH = vh/2/cam.z;
  const mW = W*TS, mH = H*TS;
  if(mW < halfW*2) cam.cx = mW/2;
  else cam.cx = clamp(cam.cx, halfW - 40, mW - halfW + 40);
  if(mH < halfH*2) cam.cy = mH/2;
  else cam.cy = clamp(cam.cy, halfH - 40, mH - halfH + 40);
}
function screenToWorld(sx,sy){ return { x:(sx - vw/2)/cam.z + cam.cx, y:(sy - vh/2)/cam.z + cam.cy }; }
/* v1.9 框选用：把世界坐标换回屏幕坐标 */
function worldToScreen(wx,wy){ return { x:(wx - cam.cx)*cam.z + vw/2, y:(wy - cam.cy)*cam.z + vh/2 }; }
function worldToTile(wx,wy){ return { x:Math.floor(wx/TS), y:Math.floor(wy/TS) }; }
function centerOn(tx,ty){ cam.cx = (tx+0.5)*TS; cam.cy = (ty+0.5)*TS; }

/* =====================================================================
   6 · 渲染
   ===================================================================== */
function hash2(x,y){
  let n = x*374761393 + y*668265263;
  n = (n ^ (n>>>13)) * 1274126177;
  return ((n ^ (n>>>16)) >>> 0) / 4294967296;
}
function isNight(){
  const h = (state.min % 1440) / 60;
  return h < 6.2 || h > 19.4;
}
function darkness(){
  const h = (state.min % 1440) / 60;
  if(h >= 7 && h <= 18) return 0;
  if(h > 18 && h < 20) return (h-18)/2 * 0.55;
  if(h > 4 && h < 7)  return (7-h)/3 * 0.55;
  return 0.55;
}

/* =====================================================================
   6.1 · 地形烘焙
   静态地表一次性画进离屏画布：每帧只做 1 次 drawImage，
   省下的算力全部换成细节（软过渡 / 崖壁明暗 / 水景深度 / 胶片颗粒）。
   ===================================================================== */
const BAKE_S = 1.6;                        // 烘焙倍率（放大时仍然清晰）
let terrCv = null, terrCtx = null, miniCv = null, grainCv = null;
let glowWarm = null, glowCool = null, vigGrad = null;

function makeGrainCanvas(){
  const n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  for(let i=0;i<n*n;i++){
    const lum = Math.random() > 0.5 ? 255 : 0;
    img.data[i*4] = lum; img.data[i*4+1] = lum; img.data[i*4+2] = lum;
    img.data[i*4+3] = Math.random()*22;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function makeGlowCanvas(rgb){
  const n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(n/2, n/2, 0, n/2, n/2, n/2);
  grd.addColorStop(0,    `rgba(${rgb},.55)`);
  grd.addColorStop(0.35, `rgba(${rgb},.22)`);
  grd.addColorStop(1,    `rgba(${rgb},0)`);
  g.fillStyle = grd; g.fillRect(0,0,n,n);
  return c;
}

/* 单格基色：高程 + 方向光浮雕 + 湿度色偏，水体按深度渐变 */
function tileBaseColor(t, x, y){
  const pal = PAL[t.g];
  if(t.g === T.WATER){
    /* 水格底色画成湿泥滩：水面由 paintWaterField 的连续场覆盖，
       岸线扰动出来的"退水区"就会露出湿泥沙，而不是蓝方块 */
    const w = clamp((t.depth === undefined ? 0.3 : t.depth), 0, 1);
    return mixRGB(hexRGB('#8f886c'), hexRGB('#586b58'), 0.30 + w*0.5);
  }
  let lit = (t.h - 0.50) * 1.45;
  if(x !== undefined && y !== undefined){
    const nw = tileAt(x-1,y-1), n = tileAt(x,y-1), w = tileAt(x-1,y);
    const se = tileAt(x+1,y+1), s = tileAt(x,y+1), e = tileAt(x+1,y);
    const h0 = t.h;
    /* 光从西北来：西北高则亮，东南高则暗 */
    lit += ((nw?nw.h:h0) + (n?n.h:h0)*0.7 + (w?w.h:h0)*0.7
          - (se?se.h:h0) - (s?s.h:h0)*0.7 - (e?e.h:h0)*0.7) * 2.2;
  }
  lit = clamp(lit, -1, 1);
  let col = lit >= 0
    ? mixRGB(hexRGB(pal.base), hexRGB(pal.hi), lit)
    : mixRGB(hexRGB(pal.base), hexRGB(pal.lo), -lit);
  if(t.g === T.GRASS || t.g === T.MEADOW || t.g === T.MARSH){
    const dry = clamp((0.52 - t.m) * 1.3, 0, 1);
    col = mixRGB(col, hexRGB('#9aa24c'), dry * 0.32);
    const wet = clamp((t.m - 0.62) * 1.6, 0, 1);
    col = mixRGB(col, hexRGB('#3f6f38'), wet * 0.28);
  }
  /* 冬临：积雪压住草色，只留地貌的明暗关系 */
  if(isWinter()) col = mixRGB(col, hexRGB(PAL_SNOW[t.g] || '#cfd8d2'), 0.74);
  return col;
}

function bakeTerrain(){
  const __b0 = performance.now();
  const S = BAKE_S, p = TS;
  terrCv = document.createElement('canvas');
  terrCv.width  = Math.round(W*TS*S);
  terrCv.height = Math.round(H*TS*S);
  const c = terrCv.getContext('2d');
  c.setTransform(S, 0, 0, S, 0, 0);
  c.lineJoin = 'round'; c.lineCap = 'round';

  paintBases(c);
  paintWaterField(c);
  paintTransitions(c);
  paintGroundDetail(c);
  paintWaterCaustics(c);
  paintCliffs(c);
  paintAO(c);

  /* 全局颗粒：打散纯色块，画面更像手绘 */
  if(!grainCv) grainCv = makeGrainCanvas();
  const pat = c.createPattern(grainCv, 'repeat');
  if(pat){ c.globalAlpha = 0.30; c.fillStyle = pat; c.fillRect(0,0,W*TS,H*TS); c.globalAlpha = 1; }

  /* 大尺度脏迹：让整片草地有明暗节奏 */
  const TONES = ['rgba(12,30,10,1)','rgba(255,246,196,1)','rgba(60,96,44,1)','rgba(150,168,92,1)'];
  for(let i=0;i<260;i++){
    const bx = hash2(i*7, i*13)*W*TS, by = hash2(i*17, i*5)*H*TS;
    const r = (0.5 + hash2(i*3,i*11)*3.4)*TS;
    const grd = c.createRadialGradient(bx, by, 0, bx, by, r);
    const col = TONES[i % TONES.length];
    grd.addColorStop(0, col.replace('1)', (0.035 + hash2(i,i*2)*0.045).toFixed(3) + ')'));
    grd.addColorStop(1, col.replace('1)', '0)'));
    c.fillStyle = grd;
    c.beginPath(); c.arc(bx, by, r, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;

  terrCtx = c;
  buildMini();
  window.__bakeMs = Math.round(performance.now() - __b0);
}

/* 挖穿一格后局部重绘（3×3 足够覆盖软过渡的溢色） */
function repaintTile(tx, ty){
  if(!terrCtx) return;
  const c = terrCtx, p = TS;
  const x0 = Math.max(0, tx-1), y0 = Math.max(0, ty-1);
  const x1 = Math.min(W-1, tx+1), y1 = Math.min(H-1, ty+1);
  c.save();
  c.beginPath();
  c.rect(x0*p, y0*p, (x1-x0+1)*p, (y1-y0+1)*p);
  c.clip();
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    c.fillStyle = cssRGB(tileBaseColor(tiles[y*W+x], x, y));
    c.fillRect(x*p, y*p, p+0.6, p+0.6);
  }
  paintTransitions(c, x0, y0, x1, y1);
  paintGroundDetail(c, x0, y0, x1, y1);
  paintCliffs(c, x0, y0, x1, y1);
  paintAO(c, x0, y0, x1, y1);
  c.restore();
  buildMini();
}

function paintBases(c){
  const p = TS;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    c.fillStyle = cssRGB(tileBaseColor(tiles[y*W+x], x, y));
    c.fillRect(x*p, y*p, p+0.6, p+0.6);
  }
}

/* 生物群系交界：两侧互相撒斑点，把方格打散成自然过渡带 */
/* ---- 水面：有符号距离场 + 噪声扰动，逐像素求值后上采样 ----
   这样岸线是连续的曲线（不再是格子台阶），水深也是连续渐变（不再是同心环）。 */
let _wNoise = null;
function paintWaterField(c){
  const p = TS;
  if(!_wNoise) _wNoise = makeNoise(9031);
  const N4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const INF = 1e9;
  const f = new Float32Array(W*H).fill(INF);
  let minX = W, minY = H, maxX = -1, maxY = -1;
  let any = false;

  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(tiles[y*W+x].g !== T.WATER) continue;
    any = true;
    if(x<minX) minX = x; if(x>maxX) maxX = x;
    if(y<minY) minY = y; if(y>maxY) maxY = y;
  }
  if(!any) return;

  /* 1. 水侧：从岸边向内 BFS，值 = 0.5 + 离岸格数 */
  const q = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i = y*W+x;
    if(tiles[i].g !== T.WATER) continue;
    for(const [dx,dy] of N4){
      const n = tileAt(x+dx, y+dy);
      if(!n || n.g !== T.WATER){ f[i] = 0.5; q.push(i); break; }
    }
  }
  for(let qi=0; qi<q.length; qi++){
    const i = q[qi], x = i % W, y = (i/W)|0;
    for(const [dx,dy] of N4){
      const nx = x+dx, ny = y+dy;
      if(nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni = ny*W+nx;
      if(tiles[ni].g !== T.WATER || f[ni] <= f[i]+1) continue;
      f[ni] = f[i]+1; q.push(ni);
    }
  }
  /* 2. 陆侧：岸边 -0.5，向外三格逐级减到 -3.5 */
  const q2 = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i = y*W+x;
    if(tiles[i].g === T.WATER) continue;
    for(const [dx,dy] of N4){
      const n = tileAt(x+dx, y+dy);
      if(n && n.g === T.WATER){ f[i] = -0.5; q2.push(i); break; }
    }
  }
  for(let qi=0; qi<q2.length; qi++){
    const i = q2[qi], x = i % W, y = (i/W)|0;
    if(f[i] <= -3.0) continue;
    for(const [dx,dy] of N4){
      const nx = x+dx, ny = y+dy;
      if(nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni = ny*W+nx;
      if(tiles[ni].g === T.WATER || f[ni] < INF) continue;
      f[ni] = f[i] - 1; q2.push(ni);
    }
  }
  for(let i=0;i<W*H;i++) if(f[i] > 1e8) f[i] = -4;

  /* 2.5 真实水深：湖底越低越深，河道/浅滩自然区分开 */
  const eh = new Float32Array(W*H);
  for(let i=0;i<W*H;i++){
    const t = tiles[i];
    if(t.g === T.WATER) eh[i] = clamp((0.335 - t.h) / 0.075, 0, 1);
  }

  /* 3. 逐像素：双线性取距离场，叠 fbm 扰动破掉圆形轮廓 */
  const SC = 0.34;
  const bx0 = Math.max(0, (minX-2)*p), by0 = Math.max(0, (minY-2)*p);
  const bx1 = Math.min(W*p, (maxX+3)*p), by1 = Math.min(H*p, (maxY+3)*p);
  const bw = bx1-bx0, bh = by1-by0;
  const tw = Math.max(2, Math.ceil(bw*SC)), th = Math.max(2, Math.ceil(bh*SC));

  const tmp = document.createElement('canvas');
  tmp.width = tw; tmp.height = th;
  const tg = tmp.getContext('2d');
  const img = tg.createImageData(tw, th);
  const D = img.data;

  const C1 = hexRGB('#a8e2de'), C2 = hexRGB('#4fa7bf'),
        C3 = hexRGB('#22688a'), C4 = hexRGB('#11384f');

  const bilerp = (arr, tx, ty) => {
    const gx = clamp(tx, 0, W-1.0001), gy = clamp(ty, 0, H-1.0001);
    const ix = gx|0, iy = gy|0, fx = gx-ix, fy = gy-iy;
    const x2 = Math.min(W-1, ix+1), y2 = Math.min(H-1, iy+1);
    const a = arr[iy*W+ix], b = arr[iy*W+x2], cc = arr[y2*W+ix], d = arr[y2*W+x2];
    return (a*(1-fx)+b*fx)*(1-fy) + (cc*(1-fx)+d*fx)*fy;
  };

  /* 噪声预烘焙到 1/4 格网格：逐像素只做双线性采样，避免每点算 fbm */
  const GS = 4, GW = W*GS, GH = H*GS;
  const wobA = new Float32Array(GW*GH), glA = new Float32Array(GW*GH);
  for(let gy=0; gy<GH; gy++){
    const wy = (gy + 0.5)/GS * p;
    for(let gx=0; gx<GW; gx++){
      const wx = (gx + 0.5)/GS * p;
      wobA[gy*GW+gx] = (fbm(_wNoise, wx/(p*8.5), wy/(p*8.5), 3, 0.54) - 0.5) * 0.70
                     + (fbm(_wNoise, wx/(p*2.6)+23, wy/(p*2.6)+13, 2, 0.5) - 0.5) * 0.22;
      glA[gy*GW+gx]  = fbm(_wNoise, wx/(p*1.6)+11, wy/(p*1.6)+7, 2, 0.5);
    }
  }
  const bilerpG = (arr, gx, gy) => {
    const cx0 = Math.min(GW-1.001, Math.max(0, gx)), cy0 = Math.min(GH-1.001, Math.max(0, gy));
    const ix = cx0|0, iy = cy0|0, fx = cx0-ix, fy = cy0-iy;
    const x2 = Math.min(GW-1, ix+1), y2 = Math.min(GH-1, iy+1);
    const a = arr[iy*GW+ix], b = arr[iy*GW+x2], cc = arr[y2*GW+ix], d = arr[y2*GW+x2];
    return (a*(1-fx)+b*fx)*(1-fy) + (cc*(1-fx)+d*fx)*fy;
  };

  for(let py=0; py<th; py++){
    const wy = by0 + (py+0.5)/SC;
    const ty = wy/p - 0.5;
    for(let px=0; px<tw; px++){
      const wx = bx0 + (px+0.5)/SC;
      const tx = wx/p - 0.5;

      const base = bilerp(f, tx, ty);
      if(base < -1.3){ continue; }              // 远离水体，留空
      const gsx = wx/p*GS - 0.5, gsy = wy/p*GS - 0.5;
      const wob = bilerpG(wobA, gsx, gsy);
      const dp = bilerp(eh, tx, ty);
      const s = base + wob + dp*3.0;            // s>0 = 水
      if(s < -0.55) continue;

      const d = clamp(Math.sqrt(s/8.4), 0, 1);
      let col;
      if(d < 0.16)      col = mixRGB(C1, C2, d/0.16);
      else if(d < 0.52) col = mixRGB(C2, C3, (d-0.16)/0.36);
      else              col = mixRGB(C3, C4, (d-0.52)/0.48);

      /* 岸线：内侧一道浪花，外侧一圈湿泥 */
      if(s < 0.30 && s > 0){
        col = mixRGB(col, hexRGB('#eafcff'), 0.16*(1 - s/0.30));
      }
      /* 水面微光：低频扰动，不做逐格噪点 */
      const gl = bilerpG(glA, gsx, gsy);
      const br = 1 + (gl-0.5)*0.09;
      let a;
      if(s < 0){
        col = hexRGB('#3b4733');                 // 湿泥带：让岸线"贴地"
        a = 0.60*clamp(1 + s/0.62, 0, 1);
      } else {
        a = clamp(s/0.35 + 0.55, 0, 1);
      }
      /* 冬临：水面偏冷、发白，像结了薄冰 */
      if(isWinter()) col = mixRGB(col, hexRGB('#bfe0e8'), 0.40);
      const o = (py*tw + px)*4;
      D[o]   = Math.min(255, col[0]*br);
      D[o+1] = Math.min(255, col[1]*br);
      D[o+2] = Math.min(255, col[2]*br);
      D[o+3] = a*255;
    }
  }
  tg.putImageData(img, 0, 0);

  c.save();
  c.imageSmoothingEnabled = true;
  try{ c.imageSmoothingQuality = 'high'; }catch(e){}
  c.drawImage(tmp, bx0, by0, bw, bh);
  c.restore();
}

function paintTransitions(c, x0, y0, x1, y1){
  const p = TS;
  x0 = x0===undefined ? 0 : x0; y0 = y0===undefined ? 0 : y0;
  x1 = x1===undefined ? W-1 : x1; y1 = y1===undefined ? H-1 : y1;
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x], px = x*p, py = y*p;
    if(t.g === T.ROCK) continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const n = tileAt(x+dx, y+dy);
      if(!n || n.g === t.g || n.g === T.ROCK) continue;
      if(t.g === T.WATER && n.g !== T.WATER) continue;   // 水陆交界交给浪花
      const col = hexRGB(PAL[n.g].base);
      for(let i=0;i<4;i++){
        const k1 = hash2(x*31 + i*7 + dx*13, y*17 + i*11 + dy*7);
        const k2 = hash2(x*7 + i*3, y*5 + i*9);
        const along = 0.10 + k1*0.80;
        const out   = -0.02 + k2*0.17;
        const ex = dx !== 0 ? px + p*(dx>0 ? 1-out : out) : px + p*along;
        const ey = dy !== 0 ? py + p*(dy>0 ? 1-out : out) : py + p*along;
        c.globalAlpha = 0.15 + k1*0.22;
        c.fillStyle = cssRGB(col);
        c.beginPath(); c.arc(ex, ey, p*(0.15 + k2*0.20), 0, TAU); c.fill();
      }
    }
  }
  c.globalAlpha = 1;
}

function paintGroundDetail(c, x0, y0, x1, y1){
  const p = TS;
  x0 = x0===undefined ? 0 : x0; y0 = y0===undefined ? 0 : y0;
  x1 = x1===undefined ? W-1 : x1; y1 = y1===undefined ? H-1 : y1;
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x], px = x*p, py = y*p;
    const hs = hash2(x, y);
    if(t.g === T.WATER){
      /* 水面细节交给独立的有机光斑层，避免逐格重复图案 */
      continue;
    }
    if(t.g === T.ROCK) continue;

    if(t.g === T.GRASS || t.g === T.MEADOW){
      /* 深色草斑 + 草叶 */
      if(hs > 0.55){
        c.fillStyle = 'rgba(40,72,32,.10)';
        c.beginPath();
        c.ellipse(px + p*(0.25 + hs*0.5), py + p*(0.3 + hash2(x+1,y+2)*0.5),
                  p*(0.18 + hash2(x,y+3)*0.16), p*(0.12 + hash2(x+4,y)*0.12), hs*TAU, 0, TAU);
        c.fill();
      }
      c.strokeStyle = t.g === T.MEADOW ? 'rgba(68,102,44,.26)' : 'rgba(58,90,38,.24)';
      c.lineWidth = Math.max(1, p*0.034);
      c.beginPath();
      const n = 3 + Math.floor(hs*5);
      for(let i=0;i<n;i++){
        const bx = px + p*(0.08 + hash2(x*5+i, y*3+i)*0.84);
        const by = py + p*(0.42 + hash2(x*7+i, y*11+i)*0.48);
        c.moveTo(bx, by);
        c.lineTo(bx + (hash2(x+i,y+i)-0.5)*p*0.10, by - p*(0.07 + hash2(x*2+i,y*2+i)*0.09));
      }
      c.stroke();
    } else if(t.g === T.SAND){
      c.strokeStyle = 'rgba(160,136,96,.20)';
      c.lineWidth = Math.max(1, p*0.028);
      for(let i=0;i<2;i++){
        const yy = py + p*(0.30 + i*0.34 + hs*0.1);
        c.beginPath();
        c.moveTo(px + p*0.10, yy);
        c.quadraticCurveTo(px + p*0.50, yy - p*0.06, px + p*0.90, yy);
        c.stroke();
      }
    } else if(t.g === T.GRAVEL){
      for(let i=0;i<4;i++){
        const k = hash2(x*11+i, y*13+i);
        const gx = px + p*(0.14 + k*0.70), gy = py + p*(0.14 + hash2(x*3+i,y*7+i)*0.70);
        c.fillStyle = k > 0.5 ? 'rgba(214,210,202,.50)' : 'rgba(88,86,82,.42)';
        c.beginPath(); c.ellipse(gx, gy, p*(0.035+k*0.05), p*(0.026+k*0.036), k*3, 0, TAU); c.fill();
      }
    } else if(t.g === T.DIRT){
      c.fillStyle = 'rgba(96,78,55,.18)';
      c.beginPath(); c.ellipse(px+p*0.46, py+p*0.56, p*0.26, p*0.13, hs*3, 0, TAU); c.fill();
      if(hs > 0.70){
        c.fillStyle = 'rgba(192,174,142,.28)';
        c.beginPath(); c.arc(px+p*0.70, py+p*0.32, p*0.04, 0, TAU); c.fill();
      }
    } else if(t.g === T.MARSH){
      c.fillStyle = 'rgba(28,44,26,.20)';
      c.beginPath(); c.ellipse(px+p*0.50, py+p*0.60, p*0.30, p*0.16, hs*2, 0, TAU); c.fill();
      c.fillStyle = 'rgba(120,170,180,.15)';
      c.beginPath(); c.ellipse(px+p*0.30, py+p*0.34, p*0.14, p*0.06, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(96,120,66,.40)';
      c.lineWidth = Math.max(1, p*0.030);
      c.beginPath();
      for(let i=0;i<3;i++){
        const bx = px + p*(0.20 + i*0.28), by = py + p*(0.70 + hash2(x+i,y+i)*0.15);
        c.moveTo(bx, by); c.lineTo(bx + p*0.03, by - p*0.14);
      }
      c.stroke();
    }
  }
}

/* 水面光斑：跨格的有机亮斑，避免出现逐格重复的"瓷砖"图案 */
function paintWaterCaustics(c){
  const p = TS;
  let cnt = 0;
  c.save();
  c.beginPath();
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(tiles[y*W+x].g !== T.WATER) continue;
    c.rect(x*p, y*p, p, p);
    cnt++;
  }
  if(!cnt){ c.restore(); return; }
  c.clip();
  for(let i=0;i<520;i++){
    const x = Math.floor(hash2(i*3+1, i*7+5)*W);
    const y = Math.floor(hash2(i*11+2, i*13+7)*H);
    const k1 = hash2(i*5, i*11), k2 = hash2(i*13, i*17);
    const bx = (x + k1) * p, by = (y + k2) * p;
    const r = p*(0.5 + k2*1.5);
    const grd = c.createRadialGradient(bx, by, 0, bx, by, r);
    const light = k1 > 0.35;
    grd.addColorStop(0, light ? 'rgba(208,246,255,.11)' : 'rgba(6,26,42,.12)');
    grd.addColorStop(1, light ? 'rgba(208,246,255,0)' : 'rgba(6,26,42,0)');
    c.fillStyle = grd;
    c.beginPath(); c.arc(bx, by, r, 0, TAU); c.fill();
  }
  /* 长条水纹：低对比、随机长度 */
  c.lineCap = 'round';
  for(let i=0;i<170;i++){
    const x = hash2(i*7+3, i*5+9) * W * p;
    const y = hash2(i*11+5, i*3+1) * H * p;
    const len = p*(0.8 + hash2(i, i*2)*2.6);
    const alpha = 0.035 + hash2(i*2, i*3)*0.055;
    c.strokeStyle = 'rgba(214,248,255,' + alpha.toFixed(3) + ')';
    c.lineWidth = p*(0.03 + hash2(i*4, i)*0.04);
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + len*0.5, y - p*0.10, x + len, y);
    c.stroke();
  }
  c.restore();
}

/* 岩体：重叠巨石堆 + 碎石。比"方块台地"更耐看，边界天然不规则 */
function paintCliffs(c, x0, y0, x1, y1){
  const p = TS;
  x0 = x0===undefined ? 0 : x0; y0 = y0===undefined ? 0 : y0;
  x1 = x1===undefined ? W-1 : x1; y1 = y1===undefined ? H-1 : y1;
  const isR = q => q && q.g === T.ROCK;

  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x];
    if(t.g !== T.ROCK) continue;
    const px = x*p, py = y*p;
    const base = tileBaseColor(t, x, y);

    /* 岩基：压暗的碎石地 */
    c.fillStyle = cssRGB(mixRGB(base, hexRGB('#343941'), 0.58));
    c.fillRect(px, py, p+0.6, p+0.6);

    /* 碎石颗粒 */
    for(let i=0;i<5;i++){
      const k1 = hash2(x*17+i, y*23+i*3), k2 = hash2(x*29+i*2, y*13+i*5);
      c.globalAlpha = 0.22 + k1*0.22;
      c.fillStyle = k1 > 0.5 ? cssRGB(shadeRGB(base, 22)) : 'rgba(24,28,34,.55)';
      c.beginPath();
      c.ellipse(px + p*k1, py + p*k2, p*(0.02 + k2*0.03), p*(0.014 + k1*0.022), k1*3, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;

    /* 三块巨石：多边形切面着色（不是球状渐变），棱线分明 */
    for(let i=0;i<3;i++){
      const k1 = hash2(x*7 + i*3, y*11 + i*5);
      const k2 = hash2(x*5 + i*7, y*3 + i*11);
      const bx = px + p*(0.10 + k1*0.80);
      const by = py + p*(0.12 + k2*0.76);
      const r  = p*(0.28 + k1*0.26);
      const rot = (k2-0.5)*0.9;

      /* 投影 */
      c.fillStyle = 'rgba(10,14,18,.34)';
      c.beginPath(); c.ellipse(bx + p*0.07, by + r*0.80, r*1.06, r*0.40, 0, 0, TAU); c.fill();

      /* 石体轮廓：七边形，半径抖动 */
      const NP = 7, poly = [];
      for(let k=0;k<NP;k++){
        const a = rot + (k/NP)*TAU;
        const rr = r*(0.86 + hash2(x*31+k, y*17+k)*0.24);
        poly.push([bx + Math.cos(a)*rr, by + Math.sin(a)*rr*0.82]);
      }
      const gv = c.createLinearGradient(bx, by - r, bx, by + r);
      gv.addColorStop(0,   cssRGB(shadeRGB(base, 14)));
      gv.addColorStop(0.55, cssRGB(base));
      gv.addColorStop(1,   cssRGB(shadeRGB(base, -30)));
      c.fillStyle = gv;
      c.beginPath();
      c.moveTo(poly[0][0], poly[0][1]);
      for(let k=1;k<NP;k++) c.lineTo(poly[k][0], poly[k][1]);
      c.closePath(); c.fill();

      /* 亮面（左上） */
      c.fillStyle = cssRGB(shadeRGB(base, 20));
      c.beginPath();
      c.moveTo(bx - r*0.84, by - r*0.14);
      c.lineTo(bx - r*0.20, by - r*0.84);
      c.lineTo(bx + r*0.26, by - r*0.50);
      c.lineTo(bx - r*0.30, by + r*0.10);
      c.closePath(); c.fill();

      /* 暗面（右下） */
      c.fillStyle = cssRGB(shadeRGB(base, -34));
      c.beginPath();
      c.moveTo(bx + r*0.26, by - r*0.50);
      c.lineTo(bx + r*0.84, by + r*0.06);
      c.lineTo(bx + r*0.30, by + r*0.72);
      c.lineTo(bx - r*0.30, by + r*0.10);
      c.closePath(); c.fill();

      /* 棱线 */
      c.strokeStyle = 'rgba(16,20,26,.34)';
      c.lineWidth = Math.max(0.7, p*0.022);
      c.beginPath();
      c.moveTo(bx - r*0.84, by - r*0.14);
      c.lineTo(bx - r*0.30, by + r*0.10);
      c.lineTo(bx + r*0.30, by + r*0.72);
      c.moveTo(bx - r*0.30, by + r*0.10);
      c.lineTo(bx + r*0.26, by - r*0.50);
      c.stroke();

      /* 顶棱高光 */
      c.strokeStyle = 'rgba(255,255,255,.20)';
      c.lineWidth = Math.max(0.6, p*0.018);
      c.beginPath();
      c.moveTo(bx - r*0.82, by - r*0.16);
      c.lineTo(bx - r*0.20, by - r*0.82);
      c.lineTo(bx + r*0.24, by - r*0.48);
      c.stroke();
    }

    /* 靠下沿的苔藓，把巨石和草地接起来 */
    if(!isR(tileAt(x, y+1))){
      c.fillStyle = 'rgba(84,118,58,.22)';
      for(let i=0;i<2;i++){
        const k = hash2(x*13+i, y*7+i);
        c.beginPath();
        c.ellipse(px + p*(0.2 + k*0.6), py + p*0.92, p*(0.10 + k*0.10), p*0.045, 0, 0, TAU);
        c.fill();
      }
    }
  }
}

/* 环境光遮蔽：岩壁把阴影投到地面，水边压暗一圈 */
function paintAO(c, x0, y0, x1, y1){
  const p = TS;
  x0 = x0===undefined ? 0 : x0; y0 = y0===undefined ? 0 : y0;
  x1 = x1===undefined ? W-1 : x1; y1 = y1===undefined ? H-1 : y1;
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x];
    if(t.g === T.ROCK || t.g === T.WATER) continue;
    const px = x*p, py = y*p;
    const up = tileAt(x, y-1), lf = tileAt(x-1, y);
    if(up && up.g === T.ROCK){
      const g = c.createLinearGradient(0, py, 0, py + p*0.62);
      g.addColorStop(0, 'rgba(6,10,14,.44)');
      g.addColorStop(1, 'rgba(6,10,14,0)');
      c.fillStyle = g; c.fillRect(px, py, p, p*0.62);
    }
    if(lf && lf.g === T.ROCK){
      const g = c.createLinearGradient(px, 0, px + p*0.5, 0);
      g.addColorStop(0, 'rgba(6,10,14,.32)');
      g.addColorStop(1, 'rgba(6,10,14,0)');
      c.fillStyle = g; c.fillRect(px, py, p*0.5, p);
    }
    if(up && up.g === T.WATER){
      c.fillStyle = 'rgba(38,58,52,.12)';
      c.fillRect(px, py, p, p*0.22);
    }
    /* 其余三面靠水的湿润带 */
    const dn = tileAt(x, y+1), lf2 = tileAt(x-1, y), rt = tileAt(x+1, y);
    if(dn && dn.g === T.WATER){ c.fillStyle = 'rgba(46,66,58,.10)'; c.fillRect(px, py + p*0.80, p, p*0.21); }
    if(lf2 && lf2.g === T.WATER){ c.fillStyle = 'rgba(46,66,58,.10)'; c.fillRect(px, py, p*0.20, p); }
    if(rt && rt.g === T.WATER){ c.fillStyle = 'rgba(46,66,58,.10)'; c.fillRect(px + p*0.80, py, p*0.21, p); }
  }
}

/* 小地图底图 */
function buildMini(){
  const m = document.createElement('canvas');
  m.width = W; m.height = H;
  const g = m.getContext('2d');
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    g.fillStyle = t.g === T.WATER ? '#2f7fb0' : cssRGB(tileBaseColor(t, x, y));
    g.fillRect(x, y, 1, 1);
    if(t.plant && t.plant.kind === 'tree'){ g.fillStyle = 'rgba(32,62,32,.62)'; g.fillRect(x, y, 1, 1); }
  }
  miniCv = m;
}

function draw(now){
  /* 屏震：受击时整个画面短促抖动，避免"打架像默片" */
  let shx = 0, shy = 0;
  if(shakeT > 0){
    const k = shkAmp * (shakeT / Math.max(1, shkDur));
    shx = (Math.random()*2 - 1) * k;
    shy = (Math.random()*2 - 1) * k;
  }
  ctx.setTransform(dpr,0,0,dpr, shx*dpr, shy*dpr);
  ctx.fillStyle = '#0d1116';
  ctx.fillRect(0,0,vw,vh);

  const z = cam.z, pts = TS*z;
  const ox = -cam.cx*z + vw/2, oy = -cam.cy*z + vh/2;
  const x0 = Math.max(0, Math.floor((cam.cx - vw/2/z)/TS));
  const x1 = Math.min(W-1, Math.ceil((cam.cx + vw/2/z)/TS));
  const y0 = Math.max(0, Math.floor((cam.cy - vh/2/z)/TS));
  const y1 = Math.min(H-1, Math.ceil((cam.cy + vh/2/z)/TS));

  // 地图外框阴影
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#1a1f26';
  ctx.fillRect(ox, oy, W*TS*z, H*TS*z);
  ctx.restore();

  /* --- 地形（烘焙图，1 次 drawImage） --- */
  if(terrCv){
    ctx.imageSmoothingEnabled = true;
    try{ ctx.imageSmoothingQuality = 'high'; }catch(e){}
    ctx.drawImage(terrCv, ox, oy, W*TS*z, H*TS*z);
  }
  /* 水面动态：微波 + 岸边浪花 */
  if(!window.__dbgTerrain) drawWater(now, ox, oy, pts, x0, x1, y0, y1);
  if(window.__dbgTerrain) return;
  /* 地表点缀：芦苇 / 花 / 碎石 / 遗迹 */
  drawDeco(now, ox, oy, pts, x0, x1, y0, y1);
  /* 鼠标悬停的格子提示 */
  if(mouse.in && !state.build){
    const ht = worldToTile(mouse.wx, mouse.wy);
    if(ht.x>=0 && ht.y>=0 && ht.x<W && ht.y<H){
      ctx.strokeStyle = 'rgba(255,255,255,.30)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(ox + ht.x*pts + 1, oy + ht.y*pts + 1, pts-2, pts-2);
    }
  }

  /* --- 区域 --- */
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x];
    if(!t.zone) continue;
    const px = ox + x*pts, py = oy + y*pts;
    if(t.zone === 'stock'){
      ctx.fillStyle = 'rgba(90,160,240,.15)';
      ctx.fillRect(px, py, pts+1, pts+1);
      ctx.strokeStyle = 'rgba(130,190,255,.42)';
      ctx.lineWidth = 1; ctx.setLineDash([pts*0.16, pts*0.16]);
      ctx.strokeRect(px+1.5, py+1.5, pts-3, pts-3);
      ctx.setLineDash([]);
    } else {
      /* 农田（v2.1）：荒地只是「圈起来了」，熟地才是真能种的地。
         两者必须长得完全不一样 —— 玩家要能一眼扫出"这亩还没开"，
         否则开荒就变成一个藏在面板里的数值，而不是地图上的进度。 */
      if(t.soil !== 'tilled'){
        /* 荒地：干黄的地皮 + 草茬 + 土坷垃，边界是亮虚线。
           刻意不用绿色调 —— 绿色会和周围的草地糊在一起，"圈了但没开"
           就看不出来了。 */
        ctx.fillStyle = 'rgba(104,94,58,.34)';
        ctx.fillRect(px, py, pts+1, pts+1);
        ctx.strokeStyle = 'rgba(232,214,152,.52)';
        ctx.lineWidth = 1.2; ctx.setLineDash([pts*0.15, pts*0.11]);
        ctx.strokeRect(px+1.5, py+1.5, pts-3, pts-3);
        ctx.setLineDash([]);
        /* 草茬 */
        ctx.strokeStyle = 'rgba(214,208,140,.58)';
        ctx.lineWidth = Math.max(1, pts*0.026);
        for(let k=0;k<3;k++){
          const gx = px + pts*(0.24 + k*0.26), gy = py + pts*0.76;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + pts*0.08, gy - pts*(0.15 + k*0.05));
          ctx.stroke();
        }
        /* 土坷垃 */
        ctx.fillStyle = 'rgba(150,128,92,.70)';
        for(let k=0;k<2;k++){
          ctx.beginPath();
          ctx.ellipse(px + pts*(0.30 + k*0.40), py + pts*(0.34 + k*0.22),
                      pts*0.055, pts*0.040, k*0.8, 0, TAU);
          ctx.fill();
        }
      } else {
        /* 熟地：翻过的暖棕土，深浅跟着地力走 —— 地越瘦，土越白 */
        const f = clamp(t.fert || 0.5, 0.1, 1);
        ctx.fillStyle = `rgba(${Math.round(96 + f*26)},${Math.round(64 + f*18)},34,.52)`;
        ctx.fillRect(px, py, pts+1, pts+1);
        ctx.strokeStyle = 'rgba(56,38,22,.46)';
        ctx.lineWidth = 1;
        for(let k=1;k<3;k++){
          ctx.beginPath();
          ctx.moveTo(px, py + pts*k/3); ctx.lineTo(px+pts, py + pts*k/3);
          ctx.stroke();
        }
      }
    }
  }

  /* --- 血迹 --- */
  for(const d of state.decals){
    if(d.x < x0-1 || d.x > x1+1 || d.y < y0-1 || d.y > y1+1) continue;
    const px = ox + d.x*pts + d.ox*pts, py = oy + d.y*pts + d.oy*pts;
    ctx.fillStyle = `rgba(120,20,20,${d.a})`;
    ctx.beginPath();
    ctx.ellipse(px, py, pts*0.16*d.r, pts*0.11*d.r, d.rot, 0, TAU);
    ctx.fill();
  }

  /* --- 地面物品 --- */
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x];
    if(!t.items) continue;
    drawItemStack(ox + x*pts, oy + y*pts, pts, t.items, z);
  }

  /* --- 植物 --- */
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x];
    if(!t.plant) continue;
    drawPlant(ox + x*pts, oy + y*pts, pts, t.plant, now, x, y);
  }

  /* --- 建筑 --- */
  const fires = [];
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x];
    if(!t.bld) continue;
    const px = ox + x*pts, py = oy + y*pts;
    if(t.bld.prog < 1){ drawBlueprint(px, py, pts, t.bld, now, x, y); continue; }
    drawBuilding(px, py, pts, t, x, y, now);
    if(t.bld.type === 'fire') fires.push({ px:px+pts/2, py:py+pts/2 });
  }

  /* --- 选中居民的去向（意图线）--- */
  drawIntent(ox, oy, pts, now);

  /* --- 角色 --- */
  const actors = state.cols.concat(state.raiders);
  actors.sort((a,b)=> a.fy - b.fy);
  for(const a of actors){
    if(a.x < x0-2 || a.x > x1+2 || a.y < y0-2 || a.y > y1+2) continue;
    drawActor(a, ox, oy, pts, z, now);
  }

  /* --- 框选矩形（v1.9）--- */
  if(typeof boxSel !== 'undefined' && boxSel && boxSel.a){
    const x0 = Math.min(boxSel.sx, boxSel.cx), y0 = Math.min(boxSel.sy, boxSel.cy);
    const w0 = Math.abs(boxSel.cx - boxSel.sx), h0 = Math.abs(boxSel.cy - boxSel.sy);
    ctx.save();
    ctx.fillStyle = 'rgba(120,200,255,.10)';
    ctx.fillRect(x0, y0, w0, h0);
    ctx.strokeStyle = 'rgba(160,220,255,.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5,4]);
    ctx.strokeRect(x0 + .5, y0 + .5, w0, h0);
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* --- 个人指令的目标标记（v1.7）--- */
  /* 玩家下完命令必须马上看见"我让他去哪、打谁"，否则这道命令等于没下。 */
  for(const c of state.cols){
    if(!c.order || c.dead) continue;
    const o = c.order;
    let tx, ty;
    if(o.kind === 'move' || o.kind === 'demolish'){ tx = o.x + 0.5; ty = o.y + 0.5; }
    else {
      const f = state.raiders.find(r=> r.id === o.id && !r.dead && !r.down);
      if(!f) continue;
      tx = f.fx; ty = f.fy;
    }
    const px = ox + tx*pts, py = oy + ty*pts;
    const ax = ox + c.fx*pts, ay = oy + c.fy*pts;
    const pulse = 0.55 + 0.45*Math.sin(now*0.008);
    ctx.save();
    const hot = o.kind === 'attack' || o.kind === 'demolish';
    ctx.strokeStyle = hot
      ? `rgba(226,86,77,${0.92*pulse})` : `rgba(232,163,61,${0.85*pulse})`;
    ctx.lineWidth = Math.max(2, pts*0.075);
    ctx.setLineDash([pts*0.26, pts*0.2]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(px, py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(2, pts*0.08);
    ctx.beginPath(); ctx.ellipse(px, py, pts*0.62, pts*0.34, 0, 0, TAU); ctx.stroke();
    /* 目标点再点一颗实心，缩放小的时候也能一眼看到 */
    ctx.fillStyle = hot ? `rgba(226,86,77,${0.55*pulse})` : `rgba(232,163,61,${0.5*pulse})`;
    ctx.beginPath(); ctx.ellipse(px, py, pts*0.16, pts*0.09, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* --- 特效 --- */
  for(const f of state.fx){
    /* v2.2 修正：f.t 用的是 performance.now()，而这里拿到的是 rAF 时间戳 ——
       后者是本帧「开始」的时刻，可能比 f.t 还早几百毫秒（特效是在本帧的
       模拟步里创建的）。不夹住的话 age 会是负的，ring 的半径算成负数，
       ctx.arc 直接抛 IndexSizeError，整帧的绘制从这里往后全断掉。 */
    const age = Math.max(0, Math.min(1, (now - f.t) / f.life));
    if(age >= 1) continue;
    const px = ox + f.x*pts, py = oy + f.y*pts;
    if(f.kind === 'shot'){
      ctx.strokeStyle = `rgba(255,214,130,${(1-age)*0.85})`;
      ctx.lineWidth = Math.max(1.5, pts*0.055);
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(ox + f.tx*pts, oy + f.ty*pts);
      ctx.stroke();
    } else if(f.kind === 'hit'){
      ctx.fillStyle = `rgba(200,50,45,${(1-age)*0.8})`;
      ctx.beginPath(); ctx.arc(px, py, pts*(0.08+age*0.22), 0, TAU); ctx.fill();
    } else if(f.kind === 'txt'){
      ctx.globalAlpha = 1-age;
      ctx.fillStyle = f.color || '#ffe9b8';
      ctx.font = `600 ${Math.max(10, pts*0.34)}px -apple-system,"Segoe UI",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, px, py - age*pts*0.9);
      ctx.globalAlpha = 1;
    } else if(f.kind === 'ring'){
      ctx.strokeStyle = `rgba(232,163,61,${(1-age)*0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, pts*(0.2+age*0.9), 0, TAU); ctx.stroke();
    } else if(f.kind === 'blood'){
      const a0 = f.a0 || 0;
      for(let i=0;i<5;i++){
        const ang = a0 + i*1.31;
        const d = pts*(0.08 + age*0.46);
        ctx.fillStyle = `rgba(178,38,38,${(1-age)*0.72})`;
        ctx.beginPath();
        ctx.arc(px + Math.cos(ang)*d, py + Math.sin(ang)*d + age*pts*0.16,
                Math.max(1, pts*0.036*(1-age*0.45)), 0, TAU);
        ctx.fill();
      }
    } else if(f.kind === 'debris'){
      const a0 = f.a0 || 0;
      for(let i=0;i<7;i++){
        const ang = a0 + i*0.9;
        const d = pts*(0.10 + age*0.58);
        ctx.fillStyle = `rgba(168,158,146,${(1-age)*0.85})`;
        const s = Math.max(1.2, pts*0.05*(1-age*0.4));
        ctx.fillRect(px + Math.cos(ang)*d - s/2, py + Math.sin(ang)*d - age*pts*0.06 + age*age*pts*0.5, s, s);
      }
    }
  }

  /* --- 建造预览 --- */
  if(state.build && mouse.in){
    drawGhost(ox, oy, pts);
  }

  /* --- 昼夜光照与色调分级 --- */
  const dk = darkness();
  const hh = (state.min % 1440) / 60;
  const dusk = dk > 0.02 && ((hh > 16.6 && hh < 20.2) || (hh > 4 && hh < 6.8));
  if(dk > 0.015){
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    if(dusk){
      g.addColorStop(0, `rgba(62,36,54,${(dk*0.92).toFixed(3)})`);
      g.addColorStop(1, `rgba(16,14,34,${dk.toFixed(3)})`);
    } else {
      g.addColorStop(0, `rgba(10,18,44,${(dk*0.94).toFixed(3)})`);
      g.addColorStop(1, `rgba(4,8,20,${dk.toFixed(3)})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0,0,vw,vh);

    /* 光源：篝火暖光 + 居民微光 */
    if(!glowWarm) glowWarm = makeGlowCanvas('255,176,88');
    if(!glowCool) glowCool = makeGlowCanvas('148,188,255');
    ctx.globalCompositeOperation = 'lighter';
    for(const f of fires){
      const fl = 0.82 + Math.sin(now*0.009 + f.px)*0.10 + Math.sin(now*0.021)*0.06;
      const R = pts*5.2;
      ctx.globalAlpha = clamp(0.62*fl*(0.35 + dk), 0, 1);
      ctx.drawImage(glowWarm, f.px-R, f.py-R, R*2, R*2);
    }
    for(const c of state.cols){
      if(c.down) continue;
      const px = ox + c.fx*pts, py = oy + c.fy*pts, R = pts*1.6;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(glowCool, px-R, py-R, R*2, R*2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* --- 天气：雨 / 雾 --- */
  /* 冬临：整体压一层冷调，让树与人物也一起入冬 */
  if(isWinter()){
    ctx.fillStyle = 'rgba(176,204,228,.13)';
    ctx.fillRect(0, 0, vw, vh);
  }
  if(state.rain > 0.01){
    if(isWinter()){
      /* 雪：慢速下落的白点，带轻微横向摆动 */
      ctx.fillStyle = `rgba(240,247,255,${(0.62*state.rain).toFixed(3)})`;
      for(let i=0;i<190;i++){
        const sp = 0.5 + hash2(i,3)*0.8;
        const sx = (hash2(i,7)*vw + Math.sin(now*0.0006 + i*1.7)*20 + vw*1.4) % vw;
        const sy = (hash2(i,13)*vh + now*0.070*sp + i*17) % vh;
        const rr = 0.9 + hash2(i,29)*1.6;
        ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
      }
    } else {
    const slant = 6 + Math.sin(now*0.0004)*3;
    ctx.strokeStyle = `rgba(196,222,246,${(0.26*state.rain).toFixed(3)})`;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    const n = 150;
    for(let i=0;i<n;i++){
      const sp = 0.9 + hash2(i,3)*0.6;
      const sx = (hash2(i,7)*vw + now*0.10*sp*i % vw + vw) % vw;
      const sy = (hash2(i,13)*vh + now*0.62*sp + i*29) % vh;
      ctx.moveTo(sx, sy); ctx.lineTo(sx - slant*0.35, sy + 15);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(210,235,255,${(0.18*state.rain).toFixed(3)})`;
    for(let i=0;i<26;i++){
      const sx = hash2(i*3, 11)*vw, sy = hash2(i*5, 17)*vh;
      const rr = 1.2 + hash2(i,23)*2.2;
      ctx.beginPath(); ctx.ellipse(sx, sy, rr*1.6, rr*0.6, 0, 0, TAU); ctx.fill();
    }
    }
  }
  if(state.weather === '雾'){
    ctx.fillStyle = 'rgba(178,194,210,.12)';
    ctx.fillRect(0,0,vw,vh);
    const drift = (now*0.010) % (vw + 700) - 350;
    ctx.globalAlpha = 0.10;
    for(let i=0;i<4;i++){
      const bx = (drift + i*vw/3) % (vw + 700) - 350;
      const by = vh*(0.18 + i*0.19);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, vw*0.34);
      g.addColorStop(0, 'rgba(238,244,252,1)');
      g.addColorStop(1, 'rgba(238,244,252,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,vw,vh);
    }
    ctx.globalAlpha = 1;
  }

  /* --- 暗角 --- */
  if(dk > 0.06 && vigGrad){
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0,0,vw,vh);
  }
}

/* ---- 水面动态层 ---- */
function drawWater(now, ox, oy, pts, x0, x1, y0, y1){
  if(pts < 10) return;
  const tsec = now * 0.001;
  const DX = [0,0,-1,1], DY = [-1,1,0,0];
  ctx.lineCap = 'round';
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x];
    if(t.g !== T.WATER) continue;
    const px = ox + x*pts, py = oy + y*pts;
    const ph = Math.sin(tsec*1.5 + x*0.72 + y*0.94);

    ctx.strokeStyle = 'rgba(200,238,255,' + (0.045 + 0.055*(ph*0.5 + 0.5)).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, pts*0.030);
    const yy = py + pts*(0.36 + 0.10*ph);
    ctx.beginPath();
    ctx.moveTo(px + pts*0.14, yy);
    ctx.quadraticCurveTo(px + pts*0.46, yy - pts*0.07, px + pts*0.80, yy);
    ctx.stroke();

    if(t.shore){
      const fl = 0.10 + 0.10*(Math.sin(tsec*1.9 + x*1.6 + y*0.8)*0.5 + 0.5);
      ctx.strokeStyle = 'rgba(236,250,255,' + fl.toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, pts*0.032);
      for(let i=0;i<4;i++){
        const n = tileAt(x+DX[i], y+DY[i]);
        if(!n || n.g === T.WATER) continue;
        ctx.beginPath();
        if(i === 0){
          ctx.moveTo(px + pts*0.16, py + pts*0.13);
          ctx.quadraticCurveTo(px + pts*0.50, py + pts*0.06, px + pts*0.84, py + pts*0.13);
        } else if(i === 1){
          ctx.moveTo(px + pts*0.16, py + pts*0.87);
          ctx.quadraticCurveTo(px + pts*0.50, py + pts*0.94, px + pts*0.84, py + pts*0.87);
        } else if(i === 2){
          ctx.moveTo(px + pts*0.13, py + pts*0.16);
          ctx.quadraticCurveTo(px + pts*0.06, py + pts*0.50, px + pts*0.13, py + pts*0.84);
        } else {
          ctx.moveTo(px + pts*0.87, py + pts*0.16);
          ctx.quadraticCurveTo(px + pts*0.94, py + pts*0.50, px + pts*0.87, py + pts*0.84);
        }
        ctx.stroke();
      }
    }
  }
}

/* ---- 地表点缀层 ---- */
function drawDeco(now, ox, oy, pts, x0, x1, y0, y1){
  if(pts < 9) return;
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const t = tiles[y*W+x];
    if(!t.deco) continue;
    const px = ox + x*pts, py = oy + y*pts;
    const hs = hash2(x, y);
    const sway = Math.sin(now*0.0012 + hs*TAU) * pts*0.03;

    if(t.deco === 'reed'){
      ctx.strokeStyle = 'rgba(126,146,84,.85)';
      ctx.lineWidth = Math.max(1, pts*0.030);
      ctx.beginPath();
      for(let i=0;i<4;i++){
        const bx = px + pts*(0.18 + i*0.19);
        const hgt = pts*(0.28 + hash2(x+i, y+i)*0.24);
        ctx.moveTo(bx, py + pts*0.84);
        ctx.quadraticCurveTo(bx + sway*0.5, py + pts*0.50, bx + sway, py + pts*0.84 - hgt);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(158,126,72,.92)';
      ctx.beginPath();
      ctx.ellipse(px + pts*0.56 + sway, py + pts*0.46, pts*0.030, pts*0.075, 0.18, 0, TAU);
      ctx.fill();
    } else if(t.deco === 'flower'){
      for(let i=0;i<4;i++){
        const k = hash2(x*13+i, y*17+i);
        if(k < 0.32) continue;
        const fx = px + pts*(0.16 + k*0.68) + sway*0.5;
        const fy = py + pts*(0.16 + hash2(x*3+i, y*5+i)*0.68);
        ctx.fillStyle = ['#f2e7a8','#f7f3e2','#e6bfd4','#f0cf74'][i % 4];
        ctx.beginPath(); ctx.arc(fx, fy, pts*0.034, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.arc(fx - pts*0.010, fy - pts*0.010, pts*0.014, 0, TAU); ctx.fill();
      }
    } else if(t.deco === 'stone'){
      const rr = pts*(0.07 + hs*0.05);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(px+pts*0.52, py+pts*0.64, rr*1.05, rr*0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8b9099';
      ctx.beginPath(); ctx.arc(px + pts*(0.30 + hs*0.40), py + pts*(0.42 + hs*0.20), rr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath();
      ctx.arc(px + pts*(0.30 + hs*0.40) - rr*0.30, py + pts*(0.42 + hs*0.20) - rr*0.30, rr*0.45, 0, TAU);
      ctx.fill();
    } else if(t.deco === 'pebble'){
      ctx.fillStyle = 'rgba(160,150,130,.55)';
      ctx.beginPath(); ctx.ellipse(px+pts*0.50, py+pts*0.55, pts*0.045, pts*0.030, hs*3, 0, TAU); ctx.fill();
    } else if(t.deco === 'tuft'){
      ctx.strokeStyle = 'rgba(72,104,46,.45)';
      ctx.lineWidth = Math.max(1, pts*0.028);
      ctx.beginPath();
      for(let i=0;i<3;i++){
        const bx = px + pts*(0.32 + i*0.14);
        ctx.moveTo(bx, py + pts*0.66);
        ctx.lineTo(bx + (i-1)*pts*0.05 + sway*0.4, py + pts*0.48);
      }
      ctx.stroke();
    } else if(t.deco === 'ruin'){
      ctx.fillStyle = 'rgba(16,20,26,.22)';
      ctx.beginPath(); ctx.ellipse(px+pts*0.50, py+pts*0.74, pts*0.40, pts*0.15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7b7a72';
      ctx.fillRect(px+pts*0.12, py+pts*0.36, pts*0.28, pts*0.32);
      ctx.fillRect(px+pts*0.50, py+pts*0.48, pts*0.22, pts*0.22);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(px+pts*0.12, py+pts*0.36, pts*0.28, pts*0.05);
      ctx.fillStyle = '#7a5a37';
      ctx.fillRect(px+pts*0.56, py+pts*0.26, pts*0.20, pts*0.17);
      ctx.strokeStyle = 'rgba(40,28,16,.65)';
      ctx.lineWidth = Math.max(1, pts*0.02);
      ctx.strokeRect(px+pts*0.56, py+pts*0.26, pts*0.20, pts*0.17);
      ctx.fillStyle = 'rgba(96,142,72,.42)';
      ctx.beginPath(); ctx.arc(px+pts*0.32, py+pts*0.68, pts*0.075, 0, TAU); ctx.fill();
    }
  }
}

function drawItemStack(px, py, pts, items, z){
  let i = 0;
  for(const s of items){
    const k = s.kind;
    const cx = px + pts*(0.30 + (i%2)*0.30), cy = py + pts*(0.62 - (i%2)*0.14);
    const r = pts*0.13;
    if(k === 'wood'){
      ctx.fillStyle = '#8b5f3a';
      ctx.beginPath(); ctx.roundRect(cx-r*1.5, cy-r*0.5, r*3, r, r*0.5); ctx.fill();
      ctx.fillStyle = '#a9784a';
      ctx.beginPath(); ctx.roundRect(cx-r*1.5, cy-r*0.5, r*3, r*0.45, r*0.3); ctx.fill();
    } else if(k === 'stone'){
      ctx.fillStyle = '#8d929a';
      ctx.beginPath(); ctx.moveTo(cx-r*1.4, cy+r); ctx.lineTo(cx-r*0.6, cy-r*1.1);
      ctx.lineTo(cx+r*0.9, cy-r*0.5); ctx.lineTo(cx+r*1.3, cy+r); ctx.closePath(); ctx.fill();
    } else if(k === 'food'){
      ctx.fillStyle = '#c94f52';
      for(let d=0; d<3; d++){
        ctx.beginPath(); ctx.arc(cx + (d-1)*r*1.1, cy + (d%2?-r*0.5:r*0.2), r*0.62, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#5f9147';
      ctx.beginPath(); ctx.arc(cx, cy-r*0.9, r*0.5, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#d8dede';
      ctx.beginPath(); ctx.ellipse(cx, cy, r*1.6, r*1.0, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8a33d';
      ctx.beginPath(); ctx.ellipse(cx, cy-r*0.15, r*1.1, r*0.5, 0, 0, TAU); ctx.fill();
    }
    if(z > 0.85 && s.qty > 1){
      ctx.fillStyle = 'rgba(10,14,18,.75)';
      const tx = px+pts*0.5, ty = py+pts*0.9;
      ctx.font = `600 ${Math.max(8, pts*0.24)}px -apple-system,sans-serif`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(s.qty).width;
      ctx.beginPath(); ctx.roundRect(tx-tw/2-2, ty-pts*0.16, tw+4, pts*0.22, 3); ctx.fill();
      ctx.fillStyle = '#e9eef4';
      ctx.fillText(s.qty, tx, ty);
    }
    i++;
  }
}

function drawPlant(px, py, pts, p, now, x, y){
  const sway = Math.sin(now*0.001 + p.sway) * pts*0.035;
  if(p.kind === 'tree'){
    const sp = p.sp || ((hash2(x,y) < 0.55) ? 'oak' : 'pine');
    const jx = (hash2(x*3+1, y*7+5) - 0.5) * pts*0.20;
    const jy = (hash2(x*11+3, y*5+9) - 0.5) * pts*0.10;
    const s  = pts*(0.74 + p.grow*0.30 + hash2(x*5, y*3)*0.16);
    const cx = px + pts*0.5 + sway + jx;
    const cy = py + pts*0.62 + jy;          // 树根（地面点）

    /* 落影：光来自左上，影子朝右下 */
    ctx.fillStyle = 'rgba(10,20,12,.24)';
    ctx.beginPath();
    ctx.ellipse(cx + s*0.17, cy + s*0.07, s*0.42, s*0.13, 0.16, 0, TAU);
    ctx.fill();

    if(sp === 'dead'){
      ctx.strokeStyle = '#584330';
      ctx.lineWidth = Math.max(1, pts*0.05);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - s*0.05, cy);
      ctx.lineTo(cx + sway*0.4, cy - s*0.52);
      ctx.moveTo(cx + sway*0.2, cy - s*0.28);
      ctx.lineTo(cx - s*0.26, cy - s*0.40);
      ctx.moveTo(cx + sway*0.3, cy - s*0.36);
      ctx.lineTo(cx + s*0.22, cy - s*0.56);
      ctx.stroke();
      ctx.fillStyle = 'rgba(150,124,92,.30)';
      ctx.beginPath(); ctx.ellipse(cx, cy, s*0.13, s*0.05, 0, 0, TAU); ctx.fill();
      return;
    }

    /* 树干 */
    const tw = Math.max(1.3, s*0.085);
    ctx.fillStyle = sp === 'birch' ? '#b9b3a2' : '#4c3826';
    ctx.fillRect(cx - tw*0.5, cy - s*0.46, tw, s*0.48);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(cx - tw*0.5, cy - s*0.46, tw*0.42, s*0.48);

    if(sp === 'pine'){
      /* 针叶：五层叠翠，每层左侧受光，形成体积感 */
      const Ht = s*(0.98 + hash2(x+7,y+3)*0.20);
      const W0 = s*0.46;
      const hue = (isWinter() ? 160 : 126) + hash2(x+3,y+8)*14;
      for(let i=0;i<5;i++){
        const f = i/4;
        const yTop = cy - Ht*(0.44 + f*0.56);
        const yBot = cy - Ht*(0.18 + f*0.50);
        const w = W0*(1 - f*0.72);
        const sx0 = cx + sway*(0.25 + f*0.45);
        /* 冠层主体 */
        ctx.fillStyle = `hsl(${hue}, ${25+f*5}%, ${12+f*4}%)`;
        ctx.beginPath();
        ctx.moveTo(sx0, yTop);
        ctx.lineTo(cx + w, yBot);
        ctx.lineTo(cx + w*0.42, yBot - (yBot-yTop)*0.10);
        ctx.lineTo(cx - w*0.30, yBot - (yBot-yTop)*0.04);
        ctx.lineTo(cx - w, yBot);
        ctx.closePath(); ctx.fill();
        /* 受光面（左） */
        ctx.fillStyle = `hsl(${hue+5}, ${29+f*5}%, ${21+f*6}%)`;
        ctx.beginPath();
        ctx.moveTo(sx0 - w*0.04, yTop + (yBot-yTop)*0.10);
        ctx.lineTo(cx - w*0.94, yBot - (yBot-yTop)*0.03);
        ctx.lineTo(cx - w*0.10, yBot - (yBot-yTop)*0.01);
        ctx.closePath(); ctx.fill();
      }
      /* 顶端嫩芽 */
      ctx.fillStyle = `hsl(${hue+12}, 36%, 36%)`;
      ctx.beginPath();
      ctx.arc(cx + sway*0.8, cy - Ht*1.0, Math.max(0.9, s*0.055), 0, TAU);
      ctx.fill();
    } else {
      /* 阔叶：多瓣树冠 + 左上打光，轮廓不再像圆球 */
      const R = s*0.44;
      const hue = sp === 'birch' ? (isWinter() ? 96 : 80) : (isWinter() ? 116 : 94) + hash2(x,y)*14;
      const L = sp === 'birch' ? 29 : 22;
      const ccy = cy - s*0.66;
      ctx.fillStyle = `hsl(${hue}, 25%, ${L-10}%)`;
      for(let i=0;i<7;i++){
        const a = (i/7)*TAU + hash2(x+i, y+i*3)*0.6;
        const rr = R*(0.56 + hash2(x*2+i, y*3+i)*0.26);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a)*R*0.50, ccy + Math.sin(a)*R*0.38, rr, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = `hsl(${hue+4}, 31%, ${L+2}%)`;
      for(let i=0;i<5;i++){
        const a = (i/5)*TAU + 0.7 + hash2(x*7+i, y*5+i)*0.5;
        const rr = R*(0.44 + hash2(x*3+i, y*7+i)*0.22);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a)*R*0.44 - R*0.12, ccy + Math.sin(a)*R*0.30 - R*0.14, rr, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = `hsl(${hue+12}, 40%, ${L+15}%)`;
      ctx.beginPath();
      ctx.arc(cx - R*0.30, ccy - R*0.36, R*0.24, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + R*0.14, ccy - R*0.48, R*0.15, 0, TAU); ctx.fill();
      if(sp === 'birch'){
        ctx.fillStyle = 'rgba(246,244,232,.55)';
        ctx.fillRect(cx - tw*0.5 + tw*0.62, cy - s*0.26, tw*0.3, s*0.10);
        ctx.fillRect(cx - tw*0.5 + tw*0.2, cy - s*0.14, tw*0.34, s*0.07);
      }
    }
    /* 冬临：树冠积雪 */
    if(isWinter()){
      ctx.fillStyle = 'rgba(242,248,255,.60)';
      ctx.beginPath();
      ctx.ellipse(cx - s*0.08, cy - s*0.88, s*0.29, s*0.095, -0.16, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s*0.17, cy - s*0.64, s*0.19, s*0.070, 0.20, 0, TAU); ctx.fill();
    }
  } else if(p.kind === 'bush'){
  } else if(p.kind === 'bush'){
    const cx = px + pts/2 + sway*0.6, cy = py + pts*0.62;
    const hue = (isWinter() ? 130 : 104) + hash2(x+5,y+2)*20;
    ctx.fillStyle = 'rgba(8,16,10,.20)';
    ctx.beginPath(); ctx.ellipse(cx + pts*0.04, cy+pts*0.17, pts*0.28, pts*0.10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `hsl(${hue}, 26%, 18%)`;
    ctx.beginPath(); ctx.arc(cx, cy, pts*0.245, 0, TAU); ctx.fill();
    ctx.fillStyle = `hsl(${hue}, 30%, 28%)`;
    ctx.beginPath(); ctx.arc(cx-pts*0.14, cy+pts*0.03, pts*0.155, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+pts*0.14, cy+pts*0.02, pts*0.145, 0, TAU); ctx.fill();
    ctx.fillStyle = `hsl(${hue+8}, 36%, 37%)`;
    ctx.beginPath(); ctx.arc(cx-pts*0.03, cy-pts*0.09, pts*0.13, 0, TAU); ctx.fill();
    if(p.berries > 0){
      for(let i=0;i<Math.min(4,p.berries);i++){
        const a = i*1.9 + p.sway;
        const bx = cx + Math.cos(a)*pts*0.14, by = cy + Math.sin(a)*pts*0.09;
        ctx.fillStyle = '#b8373c';
        ctx.beginPath(); ctx.arc(bx, by, pts*0.038, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,190,190,.55)';
        ctx.beginPath(); ctx.arc(bx - pts*0.012, by - pts*0.012, pts*0.014, 0, TAU); ctx.fill();
      }
    }
  } else if(p.kind === 'herb'){
    /* 药草丛：五枝细叶 + 一点花序，成熟时顶上是浅黄小花 */
    const cx = px + pts*0.5, cy = py + pts*0.72;
    const s = pts*(0.32 + (p.grow||0.8)*0.16);
    const ready = p.ready !== false;
    ctx.fillStyle = 'rgba(10,20,12,.16)';
    ctx.beginPath(); ctx.ellipse(cx, cy + pts*0.03, s*0.30, s*0.10, 0, 0, TAU); ctx.fill();
    for(let i=0;i<5;i++){
      const a = -Math.PI/2 + (i-2)*0.44;
      const lx = cx + Math.cos(a)*s*0.46 + sway*0.25, ly = cy + Math.sin(a)*s*0.50;
      ctx.strokeStyle = ready ? '#5f9150' : '#6c7a58';
      ctx.lineWidth = Math.max(1, pts*0.026);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + (lx-cx)*0.45, cy - s*0.34, lx, ly);
      ctx.stroke();
      ctx.fillStyle = ready ? 'rgba(122,182,108,.88)' : 'rgba(108,138,94,.55)';
      ctx.beginPath();
      ctx.ellipse(lx, ly, s*0.15, s*0.075, a + 0.55, 0, TAU);
      ctx.fill();
    }
    if(ready){
      ctx.fillStyle = '#e8e4ac';
      ctx.beginPath(); ctx.arc(cx + sway*0.3, cy - s*0.56, Math.max(1, pts*0.030), 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,220,.7)';
      ctx.beginPath(); ctx.arc(cx + sway*0.3 - pts*0.008, cy - s*0.56 - pts*0.008, Math.max(0.7, pts*0.013), 0, TAU); ctx.fill();
    }
  } else if(p.kind === 'crop'){
    /* 作物（v2.1）：四种长相，一眼能认出地里种的是什么 */
    const cd = cropDef(p.crop);
    const cx = px + pts*0.5, cy = py + pts*0.70;
    const ripe = p.grow >= 0.99;
    /* 垄沟 */
    ctx.strokeStyle = 'rgba(84,64,42,.30)';
    ctx.lineWidth = Math.max(1, pts*0.03);
    ctx.beginPath();
    ctx.moveTo(px + pts*0.1, cy + pts*0.08);
    ctx.lineTo(px + pts*0.9, cy + pts*0.08);
    ctx.stroke();

    if(cd.bush){
      /* 豆：矮丛，成熟时挂豆荚 */
      for(let i=0;i<4;i++){
        const bx = px + pts*(0.22 + i*0.19) + sway*0.3;
        const bh = pts*(0.10 + p.grow*0.17);
        ctx.fillStyle = ripe ? cd.ripe : cd.col;
        ctx.beginPath();
        ctx.ellipse(bx, cy - bh*0.45, pts*0.082, bh*0.64, 0, 0, TAU);
        ctx.fill();
        if(ripe){
          ctx.fillStyle = 'rgba(226,242,186,.78)';
          ctx.beginPath();
          ctx.ellipse(bx - pts*0.015, cy - bh*0.62, pts*0.024, pts*0.052, -0.5, 0, TAU);
          ctx.fill();
        }
      }
    } else if(cd.leafy){
      /* 根菜 / 药草：贴地叶簇，成熟时中心顶出一点颜色 */
      const s = pts*(0.19 + p.grow*0.15);
      for(let i=0;i<5;i++){
        const a = -Math.PI/2 + (i-2)*0.56;
        const lx = cx + Math.cos(a)*s*0.95 + sway*0.22;
        const ly = cy - Math.abs(Math.sin(a))*s*0.52 - pts*0.04;
        ctx.fillStyle = ripe ? cd.col : cd.col;
        ctx.beginPath();
        ctx.ellipse(lx, ly, s*0.36, s*0.155, a*0.7, 0, TAU);
        ctx.fill();
      }
      if(ripe){
        ctx.fillStyle = cd.ripe;
        ctx.beginPath();
        ctx.arc(cx + sway*0.18, cy - s*0.30, Math.max(1, pts*0.048), 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,235,.55)';
        ctx.beginPath();
        ctx.arc(cx + sway*0.18 - pts*0.012, cy - s*0.30 - pts*0.012, Math.max(0.6, pts*0.019), 0, TAU);
        ctx.fill();
      }
    } else {
      /* 麦：高秆 + 穗 */
      const h = pts*(0.16 + p.grow*0.32);
      for(let i=0;i<4;i++){
        const bx = px + pts*(0.20 + i*0.19) + sway*0.4;
        ctx.strokeStyle = ripe ? cd.ripe : cd.col;
        ctx.lineWidth = Math.max(1, pts*0.035);
        ctx.beginPath();
        ctx.moveTo(bx, cy + pts*0.04);
        ctx.quadraticCurveTo(bx - pts*0.02, cy - h*0.5, bx + sway*0.6, cy - h);
        ctx.stroke();
        if(ripe){
          ctx.fillStyle = cd.ripe;
          ctx.beginPath(); ctx.ellipse(bx + sway*0.6, cy - h, pts*0.040, pts*0.075, 0.15, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,240,180,.5)';
          ctx.beginPath(); ctx.ellipse(bx + sway*0.6 - pts*0.012, cy - h - pts*0.014, pts*0.018, pts*0.030, 0.15, 0, TAU); ctx.fill();
        } else if(p.grow > 0.45){
          ctx.fillStyle = 'rgba(110,160,80,.55)';
          ctx.beginPath(); ctx.ellipse(bx + sway*0.5, cy - h*0.75, pts*0.035, pts*0.018, -0.5, 0, TAU); ctx.fill();
        }
      }
    }
  }
}

/* ---- 屏震 / 顿帧 / 红晕（v1.4）---- */
let shakeT = 0, shkDur = 1, shkAmp = 0, hitStop = 0, vigT = 0, camSwing = null;

function kickShake(amp, ms){
  if(shkAmp < amp || shakeT <= 0){ shkAmp = amp; shkDur = ms; }
  shakeT = Math.max(shakeT, ms);
}
function kickHit(sec){
  if(state.speed > 1 || state.paused) return;   // 快进时不顿帧，否则反而拖慢
  hitStop = Math.min(0.10, hitStop + sec);
}
function flashVig(){
  vigT = 1.6;
}
function camSwingTo(wx, wy){
  if(state.build || state.drag || state.paused) return;   // 玩家正在操作就别抢镜头
  camSwing = { fx:cam.cx, fy:cam.cy, tx:wx, ty:wy, t:0, dur:0.62, hold:0.95, back:0.62 };
}
function updateCamSwing(dt){
  if(!camSwing) return;
  if(keys['w'] || keys['a'] || keys['s'] || keys['d'] ||
     keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']){
    camSwing = null; return;
  }
  const s = camSwing;
  s.t += dt;
  if(s.t < s.dur){
    const k = smoothstep(0, 1, s.t / s.dur);
    cam.cx = lerp(s.fx, s.tx, k); cam.cy = lerp(s.fy, s.ty, k);
  } else if(s.t < s.dur + s.hold){
    cam.cx = s.tx; cam.cy = s.ty;
  } else if(s.t < s.dur + s.hold + s.back){
    const k = smoothstep(0, 1, (s.t - s.dur - s.hold) / s.back);
    cam.cx = lerp(s.tx, s.fx, k); cam.cy = lerp(s.ty, s.fy, k);
  } else {
    cam.cx = s.fx; cam.cy = s.fy;
    camSwing = null;
  }
  clampCam();
  uiDirty.mini = true;
}
function updateShake(dt){
  if(shakeT > 0) shakeT = Math.max(0, shakeT - dt*1000);
}
function updateVignette(dt){
  if(vigT <= 0) return;
  vigT = Math.max(0, vigT - dt);
  const el = $('vig');
  if(!el) return;
  const k = vigT / 1.6;
  el.style.opacity = String(Math.max(0, (0.42 + 0.58*Math.sin(vigT*19)) * k));
  if(vigT <= 0) el.style.opacity = '0';
}

/* 施工工地（v1.4）：结构随进度真的"长高"，外面有脚手架，头顶有进度条 */
function drawBlueprint(px, py, pts, b, now, x, y){
  const p = clamp(b.prog || 0, 0, 1);
  const def = BL[b.type] || {};
  const busy = state.cols.some(c=> c.job && c.job.type === 'build' && c.job.x === x && c.job.y === y);

  /* 地基 */
  ctx.fillStyle = 'rgba(92,80,62,.44)';
  ctx.beginPath(); ctx.roundRect(px+pts*0.10, py+pts*0.60, pts*0.80, pts*0.28, pts*0.05); ctx.fill();
  ctx.strokeStyle = 'rgba(232,163,61,.30)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(px+pts*0.10, py+pts*0.60, pts*0.80, pts*0.28, pts*0.05); ctx.stroke();

  /* 已砌部分：高度 = 进度（区间拉大，进度差一眼能看出来） */
  if(p > 0.015){
    const hh = pts*0.56*p;
    const bx = px + pts*0.23, bw = pts*0.54;
    const by = py + pts*0.80 - hh;
    ctx.fillStyle = def.solid ? '#a19889' : '#b18d60';
    ctx.fillRect(bx, by, bw, hh);
    /* 砖缝 */
    ctx.strokeStyle = 'rgba(0,0,0,.17)'; ctx.lineWidth = 1;
    for(let yy = by + pts*0.11; yy < py+pts*0.80; yy += pts*0.12){
      ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx+bw, yy); ctx.stroke();
    }
    /* 受光面 + 顶沿高光 */
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(bx, by, bw*0.20, hh);
    ctx.fillStyle = 'rgba(255,255,255,.30)';
    ctx.fillRect(bx, by, bw, Math.max(1, pts*0.035));
  }

  /* 脚手架：两根立柱 + 三道横杆 */
  ctx.strokeStyle = 'rgba(206,172,118,.78)';
  ctx.lineWidth = Math.max(1.2, pts*0.044);
  const lx = px+pts*0.15, rx = px+pts*0.85, ty = py+pts*0.20, by2 = py+pts*0.80;
  ctx.beginPath();
  ctx.moveTo(lx, by2); ctx.lineTo(lx, ty);
  ctx.moveTo(rx, by2); ctx.lineTo(rx, ty);
  for(let i=0;i<3;i++){
    const yy = ty + (by2-ty)*i/2;
    ctx.moveTo(lx, yy); ctx.lineTo(rx, yy);
  }
  ctx.stroke();
  /* 斜撑 */
  ctx.strokeStyle = 'rgba(198,164,110,.34)';
  ctx.beginPath();
  ctx.moveTo(lx, by2); ctx.lineTo(rx, ty + (by2-ty)*0.5);
  ctx.stroke();

  /* 头顶进度条 */
  const barW = pts*0.70, barX = px + (pts-barW)/2, barY = py + pts*0.05, barH = Math.max(2.5, pts*0.085);
  ctx.fillStyle = 'rgba(0,0,0,.58)';
  ctx.beginPath(); ctx.roundRect(barX-1, barY-1, barW+2, barH+2, 2); ctx.fill();
  ctx.globalAlpha = busy ? 1 : 0.62;
  ctx.fillStyle = '#e8a33d';
  ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(1, barW*p), barH, 1.5); ctx.fill();
  ctx.globalAlpha = 1;

  /* 有人在建：锤击火花 */
  if(busy){
    const ph = Math.sin(now*0.018);
    if(ph > 0.1){
      for(let i=0;i<2;i++){
        const a = rnd()*TAU, rr = pts*(0.10 + rnd()*0.16);
        ctx.fillStyle = `rgba(255,214,130,${0.55 + rnd()*0.4})`;
        ctx.beginPath();
        ctx.arc(px+pts*0.5+Math.cos(a)*rr, py+pts*0.42+Math.sin(a)*rr, Math.max(1, pts*0.028), 0, TAU);
        ctx.fill();
      }
    }
  }
}

function drawBuilding(px, py, pts, t, x, y, now){
  const b = t.bld, ty = b.type, p = pts;

  /* 统一的接触阴影 */
  if(ty !== 'fire'){
    ctx.fillStyle = 'rgba(6,10,14,.20)';
    ctx.beginPath();
    ctx.ellipse(px + p*0.54, py + p*0.92, p*0.48, p*0.16, 0, 0, TAU);
    ctx.fill();
  }

  if(ty === 'wall'){
    const up = tileAt(x, y-1);
    const upWall = up && up.bld && up.bld.type === 'wall';
    ctx.fillStyle = '#8f949b';
    ctx.fillRect(px, py, p+1, p+1);
    /* 砖缝 */
    ctx.fillStyle = 'rgba(28,34,40,.30)';
    ctx.fillRect(px, py + p*0.485, p+1, Math.max(1, p*0.035));
    ctx.fillRect(px + p*0.5, py, Math.max(1, p*0.035), p*0.485);
    ctx.fillRect(px + p*0.24, py + p*0.52, Math.max(1, p*0.035), p*0.48);
    ctx.fillRect(px + p*0.76, py + p*0.52, Math.max(1, p*0.035), p*0.48);
    /* 砖块受光 */
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fillRect(px, py + p*0.52, p*0.48, Math.max(1, p*0.05));
    ctx.fillRect(px + p*0.52, py, p*0.46, Math.max(1, p*0.05));
    /* 顶部高光 / 底部投影 */
    if(!upWall){
      ctx.fillStyle = 'rgba(255,255,255,.26)';
      ctx.fillRect(px, py, p+1, Math.max(1.6, p*0.085));
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      ctx.fillRect(px, py + p*0.085, p+1, Math.max(1, p*0.05));
    }
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(px, py + p - Math.max(1.5, p*0.07), p+1, Math.max(1.5, p*0.07));
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(px, py, Math.max(1.2, p*0.045), p+1);
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.fillRect(px + p - Math.max(1.2, p*0.045), py, Math.max(1.2, p*0.045), p+1);
  } else if(ty === 'door'){
    ctx.fillStyle = '#5b4835';
    ctx.fillRect(px, py, p+1, p+1);
    /* 门框 */
    ctx.fillStyle = '#3f3226';
    ctx.fillRect(px + p*0.06, py + p*0.06, p*0.88, p*0.88);
    /* 门板 */
    ctx.fillStyle = '#a98a5f';
    ctx.fillRect(px + p*0.12, py + p*0.12, p*0.76, p*0.76);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(px + p*0.12, py + p*0.12, p*0.76, p*0.06);
    ctx.strokeStyle = 'rgba(60,44,28,.45)';
    ctx.lineWidth = Math.max(1, p*0.025);
    for(let i=1;i<3;i++){
      ctx.beginPath();
      ctx.moveTo(px + p*(0.12 + i*0.19), py + p*0.12);
      ctx.lineTo(px + p*(0.12 + i*0.19), py + p*0.88);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8c07d';
    ctx.beginPath(); ctx.arc(px + p*0.72, py + p*0.52, p*0.042, 0, TAU); ctx.fill();
  } else if(ty === 'bed'){
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.roundRect(px+p*0.10, py+p*0.16, p*0.86, p*0.78, p*0.10); ctx.fill();
    ctx.fillStyle = '#6f5a40';
    ctx.beginPath(); ctx.roundRect(px+p*0.06, py+p*0.10, p*0.88, p*0.80, p*0.10); ctx.fill();
    ctx.fillStyle = '#5b7ba6';
    ctx.beginPath(); ctx.roundRect(px+p*0.12, py+p*0.34, p*0.76, p*0.52, p*0.07); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.roundRect(px+p*0.12, py+p*0.34, p*0.76, p*0.14, p*0.06); ctx.fill();
    ctx.fillStyle = '#ece7da';
    ctx.beginPath(); ctx.roundRect(px+p*0.16, py+p*0.14, p*0.68, p*0.19, p*0.07); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.beginPath(); ctx.roundRect(px+p*0.16, py+p*0.28, p*0.68, p*0.05, p*0.02); ctx.fill();
  } else if(ty === 'table'){
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.roundRect(px+p*0.12, py+p*0.28, p*0.80, p*0.54, p*0.08); ctx.fill();
    ctx.fillStyle = '#8a6a44';
    ctx.beginPath(); ctx.roundRect(px+p*0.08, py+p*0.22, p*0.84, p*0.56, p*0.08); ctx.fill();
    ctx.fillStyle = '#ab8652';
    ctx.beginPath(); ctx.roundRect(px+p*0.08, py+p*0.22, p*0.84, p*0.18, p*0.06); ctx.fill();
    ctx.strokeStyle = 'rgba(88,64,38,.30)';
    ctx.lineWidth = Math.max(1, p*0.022);
    for(let i=1;i<3;i++){
      ctx.beginPath();
      ctx.moveTo(px + p*0.12, py + p*(0.22 + i*0.14));
      ctx.lineTo(px + p*0.88, py + p*(0.22 + i*0.14));
      ctx.stroke();
    }
    /* 碗碟 */
    ctx.fillStyle = '#e4e7e2';
    ctx.beginPath(); ctx.arc(px + p*0.34, py + p*0.55, p*0.09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(px + p*0.63, py + p*0.62, p*0.07, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c98f3f';
    ctx.beginPath(); ctx.arc(px + p*0.34, py + p*0.55, p*0.045, 0, TAU); ctx.fill();
  } else if(ty === 'fire'){
    /* 石圈 */
    for(let i=0;i<7;i++){
      const a = i/7*TAU;
      const sx = px + p/2 + Math.cos(a)*p*0.30, sy = py + p*0.64 + Math.sin(a)*p*0.17;
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.arc(sx, sy + p*0.02, p*0.078, 0, TAU); ctx.fill();
      ctx.fillStyle = i % 2 ? '#6a7078' : '#5a6068';
      ctx.beginPath(); ctx.arc(sx, sy, p*0.072, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.beginPath(); ctx.arc(sx - p*0.02, sy - p*0.02, p*0.030, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#3d2a1a';
    ctx.beginPath(); ctx.ellipse(px+p/2, py+p*0.64, p*0.21, p*0.10, 0, 0, TAU); ctx.fill();
    /* 炭火 */
    ctx.fillStyle = 'rgba(255,120,40,.55)';
    ctx.beginPath(); ctx.ellipse(px+p/2, py+p*0.64, p*0.14, p*0.06, 0, 0, TAU); ctx.fill();
    /* 火焰 */
    const f1 = Math.sin(now*0.013)*0.5 + 0.5;
    const f2 = Math.sin(now*0.019 + 1.7)*0.5 + 0.5;
    ctx.fillStyle = '#e2691f';
    ctx.beginPath();
    ctx.moveTo(px+p*0.34, py+p*0.60);
    ctx.quadraticCurveTo(px+p*0.38, py+p*0.24 - f1*p*0.06, px+p*0.50, py+p*0.10 - f1*p*0.11);
    ctx.quadraticCurveTo(px+p*0.62, py+p*0.26, px+p*0.66, py+p*0.60);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6a72e';
    ctx.beginPath();
    ctx.moveTo(px+p*0.41, py+p*0.60);
    ctx.quadraticCurveTo(px+p*0.45, py+p*0.34 - f2*p*0.05, px+p*0.50, py+p*0.24 - f2*p*0.07);
    ctx.quadraticCurveTo(px+p*0.56, py+p*0.36, px+p*0.59, py+p*0.60);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff0b8';
    ctx.beginPath();
    ctx.ellipse(px+p*0.50, py+p*0.54, p*0.045, p*0.075, 0, 0, TAU);
    ctx.fill();
  } else if(ty === 'shop'){
    /* 工坊：石基木墙 + 深色坡屋顶 + 烟囱冒烟 + 铁砧与炉火 */
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.roundRect(px+p*0.08, py+p*0.26, p*0.86, p*0.68, p*0.06); ctx.fill();
    /* 墙体 */
    ctx.fillStyle = '#8b7048';
    ctx.beginPath(); ctx.roundRect(px+p*0.06, py+p*0.30, p*0.88, p*0.62, p*0.05); ctx.fill();
    /* 木板缝 */
    ctx.strokeStyle = 'rgba(60,42,24,.35)';
    ctx.lineWidth = Math.max(1, p*0.020);
    for(let i=1;i<4;i++){
      ctx.beginPath();
      ctx.moveTo(px+p*0.06, py+p*(0.30 + i*0.16));
      ctx.lineTo(px+p*0.94, py+p*(0.30 + i*0.16));
      ctx.stroke();
    }
    /* 坡屋顶 */
    ctx.fillStyle = '#4a3a28';
    ctx.beginPath();
    ctx.moveTo(px+p*0.02, py+p*0.32);
    ctx.lineTo(px+p*0.50, py+p*0.08);
    ctx.lineTo(px+p*0.98, py+p*0.32);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.beginPath();
    ctx.moveTo(px+p*0.06, py+p*0.30);
    ctx.lineTo(px+p*0.50, py+p*0.10);
    ctx.lineTo(px+p*0.50, py+p*0.30);
    ctx.closePath(); ctx.fill();
    /* 烟囱 + 烟 */
    ctx.fillStyle = '#5c5346';
    ctx.fillRect(px+p*0.68, py+p*0.02, p*0.13, p*0.18);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(px+p*0.68, py+p*0.02, p*0.05, p*0.18);
    const sm = Math.sin(now*0.0022);
    for(let i=0;i<2;i++){
      ctx.fillStyle = `rgba(226,230,226,${0.13 - i*0.045})`;
      ctx.beginPath();
      ctx.arc(px+p*(0.745 + i*0.03 + sm*0.02), py+p*(0.00 - i*0.10), p*(0.055 + i*0.03), 0, TAU);
      ctx.fill();
    }
    /* 炉口火光 */
    const fg = 0.55 + Math.sin(now*0.009)*0.25;
    ctx.fillStyle = `rgba(244,150,52,${0.55*fg})`;
    ctx.beginPath(); ctx.ellipse(px+p*0.20, py+p*0.78, p*0.085, p*0.06, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,226,150,.5)';
    ctx.beginPath(); ctx.ellipse(px+p*0.20, py+p*0.78, p*0.040, p*0.028, 0, 0, TAU); ctx.fill();
    /* 铁砧 */
    ctx.fillStyle = '#3c424a';
    ctx.fillRect(px+p*0.46, py+p*0.66, p*0.26, p*0.075);
    ctx.beginPath();
    ctx.moveTo(px+p*0.42, py+p*0.66);
    ctx.lineTo(px+p*0.50, py+p*0.60);
    ctx.lineTo(px+p*0.56, py+p*0.66);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(px+p*0.53, py+p*0.735, p*0.12, p*0.055);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(px+p*0.46, py+p*0.66, p*0.26, Math.max(1, p*0.022));
    /* 挂着的工具 */
    ctx.strokeStyle = '#2f2519'; ctx.lineWidth = Math.max(1, p*0.022);
    ctx.beginPath(); ctx.moveTo(px+p*0.80, py+p*0.40); ctx.lineTo(px+p*0.80, py+p*0.56); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px+p*0.88, py+p*0.40); ctx.lineTo(px+p*0.88, py+p*0.52); ctx.stroke();
  } else if(ty === 'clinic'){
    /* 医务所：灰白墙 + 红十字 + 门口草药 */
    ctx.fillStyle = 'rgba(0,0,0,.20)';
    ctx.beginPath(); ctx.roundRect(px+p*0.08, py+p*0.18, p*0.86, p*0.76, p*0.07); ctx.fill();
    ctx.fillStyle = '#cfd3c9';
    ctx.beginPath(); ctx.roundRect(px+p*0.05, py+p*0.14, p*0.90, p*0.78, p*0.07); ctx.fill();
    ctx.fillStyle = '#e6e8df';
    ctx.beginPath(); ctx.roundRect(px+p*0.05, py+p*0.14, p*0.90, p*0.22, p*0.07); ctx.fill();
    /* 门 */
    ctx.fillStyle = '#7d6647';
    ctx.fillRect(px+p*0.42, py+p*0.52, p*0.16, p*0.40);
    /* 红十字 */
    ctx.fillStyle = '#c8423c';
    ctx.fillRect(px+p*0.19, py+p*0.24, p*0.055, p*0.16);
    ctx.fillRect(px+p*0.135, py+p*0.295, p*0.165, p*0.055);
    /* 窗 */
    ctx.fillStyle = 'rgba(150,200,215,.55)';
    ctx.fillRect(px+p*0.66, py+p*0.52, p*0.18, p*0.16);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(px+p*0.66, py+p*0.52, p*0.18, p*0.05);
    /* 晒草药 */
    ctx.strokeStyle = '#6f8f55'; ctx.lineWidth = Math.max(1, p*0.022);
    ctx.beginPath(); ctx.moveTo(px+p*0.80, py+p*0.72); ctx.lineTo(px+p*0.88, py+p*0.86); ctx.stroke();
    ctx.fillStyle = '#7fb06a';
    ctx.beginPath(); ctx.arc(px+p*0.86, py+p*0.80, p*0.035, 0, TAU); ctx.fill();
  } else if(ty === 'turret'){
    const ang = b.ang === undefined ? -Math.PI/2 : b.ang;
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    ctx.beginPath(); ctx.ellipse(px+p/2, py+p*0.72, p*0.32, p*0.12, 0, 0, TAU); ctx.fill();
    /* 底座 */
    ctx.fillStyle = '#3d434b';
    ctx.beginPath(); ctx.arc(px+p/2, py+p*0.56, p*0.31, 0, TAU); ctx.fill();
    ctx.fillStyle = '#575f69';
    ctx.beginPath(); ctx.arc(px+p/2, py+p*0.54, p*0.265, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.arc(px+p/2, py+p*0.52, p*0.20, 0, TAU); ctx.fill();
    /* 炮塔 */
    ctx.fillStyle = '#454c55';
    ctx.beginPath(); ctx.arc(px+p/2, py+p*0.52, p*0.155, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(px+p/2, py+p*0.52); ctx.rotate(ang);
    ctx.fillStyle = '#767f8b';
    ctx.fillRect(p*0.10, -p*0.048, p*0.38, p*0.096);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(p*0.10, -p*0.048, p*0.38, p*0.030);
    ctx.fillStyle = '#2f343b';
    ctx.fillRect(p*0.40, -p*0.062, p*0.075, p*0.124);
    ctx.restore();
    /* 弹药箱 */
    ctx.fillStyle = '#4a4436';
    ctx.fillRect(px + p*0.14, py + p*0.60, p*0.12, p*0.10);
    /* 选中射程 */
    if(state.sel && state.sel.kind === 'tile' && state.sel.x === x && state.sel.y === y){
      ctx.strokeStyle = 'rgba(232,163,61,.55)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6,5]);
      ctx.beginPath(); ctx.arc(px+p/2, py+p*0.52, p*(hasTech('turret2') ? 10.5 : 8.5), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  } else if(ty === 'den'){
    /* 匪巢（v1.8）：破棚 + 木桩 + 悬着的红布。
       玩家在缩到最小时也要能一眼扫到它 —— 这是「远征」局里唯一的目标点。 */
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath(); ctx.ellipse(px+p*0.5, py+p*0.90, p*0.48, p*0.16, 0, 0, TAU); ctx.fill();
    /* 火光晕：泥地和棚顶的颜色都太接近夜色，远看只剩一团糊影。
       加一圈暖光，缩到最小时也能一眼扫到"那边有人住"。 */
    const glow = ctx.createRadialGradient(px+p*0.5, py+p*0.66, p*0.05, px+p*0.5, py+p*0.66, p*0.85);
    glow.addColorStop(0, 'rgba(236,150,74,.26)');
    glow.addColorStop(1, 'rgba(236,150,74,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.ellipse(px+p*0.5, py+p*0.66, p*0.85, p*0.62, 0, 0, TAU); ctx.fill();
    /* 踩实的泥地 */
    ctx.fillStyle = '#4a3d30';
    ctx.beginPath(); ctx.ellipse(px+p*0.5, py+p*0.66, p*0.46, p*0.28, 0, 0, TAU); ctx.fill();
    /* 棚顶 */
    ctx.fillStyle = '#5c4a38';
    ctx.beginPath();
    ctx.moveTo(px + p*0.09, py + p*0.64);
    ctx.lineTo(px + p*0.50, py + p*0.08);
    ctx.lineTo(px + p*0.91, py + p*0.64);
    ctx.closePath(); ctx.fill();
    /* 棚顶受光面 */
    ctx.fillStyle = 'rgba(255,255,255,.11)';
    ctx.beginPath();
    ctx.moveTo(px + p*0.09, py + p*0.64);
    ctx.lineTo(px + p*0.50, py + p*0.08);
    ctx.lineTo(px + p*0.50, py + p*0.64);
    ctx.closePath(); ctx.fill();
    /* 门口 */
    ctx.fillStyle = '#191410';
    ctx.fillRect(px + p*0.37, py + p*0.62, p*0.26, p*0.28);
    /* 木桩 */
    ctx.strokeStyle = '#332a20';
    ctx.lineWidth = Math.max(1.2, p*0.07);
    for(let i=0;i<4;i++){
      const xx = px + p*(0.08 + i*0.28);
      ctx.beginPath();
      ctx.moveTo(xx, py + p*0.95);
      ctx.lineTo(xx + p*0.02, py + p*0.74);
      ctx.stroke();
    }
    /* 血旗：缩到最小也看得见的那一点红 */
    const wv = Math.sin(now*0.003)*p*0.03;
    ctx.fillStyle = '#8f2b26';
    ctx.beginPath();
    ctx.moveTo(px + p*0.50, py + p*0.05);
    ctx.lineTo(px + p*0.72 + wv, py + p*0.12);
    ctx.lineTo(px + p*0.50, py + p*0.21);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2b231b';
    ctx.lineWidth = Math.max(1, p*0.035);
    ctx.beginPath();
    ctx.moveTo(px + p*0.50, py + p*0.04);
    ctx.lineTo(px + p*0.50, py + p*0.30);
    ctx.stroke();
    /* 结构条：拆到一半得看得出来快塌了 */
    const hr = clamp(b.hp / (b.maxHp || 420), 0, 1);
    if(hr < 0.999){
      ctx.fillStyle = 'rgba(10,12,16,.55)';
      ctx.fillRect(px + p*0.10, py - p*0.16, p*0.80, Math.max(2, p*0.06));
      ctx.fillStyle = hr > 0.5 ? '#c08a4a' : '#e2564d';
      ctx.fillRect(px + p*0.10, py - p*0.16, p*0.80*hr, Math.max(2, p*0.06));
    }
  }

  /* 着火（v1.3 纵火者）：任何建筑都会有火舌与焦痕 */
  if(b.burn > 0){
    for(let i=0;i<3;i++){
      const tt = now*0.006 + i*2.1;
      const fx2 = px + p*(0.28 + i*0.22);
      const fy2 = py + p*(0.64 + Math.sin(tt*1.7)*0.05);
      const hh = p*(0.24 + 0.15*Math.sin(tt));
      ctx.fillStyle = i % 2 ? 'rgba(238,124,40,.72)' : 'rgba(246,176,58,.60)';
      ctx.beginPath();
      ctx.moveTo(fx2 - p*0.085, fy2);
      ctx.quadraticCurveTo(fx2 - p*0.05, fy2 - hh*0.6, fx2, fy2 - hh);
      ctx.quadraticCurveTo(fx2 + p*0.05, fy2 - hh*0.5, fx2 + p*0.085, fy2);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(26,14,6,.12)';
    ctx.fillRect(px, py, p+1, p+1);
  }
}

function jobDest(c){
  const j = c.job;
  if(!j) return null;
  if(j.type === 'fight' && j.foe) return { x:j.foe.fx, y:j.foe.fy, label:'交战', col:'#e2564d' };
  if(j.type === 'sleep' && j.bed) return { x:j.bed.x+0.5, y:j.bed.y+0.5, label:'床铺', col:'#5aa0f0' };
  if(j.x !== undefined && j.y !== undefined) return { x:j.x+0.5, y:j.y+0.5, label: jobName(c), col:'#7fd7c4' };
  return null;
}

/* =====================================================================
   18.5 · 悬停信息卡（v1.4）
   玩家想知道"这是什么、还要多久、谁在管"，就让屏幕上直接有答案。
   ===================================================================== */
const SP_NAME = { oak:'橡树', pine:'松树', birch:'白桦', dead:'枯木' };
let tipKey = '', tipSince = 0, tipLastCalc = 0, tipVisible = false;

function hideTip(){
  if(!tipVisible) return;
  tipVisible = false;
  const el = $('tip');
  if(el) el.classList.remove('on');
}

function hoverInfo(wx, wy){
  const a = pickActor(wx, wy);
  if(a) return actorTip(a);
  const t = worldToTile(wx, wy);
  if(t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) return null;
  const tl = tileAt(t.x, t.y);
  if(!tl) return null;
  if(tl.bld) return bldTip(tl, t.x, t.y);
  if(tl.zone) return zoneTip(tl, t.x, t.y);
  if(tl.plant) return plantTip(tl, t.x, t.y);
  return groundTip(tl, t.x, t.y);
}

function actorTip(a){
  const isCol = a.side === 'col';
  const rk = isCol ? null : (RKD[a.kind] || RKD.blade);
  let l2 = '', l3 = '';
  if(a.down){
    l2 = '<span class="warn">已倒地，等待救援</span>';
  } else if(isCol){
    l2 = a.job && a.job.type === 'fight' ? '<span class="warn">交战中</span>' : jobName(a);
    l3 = `心情 ${Math.round(a.needs.mood)} · 精力 ${Math.round(a.needs.rest)}`;
    if((a.wound || 0) >= 20) l3 += ` · <span class="warn">伤口 ${Math.round(a.wound)}</span>`;
  } else {
    l2 = a.target ? '正在进攻' : '在找目标';
  }
  return {
    key: 'a' + a.id,
    html: `<div class="t1"><i style="background:${isCol ? '#7fd7c4' : '#e2564d'}"></i>${a.name}</div>
      <div class="t2">${l2}</div>
      ${l3 ? `<div class="t2">${l3}</div>` : ''}
      <div class="t3">生命 <b>${Math.round(a.hp)}</b> / ${a.maxHp}${isCol ? '' : '<br>' + rk.d}</div>`
  };
}

function bldTip(t, x, y){
  const b = t.bld, def = BL[b.type], cap = bldMaxHp(b.type);
  const done = b.prog >= 1;
  const workers = state.cols.filter(c=> c.job && c.job.type === 'build' && c.job.x === x && c.job.y === y).length;
  /* 匪巢（v1.8）：单独给一块提示 —— 它不能建、不能拆，只能打 */
  if(b.type === 'den'){
    const guards = state.raiders.filter(r=> r.home && !r.dead && !r.down
      && Math.hypot(r.x - x, r.y - y) < 6).length;
    return {
      key: 'b' + x + ',' + y,
      html: `<div class="t1"><i style="background:#8f2b26"></i>匪巢</div>
        <div class="t2">结构 <b>${Math.round(b.hp)}</b> / ${cap}</div>
        <div class="t2">${guards ? `<span class="warn">${guards} 名巢卫还在，几乎拆不动</span>` : '守卫已清空，可以拆了'}</div>
        <div class="t3">选中居民后<b>右键点它</b>：派人去拆</div>`
    };
  }
  let l2 = '';
  if(!done){
    l2 = `施工 <b>${Math.round(b.prog * 100)}%</b> · ` +
      (workers ? `<b>${workers}</b> 人在建` : '<span class="warn">还没有人来建</span>');
    if(!canAfford(def.cost) && !b.paid) l2 += '<br><span class="warn">材料已投入，等待人力</span>';
  } else {
    l2 = `结构 <b>${Math.round(b.hp)}</b> / ${cap}`;
    if(b.hp < cap * 0.55) l2 += ' <span class="warn">（破损）</span>';
  }
  const tip = {
    wall:'挡住敌人，也挡住自己的路。留出门口。',
    door:'人可通行，敌人也会从这里进。',
    bed:'睡觉回精力，睡地上会扣心情。',
    fire:'取暖 + 心情。夜里的光。',
    turret:'自动射击射程内的敌人，别拆了它的射界。',
    table:'吃饭要用，没桌子只能站着吃。',
    shop:'研究入口。点开它选课题。',
    clinic:'消耗药草治疗伤口，建了才有稳定恢复。'
  }[b.type] || '';
  return {
    key: 'b' + x + ',' + y,
    html: `<div class="t1"><i style="background:#e8a33d"></i>${def.name}</div>
      <div class="t2">${l2}</div>
      ${b.burn > 0 ? '<div class="t2 warn">正在燃烧 · 结构持续受损</div>' : ''}
      ${tip ? `<div class="t3">${tip}</div>` : ''}`
  };
}

function plantTip(t, x, y){
  const p = t.plant;
  const nm = p.kind === 'tree' ? (SP_NAME[p.sp] || '树木')
    : p.kind === 'bush' ? '浆果丛'
    : p.kind === 'herb' ? '药草丛' : '作物';
  let l2 = '';
  if(p.kind === 'tree') l2 = '砍倒得 <b>14</b> 木材';
  else if(p.kind === 'bush') l2 = p.berries ? `可采 <b>${p.berries}</b> 份食物` : '已采空，过几天再结果';
  else if(p.kind === 'herb') l2 = '采 <b>2</b> 份药草，治伤要用';
  else l2 = p.grow >= 1 ? '<span class="ok">已成熟，等人来收</span>' : `成熟度 ${Math.round(p.grow * 100)}%`;
  return {
    key: 'p' + x + ',' + y,
    html: `<div class="t1"><i style="background:#6fbf6a"></i>${nm}</div><div class="t2">${l2}</div>`
  };
}

function zoneTip(t, x, y){
  const z = ZONE[t.zone];
  const who = state.cols.filter(c=> c.job && (c.job.type === 'sow' || c.job.type === 'haul') &&
    c.job.x === x && c.job.y === y).length;
  return {
    key: 'z' + x + ',' + y,
    html: `<div class="t1"><i style="background:#5aa0f0"></i>${z ? z.name : '区域'}</div>
      <div class="t2">${t.zone === 'stock' ? '搬运工把散落的木头石料集中到这里' : '作物成熟后自动有人来收'}</div>
      ${who ? `<div class="t3">${who} 人正在处理这格</div>` : ''}`
  };
}

function groundTip(t, x, y){
  const canB = !(t.g === T.WATER || t.g === T.ROCK) && !t.bld && !t.plant;
  return {
    key: 'g' + x + ',' + y,
    html: `<div class="t1"><i style="background:#8a94a0"></i>${T_NAME[t.g] || '地面'}</div>
      <div class="t2">${canB ? '可以建造' : t.g === T.WATER ? '水面，不能建造' : t.g === T.ROCK ? '岩壁，不能建造' : '先清掉上面的东西'}</div>`
  };
}

function tickTip(t){
  const el = $('tip');
  if(!el) return;
  if(!mouse.in || mouse.pan || state.build || state.drag){ hideTip(); tipKey = ''; return; }
  if(!tipLastCalc || t - tipLastCalc > 170){
    tipLastCalc = t;
    const info = hoverInfo(mouse.wx, mouse.wy);
    const k = info ? info.key : '';
    if(k !== tipKey){ tipKey = k; tipSince = t; }
    if(!info || t - tipSince < 150){ hideTip(); return; }
    el.innerHTML = info.html;
    el.classList.add('on');
    const r = el.getBoundingClientRect();
    let x = mouse.sx + 16, y = mouse.sy + 16;
    if(x + r.width > vw - 10) x = mouse.sx - r.width - 16;
    if(y + r.height > vh - 10) y = mouse.sy - r.height - 16;
    el.style.left = Math.max(8, x) + 'px';
    el.style.top = Math.max(8, y) + 'px';
    tipVisible = true;
  }
}

/* 选中居民时画出去向：虚线走位 + 终点脉冲 + 目的标签 */
function drawIntent(ox, oy, pts, now){
  const sel = state.sel;
  if(!sel || sel.kind !== 'col') return;
  const c = state.cols.find(x=> x.id === sel.id);
  if(!c || c.down || c.dead) return;
  const dest = jobDest(c);
  const seq = [{ x:c.fx, y:c.fy }];
  if(c.path) for(const n of c.path) seq.push({ x:n.x+0.5, y:n.y+0.5 });
  if(dest) seq.push({ x:dest.x, y:dest.y });
  if(seq.length < 2) return;
  const col = dest ? dest.col : '#7fd7c4';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.78;
  ctx.lineWidth = Math.max(1.5, pts*0.058);
  ctx.setLineDash([pts*0.20, pts*0.16]);
  ctx.lineDashOffset = -((now*0.022) % (pts*0.36));
  ctx.beginPath();
  ctx.moveTo(ox + seq[0].x*pts, oy + seq[0].y*pts);
  for(let i=1;i<seq.length;i++) ctx.lineTo(ox + seq[i].x*pts, oy + seq[i].y*pts);
  ctx.stroke();
  ctx.setLineDash([]);

  const e = seq[seq.length-1];
  const ex = ox + e.x*pts, ey = oy + e.y*pts;
  const ph = (now % 1300)/1300;
  ctx.globalAlpha = 0.65*(1-ph);
  ctx.lineWidth = Math.max(1.4, pts*0.038);
  ctx.beginPath(); ctx.arc(ex, ey, pts*(0.20 + ph*0.36), 0, TAU); ctx.stroke();

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(ex, ey, Math.max(1.6, pts*0.055), 0, TAU); ctx.fill();

  if(dest && pts > 22){
    ctx.font = `600 ${Math.max(10, pts*0.24)}px -apple-system,"PingFang SC",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(dest.label).width;
    const bw = tw + pts*0.32, bh = pts*0.34;
    /* 抬到目标格正上方，避开角色身体 */
    const ly = ey - pts*1.02;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(10,14,20,.82)';
    ctx.beginPath(); ctx.roundRect(ex - bw/2, ly - bh/2, bw, bh, pts*0.09); ctx.fill();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 1;
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.fillText(dest.label, ex, ly + 0.5);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

function drawActor(a, ox, oy, pts, z, now){
  const px = ox + a.fx*pts, py = oy + a.fy*pts;
  const isCol = a.side === 'col';
  const bodyR = pts*0.30;
  const bob = (a.state === 'move') ? Math.sin(now*0.012 + a.fx)*pts*0.03 : 0;

  // 影子
  ctx.fillStyle = 'rgba(0,0,0,.26)';
  ctx.beginPath(); ctx.ellipse(px, py+pts*0.22, bodyR*0.92, bodyR*0.38, 0, 0, TAU); ctx.fill();

  if(a.down){
    ctx.fillStyle = isCol ? a.shirt : '#5b2a2a';
    ctx.beginPath(); ctx.ellipse(px, py+pts*0.10, bodyR*1.15, bodyR*0.62, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = a.skin;
    ctx.beginPath(); ctx.arc(px - pts*0.16, py - pts*0.02, bodyR*0.52, 0, TAU); ctx.fill();
  } else {
    // 身体
    /* v2.1：掠袭者一律暗红，但偷粮贼穿土绿 —— 他是来搬东西的，不是来拼命的，
       颜色上就得和「来杀你的」分开，否则玩家会以为田里站着个掠袭兵。 */
    ctx.fillStyle = a.shirt || '#8a3030';
    ctx.beginPath(); ctx.roundRect(px-bodyR*0.82, py-bodyR*0.55+bob, bodyR*1.64, bodyR*1.5, bodyR*0.55); ctx.fill();
    // 头
    ctx.fillStyle = isCol ? a.skin : '#b98b6e';
    ctx.beginPath(); ctx.arc(px, py-bodyR*0.95+bob, bodyR*0.62, 0, TAU); ctx.fill();
    // 头发 / 头盔
    ctx.fillStyle = isCol ? a.hair : '#2b2f35';
    ctx.beginPath(); ctx.arc(px, py-bodyR*1.05+bob, bodyR*0.62, Math.PI*1.12, Math.PI*1.88); ctx.fill();
    // 武器
    if(a.weapon && a.weapon !== 'fists'){
      ctx.save();
      ctx.translate(px, py+bob); ctx.rotate(a.aim || 0);
      ctx.fillStyle = a.weapon === 'knife' ? '#cfd6dd' : '#3a4048';
      ctx.fillRect(bodyR*0.35, -bodyR*0.12, a.weapon === 'knife' ? bodyR*0.55 : bodyR*1.35, bodyR*0.20);
      ctx.restore();
    }
  }

  // 选中环（v1.9：框选的一队人全部点亮，不然玩家不知道框住了谁）
  const selOne = state.sel && state.sel.id === a.id;
  const selMany = state.sel && state.sel.kind === 'cols' && (state.sel.ids || []).includes(a.id);
  if(selOne || selMany){
    ctx.strokeStyle = selMany && !selOne ? '#7fc8ff' : '#e8a33d';
    ctx.lineWidth = selMany ? 1.6 : 2;
    ctx.beginPath(); ctx.ellipse(px, py+pts*0.22, bodyR*1.45, bodyR*0.62, 0, 0, TAU); ctx.stroke();
  }

  // 守夜者手上的火把（v1.6）：夜里能一眼看出谁还醒着
  if(isCol && !a.down && a.job && a.job.type === 'guard'){
    const gx = px + pts*0.19, gy = py - bodyR*1.15;
    const fl = 0.86 + Math.sin(now*0.011 + (a.id || 0)*1.7)*0.14;
    const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, pts*0.8*fl);
    grd.addColorStop(0, 'rgba(255,198,112,.50)');
    grd.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(gx, gy, pts*0.8*fl, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd08a';
    ctx.beginPath(); ctx.arc(gx, gy, Math.max(1.1, pts*0.048), 0, TAU); ctx.fill();
  }

  // 偷粮贼的麻袋（v2.1）：鼓不鼓，一眼就知道他得手没有
  if(!isCol && a.kind === 'thief' && a.sack > 0 && !a.down){
    const sw = pts*0.20, sh = pts*(0.13 + Math.min(3, a.sack)*0.040);
    const sx = px + bodyR*1.02, sy = py - bodyR*0.10 + bob;
    ctx.fillStyle = '#d8bf84';
    ctx.beginPath(); ctx.ellipse(sx, sy, sw, sh, 0.24, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(58,44,26,.75)';
    ctx.lineWidth = Math.max(1, pts*0.022);
    ctx.beginPath();
    ctx.moveTo(sx - sw*0.62, sy - sh*0.58); ctx.lineTo(sx + sw*0.62, sy - sh*0.58);
    ctx.stroke();
    /* 斜跨的背带：一眼看出"这袋子是他的赃物" */
    ctx.strokeStyle = 'rgba(58,44,26,.55)';
    ctx.lineWidth = Math.max(1, pts*0.016);
    ctx.beginPath();
    ctx.moveTo(px - bodyR*0.5, py - bodyR*1.05 + bob);
    ctx.lineTo(sx, sy - sh*0.7);
    ctx.stroke();
  }

  // 血条
  if(a.hp < a.maxHp - 0.5){
    const w = pts*0.52, hh = Math.max(2, pts*0.075);
    const hx = px - w/2, hy = py - bodyR*2.5;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.roundRect(hx-1, hy-1, w+2, hh+2, 2); ctx.fill();
    const r = clamp(a.hp/a.maxHp, 0, 1);
    ctx.fillStyle = r > 0.55 ? '#57c07a' : r > 0.25 ? '#e8a33d' : '#e2564d';
    ctx.beginPath(); ctx.roundRect(hx, hy, w*r, hh, 1.5); ctx.fill();
  }

  // 状态标记
  if(!a.down){
    let mark = null;
    if(a.sleeping) mark = 'z';
    else if(!isCol) mark = null;
    else if(a.breakT > 0) mark = '!';
    else if(a.needs.hunger < 22) mark = 'f';
    else if(a.job && a.job.type === 'fight') mark = 'x';
    else if(a.job && a.job.type === 'guard') mark = 'o';
    if(mark){
      const my = py - bodyR*2.9 + Math.sin(now*0.005)*pts*0.03;
      ctx.fillStyle = 'rgba(10,14,20,.72)';
      ctx.beginPath(); ctx.roundRect(px+pts*0.16, my-pts*0.20, pts*0.30, pts*0.28, pts*0.07); ctx.fill();
      ctx.fillStyle = mark === '!' ? '#e2564d' : mark === 'x' ? '#f08b84' : '#9aa7b6';
      ctx.font = `700 ${pts*0.22}px -apple-system,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(mark.toUpperCase(), px+pts*0.31, my-pts*0.05);
      ctx.textBaseline = 'alphabetic';
    }
  }

  // 名字
  if(z > 0.82 && isCol){
    ctx.font = `600 ${Math.max(9, pts*0.26)}px -apple-system,"PingFang SC",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillText(a.name, px+0.7, py+pts*0.50+0.7);
    ctx.fillStyle = a.down ? '#f08b84' : 'rgba(255,255,255,.92)';
    ctx.fillText(a.name, px, py+pts*0.50);
  }

  /* 闲聊气泡（v2.0）：快消失时淡出，不要「啪」一下没了 */
  if(isCol && a.bubble && !a.down && z > 0.74){
    const txt = a.bubble.t;
    const fs = Math.max(9.5, pts*0.265);
    ctx.font = `500 ${fs}px -apple-system,"PingFang SC",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + pts*0.36;
    const bh = fs + pts*0.22;
    const bx = px - w/2, by = py - bodyR*3.7 - bh;
    ctx.globalAlpha = clamp(a.bubble.ttl / 55, 0, 1);
    ctx.fillStyle = 'rgba(14,18,25,.88)';
    ctx.beginPath(); ctx.roundRect(bx, by, w, bh, bh*0.36); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - pts*0.09, by + bh - 0.5);
    ctx.lineTo(px + pts*0.09, by + bh - 0.5);
    ctx.lineTo(px, by + bh + pts*0.13);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(238,244,250,.94)';
    ctx.fillText(txt, px, by + bh*0.52);
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }
}

function drawGhost(ox, oy, pts){
  const g = state.build;
  const t = worldToTile(mouse.wx, mouse.wy);
  if(t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) return;

  if(g.type === 'zone'){
    const r = dragRect(t);
    let okN = 0, badN = 0;
    for(let y=r.y0; y<=r.y1; y++) for(let x=r.x0; x<=r.x1; x++){
      const tt = tileAt(x,y); if(!tt) continue;
      const ok = tt.g !== T.WATER && tt.g !== T.ROCK;
      if(ok) okN++; else badN++;
      ctx.fillStyle = ok ? 'rgba(90,160,240,.22)' : 'rgba(226,86,77,.25)';
      ctx.fillRect(ox+x*pts, oy+y*pts, pts+1, pts+1);
      ctx.strokeStyle = ok ? 'rgba(120,180,250,.6)' : 'rgba(226,86,77,.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox+x*pts+1.5, oy+y*pts+1.5, pts-3, pts-3);
    }
    /* 拖拽实时预览：尺寸 / 可用格数 */
    const w = r.x1 - r.x0 + 1, hh = r.y1 - r.y0 + 1;
    const txt = `${w}×${hh} · ${okN} 格可用` + (badN ? ` · ${badN} 格不可用` : '');
    const cx2 = ox + (r.x0 + r.x1 + 1) * pts / 2;
    const cy2 = oy + r.y0 * pts;
    ctx.font = `600 ${Math.max(10, pts*0.30)}px -apple-system,"PingFang SC",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(txt).width;
    const bw = tw + pts*0.34, bh2 = pts*0.42;
    ctx.fillStyle = 'rgba(10,14,20,.84)';
    ctx.beginPath(); ctx.roundRect(cx2 - bw/2, cy2 - bh2 - pts*0.10, bw, bh2, pts*0.09); ctx.fill();
    ctx.fillStyle = badN ? '#f0b9b4' : '#bcd8f5';
    ctx.fillText(txt, cx2, cy2 - bh2/2 - pts*0.10);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    return;
  }

  if(g.kind === 'decon') return;
  if(g.kind === 'rally'){
    const ok = passable(t.x, t.y);
    ctx.fillStyle = ok ? 'rgba(78,201,165,.25)' : 'rgba(226,86,77,.25)';
    ctx.fillRect(ox+t.x*pts, oy+t.y*pts, pts+1, pts+1);
    ctx.strokeStyle = ok ? '#4ec9a5' : '#e2564d';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox+t.x*pts+1.5, oy+t.y*pts+1.5, pts-3, pts-3);
    return;
  }

  const def = BL[g.type];
  if(!def) return;
  const tt = tileAt(t.x, t.y);
  const ok = canPlace(g.type, t.x, t.y);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = ok ? 'rgba(78,201,165,.35)' : 'rgba(226,86,77,.35)';
  ctx.beginPath(); ctx.roundRect(ox+t.x*pts+2, oy+t.y*pts+2, pts-4, pts-4, 5); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ok ? '#4ec9a5' : '#e2564d';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox+t.x*pts+2, oy+t.y*pts+2, pts-4, pts-4);
  const afford = canAfford(def.cost);
  if(!afford){
    ctx.fillStyle = '#e2564d';
    ctx.font = `700 ${pts*0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('资源不足', ox+t.x*pts+pts/2, oy+t.y*pts+pts*0.62);
  }
}

function dragRect(t){
  let a = state.drag || t, b = t;
  return {
    x0: clamp(Math.min(a.x,b.x),0,W-1), x1: clamp(Math.max(a.x,b.x),0,W-1),
    y0: clamp(Math.min(a.y,b.y),0,H-1), y1: clamp(Math.max(a.y,b.y),0,H-1)
  };
}

