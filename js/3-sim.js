/* =====================================================================
   3-sim.js · 模拟
   边陲 v1.5 · 模块化拆分（原单文件第 3 部分）
   ===================================================================== */

/* =====================================================================
   7 · A* 寻路
   ===================================================================== */
const N8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const _g = new Float32Array(W*H), _f = new Float32Array(W*H);
const _from = new Int32Array(W*H), _closed = new Uint8Array(W*H), _open = new Uint8Array(W*H);

function adjacentFree(x,y){
  const out = [];
  for(const [dx,dy] of N8) if(passable(x+dx,y+dy)) out.push({x:x+dx,y:y+dy});
  return out;
}
function nearestFree(x,y,rad){
  if(passable(x,y)) return {x,y};
  for(let r=1;r<=(rad||6);r++){
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy)) !== r) continue;
      if(passable(x+dx,y+dy)) return {x:x+dx,y:y+dy};
    }
  }
  return null;
}

/* 二叉堆 */
class Heap{
  constructor(){ this.a = []; }
  get size(){ return this.a.length; }
  push(v){ const a=this.a; a.push(v); let i=a.length-1;
    while(i>0){ const p=(i-1)>>1; if(_f[a[p]] <= _f[a[i]]) break; [a[p],a[i]]=[a[i],a[p]]; i=p; } }
  pop(){ const a=this.a, top=a[0], last=a.pop();
    if(a.length){ a[0]=last; let i=0;
      for(;;){ const l=i*2+1, r=l+1; let m=i;
        if(l<a.length && _f[a[l]] < _f[a[m]]) m=l;
        if(r<a.length && _f[a[r]] < _f[a[m]]) m=r;
        if(m===i) break; [a[m],a[i]]=[a[i],a[m]]; i=m; } }
    return top; }
}

function findPath(sx,sy,tx,ty){
  if(sx===tx && sy===ty) return [];
  if(!passable(tx,ty)){
    const nf = nearestFree(tx,ty,4);
    if(!nf) return null;
    tx = nf.x; ty = nf.y;
  }
  _g.fill(Infinity); _f.fill(Infinity);
  _closed.fill(0); _open.fill(0); _from.fill(-1);
  const s = sy*W+sx, goal = ty*W+tx;
  /* 目的地本身就在匪巢边上（拆巢指令、守卫回窝）就别绕 —— 否则会绕着
     自己要去的地方兜圈子。其余情况绕开危险区：从守卫射程里穿过去，
     等于让居民为了捡一块石头挨三枪。 */
  const avoidDen = !denRisk(tx, ty);
  const h = (x,y)=>{
    const dx = Math.abs(x-tx), dy = Math.abs(y-ty);
    return (dx+dy) + (Math.SQRT2-2)*Math.min(dx,dy);
  };
  const heap = new Heap();
  _g[s] = 0; _f[s] = h(sx,sy); _open[s] = 1; heap.push(s);
  let iter = 0;
  while(heap.size){
    if(++iter > 6000) break;
    const cur = heap.pop();
    if(cur === goal){
      const path = [];
      let n = cur;
      while(n !== s && n >= 0){ path.push({ x:n%W, y:(n/W)|0 }); n = _from[n]; }
      return path.reverse();
    }
    if(_closed[cur]) continue;
    _closed[cur] = 1;
    const cx = cur%W, cy = (cur/W)|0;
    for(const [dx,dy] of N8){
      const nx = cx+dx, ny = cy+dy;
      if(nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni = ny*W+nx;
      if(_closed[ni] || !passable(nx,ny)) continue;
      if(dx && dy && (!passable(cx+dx,cy) || !passable(cx,cy+dy))) continue;  // 不切角
      const step = (dx && dy ? Math.SQRT2 : 1) * walkCost(nx,ny)
        + (avoidDen && denRisk(nx,ny) ? 400 : 0);
      const ng = _g[cur] + step;
      if(ng < _g[ni]-1e-6){
        _g[ni] = ng; _f[ni] = ng + h(nx,ny); _from[ni] = cur;
        if(!_open[ni]){ _open[ni] = 1; }
        heap.push(ni);
      }
    }
  }
  return null;
}

/* =====================================================================
   8 · 居民创建
   ===================================================================== */
function makeColonist(name, x, y){
  const shirt = pick(SHIRTS), skin = pick(SKINS);
  const hair = pick(['#2c2118','#3d2a1c','#5a4630','#1d1d20','#6b4a2c']);
  /* 性格：34% 概率两个特质，其余一个 */
  const pool = TRAIT_KEYS.slice(), traits = [];
  const nT = rnd() < 0.34 ? 2 : 1;
  for(let i=0;i<nT && pool.length;i++) traits.push(pool.splice(Math.floor(RNG()*pool.length),1)[0]);
  const maxHp = 100 + (hasTech('armor') ? 20 : 0);
  return {
    id: state.seq++, side:'col', name,
    x, y, fx:x+0.5, fy:y+0.5, path:null,
    state:'idle', job:null, jobT:0,
    hp:maxHp, maxHp, down:false, downT:0, dead:false, sick:0,
    wound:0, flee:0, traits, bonds:[],
    needs:{ hunger: 82+rnd()*14, rest: 78+rnd()*18, mood: 66+rnd()*14 },
    sleepT:0, sleeping:false, breakT:0, vigor: VIGOR_MAX,
    carry:null, speed:0.44,
    skill:{ chop:rint(3,10), mine:rint(2,9), build:rint(3,10), cook:rint(2,9), fight:rint(3,9) },
    weapon: pick(['rifle','rifle','pistol']), dmg:0, range:0, cd:0, cdT:0, aim:0,
    shirt, skin, hair,
    thought:''
  };
}

function setupWeapon(c){
  if(c.weapon === 'rifle'){ c.dmg=14; c.range=7.5; c.cd=10; }
  else if(c.weapon === 'pistol'){ c.dmg=11; c.range=5.4; c.cd=8; }
  else { c.dmg=16; c.range=1.2; c.cd=7; }
}

function makeRaider(x, y, tier, kind){
  const df = diffDef();
  const kd = RKD[kind] || RKD.blade;
  if(!RKD[kind]) kind = 'blade';
  const baseHp = Math.round((62 + tier*14) * df.hpMul * kd.hp);
  const thief = !!kd.thief;
  const r = {
    id: state.seq++, side:'raid', kind,
    /* 贼的编号走独立流：rint() 吃的是主 RNG，这里用一次就会把世界线推一格 */
    name: thief ? '偷粮贼' + (1 + Math.floor(thrnd()*9)) : kd.n + rint(1,99),
    x, y, fx:x+0.5, fy:y+0.5, path:null,
    state:'idle', job:null, jobT:0,
    hp: baseHp, maxHp: baseHp, down:false, downT:0, dead:false,
    needs:{ hunger:100, rest:100, mood:50 },
    sleepT:0, sleeping:false, breakT:0, carry:null,
    speed: 0.40 * kd.spd,
    skill:{ chop:0, mine:0, build:0, cook:0, fight:4+tier },
    weapon: thief ? 'fists' : (kind === 'slinger' ? 'sling' : (tier > 2 && rnd() < 0.4 ? 'rifle' : 'pistol')),
    dmg:0, range:0, cd:0, cdT:0, aim:0, bldDmg: kd.bldDmg || 0,
    shirt: thief ? '#4e5c3a'
         : kind === 'brute' ? '#5c3a2a' : kind === 'torch' ? '#8a4a1f' : kind === 'slinger' ? '#6b4f6f' : '#7a2f2f',
    skin:'#b98b6e', hair:'#2b2f35', target:null, thought:'', burnT:0,
    /* 偷粮贼专用：sack 是已偷到的食物，loot 是当前正在下手的地块 */
    sack:0, loot:null, flee:0, fled:false, hitOnce:false
  };
  if(thief){
    /* 不还手，但任何「有武器」的判定都别落到他身上 —— 否则他会站在原地开枪 */
    r.dmg = 0; r.range = 0; r.cd = 999;
    return r;
  }
  if(r.weapon === 'rifle'){ r.dmg=10; r.range=7;  r.cd=14; }
  else if(r.weapon === 'sling'){ r.dmg=9; r.range=8; r.cd=16; }
  else { r.dmg=8; r.range=5.2; r.cd=12; }
  r.dmg = Math.max(2, Math.round(r.dmg * kd.dmg * 10) / 10);
  r.range = r.range * kd.rng;
  return r;
}

/* =====================================================================
   9 · 工作系统
   ===================================================================== */
function itemTiles(kind){
  const out = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!t.items) continue;
    for(const s of t.items) if(s.kind === kind){ out.push({x,y,qty:s.qty}); break; }
  }
  return out;
}
function nearestOf(list, x, y){
  let best = null, bd = Infinity;
  for(const p of list){
    const d = dist(p.x,p.y,x,y);
    if(d < bd){ bd = d; best = p; }
  }
  return best;
}

function freeStockTile(){
  const list = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.zone !== 'stock') continue;
    const used = t.items ? t.items.length : 0;
    if(used < 2) list.push({x,y});
  }
  return list.length ? list : null;
}

function canAfford(cost){
  for(const k in cost) if((state.res[k]||0) < cost[k]) return false;
  return true;
}
/* 付款 = 真的从仓库格里扣物品 */
function payCost(cost){
  for(const k in cost){
    let left = cost[k];
    const list = itemTiles(k).filter(p=> tiles[p.y*W+p.x].zone === 'stock');
    for(const p of list){
      if(left <= 0) break;
      left -= takeItems(p.x, p.y, k, left);
    }
  }
}
function refund(cost, ratio, x, y){
  const st = nearestOf(stockpileTiles(), x, y);
  for(const k in cost){
    const n = Math.floor(cost[k]*(ratio||0.5));
    if(n <= 0) continue;
    if(st) addItems(st.x, st.y, k, n);
    else addItems(x, y, k, n);
  }
}
function clearZone(x,y){
  const t = tileAt(x,y);
  if(!t || !t.zone) return;
  if(t.zone === 'stock' && t.items)
    for(const s of t.items) state.res[s.kind] = Math.max(0, (state.res[s.kind]||0) - s.qty);
  /* v2.1：农田取消时必须连土壤一起清掉 —— 只清 zone 的话，
     这块地被开垦过的痕迹会留在格子数据里，下次再圈成农田直接就是熟地。 */
  t.soil = null; t.fert = 0;
  if(t.plant && t.plant.kind === 'crop') t.plant = null;
  t.zone = null;
}

function hasBed(){ for(const t of tiles) if(t.bld && t.bld.prog>=1 && t.bld.type==='bed') return true; return false; }
function hasFire(){ for(const t of tiles) if(t.bld && t.bld.prog>=1 && t.bld.type==='fire') return true; return false; }
function countBuilt(type){ let n=0; for(const t of tiles) if(t.bld && t.bld.prog>=1 && t.bld.type===type) n++; return n; }

/* 分配工作；返回 true 表示已接手 */
function hasLooseItems(){
  for(const t of tiles) if(t.items && t.zone !== 'stock') return true;
  return false;
}
/* 避免两个居民抢同一块地 */
function claimedBy(x, y, self){
  for(const o of state.cols){
    if(o === self || !o.job) continue;
    if(o.job.type === 'wander' || o.job.type === 'sleep' || o.job.type === 'eat') continue;
    if(o.job.x === x && o.job.y === y) return true;
  }
  return false;
}

/* 最近的安全点（床 / 医务所），撤退时用 */
function nearestSafeSpot(c){
  let best = null, bd = Infinity;
  for(let i=0;i<tiles.length;i++){
    const t = tiles[i];
    if(!t.bld || t.bld.prog < 1) continue;
    if(t.bld.type !== 'bed' && t.bld.type !== 'clinic') continue;
    const x = i % W, y = (i / W) | 0;
    const d = dist(x, y, c.x, c.y);
    if(d < bd){ bd = d; best = { x, y }; }
  }
  return best || { x: W>>1, y: H>>1 };
}

/* 全体指令（v1.3）：集火 / 集结 / 撤退 */
function applyCommand(c){
  const cmd = state.cmd;
  if(!cmd) return false;
  if(cmd.kind === 'focus'){
    const t = state.raiders.find(r=> r.id === cmd.id && !r.down && !r.dead);
    if(!t) return false;
    return jobFight(c, t);
  }
  if(cmd.kind === 'rally') return jobHold(c, cmd.x, cmd.y);
  if(cmd.kind === 'retreat'){
    const s = nearestSafeSpot(c);
    return jobHold(c, s.x, s.y);
  }
  return false;
}

/* 蹲在窝里的巢卫不算「门口的敌人」。
   它不会过来，玩家也还没过去 —— 把它算成威胁，全营会因为一个二十格外的
   匪巢停止自愈、停止休息。
   但一旦有人贴进警戒圈（7 格），它就不再是蹲着的了：那是在挨枪。 */
function parkedGuard(r){
  if(!r || !r.home || r.dead || r.down) return false;
  if(dist(r.x, r.y, r.home.x, r.home.y) > 3) return false;
  return !state.cols.some(c=> !c.down && !c.dead && dist(c.x, c.y, r.home.x, r.home.y) < 7);
}

/* 分配工作；返回 true 表示已接手 */
function assignJob(c){
  if(c.carry) return jobDropCarry(c);

  /* 0. 后撤（v1.3）：血量见底先保命，怯懦的人更早触发 */
  if((c.flee || 0) > 0 && jobRetreat(c)) return true;

  /* 1. 饿死 / 累垮压过一切命令 */
  if(c.needs.hunger < 26 && jobEat(c)) return true;
  if(c.needs.rest < 10 && jobSleep(c)) return true;

  /* 2. 玩家下的全体指令 */
  if(applyCommand(c)) return true;

  /* 3. 战斗。
     巢卫不参与自动接敌（v1.8 修正）：它不是来打你的，是等你来的。
     以前这里对全部掠袭者一视同仁，于是在外面砍柴的人只要路过匪巢 13 格内，
     就会自己扔下活跑去单挑两个守卫 —— 玩家看到的是「开局就有人冲出去送死」。
     想打匪巢只有一条路：选中人、点巢，下「拆巢」指令。
     v2.1：偷粮贼也不参与自动接敌。它打不死人，追它却是实打实的工时损失 ——
     自动去追等于替玩家做了一个稳亏的决定。要打它是玩家的选择（点它集火 / 炮塔）。 */
  const foe = nearestOf(state.raiders.filter(r=> !r.down && !r.dead && !r.home && r.kind !== 'thief'), c.x, c.y);
  if(foe && dist(foe.x,foe.y,c.x,c.y) < 13 && c.hp > 25) return jobFight(c, foe);

  /* 3.5 守夜（v1.6）：夜里站岗，不睡，也不去干活 */
  if(c.onWatch && isNightHour() && jobGuard(c)) return true;

  /* 4. 常规需求 */
  if(c.needs.hunger < 30 && jobEat(c)) return true;
  if(shouldSleep(c) && jobSleep(c)) return true;

  /* 5. 治伤（v1.3）：有医务所 + 草药才会去 */
  if((c.wound || 0) >= 15 && countBuilt('clinic') > 0 && countItem('herb') > 0 && jobHeal(c)) return true;

  /* 6. 常规工作（按缺口决定优先级，避免全场只干一件事） */
  const mealN = countItem('meal'), foodN = countItem('food');
  const woodN = countItem('wood'), stoneN = countItem('stone');
  const n = Math.max(1, state.cols.length);
  /* v2.0：劲用完就只剩轻活。砍 / 挖 / 建 / 种要留着劲干 —— 想同时推进
     伐木和修墙，就得多派一个人，而人是复制不出来的。 */
  const heavy = canDoHeavy(c);

  if(heavy && jobBuild(c)) return true;                          // 玩家下的单优先
  /* 催工（v2.0）：危机卡上点了「催工」，今天优先搞那一种。
     没有这个按钮的话，危机就只是「看着倒计时自己到点」—— 玩家没法响应。 */
  if(heavy && state.urge && state.urge.day === state.day){
    const uk = state.urge.k;
    if(uk === 'wood' && jobChop(c)) return true;
    if(uk === 'stone' && jobMine(c)) return true;
    if(uk === 'herb' && jobGatherHerb(c)) return true;
    if(uk === 'food' && jobHarvest(c, 'bush')) return true;
    if(uk === 'meal' && jobCook(c)) return true;
  }
  if(mealN < n*3 && foodN >= 3 && jobCook(c)) return true;       // 缺饭先做饭
  if(jobHarvest(c, 'crop')) return true;                         // 熟了的作物必须收
  /* 粮食不够才种地（v2.1）：先把已经开垦的地种满，再去开新荒 ——
     反过来的话，圈了二十格荒地的人会全员刨土，一粒种子都没下。 */
  if(heavy && foodN + mealN*3 < n*26){
    if(jobSow(c)) return true;
    if(jobTill(c)) return true;
  }
  if(countItem('herb') < 4 && jobGatherHerb(c)) return true;     // 药草常备 4 份
  if(hasLooseItems() && jobHaul(c)) return true;                 // 地面散料归堆
  if(heavy && woodN < 300 && jobChop(c)) return true;
  if(heavy && stoneN < 300 && jobMine(c)) return true;
  if(foodN + mealN < n*9 && jobHarvest(c, 'bush')) return true;  // 食物见底才去摘野果
  if(jobHaul(c)) return true;

  /* 7. 没劲了去烤火（v2.0）。必须排在闲逛前面，
     否则累瘫的人会在营地里东张西望，玩家看不出他为什么不出活。 */
  if(!heavy && jobRest(c)) return true;

  // 8. 闲逛
  return jobWander(c);
}

function shouldSleep(c){
  const h = (state.min % 1440)/60;
  const night = h >= 21.5 || h < 5.5;
  if(c.needs.rest < 16) return true;
  /* 熬过夜的人白天要补觉：这是守夜的另一半代价 —— 看得见有人在睡，而不是隐藏在数值里 */
  if(c.fatigue > 0 && c.needs.rest < 42) return true;
  /* 值守的人不许睡：除非已经困到站不住（rest < 9 时第 1 优先级会强制就寝） */
  if(c.onWatch && night) return c.needs.rest < 9;
  return night && c.needs.rest < 72;
}

function goTo(c, tx, ty, adjacent){
  let gx = tx, gy = ty;
  if(adjacent){
    if(passable(tx,ty) && dist(c.x,c.y,tx,ty) <= 1.01){ gx = tx; gy = ty; }
    else {
      const nbrs = adjacentFree(tx,ty).sort((a,b)=> dist(a.x,a.y,c.x,c.y) - dist(b.x,b.y,c.x,c.y));
      if(!nbrs.length) return false;
      gx = nbrs[0].x; gy = nbrs[0].y;
    }
  }
  if(c.x === gx && c.y === gy){ c.path = []; c.state = 'work'; c.jobT = 0; return true; }
  const p = findPath(c.x, c.y, gx, gy);
  if(!p || !p.length) return false;
  c.path = p; c.state = 'move';
  return true;
}

/* ---- 各类工作 ----
   约定：先 goTo() 决定状态（work / move），成功后再挂 c.job；
   失败清空并返回 false，交给下一个优先级。 */
function setJob(c, job, adj){
  if(!goTo(c, job.x, job.y, adj)){ c.job = null; return false; }
  c.job = job;
  return true;
}

function jobFight(c, foe){
  c.job = { type:'fight', foe };
  c.state = 'fight';
  return true;
}

/* 后撤到安全点（床 / 医务所），期间不接战 */
function jobRetreat(c){
  const s = nearestSafeSpot(c);
  if(dist(c.x, c.y, s.x, s.y) <= 1.3){
    c.job = { type:'retreat', x:c.x, y:c.y, dur:40 };
    c.state = 'work'; c.jobT = 0;
    return true;
  }
  if(c.job && c.job.type === 'retreat' && c.state === 'move') return true;
  return setJob(c, { type:'retreat', x:s.x, y:s.y, dur:40 }, false);
}

/* 原地待命（集结 / 撤退指令用） */
function jobHold(c, x, y){
  if(dist(c.x, c.y, x, y) <= 1.35){
    c.job = { type:'hold', x:c.x, y:c.y, dur:60 };
    c.state = 'work'; c.jobT = 0;
    return true;
  }
  if(c.job && c.job.type === 'hold' && c.state === 'move') return true;
  return setJob(c, { type:'hold', x, y, dur:60 }, false);
}

/* 去医务所处理伤口，消耗 1 份药草 */
function jobHeal(c){
  let best = null, bd = Infinity;
  for(let i=0;i<tiles.length;i++){
    const t = tiles[i];
    if(!t.bld || t.bld.prog < 1 || t.bld.type !== 'clinic') continue;
    const x = i % W, y = (i / W) | 0;
    const d = dist(x, y, c.x, c.y);
    if(d < bd){ bd = d; best = { x, y }; }
  }
  if(!best) return false;
  return setJob(c, { type:'heal', x:best.x, y:best.y, dur:34 }, true);
}

/* 采药草 */
function jobGatherHerb(c){
  let best = null, bd = Infinity;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!t.plant || t.plant.kind !== 'herb' || t.plant.ready === false) continue;
    if(claimedBy(x,y,c)) continue;
    const d = dist(x,y,c.x,c.y);
    if(d < bd){ bd = d; best = {x,y}; }
  }
  if(!best) return false;
  return setJob(c, { type:'herb', x:best.x, y:best.y, dur:30 }, true);
}

