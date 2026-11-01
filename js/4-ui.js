/* =====================================================================
   4-ui.js · 界面
   边陲 v1.5 · 模块化拆分（原单文件第 4 部分）
   ===================================================================== */

/* =====================================================================
   16 · 图标
   ===================================================================== */
const ICO = {
  wall:  '<path d="M3 6h18v12H3z"/><path d="M3 12h18M9 6v6M15 12v6"/>',
  door:  '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><path d="M10 12h.01"/><path d="M3 21h18"/>',
  bed:   '<path d="M3 18v-8h18v8"/><path d="M3 18h18"/><path d="M7 10V7h5a2 2 0 0 1 2 2v1"/>',
  fire:  '<path d="M12 22c4 0 6-2.7 6-6 0-3.6-3-5.4-3-9 0 0-2 1.5-2 4 0-2-1.5-3.5-1.5-3.5S10 9 10 11c-1 0-2 .8-2 2 0-1-1-2-1-2s-1 2.4-1 5c0 3.3 2 6 6 6z"/>',
  turret:'<circle cx="12" cy="13" r="5"/><path d="M12 8V3M9 20h6"/><path d="M15 11l6-2"/>',
  table: '<path d="M3 10h18v3H3z"/><path d="M6 13v7M18 13v7"/>',
  shop:  '<path d="M4 9l2-4h12l2 4"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
  clinic:'<path d="M4 7h16v13H4z"/><path d="M12 10v7M8.5 13.5h7"/>',
  tech:  '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="4"/>',
  flag:  '<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 7.8-8 9-4.5-1.2-8-4-8-9V6z"/>',
  focus: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.6"/>',
  stock: '<path d="M3 7h18v14H3z"/><path d="M3 7l3-4h12l3 4"/><path d="M12 7v14"/>',
  farm:  '<path d="M3 20h18"/><path d="M6 20V9M12 20V5M18 20V9"/><path d="M6 12l-2-2M6 12l2-2M12 8L9 5M12 8l3-3"/>',
  decon: '<path d="M4 20l7-7"/><path d="M9 6l9 9-3 3-9-9z"/>',
  cancel:'<path d="M6 6l12 12M18 6L6 18"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.2"/><path d="M16 14.2c2.8 0 5 2.2 5 5"/>',
  /* 资源图标（顶栏 chip 用，14px 下仍能分辨） */
  wood:  '<path d="M8 4h8a2.6 2.6 0 0 1 0 5.2H8A2.6 2.6 0 0 1 8 4z"/><path d="M8 9.2h8a2.6 2.6 0 0 1 0 5.2H8a2.6 2.6 0 0 1 0-5.2z"/><path d="M8 14.4h8a2.6 2.6 0 0 1 0 5.2H8a2.6 2.6 0 0 1 0-5.2z"/>',
  stone: '<path d="M5 16 8 7l5-3 5 4 2 8-5 4H9z"/><path d="M8 7l4 5 6-3M12 12l3 8"/>',
  food:  '<path d="M12 8.6c-1.1-2.3-3-3.5-4.9-3.5C5.5 5.1 4.5 6.3 4.5 8c0 3.3 3.4 6.6 7.5 6.6S19.5 11.3 19.5 8c0-1.7-1-2.9-2.6-2.9-1.9 0-3.8 1.2-4.9 3.5z"/><path d="M12 8.6V5.3"/><path d="M12 5.3c.2-1.4 1.2-2.2 2.6-2.2 0 1.5-1 2.3-2.6 2.2z"/>',
  meal:  '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M2.5 20h19"/><path d="M12 7.5c0-1.4.9-2 2.2-2"/>',
  herb:  '<path d="M19.5 4.5C19.5 13 14 18 8 18c0-7.5 4.5-12.5 11.5-13.5z"/><path d="M4.5 20c2-5.5 5.5-8.5 10-10"/>',
  heart: '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z"/>'
};
function svg(name, size){
  return `<svg width="${size||22}" height="${size||22}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[name]||''}</svg>`;
}

/* =====================================================================
   17 · 顶栏 / 侧栏 / 日志
   ===================================================================== */
const uiDirty = { log:true, side:true, res:true };
const RES_META = [
  { k:'wood',  n:'木材', c:'#d29a63', ico:'wood'  },
  { k:'stone', n:'石料', c:'#b3c0ce', ico:'stone' },
  { k:'food',  n:'食物', c:'#e8706f', ico:'food'  },
  { k:'meal',  n:'餐食', c:'#f2b757', ico:'meal'  },
  { k:'herb',  n:'药草', c:'#8ed08e', ico:'herb'  }
];

function updateTop(){
  const h = Math.floor((state.min % 1440)/60), mi = Math.floor(state.min % 60);
  $('cDay').textContent = `第 ${state.day} 天`;
  $('cTime').textContent = String(h).padStart(2,'0') + ':' + String(mi).padStart(2,'0');
  $('cWx').textContent = state.weather;

  /* 当天进度：让玩家知道"这一天还剩多少" */
  const pro = $('cProg');
  if(pro) pro.style.width = clamp((state.min % 1440)/1440*100, 0, 100).toFixed(1) + '%';

  /* 袭击倒计时 */
  const threatEl = $('cThreat');
  if(threatEl){
    const active = state.raiders.filter(r=> !r.down && !r.dead).length;
    const box = $('threat');
    if(active){
      threatEl.textContent = '交战';
      threatEl.style.color = '#ff8179';
      box.classList.add('hot');
    } else {
      const nd = nextRaidDay(state.day + (h >= 6 ? 1 : 0));
      threatEl.textContent = nd ? 'D' + nd : '—';
      threatEl.style.color = (nd && nd - state.day <= 1) ? 'var(--amber)' : 'var(--ink)';
      box.classList.remove('hot');
    }
    box.title = active ? '掠袭者正在进攻' : (threatEl.textContent === '—' ? '近期不会有袭击' : '下一次袭击：第 ' + threatEl.textContent.slice(1) + ' 天');
  }

  const bar = $('resBar');
  bar.innerHTML = RES_META.map(r=>{
    const v = Math.round(state.res[r.k]);
    const warn = (r.k === 'meal' || r.k === 'food') && v < state.cols.length * 2 ? ' warn' : '';
    return `<div class="chip${warn}" title="${r.n} ${v}"><span class="ic" style="--c:${r.c}">${svg(r.ico,15)}</span><b class="num">${v}</b><span>${r.n}</span></div>`;
  }).join('') + `<div class="chip" title="居民 ${state.cols.length} 人"><span class="ic" style="--c:#5aa0f0">${svg('people',15)}</span><b class="num">${state.cols.length}</b><span>居民</span></div>`;

  document.querySelectorAll('#spd button').forEach(b=>{
    b.classList.toggle('on', Number(b.dataset.s) === (state.paused ? 0 : state.speed));
  });
}

/* ---- 小地图 ---- */
function renderMini(){
  const el = $('mini');
  if(!el || !miniCv) return;
  if(el.width !== W*2){ el.width = W*2; el.height = H*2; }
  const g = el.getContext('2d');
  g.clearRect(0, 0, el.width, el.height);
  g.imageSmoothingEnabled = true;
  g.drawImage(miniCv, 0, 0, el.width, el.height);

  /* 建筑 */
  g.fillStyle = 'rgba(226,236,246,.85)';
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = tiles[y*W+x];
    if(t.bld && t.bld.prog >= 1) g.fillRect(x*2, y*2, 2, 2);
  }
  /* 单位 */
  for(const c of state.cols){
    g.fillStyle = c.down ? '#ff8b84' : '#a8ecff';
    g.beginPath(); g.arc((c.x+0.5)*2, (c.y+0.5)*2, 2.5, 0, TAU); g.fill();
  }
  for(const r of state.raiders){
    if(r.down || r.dead) continue;
    g.fillStyle = '#ff6a5e';
    g.beginPath(); g.arc((r.x+0.5)*2, (r.y+0.5)*2, 2.4, 0, TAU); g.fill();
  }
  /* 视口 */
  const wv = vw/cam.z/TS*2, hv = vh/cam.z/TS*2;
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.lineWidth = 1.3;
  g.strokeRect(cam.cx/TS*2 - wv/2, cam.cy/TS*2 - hv/2, wv, hv);
}

function jobName(c){
  if(c.down) return c.dead ? '已阵亡' : '倒地';
  if(c.breakT > 0) return '精神崩溃';
  if(c.sleeping) return '睡觉';
  if(c.order) return c.order.kind === 'attack' ? '听令 · 突击'
    : c.order.kind === 'demolish' ? '听令 · 拆巢' : '听令 · 移动';
  if(!c.job) return '待命';
  const j = c.job;
  const n = { fight:'战斗', chop:'砍树', mine:'采矿', harvest:'采集', sow:'播种',
              till:'开荒', build:'建造', cook:'烹饪', haul:'搬运', drop:'卸货', eat:'进食',
              sleep:'睡觉', wander:'闲逛', heal:'治伤', herb:'采药',
              retreat:'后撤', hold:'待命', guard:'守夜', rest:'歇着' }[j.type] || '工作';
  if(j.type === 'build' && j.dur) return '建造';
  return n;
}

/* =====================================================================
   农田面板（v2.1）
   ---------------------------------------------------------------
   这块留在侧栏而不是藏进建造栏，是因为它回答的是「现在」的问题：
   几格还没开、几格在长、几格已经熟了没人收、地力还剩多少。
   ===================================================================== */
function farmStats(){
  let wild = 0, tilled = 0, growing = 0, ripe = 0, fs = 0, fn = 0;
  for(const t of tiles){
    if(t.zone !== 'farm') continue;
    if(t.soil === 'tilled'){ tilled++; fs += (t.fert || 0); fn++; }
    else wild++;
    if(t.plant && t.plant.kind === 'crop'){
      if(t.plant.grow >= 0.99) ripe++; else growing++;
    }
  }
  return { wild, tilled, growing, ripe, total: wild + tilled, avgF: fn ? fs / fn : 0 };
}

function cropPickerHTML(){
  const cur = state.crop || 'wheat';
  return `<div class="crops">${CROP_KEYS.map(k=>{
    const c = CROPS[k];
    return `<button class="crop${cur === k ? ' on' : ''}" data-act="crop" data-k="${k}"
      title="${c.n} · ${c.d}">${c.n}<span>${c.med ? (c.herb||3) + '药' : c.yield + '粮'}</span></button>`;
  }).join('')}</div>
  <div class="hint" style="margin-top:6px">下一茬种<b>${cropDef(cur).n}</b> · ${cropDef(cur).d}</div>`;
}

function farmPanelHTML(){
  const s = farmStats();
  if(!s.total){
    return `<div class="sec">
      <div class="sec-h">农田</div>
      <div class="hint" style="margin-bottom:7px">还没有农田。在「建造 · 区域」里圈一块地，居民会先<b>开荒</b>，开完了才下种。</div>
      ${cropPickerHTML()}
    </div>`;
  }
  const fC = s.avgF < 0.38 ? '#e2564d' : s.avgF < 0.58 ? '#e8a33d' : '#6fbf8a';
  return `<div class="sec">
    <div class="sec-h">农田<span style="margin-left:auto;font-size:9.5px;letter-spacing:.04em;color:var(--ink3)">${s.tilled} 熟地 / ${s.total} 格</span></div>
    <div class="statline">
      <span><i>待开荒</i><b>${s.wild}</b></span>
      <span><i>生长中</i><b>${s.growing}</b></span>
      <span><i>待收</i><b style="color:${s.ripe ? '#e8a33d' : 'inherit'}">${s.ripe}</b></span>
      <span><i>地力</i><b style="color:${fC}">${Math.round(s.avgF * 100)}</b></span>
    </div>
    ${s.wild ? `<div class="hint" style="margin-top:7px;color:#b98a52">还有 ${s.wild} 格荒地 —— 开荒是重活，一人一天大约开一亩。</div>` : ''}
    ${s.ripe >= 2 ? `<div class="hint" style="margin-top:7px;color:#e2564d">${s.ripe} 格已经熟了。熟着不收，就是在替偷粮贼种。</div>` : ''}
    ${s.avgF && s.avgF < 0.42 ? `<div class="hint" style="margin-top:7px;color:#b98a52">地力见底了。种一茬<b>豆</b>能把地养回来。</div>` : ''}
    ${cropPickerHTML()}
  </div>`;
}

function renderSide(){
  const el = $('side');
  const sel = state.sel;
  if(sel && sel.kind === 'col'){
    const c = state.cols.find(x=> x.id === sel.id);
    if(!c){ state.sel = null; return renderSide(); }
    el.innerHTML = colPanel(c);
    return;
  }
  /* v1.9：框选了一队人 —— 面板换成小队视角，能整体下令和放技能 */
  if(sel && sel.kind === 'cols'){
    el.innerHTML = squadPanel();
    return;
  }
  if(sel && sel.kind === 'raid'){
    const r = state.raiders.find(x=> x.id === sel.id);
    if(!r){ state.sel = null; return renderSide(); }
    const kd = RKD[r.kind] || RKD.blade;
    el.innerHTML = `
      <div class="ph"><div class="portrait" style="background:${r.shirt}">${r.name.slice(0,1)}</div>
        <div class="who"><b>${r.name}</b><span><span class="tag r">${kd.n}</span> ${r.down ? '已失去战斗力' : '正在进攻'}</span></div></div>
      <div class="pb">
        <div class="sec">
          <div class="need"><div class="lab"><span>生命</span><b class="num">${Math.round(r.hp)} / ${r.maxHp}</b></div>
            ${bar(r.hp/r.maxHp*100, '#e2564d')}</div>
        </div>
        <div class="sec">
          <div class="kv">
            <div class="it"><div class="k">武器</div><div class="v">${{rifle:'步枪',pistol:'手枪',sling:'投石器'}[r.weapon]||'近身'}</div></div>
            <div class="it"><div class="k">伤害</div><div class="v">${Math.round(r.dmg)}</div></div>
            <div class="it"><div class="k">掩体</div><div class="v">${coverAt(r.x, r.y) ? '已有掩护' : '暴露'}</div></div>
          </div>
        </div>
        <div class="sec"><div class="hint">${kd.d}${r.kind === 'brute' ? ' 别拿墙硬扛，用哨戒炮和居民侧射。' : r.kind === 'torch' ? ' 着火后结构会持续掉血，尽快反打。' : ''}</div></div>
      </div>`;
    return;
  }
  if(sel && sel.kind === 'tile'){
    el.innerHTML = tilePanel(sel.x, sel.y);
    return;
  }
  el.innerHTML = colonyPanel();
}

