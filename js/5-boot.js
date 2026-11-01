/* =====================================================================
   5-boot.js · 启动
   边陲 v1.5 · 模块化拆分（原单文件第 5 部分）
   ===================================================================== */

/* =====================================================================
   22 · 初始化与主循环
   ===================================================================== */
function newGame(seed, diff, scen, amb){
  if(diff && DIFFS[diff]) state.diff = diff;
  if(scen && SCEN[scen]) state.scen = scen;
  if(amb && AMB[amb]) state.amb = amb;
  const df = diffDef();
  const sc = scenDef();
  const sd = seed || Math.floor(Math.random()*1e9);
  state.min = 360; state.day = 1;
  /* v1.8：野心可以改变目标周期 —— 拆三个巢和守住三个人，不该一样长 */
  state.goalDay = df.goal + (sc.goalDelta || 0) + (ambMod().goalBonus || 0); state.endless = false;
  state.res = { wood:0, stone:0, food:0, meal:0, herb:0 };
  state.cols = []; state.raiders = []; state.fx = []; state.decals = [];
  state.dens = [];   // v1.8.1：匪巢坐标缓存，denRisk() 用它避开危险区
  state.log = []; state.sel = null; state.build = null; state.drag = null;
  state.speed = 1; state.paused = false; state.over = null; state.endAck = false; state.weather = '晴';
  state.slow = 1;
  state.daySnap = null;
  state.rain = 0; state.seq = 1;
  state.stats = { wood:0, stone:0, kills:0, built:0, raids:0, deaths:0, dens:0, trades:0, wealth:0, thieves:0, herb:0 };
  state.tech = { done:{}, cur:null, prog:0 }; state.cmd = null;
  state.stage = { idx:0, done:[], failed:[] };
  state.pending = []; state.usedChoices = []; state.skipRaid = 0;
  /* v2.0：第二幕与催工都是「本局」状态。不在这里清掉的话，上一局把谁卖了，
     新开一局照样「此后不再有新人加入」—— 而且没有任何提示。 */
  state.act2 = null; state.urge = null;
  /* v2.1 农田 / 偷粮贼：品种回到麦，贼的时间闸和随机流都要重来。
     贼用自己的种子 —— 同一局重开，它的出现节奏一致，方便复现和回归。 */
  state.crop = 'wheat';
  state.thiefT = 0;
  reseedThieves(sd);
  state.watch = 1; state.watchSet = false; state.nightRaid = null;
  state.nightTimes = 0; state.nightRepel = 0; state.guardSpot = null;
  state.totalPop = sc.pop || 3;
  /* v2.2：种子要留下来。跨局档案里「用同一种子重打」全靠它，
     没有这一行，那一局就永远只是个分数。 */
  state.seed = sd;
  state.recDone = false;

  const __t0 = performance.now();
  mapSet(sc.map);
  genMap(sd);
  window.__genMs = Math.round(performance.now() - __t0);

  const used = new Set();
  for(let i=0;i<state.totalPop;i++){
    let name;
    do { name = pick(NAMES); } while(used.has(name));
    used.add(name);
    let spot = null;
    for(let k=0;k<200;k++){
      const x = (W>>1) + rint(-4,4), y = (H>>1) + rint(-4,4);
      if(passable(x,y)){ spot = {x,y}; break; }
    }
    if(!spot) spot = { x:W>>1, y:H>>1 };
    const c = makeColonist(name, spot.x, spot.y);
    setupWeapon(c);
    /* 疫区：前排两人带着未愈的伤口进场 */
    if(sc.wound && i < sc.wound){
      c.wound = 55 + rint(0,10);
      c.hp = Math.round(c.maxHp * 0.72);
    }
    state.cols.push(c);
  }

  /* v2.2：档案初始化必须在这之后 —— 个人史挂在人身上 */
  archInit();
  /* 远征野心要在开局就把三个匪巢放好：地图上的目标必须第一天就看得见，
     否则玩家前十天不知道该往哪走。

     但必须等幸存者落位之后再放，而且量距离要以「人」为基准。
     按地图中心算是错的：出生点本身就有 ±4 格的抖动，三处营地物件又往外铺，
     11 格的保护圈经常只剩七八格 —— 巢卫的枪能打六格，枪口就架到火堆边了，
     开局第一顿饭还没吃完，人就先被打倒。 */
  if(state.amb === 'raid'){
    const n = Math.max(1, state.cols.length);
    const ax = state.cols.reduce((s,c)=> s + c.x, 0) / n;
    const ay = state.cols.reduce((s,c)=> s + c.y, 0) / n;
    const nDen = spawnDens({ x:ax, y:ay });
    window.__denCount = nDen;
    /* 放不下就别硬开局：选了「远征」却一个匪巢都没有，
       玩家会跑到第 22 天才发现目标栏一直是 0/3。 */
    if(nDen < 3){
      state.amb = 'hold';
      window.__denCount = 0;
      setTimeout(()=> toast('这张图放不下三个匪巢，已改用「守成」'), 80);
    }
  } else window.__denCount = 0;

  // 起始仓库区 + 初始物资（物资必须在仓库格里才算数）
  const zoneCells = [];
  for(let y=(H>>1)-2; y<=(H>>1)-1; y++)
    for(let x=(W>>1)+1; x<=(W>>1)+3; x++){
      const t = tileAt(x,y);
      if(t && t.g !== T.WATER && t.g !== T.ROCK && !t.plant){ t.zone = 'stock'; zoneCells.push({x,y}); }
    }
  state.res = { wood:0, stone:0, food:0, meal:0, herb:0 };
  /* 筑城野心带 60 石进场：现实里「来筑城的人」也是带着家伙来的。
     不给的话，12 段墙要挖 8 次矿，等于把前三天全押在采石上。 */
  const stone0 = state.amb === 'fortify' ? 120 : 60;
  [['wood',120],['stone',stone0],['food',16],['meal',6],['herb',3]].forEach(([k,n], i)=>{
    const c0 = zoneCells[i % Math.max(1, zoneCells.length)];
    if(c0) addItems(c0.x, c0.y, k, Math.round(n * df.resMul * (sc.res[k] || 1)));
  });

  centerOn(W>>1, H>>1);
  cam.z = 1.05; clampCam();
  closeModal();
  initBuild();
  uiDirty.side = true; uiDirty.log = true;
  undoStack.length = 0;
  logEvent(`剧本：<b>${sc.name}</b> · ${sc.tag}　难度：<b>${df.name}</b> · 目标第 ${state.goalDay} 天`, '');
  logEvent(`${sc.pop} 名幸存者在边境落脚了。先圈一块<b>仓库区</b>，再造张床。`, 'good');
  logEvent('提示：地面上的木头石料需要有人搬进仓库区才会集中。', '');
  /* 危机（v2.0）：本局两场，日期在这里就定死，玩家能提前看到 */
  state.crises = state.endless ? [] : planCrises();
}

let acc = 0, lastT = 0, lastUI = 0;

function loop(t){
  requestAnimationFrame(loop);
  if(!lastT) lastT = t;
  const dt = Math.min(0.12, (t - lastT)/1000);
  lastT = t;

  if(hitStop > 0) hitStop = Math.max(0, hitStop - dt);
  if(!state.paused && !state.over && hitStop <= 0){
    /* 战术慢放（v1.9）：接敌时时间压到 0.5×，玩家才有手可以动。
       以前只是把 4 倍速打回 1 倍速，1 倍速下 8 秒打完一仗，还是来不及。 */
    acc += dt * SPEED[state.speed] * (state.slow || 1);
    let steps = Math.floor(acc);
    acc -= steps;
    steps = Math.min(steps, 240);
    for(let i=0;i<steps;i++) simMinute();
  } else {
    acc = 0;
  }

  if(alertTimer > 0){
    alertTimer -= dt;
    if(alertTimer <= 0) $('alert').innerHTML = '';
  }

  SFX.update(dt);
  updateCamSwing(dt);
  updateShake(dt);
  updateVignette(dt);
  updateCameraKeys(dt);
  tickTip(t);
  /* 截图专用：用"这一帧的相机"重算框选矩形，保证框和人对得上 */
  if(window.__shotSel){
    const ps = window.__shotSel.map(c=> worldToScreen(c.fx*TS, c.fy*TS));
    boxSel = {
      a: true,
      sx: Math.min(...ps.map(p=> p.x)) - 42,
      sy: Math.min(...ps.map(p=> p.y)) - 84,
      cx: Math.max(...ps.map(p=> p.x)) + 42,
      cy: Math.max(...ps.map(p=> p.y)) + 44
    };
  }
  draw(t);

  if(!lastUI || t - lastUI > 200){ lastUI = t; updateUI(); }
}