function jobEat(c){
  // 有餐食就吃餐食（3 份生食才换 1 份餐食，生吃很亏）
  const m = nearestOf(itemTiles('meal'), c.x, c.y);
  const f = nearestOf(itemTiles('food'), c.x, c.y);
  let t = null, kind = 'food';
  if(m){ t = m; kind = 'meal'; }
  else if(f){ t = f; kind = 'food'; }
  if(!t) return false;
  return setJob(c, { type:'eat', x:t.x, y:t.y, kind, dur:16 }, true);
}

function jobSleep(c){
  const beds = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.bld && t.bld.prog >= 1 && t.bld.type === 'bed') beds.push({x,y});
  }
  const b = nearestOf(beds, c.x, c.y);
  if(b) return setJob(c, { type:'sleep', x:b.x, y:b.y, bed:true }, true);
  c.job = { type:'sleep', x:c.x, y:c.y, bed:false };
  c.state = 'work'; c.jobT = 0;
  return true;
}

function jobBuild(c){
  /* 候选按远近排好，逐个试到有一个真的走得到为止。
     只试最近的那一个的话，一处够不到的蓝图就能把这个人钉死：
     他每轮都挑中它 → 寻路失败 → 放弃 → 下一轮又挑中它，
     旁边明明够得着的墙也跟着没人建。玩家看到的是「工人不干活」。 */
  const cand = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!t.bld || t.bld.prog >= 1) continue;
    if(claimedBy(x,y,c)) continue;
    cand.push({ x, y, t, d: dist(x,y,c.x,c.y) });
  }
  if(!cand.length) return false;
  cand.sort((a,b)=> a.d - b.d);
  for(const o of cand){
    if(setJob(c, { type:'build', x:o.x, y:o.y, dur: BL[o.t.bld.type].work }, true)) return true;
  }
  return false;
}

function jobCook(c){
  if(!hasFire()) return false;
  if(countItem('food') < 3) return false;
  if(countItem('meal') > state.cols.length * 4) return false;
  let fire = null, bd = Infinity;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.bld && t.bld.prog >= 1 && t.bld.type === 'fire'){
      const d = dist(x,y,c.x,c.y);
      if(d < bd){ bd = d; fire = {x,y}; }
    }
  }
  if(!fire) return false;
  return setJob(c, { type:'cook', x:fire.x, y:fire.y, dur:42 }, true);
}

function jobHarvest(c, mode){
  mode = mode || 'any';
  let best = null, bd = Infinity;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!t.plant) continue;
    const p = t.plant;
    const bush = p.kind === 'bush' && p.berries > 0;
    const crop = p.kind === 'crop' && p.grow >= 0.99;
    const ready = mode === 'crop' ? crop : mode === 'bush' ? bush : (bush || crop);
    if(!ready || claimedBy(x,y,c)) continue;
    if(denRisk(x,y)) continue;
    const d = dist(x,y,c.x,c.y);
    if(d < bd){ bd = d; best = {x,y,t}; }
  }
  if(!best) return false;
  return setJob(c, { type:'harvest', x:best.x, y:best.y,
                     dur: best.t.plant.kind === 'bush' ? 32 : 38 }, true);
}

/* 开荒（v2.1）：圈下来的农田先是荒地，得有人把草皮翻开才能播种。
   这一道工序，是"种田"从「圈一块地」变成「投入一个工日」的关键 ——
   在此之前，圈完就能种，食物等于按面积凭空增长。 */
function jobTill(c){
  let best = null, bd = Infinity;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.zone !== 'farm' || t.soil === 'tilled') continue;
    /* 树要玩家自己决定砍不砍；灌木和药草开荒时顺手铲掉就行，
       这样圈地那一刻不会白丢浆果 —— 浆果能一直摘到有人来翻这块地为止。 */
    if(t.plant && t.plant.kind === 'tree') continue;
    if(t.g === T.ROCK || t.g === T.WATER) continue;
    if(claimedBy(x,y,c)) continue;
    const d = dist(x,y,c.x,c.y);
    if(d < bd){ bd = d; best = {x,y}; }
  }
  if(!best) return false;
  return setJob(c, { type:'till', x:best.x, y:best.y, dur: TILL_DUR }, true);
}

function jobSow(c){
  let best = null, bd = Infinity;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.zone !== 'farm' || t.plant) continue;
    if(t.soil !== 'tilled') continue;          // 荒地种不下去
    if(t.g === T.ROCK || t.g === T.WATER) continue;
    if(claimedBy(x,y,c)) continue;
    const d = dist(x,y,c.x,c.y);
    if(d < bd){ bd = d; best = {x,y}; }
  }
  if(!best) return false;
  return setJob(c, { type:'sow', x:best.x, y:best.y, dur:26,
                     crop: state.crop || 'wheat' }, false);
}

/* 匪巢危险区（v1.8.1）：巢边 8 格内，居民不会主动去做活。
   没有这一条，砍柴的人会为了最近的一棵树走进守卫的射程 —— 玩家看到的是
   「开局就有人在匪巢边上挨枪」，而其实他只是想去搬块石头。
   巢点基本是静态的（只有被打掉才会消失），缓存成数组，避免每帧扫全图。 */
function denRisk(x, y){
  const ds = state.dens;
  if(!ds || !ds.length) return false;
  for(const d of ds) if(dist(x, y, d.x, d.y) < 8) return true;
  return false;
}

function jobHaul(c){
  if(!freeStockTile()) return false;
  const srcs = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!t.items || t.zone === 'stock') continue;
    if(claimedBy(x,y,c)) continue;
    if(denRisk(x,y)) continue;
    srcs.push({x,y,t});
  }
  if(!srcs.length) return false;
  const s = nearestOf(srcs, c.x, c.y);
  return setJob(c, { type:'haul', x:s.x, y:s.y, phase:0, dur:7 }, true);
}

function jobDropCarry(c){
  const d = nearestOf(stockpileTiles(), c.x, c.y);
  if(!d){ c.carry = null; return jobWander(c); }
  return setJob(c, { type:'drop', x:d.x, y:d.y, dur:6 }, false);
}

function jobChop(c){
  let best = null, bd = Infinity;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!t.plant || t.plant.kind !== 'tree') continue;
    if(claimedBy(x,y,c)) continue;
    if(denRisk(x,y)) continue;
    const d = dist(x,y,c.x,c.y);
    if(d < bd){ bd = d; best = {x,y}; }
  }
  if(!best) return false;
  return setJob(c, { type:'chop', x:best.x, y:best.y, dur:78 }, true);
}

function jobMine(c){
  let best = null, bd = Infinity;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.g !== T.ROCK) continue;
    if(!adjacentFree(x,y).length) continue;   // 只挖能站到跟前的岩壁
    if(claimedBy(x,y,c)) continue;
    if(denRisk(x,y)) continue;
    const d = dist(x,y,c.x,c.y);
    if(d < bd){ bd = d; best = {x,y}; }
  }
  if(!best) return false;
  return setJob(c, { type:'mine', x:best.x, y:best.y, dur:104 }, true);
}

function jobWander(c){
  const list = [];
  for(let i=0;i<26;i++){
    const x = clamp(c.x + rint(-6,6), 0, W-1), y = clamp(c.y + rint(-6,6), 0, H-1);
    if(passable(x,y) && !denRisk(x,y)) list.push({x,y});
  }
  const t = pick(list);
  c.job = { type:'wander', x:t?t.x:c.x, y:t?t.y:c.y, dur: 18+rnd()*40 };
  if(t && goTo(c, t.x, t.y, false)) c.state = 'move';
  else { c.state = 'work'; c.jobT = 0; }
  return true;
}

/* 找地方歇着（v2.0）：优先篝火边，没有就回床边。
   干劲见底的人应该有一个「他为什么不出活」的可见答案 ——
   坐在火边喘气，比站着发呆好读一百倍。 */
function jobRest(c){
  let spot = null, bd = Infinity;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!t.bld || t.bld.prog < 1) continue;
    if(t.bld.type !== 'fire' && t.bld.type !== 'bed') continue;
    const w = dist(x, y, c.x, c.y) + (t.bld.type === 'fire' ? 0 : 5);
    if(w < bd){ bd = w; spot = { x, y }; }
  }
  if(!spot) return false;
  return setJob(c, { type:'rest', x:spot.x, y:spot.y, dur: 99999 }, true);
}

/* ---- 守夜岗位（v1.6）：
   岗位在排班时算一次（篝火旁，没篝火就在床边），避免每帧全图扫描 */
function computeGuardSpot(){
  let sx = 0, sy = 0, n = 0, hasFire = false;
  const scan = (type)=>{
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const t = tiles[y*W+x];
      if(!t.bld || t.bld.prog < 1 || t.bld.type !== type) continue;
      sx += x; sy += y; n++;
    }
  };
  scan('fire');
  if(n) hasFire = true;
  else scan('bed');
  if(!n) return { x:(W>>1) + 0.5, y:(H>>1) + 0.5, fire:false };
  return { x: sx/n, y: sy/n, fire: hasFire };
}

function jobGuard(c){
  if(c.job && c.job.type === 'guard' && (c.state === 'move' || c.state === 'work')) return true;
  const sp = state.guardSpot || computeGuardSpot();
  const off = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1]][(c.id || 0) % 6];
  const tx = clamp(Math.round(sp.x) + off[0], 1, W-2);
  const ty = clamp(Math.round(sp.y) + off[1], 1, H-2);
  c.job = { type:'guard', x:tx, y:ty, dur:9999 };
  if(dist(c.x, c.y, tx, ty) <= 1.4 || !passable(tx,ty)){ c.state = 'work'; c.jobT = 0; return true; }
  if(goTo(c, tx, ty, false)) c.state = 'move';
  else { c.state = 'work'; c.jobT = 0; }
  return true;
}

/* 修补半径内最破的一座实心建筑 */
function repairNearby(c, r, amount){
  let worst = null, worstHp = Infinity;
  const gx = Math.round(c.x), gy = Math.round(c.y);
  for(let dy=-r; dy<=r; dy++) for(let dx=-r; dx<=r; dx++){
    const t = tileAt(gx+dx, gy+dy);
    if(!t || !t.bld || t.bld.prog < 1) continue;
    if(!BL[t.bld.type].solid) continue;
    const cap = bldMaxHp(t.bld.type);
    if(t.bld.hp >= cap - 1) continue;
    if(t.bld.hp < worstHp){ worstHp = t.bld.hp; worst = t; }
  }
  if(!worst) return 0;
  const cap = bldMaxHp(worst.bld.type);
  worst.bld.hp = Math.min(cap, worst.bld.hp + amount);
  return amount;
}


/* =====================================================================
   10 · 事件日志与特效
   ===================================================================== */
function logEvent(text, cls){
  state.log.unshift({ text, cls: cls||'', t: state.min });
  if(state.log.length > 40) state.log.pop();
  uiDirty.log = true;
}
function addFx(f){
  f.t = performance.now();
  f.life = f.life || 420;
  state.fx.push(f);
}
function floatText(x, y, text, color){
  addFx({ kind:'txt', x, y, text, color, life: 900 });
}

/* =====================================================================
   11 · 需求与心情
   ===================================================================== */
/* 心情拆解（v1.4）：把"为什么心情低"逐条摊到屏幕上，而不是只给一个数字 */
function moodBreakdown(c){
  const it = [];
  const base = hasTrait(c,'cheerful') ? 61 : 52;
  const P = (k, v, fix)=> it.push({ k, v, fix });
  if(c.needs.hunger < 18) P('饿得发慌', -20, 'food');
  else if(c.needs.hunger < 35) P('没吃饱', -10, 'food');
  if(c.needs.rest < 18) P('累垮了', -18, 'bed');
  else if(c.needs.rest < 35) P('没睡够', -8, 'bed');
  if(c.sleeping){
    if(c.job && c.job.bed) P('睡在床上', 5);
    else P('睡在地上', -6, 'bed');
  }
  if(c.hp < 60) P('伤势未愈', -14, 'clinic');
  if(c.down) P('倒地不起', -25, 'clinic');
  const wd = Math.min(14, (c.wound || 0) * 0.14);
  if(wd >= 1) P('伤口作痛', -Math.round(wd), 'clinic');
  if(hasDebuff(c,'scar')) P('脸上那道疤', -7);
  if(nearFire(c)) P('有篝火取暖', 5);
  if(nearCrowd(c)) P(hasTrait(c,'loner') ? '人多太吵' : '挤在一起', hasTrait(c,'loner') ? -11 : -4);
  else if(hasTrait(c,'loner')) P('独处清静', 4);
  if(state.rain > 0.4) P('淋着雨', -4);
  const bm = bondMood(c);
  if(bm) P(bm > 0 ? '朋友在身边' : '跟同伴结了怨', bm);
  if(c.moodBias) P('近期遭遇', Math.round(c.moodBias));
  return { base, items: it };
}
/* 心情的"目标值"：明细相加。实际值向它缓慢靠拢 */
function moodTarget(c){
  const b = moodBreakdown(c);
  let s = b.base;
  for(const i of b.items) s += i.v;
  return clamp(s, 0, 100);
}
function computeMood(c){
  const m = moodTarget(c);
  const prev = c.needs.mood;
  c.needs.mood = clamp(lerp(prev, m, 0.28), 0, 100);
}

/* 崩溃时把触发链写出来，而不是只说"崩溃了" */
function crashReason(c){
  const p = [];
  if(c.needs.hunger < 25) p.push('饿了很多天');
  if(c.needs.rest < 25) p.push('连续几夜没睡好');
  if((c.wound || 0) > 25) p.push('伤一直没好');
  if(bondMood(c) < 0) p.push('跟同伴结了怨');
  if(c.down) p.push('刚被打倒过');
  if(state.rain > 0.4) p.push('长期淋雨');
  if(p.length < 2 && c.needs.hunger < 40) p.push('吃的一直不够');
  if(!p.length) p.push('情绪积压太久');
  return p.slice(0, 3).join('、');
}

/* 关系对心情的影响：朋友在身边提神，积怨在身边闹心 */
function bondMood(c){
  let v = 0;
  for(const b of (c.bonds || [])){
    if(b.v > -55 && b.v < 55) continue;
    const o = state.cols.find(x=> x.id === b.id);
    if(!o || o.down) continue;
    if(dist(o.x, o.y, c.x, c.y) > 5) continue;
    v += b.v >= 55 ? 6 : -8;
  }
  return clamp(v, -14, 14);
}
function nearFire(c){
  for(let y=Math.max(0,c.y-4); y<=Math.min(H-1,c.y+4); y++)
    for(let x=Math.max(0,c.x-4); x<=Math.min(W-1,c.x+4); x++){
      const t = tiles[y*W+x];
      if(t.bld && t.bld.prog >= 1 && t.bld.type === 'fire' && dist(x,y,c.x,c.y) <= 4) return true;
    }
  return false;
}
function nearCrowd(c){
  let n = 0;
  for(const o of state.cols) if(o !== c && !o.down && dist(o.x,o.y,c.x,c.y) < 1.6) n++;
  return n >= 2;
}
function speedMul(c){
  let s = 0.86 + (c.hp/c.maxHp)*0.18;
  if(c.carry) s *= 0.92;
  if(c.needs.rest < 25) s *= 0.88;
  if(hasTrait(c,'diligent')) s *= 1.06;
  if((c.wound || 0) > 65) s *= 0.88;      // 重伤拖着腿走
  if(hasDebuff(c,'lame')) s *= 0.78;      // 旧伤：瘸了就是瘸了
  return s;
}

/* =====================================================================
   11.5 · 干劲（v2.0）
   ---------------------------------------------------------------
   1.9 之前，一个人一天能砌十几段墙：干什么都不花代价，玩家唯一要
   决定的是「盖什么」。可「盖什么」在第 2 天就有标准答案，剩下十天
   全是执行 —— 执行不叫玩。
   干劲把「谁去干」变成真问题：一天满负荷只够两三件事，想同时推进
   伐木和修墙，就得多派一个人，而人是不能复制的。
   每天清晨回满，睡一觉能续一截，但白天歇着回得慢。
   ===================================================================== */
const VIGOR_MAX = 100;
/* 采集比建造便宜一档：采集是「隐藏成本」，玩家看不见自己挖了几趟，
   卡在这里只会让目标莫名其妙做不完；建造是玩家亲手下的单，贵一点才有分量。 */
const VIGOR_COST = {
  chop:0.132, mine:0.140, build:0.128, sow:0.080, harvest:0.084,
  till:0.108, herb:0.072, cook:0.050, haul:0.038, drop:0.014, guard:0.030, wander:0
};
/* 低于这个值就不再接重活：看得见他去找地方坐着，而不是站着发呆 */
const VIGOR_TIRED = 9;

function vigorOf(c){ return c.vigor == null ? VIGOR_MAX : c.vigor; }
function vigorPct(c){ return vigorOf(c) / VIGOR_MAX; }
function canDoHeavy(c){ return vigorOf(c) >= VIGOR_TIRED; }

/* =====================================================================
   12 · 移动与工作推进
   ===================================================================== */
function moveAlong(c, dm){
  if(!c.path || !c.path.length){ c.state = 'idle'; c.job = c.job; return; }
  let budget = c.speed * dm * speedMul(c);
  while(budget > 0 && c.path.length){
    const n = c.path[0];
    const tx = n.x + 0.5, ty = n.y + 0.5;
    const dx = tx - c.fx, dy = ty - c.fy, d = Math.hypot(dx,dy);
    if(d <= budget){
      c.fx = tx; c.fy = ty; budget -= d;
      c.x = n.x; c.y = n.y;
      c.path.shift();
    } else {
      c.fx += dx/d*budget; c.fy += dy/d*budget;
      budget = 0;
    }
  }
  if(!c.path.length){ c.state = 'work'; c.jobT = 0; }
}

function workSpeed(c, type){
  let base = 0.9;
  if(type === 'chop') base = 0.7 + c.skill.chop*0.05;
  else if(type === 'mine') base = 0.7 + c.skill.mine*0.05;
  else if(type === 'build') base = 0.7 + c.skill.build*0.05;
  else if(type === 'cook') base = 0.8 + c.skill.cook*0.045;
  else if(type === 'harvest' || type === 'sow' || type === 'herb' || type === 'till') base = 0.9 + c.skill.chop*0.02;
  if(hasTech('tools')) base *= 1.22;                                     // 铁制工具
  if(hasTrait(c,'diligent')) base *= 1.08;                               // 勤快
  if(hasTrait(c,'deft') && (type === 'build' || type === 'cook')) base *= 1.18;  // 巧手
  if(c.needs.rest < 20) base *= 0.7;
  if(hasDebuff(c,'lung')) base *= 0.90;
  /* 熬了一夜的代价：当天干活慢四分之一；研究「守夜轮值」后能减到一成多 */
  /* 熬夜的代价只压在上半天：下午人已经缓过来了。整天空账会让守夜变成纯亏本买卖 */
  if(c.fatigue > 0 && (state.min % 1440) < 720) base *= hasTech('watch') ? 0.93 : 0.84;
  return base;
}

function gainSkill(c, type){
  const map = { chop:'chop', mine:'mine', build:'build', cook:'cook', herb:'chop', harvest:'chop', sow:'chop', till:'chop' };
  const k = map[type];
  if(k && c.skill[k] < 12 && rnd() < (hasTrait(c,'diligent') ? 0.46 : 0.30)) c.skill[k] += 0.15;
}

function doWork(c, dm){
  const j = c.job;
  if(!j){ c.state = 'idle'; return; }

  if(j.type === 'sleep'){
    c.sleeping = true;
    c.needs.rest += 0.30*dm;
    /* 睡觉同时回劲：夜里睡够，第二天才有力气 */
    c.vigor = Math.min(VIGOR_MAX, vigorOf(c) + 0.42*dm);
    const h = (state.min % 1440)/60;
    const dayTime = h >= 6.5 && h < 21;
    /* 熬过夜的人可以多睡一会儿（补觉到 10:30 或体力回到 90），否则白天根本没机会还这笔账 */
    const wakeRest = c.fatigue > 0 ? 82 : 78;
    const wakeH = c.fatigue > 0 ? 10 : 8;
    if(c.needs.rest >= 99 ||
       (dayTime && (c.needs.rest >= 96 || (h >= wakeH && c.needs.rest > wakeRest))) ||
       c.needs.hunger < 12){
      c.sleeping = false;
      c.job = null; c.state = 'idle';
    }
    return;
  }

  /* 歇着（v2.0）：干劲见底，回营地烤火。
     不是睡觉 —— 白天躺床上太假，坐在火边更像回事。回得比睡觉慢，
     所以「今天先歇一歇」是有代价的，不是免费的。 */
  if(j.type === 'rest'){
    c.sleeping = false;
    c.vigor = Math.min(VIGOR_MAX, vigorOf(c) + 0.34*dm);
    if(vigorOf(c) >= VIGOR_TIRED + 10){ c.job = null; c.state = 'idle'; }
    return;
  }

  /* 守夜（v1.6）：站着不动，顺手把附近的墙补一补 —— 守夜也要有可见的产出 */
  if(j.type === 'guard'){
    c.sleeping = false;
    c.jobT += dm;
    c.vigor = Math.max(0, vigorOf(c) - dm * VIGOR_COST.guard);
    if(c.jobT >= 20){
      c.jobT = 0;
      repairNearby(c, 3, hasTech('watch') ? 3.0 : 2.0);
    }
    return;
  }

  c.jobT += dm * workSpeed(c, j.type);
  c.vigor = Math.max(0, vigorOf(c) - dm * (VIGOR_COST[j.type] || 0));
  if(c.jobT < j.dur) return;
  c.jobT = 0;
  gainSkill(c, j.type);
  finishJob(c, j);
}