/* 心情账单：正负分项逐条列出，可解决的给一个"怎么办"按钮 */
const WHYFIX = {
  food:  '先囤够食物：尽早圈农田，浆果熟了就派人去收。',
  bed:   '每人一张床。睡地上回不了精力，还倒扣心情。',
  clinic:'研究「草药学」后建医务所，并去采药草；否则伤口只能慢慢自愈。'
};
function whyBlock(c){
  const b = moodBreakdown(c);
  const tgt = Math.round(moodTarget(c));
  const now = Math.round(c.needs.mood);
  const dir = tgt > now + 1 ? '正在回升' : tgt < now - 1 ? '正在下滑' : '基本稳定';
  const rows = b.items
    .slice()
    .sort((x, y)=> x.v - y.v)
    .map(i=>`<div class="wr ${i.v < 0 ? 'bad' : 'good'}">
        <span>${i.k}</span>
        ${i.fix ? `<i class="fix" data-act="whyfix" data-k="${i.fix}">怎么办</i>` : ''}
        <b>${i.v > 0 ? '+' : ''}${i.v}</b>
      </div>`).join('');
  return `<div class="why">
      <div class="wr ${rows ? 'tot' : 'tot last'}"><span>当前 ${now} · ${dir}</span><b>趋向 ${tgt}</b></div>
      ${rows || '<div class="wr"><span>眼下没有明显的加减分项</span><b>—</b></div>'}
    </div>`;
}

function bar(pct, color){
  return `<div class="bar"><i style="width:${clamp(pct,0,100)}%;background:${color}"></i></div>`;
}

/* 小队面板（v1.9）：框选多人后的侧栏。能整体下令、整体放技能。 */
function squadPanel(){
  const list = selColonists();
  if(!list.length){ state.sel = null; return colonyPanel(); }
  const rows = list.map(c=>{
    const sk = skillDef(c);
    const cd = Math.ceil(c.skillCd || 0);
    const moodC = c.needs.mood > 55 ? '#57c07a' : c.needs.mood > 28 ? '#e8a33d' : '#e2564d';
    return `<div class="crew" data-act="selcol" data-id="${c.id}">
      <div class="av" style="background:${c.shirt}">${c.name.slice(0,1)}</div>
      <div class="nm">${c.name}</div>
      <div class="jb" style="color:${cd > 0 ? 'var(--ink3)' : '#e8a33d'}">${cd > 0 ? cd + ' 分' : sk.name}</div>
      <div class="bar thin" style="width:34px"><i style="width:${c.hp}%;background:${moodC}"></i></div>
    </div>`;
  }).join('');
  const ready = list.filter(c=> (c.skillCd || 0) <= 0).length;
  return `
  <div class="ph"><h3>小队 · ${list.length} 人</h3><span class="tag a">已框选</span></div>
  <div class="pb">
    <div class="sec">
      <div class="sec-h">成员</div>
      ${rows}
    </div>
    <div class="sec">
      <div class="sec-h">战术技能 <span class="kbd" style="font-size:10px">Q</span></div>
      <button class="btn${ready ? ' pri' : ''}" data-act="skill"
        style="width:100%;justify-content:space-between;${ready ? '' : 'opacity:.55'}">
        <span>全队出手</span><span class="num" style="font-size:11px">${ready} / ${list.length} 就绪</span>
      </button>
      <div class="hint" style="margin-top:6px">每人按自己的武器放一次，冷却各自计算。</div>
    </div>
    <div class="sec">
      <div class="sec-h">指挥</div>
      <div class="hint">
        <b>左键点地面</b> = 整队移动，保持队形<br>
        <b>左键点敌人</b> = 整队突击同一个目标<br>
        <b>左键点匪巢</b> = 整队去拆<br>
        <span class="kbd">Esc</span> 取消选择
      </div>
    </div>
  </div>`;
}

function colPanel(c){
  const moodC = c.needs.mood > 55 ? '#57c07a' : c.needs.mood > 28 ? '#e8a33d' : '#e2564d';
  const job = jobName(c);
  const statusTag = c.down ? '<span class="tag r">倒地</span>'
    : c.breakT > 0 ? '<span class="tag r">崩溃</span>'
    : (c.flee || 0) > 0 ? '<span class="tag a">后撤中</span>'
    : c.sleeping ? '<span class="tag n">睡眠</span>'
    : c.job && c.job.type === 'fight' ? '<span class="tag r">交战中</span>'
    : '<span class="tag g">正常</span>';

  const traitChips = (c.traits || []).map(k=>{
    const t = TRAITS[k];
    if(!t) return '';
    return `<span class="tag" style="color:${t.c};border-color:${t.c}66" title="${t.d}">${t.n}</span>`;
  }).join(' ');
  /* 旧伤（v2.0）：和性格排在一起，但用虚线边区分 —— 这是后天留下的，不是天生的 */
  const debuffChips = (c.debuffs || []).map(k=>{
    const t = DEBUFFS[k];
    if(!t) return '';
    return `<span class="tag" style="color:${t.c};border-style:dashed;border-color:${t.c}66" title="${t.d}">${t.n}</span>`;
  }).join(' ');

  const bondRows = (c.bonds || []).slice()
    .sort((a,b)=> Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 3)
    .map(b=>{
      const o = state.cols.find(x=> x.id === b.id);
      if(!o) return '';
      const nm = b.v >= 55 ? '朋友' : b.v <= -55 ? '积怨' : b.v > 15 ? '熟络' : b.v < -15 ? '生疏' : '一般';
      const col = b.v >= 55 ? '#57c07a' : b.v <= -55 ? '#e2564d' : 'var(--ink3)';
      return `<div class="it"><div class="k">${o.name}</div><div class="v" style="color:${col};font-size:12px">${nm}</div></div>`;
    }).join('');

  const vp = vigorPct(c) * 100;

  return `
  <div class="ph">
    <div class="portrait" style="background:${c.shirt}">${c.name.slice(0,1)}</div>
    <div class="who"><b>${c.name}</b><span>${statusTag} ${job}</span></div>
  </div>
  <div class="pb">
    <div class="sec">
      <div class="need"><div class="lab"><span>饥饿</span><b class="num">${Math.round(c.needs.hunger)}</b></div>
        ${bar(c.needs.hunger, c.needs.hunger < 25 ? '#e2564d' : '#c98f3f')}</div>
      <div class="need"><div class="lab"><span>精力</span><b class="num">${Math.round(c.needs.rest)}</b></div>
        ${bar(c.needs.rest, c.needs.rest < 25 ? '#e2564d' : '#5aa0f0')}</div>
      <div class="need"><div class="lab"><span>干劲</span><b class="num" style="color:${vp < 10 ? '#e2564d' : 'var(--ink2)'}">${Math.round(vp)}</b></div>
        ${bar(vp, vp < 10 ? '#e2564d' : vp < 35 ? '#e8a33d' : '#6fbf8a')}</div>
      <div class="need"><div class="lab"><span>心情</span><b class="num">${Math.round(c.needs.mood)}</b></div>
        ${bar(c.needs.mood, moodC)}</div>
      ${whyBlock(c)}
      <div class="hint" style="margin-top:7px">左键点地面让他过去，点掠袭者让他打；<b>Esc</b> 取消选择。</div>
    </div>

    <div class="sec">
      <div class="sec-h">状态</div>
      <div class="kv">
        <div class="it"><div class="k">生命</div><div class="v">${Math.round(c.hp)}<small>/${c.maxHp}</small></div></div>
        <div class="it"><div class="k">武器</div><div class="v">${{rifle:'步枪',pistol:'手枪',knife:'匕首'}[c.weapon]||'赤手'}</div></div>
        <div class="it"><div class="k">当前</div><div class="v" style="font-size:12px">${job}</div></div>
        ${c.order ? `<div class="it"><div class="k">指令</div><div class="v" style="font-size:12px;color:var(--amber)">${c.order.kind === 'attack' ? '突击' : '移动'} · 剩 ${Math.max(0, Math.round(c.order.ttl))} 分</div></div>` : ''}
        <div class="it"><div class="k">负重</div><div class="v" style="font-size:12px">${c.carry ? c.carry.qty + ' ' + itemName(c.carry.kind) : '空手'}</div></div>
        ${(c.wound || 0) >= 1 ? `<div class="it"><div class="k">伤口</div><div class="v" style="color:#e2564d">${Math.round(c.wound)}</div></div>` : ''}
      </div>
      ${(c.wound || 0) >= 15
        ? `<div class="hint" style="margin-top:8px">${countBuilt('clinic') > 0
            ? (countItem('herb') > 0 ? '会自己走去医务所处理伤口（消耗 1 份药草）。' : '医务所缺<b>药草</b>，先去采药。')
            : '伤口只能慢慢自愈。研究「草药学」后可建医务所。'}</div>`
        : ''}
    </div>

    <div class="sec">
      <div class="sec-h">战术技能 <span class="kbd" style="font-size:10px">Q</span></div>
      ${(()=>{
        const sk = skillDef(c);
        const cd = Math.ceil(c.skillCd || 0);
        const ready = cd <= 0;
        return `<button class="btn${ready ? ' pri' : ''}" data-act="skill" data-id="${c.id}"
          style="width:100%;justify-content:space-between;${ready ? '' : 'opacity:.55'}">
          <span>${sk.name}</span>
          <span class="num" style="font-size:11px">${ready ? '就绪' : cd + ' 分'}</span>
        </button>
        <div class="hint" style="margin-top:6px">${sk.hint}</div>`;
      })()}
    </div>

    <div class="sec">
      <div class="sec-h">技能</div>
      <div class="kv">
        <div class="it"><div class="k">砍伐</div><div class="v num">${c.skill.chop.toFixed(1)}</div></div>
        <div class="it"><div class="k">采矿</div><div class="v num">${c.skill.mine.toFixed(1)}</div></div>
        <div class="it"><div class="k">建造</div><div class="v num">${c.skill.build.toFixed(1)}</div></div>
        <div class="it"><div class="k">烹饪</div><div class="v num">${c.skill.cook.toFixed(1)}</div></div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-h">性格</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${traitChips || '<span class="hint">—</span>'}${debuffChips}</div>
      ${bondRows ? `<div class="sec-h" style="margin-top:10px">关系</div><div class="kv">${bondRows}</div>` : ''}
    </div>

    <div class="sec">
      <div class="row">
        <button class="btn" data-act="follow" data-id="${c.id}">跟随视角</button>
        <button class="btn" data-act="stop" data-id="${c.id}">停止工作</button>
      </div>
    </div>
  </div>`;
}

function itemName(k){ return { wood:'木材', stone:'石料', food:'食物', meal:'餐食', herb:'药草' }[k] || k; }

function tilePanel(x,y){
  const t = tileAt(x,y);
  if(!t) return colonyPanel();
  let body = '';
  if(t.bld){
    const def = BL[t.bld.type];
    const cap = bldMaxHp(t.bld.type);
    const extra = t.bld.type === 'shop'
      ? `<div class="hint" style="margin:8px 0">${state.tech.cur
           ? `正在研究 <b>${techDef(state.tech.cur).name}</b> · ${Math.round(state.tech.prog / techDef(state.tech.cur).time * 100)}%`
           : '这里是研究入口：点下方按钮选择课题。'}</div>
         <button class="btn" data-act="research" style="margin-bottom:10px">${svg('tech',16)} 科技树</button>`
      : t.bld.type === 'clinic'
      ? `<div class="hint" style="margin:8px 0">药草库存 <b>${Math.round(state.res.herb||0)}</b> · 伤员 <b>${state.cols.filter(c=> (c.wound||0) >= 15).length}</b> 人</div>`
      : t.bld.type === 'den'
      ? `<div class="hint" style="margin:8px 0">巢边还有 <b>${state.raiders.filter(r=> r.home && !r.dead && !r.down
           && Math.hypot(r.home.x - x, r.home.y - y) < 0.6).length}</b> 名守卫。
           选人后左键点这里，会先清守卫再拆结构。</div>`
      : '';
    body = `
      <div class="ph"><div class="portrait" style="background:#3a4250;color:#cfd8e3">${svg(def.ico,22)}</div>
        <div class="who"><b>${def.name}</b><span>${t.bld.prog < 1 ? '施工中 · ' + Math.round(t.bld.prog*100) + '%' : '已建成'}${t.bld.burn > 0 ? ' · <b style="color:#e2564d">燃烧中</b>' : ''}</span></div></div>
      <div class="pb">
        <div class="kv">
          <div class="it"><div class="k">结构强度</div><div class="v">${Math.round(t.bld.hp)}<small>/${cap}</small></div></div>
          <div class="it"><div class="k">坐标</div><div class="v">${x}, ${y}</div></div>
        </div>
        ${extra}
        <div class="row" style="margin-top:6px">
          ${t.bld.type === 'den' ? ''
            : `<button class="btn dan" data-act="decon" data-x="${x}" data-y="${y}">拆除（返还 50%）</button>`}
        </div>
      </div>`;
  } else if(t.zone === 'farm'){
    /* 农田（v2.1）：地块面板要回答两个问题 —— 这块能不能种，和它种着什么 */
    const cd = (t.plant && t.plant.kind === 'crop') ? cropDef(t.plant.crop) : null;
    const tilled = t.soil === 'tilled';
    const f = Number(t.fert) || 0;
    const sub = cd ? `种着 ${cd.n} · 成熟度 ${Math.round((t.plant.grow || 0) * 100)}%`
                   : tilled ? '熟地，空着' : '荒地 · 待开垦';
    body = `
      <div class="ph"><div class="portrait" style="background:#3f6a3a;color:#d6f0cf">${svg('farm',22)}</div>
        <div class="who"><b>农田</b><span>${sub}</span></div></div>
      <div class="pb">
        <div class="it"><div class="k">土壤</div><div class="v">${tilled ? '已经翻过' : '草皮未翻'}</div></div>
        ${tilled ? `<div class="it"><div class="k">地力</div><div class="v">${Math.round(f * 100)}%</div></div>` : ''}
        ${cd ? `<div class="it"><div class="k">作物</div><div class="v">${cd.n}</div></div>` : ''}
        <div class="hint" style="margin-top:8px">${!tilled
          ? '这块地还压着草皮。居民会先来<b>开荒</b>（重活，约 46 分钟），翻完了才下得了种。'
          : cd ? '成熟后居民会自动来收 —— 但熟着不收，偷粮贼也会来。'
          : `已经翻好了，下一茬播 <b>${cropDef(state.crop).n}</b>（侧栏可换）。`}</div>
        <div class="row" style="margin-top:8px"><button class="btn dan" data-act="unzone" data-x="${x}" data-y="${y}">取消该格区域</button></div>
      </div>`;
  } else if(t.zone){
    body = `
      <div class="ph"><div class="portrait" style="background:#3a4250;color:#cfd8e3">${svg(ZONE[t.zone].ico,22)}</div>
        <div class="who"><b>${ZONE[t.zone].name}</b><span>区域</span></div></div>
      <div class="pb"><button class="btn dan" data-act="unzone" data-x="${x}" data-y="${y}">取消该格区域</button></div>`;
  } else if(t.plant){
    const p = t.plant;
    const nm = p.kind === 'tree' ? '树木' : p.kind === 'bush' ? '浆果丛' : p.kind === 'herb' ? '药草丛' : '作物';
    const sub = p.kind === 'crop' ? '成熟度 ' + Math.round(p.grow*100) + '%'
      : p.kind === 'herb' ? (p.ready === false ? '正在长回来' : '可以采药')
      : '可采集';
    body = `
      <div class="ph"><div class="portrait" style="background:#3f6a3a;color:#d6f0cf">${svg(p.kind === 'herb' ? 'clinic' : 'farm',22)}</div>
        <div class="who"><b>${nm}</b><span>${sub}</span></div></div>
      <div class="pb"><div class="hint">${p.kind === 'herb'
        ? '药草是医务所唯一的原料。居民会自动采到 4 份存量，被采后会自己长回来。'
        : '居民会自动来采集 / 砍伐，也可以在「建造」里先圈出仓库区让它归堆。'}</div></div>`;
  } else {
    const gname = T_NAME[t.g] || '空地';
    const tips = {
      [T.ROCK]: '岩壁，可在边缘开采出石料。',
      [T.WATER]: '水域，不可通行、不可建造。',
      [T.MARSH]: '湿地，可以通行但很拖慢脚步，作物在这里长得快。',
      [T.GRAVEL]: '碎石滩，踩上去有点硌脚。',
      [T.MEADOW]: '花甸，土质肥沃，适合开垦农田。'
    };
    body = `
      <div class="ph"><div class="portrait" style="background:#33404a;color:#cfd8e3">${svg('wall',22)}</div>
        <div class="who"><b>${gname}</b><span>地块 ${x}, ${y} · 高程 ${Math.round((t.h||0)*100)}</span></div></div>
      <div class="pb"><div class="hint">${tips[t.g] || '空地，可建造。'}</div></div>`;
  }
  return body;
}

