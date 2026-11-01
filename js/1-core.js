/* =====================================================================
   1-core.js · 核心与地图
   边陲 v1.5 · 模块化拆分（原单文件第 1 部分）
   ===================================================================== */


"use strict";
window.__errs = [];
window.addEventListener('error', e=> window.__errs.push((e.message||'') + ' @' + (e.lineno||0)));
window.addEventListener('unhandledrejection', e=> window.__errs.push('promise: ' + e.reason));
/* =====================================================================
   边陲 FRONTIER · 殖民地模拟
   单文件实现：地形生成 / A* 寻路 / 居民 AI / 建造 / 战斗 / 事件
   ===================================================================== */

/* =====================================================================
   1 · 基础工具
   ===================================================================== */
const TAU = Math.PI * 2;
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp  = (a,b,t)=> a+(b-a)*t;
const dist  = (a,b,c,d)=> Math.hypot(a-c,b-d);
const $ = id=> document.getElementById(id);

function mulberry32(a){
  return function(){
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a>>>15, 1|a);
    t = t + Math.imul(t ^ t>>>7, 61|t) ^ t;
    return ((t ^ t>>>14) >>> 0) / 4294967296;
  };
}
let RNG = mulberry32(20261026);
const rnd  = ()=> RNG();
const rint = (a,b)=> Math.floor(RNG()*(b-a+1))+a;
const pick = arr=> arr[Math.floor(RNG()*arr.length)];

/* 分形叠加噪声：给地形一层"大起伏 + 细节"的自然质感 */
function fbm(n, x, y, oct, gain){
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  const g = gain === undefined ? 0.5 : gain;
  for(let i=0;i<oct;i++){
    sum += n(x*f, y*f) * amp; norm += amp;
    amp *= g; f *= 2;
  }
  return sum / norm;
}
const smoothstep = (a,b,v)=>{ const t = clamp((v-a)/(b-a), 0, 1); return t*t*(3-2*t); };

function makeNoise(seed){
  const r = mulberry32(seed), N = 128, g = new Float32Array(N*N);
  for(let i=0;i<N*N;i++) g[i] = r();
  const at = (x,y)=> g[(((y%N)+N)%N)*N + (((x%N)+N)%N)];
  return (x,y)=>{
    const xi = Math.floor(x), yi = Math.floor(y), xf = x-xi, yf = y-yi;
    const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
    const a = at(xi,yi), b = at(xi+1,yi), c = at(xi,yi+1), d = at(xi+1,yi+1);
    return lerp(lerp(a,b,u), lerp(c,d,u), v);
  };
}

/* =====================================================================
   2 · 常量与数据定义
   ===================================================================== */
/* v1.1：地图扩至 72×52（PRD FR-5.1.1 已同步），新增三种地貌 */
const W = 72, H = 52, TS = 34;        // 地图宽高（格） / 每格像素
const T = { GRASS:0, SAND:1, DIRT:2, WATER:3, ROCK:4, MEADOW:5, GRAVEL:6, MARSH:7 };
const T_NAME = ['草地','沙地','泥土','水域','岩壁','花甸','碎石滩','湿地'];
const IS_VEG = [1,0,0,0,0,1,0,1];      // 可生长植被的地形