function finishJob(c, j){
  const t = tileAt(j.x, j.y);

  switch(j.type){
    case 'chop': {
      if(t && t.plant && t.plant.kind === 'tree'){
        t.plant = null;
        addItems(j.x, j.y, 'wood', 14); SFX.chop();
        state.res.wood += 0; state.stats.wood += 14;
        floatText(j.x+0.5, j.y+0.5, '+14 木材', '#d8b483');
        addFx({ kind:'ring', x:j.x+0.5, y:j.y+0.5, life:500 });
      }
      break;
    }
    case 'mine': {
      if(t && t.g === T.ROCK){
        t.g = T.DIRT; t.v = rnd(); t.h = clamp(t.h - 0.12, 0, 1);
        /* 筑城野心：石料产出 +35%，否则 22 段墙的缺口补不上 */
        const amt = Math.max(1, Math.round(11 * ambMul('stoneMul')));
        addItems(j.x, j.y, 'stone', amt); SFX.mine();
        state.stats.stone += amt;
        floatText(j.x+0.5, j.y+0.5, `+${amt} 石料`, '#c8ced6');
        addFx({ kind:'ring', x:j.x+0.5, y:j.y+0.5, life:500 });
        repaintTile(j.x, j.y);
      }
      break;
    }
    case 'harvest': {
      if(t && t.plant){
        const p = t.plant;
        if(p.kind === 'bush'){
          const n = p.berries*2;
          p.berries = 0; p.regrow = 700;
          addItems(j.x, j.y, 'food', n);
          floatText(j.x+0.5, j.y+0.5, '+'+n+' 食物', '#8fd08a');
        } else {
          /* 作物（v2.1）：产量 = 品种 × 地力。地力 0.30 → ×0.89，0.82 → ×1.18。
             收完之后地力还要按品种再动一次：麦耗地，豆养地。
             连作麦的人第三年就会发现同一块地收得越来越少 —— 这就是轮作的动机。 */
          const cd = cropDef(p.crop);
          const f0 = (typeof t.fert === 'number' && t.fert > 0) ? t.fert : 0.6;
          const mul = 0.72 + f0*0.56;
          if(cd.med){
            const n = Math.max(1, Math.round((cd.herb||3) * mul));
            addItems(j.x, j.y, 'herb', n);
            state.stats.herb = (state.stats.herb||0) + n;
            floatText(j.x+0.5, j.y+0.5, '+'+n+' 药草', '#a8d8a0');
          } else {
            const n = Math.max(1, Math.round(cd.yield * mul));
            addItems(j.x, j.y, 'food', n);
            floatText(j.x+0.5, j.y+0.5, '+'+n+' 食物', '#8fd08a');
          }
          t.fert = clamp(f0 + cd.fert * 0.16, 0.12, 1);
          t.plant = null;
        }
      }
      break;
    }
    case 'till': {
      if(t && t.zone === 'farm' && t.soil !== 'tilled'){
        /* 翻地顺手把草皮带草籽一起铲了 —— 圈地时不动它们，
           是为了让那丛浆果能一直摘到有人来翻这块地为止。 */
        t.plant = null;
        t.soil = 'tilled';
        t.fert = groundFert(t.g);          // 土质底子在这一刻定下来
        addItems(j.x, j.y, 'wood', 2);     // 清出来的树根碎柴
        addItems(j.x, j.y, 'food', 2);     // 翻土翻出来的块茎 —— 开荒不该是纯亏损
        floatText(j.x+0.5, j.y+0.2, '开荒完成', '#c8b48a');
        addFx({ kind:'ring', x:j.x+0.5, y:j.y+0.5, life:420 });
      }
      break;
    }
    case 'sow': {
      if(t && !t.plant && t.zone === 'farm' && t.soil === 'tilled')
        t.plant = { kind:'crop', crop: j.crop || 'wheat', grow:0, sway: rnd()*TAU };
      break;
    }
    case 'build': {
      if(t && t.bld && t.bld.prog < 1){
        t.bld.prog = 1; SFX.done();
        if(t.bld.type === 'turret') t.bld.ang = -Math.PI/2;
        state.stats.built++;
        floatText(j.x+0.5, j.y+0.3, '建成', '#8fd08a');
      }
      break;
    }
    case 'cook': {
      if(countItem('food') >= 3){
        removeItemAnywhere('food', 3, j.x, j.y);
        const st = nearestOf(stockpileTiles(), j.x, j.y);
        if(st) addItems(st.x, st.y, 'meal', 1);
        else addItems(j.x, j.y, 'meal', 1);
        floatText(j.x+0.5, j.y+0.2, '+1 餐食', '#f0c46a');
      }
      break;
    }
    case 'eat': {
      const got = takeItems(j.x, j.y, j.kind, 1);
      if(got){
        if(j.kind === 'meal'){ c.needs.hunger += 62; c.needs.mood = clamp(c.needs.mood+3,0,100); }
        else { c.needs.hunger += 26; c.needs.mood = clamp(c.needs.mood-5,0,100); }
        c.needs.hunger = clamp(c.needs.hunger, 0, 100);
        floatText(c.fx, c.fy-0.2, j.kind === 'meal' ? '吃饱了' : '吃了生食', '#a8d8a0');
      }
      break;
    }
    case 'haul': {
      if(j.phase === 0){
        if(t && t.items && t.items.length){
          const s = t.items[0];
          const n = Math.min(s.qty, 45);
          s.qty -= n;
          if(s.qty <= 0) t.items.splice(0,1);
          if(t.items && !t.items.length) t.items = null;
          c.carry = { kind:s.kind, qty:n };
          const d = nearestOf(stockpileTiles(), c.x, c.y);
          if(d && goTo(c, d.x, d.y, false)){
            c.job = { type:'haul', x:d.x, y:d.y, phase:1, dur:6 };
            return;
          }
          c.carry = null;
        }
      } else {
        if(c.carry){ addItems(j.x, j.y, c.carry.kind, c.carry.qty); c.carry = null; }
      }
      break;
    }
    case 'drop': {
      if(c.carry){ addItems(j.x, j.y, c.carry.kind, c.carry.qty); c.carry = null; }
      break;
    }
    case 'herb': {
      if(t && t.plant && t.plant.kind === 'herb'){
        t.plant.ready = false; t.plant.regrow = 900; t.plant.grow = 0.30;
        addItems(j.x, j.y, 'herb', 2);
        floatText(j.x+0.5, j.y+0.5, '+2 药草', '#a6d79a');
        addFx({ kind:'ring', x:j.x+0.5, y:j.y+0.5, life:420 });
      }
      break;
    }
    case 'heal': {
      if(countItem('herb') > 0){
        removeItemAnywhere('herb', 1, j.x, j.y);
        c.wound = Math.max(0, (c.wound || 0) - 24);
        c.hp = Math.min(c.maxHp, c.hp + 12);
        floatText(c.fx, c.fy - 0.4, '伤口好转', '#8fd08a');
        noteHist(c, '用草药处理了伤口', 'good');
        SFX.done();
      }
      break;
    }
    default: break;
  }

  c.job = null;
  c.state = 'idle';
}

function removeItemAnywhere(kind, qty, nx, ny){
  const list = itemTiles(kind);
  list.sort((a,b)=> dist(a.x,a.y,nx,ny) - dist(b.x,b.y,nx,ny));
  let left = qty;
  for(const p of list){
    if(left <= 0) break;
    left -= takeItems(p.x, p.y, kind, left);
  }
  return qty - left;
}

/* =====================================================================
   13 · 战斗
   ===================================================================== */
function hasLOS(x0,y0,x1,y1){
  let x = x0, y = y0;
  const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, guard = 0;
  while(guard++ < 200){
    if(x === x1 && y === y1) return true;
    if(!(x === x0 && y === y0)){
      const t = tileAt(x,y);
      if(!t) return false;
      if(t.g === T.ROCK) return false;
      if(t.bld && t.bld.prog >= 1 && BL[t.bld.type].solid) return false;
    }
    const e2 = 2*err;
    if(e2 > -dy){ err -= dy; x += sx; }
    if(e2 < dx){ err += dx; y += sy; }
  }
  return false;
}

/* 掩体（v1.3）：相邻的岩壁 / 实心建筑能挡掉一部分命中 */
function coverAt(x, y){
  let c = 0;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const t = tileAt(x+dx, y+dy);
    if(!t) continue;
    if(t.g === T.ROCK) c++;
    else if(t.bld && t.bld.prog >= 1 && BL[t.bld.type].solid) c++;
  }
  return Math.min(2, c);
}

function shoot(src, tgt, isTurret){
  const d = dist(src.fx, src.fy, tgt.fx, tgt.fy);
  const skill = isTurret ? 9 : (src.skill.fight || 4);
  let acc = 0.62 + skill*0.022 - d*0.042;
  if(!hasLOS(src.x, src.y, tgt.x, tgt.y)) acc *= 0.5;
  const cov = coverAt(tgt.x, tgt.y);
  if(cov) acc *= (1 - cov*0.12);
  if(!isTurret && src.side === 'col' && hasTrait(src,'timid')) acc *= 0.90;
  /* 夜间视野（v1.6）：没有火把的人几乎是在朝黑影开枪。
     守夜的人举着火，不受这条影响 —— 这是守夜的第二个价值：不是更能打，是看得见。 */
  if(!isTurret && src.side === 'col' && isNightHour() && !(src.job && src.job.type === 'guard')) acc *= 0.75;
  acc = clamp(acc, 0.10, 0.94);
  addFx({ kind:'shot', x:src.fx, y:src.fy-0.1, tx:tgt.fx, ty:tgt.fy-0.1, life:180 });
  SFX.shot();
  if(rnd() < acc){
    /* v1.9：瞄准射击给这一枪挂一个倍数，打完立刻清掉 */
    const dmg = src.dmg * (0.75 + rnd()*0.55) * (src.aimBoost || 1)
              * (hasDebuff(src,'tremor') ? 0.85 : 1);
    src.aimBoost = 1;
    hurt(tgt, dmg, src);
  } else {
    src.aimBoost = 1;
    addFx({ kind:'hit', x:tgt.fx + (rnd()-0.5)*0.5, y:tgt.fy + (rnd()-0.5)*0.5, life:260 });
  }
}

function hurt(a, dmg, from){
  if(a.dead) return;
  /* v2.2：记下这一下是谁打的。结算时「他是怎么死的」要靠它回答 ——
     以前的战报只有「阵亡 2 人」，玩家连死在谁手上都不知道。 */
  if(from){ a.lastHitBy = from.name || '不明来路'; a.lastHitKind = from.kind || null; a.lastHitD = state.day; }
  if(a.side === 'col' && hasTech('armor')) dmg *= 0.88;
  /* 偷袭（v1.6）：睡着的人被第一下打中要多吃 55% 伤害。
     守夜的收益有一半就体现在这里 —— 他不是更能打，而是不会在睡梦里挨这一刀。 */
  if(a.side === 'col' && a.sleeping && from && from.side === 'raid'){
    dmg *= 1.7;
    a.sleeping = false;
    a.job = null; a.state = 'idle'; a.path = null;   // 不清 job 的话下一帧又躺回去了
    logEvent(`<b>${a.name}</b> 在睡梦里被捅了一刀。`, 'bad');
  }
  a.hp -= dmg;
  /* v2.2：伤到一定程度才记 —— 每挨一枪都记会把个人史冲成一串「被打伤」。
     按天按人自动去重，所以同一天被同一个人打十枪只留一条。 */
  if(a.side === 'col' && from && dmg >= 6) noteHist(a, `被${from.name || '不明来路'}打伤`, 'bad', 'wound');
  if(a.side === 'col'){
    /* 伤口（v1.3）：不只是扣血，还会累积成需要草药处理的伤 */
    const wm = hasTrait(a,'tough') ? 0.5 : 1;
    a.wound = clamp((a.wound||0) + dmg*0.45*wm, 0, 100);
    /* 被匪巢守卫打了就别还手 —— 守卫只在窝边六格开火，撤出去就安全，
       站着对枪是拿三个农民换两个守卫。这一条也是「开局崩盘」的止血钳。 */
    if(from && from.home && !(a.order && a.order.kind === 'demolish')){
      a.flee = Math.max(a.flee || 0, 70);
    }
    /* 低血后撤：怯懦的人更早退，其余人撑到 26% 才退；附近没人就不必跑 */
    const thr = (hasTrait(a,'timid') ? 0.42 : 0.26) * a.maxHp;
    const nearFoe = state.raiders.some(r=> !r.down && !r.dead && !parkedGuard(r) && dist(r.x,r.y,a.x,a.y) < 10);
    if(a.hp < thr && a.hp > 0 && !a.flee && nearFoe) a.flee = 90;
  }
  SFX.hit();
  addFx({ kind:'hit', x:a.fx, y:a.fy, life:300 });
  /* 血雾 + 屏震 + 几帧停顿：让"打中"有重量 */
  addFx({ kind:'blood', x:a.fx, y:a.fy, life:430, a0: rnd()*TAU });
  kickShake(a.side === 'col' ? 2.6 : 1.5, 170);
  kickHit(0.026);
  floatText(a.fx, a.fy-0.5, '-'+Math.round(dmg), '#ff9d94');
  state.decals.push({ x:a.x, y:a.y, ox:0.3+rnd()*0.4, oy:0.3+rnd()*0.4,
                      r:0.7+rnd()*0.7, rot:rnd()*TAU, a:0.30+rnd()*0.2 });
  if(state.decals.length > 160) state.decals.shift();

  if(a.hp <= -35){
    a.dead = true; a.down = true;
    SFX.die();
    if(a.side === 'col'){
      logEvent(`<b>${a.name}</b> 阵亡了。`, 'bad');
      state.cols = state.cols.filter(x=> x !== a);
      state.stats.deaths = (state.stats.deaths || 0) + 1;   // v1.8 野心判定用
      /* v2.2 讣告：名字、第几天、死在谁手上 */
      state.kia = state.kia || [];
      state.kia.push({ n: a.name, d: state.day, by: a.lastHitBy || '不明来路', k: a.lastHitKind || null });
      noteDay(`<b>${a.name}</b> 阵亡 —— 死在${a.lastHitBy || '不明来路'}手上`, 'bad');
    } else {
      dropLoot(a);
      logEvent(`一名掠袭者被击毙。`, 'good');
      state.raiders = state.raiders.filter(x=> x !== a);
      state.stats.kills++;
    }
    return;
  }
  /* 掠袭者没有救援机制：血量归零即判定被消灭（此前只昏迷 150 分钟再消失，导致击杀数永远为 0） */
  if(a.side === 'raid' && a.hp <= 0 && !a.dead){
    a.dead = true; a.down = true;
    SFX.die();
    dropLoot(a);
    logEvent(`一名掠袭者被击毙。`, 'good');
    state.raiders = state.raiders.filter(x=> x !== a);
    state.stats.kills++;
    return;
  }
  if(a.hp <= 0 && !a.down){
    a.down = true;
    a.downT = a.side === 'col' ? 180 : 150;
    a.job = null; a.state = 'idle'; a.sleeping = false; a.path = null;
    if(a.carry){ addItems(a.x, a.y, a.carry.kind, a.carry.qty); a.carry = null; }
    logEvent(a.side === 'col' ? `<b>${a.name}</b> 倒下了！` : `一名掠袭者失去战斗能力。`, a.side === 'col' ? 'bad' : 'good');
    if(a.side === 'col'){
      noteHist(a, `被${a.lastHitBy || '不明来路'}打倒`, 'bad');
      noteDay(`<b>${a.name}</b> 倒下，被人拖了回去`, 'bad');
    }
  }
}

function updateFight(c, dm){
  const j = c.job;
  if(!j || !j.foe || j.foe.dead || j.foe.down){
    c.job = null; c.state = 'idle'; c.cdT = 0; return;
  }
  const foe = j.foe;
  const d = dist(c.fx, c.fy, foe.fx, foe.fy);
  c.aim = Math.atan2(foe.fy - c.fy, foe.fx - c.fx);

  /* 追不到就别追了（v1.8.1）。
     以前这里只认「对手被打倒」这一个出口，于是一个卡在河对岸、或者站在
     够不着的死角里的掠袭者，就能把整营人拴在原地追到饿死 —— 实测 seed 11
     的四个人 hunger 全都归零、job 全是 fight，最后集体倒下，而对面只死了
     一个。两条闸：饿/困到临界就别追了；追了 90 分钟还没拉近也放弃。
     正在对射（在射程内且有视线）不算「追不到」，照打。 */
  const inRange = d <= c.range*0.92 && hasLOS(c.x, c.y, foe.x, foe.y);
  if(!inRange){
    if(c.needs.hunger < 20 || c.needs.rest < 6){
      c.job = null; c.state = 'idle'; c.path = null; c.cdT = 0;
      return;
    }
    if(j.bestD == null || d < j.bestD - 0.4){ j.bestD = d; j.stuckT = 0; }
    else {
      j.stuckT = (j.stuckT || 0) + dm;
      if(j.stuckT > 90){
        c.job = null; c.state = 'idle'; c.path = null; c.cdT = 0;
        return;
      }
    }
  } else j.stuckT = 0;

  if(d > c.range*0.92 || !hasLOS(c.x, c.y, foe.x, foe.y)){
    j.pathT = (j.pathT || 0) - dm;
    const key = foe.x*1000 + foe.y;
    if(!c.path || !c.path.length || j.pathT <= 0 || j.foeKey !== key){
      j.pathT = 12; j.foeKey = key;
      const adj = adjacentFree(foe.x, foe.y)
        .sort((a,b)=>{
          const ca = coverAt(a.x, a.y), cb = coverAt(b.x, b.y);
          if(ca !== cb) return cb - ca;                      // 先抢掩体，再考虑远近
          return dist(a.x,a.y,c.x,c.y) - dist(b.x,b.y,c.x,c.y);
        });
      let moved = false;
      for(let i=0;i<Math.min(3,adj.length);i++){
        const p = findPath(c.x, c.y, adj[i].x, adj[i].y);
        if(p){ c.path = p; moved = true; break; }
      }
      if(!moved && adj.length){
        const p = findPath(c.x, c.y, adj[0].x, adj[0].y);
        if(p) c.path = p;
      }
    }
    if(c.path && c.path.length) moveAlong(c, dm);
    else { c.cdT -= dm; if(c.cdT <= 0 && d <= c.range*1.15){ shoot(c, foe); c.cdT = c.cd; } }
    return;
  }
  c.cdT -= dm;
  if(c.cdT <= 0){ shoot(c, foe); c.cdT = c.cd; }
}

/* 建筑受伤 / 被摧毁的统一入口（破门槌、纵火、破墙都走这里） */
function damageBuilding(x, y, dmg){
  const t = tileAt(x, y);
  if(!t || !t.bld) return false;
  /* 匪巢（v1.8）：旁边的守卫还活着，窝就拆不动。
     没有这一条，玩家会绕过守卫直接拆家，「远征」变成四个人拆房子。 */
  if(t.bld.type === 'den'){
    const guards = state.raiders.filter(r=> r.home && !r.dead && !r.down
      && Math.hypot(r.x - x, r.y - y) < 6).length;
    if(guards > 0) dmg *= 0.45;
  }
  t.bld.hp -= dmg;
  if(t.bld.hp <= 0){
    const typ = t.bld.type;
    const nm = BL[typ].name;
    t.bld = null;
    if(typ === 'den'){
      state.stats.dens = (state.stats.dens || 0) + 1;
      /* 危险区缓存也要跟着少一处，否则居民会一直绕开那片空地 */
      state.dens = (state.dens || []).filter(d=> d.x !== x || d.y !== y);
      logEvent(`匪巢被夷为平地 —— <b>${state.stats.dens}/3</b>。`, 'good');
      showAlert(`匪巢已毁 · ${state.stats.dens}/3`, false);
      SFX.done();
      /* 窝没了，守卫也就散了：留着他们会变成一支没家的队伍到处乱走。
         判定按「巢的坐标」算，不能按守卫当前站的位置 —— 追人追出八格外的
         那个守卫不会被清掉，然后带着一个指向空地的 home 站在废墟上，
         变成一座不会散、也不进袭击计数的活路障。 */
      state.raiders = state.raiders.filter(r=> {
        if(r.home && Math.hypot(r.home.x - x, r.home.y - y) < 0.6){
          addFx({ kind:'blood', x:r.fx, y:r.fy, life:420, a0: rnd()*TAU });
          return false;
        }
        return true;
      });
      addFx({ kind:'ring', x:x+0.5, y:y+0.5, life:1200 });
      kickShake(9, 520); kickHit(0.09);
      uiDirty.side = true;
    } else {
      logEvent(`一座${nm}被摧毁了！`, 'bad');
    }
    addFx({ kind:'debris', x:x+0.5, y:y+0.5, life:620, a0: rnd()*TAU });
    kickShake(5.5, 340);
    kickHit(0.055);
    return true;
  }
  return false;
}

function nearestBuilding(x, y, filter){
  let best = null, bd = Infinity;
  for(let ty=0; ty<H; ty++) for(let tx=0; tx<W; tx++){
    const t = tiles[ty*W+tx];
    if(!t.bld || t.bld.prog < 1) continue;
    if(filter && !filter(t.bld)) continue;
    const d = dist(tx, ty, x, y);
    if(d < bd){ bd = d; best = { x:tx, y:ty, t }; }
  }
  return best;
}