function init(){
  resize();
  bindInput();
  newGame();
  const q = new URLSearchParams(location.search);
  if(q.has('seed') || q.has('diff') || q.has('scen') || q.has('amb')){
    newGame(q.has('seed') ? (Number(q.get('seed')) || 1) : undefined,
            q.has('diff') ? q.get('diff') : undefined,
            q.has('scen') ? q.get('scen') : undefined,
            q.has('amb') ? q.get('amb') : undefined);
  }
  if(q.has('endless')){ state.endless = true; state.goalDay = 3; }
  /* 守夜人数可由 URL 指定，便于对比不同策略（v1.6） */
  if(q.has('watch')) state.watch = clamp(Number(q.get('watch')) || 0, 0, 4);
  /* v1.3 演示场景：工坊 / 医务所 / 加固墙 + 三种新兵种 */
  if(q.has('v13demo')){
    const cx = W>>1, cy = H>>1;
    const zc = stockpileTiles();
    if(zc[0]){
      addItems(zc[0].x, zc[0].y, 'wood', 500);
      const z2 = zc[Math.min(1, zc.length-1)];
      addItems(z2.x, z2.y, 'stone', 500);
      addItems(z2.x, z2.y, 'herb', 8);
    }
    const put = (type, tx, ty)=>{
      for(let r=0;r<8;r++){
        for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
          if(Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx+dx, y = ty+dy;
          if(canPlace(type, x, y)){
            placeBuilding(type, x, y);
            const t = tileAt(x, y);
            if(t.bld) t.bld.prog = 1;
            return { x, y };
          }
        }
      }
      return null;
    };
    state.tech.done.tools = true; state.tech.done.wall2 = true; state.tech.done.clinic = true;
    state.tech.cur = 'turret2'; state.tech.prog = 120;
    const spots = {};
    spots.shop = put('shop', cx+3, cy-3); spots.clinic = put('clinic', cx-4, cy-2);
    spots.bed = put('bed', cx-1, cy+1);
    spots.fire = put('fire', cx+1, cy+1); spots.turret = put('turret', cx+3, cy-5);
    for(let x=cx-6;x<=cx+5;x++){
      const y = cy - 6;
      if(canPlace('wall', x, y)){ placeBuilding('wall', x, y); const t = tileAt(x,y); if(t.bld) t.bld.prog = 1; }
    }
    for(const k of ['brute','torch','slinger']) state.raiders.push(makeRaider(cx-9, cy+7, 2, k));
    /* 展示用：一名受伤 + 一段友情 + 一段积怨 */
    if(state.cols.length >= 3){
      const a = state.cols[0];
      a.wound = 42; a.hp = 62;
      a.bonds = [{ id: state.cols[1].id, v: 72 }, { id: state.cols[2].id, v: -78 }];
    }
    window.__F.sim(3);
    state.paused = true;
    state.sel = { kind:'col', id: state.cols[0].id };
    if(q.has('spots')) document.title = 'DEMO::' + JSON.stringify(spots);
    if(q.has('tech')) showTech();
  }
  /* 截图 / 演示用：一块正在运转的农田（荒地 + 三种作物 + 一个得手的偷粮贼） */
  if(q.has('farmshot')){
    newGame(7, 'calm', 'valley');
    grantRes({ wood: 400, stone: 300, food: 60, herb: 6 });
    const cx = W>>1, cy = H>>1;
    for(let y=cy+1; y<cy+5; y++) for(let x=cx-7; x<cx+1; x++) setZone('farm', x, y);
    const kinds = ['wheat', 'bean', 'root', 'herb'];
    const grows = [1, 0.72, 0.40, 0.95];
    let k = 0;
    for(let y=cy+1; y<cy+5; y++) for(let x=cx-7; x<cx+1; x++){
      const t = tiles[y*W+x];
      if(t.zone !== 'farm') continue;
      if(y >= cy+3) continue;                 // 后两行留荒地，让"待开荒"看得见
      t.soil = 'tilled'; t.fert = groundFert(t.g);
      if(k % 5 !== 4) t.plant = { kind:'crop', crop: kinds[k % 4], grow: grows[k % 4], sway: k * 0.8 };
      k++;
    }
    const th = makeRaider(cx - 4, cy + 2, 2, 'thief');
    th.sack = 2;
    state.raiders.push(th);
    /* 不 return：init 末尾才启动渲染循环，提前返回会得到一块黑屏 */
    centerOn(cx - 3.4, cy + 2.4);
    cam.z = 2.15; clampCam();
    state.paused = true; window.__shotSlow = true;
    uiDirty.side = true;
  }
  if(q.has('caravan')){ showCaravan(); return; }  if(q.has('intro')){ state.paused = true; showIntro(); return; }
  if(q.has('zonetest')){
    const res0 = { ...state.res };
    let spot = null;
    for(let y=(H>>1)+3; y<H-1 && !spot; y++)
      for(let x=(W>>1)+4; x<W-1; x++){
        const t = tileAt(x,y);
        if(t && !t.zone && !t.bld && !t.plant && passable(x,y)){ spot = {x,y}; break; }
      }
    const ok1 = setZone('farm', spot.x, spot.y);
    const z1 = tileAt(spot.x, spot.y).zone;
    const ok2 = undoLast();
    const z2 = tileAt(spot.x, spot.y).zone;
    const resOk = ['wood','stone','food','meal'].every(k=> (res0[k]||0) === (state.res[k]||0));
    document.title = 'ZONE::' + JSON.stringify({ ok1, z1, ok2, z2, resOk });
    return;
  }
  if(q.has('undotest')){
    const res0 = { ...state.res };
    let spot = null;
    for(let y=(H>>1)+1; y<H-1 && !spot; y++)
      for(let x=(W>>1); x<W-1; x++) if(canPlace('wall', x, y)){ spot = {x,y}; break; }
    if(!spot){ document.title = 'UNDO::{"err":"no spot"}'; return; }
    const ok1 = placeBuilding('wall', spot.x, spot.y);
    const built = !!tileAt(spot.x, spot.y).bld;
    const resAfterBuild = { ...state.res };
    const ok2 = undoLast();
    const gone = !tileAt(spot.x, spot.y).bld;
    const resAfterUndo = { ...state.res };
    const same = ['wood','stone','food','meal'].every(k=> (res0[k]||0) === (resAfterUndo[k]||0));
    document.title = 'UNDO::' + JSON.stringify({ ok1, built, ok2, gone, same, res0, resAfterBuild, resAfterUndo });
    return;
  }
  /* v1.3 系统自检：科技 / 医疗 / 兵种 / 火焰 / 后撤 / 指令 / 存档 */
  if(q.has('v13')){
    const R = {};
    try{
      const cx = W>>1, cy = H>>1;
      const st0 = stockpileTiles();
      if(st0.length){
        addItems(st0[0].x, st0[0].y, 'wood', 400);
        addItems(st0[Math.min(1,st0.length-1)].x, st0[Math.min(1,st0.length-1)].y, 'stone', 400);
      }
      const findSpot = (type)=>{
        for(let y=cy+2; y<H-2; y++)
          for(let x=cx-8; x<cx+8; x++)
            if(canPlace(type, x, y)) return { x, y };
        return null;
      };
      /* 1. 工坊 + 研究 */
      const sp = findSpot('shop');
      R.shop = sp ? placeBuilding('shop', sp.x, sp.y) : 'no-spot';
      if(sp) tileAt(sp.x, sp.y).bld.prog = 1;
      R.shopBuilt = countBuilt('shop');
      R.startTech = (()=>{ window.startTech('tools'); return state.tech.cur; })();
      window.__F.sim(200);
      R.toolsDone = hasTech('tools');

      /* 2. 医疗：伤口 + 医务所 + 药草 */
      state.tech.done.clinic = true;
      const cp = findSpot('clinic');
      R.clinic = cp ? placeBuilding('clinic', cp.x, cp.y) : 'no-spot';
      if(cp) tileAt(cp.x, cp.y).bld.prog = 1;
      const st = stockpileTiles()[0];
      if(st) addItems(st.x, st.y, 'herb', 6);
      const c0 = state.cols[0];
      c0.wound = 70; c0.hp = 50;
      const w0 = c0.wound;
      window.__F.sim(700);
      R.woundDrop = Math.round(w0 - (state.cols[0] ? state.cols[0].wound : 0));
      R.herbLeft = Math.round(state.res.herb || 0);

      /* 3. 火焰烧蚀（放在刷怪之前，避免破门槌干扰） */
      const wp = findSpot('wall');
      if(wp){
        placeBuilding('wall', wp.x, wp.y);
        const wt = tileAt(wp.x, wp.y);
        wt.bld.prog = 1; wt.bld.burn = 200;
        const hp0 = wt.bld.hp;
        window.__F.sim(100);
        R.burnDmg = wt.bld ? Math.round(hp0 - wt.bld.hp) : 'destroyed';
      }

      /* 4. 兵种 */
      for(const k of ['blade','brute','slinger','torch','wolf']){
        const r = makeRaider(cx+12, cy+12, 2, k);
        R['hp_'+k] = r.maxHp;
        state.raiders.push(r);
      }
      R.raiderKinds = state.raiders.map(r=> r.kind).join('|');

      /* 5. 后撤触发（附近必须有敌人才会触发） */
      const c1 = state.cols[1];
      if(c1){
        if(state.raiders[0]){
          const r0 = state.raiders[0];
          r0.x = c1.x + 2; r0.y = c1.y; r0.fx = r0.x + 0.5; r0.fy = r0.y + 0.5;
        }
        const before = { hp: Math.round(c1.hp), max: c1.maxHp, down: c1.down, dead: c1.dead };
        hurt(c1, 85, null);
        R.flee = c1.flee;
        R.c1 = before;
        R.c1After = { hp: Math.round(c1.hp), down: c1.down, dead: c1.dead };
      } else R.c1 = 'missing';

      /* 6. 指令（先把人从睡眠里叫起来，否则会被睡觉状态接走） */
      if(state.raiders.length){
        for(const c of state.cols){ c.sleeping = false; c.job = null; c.state = 'idle'; c.path = null; c.flee = 0; }
        setCommand({ kind:'focus', id: state.raiders[state.raiders.length-1].id });
        window.__F.sim(2);
        R.focusJob = state.cols.map(c=> c.job && c.job.type).filter(Boolean).join(',');
        setCommand({ kind:'rally', x: cx, y: cy });
        window.__F.sim(2);
        R.rallyJob = state.cols.map(c=> c.job && c.job.type).filter(Boolean).join(',');
        setCommand({ kind:'retreat' });
        window.__F.sim(2);
        R.retreatJob = state.cols.map(c=> c.job && c.job.type).filter(Boolean).join(',');
        R.cmdStill = state.cmd && state.cmd.kind;
        setCommand(null);
      }

      /* 7. 特质 */
      R.traits = state.cols.map(c=> (c.traits || []).join('+')).join(' / ');

      /* 8. 存档往返 */
      R.save = saveGame();
      loadGame();
      R.techKept = hasTech('tools');
      R.traitsKept = state.cols.every(c=> (c.traits || []).length > 0);
    } catch(e){
      R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << ');
    }
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V13::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }

  /* v1.4 自检：心情账单 / 悬停卡 / 意图线 / 崩溃归因 */
  if(q.has('v14')){
    const R = { errs: [] };
    try{
      window.__F.sim(140);
      const c = state.cols[0];
      const bd = moodBreakdown(c);
      R.moodItems = bd.items.length;
      R.moodBase = bd.base;
      R.moodTarget = Math.round(moodTarget(c));
      R.moodSum = Math.round(bd.base + bd.items.reduce((a, i)=> a + i.v, 0));
      const wb = whyBlock(c);
      R.whyHasBase = wb.includes('趋向') && wb.includes('当前');
      R.fixBtns = (wb.match(/data-act="whyfix"/g) || []).length;

      const bi = tiles.findIndex(t=> t.bld && t.bld.prog >= 1);
      if(bi >= 0){
        const bx = bi % W, by = (bi / W) | 0;
        const info = hoverInfo((bx + 0.5) * TS, (by + 0.5) * TS);
        R.tipBld = info ? info.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 56) : 'none';
      }
      const pi = tiles.findIndex(t=> t.plant && t.plant.kind === 'tree');
      if(pi >= 0){
        const px = pi % W, py = (pi / W) | 0;
        const info = hoverInfo((px + 0.5) * TS, (py + 0.5) * TS);
        R.tipPlant = info ? info.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : 'none';
      }
      R.tipGround = (()=>{
        const g = hoverInfo(1.5 * TS, 1.5 * TS);
        return g ? g.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 36) : 'none';
      })();
      const ai = hoverInfo(c.fx * TS, c.fy * TS);
      R.tipActor = ai ? ai.html.includes(c.name) : false;

      const dest = jobDest(c);
      R.dest = dest ? dest.label : 'none';
      R.hasPath = !!(c.path && c.path.length);

      /* 造一个负面场景，确认明细条目与'怎么办'按钮真的会出现 */
      const c2 = state.cols[1] || c;
      const bak = { hu: c2.needs.hunger, re: c2.needs.rest };
      c2.needs.hunger = 10; c2.needs.rest = 15;
      const bd2 = moodBreakdown(c2);
      R.moodItemsBad = bd2.items.length;
      R.moodFixes = bd2.items.filter(i=> i.fix).length;
      R.moodDrop = Math.round(moodTarget(c2));
      c2.needs.hunger = bak.hu; c2.needs.rest = bak.re;

      R.crash = crashReason(c);
      R.errs = window.__errs.slice(0, 4);
    }catch(e){ R.err = e.message; }
    document.title = 'TEST::' + JSON.stringify(R);
  }
  /* v1.6 自检：守夜排班 / 夜袭 / 偷袭加成 / 疲劳代价 / 篝火压制 / 存档 */
  /* v1.7 自检：个人指令 / 到期交还 / 战术降速 */
  /* v1.8 自检：五张野心 / 压力分叉 / 匪巢守卫不追远 / 守卫减伤 / 拆巢 */
  /* v1.9 自检：框选 / 编队移动 / 整队突击 / 战术技能与冷却 / 战术慢放 */
  if(q.has('v19')){
    const R = { checks:{} };
    window.__fastTest = true;
    try{
      /* 1. 框选 */
      newGame(7, 'calm', 'valley');
      const all = state.cols.length;
      selectBox({ sx:-99999, sy:-99999, cx:99999, cy:99999 });
      R.box = { all, picked: selColonists().length, kind: state.sel && state.sel.kind };
      R.checks.boxSelect = R.box.picked === all && R.box.kind === 'cols';

      /* 1b. 精确框选：只框住第一个人，就只该选中他一个。
         单位错一个 TS，全屏框选照样"通过"，只有小框能测出来。 */
      const only = state.cols[0];
      const op = worldToScreen(only.fx * TS, only.fy * TS);
      let picked1 = -1;
      for(const pad of [26, 40, 60]){
        selectBox({ sx:op.x - pad, sy:op.y - pad, cx:op.x + pad, cy:op.y + pad });
        picked1 = selColonists().length;
        if(picked1 === 1) break;
      }
      R.checks.boxTight = picked1 === 1;

      /* 2. 编队移动：每个人分到不同落点，不能全挤一格 */
      selectBox({ sx:-99999, sy:-99999, cx:99999, cy:99999 });
      moveGroup(selColonists(), state.cols[0].x + 4, state.cols[0].y + 4);
      const tg = state.cols.map(c=> c.order ? (c.order.x + ',' + c.order.y) : '-');
      R.checks.groupMove = state.cols.every(c=> !!c.order) && new Set(tg).size === state.cols.length;

      /* 3. 整队突击同一个敌人 */
      newGame(7, 'calm', 'valley');
      spawnRaid(1, 0, { night:false });
      let foe = state.raiders.find(r=> !r.dead && !r.down);
      R.checks.foe = !!foe;
      if(foe){
        selectBox({ sx:-99999, sy:-99999, cx:99999, cy:99999 });
        /* pickActor 吃的是世界像素，不是格子坐标 —— 差一个 TS 就会点空 */
        handleLeftClick({ x:foe.fx*TS, y:foe.fy*TS }, { x:foe.x, y:foe.y });
        R.checks.groupAttack = state.cols.every(c=> c.order && c.order.kind === 'attack');
      }

      /* 4. 战术技能：放得出去，也进冷却 */
      newGame(7, 'calm', 'valley');
      const c0 = state.cols[0];
      spawnRaid(1, 0, { night:false });
      foe = state.raiders.find(r=> !r.dead && !r.down);
      if(foe){
        foe.x = clamp(c0.x + 2, 1, W-2); foe.y = c0.y;
        foe.fx = foe.x + 0.5; foe.fy = foe.y + 0.5; foe.path = null;
      }
      const used = useSkill(c0, true);
      R.skill = { used, cd: Math.round(c0.skillCd || 0), weapon: c0.weapon };
      R.checks.skillCast = used === true && c0.skillCd > 0;

      /* 5. 冷却会走 */
      const cd0 = c0.skillCd;
      for(let i=0;i<30;i++) stepColonist(c0, 1);
      R.checks.cdTicks = c0.skillCd < cd0;

      /* 6. 慢放只在三个以上敌人时开，脱战自动收回 */
      newGame(7, 'calm', 'valley');
      spawnRaid(2, 0, { night:false });
      const s2 = state.slow;
      spawnRaid(3, 0, { night:false });
      const s5 = state.slow;
      R.slow = { two:s2, more:s5 };
      R.checks.slowOnRaid = s2 === 1 && s5 === 0.5;
      state.raiders = [];
      for(let i=0;i<6;i++) simMinute();
      R.checks.slowRecover = state.slow === 1;

      /* 7. 拆巢指令必须会过期：人走不到就该把指令交还，
         而不是带着一条永不过期的命令在野外站到天荒地老 */
      newGame(7, 'calm', 'valley', 'raid');
      let denAt = null;
      tiles.forEach((t, i)=>{ if(!denAt && t.bld && t.bld.type === 'den') denAt = { x:i%W, y:(i/W)|0 }; });
      R.denAt = denAt;
      if(denAt && state.cols[0]){
        const c1 = state.cols[0];
        giveOrder(c1, { kind:'demolish', x:denAt.x, y:denAt.y }, true);
        R.demolishSetTtl = c1.order && c1.order.ttl;
        c1.order.ttl = 5;                       // 把沙漏拨到快漏完
        for(let i=0;i<12;i++) simMinute();
        R.checks.demolishTtl = !c1.order;
      } else R.checks.demolishTtl = false;

      /* 8. 巢毁之后不能留下"没家的守卫"：追人追远了的那一个也得跟着散 */
      newGame(7, 'calm', 'valley', 'raid');
      denAt = null;
      tiles.forEach((t, i)=>{ if(!denAt && t.bld && t.bld.type === 'den') denAt = { x:i%W, y:(i/W)|0 }; });
      if(denAt){
        const g = state.raiders.find(r=> r.home && r.home.x === denAt.x && r.home.y === denAt.y);
        if(g){ g.x = clamp(denAt.x + 10, 1, W-2); g.y = denAt.y; g.fx = g.x + 0.5; g.fy = g.y + 0.5; }
        damageBuilding(denAt.x, denAt.y, 9999);
        R.checks.orphanGuard = !state.raiders.some(r=> r.home && r.home.x === denAt.x && r.home.y === denAt.y);
      } else R.checks.orphanGuard = false;

      /* 9. 守卫数量要进档：杀干净了存个档再读，不能又站回两个 */
      newGame(7, 'calm', 'valley', 'raid');
      const dens9 = [];
      tiles.forEach((t, i)=>{ if(t.bld && t.bld.type === 'den') dens9.push({ x:i%W, y:(i/W)|0 }); });
      if(dens9.length === 3){
        state.raiders = state.raiders.filter(r=>
          !(r.home && r.home.x === dens9[0].x && r.home.y === dens9[0].y));
        const before9 = state.raiders.filter(r=> r.home).length;
        const saved9 = saveGame();
        loadGame();
        R.loadErr = window.__loadErr || null;
        R.saved9 = saved9;
        const after0 = state.raiders.filter(r=> r.home
          && r.home.x === dens9[0].x && r.home.y === dens9[0].y).length;
        const afterAll = state.raiders.filter(r=> r.home).length;
        R.guards = { before:before9, after0, afterAll };
        R.checks.guardSaved = before9 === 4 && after0 === 0 && afterAll === 4;
      } else R.checks.guardSaved = false;

      /* 10. 睡着的人不该能开枪 */
      newGame(7, 'calm', 'valley', 'raid');
      const c10 = state.cols[0];
      spawnRaid(1, 0, { night:false });
      const foe10 = state.raiders.find(r=> !r.dead && !r.down && !r.home);
      if(foe10){ foe10.x = clamp(c10.x + 2, 1, W-2); foe10.y = c10.y;
        foe10.fx = foe10.x + 0.5; foe10.fy = foe10.y + 0.5; }
      c10.sleeping = true;
      R.checks.skillSleep = useSkill(c10, true) === false;

      /* 11. 匪巢不能被「拆除」按钮铲平：能铲的话远征三下鼠标就通关了，
             而且不记战功 —— 巢没了、目标栏还是 0/3，这一局直接死档 */
      newGame(7, 'calm', 'valley', 'raid');
      denAt = null;
      tiles.forEach((t, i)=>{ if(!denAt && t.bld && t.bld.type === 'den') denAt = { x:i%W, y:(i/W)|0 }; });
      if(denAt){
        const dens0 = state.stats.dens || 0;
        deconstructAt(denAt.x, denAt.y);
        const still = tileAt(denAt.x, denAt.y);
        R.checks.denUndeconstructable = !!(still && still.bld && still.bld.type === 'den')
          && (state.stats.dens || 0) === dens0;
      } else R.checks.denUndeconstructable = false;

      /* 12. 一张够不到的蓝图不能把整个工地钉死。
             jobBuild 只试「最近的那一张」的话，工人会每轮挑中它、
             寻路失败、放弃，旁边够得着的墙也跟着没人建 ——
             玩家看到的是「工人不干活」，而不是「那面墙建不了」。 */
      newGame(7, 'calm', 'valley');
      let pA = null, pB = null;
      for(let y=3; y<H-3 && !pA; y++) for(let x=3; x<W-3 && !pA; x++){
        let ok = true;
        for(let dy=-2; dy<=2 && ok; dy++) for(let dx=-2; dx<=2 && ok; dx++)
          if(!passable(x+dx, y+dy)) ok = false;
        if(ok) pA = { x, y };
      }
      if(pA){
        /* 外圈再找一张：距离至少 4，保证它比 pA 更远 */
        for(let r=4; r<9 && !pB; r++){
          for(let dy=-r; dy<=r && !pB; dy++) for(let dx=-r; dx<=r && !pB; dx++){
            if(Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = pA.x+dx, y = pA.y+dy;
            if(x<1||y<1||x>=W-1||y>=H-1) continue;
            if(passable(x,y) && !tiles[y*W+x].bld) pB = { x, y };
          }
        }
      }
      if(pA && pB){
        tiles[pA.y*W + pA.x].bld = { type:'wall', prog:0, hp:150, cdT:0, ang:0, burn:0 };
        tiles[pB.y*W + pB.x].bld = { type:'wall', prog:0, hp:150, cdT:0, ang:0, burn:0 };
        const c12 = state.cols[0];
        /* 挪到 pA 旁边，让「最近的那张」确实是够不到的那张 */
        c12.x = pA.x - 2; c12.y = pA.y;
        c12.fx = c12.x + 0.5; c12.fy = c12.y + 0.5; c12.path = null; c12.job = null;
        /* 用一次性的 goTo 替身把 pA 标成「到不了」，等价于被墙围死的情况 */
        const goReal = goTo;
        window.goTo = (cc, x, y, adj)=> (x === pA.x && y === pA.y) ? false : goReal(cc, x, y, adj);
        let ok12 = false;
        try{
          const got = jobBuild(c12);
          ok12 = !!(got && c12.job && c12.job.x === pB.x && c12.job.y === pB.y);
          R.build = { a:[pA.x,pA.y], b:[pB.x,pB.y], job: c12.job && [c12.job.x, c12.job.y] };
        } finally {
          window.goTo = goReal;
        }
        R.checks.buildSkip = ok12;
      } else R.checks.buildSkip = false;
    }catch(e){ R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << '); }
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V19::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }
  if(q.has('v20')){
    const R = { checks:{} };
    window.__fastTest = true;
    try{
      /* 1. 干劲会被工作抽走。抽不动的话「一天能推进多少」就没有上限，
             整条 v2.0 的取舍逻辑都是空的。 */
      newGame(7, 'calm', 'valley');
      const c1 = state.cols[0];
      c1.vigor = VIGOR_MAX;
      c1.job = { type:'chop', x:c1.x, y:c1.y, dur: 999999 };
      c1.state = 'work';
      for(let i=0;i<200;i++) stepColonist(c1, 1);
      R.vigor = { after: Math.round(c1.vigor), max: VIGOR_MAX };
      R.checks.vigorDrain = c1.vigor < VIGOR_MAX - 15;

      /* 2. 见底之后不再接重活（砍 / 挖 / 建 / 种），只能干轻活或去坐着 */
      c1.vigor = 2; c1.job = null; c1.state = 'idle'; c1.path = null;
      c1.order = null; c1.carry = null;
      assignJob(c1);
      const jt = c1.job && c1.job.type;
      R.tiredJob = jt;
      R.checks.vigorStopHeavy = !(jt === 'chop' || jt === 'mine' || jt === 'build' || jt === 'sow');

      /* 3. 跨天回满：昨天累趴不该拖到今天。
             要在「刚跨天」那一刻看 —— 等一整天过去人又干了一阵，数值自然不是满的。 */
      newGame(7, 'calm', 'valley');
      state.cols[0].vigor = 3;
      const day3 = state.day;
      for(let i=0;i<1500 && state.day === day3;i++) simMinute();
      const v3 = state.cols[0] ? state.cols[0].vigor : 0;
      R.vigorDaily = { day: state.day, v: Math.round(v3) };
      R.checks.vigorDaily = state.day > day3 && v3 >= 90;

      /* 4. 危机：每局两场，日期落在中局且不早于第 4 天 */
      newGame(7, 'calm', 'valley');
      R.crises = (state.crises || []).map(x=> x.dueDay);
      R.checks.crisisPlan = (state.crises || []).length === 2
        && state.crises.every(cr=> cr.dueDay >= 4 && cr.dueDay <= state.goalDay);

      /* 5. 备齐了就通过，而且仓库里那份东西要真的少掉 ——
             否则「交东西换平安」就变成了白拿 */
      let stk = null;
      tiles.forEach((t, i)=>{ if(!stk && t.zone === 'stock') stk = { x:i%W, y:(i/W)|0 }; });
      if(stk){
        state.crises = [{ id:'flood', dueDay: state.day, seen:true, state:'wait' }];
        addItems(stk.x, stk.y, 'stone', 99);
        recountRes();
        const cr5 = state.crises[0], cur5 = crisisCur(cr5);
        const need5 = crisisDef('flood').need.n;
        settleCrisis(cr5);
        R.crisisOk = { cur: cur5, need: need5, after: crisisCur(cr5), st: cr5.state };
        R.checks.crisisSettleOk = cur5 >= need5 && cr5.state === 'ok'
          && crisisCur(cr5) <= cur5 - need5;
      } else R.checks.crisisSettleOk = false;

      /* 6. 没备齐就砸下来 */
      newGame(7, 'calm', 'valley');
      state.res.stone = 0;
      state.crises = [{ id:'flood', dueDay: state.day, seen:true, state:'wait' }];
      settleCrisis(state.crises[0]);
      R.checks.crisisFail = state.crises[0].state === 'failed';

      /* 7. 主动认栽：不砸东西，只赔人心 —— 这是「我选择放弃」和「我忘了」的区别 */
      newGame(7, 'calm', 'valley');
      const m0 = state.cols[0].needs.mood;
      state.crises = [{ id:'flood', dueDay: state.day, seen:true, state:'wait' }];
      const dec = declineCrisis(state.crises[0]);
      R.checks.crisisDecline = dec === true && state.crises[0].state === 'declined'
        && state.cols[0].needs.mood <= m0 - 5;

      /* 8. 第二幕「成交」：走一个人，换来一箱东西；且不能选第二次 */
      newGame(7, 'calm', 'valley');
      const pop0 = state.cols.length;
      state.tech.cur = 'tools'; state.tech.prog = 0;
      pickAct2('sell');
      R.act2 = { pop: [pop0, state.cols.length], wood: Math.round(state.res.wood),
                 act: state.act2, tech: Math.round(state.tech.prog) };
      R.checks.act2Sell = state.cols.length === pop0 - 1 && state.act2 === 'sell'
        && state.tech.prog >= techDef('tools').time;
      const popA = state.cols.length;
      pickAct2('refuse');                      // 已经选过，必须无效
      R.checks.act2Lock = state.cols.length === popA && state.act2 === 'sell';
      /* 8b. 新开一局要把上局的「不再加人」清掉，否则第二局永远没人来 */
      newGame(7, 'calm', 'valley');
      R.checks.act2Reset = state.act2 === null;

      /* 9. 重伤留旧伤：伤口拖到 72 以上，跨天就该落一样下来 */
      newGame(7, 'calm', 'valley');
      const c9 = state.cols[0];
      c9.wound = 80;
      c9.debuffs = [];
      onNewDay(state.day + 1);
      R.checks.debuffOnce = (c9.debuffs || []).length === 1;

      /* 10. 旧伤要真的改数值，不能只是挂个标签 */
      newGame(7, 'calm', 'valley');
      const c10 = state.cols[0];
      c10.debuffs = [];
      const sp0 = speedMul(c10);
      c10.debuffs = ['lame'];
      R.checks.debuffWorks = speedMul(c10) < sp0 * 0.9;

      /* 11. 会说话 */
      newGame(7, 'calm', 'valley');
      const c11 = state.cols[0];
      c11.bubble = null;
      saySomething(c11);
      R.bubble = c11.bubble && c11.bubble.t;
      R.checks.bubble = !!(c11.bubble && c11.bubble.t && c11.bubble.ttl > 0);

      /* 12. 节奏：1x 一天 55 秒 */
      R.pace = { sp1: SPEED[1], daySec: Math.round(1440 / SPEED[1]) };
      R.checks.pace = SPEED[1] === 26 && Math.round(1440 / SPEED[1]) <= 56;
    }catch(e){ R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << '); }
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V20::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }
  /* v2.2 运行档案：每日快照 / 个人史 / 讣告 / 复盘 / 跨局战绩
     ------------------------------------------------------------------
     这一版改的全是「记录」，最大的风险不是记错，而是记录本身抽了签 ——
     一次 rnd 就重排世界线，前面十局长局回归全作废。所以 snapNoRnd 是命门。 */
  if(q.has('v22')){
    const R = { checks:{} };
    const savedRNG = RNG;
    window.__fastTest = true;
    try{
      /* 1. 跨天要留档，且记的是「刚过完的那一天」 */
      newGame(7, 'calm', 'valley');
      state.snaps = []; state.dayLog = {};
      const d0 = state.day;
      onNewDay(d0 + 1);
      R.snap = { n: state.snaps.length, first: state.snaps[0] && state.snaps[0].d, day0: d0 };
      R.checks.snapPush = state.snaps.length === 1 && state.snaps[0].d === d0
                          && typeof state.snaps[0].wall === 'number';

      /* 2. 快照不许抽签 */
      let calls = 0;
      RNG = ()=>{ calls++; return 0.5; };
      snapshotDay();
      RNG = savedRNG;
      R.check_snapCalls = calls;
      R.checks.snapNoRnd = calls === 0;

      /* 3. 个人史去重：挨饿的人一天会触发几十次，不去重就全是同一句 */
      const c0 = state.cols[0];
      c0.hist = []; state.day = 4;
      hurt(c0, 9, { name:'掠袭者甲', kind:'raider', side:'raid' });
      noteHist(c0, '同一天同一句', '');
      noteHist(c0, '同一天同一句', '');
      noteHist(c0, '同一天同一句', '');
      R.hist = { n: c0.hist.length, same: c0.hist.filter(h=> h.s === '同一天同一句').length };
      R.checks.histDedup = R.hist.same === 1 && c0.hist.length >= 2;
      /* 同一晚被两个人打，只留一条 —— 否则个人史会变成一串「被打伤」 */
      const caller = (nm)=> ({ name:nm, kind:'raider', side:'raid' });
      hurt(c0, 9, caller('掠袭者乙'));
      hurt(c0, 9, caller('掠袭者丙'));
      R.histWound = c0.hist.filter(h=> /打伤/.test(h.s)).length;
      R.checks.histWoundOnce = R.histWound === 1;

      /* 4. 讣告要记得死在谁手上 */
      const c1 = state.cols[1];
      c1.hp = 1;
      state.kia = [];
      hurt(c1, 200, { name:'掠袭者测试', kind:'raider', side:'raid' });
      R.kia = state.kia[0] || null;
      R.checks.kiaRecord = state.kia.length === 1
        && state.kia[0].by === '掠袭者测试' && state.kia[0].d === state.day;

      /* 5. 瓶颈诊断：全员没劲时要说出「劲用完了」，而不是「人人有活干」 */
      newGame(7, 'calm', 'valley');
      for(const c of state.cols) c.vigor = 0;
      const bn = bottleneckNow();
      R.bn = bn.map(i=> i.t);
      R.checks.bottleneck = bn.some(i=> /劲用完/.test(i.t));
      for(const c of state.cols) c.vigor = VIGOR_MAX;
      R.checks.bottleneckOk = bottleneckNow().every(i=> i.k !== 'bad');

      /* 6. 复盘能定位崩塌那天，并带上当天的原话 */
      state.snaps = [];
      state.dayLog = {};
      for(let d=1; d<=5; d++){
        state.snaps.push({ d, pop:4, mood:60, food:40, meal:10, built:d, wall:d*2,
                           down:0, hunger:80, turret:0 });
      }
      state.snaps[2].pop = 2; state.snaps[2].mood = 28; state.snaps[2].hunger = 30;
      state.dayLog[3] = [{ s:'<b>陈默</b> 阵亡 —— 死在掠袭者3手上', k:'bad' }];
      state.day = 3;
      const pm = postMortem();
      R.pm = pm;
      R.checks.pmDetect = pm.length > 0 && pm[0].d === 3;
      R.checks.pmEvent = pm.length > 0 && pm[0].why.some(w=> /阵亡/.test(w.s));

      /* 7. 运行档案：记一次、不重复、带种子 */
      const bak2 = (()=>{ try{ return localStorage.getItem(SLOT_KEYS[2]); }catch(e){ return null; } })();
      try{ localStorage.removeItem('frontier-runs'); }catch(e){}
      newGame(4242, 'calm', 'valley', 'hold');
      state.over = 'win';
      recordRun(); recordRun();
      const runs = loadRuns();
      R.runs = { n: runs.length, seed: runs[0] && runs[0].seed };
      R.checks.recordOnce = runs.length === 1;
      R.checks.recordSeed = !!(runs[0] && runs[0].seed === 4242 && runs[0].win === true);

      /* 8. 同种子必须复现同一张图：不然「同种子重打」只是换了个开局 */
      const fp = ()=> tiles.reduce((a, t, i)=> a + t.g * ((i % 13) + 1), 0) + ':' + tiles.length;
      newGame(4242, 'calm', 'valley', 'hold');
      const fa = fp();
      newGame(4242, 'calm', 'valley', 'hold');
      R.checks.seedReplay = fa === fp();

      /* 9. 存档要带上档案层 —— 不然读档之后结算只剩一行分数 */
      state.snaps = [{ d:1, pop:3, wall:0 }];
      state.kia = [{ n:'某人', d:1, by:'掠袭者', k:null }];
      state.dayLog = { 1: [{ s:'测试', k:'' }] };
      saveGame(2);
      const raw = JSON.parse(localStorage.getItem(SLOT_KEYS[2]) || 'null');
      try{ if(bak2) localStorage.setItem(SLOT_KEYS[2], bak2); else localStorage.removeItem(SLOT_KEYS[2]); }catch(e){}
      R.checks.saveArch = !!(raw && Array.isArray(raw.snaps) && Array.isArray(raw.kia)
                            && raw.dayLog && typeof raw.seed === 'number');

      /* 10. 人口卡片要带个人史 —— 老存档没有 hist 字段，不能整个面板挂掉 */
      R.checks.histGuard = typeof colPanel(state.cols[0]) === 'string';
    }catch(e){ R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << '); }
    RNG = savedRNG;
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V22::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }

  if(q.has('v21')){
    const R = { checks:{} };
    const savedRNG = RNG;          // 断言里会临时顶掉主流，出任何岔子都要还回去
    window.__fastTest = true;
    try{
      /* 找个能圈农田的空地：离第一个居民不远、不是水/岩、没有建筑和植物 */
      const farmSpot = ()=>{
        const c0 = state.cols[0];
        for(let r=1; r<9; r++){
          for(const d of [[r,0],[0,r],[-r,0],[0,-r],[r,r],[-r,-r],[r,-r],[-r,r]]){
            const x = Math.round(c0.x + d[0]), y = Math.round(c0.y + d[1]);
            const t = tileAt(x, y);
            if(!t || t.bld || t.zone || t.plant) continue;
            if(t.g === T.WATER || t.g === T.ROCK) continue;
            return { x, y, t };
          }
        }
        return null;
      };

      /* 1. 圈完地是荒地 —— 圈了就等于是地块自动变良田的话，开荒这道工序不存在 */
      newGame(7, 'calm', 'valley');
      const sp = farmSpot();
      R.spot = sp ? (sp.x + ',' + sp.y) : 'none';
      if(sp){
        setZone('farm', sp.x, sp.y);
        R.checks.tillNeeded = sp.t.zone === 'farm' && sp.t.soil !== 'tilled';
      } else R.checks.tillNeeded = false;

      /* 2. 开荒之后才变熟地，地力按地形给（花甸最肥、沙地最薄） */
      let fx = sp ? sp.x : -1, fy = sp ? sp.y : -1;
      if(fx >= 0){
        const want = groundFert(sp.t.g);
        finishJob(state.cols[0], { type:'till', x:fx, y:fy });
        R.fert0 = { g: sp.t.g, got: +(sp.t.fert||0).toFixed(3), want: +want.toFixed(3) };
        R.checks.tillWorks = sp.t.soil === 'tilled' && Math.abs((sp.t.fert||0) - want) < 1e-6;
      } else R.checks.tillWorks = false;

      /* 3. 播种要把当前选的品种记下去 —— 选了半天不生效等于没选 */
      if(fx >= 0){
        const t = tileAt(fx, fy);
        finishJob(state.cols[0], { type:'sow', x:fx, y:fy, crop:'bean' });
        R.sow = t.plant && t.plant.crop;
        R.checks.sowCrop = !!(t.plant && t.plant.crop === 'bean');
      } else R.checks.sowCrop = false;

      /* 4/5. 同一块地、同样地力：麦比豆收得多，但麦把地抽瘦、豆把地养肥 */
      if(fx >= 0){
        const t = tileAt(fx, fy);
        const fa = countItem('food');
        t.fert = 0.7; t.plant = { kind:'crop', crop:'wheat', grow:1, sway:0 };
        finishJob(state.cols[0], { type:'harvest', x:fx, y:fy });
        const wheatN = countItem('food') - fa, afterWheat = t.fert;
        const fb = countItem('food');
        t.fert = 0.7; t.plant = { kind:'crop', crop:'bean', grow:1, sway:0 };
        finishJob(state.cols[0], { type:'harvest', x:fx, y:fy });
        const beanN = countItem('food') - fb, afterBean = t.fert;
        R.yield = { wheat: wheatN, bean: beanN };
        R.fertAfter = { wheat: +afterWheat.toFixed(3), bean: +afterBean.toFixed(3) };
        R.checks.yieldOrder = wheatN > beanN && beanN > 0;
        R.checks.fertCycle = afterWheat < 0.7 && afterBean > 0.7;
      } else { R.checks.yieldOrder = false; R.checks.fertCycle = false; }

      /* 6/7. 生长速度：豆最快；冬天只有根菜还长（麦在冬天完全停摆） */
      if(fx >= 0){
        const t = tileAt(fx, fy);
        const probe = (crop, winter)=>{
          t.plant = { kind:'crop', crop, grow:0, sway:0 };
          const prev = SCEN.valley.winter;
          SCEN.valley.winter = winter;
          state.rain = 0; state.tech.done = {};
          growPlants(200);
          SCEN.valley.winter = prev;
          return +(t.plant ? t.plant.grow : 1).toFixed(4);
        };
        const gW = probe('wheat', false), gB = probe('bean', false);
        const gR = probe('root', true), gWw = probe('wheat', true);
        R.grow = { wheat:gW, bean:gB, rootWinter:gR, wheatWinter:gWw };
        R.checks.cropRate = gB > gW * 1.3;
        R.checks.rootWinter = gR > 0 && gWw === 0;
      } else { R.checks.cropRate = false; R.checks.rootWinter = false; }

      R.checks.cropDef = cropDef(undefined).n === '麦' && CROP_KEYS.length === 4;
      R.checks.tillHeavy = VIGOR_COST.till > VIGOR_COST.sow;

      /* 8. 没熟作物就不该有贼：贼是「收成」的威胁，不是「时间」的威胁 */
      newGame(7, 'calm', 'valley');
      tiles.forEach(t=>{ if(t.zone === 'farm'){ t.zone = null; t.plant = null; t.soil = null; } });
      state.day = 6; state.thiefT = 0;
      state.raiders = [];
      let mainCalls = 0;
      RNG = ()=>{ mainCalls++; return 0.5; };
      let noneRipe = 0;
      for(let i=0;i<20;i++){ state.thiefT = 999; updateThieves(10); }
      noneRipe = state.raiders.filter(r=> r.kind === 'thief').length;

      /* 造几格熟地，再看贼来不来 */
      const c0b = state.cols[0];
      const made = [];
      for(let r=1; r<7 && made.length < 4; r++){
        for(const d of [[r,0],[0,r],[-r,0],[0,-r],[r,r],[-r,-r]]){
          const x = Math.round(c0b.x + d[0]), y = Math.round(c0b.y + d[1]);
          const t = tileAt(x, y);
          if(!t || t.bld || t.g === T.WATER || t.g === T.ROCK) continue;
          t.zone = 'farm'; t.soil = 'tilled'; t.fert = 0.7;
          t.plant = { kind:'crop', crop:'wheat', grow:1, sway:0 };
          made.push({ x, y });
        }
      }
      let spawned = 0, spawnCalls = 0;
      for(let i=0;i<60 && !spawned;i++){
        state.thiefT = 999;
        updateThieves(10);
        spawned = state.raiders.filter(r=> r.kind === 'thief').length;
      }
      spawnCalls = mainCalls;
      R.thiefSpawn = { ripe: made.length, noneRipe, spawned, rndCalls: spawnCalls };
      R.checks.thiefOnlyRipe = noneRipe === 0 && spawned > 0;
      /* 这条是这次改动的命门：贼要是吃了主 rnd，整条世界线会重排，
         v2.0 那十局长局回归就全作废了。 */
      R.checks.thiefNoMainRnd = spawnCalls === 0;

      /* 9. 贼下田 → 熟地少一格、兜里多一份 */
      const th = state.raiders.find(r=> r.kind === 'thief');
      if(th && made.length){
        th.x = made[0].x; th.y = made[0].y;
        th.fx = made[0].x + 0.5; th.fy = made[0].y + 0.5;
        const before = countRipeCrops();
        for(let i=0;i<90;i++) updateThief(th, 1);
        R.thiefRun = { before, after: countRipeCrops(), sack: th.sack, st: th.state,
                       rndCalls: mainCalls - spawnCalls };
        R.checks.thiefLoot = th.sack > 0 && countRipeCrops() < before;
      } else R.checks.thiefLoot = false;

      /* 10. 打死贼要能把粮拿回来 */
      if(th){
        const f0 = countItem('food');
        th.sack = 7;
        dropLoot(th);
        R.checks.thiefDrop = countItem('food') === f0 + 7 && th.sack === 0;
      } else R.checks.thiefDrop = false;

      RNG = savedRNG;
    }catch(e){ RNG = savedRNG; R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << '); }
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V21::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }
  if(q.has('v18')){
    const R = { checks:{} };
    window.__fastTest = true;
    try{
      /* 1. 五张野心都要有目标、三阶段、压力修正 */
      newGame(7, 'calm', 'valley');
      R.amb = {};
      for(const k of AMB_KEYS){
        state.amb = k;
        const st = stageDefs();
        R.amb[k] = { st: st.length, last: st[2] ? st[2].need.length : -1, goal: !!AMB[k].goal };
      }
      R.checks.ambAll = AMB_KEYS.every(k=> R.amb[k].goal && R.amb[k].st === 3 && R.amb[k].last > 0);

      /* 2. 压力必须真的分叉：不然五张野心只是五块记分牌 */
      state.amb = 'hold';    const pHold = ambMul('raidMul');
      state.amb = 'shelter'; const pShelter = ambMul('raidMul');
      state.amb = 'fortify'; const sFort = ambMul('stoneMul');
      R.mods = { hold:pHold, shelter:pShelter, stoneFort:sFort };
      R.checks.pressureDiff = pShelter > pHold && sFort > 1;

      /* 3. 远征：三个巢 + 九个守卫 + 守卫都带 home */
      newGame(7, 'calm', 'valley', 'raid');
      let dens = tiles.filter(t=> t.bld && t.bld.type === 'den');
      let guards = state.raiders.filter(r=> r.home);
      R.dens = { n: dens.length, guards: guards.length };
      R.checks.densSpawned = dens.length === 3 && guards.length === 6;

      /* 4. 守卫不追远：把居民全挪到地图另一头，40 分钟后守卫还得在巢边 */
      const den0 = dens[0], di = tiles.indexOf(den0);
      const ddx0 = di % W, ddy0 = (di / W) | 0;
      for(const c of state.cols){ c.x = clamp(W - 4, 1, W-2); c.y = clamp(2, 1, H-2); c.fx = c.x+0.5; c.fy = c.y+0.5; c.path = null; }
      for(let i=0;i<40;i++){ for(const r of state.raiders) updateRaider(r, 1); }
      const away = state.raiders.filter(r=> r.home).every(r=> Math.hypot(r.x-r.home.x, r.y-r.home.y) < 6);
      R.checks.guardStayHome = away;

      /* 5. 守卫活着时匪巢几乎拆不动；清掉守卫才恢复正常伤害 */
      const hp0 = den0.bld.hp;
      damageBuilding(ddx0, ddy0, 30);
      const lost1 = hp0 - den0.bld.hp;
      state.raiders = state.raiders.filter(r=> !r.home);
      const hp1 = den0.bld.hp;
      damageBuilding(ddx0, ddy0, 30);
      const lost2 = hp1 - den0.bld.hp;
      R.dmg = { guarded:+lost1.toFixed(1), open:+lost2.toFixed(1) };
      R.checks.guardShield = lost1 < 15 && lost2 >= 29;

      /* 6. 拆掉要计数，而且地图上真的没了 */
      damageBuilding(ddx0, ddy0, 999);
      R.checks.denDown = state.stats.dens === 1 && !den0.bld;

      /* 7. 拆巢指令要能把人走过去（TTL 也得够走完 15 格） */
      newGame(7, 'calm', 'valley', 'raid');
      dens = tiles.filter(t=> t.bld && t.bld.type === 'den');
      const dn = dens[0], dni = tiles.indexOf(dn);
      const dx1 = dni % W, dy1 = (dni / W) | 0;
      state.raiders = state.raiders.filter(r=> !r.home);
      const cc = state.cols[0];
      const b0 = Math.hypot(cc.x - dx1, cc.y - dy1);
      const okd = giveOrder(cc, { kind:'demolish', x:dx1, y:dy1 }, true);
      for(let i=0;i<140;i++) stepColonist(cc, 1);
      const b1 = Math.hypot(cc.x - dx1, cc.y - dy1);
      R.demolish = { before:+b0.toFixed(1), after:+b1.toFixed(1), ttl: okd ? 900 : 0 };
      R.checks.demolishGo = okd && b1 < b0 - 1;

      /* 8. 野心要进存档 */
      newGame(7, 'calm', 'valley', 'trade');
      saveGame(); loadGame();
      R.checks.ambKept = state.amb === 'trade';

      /* 9. 野心判定：达标才是「赢」 */
      newGame(7, 'calm', 'valley', 'raid');
      state.stats.dens = 3;
      const win = ambAchieved();
      state.stats.dens = 1;
      const lose = ambAchieved();
      R.checks.ambGate = win === true && lose === false;

      /* 10. 守成的「零死亡」是反向条件：死人应该判失败 */
      newGame(7, 'calm', 'valley', 'hold');
      state.cols = state.cols.slice(0, 3);
      state.stats.deaths = 0;
      const okA = needOK(stageDefs()[2].need[0]);
      state.stats.deaths = 1;
      const okB = needOK(stageDefs()[2].need[0]);
      R.rev = { clean: okA, killed: okB };
      R.checks.revNeed = okA === true && okB === false;

      /* 11. 开局保护圈：匪巢离最近的人至少 12 格。
             巢卫警戒 6 格 + 拴绳 2.5 格 + 枪 6 格，威胁圈最深 8.5 格；
             这个数掉到十以下，玩家一进游戏就会先挨一顿打。 */
      newGame(7, 'calm', 'valley', 'raid');
      let minD = Infinity, minDen = Infinity;
      for(const r of state.raiders.filter(x=> x.home)){
        for(const c of state.cols) minD = Math.min(minD, Math.hypot(r.x-c.x, r.y-c.y));
      }
      for(const c of state.cols){
        for(const [i,t] of tiles.entries()){
          if(t.bld && t.bld.type === 'den') minDen = Math.min(minDen, Math.hypot((i%W)-c.x, ((i/W)|0)-c.y));
        }
      }
      R.clear = { guard:+minD.toFixed(1), den:+minDen.toFixed(1) };
      R.checks.denClear = minD >= 12 && minDen >= 12;

      /* 12. 开局十小时：不该有任何人接战、掉血或倒下 ——
             这张局的第一课是「先活下来」，不是「开局就有人冲出去送死」。 */
      let fought = false;
      const hurtIds = new Set();
      for(let i=0;i<600;i++){
        const before = new Map(state.cols.map(c=> [c.id, c.hp]));
        window.__F.sim(1);
        for(const c of state.cols){
          const b = before.get(c.id);
          if(b != null && c.hp < b - 0.01) hurtIds.add(c.id);
        }
        if(state.cols.some(c=> c.job && c.job.type === 'fight')) fought = true;
        if(state.over) break;
      }
      R.opening = { fought, hurt: hurtIds.size, deaths: state.stats.deaths || 0,
        down: state.cols.filter(c=> c.down).length,
        minHp: Math.round(Math.min(...state.cols.map(c=> c.hp))) };
      /* 允许「路过匪巢挨一枪」这种意外，但绝不允许主动接战、倒地或阵亡 */
      R.checks.noOpeningFight = !fought && !state.stats.deaths
        && state.cols.every(c=> !c.down) && hurtIds.size <= 1;

      /* 13. 拴绳：贴到巢边时守卫会还手，但不会追出窝三格外 */
      newGame(7, 'calm', 'valley', 'raid');
      const g1 = state.raiders.filter(r=> r.home)[0];
      const gc = { x:g1.home.x, y:g1.home.y };
      const victim = state.cols[0];
      for(const c of state.cols.slice(1)){ c.x = clamp(gc.x + 24, 1, W-2); c.y = clamp(gc.y + 12, 1, H-2); c.fx = c.x+0.5; c.fy = c.y+0.5; }
      victim.x = clamp(gc.x + 4, 1, W-2); victim.y = gc.y;
      victim.fx = victim.x + 0.5; victim.fy = victim.y + 0.5; victim.path = null; victim.order = null;
      for(let i=0;i<60;i++){ for(const r of state.raiders) updateRaider(r, 1); }
      const outMax = Math.max(...state.raiders.filter(r=> r.home)
        .map(r=> Math.hypot(r.x-r.home.x, r.y-r.home.y)));
      R.leash = +outMax.toFixed(2);
      R.checks.guardLeash = outMax <= 3.6;
    }catch(e){ R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << '); }
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V18::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }
  if(q.has('v17')){
    const R = { checks:{} };
    window.__fastTest = true;
    try{
      newGame(7, 'calm', 'valley');
      const c = state.cols[0];

      /* 1. 移动指令要真的让他往那儿走 */
      let tgt = null;
      for(let k=0;k<600 && !tgt;k++){
        const x = rint(2, W-3), y = rint(2, H-3);
        if(passable(x, y) && dist(x, y, c.x, c.y) > 8) tgt = { x, y };
      }
      R.checks.hasTarget = !!tgt;
      giveOrder(c, { kind:'move', x:tgt.x, y:tgt.y }, true);
      R.checks.orderSet = !!c.order && c.order.kind === 'move';
      R.orderTtl = Math.round(c.order.ttl);

      const d0 = dist(c.x, c.y, tgt.x, tgt.y);
      for(let i=0;i<40;i++) stepColonist(c, 1);
      const d1 = dist(c.x, c.y, tgt.x, tgt.y);
      R.dist = { before:+d0.toFixed(1), after:+d1.toFixed(1) };
      R.checks.approached = d1 < d0 - 1;

      /* 2. 到期必须自动交还给 AI（v1.6 的 guard 就是忘了交还，人永远站死在岗位上） */
      for(let i=0;i<160;i++) stepColonist(c, 1);
      R.checks.expired = c.order === null;

      /* 3. 睡着的人不接受指令 */
      const c2 = state.cols[1] || c;
      c2.sleeping = true; c2.order = null;
      const ok = giveOrder(c2, { kind:'move', x:c2.x+2, y:c2.y }, true);
      R.checks.sleepRefuse = ok === false && !c2.order;
      c2.sleeping = false;

      /* 4. 攻击指令要能把他推到交战状态 */
      spawnRaid(1, 1, { night:false });
      const foe = state.raiders.find(r=> !r.dead && !r.down);
      R.checks.foe = !!foe;
      if(foe) giveOrder(c, { kind:'attack', id:foe.id }, true);
      R.checks.attackSet = !!c.order && c.order.kind === 'attack';
      R.checks.wentFight = c.state === 'fight';

      /* 5. 接敌时高倍速自动降一档 */
      newGame(7, 'calm', 'valley');
      state.speed = 4;
      spawnRaid(1, 1, { night:false });
      R.speedAfter = state.speed;
      R.checks.slowDown = state.speed === 1;

      /* 6. 指令不入档：读回来不能有残留（否则读档后那个人会站着不动 2 小时） */
      newGame(7, 'calm', 'valley');
      giveOrder(state.cols[0], { kind:'move', x:state.cols[0].x+3, y:state.cols[0].y }, true);
      const had = !!state.cols[0].order;
      saveGame(); loadGame();
      R.checks.cleanLoad = had === true && !state.cols[0].order;
    }catch(e){ R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << '); }
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V17::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }
  if(q.has('v16')){
    const R = { checks:{} };
    window.__fastTest = true;
    try{
      newGame(7, 'calm', 'valley');
      state.day = 7;        // 非袭击日，夜袭才有概率

      /* 1. 基础风险与篝火压制 */
      const risk0 = nightRisk();
      R.risk0 = +(risk0*100).toFixed(1);
      R.checks.risk = risk0 > 0.05;
      let ft = null;
      for(let k=0;k<600 && !ft;k++){
        const t = tiles[((k*37) % (W*H))];
        if(t && t.g !== T.WATER && t.g !== T.ROCK && !t.bld) ft = t;
      }
      if(ft) ft.bld = { type:'fire', prog:1, hp:70, cdT:0, ang:0, burn:0 };
      R.risk1 = +(nightRisk()*100).toFixed(1);
      R.checks.fireLowers = nightRisk() < risk0;
      R.sizeWithFire = nightSize();

      /* 2. 排班：人数必须精确对上 */
      state.watch = 2;
      applyWatch();
      R.checks.assigned = state.cols.filter(c=> c.onWatch).length === Math.min(2, state.cols.length);
      R.checks.watchSet = state.watchSet === true;

      /* 3. 夜袭真的会出兵 */
      const before = state.raiders.length;
      state.nightRaid = { n:3, tier:1, fired:false };
      fireNightRaid();
      R.checks.raid = state.raiders.length > before;
      R.nightTimes = state.nightTimes;

      /* 4. 偷袭：睡着的吃 1.55 倍，醒着的不吃 */
      const a1 = state.cols[0], a2 = state.cols[1] || state.cols[0];
      a1.sleeping = true;
      const h1 = a1.hp;
      hurt(a1, 10, { side:'raid' });
      R.sneak = +(h1 - a1.hp).toFixed(2);
      a2.sleeping = false;
      const h2 = a2.hp;
      hurt(a2, 10, { side:'raid' });
      R.normal = +(h2 - a2.hp).toFixed(2);
      R.checks.sneakMul = R.sneak > R.normal * 1.4;

      /* 5. 收工后的疲劳代价 */
      state.watchSet = true;
      state.cols.forEach(c=>{ c.onWatch = true; c.fatigue = 0; });
      endWatch();
      R.checks.fatigue = state.cols.every(c=> c.fatigue === 1);
      const c0 = state.cols[0];
      const sf = workSpeed(c0, 'chop');
      c0.fatigue = 0;
      const sn = workSpeed(c0, 'chop');
      R.speed = { tired: +sf.toFixed(3), fresh: +sn.toFixed(3) };
      R.checks.slow = sf < sn * 0.9;
      /* 研究守夜轮值后惩罚减半 */
      state.tech.done.watch = true;
      R.speedTech = +workSpeed(c0, 'chop').toFixed(3);

      /* 6. 存档往返 */
      state.tech.done = {};
      state.watch = 3;
      saveGame();
      loadGame();
      R.keptWatch = state.watch;
      R.checks.save = state.watch === 3;

      /* 7. 夜间时序：从第 5 天 06:00 推 25 小时，必须走完「排班 → 夜袭 → 收工」 */
      newGame(7, 'calm', 'valley');
      state.day = 5;
      window.__F.sim(1500);
      R.checks.autoNight = state.log.some(e=> /守了一夜|守到半夜/.test(String(e.text)));
      R.nightLog = state.log.filter(e=> /守了一夜|守到半夜|没守夜|夜袭|响动/.test(String(e.text)))
                            .map(e=> String(e.text).replace(/<[^>]+>/g,''));
    }catch(e){ R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << '); }
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V16::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }
  /* v1.5 自检：剧本 / 阶段 / 延迟后果 / 评分 / 存档 */
  if(q.has('v15')){
    const R = {};
    window.__fastTest = true;
    try{
      const countG = g=> tiles.filter(t=> t.g === g).length;

      newGame(7, 'std', 'valley');
      const v = { water: countG(T.WATER), rock: countG(T.ROCK),
                  wood: Math.round(state.res.wood), pop: state.cols.length, goal: state.goalDay };
      R.valley = v;

      newGame(7, 'std', 'road');
      R.road = { water: countG(T.WATER), pop: state.cols.length, wood: Math.round(state.res.wood) };

      newGame(7, 'std', 'cliff');
      R.cliff = { rock: countG(T.ROCK), wood: Math.round(state.res.wood), stone: Math.round(state.res.stone) };

      newGame(7, 'std', 'plague');
      R.plague = { pop: state.cols.length, wounded: state.cols.filter(c=> (c.wound||0) > 40).length };

      newGame(7, 'std', 'winter');
      R.winter = { goal: state.goalDay, food: Math.round(state.res.food) };

      R.checks = {
        roadDry:    R.road.water < v.water * 0.4,
        cliffRocky: R.cliff.rock > v.rock * 1.15,
        cliffPoorWood: R.cliff.wood < v.wood * 0.8,
        plagueFive: R.plague.pop === 5,
        plagueHurt: R.plague.wounded === 2,
        winterShorter: R.winter.goal === 10,
        winterStocked: R.winter.food > 30
      };

      /* 冬季作物停长 */
      {
        const t0 = tiles.find(t=> t.g === T.GRASS && !t.plant && !t.zone);
        if(t0) t0.plant = { kind:'crop', grow:0.2, sway:0 };
        const g0 = t0 ? t0.plant.grow : -1;
        window.__F.sim(600);
        R.cropWinter = t0 ? +(t0.plant.grow - g0).toFixed(3) : 'no-tile';
      }

      /* 阶段：节点日、逾期判定、终局补判 */
      newGame(7, 'std', 'valley');
      R.stageDays = stageDefs().map(s=> s.day);
      state.day = 5;
      settleStages(false);
      R.stage1 = { idx: state.stage.idx, failed: state.stage.failed.slice() };
      state.stats.kills = 12; state.stage.idx = 2; state.day = 99;
      settleStages(true);
      R.stageAll = { idx: state.stage.idx, done: state.stage.done.length, failed: state.stage.failed.length };

      /* 延迟后果：到日子必须自动触发 */
      newGame(7, 'std', 'valley');
      state.pending.push({ key:'wagon', opt:1, due: 2 });
      window.__F.sim(1440);
      R.pending = {
        left: state.pending.length,
        fired: state.log.some(e=> String(e.text).includes('修车人情'))
      };

      /* 评分 */
      const g = finalGrade();
      R.grade = { sc: g.sc, g: g.grade, parts: g.parts.map(p=> p.v) };

      /* 存档往返保留剧本 / 阶段 / 延迟后果 */
      state.pending.push({ key:'deserter', opt:0, due: 30 });
      state.totalPop = 6;
      R.save = saveGame();
      loadGame();
      R.kept = { scen: state.scen, stage: state.stage.idx, pending: state.pending.length, totalPop: state.totalPop };
    }catch(e){ R.err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << '); }
    R.errs = (window.__errs || []).slice(0,6);
    document.title = 'V15::' + JSON.stringify(R).replace(/\s+/g,' ');
    return;
  }
  /* 演示：?squad=1 摆一个有敌人的场面，并框选全队（截图用） */
  if(q.has('squad')){
    state.raiders = [];
    spawnRaid(4, 1, { night:false });
    const c0 = state.cols[0];
    /* 敌人放右侧（侧栏在右，但四格外还露得出来），我方三人收成一簇：
       截图要讲的是"框住了谁"，散开就看不出来了 */
    state.raiders.forEach((r, i)=>{
      r.x = c0.x + 4 + (i % 2); r.y = c0.y - 1 + (i > 1 ? 1.4 : 0);
      r.fx = r.x + 0.5; r.fy = r.y + 0.5; r.path = null; r.target = null;
    });
    state.cols.forEach((c, i)=>{
      const o = [[0,0], [-2.4, 1.8], [-3.6, -1.4]][i] || [0,0];
      c.x = c0.x + o[0]; c.y = c0.y + o[1];
      c.fx = c.x + 0.5; c.fy = c.y + 0.5; c.path = null;
    });
    /* 开局的镜头扫移（camSwing）会连着几秒改写相机，把人像拖出画面 ——
       截图前必须先把它停掉，否则算得再准也白算 */
    camSwing = null;
    centerOn(c0.x + 1.2, c0.y);
    cam.z = parseFloat(q.get('sqz')) || 1.55; clampCam();
    /* 自动构图：右栏压着画布，画面真正的视觉中心在 46% 处。
       硬编码相机位置每次都差一点，索性按"人物包围盒的中点"去对，
       最多迭代四次就能收敛 —— 截图工具不该靠手调像素。 */
    const all = state.cols.concat(state.raiders);
    for(let k=0; k<4; k++){
      const xs = all.map(u=> worldToScreen(u.fx*TS, u.fy*TS).x);
      const ys = all.map(u=> worldToScreen(u.fx*TS, u.fy*TS).y);
      const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const my = (Math.min(...ys) + Math.max(...ys)) / 2;
      const dx = mx - vw * 0.46, dy = my - vh * 0.52;
      if(Math.abs(dx) < 10 && Math.abs(dy) < 10) break;
      cam.cx += dx / cam.z; cam.cy += dy / cam.z;
      clampCam();
    }
    selectBox({ sx:-99999, sy:-99999, cx:99999, cy:99999 });
    /* 框选矩形改由渲染前每帧重算（见 loop）：init 之后还有别的初始化块会动相机，
       在这里算一次，等到真正出图时人物已经挪了位置，框就框歪了。 */
    window.__shotSel = state.cols.slice();
    /* 不 return：init 末尾才启动渲染循环，提前返回会得到一块黑屏 */
    state.paused = true; window.__shotSlow = true;
    uiDirty.side = true;
  }
  /* 演示：?den=1 把镜头对准匪巢，三人小队正在过去拆（截图用） */
  if(q.has('den')){
    const di = tiles.findIndex(t=> t.bld && t.bld.type === 'den');
    if(di >= 0){
      const dx = di % W, dy = (di / W) | 0;
      camSwing = null;
      state.cols.forEach((c, i)=>{
        c.x = dx - 4 - (i % 2); c.y = clamp(dy - 1 + i, 1, H - 2);
        c.fx = c.x + 0.5; c.fy = c.y + 0.5; c.path = null; c.job = null;
        /* 指令标记会正好压在匪巢上，把它盖得看不清 —— 只在显式要求时下命令 */
        if(q.has('denord')) giveOrder(c, { kind:'demolish', x:dx, y:dy }, true);
      });
      centerOn(dx - 1.2, dy + 0.2);
      cam.z = parseFloat(q.get('sqz')) || 2.0; clampCam();
      selectBox({ sx:-99999, sy:-99999, cx:99999, cy:99999 });
      window.__shotSel = state.cols.slice();
      state.paused = true; window.__shotSlow = true;
      uiDirty.side = true;
    }
  }
  /* 终局演示：?end=1 直接看分档评价 */
  /* 档案演示（v2.2）：?archshot=1 快进七天，选个人史最长的那位；
     ?pm=1 直接打完一局看复盘。截图用，不影响正常开局。 */
  if(q.has('archshot') || q.has('pm')){
    window.__fastTest = true;
    if(q.has('archshot')){
      /* 天数可传：archshot=4 一般还没打到减员，适合截「个人史」 */
      const dd = Math.max(1, Math.min(14, Number(q.get('archshot')) || 4));
      window.__F.sim(1440 * dd);
      state.paused = true;
      /* 快进途中会撞上「商队到访」这类抉择弹窗 —— 不关掉就把画面挡死了 */
      closeModal();
      /* 默认不选人 —— 营地面板才看得到「今日瓶颈」；
         要截个人史就加 &sel=1 */
      if(q.has('sel')){
        const pc = state.cols.slice().sort((a, b)=> (b.hist || []).length - (a.hist || []).length)[0];
        if(pc) state.sel = { kind:'col', id: pc.id };
      }
      uiDirty.side = true; uiDirty.res = true; uiDirty.log = true;
      if(q.has('hdump')) document.title = 'HDUMP::' + JSON.stringify(state.cols.map(c=> ({ n:c.name, h:c.hist })));
    } else {
      window.__F.sim(1440 * 17);
      state.paused = true;
      if(!state.over){ state.day = state.goalDay + 1; showEnd(true); }
    }
  }

  if(q.has('end')){
    window.__fastTest = true;
    window.__F.sim(240);
    state.stats.kills = 27; state.stats.raids = 42; state.stats.built = 14;
    state.stats.wood = 2140; state.stats.stone = 1160;
    state.tech.done = { tools:true, wall2:true, clinic:true };
    state.stage.done = ['foot','grow']; state.stage.idx = 3; state.totalPop = 4;
    state.day = state.goalDay + 1;
    for(const c of state.cols) c.needs.mood = 82;
    showEnd(true);
    return;
  }
  /* 工地演示：?site=1 摆三座不同进度的在建建筑 */
  if(q.has('site')){
    state.res.wood += 200; state.res.stone += 200;
    const cx = W >> 1, cy = H >> 1;
    const kinds = ['wall', 'turret', 'bed'];
    let k = 0;
    for(let r = 0; r < 10 && k < 3; r++){
      for(let s = -r; s <= r && k < 3; s++){
        const px2 = cx + s + 2, py2 = cy + 3 + r;
        if(!canPlace(kinds[k], px2, py2)) continue;
        if(!placeBuilding(kinds[k], px2, py2)) continue;
        const tl = tileAt(px2, py2);
        if(tl && tl.bld) tl.bld.prog = 0.22 + k * 0.30;
        k++;
      }
    }
  }
  /* 结算卡演示：?daycard=1 */
  if(q.has('daycard')){
    window.__holdCard = true;
    const nw = snapshotDay();
    const pv = { ...nw, wood: nw.wood - 42, stone: nw.stone - 18, food: nw.food + 6,
                 herb: nw.herb - 2, kills: nw.kills - 2, built: nw.built - 1, mood: nw.mood - 4 };
    setTimeout(()=> showDayReport(pv, state.day), 350);
  }
  /* 存档面板演示：?slots=1 */
  if(q.has("slots")){ setTimeout(()=> showSlots(), 350); }
  /* 抉择演示：?choice=1 */
  if(q.has('choice')){
    setTimeout(()=> showChoice(), 350);
  }
  /* 选中演示：?sel=i 选中第 i 个居民并居中，方便看意图线与账单 */
  if(q.has('sel')){
    const i = Math.max(0, Math.min(state.cols.length - 1, Number(q.get('sel')) || 0));
    const c = state.cols[i];
    if(c){ state.sel = { kind:'col', id: c.id }; centerOn(c.x, c.y); }
  }
  /* 悬停演示：?hover=x,y 强制把信息卡钉在某格 */
  if(q.has('hover')){
    const sp = (q.get('hover') || '36,26').split(',').map(Number);
    mouse.wx = (sp[0] + 0.5) * TS; mouse.wy = (sp[1] + 0.5) * TS;
    mouse.sx = Math.round(vw * 0.52); mouse.sy = Math.round(vh * 0.44);
    mouse.in = true;
  }
  if(q.has('test')){
    window.__fastTest = true;
    /* 回归自动化：AI 自己不会去拆巢、也不会点交易（那本来就是玩家的活），
       但「22 天内能不能达成」必须能被测出来，所以替玩家做这两件事。
       只对对应的野心开 —— 全局开会让守成局也白拿交易收益，基线就不一样了。 */
    const amb0 = q.get('amb') || 'hold';
    window.__autoRaid = q.get('auto') === '1' && amb0 === 'raid';
    window.__autoTrade = q.get('auto') === '1' && amb0 === 'trade';
    /* 筑城局替玩家放墙：AI 不会自己去摆蓝图，但「12 段墙能不能在目标日前立起来」
       得能量出来 —— 否则「太难」和「测试没点」分不清。 */
    window.__autoWall = q.get('auto') === '1' && amb0 === 'fortify';
    const n = Math.min(40000, Number(q.get('test')) || 2000);
    const cx = W>>1, cy = H>>1;
    if(q.get('build') === '2'){
      /* v1.5 理想玩家基线：够得着「立稳 / 扩张」两阶段的全部条件，
         用来验证阶段判定与 S/A/B/C 分档真的能拉开差距（build=1 的简陋基地永远是 C）。 */
      grantRes({ wood: 3000, stone: 3000, food: 300, herb: 20 });
      const put = (type, tx, ty)=>{
        for(let r=0;r<12;r++){
          for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
            if(Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if(canPlace(type, tx+dx, ty+dy)){ placeBuilding(type, tx+dx, ty+dy); return true; }
          }
        }
        return false;
      };
      for(let i=0;i<4;i++) put('bed', cx+3, cy-3+i*2);
      /* 炮塔先落位且必须在墙内侧：放墙外侧时工人绕不过去，蓝图永远停在 prog=0 */
      put('turret', cx+2, cy-7);
      /* 三排冗余铺墙：林地单排有一半格子被树占掉（实测一排 14 次只成 7 段），
         铺三向才能稳定跨过「10 段石墙」的门槛 */
      for(let i=0;i<16;i++) put('wall', cx-8+i, cy-9);
      for(let i=0;i<16;i++) put('wall', cx-8+i, cy+7);
      for(let i=0;i<12;i++) put('wall', cx-9, cy-6+i);
      state.tech.done.tools = true;
      /* v2.1：脚手架里的农田直接按「已经开垦」落地。
         这一段验证的是「后期目标能不能达到」，不是「开荒要花几天」——
         让理想玩家基线也去刨两个工日的地，测出来的就不再是目标可达性。
         开荒流程由 ?v21=1 的 tillNeeded / tillWorks 单独验。 */
      for(let y=cy+2; y<cy+9; y++) for(let x=cx-6; x<=cx+1; x++){
        if(setZone('farm', x, y)){
          const tf = tiles[y*W+x];
          tf.soil = 'tilled'; tf.fert = groundFert(tf.g);
        }
      }
      for(let y=cy-2; y<=cy+1; y++) for(let x=cx+2; x<=cx+4; x++) setZone('stock', x, y);
    } else if(q.has('build')){
      for(let y=cy-7; y<cy-4; y++) for(let x=cx-2; x<cx+2; x++) setZone('farm', x, y);
      placeBuilding('bed', cx+2, cy);
      placeBuilding('bed', cx+2, cy+1);
      placeBuilding('fire', cx+3, cy+2);
      for(let x=cx-4;x<=cx;x++) placeBuilding('wall', x, cy-8);
      placeBuilding('turret', cx+1, cy-8);
    }
    const snap = ()=> window.__F.info();
    const out = [snap()];
    let err = null;
    try{
      for(let k=0;k<n;k++){
        window.__F.sim(1);
        if((k+1) % Math.max(1, Math.floor(n/6)) === 0) out.push(snap());
      }
    } catch(e){
      err = e.message + ' | ' + String(e.stack).split('\n').slice(0,2).join(' << ');
    }
    const errs = (window.__errs || []).slice(0,5);
    document.title = 'TEST::' + JSON.stringify({ err, errs, out }).replace(/\s+/g,' ') ;
    return;
  }

  if(q.has('iotest')){
    const sig = ()=>{
      const i = window.__F.info();
      return JSON.stringify({ d:i.day, m:i.min, r:i.res, b:i.built,
        c: i.cols.map(c=>[c.n, Math.round(c.h), Math.round(c.hu), Math.round(c.re), c.x, c.y]) });
    };
    const before = sig();
    const ok = saveGame();
    newGame();
    const mid = sig();
    loadGame();
    const after = sig();
    let diffs = [];
    try{
      const bp = JSON.parse(before), ap = JSON.parse(after);
      for(const k of Object.keys(bp)) if(JSON.stringify(bp[k]) !== JSON.stringify(ap[k])) diffs.push({ k, b: bp[k], a: ap[k] });
    }catch(e){ diffs = ['parse:' + e.message]; }
    document.title = 'IO::' + JSON.stringify({ ok, same: before === after, changed: before !== mid, diffs });
    return;
  }

  // 演示场景：搭好一个像样的基地，快进到有农田/围墙/炮塔的中局
  if(q.has('demo')){
    const cx = W>>1, cy = H>>1;
    const zc = [];
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(tiles[y*W+x].zone === 'stock') zc.push({x,y});
    if(zc.length){
      addItems(zc[0].x, zc[0].y, 'wood', 600);
      addItems(zc[Math.min(1,zc.length-1)].x, zc[Math.min(1,zc.length-1)].y, 'stone', 600);
    }
    for(let y=cy-2;y<=cy+1;y++) for(let x=cx+1;x<=cx+4;x++) setZone('stock', x, y);
    for(let y=cy+3;y<=cy+6;y++) for(let x=cx-4;x<=cx-1;x++) setZone('farm', x, y);

    const x0=cx-4, x1=cx+4, y0=cy-5, y1=cy+1;
    for(let x=x0;x<=x1;x++){ placeBuilding('wall',x,y0); placeBuilding('wall',x,y1); }
    for(let y=y0;y<=y1;y++){ placeBuilding('wall',x0,y); placeBuilding('wall',x1,y); }
    const dt = tileAt(cx+2, y1); if(dt) dt.bld = null;
    placeBuilding('door', cx+2, y1);
    placeBuilding('bed', cx-2, cy-3);
    placeBuilding('bed', cx-1, cy-3);
    placeBuilding('bed', cx, cy-3);
    placeBuilding('fire', cx+2, cy-2);
    placeBuilding('table', cx+1, cy-3);
    placeBuilding('turret', cx-2, cy-1);
    placeBuilding('turret', cx, cy-1);

    state.paused = true;
    for(let i=0;i<1600;i++) window.__F.sim(1);

    for(let i=0;i<3;i++){
      const ang = -0.7 + i*0.9;
      const nf = nearestFree(Math.round(cx + Math.cos(ang)*8), Math.round(cy + Math.sin(ang)*8), 4);
      if(nf){ const r = makeRaider(nf.x, nf.y, 2); state.raiders.push(r); }
    }
    logEvent('<b>袭击！</b> 3 名掠袭者正在冲击围墙。', 'bad');
    showAlert('袭击警报 · 3 名掠袭者来袭', true);
    for(let i=0;i<90;i++) window.__F.sim(1);

    state.paused = false;
    if(q.has('night')) state.min = 1440 + 21*60 + 20;
    state.sel = { kind:'col', id: state.cols[0].id };
    centerOn(cx, cy-1); cam.z = 1.15; clampCam();
    uiDirty.side = true; uiDirty.log = true;
    toast('演示场景已就绪');
  }

  updateUI();
  let seen = false;
  try{ seen = localStorage.getItem('frontier-seen') === '1'; }catch(e){}
  if(!q.has('demo') && !q.has('skipintro') && !seen) showIntro();
  /* 调试图参数：?hour=10 固定时刻（并暂停），方便截图对照 */
  if(q.has('hour')){
    const hv = clamp(Number(q.get('hour')) || 0, 0, 23.99);
    state.min = (state.day - 1) * 1440 + Math.floor(hv * 60);
    state.paused = true;
    updateUI();
  }
  /* 调试参数：?help=1 直接打开帮助，方便核对排版 */
  if(q.has('help')){ updateUI(); showHelp(); }
  /* 调试参数：?act2=1 直接弹第二幕，方便截图与自测 */
  if(q.has('act2')){
    state.day = act2Day();
    state.min = (state.day - 1) * 1440 + 14*60;
    state.paused = true;
    uiDirty.side = true;
    updateUI();
    showAct2();
  }
  /* 调试图参数：?day=4 直接跳到第 4 天下午（暂停），方便看中局 HUD */
  if(q.has('day')){
    const dn = clamp(Number(q.get('day')) || 1, 1, 99);
    state.day = dn;
    state.min = (dn - 1) * 1440 + 14*60;
    for(const c of state.cols) c.vigor = VIGOR_MAX * (0.3 + rnd()*0.6);
    /* 截图演示：气泡是随机触发的，等它自己冒出来太看运气 */
    if(state.cols[0]) saySomething(state.cols[0]);
    state.paused = true;
    uiDirty.side = true; uiDirty.log = true;
    updateUI();
  }
  if(q.has('zoom') || q.has('cx') || q.has('cy')){
    if(q.has('zoom')) cam.z = clamp(Number(q.get('zoom')) || 1, 0.4, 2.4);
    if(q.has('cx')) cam.cx = Number(q.get('cx')) * TS;
    if(q.has('cy')) cam.cy = Number(q.get('cy')) * TS;
    clampCam();
  }
  if(q.get('dbg') === 't') window.__dbgTerrain = true;
  /* 守夜演示：?night=1 停在 22:40 且已排班；?night=raid 直接让夜袭发生 */
  /* 演示（v1.7）：选中一名居民、给他下攻击令，停在交战中，方便截图对照 */
  if(q.has('order')){
    window.__fastTest = true;
    spawnRaid(2, 1, { night:false });
    const me = state.cols[0];
    const foe = state.raiders[0];
    if(foe){
      /* 把敌人挪到营地边上：spawnRaid 从地图边界出生，等他们走过来画面早空了 */
      let bx = me.x + 6, by = me.y;
      if(!passable(bx, by)){ bx = me.x - 6; }
      if(!passable(bx, by)){ bx = me.x; by = me.y + 6; }
      foe.x = bx; foe.y = by; foe.fx = bx; foe.fy = by; foe.path = null; foe.target = null;
    }
    state.sel = { kind:'col', id: me.id };
    if(foe) giveOrder(me, { kind:'attack', id: foe.id });
    for(let i=0;i<4;i++) simMinute();
    state.paused = true;
    uiDirty.side = true;
    updateUI();
    /* 相机要等布局稳定后再摆：init 阶段 vw/vh 还是旧值，clampCam 会算错边界。
       另外 canvas 是全宽的、侧栏浮在右边，所以要把目标推到左侧可视区。 */
    setTimeout(()=>{
      const f2 = state.raiders.find(r=> !r.dead && !r.down) || foe;
      const midx = f2 ? (me.x + f2.x)/2 : me.x, midy = f2 ? (me.y + f2.y)/2 : me.y;
      cam.z = 1.55;
      centerOn(midx, midy);
      clampCam();
      updateUI();
    }, 400);
  }

  if(q.has('night')){
    window.__fastTest = true;          // 演示时别弹抉择，挡住画面
    const base = (state.day - 1) * 1440;
    state.min = base + Math.round(22.6 * 60);
    applyWatch();
    if(q.get('night') === 'raid'){
      state.nightRaid = { n: 3, tier: 1, fired: false };
      state.min = base + 1410;
      fireNightRaid();
      for(let i=0;i<90;i++) simMinute();
    }
    state.paused = true;
    updateUI();
  }
  requestAnimationFrame(loop);

  if(q.has('dump')){
    setTimeout(()=>{
      let e2 = null;
      try{ updateUI(); }catch(err){ e2 = err.message + ' | ' + String(err.stack).split('\n')[1]; }
      const sideLen = ($('side').innerHTML || '').length;
      const hist = new Array(8).fill(0);
      for(const t of tiles) hist[t.g]++;
      document.title = 'DUMP::' + JSON.stringify({ errs: window.__errs, e2, sideLen, genMs: window.__genMs, bakeMs: window.__bakeMs,
        cols: state.cols.length, tiles: tiles.length, hist });
    }, 1200);
  }
}


window.addEventListener('load', init);

/* 调试接口：供无头测试使用 */
window.__F = {
  state, get tiles(){ return tiles; },
  /* 结束后不再推进：真实运行里主循环会在 over 时停住，
     回归里若继续推，会出现「全员倒地之后匪巢数还在涨」的假数据。 */
  sim(ticks){ for(let i=0;i<ticks;i++){ if(state.over) break; simMinute(); } },
  genMap, newGame, findPath, passable, placeBuilding, setZone,
  info(){
    const gd = finalGrade();
    return {
      day: state.day, min: state.min, res: {...state.res},
      grade: gd.grade, score: gd.sc, stagePassed: gd.passed,
      walls: countBuilt('wall'), turrets: countBuilt('turret'), beds: countBuilt('bed'),
      stockTiles: tiles.filter(t=> t.zone === 'stock').length,
      cols: state.cols.map(c=>({ n:c.name, job: c.job && c.job.type, st: c.state,
        h: Math.round(c.hp), hu: Math.round(c.needs.hunger), re: Math.round(c.needs.rest),
        mo: Math.round(c.needs.mood), x:c.x, y:c.y, down:c.down,
        wd: Math.round(c.wound||0), tr:(c.traits||[]).join('+'),
        ow: c.onWatch ? 1 : 0, ft: c.fatigue ? 1 : 0, sl: c.sleeping ? 1 : 0 })),
      raiders: state.raiders.length, over: state.over, kills: state.stats.kills,
      goal: state.goalDay, diff: state.diff, endless: state.endless,
      scen: state.scen, stageIdx: state.stage.idx,
      /* v1.8：野心进度 —— 长局回归要能看到「打的是哪张局、还差多少」 */
      amb: state.amb, ambDone: +(ambProgress()*100).toFixed(0),
      ambAch: ambAchieved(), deaths: state.stats.deaths || 0,
      denCount: window.__denCount,
      dens: state.stats.dens || 0, trades: state.stats.trades || 0,
      wealth: Math.round(state.stats.wealth || 0),
      stageDone: state.stage.done.join(','), stageFailed: state.stage.failed.join(','),
      pending: state.pending.length,
      watch: state.watch, watchSet: !!state.watchSet, onDuty: state.cols.filter(c=> c.onWatch).length,
      watchFatigue: state.cols.filter(c=> c.fatigue > 0).length,
      nightTimes: state.nightTimes || 0, nightRepel: state.nightRepel || 0,
      nightRisk: +(nightRisk()*100).toFixed(0), nightPending: !!(state.nightRaid && !state.nightRaid.fired),
      tech: Object.keys(state.tech.done).join(','), techCur: state.tech.cur,
      cmd: state.cmd && state.cmd.kind,
      kinds: state.raiders.reduce((m,r)=>{ m[r.kind]=(m[r.kind]||0)+1; return m; }, {}),
      raids: state.stats.raids||0, log: state.log.slice(0,3).map(e=>e.text.replace(/<[^>]+>/g,'')),
      reachN: state.reach ? Array.prototype.reduce.call(state.reach, (a,b)=> a+b, 0) : -1,
      items: tiles.filter(t=>t.items).length,
      built: tiles.filter(t=>t.bld && t.bld.prog>=1).length,
      bp: tiles.filter(t=>t.bld && t.bld.prog<1).length
    };
  }
};

/* 内联 onclick 需要的全局出口：必须在 newGame 等函数定义之后再挂 */
window.saveGame = saveGame; window.loadGame = loadGame; window.newGame = newGame;
window.closeModal = closeModal; window.toast = toast;