/* 调色板：每种地形三档（基色 / 受光 / 背光），渲染时按高程插值 */
const PAL = {
  [T.GRASS ]: { base:'#6f9d47', hi:'#86b45a', lo:'#547d38' },
  [T.MEADOW]: { base:'#83aa4d', hi:'#9dc25e', lo:'#66893d' },
  [T.SAND  ]: { base:'#cdb287', hi:'#e0c89e', lo:'#ae9269' },
  [T.GRAVEL]: { base:'#8f8b82', hi:'#a29d93', lo:'#736f68' },
  [T.DIRT  ]: { base:'#8d7758', hi:'#a38c69', lo:'#725f46' },
  [T.MARSH ]: { base:'#5f7a4b', hi:'#74905a', lo:'#475d37' },
  [T.WATER ]: { base:'#3f83b4', hi:'#7cc4dd', lo:'#123a52' },
  [T.ROCK  ]: { base:'#6a7078', hi:'#8f96a0', lo:'#41474f' }
};
const _rgbCache = new Map();
function hexRGB(hex){
  let v = _rgbCache.get(hex);
  if(!v){
    v = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
    _rgbCache.set(hex, v);
  }
  return v;
}
function mixRGB(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function shadeRGB(c,amt){ return [c[0]+amt, c[1]+amt, c[2]+amt]; }
function cssRGB(c,a){
  const f = v=> v<0?0:v>255?255:v|0;
  return a===undefined ? `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`
                       : `rgba(${f(c[0])},${f(c[1])},${f(c[2])},${a})`;
}
/* 地形同族：用于软过渡时判断"像不像" */
const FAM = [0,1,2,3,4,0,1,0];

/* 可建造物 */
const BL = {
  wall:  { name:'石墙',  cost:{stone:4},        work:46, hp:150, solid:true,  ico:'wall'  },
  door:  { name:'木门',  cost:{wood:6},         work:40, hp:100, solid:false, ico:'door'  },
  bed:   { name:'床铺',  cost:{wood:14},        work:52, hp:80,  solid:false, ico:'bed'   },
  fire:  { name:'篝火',  cost:{wood:10,stone:6},work:45, hp:70,  solid:false, ico:'fire'  },
  turret:{ name:'哨戒炮',cost:{stone:22,wood:10},work:90,hp:180, solid:true,  ico:'turret'},
  table: { name:'餐桌',  cost:{wood:16},        work:44, hp:80,  solid:false, ico:'table' },
  shop:  { name:'工坊',  cost:{stone:26,wood:18},work:96,hp:130, solid:false, ico:'shop'  },
  clinic:{ name:'医务所',cost:{wood:22,stone:12},work:76,hp:110, solid:false, ico:'clinic', tech:'clinic' },
  /* 匪巢（v1.8）：只由 spawnDens 放置，不进建造栏。
     守卫活着时伤害打三折 —— 先清人再拆窝，出兵才有先后顺序。 */
  den:   { name:'匪巢',  cost:{},               work:0, hp:160, solid:false, ico:'den',  hidden:true }
};
const BLD_KEYS = ['wall','door','bed','fire','turret','table','shop','clinic'];

/* =====================================================================
   科技树（v1.3）：工坊建成后可研究，一次一项，耗尽时间推进
   req 为前置科技；effect 在代码里按 id 查询
   ===================================================================== */
const TECH = [
  { id:'tools',   name:'铁制工具', cost:{stone:24},          time:170, req:[],
    desc:'采集 / 建造 / 烹饪速度 +22%' },
  { id:'storage', name:'仓储扩容', cost:{wood:30},            time:150, req:[],
    desc:'每格仓库容量 2 → 3，散料不再堵在门口' },
  { id:'wall2',   name:'石墙加固', cost:{stone:36},           time:200, req:['tools'],
    desc:'石墙耐久 150 → 240' },
  { id:'clinic',  name:'草药学',   cost:{wood:20,food:8},     time:210, req:[],
    desc:'解锁医务所：用草药治疗伤口' },
  { id:'farm2',   name:'轮作制',   cost:{food:16,wood:14},    time:230, req:[],
    desc:'作物生长速度 +35%' },
  { id:'turret2', name:'弩机改良', cost:{stone:40,wood:24},   time:270, req:['tools'],
    desc:'哨戒炮伤害 +45%，射程 8.5 → 10.5' },
  { id:'forge',   name:'石砌工艺', cost:{stone:44,wood:16},   time:250, req:['wall2'],
    desc:'所有建筑耐久 +30%' },
  { id:'armor',   name:'皮甲缝制', cost:{wood:26,food:10},    time:200, req:['clinic'],
    desc:'居民生命上限 +20，受击伤害 −12%' },
  { id:'watch',   name:'守夜轮值', cost:{wood:18,food:6},     time:180, req:[],
    desc:'每夜 1 个守夜名额不再拖垮身体；守夜者当夜修墙更快' }
];
function techDef(id){ return TECH.find(t=> t.id === id); }
function hasTech(id){ return !!state.tech.done[id]; }
function techReady(d){ return d.req.every(r=> hasTech(r)); }

/* 建筑实际耐久（受加固 / 石砌工艺影响） */
function bldMaxHp(type){
  /* 匪巢是敌方建筑，不该吃玩家的「锻造」加成 */
  if(type === 'den') return 160;
  let hp = BL[type].hp;
  if(type === 'wall' && hasTech('wall2')) hp = 240;
  if(hasTech('forge')) hp = Math.round(hp * 1.3);
  return hp;
}
/* 仓库单格容量 */
function stockCap(){ return hasTech('storage') ? 3 : 2; }

/* =====================================================================
   性格（v1.3）：每人 1~2 个特质，影响效率、情绪、撤退与受伤
   ===================================================================== */
const TRAITS = {
  diligent:{ n:'勤快', d:'工作速度 +8%，技能成长更快', c:'#7fc08a' },
  timid:   { n:'怯懦', d:'生命低于 45% 就后撤，命中 −10%', c:'#c9a03f' },
  cheerful:{ n:'乐观', d:'心情基数 +9，不容易崩溃', c:'#e8a33d' },
  loner:   { n:'孤僻', d:'独处时心情好，人群里更烦躁', c:'#8a8f9a' },
  tough:   { n:'坚韧', d:'受伤累积减半，倒地后恢复更快', c:'#c26a4a' },
  deft:    { n:'巧手', d:'建造与烹饪速度 +18%', c:'#5aa0f0' }
};
const TRAIT_KEYS = Object.keys(TRAITS);
function hasTrait(c, k){ return (c.traits || []).indexOf(k) >= 0; }

/* =====================================================================
   旧伤（v2.0）
   ---------------------------------------------------------------
   1.9 之前受伤只有两个结局：治好，或者死。中间那种「人活下来了，但从此
   不一样了」不存在 —— 所以玩家从来不必为「派谁去挡」犹豫，因为代价
   要么是零，要么是全盘重来。
   伤口拖到 72 以上会落下一样旧伤：永久，治不回去，但也不致命。
   ===================================================================== */
const DEBUFFS = {
  lame:  { n:'瘸腿', d:'移动速度 −22%',       c:'#c26a4a' },
  tremor:{ n:'手抖', d:'射击与挥锤伤害 −15%', c:'#c9a03f' },
  scar:  { n:'疤脸', d:'心情基数 −7',         c:'#8a8f9a' },
  lung:  { n:'伤肺', d:'干活速度 −10%',       c:'#7a8fa0' }
};
function hasDebuff(c, k){ return (c.debuffs || []).indexOf(k) >= 0; }

/* =====================================================================
   闲聊（v2.0）
   ---------------------------------------------------------------
   营地原本只有脚步声和数字。人一开口，那三个色块才像三个人。
   台词按当下状态挑：干活、累了、饿了、夜里、受伤、闲站。
   ===================================================================== */
const CHATTER = {
  work:   ['这活儿干不完的', '再搬两趟吧', '手心全是泡', '这块石头真硬', '天黑前能弄完吗'],
  tired:  ['腰快断了', '让我坐一会儿', '眼睛睁不开了', '再撑一会儿'],
  hungry: ['还有吃的吗', '肚子一直在叫', '今天轮到谁做饭'],
  night:  ['今晚谁守', '风从缝里钻进来', '火别再灭了', '听见了吗'],
  hurt:   ['这口子又裂开了', '忍忍就过去了', '别碰那儿'],
  idle:   ['这天色不太对', '林子里刚才有动静', '安静得有点过分', '你说，还会有人来吗']
};
function saySomething(c){
  if(!c || c.dead || c.down) return;
  const h = (state.min % 1440) / 60;
  const night = h >= 20.5 || h < 6;
  let pool = CHATTER.idle;
  if((c.wound || 0) >= 32) pool = CHATTER.hurt;
  else if(c.needs.hunger < 34) pool = CHATTER.hungry;
  else if(c.needs.rest < 30) pool = CHATTER.tired;
  else if(night) pool = CHATTER.night;
  else if(c.job && c.job.type !== 'wander' && c.job.type !== 'rest') pool = CHATTER.work;
  c.bubble = { t: pick(pool), ttl: 210 };
}

/* =====================================================================
   掠袭者兵种（v1.3）：不再只是数值缩放，各自有明确职责
   ===================================================================== */
const RKD = {
  blade:  { n:'掠袭兵', hp:1.00, dmg:1.00, rng:1.00, spd:1.00,
            d:'近身射击，攻击最近的居民' },
  brute:  { n:'破门槌', hp:1.55, dmg:1.05, rng:0.92, spd:0.80, bldDmg:2.2,
            d:'只拆建筑，对围墙伤害极高' },
  slinger:{ n:'投石手', hp:0.78, dmg:0.80, rng:1.30, spd:0.95, keep:true,
            d:'远程压制，专挑残血居民' },
  torch:  { n:'纵火者', hp:0.88, dmg:0.78, rng:1.00, spd:1.18, fire:true,
            d:'点燃建筑，火焰会持续烧蚀结构' },
  wolf:   { n:'野狼',   hp:0.55, dmg:0.65, rng:0.55, spd:1.32, weak:true,
            d:'速度快、血薄，成群扑咬' },
  /* v1.8：匪巢守卫。不追远、不拆家，只在巢边开火 —— 想拆窝得先清人 */
  warden: { n:'巢卫',   hp:1.25, dmg:1.10, rng:1.18, spd:0.84, keep:true,
            d:'守在匪巢周围，进射程才开火' },
  /* v2.1 偷粮贼：不动手、不拆家，只搬成熟的作物。
     它的威胁是「你晚收一天」，不是「你要死人」—— 所以没有伤害值，
     但跑得比居民快，追不上就得靠炮塔。 */
  thief:  { n:'偷粮贼', hp:0.62, dmg:0, rng:0, spd:1.45, thief:true,
            d:'只在作物成熟后出现，装满了就跑' }
};
const ZONE = {
  stock: { name:'仓库区', ico:'stock' },
  farm:  { name:'农田',   ico:'farm'  }
};

/* =====================================================================
   作物（v2.1）：开荒之后，玩家要决定这块地种什么
   ---------------------------------------------------------------
   四种作物不是同一个数字的四种写法 —— 每一种都换掉一个取舍：
     麦    产量最高、长得最慢，地力掉最快。连作三年，一年不如一年。
     豆    产量最低，但长得快，而且地力是涨的。轮作的另一半。
     根菜  中庸，但冬天照长 —— 冬天唯一还能进粮的地。
     药草  不产粮，产药草。医务所唯一的原料，靠野采永远不够用。
   rate 越大长得越快（相对基准 1700 分钟）；fert 为负表示耗地力。
   ===================================================================== */
const CROPS = {
  wheat: { n:'麦',   col:'#86b356', ripe:'#d8b24a', culm:true,
           d:'产量最高，地力掉得快', yield:9, rate:1.00, fert:-0.55 },
  bean:  { n:'豆',   col:'#7fc94e', ripe:'#b4e884', bush:true,
           d:'长得快、养地，产量低', yield:5, rate:1.62, fert:+0.75 },
  root:  { n:'根菜', col:'#4a7a38', ripe:'#e08a52', leafy:true, cold:true,
           d:'产量中等，冬天也能长', yield:7, rate:1.14, fert:-0.20 },
  herb:  { n:'药草', col:'#6f9a66', ripe:'#d8e8a8', leafy:true, med:true,
           d:'不产粮，收 3 份药草', yield:0, herb:3, rate:1.15, fert:-0.30 }
};
const CROP_KEYS = Object.keys(CROPS);
function cropDef(k){ return CROPS[k] || CROPS.wheat; }

/* 开荒：荒地 → 熟地。耗时按「一段石墙 51 分钟」对齐 ——
   一人一天（870 分钟）大概能开一亩地，「圈多大」因此成了真决策。 */
const TILL_DUR = 46;
/* 地形底子决定开荒后的地力。花甸最肥、沙地最薄，这条让地图本身有农业价值差 */
const FERT_BY_GROUND = {
  0:0.62,   // 草地
  1:0.30,   // 沙地
  2:0.52,   // 泥土
  5:0.82,   // 花甸
  6:0.38,   // 碎石滩
  7:0.74    // 湿地
};
function groundFert(g){
  const v = FERT_BY_GROUND[g];
  return typeof v === 'number' ? v : 0.5;
}

/* 难度：影响起始物资、袭击规模、敌方血量与目标的达成天数 */
const DIFFS = {
  calm:  { name:'温和', sub:'袭击更弱更少，起始物资更足', goal:12,
           resMul:1.4, raidMul:0.62, hpMul:0.78, tierAdd:-1,
           line:'适合先熟悉建造与生产链路' },
  std:   { name:'标准', sub:'按设计节奏推进，第 12 天收官', goal:12,
           resMul:1.0, raidMul:1.0, hpMul:1.0, tierAdd:0,
           line:'推荐体验，攻防压力大致对等' },
  harsh: { name:'严酷', sub:'袭击频繁且更硬，目标延长到第 16 天', goal:16,
           resMul:0.82, raidMul:1.05, hpMul:1.00, tierAdd:0,
           line:'物资紧张，必须尽早成墙' }
};
function diffDef(){ return DIFFS[state.diff] || DIFFS.std; }

/* 居民名字池 */
/* =====================================================================
   地图生成参数（v1.5）：默认值等于 v1.4 的硬编码，剧本只覆盖差异项
   ===================================================================== */
const MAP_DEF = {
  waterCut: 0.335, sandCut: 0.375, massCut: 0.625, forest: 0.52,
  lakes: [ { fx:0.72, fy:0.64, r:11.0, d:0.60, seed:0 },
           { fx:0.20, fy:0.28, r:6.0,  d:0.48, seed:37 } ],
  stream: true, ruins: 3, ring: null
};
let MP = { ...MAP_DEF };
function mapSet(over){
  MP = Object.assign({}, MAP_DEF, over || {});
  MP.lakes = ((over && over.lakes) || MAP_DEF.lakes).map(o=> ({ ...o }));
  MP.ring = (over && over.ring) || null;
}

/* =====================================================================
   剧本（v1.5）：改变开局规则，而不只是换一张地图
   res 为起始物资倍率 · tradeGap 为商队间隔天数 · winter 使作物停长
   ===================================================================== */
const SCEN = {
  valley: {
    name:'河谷', tag:'标准开局', short:'水源与林地都够用',
    line:'一条溪流从北面山脊下来，汇进东边的湖。水源、林地、石料都在半小时脚程内。',
    pop:3, map:{}, res:{}, tradeGap:4, nightP:0
  },
  cliff: {
    name:'断崖', tag:'三面岩壁，一条窄路', short:'石头多，木头少，靠炮不靠墙',
    line:'营地卡在断崖底下，背后是石壁，前面只有一条窄路。碎石遍地，木头得往深处走才有。',
    pop:3, map:{ massCut:0.575, forest:0.60, ring:{ r:12, gap:0.34 },
                 /* 南侧是唯一缺口，默认那口大湖正好压在缺口上会把路堵死，改成一潭西北小湖 */
                 lakes:[ { fx:0.18, fy:0.24, r:5.2, d:0.50, seed:37 } ] },
    res:{ wood:0.55, stone:1.7 }, tradeGap:5, nightP:-0.12, nightN:0.6
  },
  plague: {
    name:'疫区', tag:'五个人，两个带伤', short:'先救人还是先成墙',
    line:'从上游逃下来的五个人，两个身上带着化不开的伤口。湿地边有药草，但没人确定够不够。',
    pop:5, map:{ forest:0.50 }, res:{ food:0.7, herb:2.5 }, wound:2, tradeGap:4, nightP:0.06
  },
  road: {
    name:'商道', tag:'没有湖，全靠交换', short:'不产粮，靠商队过活',
    line:'这里没有水，只有一条被踩出来的商路。商人隔天就来一次，东西贵，但能救命。',
    pop:3, map:{ lakes:[], stream:false, waterCut:0.11, sandCut:0.30, forest:0.615, ruins:4 },
    res:{ wood:0.85, food:1.4, herb:1.6, stone:1.1 }, tradeGap:2, raidMul:0.86, nightP:-0.02
  },
  winter: {
    name:'冬临', tag:'作物不长，只能靠囤', short:'十天，粮食只出不进',
    line:'你到的时候已经下过第一场雪。地里什么都长不出来，只剩野果、林子和商人手里的粮。',
    pop:3, map:{ forest:0.44, waterCut:0.34 }, res:{ food:2.9, meal:1.8, wood:0.8 },
    tradeGap:3, winter:true, goalDelta:-2, nightP:0.10
  }
};
const SCEN_KEYS = ['valley','cliff','plague','road','winter'];
function scenDef(){ return SCEN[state.scen] || SCEN.valley; }
function isWinter(){ return !!scenDef().winter; }
function scenRaidMul(){ return scenDef().raidMul || 1; }

/* =====================================================================
   野心（v1.8）：一局只能选一张，它决定「为什么玩」
   ---------------------------------------------------------------
   1.7 之前每局的终点只有一个：活到第 N 天。于是第 3 天就知道该怎么
   打，剩下十几天是执行 —— 执行不叫玩，叫等。
   野心换掉终点，并且连压力曲线一起换：只改计分不改压力，等于换了块
   记分牌，玩法还是同一套。mod 里的数字直接进 onNewDay 的判定。
   ===================================================================== */
const AMB = {
  hold: {
    name:'守成', tag:'一个人都不能少', ico:'shield',
    line:'不扩张，不冒险。这几个人怎么来的，就怎么活到最后一天。',
    goal:'目标日零死亡',
    cost:'不招收新人，产能全靠自己熬',
    mod:{ raidMul:0.90, tradeMul:1.00, wanderMul:0.50, stoneMul:1.00, popCap:4, goalBonus:0 },
    stages(){
      const g = state.goalDay;
      return [
        { id:'foot', name:'立稳', day: Math.max(3, Math.round(g*0.34)),
          need:[ {k:'beds',n:3,t:'3 张床铺'}, {k:'stock',n:6,t:'6 格仓库区'}, {k:'food',n:12,t:'12 份口粮'} ] },
        { id:'holdfast', name:'固守', day: Math.max(6, Math.round(g*0.72)),
          need:[ {k:'walls',n:8,t:'8 段石墙'}, {k:'turret',n:1,t:'1 座哨戒炮'}, {k:'deaths',n:0,t:'零死亡',rev:true} ] },
        { id:'intact', name:'安然', day: g,
          need:[ {k:'deaths',n:0,t:'零死亡',rev:true}, {k:'alive',n:3,t:'3 人存活'} ] }
      ];
    }
  },
  fortify: {
    name:'筑城', tag:'把荒地围成堡垒', ico:'wall',
    line:'不求人丁兴旺，只要墙够高、炮够多。人死了墙还在。',
    goal:'目标日前建成 10 段石墙 + 2 座哨戒炮',
    cost:'石料吃紧，没空种地；墙修得越多，来的人越多',
    mod:{ raidMul:1.14, tradeMul:0.85, wanderMul:0.75, stoneMul:1.35, popCap:5, goalBonus:1 },
    stages(){
      const g = state.goalDay;
      return [
        { id:'quarry', name:'采石', day: Math.max(3, Math.round(g*0.34)),
          need:[ {k:'stone',n:60,t:'60 石料'}, {k:'stock',n:8,t:'8 格仓库区'} ] },
        { id:'enclose', name:'合围', day: Math.max(6, Math.round(g*0.72)),
          need:[ {k:'walls',n:8,t:'8 段石墙'}, {k:'turret',n:1,t:'1 座哨戒炮'}, {k:'shop',n:1,t:'1 座工坊'} ] },
        { id:'citadel', name:'城成', day: g,
          need:[ {k:'walls',n:10,t:'10 段石墙'}, {k:'turret',n:2,t:'2 座哨戒炮'} ] }
      ];
    }
  },
  raid: {
    name:'远征', tag:'打到他们家门口', ico:'sword',
    line:'等着挨打，不如先动手。三个匪巢，一个都别留。',
    goal:'摧毁 3 处匪巢',
    cost:'出兵就要抽走守家的人；匪巢守卫比掠袭者硬',
    mod:{ raidMul:0.80, tradeMul:0.90, wanderMul:1.45, stoneMul:1.00, popCap:8, goalBonus:5 },
    stages(){
      const g = state.goalDay;
      return [
        { id:'scout', name:'侦察', day: Math.max(3, Math.round(g*0.34)),
          need:[ {k:'shop',n:1,t:'1 座工坊'}, {k:'tech',n:1,t:'1 项研究'} ] },
        { id:'strike', name:'出击', day: Math.max(6, Math.round(g*0.72)),
          need:[ {k:'dens',n:1,t:'摧毁 1 处匪巢'}, {k:'walls',n:8,t:'8 段石墙'} ] },
        { id:'sweep', name:'扫荡', day: g,
          need:[ {k:'dens',n:3,t:'摧毁 3 处匪巢'} ] }
      ];
    }
  },
  trade: {
    name:'富商', tag:'钱比墙管用', ico:'coin',
    line:'不屯粮，不筑墙，只做买卖。货在路上，钱在账上。',
    goal:'成交 6 笔 · 换回 200 资源',
    cost:'商队来得勤，匪也来得勤；囤货要占仓库',
    mod:{ raidMul:1.08, tradeMul:2.20, wanderMul:0.90, stoneMul:0.90, popCap:6, goalBonus:2 },
    stages(){
      const g = state.goalDay;
      return [
        { id:'stall', name:'开市', day: Math.max(3, Math.round(g*0.34)),
          need:[ {k:'stock',n:10,t:'10 格仓库区'}, {k:'trades',n:1,t:'成交 1 笔'} ] },
        { id:'caravan', name:'走货', day: Math.max(6, Math.round(g*0.72)),
          need:[ {k:'trades',n:3,t:'成交 3 笔'}, {k:'wealth',n:100,t:'换回 100 资源'} ] },
        { id:'house', name:'立号', day: g,
          need:[ {k:'trades',n:6,t:'成交 6 笔'}, {k:'wealth',n:200,t:'换回 200 资源'} ] }
      ];
    }
  },
  shelter: {
    name:'救人', tag:'来者不拒', ico:'heart',
    line:'这条路上每一个逃难的人都算数。人多嘴多，但人多也有人多的活法。',
    goal:'目标日人口 ≥ 9',
    cost:'人口一多，口粮和袭击规模一起涨',
    mod:{ raidMul:1.16, tradeMul:1.00, wanderMul:2.40, stoneMul:1.00, popCap:12, goalBonus:3 },
    stages(){
      const g = state.goalDay;
      return [
        { id:'take', name:'收容', day: Math.max(3, Math.round(g*0.34)),
          need:[ {k:'beds',n:5,t:'5 张床铺'}, {k:'food',n:16,t:'16 份口粮'} ] },
        { id:'feed', name:'温饱', day: Math.max(6, Math.round(g*0.72)),
          need:[ {k:'alive',n:7,t:'7 人存活'}, {k:'beds',n:7,t:'7 张床铺'} ] },
        { id:'home', name:'安家', day: g,
          need:[ {k:'alive',n:9,t:'9 人存活'}, {k:'deaths',n:3,t:'死亡不超过 3',rev:true} ] }
      ];
    }
  }
};
const AMB_KEYS = ['hold','fortify','raid','trade','shelter'];
function ambDef(){ return AMB[state.amb] || AMB.hold; }
function ambMod(){ return ambDef().mod || {}; }
/* 野心对某类修正的取值，缺省 1 */
function ambMul(k){ const v = ambMod()[k]; return typeof v === 'number' ? v : 1; }

/* =====================================================================
   危机（v2.0）
   ---------------------------------------------------------------
   1.9 之前中局没有「必须现在处理」的事：阶段目标只计数，早三天晚三天
   都一样，于是第 3 天之后玩家只是在等袭击。
   危机给这两天一个读秒：凑得出东西就过，凑不出就在截止日砸下来。
   三种应对（凑 / 认栽 / 硬扛）都是选择 —— 这就是中局缺的那味。
   认栽要付一点代价，但比被砸轻：主动放弃不丢人，这是设计意图。
   ===================================================================== */
const CRISES = [
  {
    id:'flood', name:'河水上涨', due:0.35,
    line:'上游连日暴雨。到那天河水会漫上岸，营边的散料全得泡汤。',
    need:{ what:'石料', k:'stone', n:20 },
    ok:'堤坝垒起来了，水从营外绕过去。',
    bad:'水漫进营地，冲走了不少木材，人也全被浇了一遍。',
    fail(){ const w = removeItemAnywhere('wood', 34, W/2, H/2);
            for(const c of state.cols) c.needs.mood = Math.max(0, c.needs.mood - 9);
            return w ? `冲走 ${w} 木材` : '只剩一地泥'; }
  },
  {
    id:'cold', name:'寒潮', due:0.78,
    line:'北边来的冷风会连着刮三天。柴火不够，人就只能硬扛。',
    need:{ what:'木材', k:'wood', n:28 },
    ok:'柴堆得够高，火一夜没灭。',
    bad:'夜里太冷，好几个人咳得停不下来。',
    fail(){ for(const c of state.cols){ c.sick = Math.max(c.sick || 0, 260 + rint(0,180));
              c.needs.mood = Math.max(0, c.needs.mood - 8); }
            return '全员染上风寒'; }
  },
  {
    id:'fever', name:'伤口化脓', due:0.42,
    line:'有人身上的口子一直没合上。再拖下去，味道就不对了。',
    need:{ what:'药草', k:'herb', n:3 },
    ok:'伤口清干净了，人也睡了个整觉。',
    bad:'伤口烂到了骨头，有人整宿在哼。',
    fail(){ const cand = state.cols.filter(c=> !c.dead && !c.down);
            if(!cand.length) return '无人可救';
            const c0 = cand.sort((a,b)=> (b.wound||0) - (a.wound||0))[0];
            c0.wound = (c0.wound || 0) + 40;
            c0.needs.mood = Math.max(0, c0.needs.mood - 14);
            return `${c0.name} 的伤口恶化了`; }
  },
  {
    id:'wolf', name:'狼群盘桓', due:0.68,
    line:'林子里有东西跟了好几天了。围子不成形，它们就会摸进来。',
    need:{ what:'石墙', k:'wall', n:6, mode:'bld' },
    ok:'围子合上了口，林子那边安静下来。',
    bad:'狼从缺口摸了进来，咬伤了好几个人。',
    fail(){ spawnRaid(3, 1, { weak:true }); return '狼群闯了进来'; }
  },
  {
    id:'debt', name:'旧账', due:0.60,
    line:'有人记得你们欠过他一笔。他说到期不还，就自己来拿。',
    need:{ what:'餐食', k:'meal', n:12 },
    ok:'东西交出去了，对方点点头走了。',
    bad:'他们没见到东西，掂了掂手里的家伙。',
    fail(){ spawnRaid(2, 1); return '讨账的人动手了'; }
  }
];
function crisisDef(id){ return CRISES.find(c=> c.id === id); }

/* 危机需求进度：'stock' 看库存账目，'bld' 看已建成数量。
   注意 state.crises 里存的是 {id,dueDay,seen,state}，需求要去 CRISES 表里查 ——
   早先这里直接读 cr.need，结果永远是 undefined，判定永远不通过。 */
function crisisCur(cr){
  const def = crisisDef(cr && cr.id);
  if(!def || !def.need) return 0;
  if(def.need.mode === 'bld') return countBuilt(def.need.k);
  return Math.round(state.res[def.need.k] || 0);
}
function crisisDone(cr){
  const def = crisisDef(cr && cr.id);
  return !!def && crisisCur(cr) >= def.need.n;
}


/* =====================================================================
   守夜（v1.6）
   夜晚原本是纯恢复时段：21:30 全员入睡、05:30 起床，八小时内没有任何威胁，
   也就没有任何决策。这一版把夜晚变成「每夜一次的赌注」：
     · 23:30 有可能被摸上来，规模约为白天袭击的六成，但发生在人最困的时候
     · 玩家每晚指派 0~4 人守夜，守夜者不睡、次日效率打折
     · 睡着被偷袭的居民吃 1.55 倍伤害 —— 守夜的收益就来自这一条
     · 篝火不是装饰：每座让夜袭概率与规模各降一档
   ===================================================================== */
function isNightHour(){
  const h = (state.min % 1440) / 60;
  return h >= 21.5 || h < 5.5;
}

/* 可指派上限：活人数量，最多 4 人 */
function watchCap(){
  return Math.min(4, state.cols.filter(c=> !c.down && !c.dead).length);
}

/* 今夜被摸上来的概率：UI 直接显示，不藏骰子 —— 赌博要看得见赔率才有意思 */
function nightRisk(){
  if(state.day < 3) return 0;
  /* 白天刚打过仗的当夜不会再来：一天两波只会让人疲惫，不会让人紧张 */
  if(isRaidDay(state.day)) return 0;
  let p = 0.14 + (state.day - 3) * 0.022;
  p += scenDef().nightP || 0;
  p -= Math.min(0.24, countBuilt('fire') * 0.08);   // 火光让人不敢靠近
  return clamp(p, 0, 0.75);
}

/* 夜袭规模：按白天同日的六成折算，篝火再压 */
function nightSize(){
  const raw = 1 + Math.floor(state.day/3) + Math.floor(state.cols.length/3);
  /* 崖壁只容一人一列通过：断崖的夜袭规模另乘一档 */
  const s = raw * 0.42 * diffDef().raidMul * scenRaidMul() * (scenDef().nightN || 1);
  return clamp(Math.round(s * (1 - Math.min(0.36, countBuilt('fire') * 0.15))), 1, 8);
}

/* 「守夜轮值」科技：每夜 1 个不产生疲劳的名额 */
function watchFree(){ return hasTech('watch') ? 1 : 0; }

/* 雪季覆盖色：压在地形基色之上，保留起伏但整体入冬 */
const PAL_SNOW = {
  [T.GRASS ]: '#c7d1c7', [T.MEADOW]: '#d2d9cd', [T.SAND]: '#dcd8cc',
  [T.DIRT  ]: '#cfc8ba', [T.GRAVEL]: '#c1c5c4', [T.MARSH]: '#b5c0b7',
  [T.ROCK  ]: '#6b7380'
};

/* =====================================================================
   三阶段目标（v1.5）：把「撑过 N 天」拆成三段可验证的节点
   ===================================================================== */
function stageDefs(){
  /* v1.8：三阶段由野心定义 —— 「筑城」局的第一关是采石，不是铺床。
     同一套阶段模板会让五张野心玩起来还是同一条线。 */
  const d = ambDef();
  if(typeof d.stages === 'function') return d.stages();
  return [
    { id:'foot', name:'立稳', day: Math.max(3, Math.round(state.goalDay*0.34)),
      need:[ { k:'beds', n:3, t:'3 张床铺' }, { k:'stock', n:6, t:'6 格仓库区' }, { k:'food', n:12, t:'12 份口粮' } ] },
    { id:'grow', name:'扩张', day: Math.max(6, Math.round(state.goalDay*0.72)),
      need:[ { k:'walls', n:10, t:'10 段石墙' }, { k:'turret', n:1, t:'1 座哨戒炮' }, { k:'tech', n:1, t:'1 项研究' } ] },
    { id:'stand', name:'决战', day: state.goalDay,
      need:[ { k:'alive', n:3, t:'3 人存活' }, { k:'kills', n:8, t:'累计击杀 8' } ] }
  ];
}
function countBuilt(type){
  let n = 0;
  for(const t of tiles) if(t.bld && t.bld.type === type && t.bld.prog >= 1) n++;
  return n;
}
function stageValue(k){
  switch(k){
    case 'beds':   return countBuilt('bed');
    case 'stock':  return tiles.filter(t=> t.zone === 'stock').length;
    case 'food':   return Math.round((state.res.food || 0) + (state.res.meal || 0)*3);
    case 'walls':  return countBuilt('wall');
    case 'turret': return countBuilt('turret');
    case 'shop':   return countBuilt('shop');
    case 'tech':   return Object.keys(state.tech.done).length;
    case 'alive':  return state.cols.filter(c=> !c.down && !c.dead).length;
    case 'kills':  return state.stats.kills || 0;
    case 'stone':  return Math.round(state.res.stone || 0);
    /* v1.8 野心专用计数 */
    case 'deaths': return state.stats.deaths || 0;
    case 'dens':   return state.stats.dens || 0;
    case 'trades': return state.stats.trades || 0;
    case 'wealth': return Math.round(state.stats.wealth || 0);
  }
  return 0;
}
/* 目标项判定：多数是「至少 N」，少数是「不超过 N」（零死亡这类） */
function needOK(n){
  const v = stageValue(n.k);
  return n.rev ? v <= n.n : v >= n.n;
}
/* 进度显示用：当前值 / 目标值 */
function needBar(n){
  const v = stageValue(n.k);
  const pct = n.rev
    ? (n.n <= 0 ? (v <= 0 ? 1 : 0) : clamp(1 - (v - n.n) / Math.max(1, n.n), 0, 1))
    : clamp(v / Math.max(1, n.n), 0, 1);
  return { v, pct, ok: needOK(n) };
}
function curStage(){ return stageDefs()[state.stage.idx] || null; }
/* 阶段结算：force=true 时把剩余阶段一并判定（终局用） */
function settleStages(force){
  while(state.stage.idx < 3){
    const st = stageDefs()[state.stage.idx];
    if(!force && state.day <= st.day) break;
    const ok = st.need.every(needOK);
    if(ok){
      state.stage.done.push(st.id);
      state.res.wood += 18; state.res.stone += 10; state.res.food += 4;
      for(const c of state.cols) c.needs.mood = clamp((c.needs.mood||0) + 5, 0, 100);
      logEvent(`<b>${st.name}</b> 阶段达成 —— 补给送到，全营士气一振。`, 'good');
      showAlert(`${st.name} · 阶段达成`, false);
      SFX.done();
    } else {
      state.stage.failed.push(st.id);
      const miss = st.need.filter(n=> !needOK(n))
        .map(n=> `${n.t}（现 ${stageValue(n.k)}）`).join('、');
      logEvent(`<b>${st.name}</b> 阶段没达标 —— 缺 ${miss}。结算会扣分。`, 'warn');
    }
    state.stage.idx++;
    uiDirty.side = true;
  }
}

/* =====================================================================
   终局评分（v1.8）：阶段 30 · 野心 25 · 人口 18 · 科技 10 · 战斗 9 · 士气 8
   ---------------------------------------------------------------
   野心单独占一栏，是因为它已经不只是「一句话目标」：它换掉了三阶段
   内容、压力曲线和胜利条件。计分表不跟着换，玩家就感觉不到自己打的
   是另一种局。
   ===================================================================== */
function ambProgress(){
  const st = stageDefs()[2];
  if(!st || !st.need || !st.need.length) return 0;
  const arr = st.need.map(n=> needBar(n).pct);
  return arr.reduce((a,b)=> a + b, 0) / arr.length;
}
/* 野心终局是否达成 —— 这就是「赢」的新定义 */
function ambAchieved(){
  const st = stageDefs()[2];
  if(!st) return true;
  return st.need.every(needOK);
}
function finalGrade(){
  const passed = state.stage.done.length;
  const alive = state.cols.filter(c=> !c.down && !c.dead).length;
  const popPct = state.totalPop ? clamp(alive / state.totalPop, 0, 1) : 0;
  const techN = Object.keys(state.tech.done).length;
  const raidN = Math.max(1, state.stats.raids || 1);
  const killPct = clamp((state.stats.kills || 0) / (raidN * 0.55), 0, 1);
  const mood = clamp(avgMood() / 100, 0, 1);
  const ambP = clamp(ambProgress(), 0, 1);
  const parts = [
    { k:'阶段', v: Math.round((passed/3)*30),        max:30 },
    { k:'野心', v: Math.round(ambP*25),              max:25, amb:true },
    { k:'人口', v: Math.round(popPct*18),            max:18 },
    { k:'科技', v: Math.round(clamp(techN/3,0,1)*10),max:10 },
    { k:'战斗', v: Math.round(killPct*9),            max:9 },
    { k:'士气', v: Math.round(mood*8),               max:8 }
  ];
  const sc = parts.reduce((a,p)=> a + p.v, 0);
  /* 全灭不看分数：再漂亮的阶段进度，人都没了就是 D */
  const grade = state.over === 'lose' ? 'D' : (sc >= 85 ? 'S' : sc >= 70 ? 'A' : sc >= 55 ? 'B' : 'C');
  return { sc, grade, parts, alive, passed, techN, popPct, ambP };
}

const NAMES = ['陈默','林岚','老周','阿吉','白鹭','石头','许一','南星','铁牛','苏禾',
               '孟川','小满','郑禾','柳青','大康','沈砚','阿竹','蔡引','温岭','重阳'];
const SKINS = ['#e8b98f','#d9a273','#c98d5f','#efc9a5','#b87f52'];
const SHIRTS= ['#4f7fd4','#c26a4a','#5a9e6f','#8a63b8','#c9a03f','#3f8f9e','#b85a7a'];

/* 游戏状态 */
let tiles = [];
const state = {
  min: 360,                    // 游戏内分钟（第1天 06:00）
  day: 1,
  res: { wood:120, stone:60, food:16, meal:6, herb:0 },
  cols: [], raiders: [], fx: [], decals: [],
  speed: 1, paused: false,
  slow: 1,                     // 战术慢放（v1.9）：接敌时压到 0.5×，脱战自动恢复
  sel: null,                   // 选中对象 {kind:'col'|'tile', ...}
  build: null,                 // 当前建造 {type} 或 {zone}，也可能是 {kind:'rally'}
  drag: null,
  log: [],
  weather: '晴',
  rain: 0,
  over: null,                  // 'win' | 'lose'
  goalDay: 12,
  diff: 'std',
  endless: false,
  stats: { wood:0, stone:0, kills:0, built:0, raids:0, deaths:0, dens:0, trades:0, wealth:0 },
  tech: { done:{}, cur:null, prog:0 },   // 研究进度
  cmd: null,                   // 全体指令 {kind:'focus'|'rally'|'retreat', ...}
  scen: 'valley',              // 剧本（v1.5）
  amb: 'hold',                 // 野心（v1.8）
  stage: { idx:0, done:[], failed:[] },  // 三阶段目标
  pending: [],                 // 延迟后果 {key, opt, due, note}
  usedChoices: [],             // 本局已经出现过的抉择
  totalPop: 3,                 // 累计加入过的人口（评分用）
  skipRaid: 0,                 // 用粮食买通的袭击次数
  watch: 1,                    // 今夜守夜人数（v1.6）
  watchSet: false,             // 今晚是否已排班
  nightRaid: null,             // 今夜是否会被摸上来 {n, tier, fired}
  nightTimes: 0,               // 本局夜袭次数
  nightRepel: 0,               // 守夜期间挡下的夜袭次数
  seq: 1
};
let cam = { cx: W*TS/2, cy: H*TS/2, z: 1 };

/* =====================================================================
   3 · 地图生成
   ===================================================================== */
function idx(x,y){ return y*W+x; }
function tileAt(x,y){
  if(x<0||y<0||x>=W||y>=H) return null;
  return tiles[y*W+x];
}

/* ---- 地类抗噪：孤立单格向多数邻居靠拢，地貌成片 ---- */
function smoothTerrain(passes){
  const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for(let pass=0; pass<passes; pass++){
    const next = new Uint8Array(W*H);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const t = tiles[y*W+x];
      const g = t.g;
      if(g === T.WATER || g === T.ROCK){ next[y*W+x] = g; continue; }
      const cnt = {};
      let same = 0, best = g, bc = 0;
      for(const [dx,dy] of NB){
        const q = tileAt(x+dx, y+dy);
        if(!q) continue;
        if(q.g === g) same++;
        else if(q.g !== T.WATER && q.g !== T.ROCK){
          cnt[q.g] = (cnt[q.g] || 0) + 1;
          if(cnt[q.g] > bc){ bc = cnt[q.g]; best = q.g; }
        }
      }
      next[y*W+x] = (same <= 1 && bc >= 3) ? best : g;
    }
    for(let i=0;i<W*H;i++) tiles[i].g = next[i];
  }
}