/* 击杀偷粮贼要把赃物吐出来：不吐的话，「打它」和「放任它」的收益一样，
   而它挨打就已经丢一半了 —— 玩家会算出来「不如别管」 */
function dropLoot(a){
  if(!a || a.side !== 'raid') return;
  if(a.kind !== 'thief' || !(a.sack > 0)) return;
  const n = a.sack;
  a.sack = 0;
  addItems(a.x, a.y, 'food', n);
  floatText(a.fx, a.fy - 0.3, `夺回 ${n} 食物`, '#8fd08a');
  logEvent(`从偷粮贼手里夺回 <b>${n}</b> 份收成。`, 'good');
}

function updateRaider(r, dm){
  if(r.dead) return;
  if(r.fled){ state.raiders = state.raiders.filter(x=> x !== r); return; }
  if(r.down){
    r.downT -= dm;
    if(r.downT <= 0){ state.raiders = state.raiders.filter(x=>x !== r); }
    return;
  }
  /* 偷粮贼走自己那条线：不接战、不追人、不拆家 */
  if(r.kind === 'thief'){ updateThief(r, dm); return; }

  /* ---- 匪巢守卫（v1.8）：只守不攻 ----
     没人靠近就回巢蹲着。少了这一段，守卫会跟着最近的居民一路走进
     营地，玩家一仗不用出兵，只要在自家墙下耗死他们就行 —— 那样
     「远征」只是「守成多打九个人」。 */
  if(r.home){
    const homeD = dist(r.x, r.y, r.home.x, r.home.y);
    /* 警戒圈 6 格、拴绳 2.5 格。
       以前是 10 / 8：巢卫的枪能打 6 格，站在离窝 8 格的地方开火，
       实际威胁半径就到了 14 格 —— 而匪巢只要离营地 11 格，玩家的火堆
       就已经在射程里了。开局什么都没做就先挨打，是这么来的。
       另外被打了要还手，否则玩家可以站在警戒圈外把守卫一个个点掉。 */
    const threat = r.hp < r.maxHp || state.cols.some(c=> !c.down && !c.dead
      && dist(c.x, c.y, r.home.x, r.home.y) < 6);
    if(!threat || homeD > 2.5){
      r.target = null;
      if(dist(r.x, r.y, r.home.x, r.home.y) > 2.2){
        r.repath = (r.repath || 0) - dm;
        if(!r.path || !r.path.length || r.repath <= 0){
          r.repath = 40;
          r.path = findPath(r.x, r.y, r.home.x, r.home.y);
        }
        if(r.path && r.path.length) moveAlong(r, dm);
      }
      r.state = 'idle';
      return;
    }
  }

  /* ---- 破门槌 / 纵火者：不管人，只盯着建筑 ---- */
  if((r.kind === 'brute' || r.kind === 'torch') && !r.bldGiveUp){
    /* 目标建筑缓存 20 分钟一刷，避免每分钟全图扫描 */
    r.bScanT = (r.bScanT || 0) - dm;
    let bt = null;
    if(r.bTarget){
      const t2 = tileAt(r.bTarget.x, r.bTarget.y);
      if(t2 && t2.bld) bt = { x:r.bTarget.x, y:r.bTarget.y, t:t2 };
      else r.bTarget = null;
    }
    if(!bt && r.bScanT <= 0){
      /* v1.8 修正：匪巢不是「建筑」，掠袭者不会烧自己人的老窝。
         不排除的话会出现「玩家一个兵没派，匪巢被纵火者烧光了」——
         目标被敌人替玩家完成，野心判定直接失真。 */
      bt = nearestBuilding(r.x, r.y, b=> b.type !== 'den'
        && (r.kind === 'torch' ? true : (BL[b.type].solid && b.type !== 'turret')));
      r.bScanT = 20;
      r.bTarget = bt ? { x:bt.x, y:bt.y } : null;
    }
    if(bt){
      r.target = null;
      const bx = bt.x + 0.5, by = bt.y + 0.5;
      const d2 = dist(r.fx, r.fy, bx, by);
      r.aim = Math.atan2(by - r.fy, bx - r.fx);

      if(d2 > 1.42){
        r.repath = (r.repath || 0) - dm;
        const key = bt.x*1000 + bt.y;
        if(!r.path || !r.path.length || r.repath <= 0 || r.bKey !== key){
          r.repath = 16; r.bKey = key;
          const adj = adjacentFree(bt.x, bt.y)
            .sort((a,b)=> dist(a.x,a.y,r.x,r.y) - dist(b.x,b.y,r.x,r.y));
          let ok = false;
          for(let i=0;i<Math.min(3,adj.length);i++){
            const p = findPath(r.x, r.y, adj[i].x, adj[i].y);
            if(p){ r.path = p; ok = true; break; }
          }
          if(!ok){
            r.stuck = (r.stuck || 0) + dm;
            if(r.stuck > 1500){ r.bldGiveUp = true; r.stuck = 0; }   // 拆不到就转去打人
          } else r.stuck = 0;
        }
        if(r.path && r.path.length) moveAlong(r, dm);
        return;
      }

      /* 已经贴到墙根 */
      if(r.kind === 'torch'){
        if(!(bt.t.bld.burn > 0)){
          bt.t.bld.burn = 200;
          logEvent(`<b>${r.name}</b> 点燃了${BL[bt.t.bld.type].name}！`, 'bad');
          addFx({ kind:'ring', x:bx, y:by, life:700 });
        }
        r.cdT = (r.cdT || 0) - dm;
        if(r.cdT <= 0){ r.cdT = 10; damageBuilding(bt.x, bt.y, 4); }
        return;
      }
      r.cdT = (r.cdT || 0) - dm;
      if(r.cdT <= 0){
        r.cdT = 4;
        SFX.hit();
        addFx({ kind:'hit', x:bx, y:by, life:260 });
        damageBuilding(bt.x, bt.y, 14 * (r.bldDmg || 1));
      }
      return;
    }
  }

  const cols = state.cols.filter(c=> !c.down);
  if(!cols.length) return;

  /* 目标：投石手专挑残血，其余找最近的 */
  const bad = !r.target || r.target.dead || r.target.down || !state.cols.includes(r.target);
  if(bad){
    if(r.kind === 'slinger'){
      let best = null, bh = Infinity;
      for(const c of cols) if(c.hp < bh){ bh = c.hp; best = c; }
      r.target = best;
    } else {
      let best = null, bd = Infinity;
      for(const c of cols){ const d = dist(c.x,c.y,r.x,r.y); if(d < bd){ bd = d; best = c; } }
      r.target = best;
    }
  }
  const t = r.target;
  if(!t){ r.state = 'idle'; return; }
  const d = dist(r.fx, r.fy, t.fx, t.fy);
  r.aim = Math.atan2(t.fy - r.fy, t.fx - r.fx);
  const range = Math.min(6.6, r.range * 0.92);

  if(d > range || !hasLOS(r.x, r.y, t.x, t.y)){
    r.repath = (r.repath || 0) - dm;
    const key = t.x*1000 + t.y;
    if(!r.path || !r.path.length || r.repath <= 0 || r.tKey !== key){
      r.repath = 14; r.tKey = key;
      const adj = adjacentFree(t.x, t.y).sort((a,b)=> dist(a.x,a.y,r.x,r.y) - dist(b.x,b.y,r.x,r.y));
      let ok = false;
      for(let i=0;i<Math.min(3,adj.length);i++){
        const p = findPath(r.x, r.y, adj[i].x, adj[i].y);
        if(p){ r.path = p; ok = true; break; }
      }
      if(!ok){
        r.bash = true;                        // 目标不可达 → 破墙
        r.stuck = (r.stuck || 0) + dm;
        if(r.stuck > 1400){
          state.raiders = state.raiders.filter(x=> x !== r);
          logEvent('一名掠袭者找不到突破口，悻悻离开了。', '');
          return;
        }
      } else {
        r.stuck = 0;
      }
    }
    if(r.path && r.path.length) moveAlong(r, dm);
    else if(r.bash){ r.bash = false; meleeBreach(r, t, dm); }
    return;
  }
  r.cdT -= dm;
  if(r.cdT <= 0){ shoot(r, t); r.cdT = r.cd; }
}

function meleeBreach(r, t, dm){
  // 目标不可达：就近破坏一堵墙/建筑
  let best = null, bd = Infinity;
  for(let y=Math.max(0,r.y-2); y<=Math.min(H-1,r.y+2); y++)
    for(let x=Math.max(0,r.x-2); x<=Math.min(W-1,r.x+2); x++){
      const tl = tiles[y*W+x];
      if(!tl.bld || tl.bld.prog < 1 || !BL[tl.bld.type].solid) continue;
      const dd = dist(x,y,r.x,r.y);
      if(dd < bd){ bd = dd; best = {x,y,tl}; }
    }
  if(!best) return;
  damageBuilding(best.x, best.y, 16*dm*(r.bldDmg || 1));
}

function updateTurrets(dm){
  const t2 = hasTech('turret2');
  const reach = t2 ? 10.5 : 8.5;
  const power = t2 ? 26 : 18;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!t.bld || t.bld.prog < 1 || t.bld.type !== 'turret') continue;
    const b = t.bld;
    const foe = nearestOf(state.raiders.filter(r=> !r.down && !r.dead), x, y);
    if(!foe || dist(x,y,foe.x,foe.y) > reach) continue;
    b.ang = Math.atan2(foe.y+0.5 - (y+0.5), foe.x+0.5 - (x+0.5));
    b.cdT = (b.cdT || 0) - dm;
    if(b.cdT <= 0){
      b.cdT = 12;
      shoot({ fx:x+0.5, fy:y+0.5, x, y, dmg: power, skill:{fight:9} }, foe, true);
    }
  }
}

/* =====================================================================
   14 · 时间推进
   ===================================================================== */
/* v2.0：1x 一天 55 秒（原 80 秒）。决策点变多之后，等的时间就该变短 ——
   总时长从 16 分钟压到 11 分钟，但「需要拍板」的次数翻了一倍多 */
const SPEED = [0, 26, 48, 86];   // 每真实秒推进的游戏分钟

function stepColonist(c, dm){
  if(c.dead) return;

  // 需求
  if(!c.sleeping){
    if(c.onWatch && isNightHour()){
      /* 守夜不是不睡，是在火边打盹：恢复速度只有睡床的四分之一。
         如果按"完全不睡"算，白天已经耗掉一半体力的人会当场归零，连锁到崩溃。 */
      c.needs.rest = Math.min(100, c.needs.rest + 0.075*dm);
    } else {
      c.needs.rest -= 0.055*dm;
    }
  }
  c.needs.hunger -= (c.sleeping ? 0.026 : 0.052)*dm;
  c.needs.hunger = clamp(c.needs.hunger, 0, 100);
  c.needs.rest = clamp(c.needs.rest, 0, 100);
  /* v2.2：饿到掉出「吃得下」的线就记一笔。noteHist 会按天去重，
     所以这一天剩下的时间不会再刷。 */
  if(c.needs.hunger < 20) noteHist(c, '饿得发慌，干什么都没劲', 'warn');

  if(c.sick > 0){
    c.sick -= dm;
    c.needs.rest = Math.max(0, c.needs.rest - 0.045*dm);
    if(c.sick <= 0){ c.sick = 0; logEvent(`<b>${c.name}</b> 的风寒好了。`, 'good'); }
  }

  /* 后撤计时（v1.3）：到点才重新接战 */
  if(c.flee > 0){
    c.flee -= dm;
    if(c.flee <= 0) c.flee = 0;
  }
  /* 伤口：没有医务所时只能极慢地自愈 */
  if((c.wound || 0) > 0 && !state.raiders.some(r=> !r.down && !parkedGuard(r) && dist(r.x,r.y,c.x,c.y) < 12)){
    c.wound = Math.max(0, c.wound - 0.045*dm);
  }

  /* 战术技能冷却（v1.9） */
  if((c.skillCd || 0) > 0) c.skillCd = Math.max(0, c.skillCd - dm);

  /* 闲聊（v2.0）：营地不该只有脚步声 */
  if(c.bubble){
    if((c.bubble.ttl -= dm) <= 0) c.bubble = null;
  } else if(!c.down && !c.sleeping){
    c.chatT = (c.chatT == null ? rnd()*260 : c.chatT - dm);
    if(c.chatT <= 0){ c.chatT = 380 + rnd()*520; saySomething(c); }
  }

  c.moodT = (c.moodT || 0) - dm;
  if(c.moodT <= 0){ computeMood(c); c.moodT = 12; }

  // 倒地恢复
  if(c.down){
    const danger = state.raiders.some(r=> !r.down && !parkedGuard(r) && dist(r.x,r.y,c.x,c.y) < 14);
    c.downT -= dm;
    if(!danger){ c.hp = Math.min(c.maxHp, c.hp + 0.05*dm); }
    if(c.downT <= 0 && c.hp > 22){
      c.down = false; c.hp = Math.max(c.hp, 34);
      logEvent(`<b>${c.name}</b> 重新站了起来。`, 'good');
    }
    return;
  }

  // 崩溃
  if(c.breakT > 0){
    c.breakT -= dm;
    if(c.breakT <= 0){
      c.needs.mood = clamp(c.needs.mood + 18, 0, 100);
      c.state = 'idle'; c.job = null;
      logEvent(`<b>${c.name}</b> 情绪稳定下来了。`, '');
    } else {
      if(!c.job || c.job.type !== 'wander') jobWander(c);
      if(c.state === 'move') moveAlong(c, dm);
      else if(c.state === 'work'){ c.jobT += dm; if(c.jobT >= (c.job.dur||30)){ c.job = null; c.state='idle'; } }
      return;
    }
  } else if(c.needs.mood < 20 && rnd() < 0.002*dm){
    c.breakT = 150 + rnd()*150;
    c.job = null; c.state = 'idle'; c.sleeping = false;
    /* 崩溃不是只发呆：有概率砸掉库存发泄（v1.3） */
    if(rnd() < 0.40 && (state.res.meal > 0 || state.res.food > 0)){
      const kind = state.res.meal > 0 ? 'meal' : 'food';
      const got = removeItemAnywhere(kind, rint(2,4), c.x, c.y);
      if(got > 0){
        logEvent(`<b>${c.name}</b> 情绪失控（${crashReason(c)}），砸掉了 ${got} 份${itemName(kind)}。`, 'warn');
        c.needs.mood = clamp(c.needs.mood + 9, 0, 100);
        addFx({ kind:'ring', x:c.fx, y:c.fy, life:600 });
      }
    } else {
      logEvent(`<b>${c.name}</b> 精神崩溃了 —— ${crashReason(c)}。`, 'warn');
    }
    return;
  }

  // 脱离战斗后缓慢自愈
  if(c.hp < c.maxHp && !state.raiders.some(r=> !r.down && !parkedGuard(r) && dist(r.x,r.y,c.x,c.y) < 12)){
    c.hp = Math.min(c.maxHp, c.hp + 0.10*dm);
  }

  /* 守夜排班要真的把人叫起来（v1.6）：
     只标记 onWatch 不够 —— 他 21:30 已经躺下了，doWork 的睡眠分支不会因为标记就醒。 */
  if(c.sleeping && c.onWatch && isNightHour() && c.needs.rest >= 9){
    c.sleeping = false; c.job = null; c.state = 'idle';
  }

  // 袭击唤醒
  if(c.sleeping && state.raiders.some(r=> !r.down && !parkedGuard(r) && dist(r.x,r.y,c.x,c.y) < 9)){
    c.sleeping = false; c.job = null; c.state = 'idle';
    computeMood(c);
    return;
  }

  /* 个人指令优先于一切自主行为（v1.7）。睡着的人除外 —— 叫醒一个睡着的人
     去干活，等于把 v1.6 那个"守夜者永不回岗"的坑换个地方再挖一遍。

     v1.8.1：快饿死 / 快累垮时暂时不执行（指令不撤销，吃饱了接着干）。
     以前指令无条件压过吃饭，一个「每两小时出兵」的命令就能把人活活饿死在
     路上 —— 实测 seed 11 的四个人 hunger 归零倒在匪巢和营地之间。
     玩家看到的不是「我的命令有代价」，而是「我下了个命令，人没了」。 */
  if(c.order && !c.sleeping){
    const spent = c.needs.hunger < 12 || c.needs.rest < 4;
    if(!spent && runOrder(c, dm)) return;
  }

  // 状态机
  /* 指令可以打断缠斗（v1.3）：集火继续打，集结/撤退立刻脱离 */
  if(state.cmd && c.state === 'fight' && state.cmd.kind !== 'focus'){
    c.job = null; c.state = 'idle'; c.path = null;
  }
  if(c.state === 'fight'){ updateFight(c, dm); return; }
  if(c.state === 'move'){ moveAlong(c, dm); return; }
  if(c.state === 'work'){ doWork(c, dm); return; }

  assignJob(c);
}

/* =====================================================================
   个人指令（v1.7）：玩家对单个居民下的直接命令
   ---------------------------------------------------------------
   以前所有命令都是全体级的（集结 / 撤退 / 集火），玩家只能对整体发号施令，
   然后看小人自己决定站哪、打谁。这里是"操作性"的入口：把某一个人点出去，
   他会放下手上的活照办。
   期限很短（120 游戏分钟）且到点自动交还 AI —— v1.6 的 guard 就是忘了交还，
   那个人永远站在岗位上，不干活不睡觉，体力一路掉到 0。
   ===================================================================== */
const ORDER_TTL = 240;   // 4 游戏小时；1 倍速下约 13 秒真实时间，够下几道令

/* =====================================================================
   战术技能（v1.9）：每个居民一个主动技能，按武器分
   ---------------------------------------------------------------
   1.7 之前玩家在战斗里能做的只有「集火 / 撤退」两个开关，剩下全靠看。
   技能是把手放回键盘上的最小代价：一个键、一个冷却、一个看得见的收益。
   不按也能打完，按了明显更省人 —— 这样"操作"才有回报，而不是变成必需。
   ===================================================================== */
const SKILL = {
  rifle:  { name:'瞄准射击', cd:180, hint:'下一枪伤害 ×2.3' },
  pistol: { name:'速射',     cd:200, hint:'立刻连开三枪' },
  knife:  { name:'猛击',     cd:150, hint:'近身 2.6 倍伤害并击退' }
};
function skillDef(c){ return SKILL[c.weapon] || SKILL.knife; }

function useSkill(c, quiet){
  if(!c || c.dead || c.down) return false;
  /* 睡着的人放不了技能 —— 和下令一样。不然玩家能隔着半张地图让床上的人
     开一枪，冷却还照走，等于白送一次伤害。 */
  if(c.sleeping){
    if(!quiet) toast(`${c.name} 已经睡下了，叫不醒`);
    return false;
  }
  const d = skillDef(c);
  if((c.skillCd || 0) > 0){
    if(!quiet) toast(`${d.name} · 还要等 ${Math.ceil(c.skillCd)} 分钟`);
    return false;
  }
  const foe = (c.job && c.job.foe && !c.job.foe.dead && !c.job.foe.down) ? c.job.foe
    : state.raiders.filter(r=> !r.dead && !r.down && dist(r.x, r.y, c.x, c.y) <= c.range + 2)
        .sort((a,b)=> dist(a.x,a.y,c.x,c.y) - dist(b.x,b.y,c.x,c.y))[0];
  if(!foe){ if(!quiet) toast('附近没有目标'); return false; }

  c.aim = Math.atan2(foe.fy - c.fy, foe.fx - c.fx);
  if(c.weapon === 'rifle'){
    if(dist(c.fx, c.fy, foe.fx, foe.fy) > c.range + 1){
      if(!quiet) toast('够不着，先接近');
      return false;
    }
    c.skillCd = d.cd;
    c.aimBoost = 2.3;
    shoot(c, foe);
    c.aimBoost = 1;
    addFx({ kind:'ring', x:foe.fx, y:foe.fy, life:420 });
  } else if(c.weapon === 'pistol'){
    if(dist(c.fx, c.fy, foe.fx, foe.fy) > c.range + 1){
      if(!quiet) toast('够不着，先接近');
      return false;
    }
    c.skillCd = d.cd;
    for(let i=0;i<3;i++) shoot(c, foe);
  } else {
    if(dist(c.fx, c.fy, foe.fx, foe.fy) > 2.2){
      if(!quiet) toast('太远了，走近再猛击');
      return false;
    }
    c.skillCd = d.cd;
    hurt(foe, c.dmg * 2.6, c);
    /* 击退一格：把贴脸的敌人推开，给自己换弹的时间 */
    const ang = Math.atan2(foe.fy - c.fy, foe.fx - c.fx);
    const nx = clamp(Math.round(foe.x + Math.cos(ang)), 1, W-2);
    const ny = clamp(Math.round(foe.y + Math.sin(ang)), 1, H-2);
    if(passable(nx, ny) && !(tileAt(nx,ny) && tileAt(nx,ny).bld)){
      foe.x = nx; foe.y = ny; foe.fx = nx + 0.5; foe.fy = ny + 0.5; foe.path = null;
    }
    addFx({ kind:'ring', x:foe.fx, y:foe.fy, life:520 });
    kickShake(3.5, 220);
  }
  SFX.alert();
  uiDirty.side = true;
  return true;
}