/* 阶段目标：侧栏最上面那块，回答"现在该干什么" */
function stageHint(){
  const st = curStage();
  const ab = ambDef();
  if(!st) return `野心 · ${ab.name}`;
  const left = st.day - state.day;
  const when = left > 0 ? `还剩 ${left} 天` : (left === 0 ? '今天截止' : '已结算');
  return `野心 · ${ab.name}　<b style="font-weight:500;color:var(--ink3)">${st.name}</b> · 第 ${st.day} 天前 · ${when}`;
}
function stageRowsHTML(){
  const st = curStage();
  if(!st){
    const g = state.stage;
    return `<div class="hint">三个阶段已全部结算：达成 <b>${g.done.length}</b> / 3。
      击败最后一波就能看到评价。</div>`;
  }
  return st.need.map(n=>{
    /* v1.8：目标可以是「不超过」（零死亡），所以判定和进度条都走 needBar */
    const b = needBar(n);
    const col = b.ok ? 'rgba(78,201,165,.72)' : '#4d5866';
    return `<div class="goal${b.ok?' ok':''}">
      <div class="goal-top">
        <span class="gk">${b.ok?'✓':'○'}</span>
        <span class="gt" title="${n.t}">${n.t}</span>
        <span class="gv">${b.v}${n.rev?'≤':'/'}${n.n}</span>
      </div>
      <div class="bar thin"><i style="width:${b.pct*100}%;background:${col}"></i></div>
    </div>`;
  }).join('');
}

/* ---- 今夜值守面板（v1.6）---- */
function watchPanelHTML(){
  const cap = watchCap();
  const cur = Math.min(state.watch, cap);
  const risk = Math.round(nightRisk() * 100);
  const fire = countBuilt('fire');
  const onDuty = state.cols.filter(c=> c.onWatch);
  const slow = hasTech('watch') ? 8 : 18;
  return `
    <div class="sec">
      <div class="sec-h">今夜值守 ${state.watchSet ? '<span class="tag a">已排班</span>' : '<span class="tag">21:30 排班</span>'}</div>
      <div class="stepper">
        <button class="stepb" data-act="watch-dec" ${cur <= 0 ? 'disabled' : ''}>−</button>
        <div class="stepv"><b>${cur}</b><span>/ ${cap} 人</span></div>
        <button class="stepb" data-act="watch-inc" ${cur >= cap ? 'disabled' : ''}>+</button>
      </div>
      <div class="hint" style="margin-top:7px">
        ${risk > 0 ? `夜袭风险 <b>${risk}%</b>` : (state.day < 3 ? '前两夜还算安稳' : '今晚不会有人来')}${fire ? ` · 篝火 ${fire} 座在压` : ' · 没有篝火'}<br>
        ${cur ? `平安夜守到半夜就换班；真打起来才熬通宵（次日 −${slow}%）` : '<b>没人守</b>：睡着的会被偷袭，伤害 +70%'}
      </div>
      ${onDuty.length ? `<div class="hint" style="margin-top:4px">在岗：${onDuty.map(c=> c.name).join('、')}</div>` : ''}
      ${state.nightRaid && !state.nightRaid.fired ? `<div class="hint" style="margin-top:4px;color:#e8a33d">守夜的人听见坡下有响动。</div>` : ''}
      ${state.nightTimes ? `<div class="hint" style="margin-top:4px">本局夜袭 <b>${state.nightTimes}</b> 次 · 有备 ${state.nightRepel} 次</div>` : ''}
    </div>`;
}

function colonyPanel(){
  const goalPct = clamp((state.day-1)/state.goalDay*100, 0, 100);
  const avgV = state.cols.length
    ? Math.round(state.cols.reduce((a,c)=> a + vigorPct(c)*100, 0) / state.cols.length) : 0;
  const crew = state.cols.map(c=>{
    const duty = !!c.onWatch;
    const j = duty ? '守夜中' : jobName(c);
    const moodC = c.needs.mood > 55 ? '#57c07a' : c.needs.mood > 28 ? '#e8a33d' : '#e2564d';
    const vg = vigorPct(c) * 100;
    const vgC = vg < 10 ? '#e2564d' : vg < 35 ? '#e8a33d' : '#6fbf8a';
    return `<div class="crew" data-act="selcol" data-id="${c.id}">
      <div class="av" style="background:${c.shirt}">${c.name.slice(0,1)}</div>
      <div class="nm">${c.name}</div>
      <div class="jb" style="color:${c.down ? '#e2564d' : duty ? '#e8a33d' : 'var(--ink3)'}">${j}</div>
      <div class="bars">
        <div class="bar thin" style="width:34px"><i style="width:${c.hp}%;background:${moodC}"></i></div>
        <div class="bar thin" style="width:34px;height:2px;margin-top:2px"><i style="width:${vg}%;background:${vgC}"></i></div>
      </div>
    </div>`;
  }).join('');

  const raiders = state.raiders.filter(r=> !r.down && !r.dead).length;
  const shopN = countBuilt('shop');

  /* 危机卡片（v2.0）：只显示还没结算的那一场。
     截止前一天变红 —— 玩家需要一眼看出「今天不处理就晚了」。 */
  const crisisHTML = (()=>{
    const cr = (state.crises || []).find(c=> c.state === 'wait');
    if(!cr) return '';
    const def = crisisDef(cr.id);
    if(!def) return '';
    const cur = crisisCur(cr), need = def.need.n;
    const pct = clamp(cur / need * 100, 0, 100);
    const left = Math.max(0, cr.dueDay - state.day);
    const ready = cur >= need;
    const hot = !ready && left <= 1;
    /* 催工（v2.0）：危机得能被「响应」，否则它只是一块倒计时。
       建筑类（比如 6 段石墙）没法催，只能自己盖。 */
    const urgeK = def.need.mode === 'bld' ? null : def.need.k;
    const urging = urgeK && state.urge && state.urge.day === state.day && state.urge.k === urgeK;
    const btnS = 'font-size:10.5px;padding:3px 9px;border-radius:7px;border:1px solid var(--line);'
               + 'background:none;cursor:pointer';
    const urgeBtn = urgeK
      ? `<button data-act="urge" data-k="${urgeK}" style="${btnS};color:${urging ? '#e8a33d' : 'var(--ink2)'};`
        + `border-color:${urging ? 'rgba(232,163,61,.55)' : 'var(--line)'}">${urging ? '正在赶工' : '催工'}</button>`
      : '';
    return `<div class="crisis${hot ? ' hot' : ''}">
      <div class="cr-h">
        <b>${def.name}</b>
        <span class="${ready ? 'ok' : ''}">${ready ? '已备齐'
          : left <= 0 ? '今天到期' : '还差 ' + left + ' 天'}</span>
      </div>
      <div class="cr-need"><i>${def.need.what}</i><b class="num">${cur}</b><span>/ ${need}</span></div>
      <div class="bar thin" style="height:4px"><i style="width:${pct}%;background:${ready ? '#4ec9a5' : hot ? '#e2564d' : '#e8a33d'}"></i></div>
      <div style="display:flex;align-items:center;gap:7px;margin-top:9px">
        ${urgeBtn}
        <button data-act="decline-crisis" style="${btnS};color:var(--ink3)">不管了</button>
        <span class="hint" style="flex:1;margin:0;text-align:right">${ready ? '到期就能过' : '放弃 心情 −7'}</span>
      </div>
    </div>`;
  })();

  return `
  <div class="ph"><h3>殖民地</h3><span class="tag ${raiders ? 'r' : 'a'}">${raiders ? '交战中' : '第 ' + state.day + ' 天'}</span></div>
  <div class="pb">
    ${crisisHTML}
    <div class="sec">
      <div class="sec-h">野心 · ${ambDef().name}</div>
      <div class="hint" style="margin:-1px 0 9px;color:#b98a52">${ambDef().goal}</div>
      ${stageRowsHTML()}
      <div class="hint" style="margin-top:9px">撑过 <b>${state.goalDay}</b> 天 · 已过 <b>${Math.min(state.day-1, state.goalDay)}</b> 天</div>
      <div style="margin-top:6px">${bar(goalPct, 'linear-gradient(90deg,rgba(78,201,165,.8),rgba(240,169,63,.85))')}</div>
    </div>

    ${farmPanelHTML()}

    <div class="sec">
      <div class="sec-h">科技</div>
      ${state.tech.cur ? (()=>{
          const d = techDef(state.tech.cur);
          const pct = clamp(state.tech.prog / d.time * 100, 0, 100);
          return `<div class="hint" style="margin-bottom:6px">正在研究 <b>${d.name}</b> · ${Math.round(pct)}%</div>
                  ${bar(pct, 'linear-gradient(90deg,#4ec9a5,#8fd08a)')}`;
        })()
        : `<div class="hint">${shopN ? '工坊已就绪，可以开始研究。' : '建成<b>工坊</b>后可开始研究（8 项，一次一项）。'}</div>`}
      ${shopN ? `<div class="row" style="margin-top:8px"><button class="btn" data-act="research">${svg('tech',16)} 打开科技树</button></div>` : ''}
    </div>

    <div class="sec">
      <div class="sec-h">成员 · ${state.cols.length}<span style="margin-left:auto;font-size:9.5px;letter-spacing:.04em;color:${avgV < 25 ? '#e2564d' : avgV < 50 ? '#e8a33d' : '#6fbf8a'}">干劲 ${avgV}%</span></div>
      ${crew || '<div class="hint">没有居民了。</div>'}
    </div>

    <div class="sec">
      <div class="sec-h">指挥 ${state.cmd ? `<span class="tag a">${cmdName(state.cmd)}</span>` : ''}</div>
      <div class="row">
        <button class="btn" data-act="cmd-rally">集结</button>
        <button class="btn" data-act="cmd-retreat">撤退</button>
        <button class="btn dan" data-act="cmd-clear">解除</button>
      </div>
      <div class="hint" style="margin-top:8px">
        <b>右键点敌人</b> = 全体集火　<span class="kbd">F</span> 集结　<span class="kbd">R</span> 撤退　<span class="kbd">G</span> 解除<br>
        指令会覆盖日常工作（吃饭睡觉除外），到点自动过期。
      </div>
    </div>

    ${watchPanelHTML()}

    <div class="sec">
      <div class="sec-h">累计</div>
      <div class="statline">
        <span><i>伐木</i><b>${Math.round(state.stats.wood)}</b></span>
        <span><i>采石</i><b>${Math.round(state.stats.stone)}</b></span>
        <span><i>击杀</i><b>${state.stats.kills}</b></span>
        <span><i>建造</i><b>${state.stats.built}</b></span>
      </div>
    </div>

    <div class="sec">
      <div class="sec-h">操作</div>
      <div class="hint">
        <b>左键</b> 选人 / 放置　<b>框选</b> 圈多人　<b>右键</b> 取消 / 集火<br>
        其余快捷键与机制按 <span class="kbd">H</span> 查看。
      </div>
    </div>
  </div>`;
}

function renderLog(){
  if(!uiDirty.log) return;
  uiDirty.log = false;
  const el = $('log');
  el.innerHTML = state.log.slice(0,5).map(e=>{
    const d = Math.floor(e.t/1440)+1, h = Math.floor((e.t%1440)/60);
    return `<div class="entry ${e.cls}"><span class="ts">D${d} ${String(h).padStart(2,'0')}时</span><span class="tx">${e.text}</span></div>`;
  }).join('');
}