/* ---- 湖盆：噪声扰动半径，得到自然岸线 ---- */
function basin(x,y,bx,by,r,n,off){
  const o = off || 0;
  /* 椭圆化 + 两个尺度的半径扰动：湖盆不再是一个规整的圆 */
  const d = Math.hypot((x-bx)*1.00, (y-by)*1.16);
  const w1 = (n(x/7.5 + o, y/7.5 + o) - 0.5) * 0.40;
  const w2 = (n(x/2.7 + o*3.1, y/2.7 + o*2.3) - 0.5) * 0.18;
  const rr = r * (1 + w1 + w2);
  return smoothstep(rr, rr*0.30, d);
}

/* ---- 水域深度（从岸边向内 BFS）与岸线标记 ---- */
function markWater(){
  const N4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const q = [];
  for(const t of tiles){
    t.shore = false;
    t.depth = t.g === T.WATER ? 99 : 0;
  }
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.g !== T.WATER) continue;
    let land = false;
    for(const [dx,dy] of N4){
      const n = tileAt(x+dx, y+dy);
      if(n && n.g !== T.WATER) land = true;
    }
    if(land){ t.depth = 1; t.shore = true; q.push(y*W+x); }
  }
  for(let qi=0; qi<q.length; qi++){
    const i = q[qi], x = i % W, y = (i/W)|0;
    for(const [dx,dy] of N4){
      const nx = x+dx, ny = y+dy;
      if(nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni = ny*W+nx, t = tiles[ni];
      if(t.g !== T.WATER || t.depth <= tiles[i].depth + 1) continue;
      t.depth = tiles[i].depth + 1;
      q.push(ni);
    }
  }
  for(const t of tiles) if(t.g === T.WATER) t.depth = clamp(t.depth/8, 0, 1);
  /* 平滑深度场：去掉整数 BFS 造成的台阶，水面才有连续渐变 */
  for(let pass=0; pass<2; pass++){
    const tmp = new Float32Array(W*H);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i = y*W+x, t = tiles[i];
      if(t.g !== T.WATER){ tmp[i] = t.depth; continue; }
      let s = t.depth*4, n = 4;
      for(const [dx,dy] of N4){
        const q = tileAt(x+dx, y+dy);
        if(q){ s += q.g === T.WATER ? q.depth : 0; n++; }
      }
      tmp[i] = s/n;
    }
    for(let i=0;i<W*H;i++) if(tiles[i].g === T.WATER) tiles[i].depth = tmp[i];
  }
}