/* 对当前选中的所有人生效（多选时一起放，像一次齐射） */
function useSkillOnSelection(){
  if(state.over) return 0;
  const list = selColonists();
  if(!list.length){ toast('先选一个人'); return 0; }
  let n = 0;
  for(const c of list) if(useSkill(c, true)) n++;
  if(n) toast(`${list.length > 1 ? n + ' 人同时出手' : skillDef(list[0]).name}`);
  else if(list.length) toast('都没有目标，或者还在冷却');
  return n;
}

function giveOrder(c, o, quiet){
  if(!c || c.dead || c.down) return false;
  if(c.sleeping){
    if(!quiet) toast(`${c.name} 已经睡下了，叫不醒`);
    return false;
  }
  /* 拆巢要走很远，TTL 单独给足 */
  c.order = { kind:o.kind, x:o.x, y:o.y, id:o.id, ttl: o.kind === 'demolish' ? 900 : ORDER_TTL };
  /* 打断当前工作；缠斗留给 runOrder 判断（他可能只是想边打边挪） */
  if(c.state !== 'fight'){ c.job = null; c.path = null; c.state = 'idle'; }
  if(o.kind === 'attack'){
    const foe = state.raiders.find(r=> r.id === o.id && !r.dead && !r.down);
    /* 立刻进入交战状态：玩家点了敌人却要等下一帧才转身，手感上就是"没反应" */
    if(foe){ jobFight(c, foe); c.aim = Math.atan2(foe.fy - c.fy, foe.fx - c.fx); SFX.alert(); }
  } else {
    addFx({ kind:'ring', x:o.x + 0.5, y:o.y + 0.5, life:420 });
  }
  uiDirty.side = true;
  return true;
}

function runOrder(c, dm){
  const o = c.order;
  if(!o) return false;
  const ttlBefore = Math.ceil(o.ttl);
  o.ttl -= dm;
  if(Math.ceil(o.ttl) !== ttlBefore) uiDirty.side = true;
  if(o.ttl <= 0){ c.order = null; uiDirty.side = true; return false; }

  if(o.kind === 'move'){
    if(dist(c.x, c.y, o.x, o.y) <= 1.2){ c.order = null; return false; }
    if(c.state === 'fight'){ c.job = null; c.state = 'idle'; c.path = null; }
    if(c.state !== 'move' || !c.path || !c.path.length){
      const p = findPath(c.x, c.y, o.x, o.y);
      if(!p){ c.order = null; return false; }
      c.job = null; c.path = p; c.state = 'move';
    }
    moveAlong(c, dm);
    return true;
  }

  if(o.kind === 'attack'){
    const foe = state.raiders.find(r=> r.id === o.id && !r.dead && !r.down);
    if(!foe){ c.order = null; return false; }
    if(c.state !== 'fight' || !c.job || c.job.foe !== foe) jobFight(c, foe);
    updateFight(c, dm);
    return true;
  }

  /* 拆匪巢（v1.8）：走上去，然后一锤一锤砸。
     TTL 给到 900 分钟（15 小时）—— 从营地走到 18 格外的巢再拆完，
     按 240 分钟算没走到就过期了，玩家会以为指令坏了。 */
  if(o.kind === 'demolish'){
    const t = tileAt(o.x, o.y);
    if(!t || !t.bld || t.bld.type !== 'den'){ c.order = null; return false; }

    /* 有人守着就先打人。玩家给的是「去拆那个巢」，不是「站在那儿挨枪」——
       队里有人绕到守卫身后去敲房子，看起来就像指令没被执行。 */
    const guard = state.raiders
      .filter(r=> r.home && !r.dead && !r.down && Math.hypot(r.x - o.x, r.y - o.y) < 9)
      .sort((a,b)=> dist(a.x,a.y,c.x,c.y) - dist(b.x,b.y,c.x,c.y))[0];
    if(guard){
      if(c.state !== 'fight' || !c.job || c.job.foe !== guard) jobFight(c, guard);
      updateFight(c, dm);
      return true;
    }

    const d = Math.hypot(c.x - o.x, c.y - o.y);
    if(d > 1.55){
      if(c.state === 'fight'){ c.job = null; c.state = 'idle'; c.path = null; }
      if(c.state !== 'move' || !c.path || !c.path.length){
        const adj = adjacentFree(o.x, o.y)
          .sort((a,b)=> Math.hypot(a.x-c.x,a.y-c.y) - Math.hypot(b.x-c.x,b.y-c.y));
        let p = null;
        for(const a of adj.slice(0, 4)){ p = findPath(c.x, c.y, a.x, a.y); if(p) break; }
        if(!p){ c.order = null; return false; }
        c.job = null; c.path = p; c.state = 'move';
      }
      moveAlong(c, dm);
      return true;
    }
    /* 到了跟前才停表：站在巢边上砸上十几分钟是常态，不该算进赶路的 15 小时。
       以前这行写在分支最上面，于是任何一条拆巢指令都永远不会过期 ——
       人被墙夹住、被袭击反复打断，就带着这条指令在野外站到天荒地老。 */
    o.ttl = Math.max(o.ttl, 60);
    c.aim = Math.atan2(o.y + 0.5 - c.fy, o.x + 0.5 - c.fx);
    c.cdT = (c.cdT || 0) - dm;
    if(c.cdT <= 0){
      c.cdT = 16;
      SFX.hit();
      addFx({ kind:'hit', x:o.x + 0.5, y:o.y + 0.5, life:280 });
      const hit = Math.max(8, Math.round(c.dmg * 1.4));
      floatText(o.x + 0.5, o.y + 0.3, '-' + hit, '#ffb0a0');
      damageBuilding(o.x, o.y, hit);
    }
    c.state = 'idle';
    return true;
  }

  c.order = null;
  return false;
}

/* ---- 研究推进（v1.3）---- */
function tickTech(dt){
  const s = state.tech;
  if(!s.cur) return;
  const d = techDef(s.cur);
  if(!d){ s.cur = null; s.prog = 0; return; }
  s.prog += dt;
  if(s.prog >= d.time){
    s.done[s.cur] = true;
    const nm = d.name;
    s.cur = null; s.prog = 0;
    SFX.done();
    logEvent(`研究完成：<b>${nm}</b> — ${d.desc}`, 'good');
    showAlert(`研究完成 · ${nm}`, false);
    applyTech(d.id);
    uiDirty.side = true;
  }
}

function applyTech(id){
  if(id === 'armor'){
    for(const c of state.cols){ c.maxHp += 20; c.hp += 20; }
  }
  if(id === 'wall2' || id === 'forge'){
    for(const t of tiles){
      if(!t.bld || t.bld.prog < 1) continue;
      const cap = bldMaxHp(t.bld.type);
      if(t.bld.hp < cap) t.bld.hp = Math.min(cap, t.bld.hp + (cap - BL[t.bld.type].hp));
    }
  }
  initBuild();
}

/* ---- 火焰蔓延（v1.3 纵火者留下的火）---- */
function tickBurning(dt){
  for(let i=0;i<tiles.length;i++){
    const t = tiles[i];
    const b = t.bld;
    if(!b || !(b.burn > 0)) continue;
    b.burn -= dt;
    b.hp -= 0.38 * dt;
    if(b.hp <= 0){
      const nm = BL[b.type].name;
      t.bld = null;
      logEvent(`大火烧塌了一座${nm}。`, 'bad');
      continue;
    }
    if(b.burn <= 0){
      b.burn = 0;
      logEvent('一处火头自己熄了。', '');
    }
  }
}