let sideT = 0, miniT = 0;
function updateUI(){
  updateTop();
  /* v1.9：战术慢放必须有提示，不然玩家会以为游戏卡了 */
  const st = $('slowTag');
  if(st){
    /* __shotSlow：截图演示用（?squad=1 会暂停画面，但慢放标记得看得见） */
    const on = (state.slow || 1) < 1 && (!state.paused || window.__shotSlow) && !state.over;
    st.style.display = on ? '' : 'none';
  }
  const now = performance.now();
  const live = state.sel && state.sel.kind === 'col';
  if(uiDirty.side || (live && now - sideT > 700)){
    sideT = now; uiDirty.side = false; renderSide();
  }
  if(!miniT || now - miniT > 160){ miniT = now; renderMini(); }
  renderLog();
  updateBuildAfford();
}

let alertTimer = 0;
function showAlert(text, bad){
  const el = $('alert');
  el.innerHTML = `<div class="ban ${bad?'':'ok'}">${bad ? '⚠' : '✓'} ${text}</div>`;
  alertTimer = 60;
}

function toast(text){
  const el = $('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(el._h);
  el._h = setTimeout(()=> el.classList.remove('on'), 1300);
}

/* =====================================================================
   17.5 · 音效（WebAudio 实时合成，不依赖任何音频素材）
   ===================================================================== */
const SFX = (()=>{
  let ac = null, master = null, noiseBuf = null, ready = false, muted = false;
  let rainGain = null, nightT = 0;
  const lastAt = Object.create(null);
  const VOL = 0.42;

  try{ muted = localStorage.getItem('frontier-sfx') === '0'; }catch(e){}

  function ensure(){
    if(ready) return true;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : VOL;
      master.connect(ac.destination);

      const n = Math.floor(ac.sampleRate);
      noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for(let i=0;i<n;i++) ch[i] = Math.random()*2 - 1;
      ready = true;
      startAmbient();
      return true;
    }catch(e){ ready = false; return false; }
  }

  function tnow(){ return ac ? ac.currentTime : 0; }

  /* 噪声脉冲：用滤波器塑形，制造打击/摩擦类音色 */
  function burst(dur, freq, q, gain, type){
    if(!ready) return;
    const t = tnow();
    const s = ac.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.03);
  }

  /* 单音，可滑音 */
  function tone(f0, f1, dur, gain, type){
    if(!ready) return;
    const t = tnow();
    const o = ac.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if(f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(24, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  /* 同类音效节流：多单位同时开火时不至于爆音 */
  function gate(kind, ms){
    if(!ready || muted) return false;
    const t = performance.now();
    if(lastAt[kind] !== undefined && t - lastAt[kind] < (ms || 55)) return false;
    lastAt[kind] = t;
    return true;
  }

  function startAmbient(){
    try{
      const s = ac.createBufferSource();
      s.buffer = noiseBuf; s.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.6;
      const g = ac.createGain(); g.gain.value = 0;
      s.connect(lp); lp.connect(g); g.connect(master);
      s.start();
      rainGain = g;
    }catch(e){}
  }

  return {
    unlock(){
      if(ensure() && ac.state === 'suspended') ac.resume();
    },
    isMuted(){ return muted; },
    toggle(){
      muted = !muted;
      try{ localStorage.setItem('frontier-sfx', muted ? '0' : '1'); }catch(e){}
      if(master) master.gain.value = muted ? 0 : VOL;
      return muted;
    },
    shot(){
      if(!gate('shot', 42)) return;
      burst(0.09, 1500, 0.85, 0.20, 'highpass');
      tone(160, 62, 0.08, 0.09, 'square');
    },
    hit(){
      if(!gate('hit', 65)) return;
      burst(0.06, 2700, 1.2, 0.09, 'highpass');
    },
    chop(){
      if(!gate('chop', 100)) return;
      burst(0.08, 640, 2.4, 0.15);
      tone(230, 132, 0.06, 0.05, 'triangle');
    },
    mine(){
      if(!gate('mine', 100)) return;
      burst(0.07, 330, 3.0, 0.14);
      tone(168, 96, 0.07, 0.06, 'triangle');
    },
    build(){
      if(!gate('build', 110)) return;
      burst(0.07, 520, 2.0, 0.11);
    },
    done(){
      if(!gate('done', 220)) return;
      [523.25, 659.25, 783.99].forEach((f,i)=>
        setTimeout(()=> tone(f, f, 0.16, 0.09, 'sine'), i*72));
    },
    alert(){
      if(!gate('alert', 700)) return;
      tone(340, 226, 0.28, 0.13, 'square');
      setTimeout(()=> tone(340, 226, 0.28, 0.11, 'square'), 330);
    },
    die(){
      if(!gate('die', 180)) return;
      tone(300, 68, 0.45, 0.11, 'sawtooth');
    },
    click(){
      if(!gate('click', 55)) return;
      tone(880, 880, 0.04, 0.05, 'sine');
    },
    update(dt){
      if(!ready || !ac) return;
      /* 雨声随天气淡入淡出 */
      if(rainGain){
        const target = (!muted && state.rain > 0.5) ? 0.045 : 0;
        rainGain.gain.value += (target - rainGain.gain.value) * Math.min(1, dt*1.8);
      }
      /* 夜间虫鸣 */
      if(!muted && darkness() > 0.30 && !state.paused && !state.over){
        nightT -= dt;
        if(nightT <= 0){
          nightT = 0.8 + Math.random()*2.4;
          if(gate('cricket', 260))
            tone(3400 + Math.random()*1300, 4300, 0.05, 0.028, 'sine');
        }
      }
    }
  };
})();

/* =====================================================================
   18 · 建造栏与放置
   ===================================================================== */
function initBuild(){
  const groups = [
    { h:'建造 <b>1–8</b>', items:[
      { k:'bld', v:'wall',   ico:'wall',   n:'石墙',  cost: BL.wall.cost },
      { k:'bld', v:'door',   ico:'door',   n:'木门',  cost: BL.door.cost },
      { k:'bld', v:'bed',    ico:'bed',    n:'床铺',  cost: BL.bed.cost },
      { k:'bld', v:'fire',   ico:'fire',   n:'篝火',  cost: BL.fire.cost },
      { k:'bld', v:'turret', ico:'turret', n:'哨戒炮',cost: BL.turret.cost },
      { k:'bld', v:'table',  ico:'table',  n:'餐桌',  cost: BL.table.cost },
      { k:'bld', v:'shop',   ico:'shop',   n:'工坊',  cost: BL.shop.cost },
      { k:'bld', v:'clinic', ico:'clinic', n:'医务所',cost: BL.clinic.cost, lock:'clinic' }
    ]},
    { h:'区域', items:[
      { k:'zone', v:'stock', ico:'stock', n:'仓库区' },
      { k:'zone', v:'farm',  ico:'farm',  n:'农田' }
    ]},
    { h:'指挥', items:[
      { k:'cmd', v:'rally',   ico:'flag',   n:'集结' },
      { k:'cmd', v:'retreat', ico:'shield', n:'撤退' },
      { k:'cmd', v:'clear',   ico:'cancel', n:'解除' }
    ]},
    { h:'编辑', items:[
      { k:'decon', v:'', ico:'decon', n:'拆除' },
      { k:'cancel', v:'', ico:'cancel', n:'取消' }
    ]}
  ];
  const costTxt = c=>{
    if(!c) return '';
    const first = Object.keys(c)[0];
    return c[first];
  };
  $('build').innerHTML = groups.map(g=>`
    <div class="cat">
      <div class="cat-h">${g.h}</div>
      <div class="cat-b">
        ${g.items.map((it, gi)=>{
          const active = state.build && (
            (it.k === 'bld'  && state.build.kind === 'bld'  && state.build.type === it.v) ||
            (it.k === 'zone' && state.build.kind === 'zone' && state.build.type === it.v) ||
            (it.k === 'cmd'  && it.v === 'rally' && state.build.kind === 'rally') ||
            (it.k === 'decon' && state.build.kind === 'decon'));
          const locked = it.lock && !hasTech(it.lock);
          const ck = it.cost ? Object.keys(it.cost)[0] : '';
          const tip = `${it.n}${it.cost ? ' · ' + costTxt(it.cost) + ' ' + itemName(ck) : ''}`
            + (it.k === 'bld' && gi < 8 ? ` · 按 ${gi+1}` : '')
            + (locked ? '（需研究' + techDef(it.lock).name + '）' : '');
          return `<button class="bld ${active?'on':''} ${locked?'no':''}" data-kind="${it.k}" data-v="${it.v}" title="${tip}">
            ${svg(it.ico)}
            <span class="nm">${it.n}</span>
            ${it.cost ? `<span class="cost${ck === 'stone' ? ' st' : ''}">${costTxt(it.cost)}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`).join('');
}

function setBuildFromBar(k, v){
  if(k === 'cancel'){ state.build = null; }
  else if(k === 'decon'){ state.build = { kind:'decon' }; }
  else if(k === 'bld'){
    const def = BL[v];
    if(def.tech && !hasTech(def.tech)){ toast(`需要先研究「${techDef(def.tech).name}」`); return false; }
    if(!canAfford(def.cost)){ toast('资源不足'); return false; }
    state.build = state.build && state.build.type === v ? null : { kind:'bld', type:v };
  } else if(k === 'zone'){
    state.build = state.build && state.build.type === v ? null : { kind:'zone', type:v };
  } else if(k === 'cmd'){
    if(v === 'rally'){
      const on = state.build && state.build.kind === 'rally';
      state.build = on ? null : { kind:'rally' };
      if(!on) toast('点击地图选择集结位置');
    } else if(v === 'retreat'){
      state.build = null; setCommand({ kind:'retreat' });
    } else if(v === 'clear'){
      state.build = null; setCommand(null);
    }
  }
  initBuild();
  return true;
}

/* 下达全体指令（v1.3） */
function setCommand(cmd){
  if(cmd){
    cmd.until = state.min + (cmd.kind === 'focus' ? 720 : 480);
    cmd.name = cmdName(cmd);
  }
  state.cmd = cmd;
  uiDirty.side = true;
  if(cmd){
    logEvent(`下达指令：<b>${cmdName(cmd)}</b>${cmd.kind === 'focus' ? '' : '，居民停止手头工作'}。`, '');
    toast(`指令：${cmdName(cmd)}`);
  } else {
    toast('指令已解除');
  }
}

function updateBuildAfford(){
  document.querySelectorAll('#build .bld').forEach(b=>{
    const k = b.dataset.kind, v = b.dataset.v;
    if(k !== 'bld'){ b.classList.remove('no'); return; }
    const def = BL[v];
    const locked = def.tech && !hasTech(def.tech);
    b.classList.toggle('no', locked || !canAfford(def.cost));
  });
}

/* ---------- 撤销：误建 / 误圈的可回退栈 ---------- */
const undoStack = [];
function pushUndo(e){ undoStack.push(e); if(undoStack.length > 120) undoStack.shift(); }

function undoLast(){
  if(!undoStack.length){ toast('没有可撤销的操作'); return false; }
  const e = undoStack.pop();
  if(e.kind === 'build'){
    const t = tileAt(e.x, e.y);
    if(!t || !t.bld){ toast('该建筑已经不在了'); return false; }
    t.bld = null;
    refund(e.cost, 1, e.x, e.y);
    toast(`已撤销：${BL[e.type].name}`);
  } else if(e.kind === 'zone'){
    const t = tileAt(e.x, e.y);
    if(!t){ return false; }
    if(t.zone !== e.zone){ toast('该地块已被改动'); return false; }
    t.zone = e.prev;
    for(const k in e.delta) state.res[k] = Math.max(0, (state.res[k]||0) - e.delta[k]);
    toast(e.prev ? `已撤销为：${ZONE[e.prev].name}` : '已撤销：恢复空地');
  }
  uiDirty.side = true; uiDirty.res = true;
  return true;
}

function canPlace(type, x, y){
  const t = tileAt(x,y);
  if(!t) return false;
  const def = BL[type];
  if(!def) return false;
  /* hidden 的建造项（匪巢）只有地图生成能放。建造栏是按 BLD_KEYS 列的，
     本来点不到，但任何一处枚举 BL 的新界面都能白送玩家三个免费的巢。 */
  if(def.hidden) return false;
  if(def.tech && !hasTech(def.tech)) return false;
  if(t.g === T.WATER || t.g === T.ROCK) return false;
  if(t.bld) return false;
  if(t.plant) return false;
  return true;
}

function placeBuilding(type, x, y){
  const def = BL[type];
  if(def.tech && !hasTech(def.tech)){ toast(`需要先研究「${techDef(def.tech).name}」`); return false; }
  if(!canPlace(type,x,y)){ toast('这里不能建造'); return false; }
  if(!canAfford(def.cost)){ toast('资源不足'); return false; }
  payCost(def.cost);
  pushUndo({ kind:'build', x, y, type, cost:{...def.cost} });
  tiles[y*W+x].bld = { type, prog:0, hp:bldMaxHp(type), cdT:0, ang:-Math.PI/2, burn:0 };
  return true;
}

function setZone(kind, x, y){
  const t = tileAt(x,y);
  if(!t || t.g === T.WATER || t.g === T.ROCK) return false;
  if(t.bld) return false;
  if(t.zone === kind) return false;
  if(t.plant && t.plant.kind === 'tree') return false;
  const prevZone = t.zone, resBefore = { ...state.res };
  if(t.zone === 'stock' && kind !== 'stock' && t.items)
    for(const s of t.items) state.res[s.kind] = Math.max(0, (state.res[s.kind]||0) - s.qty);
  t.zone = kind;
  if(kind === 'stock' && t.items)
    for(const s of t.items) state.res[s.kind] = (state.res[s.kind]||0) + s.qty;
  if(kind !== 'farm' && t.plant) t.plant = null;
  if(kind !== 'farm'){ t.soil = null; t.fert = 0; }
  const d = {};
  for(const kk in state.res) if(state.res[kk] !== resBefore[kk]) d[kk] = state.res[kk] - resBefore[kk];
  pushUndo({ kind:'zone', x, y, zone:kind, prev:prevZone, delta:d });
  return true;
}

function deconstructAt(x,y){
  const t = tileAt(x,y);
  if(!t) return;
  if(t.bld){
    /* 匪巢不是自家建筑：能被「拆除」按钮一键铲平的话，远征三下鼠标就通关了，
       而且不记战功、守卫还留着 —— 场上出现三个空巢 + 一堆没家的守卫。 */
    if(t.bld.type === 'den'){ toast('匪巢拆不掉，只能打'); return; }
    refund(BL[t.bld.type].cost, 0.5, x, y);
    t.bld = null;
    toast('已拆除');
  } else if(t.zone){
    clearZone(x,y);
    toast('已取消区域');
  }
  uiDirty.side = true;
}

/* =====================================================================
   19 · 输入
   ===================================================================== */
const mouse = { sx:0, sy:0, wx:0, wy:0, down:false, in:false, pan:false, px:0, py:0 };
/* 框选状态（v1.9）：a=已经拖出框，否则当作单击处理 */
let boxSel = null;

/* 单击的左键逻辑：选中 / 给选中的人下指令 */
function handleLeftClick(w, t){
  const tb = tileAt(t.x, t.y);
  const hit = pickActor(w.x, w.y);

  /* 选中了人：点掠袭者 = 突击，点匪巢 = 拆巢，点空地 = 移动 */
  const picked = selColonists();
  if(picked.length){
    if(hit && hit.side === 'raid'){
      for(const c of picked) giveOrder(c, { kind:'attack', id: hit.id }, true);
      if(picked.length > 1) toast(`${picked.length} 人突击同一目标`);
      return;
    }
    if(!hit && tb && tb.bld && tb.bld.type === 'den'){
      for(const c of picked) giveOrder(c, { kind:'demolish', x:t.x, y:t.y }, true);
      if(picked.length > 1) toast(`${picked.length} 人前往拆巢`);
      return;
    }
    if(!hit && !(tb && tb.bld) && passable(t.x, t.y)){
      moveGroup(picked, t.x, t.y);
      return;
    }
  }

  // 选择
  if(hit){
    state.sel = { kind: hit.side === 'col' ? 'col' : 'raid', id: hit.id };
  } else {
    state.sel = { kind:'tile', x:t.x, y:t.y };
  }
  uiDirty.side = true;
}

/* 当前选中的居民列表（v1.9 支持一次选多个） */
function selColonists(){
  const s = state.sel;
  if(!s) return [];
  if(s.kind === 'col'){
    const c = state.cols.find(x=> x.id === s.id);
    return c && !c.dead && !c.down ? [c] : [];
  }
  if(s.kind === 'cols'){
    return (s.ids || []).map(id=> state.cols.find(x=> x.id === id))
      .filter(c=> c && !c.dead && !c.down);
  }
  return [];
}

/* 框选：把屏幕框里的人都收进来 */
function selectBox(b){
  const x0 = Math.min(b.sx, b.cx), x1 = Math.max(b.sx, b.cx);
  const y0 = Math.min(b.sy, b.cy), y1 = Math.max(b.sy, b.cy);
  const ids = [];
  for(const c of state.cols){
    if(c.dead) continue;
    /* worldToScreen 吃的是「像素世界坐标」，c.fx 是格 —— 少乘一个 TS，
       框选范围会缩到左上角那一小块，玩家框中间一个人也选不上。 */
    const p = worldToScreen(c.fx * TS, c.fy * TS);
    if(p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(c.id);
  }
  if(ids.length === 1) state.sel = { kind:'col', id: ids[0] };
  else if(ids.length > 1) state.sel = { kind:'cols', ids };
  else state.sel = null;
  uiDirty.side = true;
}

/* 编队移动（v1.9）：给每个人分一个互不重叠的落点，保持大致队形。
   全部下同一个格子会让路径互相踩，队形散成一列 —— 玩家看着像没听命令。 */
function moveGroup(list, tx, ty){
  if(!list.length) return;
  if(list.length === 1){
    giveOrder(list[0], { kind:'move', x:tx, y:ty });
    return;
  }
  /* 以选中人群的质心为基准，把点击点整体平移过去 */
  let mx = 0, my = 0;
  for(const c of list){ mx += c.x; my += c.y; }
  mx /= list.length; my /= list.length;

  const taken = new Set();
  let n = 0;
  for(const c of list){
    const wantX = Math.round(tx + (c.x - mx));
    const wantY = Math.round(ty + (c.y - my));
    let spot = null;
    for(let r=0; r<=3 && !spot; r++){
      for(let dy=-r; dy<=r && !spot; dy++) for(let dx=-r; dx<=r && !spot; dx++){
        const x = wantX + dx, y = wantY + dy;
        if(!passable(x, y)) continue;
        const k = x + ',' + y;
        if(taken.has(k)) continue;
        taken.add(k); spot = { x, y };
      }
    }
    if(spot){ giveOrder(c, { kind:'move', x:spot.x, y:spot.y }, true); n++; }
  }
  if(n) toast(`${n} 人正在移动`);
}
const keys = {};

function bindInput(){
  const cvs = $('cv');

  cvs.addEventListener('pointermove', e=>{
    mouse.sx = e.clientX; mouse.sy = e.clientY;
    const w = screenToWorld(e.clientX, e.clientY);
    mouse.wx = w.x; mouse.wy = w.y; mouse.in = true;
    if(mouse.pan){
      cam.cx -= (e.clientX - mouse.px)/cam.z;
      cam.cy -= (e.clientY - mouse.py)/cam.z;
      mouse.px = e.clientX; mouse.py = e.clientY;
      clampCam();
    }
    /* 拖出 8px 才算框选：手抖几像素不应该把「点选」变成「框空」 */
    if(boxSel){
      boxSel.cx = e.clientX; boxSel.cy = e.clientY;
      if(!boxSel.a && Math.hypot(boxSel.cx - boxSel.sx, boxSel.cy - boxSel.sy) > 8) boxSel.a = true;
    }
  });

  cvs.addEventListener('pointerleave', ()=>{ mouse.in = false; hideTip(); tipKey = ''; boxSel = null; });
  cvs.addEventListener('pointerdown', e=>{
    const w = screenToWorld(e.clientX, e.clientY);
    const t = worldToTile(w.x, w.y);
    mouse.wx = w.x; mouse.wy = w.y; mouse.in = true;

    if(e.button === 1 || keys[' '] && false){
      mouse.pan = true; mouse.px = e.clientX; mouse.py = e.clientY;
      e.preventDefault(); return;
    }
    if(e.button === 1){ mouse.pan = true; mouse.px = e.clientX; mouse.py = e.clientY; return; }
    if(e.button === 2){
      /* 右键点敌人 = 全体集火（v1.3） */
      const hit2 = pickActor(w.x, w.y);
      if(hit2 && hit2.side === 'raid'){
        setCommand({ kind:'focus', id: hit2.id });
        SFX.alert();
        return;
      }
      state.build = null; state.drag = null;
      initBuild(); return;
    }
    if(e.button !== 0) return;

    // 建造模式
    if(state.build){
      const b = state.build;
      if(b.kind === 'bld'){
        placeBuilding(b.type, t.x, t.y);
        if(!keys['Shift']) { /* 保持建造模式，方便连续放置 */ }
      } else if(b.kind === 'zone'){
        state.drag = t;
        setZone(b.type, t.x, t.y);
      } else if(b.kind === 'rally'){
        if(passable(t.x, t.y)){
          setCommand({ kind:'rally', x:t.x, y:t.y });
          state.build = null; initBuild();
        } else {
          toast('这里站不住人');
        }
      } else if(b.kind === 'decon'){
        deconstructAt(t.x, t.y);
      }
      return;
    }

    /* v1.9：左键按下时先不判断「点」还是「拖」。
       拖出框 = 框选多人，原地松手 = 原来的点选 / 下移动令。
       判断推迟到 pointerup —— 在按下的一瞬间没法知道玩家要干什么。 */
    boxSel = { a:false, sx:e.clientX, sy:e.clientY, cx:e.clientX, cy:e.clientY };
  });

  cvs.addEventListener('pointerup', e=>{
    if(mouse.pan){ mouse.pan = false; }
    if(state.drag && state.build && state.build.kind === 'zone'){
      const t = worldToTile(mouse.wx, mouse.wy);
      const r = dragRect(t);
      for(let y=r.y0;y<=r.y1;y++) for(let x=r.x0;x<=r.x1;x++) setZone(state.build.type, x, y);
      state.drag = null;
    }
    if(boxSel){
      const b = boxSel; boxSel = null;
      if(b.a) selectBox(b);
      else {
        const w = screenToWorld(e.clientX, e.clientY);
        handleLeftClick(w, worldToTile(w.x, w.y));
      }
    }
  });

  cvs.addEventListener('pointerleave', ()=>{ mouse.in = false; });
  cvs.addEventListener('contextmenu', e=> e.preventDefault());

  cvs.addEventListener('wheel', e=>{
    e.preventDefault();
    const before = screenToWorld(e.clientX, e.clientY);
    cam.z *= e.deltaY > 0 ? 0.88 : 1.14;
    clampCam();
    const after = screenToWorld(e.clientX, e.clientY);
    cam.cx += before.x - after.x;
    cam.cy += before.y - after.y;
    clampCam();
  }, { passive:false });

  window.addEventListener('keydown', e=>{
    keys[e.key] = true;
    if(e.key === ' '){ e.preventDefault(); state.paused = !state.paused; }
    else if(e.key >= '1' && e.key <= '8'){
      const bt = BLD_KEYS[Number(e.key) - 1];
      if(bt) setBuildFromBar('bld', bt);
    }
    else if(e.key === 'f' || e.key === 'F'){
      state.build = state.build && state.build.kind === 'rally' ? null : { kind:'rally' };
      initBuild();
      if(state.build) toast('点击地图选择集结位置');
    }
    else if(e.key === 'r' || e.key === 'R'){ setCommand({ kind:'retreat' }); }
    else if(e.key === 'g' || e.key === 'G'){ setCommand(null); }
    else if(e.key === 'q' || e.key === 'Q'){ e.preventDefault(); useSkillOnSelection(); }
    else if(e.key === '['){ state.speed = Math.max(1, state.speed - 1); state.paused = false; }
    else if(e.key === ']'){ state.speed = Math.min(3, state.speed + 1); state.paused = false; }
    else if(e.key === 'z' || e.key === 'Z'){ e.preventDefault(); undoLast(); }
    else if(e.key === 'Escape'){
      state.build = null; state.drag = null; initBuild(); closeModal();
      if(state.sel && (state.sel.kind === 'col' || state.sel.kind === 'cols')){ state.sel = null; uiDirty.side = true; }
    }
    else if(e.key === 'h' || e.key === 'H'){ showHelp(); }
    else if(e.key === 'm' || e.key === 'M'){
      SFX.unlock();
      const m = SFX.toggle();
      const w = $('sndWave'), x = $('sndMute');
      if(w) w.style.display = m ? 'none' : '';
      if(x) x.style.display = m ? '' : 'none';
      $('btnSound').style.opacity = m ? 0.45 : 1;
      toast(m ? '音效已关闭' : '音效已开启');
    }
    else if(e.key === 'Tab'){
      e.preventDefault();
      const list = state.cols;
      if(list.length){
        let i = list.findIndex(c=> state.sel && state.sel.id === c.id);
        i = (i+1) % list.length;
        state.sel = { kind:'col', id: list[i].id };
        centerOn(list[i].x, list[i].y);
        uiDirty.side = true;
      }
    }
  });
  window.addEventListener('keyup', e=>{ keys[e.key] = false; });

  $('spd').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    const s = Number(b.dataset.s);
    if(s === 0) state.paused = true;
    else { state.paused = false; state.speed = s; }
  });

  document.body.addEventListener('click', e=>{
    const t = e.target.closest('[data-act]');
    if(!t) return;
    const act = t.dataset.act;
    if(act === 'selcol'){ state.sel = { kind:'col', id:Number(t.dataset.id) }; uiDirty.side = true; }
    else if(act === 'whyfix'){ toast(WHYFIX[t.dataset.k] || ''); }
    else if(act === 'follow'){
      const c = state.cols.find(x=> x.id === Number(t.dataset.id));
      if(c) centerOn(c.x, c.y);
    } else if(act === 'stop'){
      const c = state.cols.find(x=> x.id === Number(t.dataset.id));
      if(c){ c.job = null; c.path = null; c.state = 'idle'; c.sleeping = false; toast(c.name + ' 已停止工作'); }
    } else if(act === 'decon'){
      deconstructAt(Number(t.dataset.x), Number(t.dataset.y));
    } else if(act === 'unzone'){
      const x = Number(t.dataset.x), y = Number(t.dataset.y);
      clearZone(x, y);
      uiDirty.side = true;
    } else if(act === 'research'){
      showTech();
    } else if(act === 'cmd-rally'){
      state.build = { kind:'rally' };
      initBuild();
      toast('点击地图选择集结位置');
    } else if(act === 'cmd-retreat'){
      setCommand({ kind:'retreat' });
    } else if(act === 'cmd-clear'){
      setCommand(null);
    } else if(act === 'watch-inc' || act === 'watch-dec'){
      const step = act === 'watch-inc' ? 1 : -1;
      state.watch = clamp(state.watch + step, 0, watchCap());
      if(state.watchSet) assignGuards();     // 已排班就当场重排，不用等到明晚
      uiDirty.side = true;
    } else if(act === 'urge'){
      const k = t.dataset.k;
      if(k){
        state.urge = { k, day: state.day };
        uiDirty.side = true;
        toast('今天优先搞' + (itemName(k) || k));
      }
    } else if(act === 'crop'){
      const k = t.dataset.k;
      if(CROPS[k]){
        state.crop = k;
        uiDirty.side = true;
        toast(`以后播 ${CROPS[k].n} · ${CROPS[k].d}`);
      }
    } else if(act === 'decline-crisis'){
      const cr = (state.crises || []).find(c=> c.state === 'wait');
      if(cr) declineCrisis(cr);
    } else if(act === 'skill'){
      /* 单人面板带 id，小队面板不带 —— 不带就整队一起放 */
      const id = Number(t.dataset.id);
      if(id){
        const c = state.cols.find(x=> x.id === id);
        if(c) useSkill(c);
      } else useSkillOnSelection();
    }
  });

  $('build').addEventListener('click', e=>{
    const b = e.target.closest('.bld'); if(!b) return;
    setBuildFromBar(b.dataset.kind, b.dataset.v);
  });

  $('btnHelp').onclick = showHelp;
  $('btnSave').onclick = ()=> showSlots();
  $('btnMenu').onclick = showMenu;

  function syncSoundBtn(){
    const m = SFX.isMuted();
    const w = $('sndWave'), x = $('sndMute');
    if(w) w.style.display = m ? 'none' : '';
    if(x) x.style.display = m ? '' : 'none';
    $('btnSound').style.opacity = m ? 0.45 : 1;
  }
  $('btnSound').onclick = (e)=>{
    e.stopPropagation();
    SFX.unlock();
    const m = SFX.toggle();
    syncSoundBtn();
    toast(m ? '音效已关闭' : '音效已开启');
  };
  syncSoundBtn();

  /* 首次交互解锁音频（浏览器策略要求） */
  const unlock = ()=>{ SFX.unlock(); };
  window.addEventListener('pointerdown', unlock, { once:true });
  window.addEventListener('keydown', unlock, { once:true });

  /* 小地图：点击跳转视角 */
  const mb = $('miniBox');
  if(mb) mb.addEventListener('click', e=>{
    const r = mb.getBoundingClientRect();
    const nx = clamp((e.clientX - r.left - 6) / Math.max(1, r.width - 12), 0, 1);
    const ny = clamp((e.clientY - r.top - 6) / Math.max(1, r.height - 12), 0, 1);
    centerOn(Math.floor(nx*W), Math.floor(ny*H));
    clampCam();
  });
}

function pickActor(wx, wy){
  let best = null, bd = 16;
  for(const c of state.cols.concat(state.raiders)){
    const d = Math.hypot(wx - (c.fx*TS), wy - (c.fy*TS));
    if(d < bd){ bd = d; best = c; }
  }
  return best;
}

function updateCameraKeys(dt){
  const sp = 900*dt/cam.z;
  if(keys['w'] || keys['W'] || keys['ArrowUp']) cam.cy -= sp;
  if(keys['s'] || keys['S'] || keys['ArrowDown']) cam.cy += sp;
  if(keys['a'] || keys['A'] || keys['ArrowLeft']) cam.cx -= sp;
  if(keys['d'] || keys['D'] || keys['ArrowRight']) cam.cx += sp;
  clampCam();
}

/* =====================================================================
   20 · 弹窗
   ===================================================================== */
let modalPause = false;
function openModal(html){
  $('modalCard').innerHTML = html;
  $('modal').classList.remove('hide');
  if(!state.paused){ modalPause = true; state.paused = true; }
}
function closeModal(){
  $('modal').classList.add('hide');
  if(modalPause){ modalPause = false; state.paused = false; }
}
window.hideEnd = ()=>{ closeModal(); state.over = null; state.endAck = true; };
window.startEndless = ()=>{
  state.over = null; state.endAck = false; state.endless = true;
  state.goalDay = state.day + 10;
  closeModal();
  logEvent(`<b>无尽模式开启</b> · 接下来的目标是第 ${state.goalDay} 天，每达成一轮再推后 10 天。`, 'good');
  showAlert(`新目标 · 第 ${state.goalDay} 天`, false);
  toast('无尽模式：撑住');
};
window.markSeen = ()=>{ try{ localStorage.setItem('frontier-seen','1'); }catch(e){} };

/* 开局选择：剧本 + 难度 + 野心，三步都在同一个弹窗里 */
let introSel = { scen:'valley', diff:'std', amb:'hold' };
function scenPickHTML(){
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:7px;margin:8px 0 0">
    ${SCEN_KEYS.map(k=>{
      const s = SCEN[k], on = introSel.scen === k;
      return `<button class="btn${on?' pri':''}" style="display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:9px 11px;text-align:left;line-height:1.4"
        onclick="pickIntro('scen','${k}')">
        <b style="font-size:13px">${s.name}</b>
        <span style="font-size:11px;font-weight:400;color:${on?'inherit':'var(--ink3)'}">${s.tag}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function diffPickHTML(){
  return `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 2px">
    ${Object.keys(DIFFS).map(k=>{
      const d = DIFFS[k], on = introSel.diff === k;
      return `<button class="btn${on?' pri':''}" style="flex:none;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:11px 12px;text-align:left;line-height:1.45"
        onclick="pickIntro('diff','${k}')">
        <b style="font-size:13px">${d.name}</b>
        <span style="font-size:11px;font-weight:400;color:${on?'inherit':'var(--ink3)'}">${d.sub}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function introGoalDay(){
  /* 野心会改目标日（远征 +5 / 救人 +3 / 富商 +2）。这里漏掉的话，
     开局写着「撑到第 22 天」，实际却是第 27 天 —— 玩家按错的日子做规划。 */
  const ab = AMB[introSel.amb] || AMB.hold;
  const bonus = (ab.mod && ab.mod.goalBonus) || 0;
  return DIFFS[introSel.diff].goal + (SCEN[introSel.scen].goalDelta || 0) + bonus;
}

/* 野心（v1.8）：五张卡，每张写着「要什么」和「代价是什么」。
   代价必须写在卡面上 —— 玩家选之前得知道自己在放弃什么。 */
function ambPickHTML(){
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:7px;margin:8px 0 0">
    ${AMB_KEYS.map(k=>{
      const a = AMB[k], on = introSel.amb === k;
      return `<button class="btn${on?' pri':''}" style="display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:9px 10px;text-align:left;line-height:1.4"
        onclick="pickIntro('amb','${k}')">
        <b style="font-size:12.5px">${a.name}</b>
        <span style="font-size:10.5px;font-weight:400;color:${on?'inherit':'var(--ink3)'}">${a.tag}</span>
      </button>`;
    }).join('')}
  </div>`;
}

let introMode = 'intro';
window.pickIntro = (kind, v)=>{
  introSel[kind] = v;
  if(introMode === 'newgame') showNewGame(); else showIntro();
};
window.startRun = ()=>{
  markSeen();
  newGame(null, introSel.diff, introSel.scen, introSel.amb);
};

function showIntro(){
  introMode = 'intro';
  const sc = SCEN[introSel.scen] || SCEN.valley;
  const df = DIFFS[introSel.diff] || DIFFS.std;
  const ab = AMB[introSel.amb] || AMB.hold;
  openModal(`
    <h1>边陲 <small>FRONTIER · 殖民地模拟</small></h1>
    <p><b>剧本</b>决定地图、起始人手和物资，<b>难度</b>决定袭击强度与目标天数，
       <b>野心</b>决定这一局到底要做什么。</p>
    <h2>剧本</h2>
    ${scenPickHTML()}
    <p style="font-size:12px;color:var(--ink3);margin:10px 0 0;line-height:1.65">${sc.line}</p>
    <h2 style="margin-top:16px">野心</h2>
    ${ambPickHTML()}
    <p style="font-size:12px;color:var(--ink3);margin:10px 0 0;line-height:1.65">${ab.line}</p>
    <div style="display:flex;gap:16px;margin-top:10px">
      <div style="flex:1;min-width:0">
        <div class="mini-h">达成条件</div>
        <div style="font-size:12px;line-height:1.6"><b>${ab.goal}</b></div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="mini-h">代价</div>
        <div style="font-size:12px;line-height:1.6;color:#c08a4a">${ab.cost}</div>
      </div>
    </div>
    <h2 style="margin-top:16px">难度</h2>
    ${diffPickHTML()}
    <p style="margin-top:12px;font-size:12px;color:var(--ink3)">目标：撑到第 <b>${introGoalDay()}</b> 天。随时按 <span class="kbd">H</span> 看完整说明。</p>
    <div class="foot" style="justify-content:space-between">
      <button class="btn" onclick="markSeen();closeModal();showHelp()">怎么玩</button>
      <button class="btn pri" onclick="startRun()">在 ${sc.name} 落脚 · ${ab.name}</button>
    </div>
  `);
}

function showNewGame(){
  introMode = 'newgame';
  const sc = SCEN[introSel.scen] || SCEN.valley;
  const ab = AMB[introSel.amb] || AMB.hold;
  openModal(`
    <h1>新的一局 <small>NEW COLONY</small></h1>
    <p>会重新生成地图与居民，当前进度将丢失（未保存的改动不会保留）。</p>
    <h2>剧本</h2>
    ${scenPickHTML()}
    <p style="font-size:12px;color:var(--ink3);margin:10px 0 0;line-height:1.65">${sc.line}</p>
    <h2 style="margin-top:16px">野心</h2>
    ${ambPickHTML()}
    <p style="font-size:12px;color:var(--ink3);margin:10px 0 0;line-height:1.65">${ab.line}</p>
    <div style="display:flex;gap:16px;margin-top:10px">
      <div style="flex:1;min-width:0">
        <div class="mini-h">达成条件</div>
        <div style="font-size:12px;line-height:1.6"><b>${ab.goal}</b></div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="mini-h">代价</div>
        <div style="font-size:12px;line-height:1.6;color:#c08a4a">${ab.cost}</div>
      </div>
    </div>
    <h2 style="margin-top:14px">难度</h2>
    ${diffPickHTML()}
    <div class="foot" style="justify-content:space-between">
      <button class="btn" onclick="showMenu()">返回</button>
      <button class="btn pri" onclick="startRun()">在 ${sc.name} 落脚 · ${ab.name} · ${introGoalDay()} 天</button>
    </div>
  `);
}

function showHelp(){
  openModal(`
    <h1>边陲 <small>FRONTIER · 殖民地模拟</small></h1>
    <p>你带着三名幸存者在边境落脚。目标有两层：<b>撑过 ${state.goalDay} 天</b>，并在这之前<b>兑现你选的野心</b>。
       活到最后但野心没做成，结算会写「野心未竟」。</p>

    <h2>三步上手</h2>
    <div class="g2">
      <div class="tile"><div class="ic">1</div><div class="tx"><b>圈仓库 + 农田</b><span>先用「仓库区」在空地圈一块，居民才会把木头石头归堆；再圈「农田」并留人播种。</span></div></div>
      <div class="tile"><div class="ic">2</div><div class="tx"><b>造床与篝火</b><span>床决定睡眠质量，篝火让你能烹饪（3 食物 → 1 餐食），也提供夜间照明。</span></div></div>
      <div class="tile"><div class="ic">3</div><div class="tx"><b>修墙 + 哨戒炮</b><span>第 2 天起会有袭击。石墙能挡子弹，哨戒炮自动开火，记得留门。</span></div></div>
      <div class="tile"><div class="ic">4</div><div class="tx"><b>盯住三个需求条</b><span>饥饿、精力、心情任意一项见底都会让居民罢工甚至精神崩溃。</span></div></div>
    </div>

    <h2>操作</h2>
    <ul>
      <li><b>左键</b> 选中居民 / 放置建筑（建造模式会保持，方便连续摆放）</li>
      <li><b>左键拖框</b> 圈选多名居民（拖出 8 像素才算框，手抖仍是点选）；选好后<b>左键点地</b>整队移动，<b>点敌人</b>整队突击</li>
      <li><b>拖拽</b> 圈划区域（仓库、农田）　<b>右键</b> 取消当前模式 / <b>点敌人 = 全体集火</b></li>
      <li><b>中键拖拽</b> 平移视野　<b>滚轮</b> 缩放　<span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> 也能平移</li>
      <li><span class="kbd">空格</span> 暂停　<span class="kbd">[</span><span class="kbd">]</span> 减速 / 加速　<span class="kbd">Tab</span> 切换居民</li>
      <li><span class="kbd">1</span>–<span class="kbd">8</span> 快速选择建筑　<span class="kbd">Z</span> 撤销　<span class="kbd">M</span> 静音</li>
      <li><span class="kbd">F</span> 集结（再点地图选位置）　<span class="kbd">R</span> 全体撤退　<span class="kbd">G</span> 解除指令</li>
      <li><span class="kbd">Q</span> 战术技能（选中一人或一队，按各自武器出手）　<span class="kbd">Esc</span> 取消选择</li>
    </ul>

    <h2>野心与战场（v1.8 / v1.9）</h2>
    <ul>
      <li><b>五张野心</b>决定这局「为什么玩」：守成（目标日零死亡）、筑城（10 段墙 + 2 门炮）、远征（拆掉 3 处匪巢）、富商（成交 6 笔换回 200 资源）、救人（人口 ≥ 9）。每张同时改写胜利条件、袭击强度、流民与商队频率 —— 不是换记分牌。</li>
      <li><b>匪巢</b>：远征局地图上有三处。巢边有守卫时结构只吃 45% 伤害，得先清人；选中居民后左键点匪巢就是「拆巢」指令，15 小时内有效。每拆掉一处，后续袭击规模再降 16%。</li>
      <li><b>战术技能</b>：步枪「瞄准射击」下一枪 2.3 倍；手枪「速射」连开三枪；匕首「猛击」2.6 倍并把贴脸的人推开。冷却各自计算，不按也能打，按了明显省人。</li>
      <li><b>战术慢放</b>：场上敌人 ≥ 3 时自动切到 0.5 倍速，脱战恢复 —— 这是给你留出「框人、放技能」的时间。</li>
    </ul>

    <h2>v2.1 新增（种田这条线从头到尾都能插手了）</h2>
    <ul>
      <li><b>开荒</b>：圈出来的农田先是一块压着草皮的<b>荒地</b>，得有人把它翻开才能下种。开荒是重活，一格约 46 分钟、耗干劲最多 —— 一人一天大概开一亩。所以「圈多大」是真决策，不是免费的。</li>
      <li><b>选作物</b>：侧栏「农田」里四个小按钮，点一下换下一茬种什么。<br>
        <b>麦</b> 产量最高（约 9 食物），但长得最慢、地力掉得最快；<br>
        <b>豆</b> 产量最低（约 5），但长得快一倍多，而且<b>养地</b>；<br>
        <b>根菜</b> 中庸，<b>冬天照长</b>（其余作物冬天完全停摆）；<br>
        <b>药草</b> 不产粮，收 3 份药草 —— 医务所唯一的原料。</li>
      <li><b>地力</b>：每格地有自己的肥力（开荒时按土质定：花甸 82、湿地 74、草地 62、泥土 52、碎石 38、沙地 30）。收一茬麦扣一截、收一茬豆补回来。产量 = 品种 × 地力，所以连作麦第三年就会发现同一块地越收越少 —— 轮作不是装饰。</li>
      <li><b>偷粮贼</b>：<b>只在田里有熟作物时</b>才会摸过来，不动手、不拆墙，进田搬走六成收成（装够三份就跑）。他跑得比居民快，追不上；但挨了枪会丢下一半赃物加速逃，打死他能把粮全拿回来。<br>
        <span style="color:var(--ink3)">所以真正要管的不是「守住」，是「什么时候收」—— 熟着不收，就是在替他种。</span></li>
    </ul>

    <h2>v2.0 新增（这一版改的是「每天为什么还要拍板」）</h2>
    <ul>
      <li><b>干劲</b>：每人每天 100 点，砍树、挖石、砌墙、播种都要花。用完了就只剩轻活，他会自己走去篝火边坐着 —— 所以想同时推进伐木和修墙，就得多派一个人，而人不能复制。每天清晨回满，睡一觉能续一截。</li>
      <li><b>危机</b>：每局两场，有明确截止日，卡片就在右侧顶部。备齐了到期就过（全员心情 +6）；没备齐会砸下来；也可以点「不管了」主动认栽，只赔心情、不吃物理损失。卡片上的「<b>催工</b>」能让全营今天优先搞那一样东西。</li>
      <li><b>第二幕</b>：中局商人拿一箱石料铁件换一个人。成交就是永久少一个人、此后不再有新人加入；不卖则商队从此隔四天才来一次。这一步不能回头。</li>
      <li><b>旧伤</b>：伤口拖到 72 以上会落下永久旧伤（瘸腿 / 手抖 / 疤脸 / 伤肺），治不回去。建了医务所又有药草的人不会走到这一步 —— 所以那是一笔该花的钱。</li>
      <li><b>闲聊</b>：居民会按当下状态开口 —— 干活、累了、饿了、受伤、夜里站岗。那不是装饰，是「这个人现在怎么样」的最快读法。</li>
    </ul>

    <h2>v1.3 新增系统</h2>
    <ul>
      <li><b>工坊与科技树</b>：建成工坊后打开科技树，8 项研究一次一项，占用时间不占人手。石墙加固、弩机改良、草药学、轮作制、仓储扩容、皮甲缝制……</li>
      <li><b>伤与医务所</b>：受伤会累积「伤口」，只能靠自愈慢慢消。研究草药学后建医务所，用<b>药草</b>处理伤口（药草在地图上零星生长，居民会自动补到 4 份）。</li>
      <li><b>性格与关系</b>：每人 1~2 个特质（勤快 / 怯懦 / 乐观 / 孤僻 / 坚韧 / 巧手）。居民之间每天随机互动，处久了会成为朋友（同屏 +心情）或结怨（同屏 −心情）。</li>
      <li><b>兵种分化</b>：破门槌只拆墙、投石手专打残血、纵火者会点燃建筑（火焰持续烧蚀结构）。别再只靠加塔，要按兵种改阵型。</li>
      <li><b>掩体与撤退</b>：贴着岩壁或实心建筑能降低被命中率，居民会主动抢掩体位；血量见底会自动后撤。</li>
    </ul>

    <h2>难度与无尽</h2>
    <ul>
      <li><b>难度</b> 在开局时选择，也可以在暂停菜单里点「重开」重新挑：温和降低袭击规模并多给起始物资，严酷则把目标延长到第 16 天。</li>
      <li><b>无尽模式</b> 达成目标后可以选「继续坚守」，之后每达成一轮目标就再推后 10 天，袭击强度随天数持续爬升。</li>

    <h2>机制要点</h2>
    <ul>
      <li><b>居民会自己排顺序</b>：砍树、采矿、播种、收割、搬运、建造、做饭、吃饭、睡觉，按优先级自己排。但干劲有限 —— 自动的是「顺序」，不是「产能」。</li>
      <li><b>材料前置</b>：建筑放下时立刻扣资源，之后才会有人来施工，所以别在缺料时乱铺。</li>
      <li><b>石墙能挡枪</b>：射击需要视线，躲在墙后可以大幅提高命中率；但近战会被破墙。</li>
      <li><b>倒地不等于死亡</b>：生命归零会倒地，脱离危险后会慢慢爬起来。</li>
    </ul>

    <div class="foot"><button class="btn pri" onclick="closeModal()">知道了</button></div>
  `);
}

function showMenu(){
  const df = diffDef();
  openModal(`
    <h1>暂停 <small>PAUSED</small></h1>
    <p>第 <b>${state.day}</b> 天 · 居民 <b>${state.cols.length}</b> 人 · 难度 ${df.name}${state.endless ? ' · <b>无尽</b>' : ''} · 目标 ${state.goalDay} 天</p>
    <h2>存档</h2>
    <p style="font-size:12.5px">存档保存在浏览器本地（localStorage），换浏览器或清缓存会丢。</p>
    <div class="foot" style="justify-content:space-between">
      <div style="display:flex;gap:10px">
        <button class="btn" onclick="saveGame();toast('已保存')">保存</button>
        <button class="btn" onclick="loadGame()">读取</button>
        <button class="btn" onclick="showNewGame()">重开</button>
      </div>
      <button class="btn pri" onclick="closeModal()">继续</button>
    </div>
  `);
}

/* 终局：分档评价 + 分项得分，把"赢了/输了"变成"打得怎么样" */
const END_TXT = {
  S: { t:'边陲之城', s:'A REAL TOWN', c:'#f2b757',
       d:'路上开始有人来打听这里能不能落脚。你们不再是一处营地 —— 这里有了名字。' },
  A: { t:'站稳了', s:'STANDING FIRM', c:'#4ec9a5',
       d:'墙还在，人还在，粮仓里还剩得下东西。明年会容易一点。' },
  B: { t:'熬过去了', s:'SURVIVED', c:'#5a9ad4',
       d:'你们活到了开春，但代价刻在每个人脸上 —— 有人没能等到这一天。' },
  C: { t:'勉强活着', s:'BARELY', c:'#8a929c',
       d:'最后一夜过去，营地只剩几个人和半截塌墙。这不算赢，只是没全死。' },
  D: { t:'殖民地覆灭', s:'COLONY LOST', c:'#e2564d',
       d:'最后一名居民也倒下了。荒原重新收回了这片土地，风把栅栏吹倒了。' },
  /* v1.8：活到了最后一天，但野心没兑现 —— 这不是覆灭，是没做到 */
  ambfail: { t:'野心未竟', s:'UNFINISHED', c:'#c08a4a',
       d:'人还活着，火还烧着，但你当初想做的那件事没做成。荒原不在乎你活下来，它只在乎你有没有做到。' },
  /* v1.8：目标达成了，营地没了 —— 「惨胜」 */
  pyrrhic: { t:'惨胜', s:'PYRRHIC', c:'#b8794a',
       d:'你要做的那件事成了。代价是最后一天没有一个人站着。多年以后有人在火堆边讲这件事，讲的人自己也说不清算不算赢。' }
};
function showEnd(win){
  const g = finalGrade();
  const amb = ambDef();
  const pyrrhic = state.over === 'pyrrhic';
  const ambFail = !win && state.over === 'ambfail';
  const key = win ? g.grade : 'D';
  const tx = pyrrhic ? END_TXT.pyrrhic : (ambFail ? END_TXT.ambfail : END_TXT[key]);
  const sc = scenDef(), df = diffDef();
  const days = Math.min(state.day - 1, state.goalDay);
  const bars = g.parts.map(p=>`
    <div style="display:flex;align-items:center;gap:9px;margin:5px 0;font-size:12px">
      <span style="width:30px;color:var(--ink3)">${p.k}</span>
      <div class="bar thin" style="flex:1;height:5px"><i style="width:${p.v/p.max*100}%;background:${p.amb ? (win ? '#e8a33d' : '#c08a4a') : tx.c}"></i></div>
      <span class="num" style="width:42px;text-align:right;color:var(--ink3)">${p.v}/${p.max}</span>
    </div>`).join('');

  /* 野心达成清单：这是「这局为什么不算白打」的答案 */
  const lastSt = stageDefs()[2];
  const ambRows = lastSt ? lastSt.need.map(n=>{
    const b = needBar(n);
    return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;margin:4px 0">
      <span style="color:${b.ok ? '#4ec9a5' : 'var(--ink3)'}">${b.ok ? '✓' : '○'}</span>
      <span style="flex:1;color:var(--ink2)">${n.t}</span>
      <span class="num" style="color:${b.ok ? '#4ec9a5' : 'var(--ink3)'}">${b.v}${n.rev ? '≤' : '/'}${n.n}</span>
    </div>`;
  }).join('') : '';

  openModal(`
    <h1 class="${win ? 'win' : (pyrrhic || ambFail ? '' : 'dead')}">${tx.t}<small>${tx.s}</small></h1>
    <div style="display:flex;align-items:center;gap:16px;margin:14px 0 4px">
      <div style="width:66px;height:66px;border-radius:16px;flex:0 0 auto;display:grid;place-items:center;
        background:${tx.c}1f;border:1px solid ${tx.c}55;color:${tx.c};font-size:${(ambFail || pyrrhic) ? '17px' : '31px'};font-weight:600;line-height:1">${pyrrhic ? '惨胜' : (ambFail ? '未竟' : key)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:var(--ink);line-height:1.6">${tx.d}</div>
        <div style="font-size:11.5px;color:var(--ink3);margin-top:5px">
          ${sc.name} · ${df.name} · 野心「${amb.name}」 · 第 ${days}/${state.goalDay} 天 · 评分 <b>${g.sc}</b>
        </div>
      </div>
    </div>

    <h2>野心 · ${amb.name}</h2>
    <div style="font-size:12px;color:var(--ink3);margin:-2px 0 6px">${amb.goal}</div>
    ${ambRows}

    <h2>分项</h2>
    ${bars}

    <h2>战报</h2>
    <div class="g2">
      <div class="tile"><div class="ic">◈</div><div class="tx"><b>阶段 ${g.passed} / 3</b><span>${stageDefs().map(s=>s.name).join(' · ')}</span></div></div>
      <div class="tile"><div class="ic">◈</div><div class="tx"><b>存活 ${g.alive} / ${state.totalPop} 人</b><span>阵亡 ${state.stats.deaths || 0} · 击杀 ${state.stats.kills} · 研究 ${g.techN} 项</span></div></div>
      <div class="tile"><div class="ic">◈</div><div class="tx"><b>建造 ${state.stats.built} 座</b><span>伐木 ${Math.round(state.stats.wood)} · 采石 ${Math.round(state.stats.stone)}</span></div></div>
      <div class="tile"><div class="ic">◈</div><div class="tx"><b>遭遇袭击 ${state.stats.raids || 0} 人次</b><span>${g.passed >= 2 ? '防线基本立住了' : '防线还不够硬'}</span></div></div>
    </div>
    <div class="foot">
      <button class="btn" onclick="hideEnd()">继续观察</button>
      ${win ? `<button class="btn" onclick="startEndless()">继续坚守 · 无尽</button>` : ''}
      <button class="btn" onclick="showIntro()">换剧本</button>
      <button class="btn${win ? '' : ' pri'}" onclick="newGame()">再来一局</button>
    </div>
  `);
}

/* =====================================================================
   21 · 存档
   ===================================================================== */
const SAVE_KEY = 'frontier-save-v1';            /* 旧版单槽，仅用于兼容读取 */
const SLOT_KEYS = ['frontier-save-s1', 'frontier-save-s2', 'frontier-save-s3'];
const SLOT_NAMES = ['槽 1', '槽 2', '槽 3'];
let curSlot = 0;
try{ curSlot = Math.max(0, Math.min(2, Number(localStorage.getItem('frontier-slot')) || 0)); }catch(e){}

function slotMeta(i){
  try{
    const raw = localStorage.getItem(SLOT_KEYS[i]);
    if(!raw) return null;
    const d = JSON.parse(raw);
    return { day: d.day || 1, min: d.min || 0, pop: (d.cols || []).length,
             diff: d.diff || 'std', ts: d.ts || 0 };
  }catch(e){ return null; }
}
function fmtTs(ts){
  if(!ts) return '';
  const d = new Date(ts);
  const p = n=> String(n).padStart(2, '0');
  return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* 存档面板：3 槽 + 导出 / 导入 */
function showSlots(){
  const rows = SLOT_KEYS.map((_, i)=>{
    const m = slotMeta(i);
    const cur = i === curSlot;
    const info = m
      ? `第 <b>${m.day}</b> 天 · ${m.pop} 人 · ${(DIFFS[m.diff] || DIFFS.std).name}`
      : '<span style="color:var(--ink3)">空</span>';
    const sub = m ? fmtTs(m.ts) : '还没有存档';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;
        background:rgba(255,255,255,${cur ? '.06' : '.03'});border:1px solid ${cur ? 'rgba(232,163,61,.45)' : 'var(--line)'}">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--ink)">${SLOT_NAMES[i]}${cur ? ' <span class="tag a">当前</span>' : ''}</div>
        <div style="font-size:11px;color:var(--ink3);margin-top:2px">${info} · ${sub}</div>
      </div>
      <button class="btn" style="flex:0 0 auto;padding:7px 12px" onclick="doSave(${i})">保存</button>
      <button class="btn${m ? ' pri' : ''}" style="flex:0 0 auto;padding:7px 12px${m ? '' : ';opacity:.35'}"
        ${m ? `onclick="doLoad(${i})"` : 'disabled'}>读取</button>
    </div>`;
  }).join('');

  openModal(`
    <h1>存档<small>SAVE SLOTS</small></h1>
    <p style="font-size:12.5px;color:var(--ink3)">每天开始时自动存在当前槽。换槽不会丢东西。</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin:16px 0">${rows}</div>
    <div class="row">
      <button class="btn" onclick="exportSave()">导出 JSON</button>
      <button class="btn" onclick="importSave()">导入 JSON</button>
    </div>
    <div class="foot"><button class="btn" onclick="closeModal()">关闭</button></div>`);
}
window.doSave = (i)=>{ saveGame(i); toast('已保存到 ' + SLOT_NAMES[i]); showSlots(); };
window.doLoad = (i)=>{ closeModal(); loadGame(i); };
window.showSlots = showSlots;
window.exportSave = ()=>{
  let raw = null;
  try{ raw = localStorage.getItem(SLOT_KEYS[curSlot]); }catch(e){}
  if(!raw){ toast('当前槽是空的'); return; }
  const blob = new Blob([raw], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `frontier-d${state.day}-${Date.now().toString().slice(-5)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
  toast('已导出');
};
window.importSave = ()=>{
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = ()=>{
    const f = inp.files && inp.files[0];
    if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{
      try{
        const d = JSON.parse(String(rd.result));
        if(!d.tiles || !Array.isArray(d.tiles)) throw new Error('bad');
        d.ts = d.ts || Date.now();
        localStorage.setItem(SLOT_KEYS[curSlot], JSON.stringify(d));
        toast('已导入到 ' + SLOT_NAMES[curSlot] + '，点「读取」载入');
        showSlots();
      }catch(e){ toast('导入失败：不是有效的存档文件'); }
    };
    rd.readAsText(f);
  };
  inp.click();
};

const DECO_LIST = [null,'reed','flower','stone','pebble','tuft','ruin'];
const SP_LIST = ['oak','pine','birch','dead'];

function saveGame(slot){
  const si = (slot === undefined) ? curSlot : Math.max(0, Math.min(2, slot));
  try{
    const data = {
      v:3, w:W, h:H, min:state.min, day:state.day, res:{...state.res}, goalDay:state.goalDay,
      ts: Date.now(),
      diff:state.diff, endless:state.endless,
      scen: state.scen, amb: state.amb,
      stage: { idx: state.stage.idx, done: state.stage.done.slice(), failed: state.stage.failed.slice() },
      pending: state.pending.map(p=> ({ key:p.key, opt:p.opt, due:p.due })),
      usedChoices: state.usedChoices.slice(), totalPop: state.totalPop, skipRaid: state.skipRaid || 0,
      watch: state.watch, nightTimes: state.nightTimes, nightRepel: state.nightRepel,
      weather:state.weather, rain:state.rain, stats:{...state.stats}, seq:state.seq,
      tech: { done:{...state.tech.done}, cur:state.tech.cur, prog:state.tech.prog },
      cols: state.cols.map(c=>({
        id:c.id, name:c.name, x:c.x, y:c.y, fx:c.fx, fy:c.fy, hp:c.hp, maxHp:c.maxHp,
        down:c.down, downT:c.downT, needs:{...c.needs}, skill:{...c.skill},
        weapon:c.weapon, shirt:c.shirt, skin:c.skin, hair:c.hair, speed:c.speed,
        breakT:c.breakT, carry:c.carry, sleepT:c.sleepT, moodBias:c.moodBias||0,
        wound:c.wound||0, flee:c.flee||0, fatigue:c.fatigue||0,
        traits:(c.traits||[]).slice(), bonds:(c.bonds||[]).map(b=>({ id:b.id, v:b.v }))
      })),
      tiles: tiles.map(t=>[
        t.g, Math.round(t.v*999)?1:0, t.zone ? (t.zone === 'stock' ? 1 : 2) : 0,
        t.plant ? (t.plant.kind === 'tree' ? 1 : t.plant.kind === 'bush' ? 2 : t.plant.kind === 'herb' ? 4 : 3) : 0,
        t.plant ? Math.round((t.plant.grow||0)*100) : 0,
        t.plant && t.plant.berries ? t.plant.berries : 0,
        t.bld ? Object.keys(BL).indexOf(t.bld.type)+1 : 0,
        t.bld ? Math.round(t.bld.prog*100) : 0,
        t.bld ? Math.round(t.bld.hp) : 0,
        Math.round((t.h||0)*100), Math.round((t.m||0)*100),
        t.plant && t.plant.sp ? SP_LIST.indexOf(t.plant.sp) : -1,
        t.deco ? DECO_LIST.indexOf(t.deco) : 0,
        t.plant && t.plant.kind === 'herb' ? (t.plant.ready === false ? 0 : 1) : 0,
        t.bld ? Math.round(t.bld.burn || 0) : 0,
        /* v2.1 农田三件：土壤、地力、品种。追加在末尾 ——
           老存档读不到就是 undefined，按荒地 / 麦兜底，不会错位。 */
        t.soil === 'tilled' ? 1 : 0,
        Math.round((t.fert || 0) * 100),
        (t.plant && t.plant.kind === 'crop') ? Math.max(0, CROP_KEYS.indexOf(t.plant.crop)) : 0
      ]),
      items: tiles.map(t=> t.items ? t.items.map(s=>[s.kind, s.qty]) : 0),
      /* 匪巢的守卫不单独入档（它们是 raider），但"还剩几个"必须存 ——
         不存的话杀完守卫存个档再读回来，守卫又站回去了。 */
      dens: (()=>{
        const out = [];
        tiles.forEach((t, i)=>{
          if(!t.bld || t.bld.type !== 'den') return;
          const x = i % W, y = (i / W) | 0;
          out.push({ x, y, g: state.raiders.filter(r=> r.home && !r.dead
            && Math.hypot(r.home.x - x, r.home.y - y) < 0.6).length });
        });
        return out;
      })(),
      /* 危机（v2.0）：进度要跟着走，否则读档能把「已砸下来」的那场重打一遍 */
      crises: (state.crises || []).map(cr=> ({ id:cr.id, dueDay:cr.dueDay, seen:cr.seen, state:cr.state })),
      act2: state.act2 || null,
      crop: state.crop || 'wheat',
      thiefT: state.thiefT || 0
    };
    localStorage.setItem(SLOT_KEYS[si], JSON.stringify(data));
    curSlot = si;
    try{ localStorage.setItem('frontier-slot', String(si)); }catch(e){}
    return true;
  } catch(err){
    console.warn(err);
    toast('保存失败');
    return false;
  }
}

function loadGame(slot){
  const si = (slot === undefined) ? curSlot : Math.max(0, Math.min(2, slot));
  let raw = null;
  try{ raw = localStorage.getItem(SLOT_KEYS[si]); }catch(e){ raw = null; }
  if(!raw){
    /* 兼容 v1.3 及更早的单槽存档 */
    try{ raw = localStorage.getItem(SAVE_KEY); }catch(e){ raw = null; }
  }
  if(!raw){ toast(SLOT_NAMES[si] + ' 是空的'); return; }
  curSlot = si;
  try{ localStorage.setItem('frontier-slot', String(si)); }catch(e){}
  try{
    const d = JSON.parse(raw);
    /* 跨版本护栏：v1.0 是 58×42，v1.1 起是 72×52，直接按 W 索引会越界 */
    const tw = d.w || 0, th = d.h || 0;
    const tileCount = Array.isArray(d.tiles) ? d.tiles.length : 0;
    const mismatch = (tw && th && (tw !== W || th !== H)) || (!tw && tileCount !== W*H);
    if(mismatch){
      const desc = tw && th ? `${tw}×${th}` : `${tileCount} 格`;
      toast(`存档来自旧版地图（${desc}），与当前 ${W}×${H} 不兼容`);
      logEvent(`旧存档（${desc}）无法载入：地图结构已变更。`, 'bad');
      return;
    }
    restore(d);
    closeModal();
    toast('存档已载入');
  } catch(err){
    console.warn(err);
    window.__loadErr = String(err && err.message || err);
    toast('存档损坏');
  }
}

function restore(d){
  state.min = d.min; state.day = d.day; state.res = { ...(d.res || {}) };
  state.goalDay = d.goalDay || diffDef().goal;
  state.diff = d.diff && DIFFS[d.diff] ? d.diff : 'std';
  state.endless = !!d.endless;
  /* v1.5 剧本 / 阶段 / 延迟后果；旧存档按河谷、从第一阶段继续 */
  state.scen = d.scen && SCEN[d.scen] ? d.scen : 'valley';
  /* v1.8 野心：旧存档没有这个字段，按「守成」读 —— 那是 v1.7 的规则 */
  state.amb = d.amb && AMB[d.amb] ? d.amb : 'hold';
  mapSet(scenDef().map);
  state.stage = d.stage && typeof d.stage.idx === 'number'
    ? { idx: clamp(d.stage.idx, 0, 3), done: (d.stage.done || []).slice(), failed: (d.stage.failed || []).slice() }
    : { idx: 0, done: [], failed: [] };
  state.pending = Array.isArray(d.pending)
    ? d.pending.filter(p=> p && p.key && typeof p.due === 'number').map(p=> ({ key:p.key, opt:p.opt|0, due:p.due }))
    : [];
  state.usedChoices = Array.isArray(d.usedChoices) ? d.usedChoices.slice() : [];
  state.totalPop = d.totalPop || (d.cols || []).length || 3;
  state.skipRaid = d.skipRaid || 0;
  /* v1.6 守夜：夜间临时状态（onWatch / nightRaid）不入档，读档后当晚重新排班 */
  state.watch = typeof d.watch === 'number' ? clamp(d.watch, 0, 4) : 1;
  state.nightTimes = d.nightTimes || 0;
  state.nightRepel = d.nightRepel || 0;
  state.watchSet = false; state.nightRaid = null; state.guardSpot = null;
  state.weather = d.weather || '晴'; state.rain = d.rain || 0;
  state.stats = Object.assign({ wood:0, stone:0, kills:0, built:0, raids:0,
    deaths:0, dens:0, trades:0, wealth:0 }, d.stats || {});
  state.seq = d.seq || 1;
  state.tech = (d.tech && d.tech.done)
    ? { done:{ ...d.tech.done }, cur: d.tech.cur || null, prog: d.tech.prog || 0 }
    : { done:{}, cur:null, prog:0 };
  /* 危机（v2.0）。老存档没有这个字段 —— 补一套新的会让「刚读进来就结算」，
     所以老档一律当作没有危机，别凭空塞两场到别人头上。 */
  state.act2 = d.act2 || null;
  state.crises = Array.isArray(d.crises)
    ? d.crises.filter(o=> o && crisisDef(o.id))
             .map(o=> ({ id:o.id, dueDay:o.dueDay | 0, seen:!!o.seen, state:o.state || 'wait' }))
    : [];
  state.cmd = null;
  /* v2.1 农田 */
  state.crop = (d.crop && CROPS[d.crop]) ? d.crop : 'wheat';
  state.thiefT = d.thiefT || 0;
  state.over = null; state.endAck = false; state.raiders = []; state.fx = []; state.decals = []; state.log = [];
  state.paused = false; state.speed = 1;

  tiles = d.tiles.map((a,i)=>{
    const t = { g:a[0], v:rnd(), h:(a[9]||0)/100, m:(a[10]||0)/100, depth:0, shore:false,
                zone: a[2] === 1 ? 'stock' : a[2] === 2 ? 'farm' : null,
                soil: a[15] === 1 ? 'tilled' : null,
                fert: (a[16] || 0) / 100,
                plant:null, bld:null, deco: a[12] ? DECO_LIST[a[12]] : null,
                items: d.items && d.items[i] ? d.items[i].map(s=>({kind:s[0], qty:s[1]})) : null };
    /* 老存档读回来的熟地地力是 0 —— 按 0.6 兜底，否则产量系数会掉到下限 */
    if(t.soil === 'tilled' && !(t.fert > 0)) t.fert = groundFert(t.g);
    if(a[3]){
      const kind = a[3] === 1 ? 'tree' : a[3] === 2 ? 'bush' : a[3] === 4 ? 'herb' : 'crop';
      t.plant = { kind, grow:a[4]/100, sway:rnd()*TAU,
                  crop: (a[17] !== undefined && CROP_KEYS[a[17]]) ? CROP_KEYS[a[17]] : 'wheat',
                  berries: kind === 'bush' ? a[5] : 0, regrow:0,
                  ready: kind === 'herb' ? (a[13] === undefined ? true : a[13] !== 0) : true,
                  sp: (a[11] !== undefined && a[11] >= 0) ? SP_LIST[a[11]] : undefined };
    }
    if(a[6]){
      const type = Object.keys(BL)[a[6]-1];
      if(type){
        t.bld = { type, prog:a[7]/100, hp:a[8], cdT:0, ang:-Math.PI/2, burn:a[14] || 0 };
        if(type === 'den') t.bld.maxHp = 160;
      }
    }
    return t;
  });

  state.cols = d.cols.map(s=>{
    const c = makeColonist(s.name, s.x, s.y);
    Object.assign(c, s);
    c.needs = {...s.needs}; c.skill = {...s.skill};
    c.path = null; c.job = null; c.state = 'idle'; c.sleeping = false;
    c.onWatch = false; c.fatigue = s.fatigue || 0;
    /* v2.0 干劲：老存档没有这个字段，按满值兜底 */
    c.vigor = (typeof s.vigor === 'number') ? s.vigor : VIGOR_MAX;
    setupWeapon(c);
    c.maxHp = s.maxHp;
    return c;
  });
  /* 存档已记录账目，读回后不再重算，否则仓库区内的散料会被计两次 */
  if(!d.res || typeof d.res.wood !== 'number') recountRes();
  markWater();
  bakeTerrain();
  computeReach();

  /* 匪巢守卫和普通掠袭者一样不入档。读档后按存档里的数量补回来 ——
     老档没有 dens 字段，按每巢 2 名兜底（等价于 v1.8 的行为）。
     不补的话，读一次档就能白嫖三个空巢；一律补满的话，杀完守卫存档再读
     又会被打回原形，两种都不对，所以按实际数量存。 */
  const denGuard = {};
  /* 循环变量不能叫 d —— for 的声明会遮蔽参数 d，初始化表达式里就变成 TDZ */
  for(const gd of (Array.isArray(d.dens) ? d.dens : [])){
    if(gd && Number.isFinite(gd.x) && Number.isFinite(gd.y)) denGuard[gd.x + ',' + gd.y] = Math.max(0, gd.g | 0);
  }
  tiles.forEach((t, i)=>{
    if(!t.bld || t.bld.type !== 'den') return;
    const dx = i % W, dy = (i / W) | 0;
    /* 危险区缓存从地图重建（v1.8.1）：它不入档，读档后不补的话，
       居民会重新走到巢边捡东西 */
    state.dens = state.dens || [];
    if(!state.dens.some(o=> o.x === dx && o.y === dy)) state.dens.push({ x:dx, y:dy });
    const key = dx + ',' + dy;
    const n = (key in denGuard) ? denGuard[key] : 2;
    const adj = adjacentFree(dx, dy);
    /* 两个人不能站同一格：挤在一起会被当成一个人，看着也像少刷了守卫 */
    for(let k=0; k<n; k++){
      const s = adj[k % Math.max(1, adj.length)] || { x:dx, y:dy };
      const off = adj.length < 2 && k > 0 ? { x:clamp(s.x + k, 1, W-2), y:s.y } : s;
      const r = makeRaider(off.x, off.y, 1, 'warden');
      r.home = { x:dx, y:dy };
      state.raiders.push(r);
    }
  });

  uiDirty.side = true; uiDirty.log = true;
  centerOn(W>>1, H>>1);
}