function pickTreeSpecies(t){
  if(rnd() < 0.10) return 'dead';
  if(t.h > 0.60 || t.m < 0.42) return rnd() < 0.72 ? 'pine' : 'oak';
  if(t.m > 0.62) return rnd() < 0.45 ? 'birch' : 'oak';
  return rnd() < 0.55 ? 'oak' : 'pine';
}

/* ---- 荒野遗迹：地图上的探索奖励点 ---- */
function placeRuins(n, count){
  const loot = [['wood',42],['stone',30],['food',10]];
  let placed = 0, guard = 0;
  while(placed < count && guard++ < 600){
    const x = rint(4, W-5), y = rint(4, H-5);
    const t = tileAt(x,y);
    if(!t || t.plant || t.deco || !passable(x,y)) continue;
    if(dist(x,y,W>>1,H>>1) < 13) continue;
    if(t.g === T.MARSH) continue;
    t.deco = 'ruin';
    const l = loot[placed % loot.length];
    addItems(x, y, l[0], l[1]);
    if(placed === 0) addItems(x, y, 'meal', 4);
    placed++;
  }
}

function genMap(seed){
  RNG = mulberry32(seed);
  const nE = makeNoise(seed+1), nR = makeNoise(seed+2), nP = makeNoise(seed+3),
        nM = makeNoise(seed+4), nD = makeNoise(seed+5), nB = makeNoise(seed+6);
  const cx = W>>1, cy = H>>1;
  tiles = new Array(W*H);
  const elev = new Float32Array(W*H), moist = new Float32Array(W*H);

  /* ---- 1. 高程场：域扭曲 fbm + 两处湖盆 ---- */
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const wx = x + (nD(x/15, y/15) - 0.5) * 10;
    const wy = y + (nD(x/15+41, y/15+23) - 0.5) * 10;
    let e = fbm(nE, wx/17, wy/17, 4, 0.52);
    e = e * 0.80 + 0.11 + (0.5 - Math.abs(x/W - 0.5)) * 0.06;

    for(const lk of MP.lakes)
      e -= basin(x, y, W*lk.fx, H*lk.fy, lk.r, nB, lk.seed) * lk.d;
    e += smoothstep(13, 3, dist(x,y,cx,cy)) * 0.10;   // 营地抬升

    elev[y*W+x]  = clamp(e, 0, 1);
    moist[y*W+x] = clamp(fbm(nM, x/14+9, y/14+5, 3, 0.55) * 1.06 - 0.03, 0, 1);
  }

  /* ---- 1.5 溪流：从北缘高地蜿蜒汇入大湖，途中留两处浅滩保证通行 ---- */
  if(MP.stream && MP.lakes.length){
    const lakeX = W*MP.lakes[0].fx, lakeY = H*MP.lakes[0].fy;
    const x0 = rint(5, W-6);
    const N = 130, pts = [];
    for(let i=0;i<=N;i++){
      const t = i/N;
      const bx = x0*(1-t) + lakeX*t;
      const by = -1*(1-t) + lakeY*t;
      const wob = Math.sin(t*7.2 + x0*0.7)*1.7 + (nD(bx/8+3, by/8+11)-0.5)*5.2;
      pts.push({ x: bx + wob, y: by, t });
    }
    const fords = [0.33, 0.64];
    for(const pt of pts){
      let ford = false;
      for(const ft of fords) if(Math.abs(pt.t - ft) < 0.032) ford = true;
      for(let y=Math.floor(pt.y-3); y<=Math.ceil(pt.y+3); y++){
        for(let x=Math.floor(pt.x-3); x<=Math.ceil(pt.x+3); x++){
          if(x<1||y<1||x>=W-1||y>=H-1) continue;
          const d = Math.hypot(x+0.5-pt.x, y+0.5-pt.y);
          const rad = 1.10 + nD(x/2.6+9, y/2.6+4)*0.72;
          if(d > rad) continue;
          const idx = y*W + x;
          const target = ford ? 0.398 : (0.300 + (d/rad)*0.030);
          if(target < elev[idx]) elev[idx] = target;
        }
      }
    }
  }

  /* ---- 2. 地貌分类 ---- */
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const e = elev[y*W+x], m = moist[y*W+x];
    let g;
    const wc = MP.waterCut;
    if(e < wc) g = T.WATER;
    else if(e < wc + 0.040) g = m > 0.54 ? T.MARSH : T.SAND;
    else if(e < MP.sandCut + 0.050) g = T.SAND;
    else if(e < 0.660){
      g = (m > 0.60 && nP(x/7+3, y/7+11) > 0.52) ? T.MEADOW : T.GRASS;
      if(g === T.GRASS && m < 0.33 && fbm(nP, x/6+31, y/6+17, 2) > 0.63) g = T.DIRT;
    }
    else if(e < 0.700) g = T.GRAVEL;
    else g = T.ROCK;

    /* 山体：低频噪声形成 2~3 片成规模的山，山脚是碎石 */
    const mass = fbm(nR, x/12 + 51, y/12 + 29, 3, 0.5);
    if(mass > MP.massCut && g !== T.WATER) g = T.ROCK;
    else if(g !== T.ROCK && mass > MP.massCut - 0.040 && e > 0.44) g = T.GRAVEL;

    /* 岩脊：细长露头，增加地貌层次 */
    const ridge = Math.abs(fbm(nR, x/21+13, y/21+7, 3, 0.55) - 0.5);
    if(e > 0.54 && ridge < 0.030 && nR(x/4, y/4) > 0.45) g = T.ROCK;

    /* 出生地保护（PRD FR-5.1.4） */
    const dc = dist(x,y,cx,cy);
    if(dc < 8.5 && (g === T.ROCK || g === T.WATER || g === T.MARSH)) g = T.GRASS;
    if(dc < 6.0 && g === T.SAND) g = T.GRASS;

    tiles[y*W+x] = { g, h:elev[y*W+x], m:moist[y*W+x], depth:0, shore:false,
                     plant:null, bld:null, zone:null, items:null, deco:null,
                     soil:null, fert:0 };
  }

  /* ---- 3. 地类抗噪：抹掉孤立单格，避免"马赛克撒点" ---- */
  smoothTerrain(2);

  /* ---- 3.5 环崖（剧本「断崖」）：营地被岩壁围住，只留一个方向进出 ---- */
  if(MP.ring){
    const { r, gap } = MP.ring;
    const dir = MP.ring.dir === undefined ? Math.PI/2 : MP.ring.dir;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const d = dist(x+0.5, y+0.5, cx+0.5, cy+0.5);
      if(d < r-1.3 || d > r+1.5) continue;
      const a = Math.atan2(y+0.5-cy-0.5, x+0.5-cx-0.5);
      let da = Math.abs(((a - dir + Math.PI*3) % (Math.PI*2)) - Math.PI);
      const t = tiles[y*W+x];
      if(da < gap){
        /* 缺口必须是能走的路：随机地形若在此处落水/落沼，居民就被彻底关在崖里，
           袭击者也无处可刷（实测会出现整局零袭击）。所以缺口一律夯成硬土。 */
        if(t.g === T.WATER || t.g === T.MARSH || t.g === T.ROCK){ t.g = T.DIRT; }
        t.plant = null; t.deco = null;
        continue;
      }
      t.g = T.ROCK; t.plant = null; t.deco = null;
    }
  }

  /* ---- 4. 水域景深与岸线 ---- */
  markWater();

  /* ---- 4. 植被 / 地表点缀 ---- */
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(!IS_VEG[t.g]) continue;
    if(dist(x,y,cx,cy) < 5.4) continue;
    const forest = fbm(nP, x/13+7, y/13+2, 3, 0.55);
    const dens = clamp((forest - MP.forest)*5.2 + t.m*0.22, 0, 1);
    if(t.g !== T.MARSH && dens > 0.20 && rnd() < dens*0.96){
      t.plant = { kind:'tree', grow: 0.62 + rnd()*0.38, sway: rnd()*TAU, sp: pickTreeSpecies(t) };
    } else if(dens > 0.05 && dens <= 0.30 && rnd() < 0.20){
      t.plant = { kind:'bush', grow: 0.7 + rnd()*0.3, berries: rint(2,5), sway: rnd()*TAU };
    } else if((t.g === T.MEADOW || t.g === T.MARSH || t.g === T.GRASS) && rnd() < 0.062){
      /* 药草丛（v1.3）：医疗的唯一原料，长在阴湿处 */
      t.plant = { kind:'herb', grow: 0.7 + rnd()*0.3, sway: rnd()*TAU, ready: true, regrow: 0 };
    } else if(t.g === T.MARSH && rnd() < 0.48){
      t.deco = 'reed';
    } else if(t.g === T.MEADOW && rnd() < 0.55){
      t.deco = 'flower';
    } else if(t.g === T.GRAVEL && rnd() < 0.35){
      t.deco = 'stone';
    } else if(t.g === T.DIRT && rnd() < 0.16){
      t.deco = 'pebble';
    } else if(t.g === T.GRASS && rnd() < 0.12){
      t.deco = 'tuft';
    }
  }

  /* ---- 4.5 出生区连通性修复（v1.8.1） ---- */
  if(!window.__noCarve) openStartArea();

  /* ---- 5. 荒野遗迹（v1.1 新增：探索奖励） ---- */
  placeRuins(nB, MP.ruins);

  /* ---- 6. 起始散落物资（PRD FR-5.1.6） ---- */
  const spots = [];
  for(let i=0;i<60 && spots.length<2;i++){
    const x = cx + rint(-3,3), y = cy + rint(-3,3);
    if(passable(x,y)) spots.push({x,y});
  }
  if(spots[0]) addItems(spots[0].x, spots[0].y, 'wood', 60);
  if(spots[1]) addItems(spots[1].x, spots[1].y, 'food', 10);

  computeReach();
  bakeTerrain();
}