function simMinute(){
  state.min += 1;

  tickNight();                    // 守夜排班 / 夜袭 / 收工（v1.6）
  for(const c of state.cols) stepColonist(c, 1);
  for(const r of state.raiders) updateRaider(r, 1);
  updateTurrets(1);
  tickTech(1);
  tickBurning(1);

  /* 指令到期（v1.3）：避免玩家忘了解除导致整队停摆 */
  if(state.cmd && state.cmd.until && state.min > state.cmd.until){
    logEvent(`<b>${cmdName(state.cmd)}</b> 指令已到期，居民回到日常。`, '');
    state.cmd = null;
    uiDirty.side = true;
  }

  /* 回归专用（v1.8）：筑城局替玩家摆墙。
     不摆的话，测出来的永远是「AI 没去建墙」，而不是「建不建得起来」。 */
  if(window.__autoWall && state.amb === 'fortify' && state.min % 150 === 0){
    const cx0 = W>>1, cy0 = H>>1;
    /* 只放到够用为止：玩家不会无脑铺两百段墙，测试也不该 ——
       否则量出来的是「蓝图堆积速度」，不是「施工速度」。
       在建的也算数，不然会一直补到永远。 */
    const wallN  = tiles.filter(t=> t.bld && t.bld.type === 'wall').length;
    const turretN= tiles.filter(t=> t.bld && t.bld.type === 'turret').length;
    /* 工坊（v2.0）：筑城第二阶段要一座工坊，而基线原本只铺床 / 炮 / 墙。
       不补这一样，第 9 天的「合围」必然判负 —— 测出来的是脚手架缺口，
       不是游戏难度。只在这个分支里补，不去动 build=2 的公共基线：
       多放一个建筑就会消耗随机数，别的种子的世界线会被整条改掉。 */
    const shopN  = tiles.filter(t=> t.bld && t.bld.type === 'shop').length;
    const type = (wallN >= 8 && shopN < 1) ? 'shop'
               : (turretN < 2 && wallN >= 8) ? 'turret'
               : (wallN < 10 ? 'wall' : null);
    if(type){
      let placed = false;
      /* 半径放到 13：r=10 以内常被果树和前一批墙占满，
         找不到位置会让人误判成「玩家建不起来」。 */
      for(let r=3; r<13 && !placed; r++){
        for(let dy=-r; dy<=r && !placed; dy++) for(let dx=-r; dx<=r && !placed; dx++){
          if(Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx0+dx, y = cy0+dy;
          if(canPlace(type, x, y) && placeBuilding(type, x, y)) placed = true;
        }
      }
    }
  }

  /* 回归专用（v1.8）：远征局替玩家派兵拆巢。
     居民 AI 不会主动出营，这是设计；但「22 天拆不拆得完 3 个巢」
     必须能被测出来，否则只能靠手感拍脑袋。 */
  if(window.__autoRaid && state.amb === 'raid' && state.min % 120 === 0){
    /* 有正经袭击在打就别出门 —— 派两个人出去被巢卫和掠袭者夹住，
       那不是「验证可达性」，那是验证怎么送死。 */
    const busy = state.raiders.filter(r=> !r.dead && !r.down && !r.home).length > 1;
    const alive = state.cols.filter(c=> !c.dead && !c.down);
    /* 家里必须留人：三人全派出门 = 营地在袭击日裸奔。
       少一具守家的身体，多一个空巢，这笔账玩家自己算，AI 至少别算错。 */
    const squad = (busy || alive.length < 4) ? []
      : alive.filter(c=> !c.order && !c.sleeping).slice(0, 2);
    const dens = [];
    tiles.forEach((t, i)=>{ if(t.bld && t.bld.type === 'den') dens.push({ x:i%W, y:(i/W)|0 }); });
    for(const c of squad){
      if(!dens.length) break;
      const d = dens.slice().sort((a,b)=>
        Math.hypot(a.x-c.x, a.y-c.y) - Math.hypot(b.x-c.x, b.y-c.y))[0];
      giveOrder(c, { kind:'demolish', x:d.x, y:d.y }, true);
    }
  }

  // 植物生长（每 20 分钟批量一次）
  if(state.min % 20 === 0) growPlants(20);

  // 偷粮贼（v2.1）：10 分钟看一次，内部还有 6 小时的闸
  if(state.min % 10 === 0) updateThieves(10);

  // 清理特效
  const now = performance.now();
  if(state.fx.length){
    state.fx = state.fx.filter(f=> now - f.t < f.life);
  }

  // 新的一天
  const d = Math.floor(state.min/1440) + 1;
  if(d !== state.day){
    state.day = d;
    onNewDay(d);
  }
  if(state.min % 5 === 0){
    checkEnd();
    /* 脱战就把慢放收回（v1.9）：不收回的话，玩家会一直卡在半速里打转 */
    if(state.slow < 1 && !state.raiders.some(r=> !r.dead && !r.down)) state.slow = 1;
  }
}

function growPlants(dt){
  const winter = !!scenDef().winter;
  const rate = (state.rain > 0.4 ? 1.5 : 1) * (hasTech('farm2') ? 1.35 : 1);
  for(const t of tiles){
    const p = t.plant;
    if(!p) continue;
    if(p.kind === 'crop' && p.grow < 1){
      /* v2.1：品种决定生长速度；冬天只有根菜还长（0.42 倍），其余停摆。
         以前是「冬天一律不长」—— 那样冬天没有任何农业可做，只能干等。 */
      const cd = cropDef(p.crop);
      const wf = winter ? (cd.cold ? 0.42 : 0) : 1;
      if(wf > 0) p.grow = Math.min(1, p.grow + dt/1700*rate*cd.rate*wf);
    }
    else if(p.kind === 'bush' && p.berries === 0 && p.regrow > 0){
      p.regrow -= dt * (winter ? 0.35 : 1);
      if(p.regrow <= 0){ p.berries = rint(2,4); p.regrow = 0; }
    } else if(p.kind === 'herb' && !p.ready && p.regrow > 0){
      p.regrow -= dt * (winter ? 0.4 : 1);
      if(p.regrow <= 0){ p.ready = true; p.regrow = 0; p.grow = 1; }
    }
  }
}

function checkEnd(){
  if(state.over || state.endAck) return;
  const alive = state.cols.filter(c=> !c.down);
  if(!state.cols.length || (state.cols.length && state.cols.every(c=> c.down))){
    /* 惨胜（v1.8 / v2.1 推广）：
       v1.8 时只对「远征」生效（三个巢端了才算），因为目标是拿命换的。
       v2.1 把这条打开到所有野心 —— 墙立起来了、人救回来了、巢平了，
       只是人正好倒在最后一天，按「覆灭」结算是错的。
       限定在目标日前后一天，否则「第 3 天达成后故意送死」也能算赢。 */
    if(ambAchieved() && state.day >= state.goalDay - 1){
      state.over = 'pyrrhic';
      showEnd(true);
      return;
    }
    state.over = 'lose';
    showEnd(false);
    return;
  }
  if(state.day > state.goalDay){
    if(state.endless){
      /* 无尽模式：每达成一轮再往后推 10 天，袭击强度随天数继续爬升 */
      state.goalDay = state.day + 10;
      logEvent(`第 <b>${state.goalDay}</b> 天成为新的目标。袭击会更硬。`, 'good');
      showAlert(`新目标 · 撑到第 ${state.goalDay} 天`, false);
      return;
    }
    /* v1.8：先结算阶段，再判野心 —— 野心进度依赖最后一阶段的计数，
       顺序反了会把「刚刚好达标」判成没达标。 */
    settleStages(true);
    const ok = ambAchieved();
    state.over = ok ? 'win' : 'ambfail';
    showEnd(ok);
  }
}

/* =====================================================================
   15 · 每日事件
   ===================================================================== */
function isRaidDay(d){
  if(d < 2) return false;
  if(d === 2 || d === 4 || d === 6 || d === 8 || d === 10 || d === 12) return true;
  return d % 5 === 0;
}
function nextRaidDay(from){
  for(let d = from; d <= from + 40; d++) if(isRaidDay(d)) return d;
  return null;
}

/* ---- 人际关系（v1.3）：每天随机互动，累积成朋友或积怨 ---- */
function getBond(a, id){
  const b = (a.bonds || []).find(x=> x.id === id);
  return b ? b.v : 0;
}
function addBond(a, b, dv){
  for(const [x, y] of [[a, b.id], [b, a.id]]){
    if(!x.bonds) x.bonds = [];
    let r = x.bonds.find(z=> z.id === y);
    if(!r){ r = { id:y, v:0 }; x.bonds.push(r); }
    r.v = clamp(r.v + dv, -100, 100);
  }
}
function tickBonds(){
  const alive = state.cols.filter(c=> !c.down);
  if(alive.length < 2) return;
  for(let k=0;k<2;k++){
    const a = pick(alive), b = pick(alive);
    if(!a || !b || a === b) continue;
    const before = getBond(a, b.id);
    addBond(a, b, rint(-8, 13));
    const after = getBond(a, b.id);
    if(before < 55 && after >= 55) logEvent(`<b>${a.name}</b> 和 <b>${b.name}</b> 成了朋友。`, 'good');
    else if(before > -55 && after <= -55) logEvent(`<b>${a.name}</b> 和 <b>${b.name}</b> 结了怨。`, 'warn');
  }
}

function cmdName(cmd){
  if(!cmd) return '无';
  return { focus:'集火', rally:'集结', retreat:'撤退' }[cmd.kind] || '指令';
}

/* =====================================================================
   11.9 · 运行档案（v2.2）
   ---------------------------------------------------------------------
   三件事共用一份数据：
     1) state.snaps   每日快照 —— 复盘要能定位「哪一天开始崩的」
     2) state.dayLog  每日事件 —— 让复盘说人话，而不是只甩数字
     3) c.hist / kia  个人史与死因 —— 让玩家能追问「他是怎么死的」

   全部只读、不抽签。v2.0 的教训：任何一次额外的 rnd() 都会重排整条
   世界线，十局长局回归会当场作废。这一节里一行 rnd 都不许有。
   ===================================================================== */
function archInit(){
  state.snaps = [];
  state.dayLog = {};
  state.kia = [];
  for(const c of state.cols) if(!c.hist) c.hist = [];
}

/* 个人史：只记「这个人身上发生了什么」。
   去重有两个键：一模一样的一句（挨饿会一天触发几十次），以及调用方指定的
   分组键（挨打只留当天第一条 —— 同一晚被三个人打，不需要三条一模一样的记录）。 */
function noteHist(c, s, k, key){
  if(!c || !c.hist) return;
  if(c.hist.some(h=> h.d === state.day && (h.s === s || (key && h.key === key)))) return;
  c.hist.push({ d: state.day, s, k: k || '', key: key || null });
  if(c.hist.length > 14) c.hist.shift();
}

/* 每日事件：复盘挑出「最亏的三天」之后，靠这里给出当天的原话 */
function noteDay(s, k){
  if(!state.dayLog) state.dayLog = {};
  const d = state.day;
  (state.dayLog[d] = state.dayLog[d] || []).push({ s, k: k || '' });
}
function dayEvents(d){ return (state.dayLog && state.dayLog[d]) || []; }

function snapshotDay(){
  const alive = (state.cols || []).filter(c=> !c.down && !c.dead);
  const mean = k=> alive.length ? alive.reduce((a, c)=> a + (c.needs[k] || 0), 0) / alive.length : 0;
  let site = 0;
  for(const t of tiles) if(t.bld && t.bld.prog < 1) site++;
  return {
    wood: Math.round(state.res.wood || 0), stone: Math.round(state.res.stone || 0),
    food: Math.round(state.res.food || 0), meal: Math.round(state.res.meal || 0),
    herb: Math.round(state.res.herb || 0),
    kills: state.stats.kills || 0, built: state.stats.built || 0,
    pop: state.cols.length, mood: Math.round(avgMood()),
    /* v2.2：以下只给复盘用。日报只读上面几个键，多出来的不影响它。 */
    down: (state.cols || []).filter(c=> c.down).length,
    hunger: Math.round(mean('hunger')), rest: Math.round(mean('rest')),
    wall: countBuilt('wall'), turret: countBuilt('turret'), bed: countBuilt('bed'),
    site, tech: Object.keys(state.tech.done || {}).length,
    stage: state.stage.idx, dens: (state.dens || []).length
  };
}

/* 「势」—— 一天的体感分。复盘不比单项：少一个人、塌一段墙、粮食见底，
   在玩家那边是同一件事的不同说法，所以先合成一个数再比。 */
function dayPower(s){
  if(!s) return 0;
  return s.pop * 7 + (s.mood || 0) * 0.30
       + Math.min(60, ((s.food || 0) + (s.meal || 0) * 3) / 4)
       + (s.built || 0) * 1.2 + (s.wall || 0) * 0.8 + (s.turret || 0) * 1.5
       - (s.down || 0) * 6 - ((s.hunger || 100) < 45 ? 8 : 0);
}

/* 一天为什么掉分：先看当天真发生过什么，没事件再从快照差值里推 */
function turnWhy(prev, cur, d){
  const out = [];
  for(const e of dayEvents(d)) out.push({ s: e.s, k: e.k });
  if(out.length >= 3) return out.slice(0, 3);
  if(prev){
    if(cur.pop < prev.pop) out.push({ s: `比前一天少了 ${prev.pop - cur.pop} 个人`, k:'bad' });
    if((cur.hunger || 100) < 45 && (prev.hunger || 100) >= 45) out.push({ s:'口粮见底，全员掉到轻活', k:'warn' });
    if((cur.wall || 0) < (prev.wall || 0)) out.push({ s:`墙从 ${prev.wall} 段掉到 ${cur.wall} 段`, k:'warn' });
    if((cur.down || 0) > (prev.down || 0)) out.push({ s:`${cur.down} 人躺在地上没人管`, k:'bad' });
    if((cur.mood || 0) < (prev.mood || 0) - 8) out.push({ s:`士气 ${prev.mood} → ${cur.mood}`, k:'warn' });
  }
  return out.slice(0, 3);
}

/* 复盘：扫出「势」掉得最狠的三天。没有明显崩盘就退化成「最差的那天」，
   再没有就返回空 —— 全胜的一局不该硬凑三条教训。 */
function postMortem(){
  const ss = state.snaps || [];
  if(ss.length < 2) return [];
  const rows = [];
  for(let i=1;i<ss.length;i++){
    rows.push({ d: ss[i].d, dv: dayPower(ss[i]) - dayPower(ss[i-1]), cur: ss[i], prev: ss[i-1] });
  }
  let pick = rows.filter(r=> r.dv < -4).sort((a, b)=> a.dv - b.dv).slice(0, 3);
  if(!pick.length) pick = rows.slice().sort((a, b)=> a.dv - b.dv).slice(0, 1);
  return pick.sort((a, b)=> a.d - b.d).map(r=> ({
    d: r.d, dv: Math.round(r.dv), why: turnWhy(r.prev, r.cur, r.d)
  }));
}

/* 今日瓶颈（v2.2）：侧栏那一行。玩家最常问的是「为什么墙不涨」，
   答案通常只有四个：人倒了、没吃饱、劲用完了、没人去盖。 */
function bottleneckNow(){
  const cs = state.cols || [];
  if(!cs.length) return [{ t:'没有居民了', k:'bad' }];
  const n = cs.length;
  let down = 0, hungry = 0, tired = 0, wound = 0, idle = 0, building = 0;
  for(const c of cs){
    if(c.down){ down++; continue; }
    if(c.needs.hunger < 30) hungry++;
    if(!canDoHeavy(c)) tired++;
    if((c.wound || 0) >= 15) wound++;
    if(c.job && c.job.type === 'build') building++;
    if(c.job && c.job.type === 'wander') idle++;
  }
  let site = 0;
  for(const t of tiles) if(t.bld && t.bld.prog < 1) site++;

  const out = [];
  if(down) out.push({ t:`${down} 人躺着，今天少 ${down} 双手`, k:'bad' });
  if(hungry) out.push({ t:`${hungry} 人没吃饱，心情在往下掉`, k:'warn' });
  if(site && !building) out.push({ t:`${site} 处工地停着，没人去盖`, k:'warn' });
  else if(tired >= Math.ceil(n * 0.4)) out.push({ t:`${tired} 人劲用完了，只剩轻活`, k:'warn' });
  if(!out.length && wound >= Math.ceil(n * 0.5)) out.push({ t:`${wound} 人带伤，干什么都慢`, k:'' });
  if(!out.length && idle >= Math.ceil(n * 0.5)) out.push({ t:`${idle} 人闲着：资源够用，也没摆新蓝图`, k:'' });
  if(!out.length) out.push({ t:'人人有活干，料也够', k:'ok' });
  return out.slice(0, 3);
}
function avgMood(){
  if(!state.cols.length) return 0;
  return state.cols.reduce((a, c)=> a + c.needs.mood, 0) / state.cols.length;
}

/* 每日结算卡：给时间一个刻度，让玩家知道昨天到底发生了什么 */
function showDayReport(prev, day){
  if(!prev) return;
  const now = snapshotDay();
  const d = k=> now[k] - prev[k];
  const sgn = v=> (v > 0 ? '+' : '') + v;
  const cls = v=> v > 0 ? 'up' : v < 0 ? 'down' : '';
  const el = $('daycard');
  if(!el) return;
  el.innerHTML = `
    <div class="dc-top"><b>第 ${day} 天</b><span>${state.weather} · 上次结算</span></div>
    <div class="dc-grid">
      <div class="dc-i"><i>木</i><b class="${cls(d('wood'))}">${sgn(d('wood'))}</b></div>
      <div class="dc-i"><i>石</i><b class="${cls(d('stone'))}">${sgn(d('stone'))}</b></div>
      <div class="dc-i"><i>食</i><b class="${cls(d('food') + d('meal'))}">${sgn(d('food') + d('meal'))}</b></div>
      <div class="dc-i"><i>药</i><b class="${cls(d('herb'))}">${sgn(d('herb'))}</b></div>
    </div>
    <div class="dc-bot">
      <span>击杀 <b>${d('kills')}</b></span>
      <span>新建 <b>${d('built')}</b></span>
      <span>人口 <b>${now.pop}</b></span>
      <span>均心情 <b>${now.mood}</b></span>
    </div>`;
  el.classList.add('on');
  clearTimeout(showDayReport._t);
  if(!window.__holdCard) showDayReport._t = setTimeout(()=> el.classList.remove('on'), 3200);
}

/* ---- 守夜排班与时序（v1.6）：21:30 排班 · 23:30 掷骰 · 05:30 收工 ---- */
/* 解除站岗：只清 onWatch 是不够的 ——
   job.type 还是 'guard' 的话，doWork 会一直走守卫分支，这个人将永远不再被重新分配工作，
   白天不干活、不睡觉，体力一路掉到 0。这是 v1.6 第一次实测里整局崩盘的真凶。 */
function dropGuardJob(c){
  if(c.job && c.job.type === 'guard'){ c.job = null; c.state = 'idle'; }
}

function assignGuards(){
  const alive = state.cols.filter(c=> !c.down && !c.dead);
  alive.forEach(c=>{ c.onWatch = false; dropGuardJob(c); });
  const cap = Math.min(state.watch, alive.length);
  if(cap > 0){
    /* 挑人：血量、体力、战斗技能三项加权 —— 让"今晚谁去守"有依据 */
    const ranked = alive.slice().sort((a,b)=>{
      const sa = (a.hp/a.maxHp)*40 + a.needs.rest*0.6 + (a.skill.fight||0)*2;
      const sb = (b.hp/b.maxHp)*40 + b.needs.rest*0.6 + (b.skill.fight||0)*2;
      return sb - sa;
    });
    for(let i=0;i<cap;i++) ranked[i].onWatch = true;
  }
  state.guardSpot = computeGuardSpot();
}

function applyWatch(){
  state.watchSet = true;
  const alive = state.cols.filter(c=> !c.down && !c.dead);
  alive.forEach(c=>{ c.fatigue = 0; });
  assignGuards();
  if(state.watch <= 0 && alive.length){
    logEvent('今晚没人守夜，所有人都睡下了。', 'warn');
  }

  /* 掷骰：今晚到底来不来。白天刚打过仗的当夜不掷（nightRisk 内在判断） */
  let hit = false;
  if(state.day >= 3 && state.skipRaid <= 0){
    hit = rnd() < nightRisk();
  }
  state.nightRaid = hit ? { n: nightSize(), tier: clamp(Math.floor(state.day/3), 0, 5), fired:false } : null;
  if(hit) logEvent('守夜的人听见坡下有响动 —— 今晚不太平。', 'warn');
  uiDirty.side = true;
}

function fireNightRaid(){
  const nr = state.nightRaid;
  if(!nr || nr.fired) return;
  nr.fired = true;
  state.nightTimes++;
  const guards = state.cols.filter(c=> c.onWatch).length;
  if(guards) state.nightRepel++;
  logEvent(`<b>夜袭！</b> ${nr.n} 名掠袭者摸黑上来了${guards ? `，${guards} 人在岗` : '，没有一个人醒着'}。`, 'bad');
  showAlert(`夜袭 · ${nr.n} 名掠袭者`, true);
  SFX.alert();
  spawnRaid(nr.n, nr.tier, { night:true });
}

/* 平安夜：守到 23:30 没动静就换班。
   这一条是整个机制的支点 —— 守夜的贵，应该贵在"真的打起来"，而不是"白站一夜"。 */
function releaseQuiet(){
  let n = 0;
  for(const c of state.cols){
    if(!c.onWatch) continue;
    c.onWatch = false;
    dropGuardJob(c);
    c.needs.rest = Math.max(0, c.needs.rest - 10);   // 少睡两小时
    c.needs.mood = clamp(c.needs.mood - 2, 0, 100);  // 被点到名字的人不会高兴
    n++;
  }
  if(n) logEvent(`${n} 人守到半夜，坡上没动静，回去睡了。`, '');
  state.watchSet = false;
  state.nightRaid = null;
  uiDirty.side = true;
}

function endWatch(){
  let n = 0;
  for(const c of state.cols){
    if(!c.onWatch) continue;
    c.onWatch = false;
    dropGuardJob(c);
    n++;
    c.fatigue = 1;
    c.needs.mood = clamp(c.needs.mood - 7, 0, 100);
    c.needs.rest = Math.max(0, c.needs.rest - 12);
  }
  if(n){
    const fought = state.nightRaid && state.nightRaid.fired;
    logEvent(`${n} 人守了一夜${fought ? '，把摸上来的人挡了回去' : '，什么也没等到'}。今天他们手脚会慢一些。`, fought ? 'good' : '');
  }
  state.watchSet = false;
  state.nightRaid = null;
  uiDirty.side = true;
}

function tickNight(){
  const m = state.min % 1440;
  if(m === 1290 && !state.watchSet) applyWatch();
  if(m === 1410 && state.watchSet){
    if(state.nightRaid && !state.nightRaid.fired) fireNightRaid();
    else releaseQuiet();          // 没人来就换班，不白熬
  }
  if(m === 330 && state.watchSet) endWatch();
}

/* =====================================================================
   15.5 · 危机调度（v2.0）
   ---------------------------------------------------------------
   每局两场，落在中局和收官前。截止日当天才判定，所以「还有几天」本身
   就是压力：你可以今天就把石料凑齐，也可以赌明天运气好。
   ===================================================================== */
function planCrises(){
  const g = state.goalDay;
  const pool = CRISES.slice();
  for(let i=pool.length-1;i>0;i--){ const j = rint(0,i), t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  const list = pool.slice(0, 2).map(c=> ({
    id: c.id,
    dueDay: Math.max(4, Math.round(g * c.due)),
    seen: false,
    state: 'wait'
  }));
  list.sort((a,b)=> a.dueDay - b.dueDay);
  /* 两场至少隔两天：连着的两天各来一场，玩家只会觉得被追着打，
     而不是「刚处理完一件事，又有新的一件」 */
  if(list.length > 1 && list[1].dueDay < list[0].dueDay + 2)
    list[1].dueDay = Math.min(state.goalDay - 1, list[0].dueDay + 2);
  return list;
}

function tickCrisisWarning(day){
  if(!state.crises) return;
  for(const cr of state.crises){
    if(cr.state !== 'wait' || cr.seen) continue;
    if(day < cr.dueDay - 3) continue;
    cr.seen = true;
    const def = crisisDef(cr.id);
    const left = Math.max(0, cr.dueDay - day);
    logEvent(`<b>${def.name}</b> —— ${def.line} 还差 <b>${left}</b> 天。`, 'warn');
  }
}

function settleCrisis(cr){
  const def = crisisDef(cr.id);
  if(crisisDone(cr)){
    if(def.need.mode !== 'bld') takeStock(def.need.k, def.need.n);
    cr.state = 'ok';
    /* 熬过去要有人心的回报，否则「备齐」只是「少亏」，
       玩家算下来会倾向于直接放弃 */
    moodAll(6);
    logEvent(`<b>${def.name}</b>：${def.ok}`, 'good');
    noteDay(`${def.name}：备齐了`, 'good');
  } else {
    const msg = def.fail();
    cr.state = 'failed';
    logEvent(`<b>${def.name}</b>：${def.bad}${msg ? `（${msg}）` : ''}`, 'bad');
    noteDay(`${def.name}：没备齐，${def.bad}`, 'bad');
    uiDirty.res = true;
  }
  uiDirty.side = true;
}

/* 主动认栽（v2.0）：不结算物理后果，只赔人心。
   这是「我选择放弃」和「我忘了」的区别 —— 前者是决策，后者是失误。 */
function declineCrisis(cr){
  if(!cr || cr.state !== 'wait') return false;
  const def = crisisDef(cr.id);
  cr.state = 'declined';
  for(const c of state.cols) c.needs.mood = Math.max(0, c.needs.mood - 7);
  logEvent(`你们决定不管<b>${def.name}</b>了。事情过去了，但每个人都记着。`, 'warn');
  noteDay(`放弃应对${def.name}，全员心情 −7`, 'warn');
  uiDirty.side = true;
  return true;
}

function onNewDay(day){
  logEvent(`第 <b>${day}</b> 天开始了。`, '');
  /* v2.0：一天一结算。昨天累趴不影响今天排班 —— 干劲是「当日预算」，
     不是会累积的疲劳。累积的那笔账由 needs.rest 记。 */
  for(const c of state.cols) c.vigor = VIGOR_MAX;
  /* 旧伤（v2.0）：伤口拖到 72 以上就留根子。
     有医务所又有药草的人前一晚就会被治 —— 所以这不是随机砸脸，
     是「你没建医务所 / 没备药草」的账单。 */
  for(const c of state.cols){
    if(c.dead || c.down) continue;
    if((c.wound || 0) < 72) continue;
    if((c.debuffs || []).length >= 2) continue;
    const dp = Object.keys(DEBUFFS).filter(k=> !hasDebuff(c, k));
    if(!dp.length) continue;
    const k = pick(dp);
    c.debuffs = (c.debuffs || []).concat(k);
    c.wound = 46;
    logEvent(`<b>${c.name}</b> 的伤留下了根子 —— ${DEBUFFS[k].n}。${DEBUFFS[k].d}，好不了了。`, 'warn');
    noteHist(c, `伤口拖成了${DEBUFFS[k].n}`, 'bad');
    noteDay(`<b>${c.name}</b> 的伤拖成了${DEBUFFS[k].n}`, 'warn');
  }
  /* 先结算昨天，再进入今天 */
  showDayReport(state.daySnap, day - 1);
  state.daySnap = snapshotDay();
  /* v2.2：刚过完的那一天进档案。存档不过 60 天，无尽模式也不会撑爆内存。 */
  state.snaps = state.snaps || [];
  state.snaps.push({ d: day - 1, ...state.daySnap });
  if(state.snaps.length > 60) state.snaps.shift();
  /* 关系结算（v1.3）：每天两次随机互动，久了会成朋友或结怨 */
  tickBonds();
  /* 阶段结算（v1.5）：过了节点日就判定，拖欠的补给不会补 */
  settleStages(false);
  /* 延迟后果（v1.5）：几天前的选择在今天回响 */
  tickPending();
  /* 天气 —— 冬季剧本偏阴冷，作物停长 */
  const winter = !!scenDef().winter;
  const r = rnd();
  state.weather = winter
    ? (r < 0.30 ? '雨' : r < 0.62 ? '阴' : r < 0.74 ? '雾' : '晴')
    : (r < 0.20 ? '雨' : r < 0.38 ? '阴' : r < 0.50 ? '雾' : '晴');
  state.rain = state.weather === '雨' ? 1 : 0;
  if(state.weather === '雨') logEvent(winter ? '雨夹着雪，冷得让人伸不出手。' : '下雨了，作物生长加快 50%，视野变差。', '');
  else if(state.weather === '雾') logEvent('起雾了，能见度下降。', '');

  /* 袭击 */
  const df = diffDef();
  const raidDay = isRaidDay(day);
  const noCap = state.endless;
  if(raidDay && state.skipRaid > 0){
    state.skipRaid--;
    logEvent('你交出去的粮食起了作用 —— 今天没有人来。', '');
  } else if(raidDay && (noCap || day <= state.goalDay + 2)){
    const raw = 1 + Math.floor(day/3) + Math.floor(state.cols.length/3);
    /* v1.8：野心改的是「压力」，不只是「计分」。
       筑城局墙修得越多来的人越多，富商局货越多匪越多 —— 否则五张野心
       只是五块不同的记分牌，玩法还是同一套。
       远征局反过来：每拆掉一个巢，后面的袭击就弱一档。
       这条正反馈是「远征」能成立的唯一原因 —— 没有它，人口越多袭击越多，
       玩家永远腾不出手出兵，三巢到死也拆不完。 */
    const down = state.amb === 'raid' ? clamp(1 - (state.stats.dens || 0) * 0.16, 0.5, 1) : 1;
    const n = clamp(Math.round(raw * df.raidMul * scenRaidMul() * ambMul('raidMul') * down), 1, 14);
    spawnRaid(n, clamp(Math.floor(day/3) + df.tierAdd, 0, 7));
  } else if(isRaidDay(day+1) && (noCap || day+1 <= state.goalDay + 2)){
    logEvent('斥候回报：<b>明天可能有袭击</b>，趁今天把墙补好。', 'warn');
  }

  /* 危机（v2.0）：先预告，到期结算。放在袭击之后，免得同一天叠两拨人 */
  tickCrisisWarning(day);
  if(state.crises) for(const cr of state.crises){
    if(cr.state === 'wait' && day >= cr.dueDay) settleCrisis(cr);
  }

  /* 第二幕（v2.0）：分岔当天只谈这一件事，普通抉择往后让 */
  const act2 = maybeAct2(day);

  /* 抉择事件（v1.5）：每 2 天一次、七成概率，靠数量堆出中局的岔路 */
  if(!act2 && day >= 2 && day % 2 === 0 && state.cols.length > 0 && !state.over && !window.__fastTest && rnd() < 0.72){
    showChoice();
  }

  /* 商队：按剧本间隔来访（商道每 2 天，其余 4~5 天）。
     v1.8：富商野心把间隔砍一半 —— 十二笔生意靠原来的频率做不完。 */
  /* 第二幕「不卖」的代价：商队从那以后隔四天才来一次 */
  let gap = Math.max(1, Math.round((scenDef().tradeGap || 4) / ambMul('tradeMul')));
  if(state.act2 === 'refuse') gap *= 2;
  if(day >= 2 && day % gap === 0 && rnd() < (gap <= 2 ? 0.92 : 0.55)){
    showCaravan();
  }

  /* 狼群：比袭击更快更脆，专挑没成墙的空档 */
  if(day >= 4 && state.weather !== '雨' && rnd() < 0.12){
    spawnRaid(rint(2,3), clamp(Math.floor(day/6), 0, 3), { weak:true });
  }

  /* 风寒：让居民更容易累，间接压低产量 */
  if(day >= 3 && rnd() < 0.13){
    const healthy = state.cols.filter(c=> !c.down && !(c.sick > 0));
    if(healthy.length){
      const c0 = pick(healthy);
      c0.sick = 540 + rint(0, 240);
      logEvent(`<b>${c0.name}</b> 染上了风寒，接下来半天会格外疲惫。`, 'warn');
    }
  }

  /* 火流星：正面事件，白捡石料 */
  if(day >= 4 && rnd() < 0.10){
    const spots = [];
    for(let i=0;i<180;i++){
      const sx = rint(4, W-5), sy = rint(4, H-5);
      const st = tileAt(sx, sy);
      if(st && passable(sx,sy) && !st.bld) spots.push({x:sx, y:sy});
    }
    if(spots.length){
      const sp = pick(spots), amt = rint(22, 40);
      addItems(sp.x, sp.y, 'stone', amt);
      addFx({ kind:'ring', x:sp.x+0.5, y:sp.y+0.5, life:900 });
      logEvent(`一颗火流星落在营地外，砸出了 <b>${amt}</b> 石料。`, 'good');
    }
  }

  // 流浪者加入
  /* v1.8：野心决定「人流」。守成局几乎没人来（来了也养不起），
     救人局每两天就有一拨 —— 人口上限也跟着野心走。 */
  const popCap = ambMod().popCap || 7;
  if(state.act2 !== 'sell' && day >= 3 && state.cols.length < popCap && rnd() < clamp(0.22 * ambMul('wanderMul'), 0, 0.95)){
    const c = spawnColonist();
    logEvent(`<b>${c.name}</b> 加入了殖民地。`, 'good');
  }

  // 农田病害
  const farms = tiles.filter(t=> t.plant && t.plant.kind === 'crop' && t.plant.grow > 0.4);
  if(state.weather === '雨' && farms.length > 6 && rnd() < 0.18){
    let n = 0;
    for(const t of farms) if(rnd() < 0.5){ t.plant = null; n++; }
    logEvent(`暴雨冲毁了 <b>${n}</b> 株作物。`, 'warn');
  }
  if(rnd() < 0.10 && state.res.food + state.res.meal > 0){
    logEvent('夜里有个饿坏了的旅人偷走了些食物。', 'warn');
    removeItemAnywhere('food', 5, W/2, H/2);
  }

  /* 每日自动存档到当前槽 */
  if(!window.__fastTest){
    try{ saveGame(); }catch(e){}
    state.daySnap = state.daySnap || snapshotDay();
  }
}

/* ---- 商队：用库存换另一种资源，带选择的一次性交易 ---- */
function pickN(arr, n){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j = Math.floor(RNG()*(i+1)); const tmp=a[i]; a[i]=a[j]; a[j]=tmp; }
  return a.slice(0, n);
}

const TRADE_POOL = [
  { g:{wood:45},  t:{stone:38}, gs:'45 木材', ts:'38 石料' },
  { g:{stone:35}, t:{food:22},  gs:'35 石料', ts:'22 食物' },
  { g:{food:18},  t:{wood:55},  gs:'18 食物', ts:'55 木材' },
  { g:{meal:10},  t:{stone:42}, gs:'10 餐食', ts:'42 石料' },
  { g:{wood:60},  t:{meal:12},  gs:'60 木材', ts:'12 餐食' }
];

function showCaravan(){
  const deals = pickN(TRADE_POOL, 2).map(d=> ({ ...d, done:false }));
  /* 回归用（v1.8）：AI 不会自己去点交易，但「富商」野心必须能验。
     自动成交一笔付得起的，然后关窗。 */
  if(window.__autoTrade){
    window.__deals = deals;
    const i = deals.findIndex(d=> canAfford(d.g));
    if(i >= 0) window.caravanDeal(i);
    return;
  }
  /* 商道剧本：路过的驮队会顺手卸下一点口粮 —— 这里不产粮，全靠换 */
  if(state.scen === 'road'){
    grantRes({ food: 12 });
    logEvent('驮队卸下 12 份口粮当作过路礼。', 'good');
  }
  window.__deals = deals;
  openModal(`
    <h1>商队到访 <small>TRADER</small></h1>
    <p>一支驮队停在营地外，他们只换货、不收钱，每样货只能换一次。</p>
    <h2>可选交易</h2>
    <div class="g2" id="dealBox"></div>
    <div class="foot">
      <button class="btn" onclick="closeModal();logEvent('商队离开了营地。','')">婉拒并送客</button>
    </div>
  `);
  refreshCaravan();
}

function refreshCaravan(){
  const box = $('dealBox');
  if(!box) return;
  const deals = window.__deals || [];
  box.innerHTML = deals.map((d,i)=>`
    <div class="tile" style="cursor:pointer;opacity:${d.done ? 0.5 : 1}" onclick="caravanDeal(${i})">
      <div class="ic">${d.done ? '✓' : '⇄'}</div>
      <div class="tx"><b>${d.gs} → ${d.ts}</b>
        <span>${d.done ? '已成交' : canAfford(d.g) ? '库存可支付，点击成交' : '库存储备不足'}</span></div>
    </div>`).join('');
}

window.caravanDeal = (i)=>{
  const d = (window.__deals || [])[i];
  if(!d || d.done){ return; }
  if(!canAfford(d.g)){ toast('库存不够，先囤点货'); return; }
  payCost(d.g);
  const st = nearestOf(stockpileTiles(), W>>1, H>>1);
  for(const k in d.t){
    if(st) addItems(st.x, st.y, k, d.t[k]);
    else addItems(W>>1, H>>1, k, d.t[k]);
  }
  d.done = true;
  /* v1.8「富商」野心：只认成交笔数和换回的实物，不认账面差价 ——
     差价可负，玩家会为了凑数做亏本买卖，那样这个野心教的是错的 */
  state.stats.trades = (state.stats.trades || 0) + 1;
  let gained = 0;
  for(const k in d.t) gained += d.t[k];
  state.stats.wealth = (state.stats.wealth || 0) + gained;
  SFX.done();
  logEvent(`与商队成交：付出 <b>${d.gs}</b>，换来 <b>${d.ts}</b>。`, 'good');
  toast('交易完成');
  refreshCaravan();
};

/* ---- 科技树面板（v1.3）---- */
function showTech(){
  if(countBuilt('shop') <= 0){ toast('先建一座工坊'); return; }
  openModal(`
    <h1>科技树 <small>RESEARCH</small></h1>
    <p>研究由工坊推进：一次只能进行一项，占用时间而不是人手。完成后立刻生效。</p>
    <div class="g2" id="techBox"></div>
    <div class="foot"><button class="btn" onclick="closeModal()">关闭</button></div>
  `);
  refreshTech();
}

function refreshTech(){
  const box = $('techBox');
  if(!box) return;
  box.innerHTML = TECH.map(d=>{
    const done = hasTech(d.id);
    const cur = state.tech.cur === d.id;
    const ready = techReady(d);
    const afford = canAfford(d.cost);
    const costTxt = Object.keys(d.cost).map(k=> `${d.cost[k]} ${itemName(k)}`).join(' + ');
    const pct = cur ? Math.round(state.tech.prog / d.time * 100) : 0;
    const st = done ? '已完成' : cur ? `研究中 ${pct}%`
      : !ready ? '缺前置：' + d.req.map(r=> techDef(r).name).join(' / ')
      : !afford ? '物资不足' : '点击开始';
    return `<div class="tile" style="cursor:${done || cur || !ready ? 'default' : 'pointer'};opacity:${done ? 0.55 : 1}"
      onclick="startTech('${d.id}')">
      <div class="ic">${done ? '✓' : cur ? '◐' : '◻'}</div>
      <div class="tx"><b>${d.name}</b>
        <span>${d.desc}</span>
        <span style="color:var(--ink3)">${costTxt} · ${d.time} 分钟 · ${st}</span>
      </div>
    </div>`;
  }).join('');
}

window.startTech = (id)=>{
  const d = techDef(id);
  if(!d || hasTech(id)) return;
  if(state.tech.cur){ toast('已有研究在进行'); return; }
  if(!techReady(d)){ toast('缺少前置科技'); return; }
  if(!canAfford(d.cost)){ toast('物资不足'); return; }
  payCost(d.cost);
  state.tech.cur = id; state.tech.prog = 0;
  logEvent(`开始研究 <b>${d.name}</b>，需要 ${d.time} 分钟。`, '');
  SFX.done();
  refreshTech();
  uiDirty.side = true;
};

/* 兵种编成：越往后越不是纯步兵 */
function raidKindFor(day){
  const r = rnd();
  if(day >= 8 && r < 0.14) return 'brute';
  if(day >= 6 && r < 0.32) return 'slinger';
  if(day >= 10 && r < 0.44) return 'torch';
  return 'blade';
}

function spawnRaid(n, tier, opt){
  opt = opt || {};
  /* 并发护栏：场上敌人太多时压掉这一波，既防雪崩也防卡顿。
     v1.8：匪巢守卫不算「场上敌人」—— 他们蹲在 15 格外不动，
     算进去会让「远征」局里的袭击被永久压掉。 */
  const onField = state.raiders.filter(r=> !r.dead && !r.down && !r.home).length;
  const cap = 14;
  if(onField >= cap) return;
  n = Math.min(n, cap - onField);
  const reach = state.reach || computeReach();
  const spots = [];
  for(let x=0;x<W;x++) for(const y of [1, H-2])
    if(passable(x,y) && reach[y*W+x]) spots.push({x,y});
  for(let y=0;y<H;y++) for(const x of [1, W-2])
    if(passable(x,y) && reach[y*W+x]) spots.push({x,y});
  if(!spots.length){
    // 保底：取所有连通且离殖民地较远的位置
    const cx0 = W>>1, cy0 = H>>1;
    for(let i=0;i<reach.length;i++){
      if(!reach[i]) continue;
      const x = i % W, y = (i/W)|0;
      if(dist(x,y,cx0,cy0) > 18) spots.push({x,y});
    }
  }
  if(!spots.length){
    /* 二级保底：地形被围死（例如断崖剧本某个 seed 环崖没留出可通边界）时，
       仍然要在可达区里挑最远的一格出兵，否则整局零袭击直接躺赢。
       宁可牺牲"从边境来"的氛围，也不能让剧本变成没有对手的空场。 */
    const cx0 = W>>1, cy0 = H>>1;
    let best = -1, bx = 0, by = 0;
    for(let i=0;i<reach.length;i++){
      if(!reach[i]) continue;
      const x = i % W, y = (i/W)|0;
      const d = dist(x,y,cx0,cy0);
      if(d > best){ best = d; bx = x; by = y; }
    }
    if(best > 6) spots.push({ x:bx, y:by });
  }
  if(!spots.length) return;

  /* 夜袭是摸黑上来的：从离营地最近的一侧接近，玩家的反应窗口更短 */
  const base = opt.night
    ? (spots.slice().sort((a,b)=> dist(a.x,a.y,W>>1,H>>1) - dist(b.x,b.y,W>>1,H>>1))[rint(0,2)] || spots[0])
    : spots[rint(0,spots.length-1)];
  const comp = {};
  for(let i=0;i<n;i++){
    let x = clamp(base.x + rint(-2,2), 0, W-1), y = clamp(base.y + rint(-2,2), 0, H-1);
    if(!passable(x,y) || !reach[y*W+x]){ x = base.x; y = base.y; }
    const kind = opt.weak ? 'wolf' : raidKindFor(state.day);
    const r = makeRaider(x, y, tier, kind);
    comp[kind] = (comp[kind] || 0) + 1;
    state.raiders.push(r);
  }
  state.raiders.forEach(r=>{ r.target = null; r.path = null; });
  state.stats.raids = (state.stats.raids||0) + n;

  /* 战术降速（v1.7/v1.9）：4 倍速下这一仗三秒就打完了，玩家根本没有介入的窗口。
     只在高倍速时降一档，不暂停 —— 暂停会打断节奏，降速只是把镜头放慢。
     v1.9：真正的战术慢放放在 state.slow 里，任何倍速下都生效，脱战自动恢复。 */
  if(state.speed > 1 && !state.paused){
    state.speed = 1;
    setTimeout(()=> toast('接敌 · 已降为 1 倍速，随时可按 3 加速'), 40);
  }
  /* 三个以上的敌人值得认真打一场，两三个人不值得 —— 每次都慢放会腻 */
  if(n >= 3) state.slow = 0.5;
  if(!opt.night){
    if(opt.weak){
      logEvent(`<b>狼群！</b> ${n} 只野狼冲进营地。`, 'bad');
      showAlert(`狼群 · ${n} 只野狼`, true);
    } else {
      const mix = Object.keys(comp).map(k=> `${RKD[k].n}×${comp[k]}`).join(' · ');
      logEvent(`<b>袭击！</b> ${n} 名掠袭者从边境逼近（${mix}）。`, 'bad');
      showAlert(`袭击警报 · ${n} 名掠袭者来袭`, true);
    }
    SFX.alert();
  }
  /* 镜头甩向来敌方向 + 四周红晕：让"袭击来了"成为一个事件，而不只是一行日志 */
  camSwingTo((base.x + 0.5) * TS, (base.y + 0.5) * TS);
  flashVig();
}

/* =====================================================================
   偷粮贼（v2.1）：只偷熟了的作物
   ---------------------------------------------------------------
   它和掠袭者是两条完全不同的威胁：掠袭者要你的命，它要你的收成。
   所以它没有伤害值、不拆墙、不进营地，只在田里搬东西 ——
   玩家的应对不是「守住」，而是「什么时候收」。

   为什么单独一个随机数发生器：贼的出现条件依赖「田里有没有熟作物」，
   而熟作物取决于玩家这一局派了几个人种地 —— 如果它去消耗全局 rnd，
   一次触发就会把后面所有世界线（谁在哪天受伤、夜袭打哪）整条重排，
   v2.0 的十局回归会全部作废。给它一条独立的流，这件事就互不干扰。
   ===================================================================== */
let thSeed = 0x9e3779b9;
function thrnd(){
  thSeed = (thSeed * 1664525 + 1013904223) & 0x7fffffff;
  return thSeed / 0x7fffffff;
}
function reseedThieves(seed){
  thSeed = (seed ^ 0x5bf03635) >>> 0 || 0x9e3779b9;
  for(let i=0;i<6;i++) thrnd();      // 搅一下，避免相邻种子前几个数高度相关
}

function countRipeCrops(){
  let n = 0;
  for(const t of tiles)
    if(t.zone === 'farm' && t.plant && t.plant.kind === 'crop' && t.plant.grow >= 0.99) n++;
  return n;
}

/* 撤离点：就近的可通行地图边缘。贼不会往营地里面跑 */
function edgeSpotNear(x, y){
  let bd = Infinity, bp = null;
  const consider = (px, py)=>{
    if(!passable(px, py)) return;
    const d = dist(px, py, x, y);
    if(d < bd){ bd = d; bp = { x:px, y:py }; }
  };
  for(let px=1; px<W-1; px++){ consider(px, 1); consider(px, H-2); }
  for(let py=1; py<H-1; py++){ consider(1, py); consider(W-2, py); }
  return bp;
}

function spawnThieves(n){
  const reach = state.reach || computeReach();
  const spots = [];
  for(let x=0;x<W;x++) for(const y of [1, H-2])
    if(passable(x,y) && reach[y*W+x]) spots.push({x,y});
  for(let y=0;y<H;y++) for(const x of [1, W-2])
    if(passable(x,y) && reach[y*W+x]) spots.push({x,y});
  if(!spots.length){
    let best = -1, bx = 0, by = 0;
    for(let i=0;i<reach.length;i++){
      if(!reach[i]) continue;
      const x = i % W, y = (i/W)|0, d = dist(x,y,W>>1,H>>1);
      if(d > best){ best = d; bx = x; by = y; }
    }
    if(best > 6) spots.push({ x:bx, y:by });
  }
  if(!spots.length) return 0;

  const tier = Math.min(4, Math.max(1, Math.round(state.day/3)));
  let k = 0;
  for(let i=0;i<n;i++){
    const s = spots[Math.floor(thrnd()*spots.length) % spots.length];
    state.raiders.push(makeRaider(s.x, s.y, tier, 'thief'));
    k++;
  }
  if(!k) return 0;
  state.stats.thieves = (state.stats.thieves||0) + k;

  /* 把镜头甩到自家田里，而不是贼身上 —— 玩家需要看到的是「这茬再不收就没了」 */
  const ripe = tiles.filter(t=> t.zone === 'farm' && t.plant
    && t.plant.kind === 'crop' && t.plant.grow >= 0.99);
  if(ripe.length){
    const t0 = ripe[Math.floor(thrnd()*ripe.length) % ripe.length];
    const idx = tiles.indexOf(t0), tx = idx % W, ty = (idx/W)|0;
    camSwingTo((tx + 0.5) * TS, (ty + 0.5) * TS);
  }
  logEvent(`<b>偷粮贼</b>摸到田边了 —— 熟了的作物再不收，就是替他种的。`, 'bad');
  showAlert(`偷粮贼 · ${k} 人 ${ripe.length} 格待收`, false);
  SFX.alert();
  return k;
}

/* 出现节奏：只认「田里有多少格熟了」，不认天数 ——
   没种地的人一辈子不会遇到贼，这本身就是在告诉玩家：农业是有代价的。 */
function updateThieves(dt){
  if(state.over) return;
  state.thiefT = (state.thiefT || 0) + dt;
  if(state.thiefT < 360) return;      // 6 小时看一次
  state.thiefT = 0;
  if(state.day < 2) return;
  const ripe = countRipeCrops();
  if(ripe < 2) return;
  const onField = state.raiders.filter(r=> r.kind === 'thief'
    && !r.dead && !r.down && !r.fled).length;
  if(onField >= 2) return;
  const p = Math.min(0.34, 0.17 + ripe*0.012 + state.day*0.008);
  if(thrnd() > p) return;
  spawnThieves(thrnd() < 0.28 ? 2 : 1);
}

function updateThief(r, dm){
  /* 挨了打就把一半赃物丢下跑路。
     没有这一条，贼只有「被打死」和「偷干净」两种结局，
     玩家也只剩「追」这一种反应；有了它，「开两枪赶走」才成立。 */
  if(r.hp < r.maxHp && !r.dropped){
    r.dropped = true;
    const half = Math.floor((r.sack||0) / 2);
    if(half > 0){
      addItems(r.x, r.y, 'food', half);
      r.sack -= half;
      floatText(r.fx, r.fy - 0.4, '丢下粮袋', '#c8b48a');
    }
    r.flee = 1;
  }

  /* ---- 撤离 ---- */
  if(r.flee || (r.sack||0) >= 3){
    if(!r.exit) r.exit = edgeSpotNear(r.x, r.y);
    if(!r.exit){ r.fled = true; return; }
    if(dist(r.x, r.y, r.exit.x, r.exit.y) < 1.4){
      if((r.sack||0) > 0) logEvent(`<b>${r.name}</b>带着 ${r.sack} 份收成跑了。`, 'bad');
      r.fled = true;
      return;
    }
    r.repath = (r.repath || 0) - dm;
    if(!r.path || !r.path.length || r.repath <= 0){
      r.repath = 26;
      r.path = findPath(r.x, r.y, r.exit.x, r.exit.y);
      if(!r.path){ r.fled = true; return; }
    }
    if(r.path && r.path.length) moveAlong(r, dm);
    r.state = 'move';
    return;
  }

  /* ---- 正在下手 ---- */
  if(r.loot){
    const t2 = tileAt(r.loot.x, r.loot.y);
    const ok = t2 && t2.plant && t2.plant.kind === 'crop' && t2.plant.grow >= 0.99;
    if(!ok){ r.loot = null; r.path = null; r.lootT = 0; }
    else {
      const d = dist(r.fx, r.fy, r.loot.x + 0.5, r.loot.y + 0.5);
      if(d > 1.5){
        r.repath = (r.repath || 0) - dm;
        if(!r.path || !r.path.length || r.repath <= 0){
          r.repath = 20;
          r.path = null;
          const adj = adjacentFree(r.loot.x, r.loot.y)
            .sort((a,b)=> dist(a.x,a.y,r.x,r.y) - dist(b.x,b.y,r.x,r.y));
          for(let i=0;i<Math.min(3,adj.length);i++){
            const p = findPath(r.x, r.y, adj[i].x, adj[i].y);
            if(p){ r.path = p; break; }
          }
        }
        if(r.path && r.path.length) moveAlong(r, dm);
        return;
      }
      r.state = 'work';
      r.aim = Math.atan2(r.loot.y + 0.5 - r.fy, r.loot.x + 0.5 - r.fx);
      r.lootT = (r.lootT || 0) + dm;
      if(r.lootT >= 26){
        r.lootT = 0;
        const p = t2.plant, cd = cropDef(p.crop);
        const f0 = (typeof t2.fert === 'number' && t2.fert > 0) ? t2.fert : 0.6;
        /* 贼只搬得走六成 —— 剩下的是踩烂在田里的 */
        const take = cd.med ? 0 : Math.max(2, Math.round(cd.yield * (0.72 + f0*0.56) * 0.6));
        r.sack = (r.sack||0) + (take || 2);
        t2.plant = null;
        t2.fert = clamp(f0 + cd.fert * 0.16, 0.12, 1);
        floatText(t2.x + 0.5, t2.y + 0.35, `-${take||2} 食物`, '#e2564d');
        /* 田里少一茬要立刻重画 —— 否则玩家会看到一块"空的熟地" */
        repaintTile(t2.x, t2.y);
        addFx({ kind:'ring', x:t2.x + 0.5, y:t2.y + 0.5, life:320 });
        logEvent(`<b>${r.name}</b>从田里搬走了一茬。`, 'bad');
        r.loot = null; r.path = null;
      }
      return;
    }
  }

  /* ---- 找下一块熟地 ---- */
  let best = null, bd = Infinity;
  for(let i=0;i<tiles.length;i++){
    const t2 = tiles[i];
    if(t2.zone !== 'farm' || !t2.plant) continue;
    if(t2.plant.kind !== 'crop' || t2.plant.grow < 0.99) continue;
    const x = i % W, y = (i/W)|0;
    const d = dist(x, y, r.x, r.y);
    if(d < bd){ bd = d; best = { x, y }; }
  }
  if(!best){ r.flee = 1; return; }      // 已经被收干净了，那就白跑一趟
  r.loot = best; r.lootT = 0; r.path = null; r.repath = 0;
}

/* =====================================================================
   匪巢（v1.8）：「远征」野心的目标点
   ---------------------------------------------------------------
   3 处放在离「幸存者」14 格以上的可达地面上，每处 2 名守卫。
   守卫带 home 字段 —— 没人靠近就蹲着不动。没有这一条，他们会自己
   晃进营地，玩家根本不用出兵，「远征」就退化成「守成多打几个人」。
   ===================================================================== */
function spawnDens(anchor){
  const reach = state.reach || computeReach();
  /* 距离一律从「人」量，不从地图中心量 —— 营地会往外铺，中心只是起点。
     anchor 由 newGame 传入（幸存者落位后的质心）。 */
  const ax = (anchor && Number.isFinite(anchor.x)) ? anchor.x : W>>1;
  const ay = (anchor && Number.isFinite(anchor.y)) ? anchor.y : H>>1;
  /* 安全半径逐级放宽：巢卫警戒 6 格、拴绳 2.5 格、枪 6 格 —— 威胁圈最深 8.5 格。
     14 格是理想值，火堆边永远在射程之外；地图太挤（湖多林密）时退到 12 / 10。
     以前的写法是「11 格，从地图中心量」：出生点本身有 ±4 格抖动，实际只剩七八格，
     开局第一天巢卫的子弹就能落到营地里 —— 玩家什么都没做就先挨了一顿打。 */
  let cands = [];
  for(const SAFE of [14, 12, 10]){
    cands = [];
    for(let y=2; y<H-2; y++) for(let x=2; x<W-2; x++){
      if(!passable(x,y) || !reach[y*W+x]) continue;
      const t = tileAt(x, y);
      if(!t || t.bld || t.plant) continue;
      if(dist(x, y, ax, ay) < SAFE) continue;
      /* 质心只是一个点，人是散开的：逐个幸存者再量一遍 */
      if(state.cols.some(c=> !c.dead && dist(x, y, c.x, c.y) < SAFE)) continue;
      let open = 0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(passable(x+dx,y+dy)) open++;
      if(open < 2) continue;
      /* 也别放在隘口上：匪巢卡住唯一通路时，居民每次路过都要挨枪，
         而绕行代价再高也没得绕（实测 seed 7 就是这样挨了两枪）。
         5×5 里至少 9 格能站人，才算真的「空地」。 */
      let room = 0;
      for(let yy=-2; yy<=2; yy++) for(let xx=-2; xx<=2; xx++){
        if(xx === 0 && yy === 0) continue;
        if(passable(x+xx, y+yy)) room++;
      }
      if(room < 9) continue;
      cands.push({ x, y });
    }
    if(cands.length >= 3) break;
  }
  if(cands.length < 3) return 0;

  /* 三处要分得开，否则一波人就能同时打两个巢，出兵路线没有取舍。
     但"分得开"不能是硬条件 —— 随机撒点找不到三个互距 9 格的位置时，
     原来的写法直接返回 0，整局一个匪巢都没有，「远征」变成空手走路。
     逐级放宽距离，最后兜底不管距离也要凑够三个。 */
  let picked = [];
  for(const minD of [9, 7, 5, 3]){
    picked = [];
    for(let tries=0; tries<800 && picked.length<3; tries++){
      const c = cands[rint(0, cands.length-1)];
      if(picked.every(p=> dist(p.x,p.y,c.x,c.y) >= minD)) picked.push(c);
    }
    if(picked.length === 3) break;
  }
  if(picked.length < 3){
    /* 地图实在太挤：按离营地距离从远到近补满。
       候选已经全部过了 SAFE 检查，这里不用再筛距离。 */
    const rest = cands.slice().sort((a,b)=>
      dist(b.x,b.y,ax,ay) - dist(a.x,a.y,ax,ay));
    for(const c of rest){
      if(picked.length >= 3) break;
      if(picked.some(p=> p.x === c.x && p.y === c.y)) continue;
      picked.push(c);
    }
  }
  if(picked.length < 3) return 0;

  for(const p of picked){
    const t = tileAt(p.x, p.y);
    t.bld = { type:'den', hp:160, maxHp:160, prog:1 };
    t.plant = null;
    state.dens = state.dens || [];
    state.dens.push({ x:p.x, y:p.y });
    const adj = adjacentFree(p.x, p.y);
    for(let i=0; i<2; i++){
      /* 只有一个空邻格时不能都塞进去：两名守卫叠在一格上，
         看着像只刷了一个，打起来也是一起被打 */
      const base = adj.length ? adj[i % adj.length] : p;
      const s = (adj.length < 2 && i > 0)
        ? { x: clamp(base.x + 1, 1, W-2), y: base.y } : base;
      const r = makeRaider(s.x, s.y, 1, 'warden');
      r.home = { x:p.x, y:p.y };
      state.raiders.push(r);
    }
  }
  return picked.length;
}

/* ---- 抉择（v1.5）：15 个事件，部分选择会在几天后回来找你 ---- */
function moodAll(v){
  for(const c of state.cols) c.needs.mood = clamp((c.needs.mood||0) + v, 0, 100);
}
function grantRes(o){
  for(const k of Object.keys(o)){
    state.res[k] = (state.res[k] || 0) + o[k];
  }
  uiDirty.res = true;
}
function takeRes(o, x, y){
  const out = {};
  for(const k of Object.keys(o)) out[k] = removeItemAnywhere(k, o[k], x === undefined ? W/2 : x, y === undefined ? H/2 : y);
  return out;
}
const CHOICE_POOL = [
  { id:'stranger', t:'门口的陌生人', d:'一个瘦得脱形的男人站在栅栏外，说他什么活都肯干，只求一口饭。',
    opts:[
      { l:'让他进来（+1 人手，口粮更紧）',
        f(){ const c = spawnColonist(); if(c) logEvent(`<b>${c.name}</b> 加入了殖民地。`, 'good'); },
        later:{ d:4, msg:'那个瘦男人把营地所有钝了的工具都磨了一遍 —— 你们干活顺手多了。',
          f(){ grantRes({ wood:26, stone:14 }); moodAll(3); } } },
      { l:'给他两顿饭送走（食物 −6，全营心情 +7）',
        f(){ const got = takeRes({ food:6 }).food; moodAll(7);
              logEvent(got > 0 ? '你让他吃了顿饱饭，然后送他上路。' : '你分不出多余的粮食，只能让他空手离开。', ''); } }
    ] },
  { id:'wagon', t:'翻倒的货车', d:'西边沟里翻着一辆旧货车，木料还能拆，车轴上的铁件也能用。',
    opts:[
      { l:'全拆了（木材 +48）', f(){ grantRes({ wood:48 }); logEvent('把货车拆成了木料，<b>+48</b> 木材。', 'good'); } },
      { l:'修好还给车主（石料 +18，心情 +5）',
        f(){ grantRes({ stone:18 }); moodAll(5); logEvent('你们把车修好推回了大路，车主留下些石料当谢礼。', 'good'); },
        later:{ d:3, msg:'那位车主又路过一次，卸下半车石料，说是还你们的修车人情。',
          f(){ grantRes({ stone:34 }); } } }
    ] },
  { id:'fever', t:'发烧的旅人', d:'一个旅人倒在路边发着高烧，嘴里念着他女儿的名字。',
    opts:[
      { l:'用药草救他（药草 −3，全营心情 +11）',
        f(){ const got = takeRes({ herb:3 }).herb;
              if(got >= 3){ moodAll(11); logEvent('药草起了作用，他退了烧，临走前朝营地鞠了一躬。', 'good'); }
              else logEvent('库存里的药草不够，你们只能给他喂了点热水。', 'warn'); },
        later:{ d:5, msg:'那个退了烧的旅人回来了，身后跟着两个愿意留下的人。',
          f(){ spawnColonist(); spawnColonist(); moodAll(6); } } },
      { l:'绕开他（心情 −6）', f(){ moodAll(-6); logEvent('你们绕开了那个旅人。没人说话。', 'warn'); } }
    ] },
  { id:'mine', t:'塌方的矿井', d:'东边老矿道塌了半边，里面还压着两个淘石料的人，喊声越来越弱。',
    opts:[
      { l:'组织人手挖开（石料 +40，1 人受伤）',
        f(){ grantRes({ stone:40 });
              const c = pick(state.cols.filter(x=> !x.down));
              if(c){ hurt(c, 26, null); logEvent(`石料挖出来了，但 <b>${c.name}</b> 被落石砸伤了。`, 'warn'); }
              else logEvent('石料挖出来了，没人受伤。', 'good'); },
        later:{ d:5, msg:'被救出来的人记得矿道的走向 —— 他们带路挖出了一条浅层石脉。',
          f(){ grantRes({ stone:56 }); } } },
      { l:'封死矿口（石料 +15，心情 −4）',
        f(){ grantRes({ stone:15 }); moodAll(-4); logEvent('你们把矿口砌死了。喊声停了。', 'warn'); } }
    ] },
  { id:'merchant', t:'夜里的敲门声', d:'一个背着油布包的人说他手里有枪，只要木料，天亮就走。',
    opts:[
      { l:'用木料换枪（木材 −40，全员换步枪）',
        f(){ const got = takeRes({ wood:40 }).wood;
              if(got >= 40){ for(const c of state.cols){ c.weapon = 'rifle'; setupWeapon(c); }
                logEvent('换来的枪分了，<b>全营换成步枪</b>。', 'good'); }
              else logEvent('木料不够，那人只肯留下两匣子弹。', 'warn'); } },
      { l:'不开门（心情 −3）',
        f(){ moodAll(-3); logEvent('你们没开门。脚步声在门外停了很久才走。', ''); },
        later:{ d:6, msg:'那天夜里被你拒之门外的人，把营地的位置卖给了掠袭者。',
          f(){ spawnRaid(3, 2); }, bad:true } }
    ] },
  { id:'child', t:'走失的孩子', d:'一个七八岁的孩子蹲在柴堆后面，问他什么都不说，只是一直看着锅。',
    opts:[
      { l:'收留下来（+1 人口，食物 −8，心情 +9）',
        f(){ takeRes({ food:8 }); moodAll(9); const c = spawnColonist(); if(c) logEvent(`<b>${c.name}</b> 留了下来，吃饭时总坐在最边上。`, 'good'); },
        later:{ d:6, msg:'孩子的家人循着烟找到了营地，留下两包药草和一句谢谢。',
          f(){ grantRes({ herb:5 }); moodAll(4); } } },
      { l:'交给路过的商队（木材 +24，心情 −8）',
        f(){ grantRes({ wood:24 }); moodAll(-8); logEvent('商队把孩子带走了。那天的晚饭没人说话。', 'warn'); } }
    ] },
  { id:'blight', t:'麦子发霉', d:'仓库角落的粮食起了霉斑，靠外的几袋已经不能吃了。',
    opts:[
      { l:'整批烧掉（食物 −20，杜绝扩散）',
        f(){ takeRes({ food:20 }); logEvent('你们把霉粮烧了。烟味在营地里散了一整天。', 'warn'); } },
      { l:'挑好的吃（食物 −6，1 人腹泻）',
        f(){ takeRes({ food:6 });
              const c = pick(state.cols.filter(x=> !x.down));
              if(c){ c.sick = 600 + rint(0,200); logEvent(`省下了大半粮食，但 <b>${c.name}</b> 吃完就倒了。`, 'warn'); }
              else logEvent('省下了大半粮食，暂时没人出事。', ''); },
        later:{ d:3, msg:'霉斑又冒出来了 —— 剩下的粮食还是坏了一批。',
          f(){ takeRes({ food:14 }); }, bad:true } }
    ] },
  { id:'deserter', t:'带枪的逃兵', d:'一个穿旧军装的人说他在找活路，枪法不错，但有人在后头追他。',
    opts:[
      { l:'收下他（+1 神枪手，会被追兵找上门）',
        f(){ const c = spawnColonist(); if(c){ c.skill.fight = 11; c.weapon = 'rifle'; setupWeapon(c); c.maxHp += 12; c.hp = c.maxHp;
                logEvent(`<b>${c.name}</b> 留了下来，枪法比谁都稳。`, 'good'); } },
        later:{ d:3, msg:'追兵到了 —— 他们不谈判，直接开火。',
          f(){ spawnRaid(4, 2); }, bad:true } },
      { l:'把他交出去（石料 +30，心情 −6）',
        f(){ grantRes({ stone:30 }); moodAll(-6); logEvent('你指了方向。追兵把人带走了，留下些石料。', 'warn'); } }
    ] },
  { id:'spring', t:'石缝里的泉眼', d:'营地南侧的石缝里渗出水来，水量不大，但一年四季不断。',
    opts:[
      { l:'挖一条引水渠（木材 −30）',
        f(){ takeRes({ wood:30 }); logEvent('水渠挖开了，营地里终于不用天天跑湖边。', 'good'); },
        later:{ d:4, msg:'引水渠通了水，湿了的那片地冒出一茬野菜。',
          f(){ grantRes({ food:26 }); }, } },
      { l:'就地打一口井（石料 −26，心情 +8）',
        f(){ takeRes({ stone:26 }); moodAll(8); logEvent('井打成了。打水的时间省下来，能做别的了。', 'good'); } }
    ] },
  { id:'cache', t:'埋起来的补给', d:'荒地中央有一处新翻的土，铁锹印还很清楚。',
    opts:[
      { l:'挖开（木材 +38，石料 +26，可能埋了雷）',
        f(){ grantRes({ wood:38, stone:26 });
              if(rnd() < 0.32){ const c = pick(state.cols.filter(x=> !x.down));
                if(c) hurt(c, 34, null);
                logEvent('箱底压着一颗土雷 —— 挖的人被炸翻在地。', 'warn'); }
              else logEvent('箱子里是整捆的木料和石块。', 'good'); } },
      { l:'做个记号离开（心情 +3）',
        f(){ moodAll(3); logEvent('你们没动它。有些土不该翻。', ''); } }
    ] },
  { id:'quarrel', t:'两个人的争执', d:'为了最后一副手套，两个人从早上吵到中午，现在谁也不肯退。',
    opts:[
      { l:'当众评理，判给更需要的人（一人心情 +12，一人 −12）',
        f(){ const alive = state.cols.filter(c=> !c.down);
              if(alive.length >= 2){
                const a = pick(alive), b = pick(alive.filter(x=> x !== a));
                a.needs.mood = clamp(a.needs.mood + 12, 0, 100);
                if(b) b.needs.mood = clamp(b.needs.mood - 12, 0, 100);
                logEvent(`你把手套判给了 <b>${a.name}</b>${b ? '，' + b.name + ' 一整天没说话' : ''}。`, '');
              } } },
      { l:'各打五十大板（全员心情 −5，两人关系 +20）',
        f(){ moodAll(-5); const alive = state.cols.filter(c=> !c.down);
              if(alive.length >= 2){ const a = pick(alive), b = pick(alive.filter(x=> x !== a)); if(b) addBond(a, b, 20); }
              logEvent('你把手套收了，两个人一起被罚去劈柴。', ''); } }
    ] },
  { id:'tribute', t:'掠袭者的条件', d:'一个骑马的使者带来口信：交三十份粮，这一轮就不来了。',
    opts:[
      { l:'交粮买平安（食物 −30，跳过下一次袭击）',
        f(){ const got = takeRes({ food:30 }).food;
              if(got >= 30){ state.skipRaid = (state.skipRaid||0) + 1; logEvent('粮交出去了。这一轮不会有人来。', ''); }
              else { moodAll(-6); logEvent('粮不够，使者空手回去 —— 他们会记得这件事。', 'warn'); state.skipRaid = 0; } } },
      { l:'把使者赶回去（心情 +7，但下一次更狠）',
        f(){ moodAll(7); logEvent('你把使者赶了回去。营地当晚唱歌唱到很晚。', 'good'); },
        later:{ d:3, msg:'被赶回去的使者带来了报复 —— 比平时多出好几个人。',
          f(){ spawnRaid(5, 2); }, bad:true } }
    ] },
  { id:'tinker', t:'流浪工匠', d:'一个背着整套凿子的人想借个火，顺便看看你们的工坊。',
    opts:[
      { l:'请他留下做几天研究（当前研究 +90）',
        f(){ if(state.tech.cur){ state.tech.prog += 90; logEvent('工匠在工坊里待了一夜，<b>研究进度大幅推进</b>。', 'good'); }
              else { grantRes({ stone:22, wood:18 }); logEvent('还没有立项，他帮你们把料石凿得齐整了些。', ''); } } },
      { l:'给顿饭送他上路（心情 +5）',
        f(){ takeRes({ food:4 }); moodAll(5); logEvent('他吃了顿热饭，临走前替你们磨了所有的凿子。', 'good'); } }
    ] },
  { id:'grave', t:'雪下的旧坟', d:'营地西边有一处被雪压塌的旧坟，木牌上的字已经看不清了。',
    opts:[
      { l:'挖开看看（木材 +35，石料 +20，心情 −10）',
        f(){ grantRes({ wood:35, stone:20 }); moodAll(-10); logEvent('棺木还能用，里面还有几件铁器。没人愿意多看。', 'warn'); } },
      { l:'重新立块木牌（心情 +6）',
        f(){ takeRes({ wood:6 }); moodAll(6); logEvent('你们给那座坟换了新牌。有人在上头搁了一小把野花。', 'good'); } }
    ] },
  { id:'coldsnap', t:'寒潮', d:'气温一夜掉了下去，柴堆见了底，屋里比屋外暖不了多少。',
    opts:[
      { l:'烧掉备用的木料取暖（木材 −30，心情 +9）',
        f(){ takeRes({ wood:30 }); moodAll(9);
              for(const c of state.cols) c.needs.rest = clamp(c.needs.rest + 12, 0, 100);
              logEvent('火烧了整整一夜，所有人都睡踏实了。', 'good'); } },
      { l:'省着用，硬扛过去（全员精力 −18）',
        f(){ for(const c of state.cols) c.needs.rest = clamp(c.needs.rest - 18, 0, 100);
              logEvent('你们挤在一起熬过了这一夜。天亮时谁都不想动。', 'warn'); } }
    ] }
];

/* 延迟后果：只存 id 与选项下标，不存函数，保证可以存档 */
function scheduleLater(key, oi, later){
  state.pending.push({ key, opt: oi, due: state.day + (later.d || 3) });
  logEvent('这个选择也许还有下文。', '');
}
function tickPending(){
  if(!state.pending || !state.pending.length) return;
  const due = state.pending.filter(p=> p.due <= state.day);
  if(!due.length) return;
  state.pending = state.pending.filter(p=> p.due > state.day);
  for(const p of due){
    const c = CHOICE_POOL.find(x=> x.id === p.key);
    const o = c && c.opts[p.opt];
    if(o && o.later){
      try{ o.later.f(); }catch(e){ console.warn(e); }
      logEvent(o.later.msg || '之前的选择有了回音。', o.later.bad ? 'warn' : '');
      if(o.later.bad) showAlert('旧账上门', true);
    }
  }
}

function showChoice(){
  let pool = CHOICE_POOL.filter(c=> !(state.usedChoices || []).includes(c.id));
  if(!pool.length){ state.usedChoices = []; pool = CHOICE_POOL; }
  const c = pick(pool);
  state.usedChoices.push(c.id);
  const opts = c.opts.map((o, i)=>
    `<button class="btn" style="text-align:left;padding:13px 15px;font-size:13px;line-height:1.5"
      onclick="pickChoice('${c.id}',${i})">${o.l}</button>`).join('');
  openModal(`
    <h1>${c.t}<small>第 ${state.day} 天 · 抉择</small></h1>
    <p>${c.d}</p>
    <div style="display:flex;flex-direction:column;gap:9px;margin-top:18px">${opts}</div>
    <div class="foot"><span class="hint">有些选择会在几天后回来找你</span></div>`);
}
/* =====================================================================
   第二幕（v2.0）：第 6 天前后，一个不能回头的分岔
   ---------------------------------------------------------------
   一局 12 天，如果从头到尾是同一套动作，第 8 天和第 3 天没有区别。
   这一幕把一局切成两半：前半段攒家底，后半段玩「我付了什么代价」。
   两个选项都给得起、也都要得起 —— 所以这是一次真正的选择。
   ===================================================================== */
function act2Day(){ return Math.max(5, Math.round(state.goalDay * 0.5)); }

function maybeAct2(day){
  if(state.act2 || state.endless || state.over || window.__fastTest) return false;
  if(day !== act2Day()) return false;
  if(!state.cols.filter(c=> !c.dead && !c.down).length) return false;
  showAct2();
  return true;
}

function showAct2(){
  const alive = state.cols.filter(c=> !c.dead && !c.down);
  const weakest = alive.slice().sort((a,b)=> a.needs.mood - b.needs.mood)[0];
  const who = weakest ? weakest.name : '一个人';
  openModal(`
    <h1>秤<small>第 ${state.day} 天 · 分岔</small></h1>
    <p>商人把木箱放在地上，一脚踢开盖子。里面是石料、铁件，还有几盒子弹，
       码得整整齐齐。他说条件很简单：一个人跟他走。</p>
    <p style="color:var(--ink3)">「你们养不活这么多人的，」他说，「我看得出来。」</p>
    <div style="display:flex;flex-direction:column;gap:9px;margin-top:18px">
      <button onclick="pickAct2('sell')" class="act2o act2-bad">
        <b>成交</b><span class="who">${who} 跟他走</span>
        <em>石料 55 · 木材 40 · 当前研究立刻完成　此后不会再有新人加入</em>
      </button>
      <button onclick="pickAct2('refuse')" class="act2o">
        <b>不卖</b><span class="who">让他把箱子抬回去</span>
        <em>全员心情 +9　但商队从此隔四天才来一次</em>
      </button>
    </div>
    <div class="foot"><span class="hint">这一步不能回头</span></div>`);
}

window.pickAct2 = (k)=>{
  if(state.act2){ closeModal(); return; }
  state.act2 = (k === 'sell') ? 'sell' : 'refuse';

  if(state.act2 === 'sell'){
    const alive = state.cols.filter(c=> !c.dead && !c.down);
    const gone = alive.slice().sort((a,b)=> a.needs.mood - b.needs.mood)[0];
    grantRes({ stone:55, wood:40 });
    /* 当前研究直接推到完成线：工匠拿了钱，连夜把图纸画完了 */
    if(state.tech.cur){
      const def = techDef(state.tech.cur);
      if(def) state.tech.prog = Math.max(state.tech.prog, def.time);
    }
    if(gone){
      logEvent(`<b>${gone.name}</b> 跟着商人走了。箱子留了下来。`, 'warn');
      noteDay(`第二幕成交：<b>${gone.name}</b> 跟着商人走了`, 'warn');
      state.cols = state.cols.filter(x=> x !== gone);
      if(state.sel && state.sel.kind === 'col' && state.sel.id === gone.id) state.sel = null;
      if(state.cmd && state.cmd.some(x=> x === gone.id)) state.cmd = null;
    }
  } else {
    moodAll(9);
    logEvent('你们没接那只箱子。商人耸耸肩，把盖子合上了。', 'good');
    noteDay('第二幕拒绝成交，此后不会再有新人来', 'warn');
  }
  uiDirty.side = true; uiDirty.res = true; uiDirty.log = true;
  closeModal();
};

window.pickChoice = (id, oi)=>{
  const c = CHOICE_POOL.find(x=> x.id === id);
  const o = c && c.opts[oi];
  if(o){
    try{ o.f(); }catch(e){ console.warn(e); }
    if(o.later) scheduleLater(c.id, oi, o.later);
  }
  closeModal();

  uiDirty.side = true; uiDirty.res = true;
};

function spawnColonist(){
  const used = new Set(state.cols.map(c=> c.name));
  const free = NAMES.filter(n=> !used.has(n));
  const name = free.length ? pick(free) : '新来者' + rint(1,99);
  let spot = null;
  for(let i=0;i<120;i++){
    const x = clamp((W>>1) + rint(-6,6), 0, W-1), y = clamp((H>>1) + rint(-6,6), 0, H-1);
    if(passable(x,y)){ spot = {x,y}; break; }
  }
  if(!spot) spot = { x: W>>1, y: H>>1 };
  const c = makeColonist(name, spot.x, spot.y);
  setupWeapon(c);
  state.cols.push(c);
  return c;
}