/* 出生区连通性修复（v1.8.1）
   ---------------------------------------------------------------
   森林噪声是低频的，偶尔会沿着营地外围连成一整圈 —— 玩家被关在一块两百多
   格的洼地里：果树、矿脉、遗迹、匪巢全在外面，整局就在这块草地打转。
   实测 seed 9 的可达区只有 241 格，连三个匪巢都放不下。
   低于阈值就朝八个方向各凿一条走廊（树推掉、水变浅滩、岩变碎石）。
   「断崖」剧本的环崖是有意为之，跳过。 */
function openStartArea(){
  if(MP.ring) return;
  const cx = W>>1, cy = H>>1;
  const count = r=> { let n=0; for(let i=0;i<r.length;i++) if(r[i]) n++; return n; };
  const MIN = 1200;
  if(count(computeReach()) >= MIN) return;

  let carved = false;
  for(const [dx,dy] of N8){
    for(let step=4; step<34; step++){
      /* 三格宽：单格走廊会立刻被两侧树冠的判定吃掉 */
      for(const w of [-1,0,1]){
        const x = Math.round(cx + dx*step - dy*w);
        const y = Math.round(cy + dy*step + dx*w);
        if(x<1 || y<1 || x>=W-1 || y>=H-1) continue;
        const t = tiles[y*W+x];
        if(!t || t.bld) continue;
        if(t.plant && t.plant.kind === 'tree'){ t.plant = null; carved = true; }
        if(t.g === T.WATER){ t.g = T.SAND; carved = true; }
        else if(t.g === T.ROCK){ t.g = T.GRAVEL; carved = true; }
        else if(t.g === T.MARSH){ t.g = T.GRASS; carved = true; }
      }
    }
    if(count(computeReach()) >= MIN) break;
  }
  /* 地形改过：水面景深和烘焙都要重来，否则浅滩还是按水画 */
  if(carved) markWater();
}

/* 从殖民地中心洪水填充，标记真正连通的格子（避免袭击者刷在封闭死角） */
function computeReach(){
  const r = new Uint8Array(W*H);
  const start = (H>>1)*W + (W>>1);
  const q = [start];
  r[start] = 1;
  while(q.length){
    const n = q.pop();
    const x = n % W, y = (n/W)|0;
    for(const [dx,dy] of N8){
      const nx = x+dx, ny = y+dy;
      if(nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni = ny*W+nx;
      if(r[ni] || !passable(nx,ny)) continue;
      if(dx && dy && (!passable(x+dx,y) || !passable(x,y+dy))) continue;
      r[ni] = 1; q.push(ni);
    }
  }
  state.reach = r;
  return r;
}

/* =====================================================================
   4 · 通行与物品
   ===================================================================== */
function passable(x,y){
  if(x<0||y<0||x>=W||y>=H) return false;
  const t = tiles[y*W+x];
  if(t.g === T.WATER || t.g === T.ROCK) return false;
  if(t.bld && BL[t.bld.type].solid) return false;
  if(t.plant && t.plant.kind === 'tree') return false;
  return true;
}
function walkCost(x,y){
  const t = tiles[y*W+x];
  if(t.zone === 'farm') return 1.45;
  if(t.g === T.MARSH) return 1.7;
  if(t.g === T.GRAVEL) return 1.12;
  if(t.bld && t.bld.type === 'door') return 1.2;
  return 1;
}
function addItems(x,y,kind,qty){
  const t = tiles[y*W+x];
  if(!t) return;
  if(!t.items) t.items = [];
  const s = t.items.find(i=> i.kind === kind);
  if(s) s.qty += qty; else t.items.push({ kind, qty });
  if(t.zone === 'stock') state.res[kind] = (state.res[kind]||0) + qty;
}
function takeItems(x,y,kind,qty){
  const t = tiles[y*W+x];
  if(!t || !t.items) return 0;
  const s = t.items.find(i=> i.kind === kind);
  if(!s) return 0;
  const g = Math.min(s.qty, qty);
  s.qty -= g;
  if(s.qty <= 0) t.items.splice(t.items.indexOf(s),1);
  if(!t.items.length) t.items = null;
  if(t.zone === 'stock') state.res[kind] = Math.max(0, (state.res[kind]||0) - g);
  return g;
}
/* 只从仓库区扣除（v2.0）：危机收的「过路费」要动账目上的数，
   否则会出现「东西交出去了，账上还是那么多」的错觉 */
function takeStock(kind, qty){
  let left = qty;
  for(let i=0;i<tiles.length && left>0;i++){
    const t = tiles[i];
    if(t.zone !== 'stock' || !t.items) continue;
    const s = t.items.find(it=> it.kind === kind);
    if(!s) continue;
    const g = Math.min(s.qty, left);
    s.qty -= g; left -= g;
    if(s.qty <= 0) t.items.splice(t.items.indexOf(s),1);
    if(!t.items.length) t.items = null;
    state.res[kind] = Math.max(0, (state.res[kind]||0) - g);
  }
  return qty - left;
}
/* 仓库账目：state.res 只统计「已归入仓库区」的物资 */
function recountRes(){
  state.res = { wood:0, stone:0, food:0, meal:0, herb:0 };
  for(const t of tiles){
    if(t.zone !== 'stock' || !t.items) continue;
    for(const s of t.items) state.res[s.kind] = (state.res[s.kind]||0) + s.qty;
  }
}
function stockQty(kind, x, y){ return state.res[kind] || 0; }
function countItem(kind){
  let n = 0;
  for(const t of tiles) if(t.items) for(const s of t.items) if(s.kind === kind) n += s.qty;
  return n;
}
function stockpileTiles(){
  const out = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.zone === 'stock') out.push({x,y,t});
  }
  return out;
}

