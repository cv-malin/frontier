const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const P = path.join(ROOT, 'PRD-边陲-v1.7.html');
fs.copyFileSync(path.join(ROOT, 'PRD-边陲-v1.6.html'), P);
let h = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const rep = (a, b, tag) => {
  if (!h.includes(a)) { console.log('MISS:', tag || a.slice(0, 60)); return; }
  h = h.split(a).join(b); n++;
};

/* ---------- 封面与修订记录 ---------- */
rep('<div class="bs">v1.6 · 2026-10-28</div>', '<div class="bs">v1.7 · 2026-10-28</div>', 'cover');
rep('<div class="k">文档版本</div><div class="v">v1.6</div>', '<div class="k">文档版本</div><div class="v">v1.7</div>', 'docver');
rep('<div class="k">产品版本</div><div class="v">1.6.0</div>', '<div class="k">产品版本</div><div class="v">1.7.0</div>', 'prodver');
rep('<div class="k">状态</div><div class="v">已实现 · 守夜与夜袭</div>',
    '<div class="k">状态</div><div class="v">已实现 · 个人指令与战术时间</div>', 'status');

const rev = `<tr><td><b>v1.7</b></td><td>2026-10-28</td><td>操作层：把"对全体下令"扩展为"对个体下令"。新增个人指令（选中居民后左键点地面=移动、点掠袭者=突击，时限 240 游戏分钟、到期自动交还 AI）、战术降速（接敌时高倍速自动降一档）、指令可视化（虚线 + 目标环）与侧栏指令倒计时。新增 §5.19、§9.8、§11.9，FR-5.19.1–5.19.12、AC-71–AC-80。</td></tr>
    <tr><td><b>v1.6</b></td><td>2026-10-28</td>`;
rep('<tr><td><b>v1.6</b></td><td>2026-10-28</td>', rev, 'rev');

/* ---------- §5.19 ---------- */
const s519 = `<h3 id="s5-19">5.19 个人指令与战术时间 <span class="b b-new">v1.7 新增</span></h3>

<p><b>问题：</b>在 v1.6 之前，玩家能下达的命令只有三条 —— <b>集结、撤退、集火</b>，而且全是<b>全体级</b>的。
你没法说"让老周守住那个缺口"，只能说"所有人往这儿靠"。于是战斗时玩家实际上是个观众：
看着小人各自挑最近的敌人、各自找掩体，赢了不知道赢在哪，输了也不知道该改什么。</p>

<p>还有一层更隐蔽的原因：<b>时间尺度不匹配</b>。一场袭击在 4 倍速下三秒就结束，
而玩家的反应时间是零点几秒 —— 也就是说，即使给了指挥能力，玩家也没有<b>介入的窗口</b>。</p>

<div class="callout">
<b>本章的设计目标不是"加内容"，是"把秒级的那一段时间交回给玩家"。</b>
v1.5 解决了"有没有结构"，v1.6 解决了"夜晚有没有决策"，本章解决的是<b>手能不能动</b>。
所以它刻意做得很小：不加新单位、不加新技能，只加"点谁、让他去哪、打谁"。
</div>

<h4>5.19.1 指令类型</h4>
<table class="compact">
  <thead><tr><th style="width:110px">指令</th><th style="width:150px">下达方式</th><th>行为</th></tr></thead>
  <tbody>
    <tr><td><b>移动</b></td><td>选中居民 → 左键点空地</td><td>放弃当前工作，寻路到目标格；<b>到达即交还 AI</b>，他会自己接着干活或就近接战</td></tr>
    <tr><td><b>突击</b></td><td>选中居民 → 左键点掠袭者</td><td>立刻转入交战状态并锁定该目标；目标脱离视野会自己追，目标死亡则指令结束</td></tr>
    <tr><td><b>取消</b></td><td><code>Esc</code></td><td>解除选中；已有指令继续执行到时限</td></tr>
  </tbody>
</table>

<p>指令只对<b>单个居民</b>生效，不覆盖全局命令（集结 / 撤退 / 集火）。优先级为
<b>个人指令 &gt; 全局命令 &gt; 自主 AI</b>：全局撤退时，被单独指派的人仍然执行自己的命令。</p>

<h4>5.19.2 时限与交还</h4>
<p>每条指令带 <b>240 游戏分钟</b>（约 4 小时）时限，到点无条件交还 AI。</p>
<div class="callout">
<b>为什么必须有硬时限：</b>v1.6 的守夜功能踩过同一个坑 —— 换班时只清了 <code>onWatch</code> 标记、
没清 <code>job.type</code>，那个人从此不再被重新分配工作，白天不干活也不睡觉，体力从 87 掉到 0，三人营地直接崩盘。
只要允许"无限期接管"，玩家一次忘记就会复现同样的结局。<b>时限是安全阀，不是平衡手段。</b>
</div>
<p>以下三种情况提前结束指令：① 移动指令抵达目标（<code>±1.2</code> 格）；② 突击目标死亡或倒地；③ 寻路失败（目标不可达）。</p>

<h4>5.19.3 战术降速</h4>
<table class="compact">
  <thead><tr><th style="width:130px">条件</th><th>行为</th></tr></thead>
  <tbody>
    <tr><td>接敌时倍速 &gt; 1</td><td>自动降为 1 倍速，弹一条提示"接敌 · 已降为 1 倍速，随时可按 3 加速"</td></tr>
    <tr><td>已暂停</td><td>不改动（玩家自己停的，说明他正要指挥）</td></tr>
    <tr><td>1 倍速下接敌</td><td>不改动，只弹警报</td></tr>
  </tbody>
</table>
<p>只降<b>一档</b>、不暂停：暂停会打断节奏，降速只是把镜头放慢，玩家随时可以按回去。
实测 4 倍速下一场战斗约 3 秒，1 倍速下约 13 秒 —— 后者才够下两到三道令。</p>

<h4>5.19.4 视觉与状态反馈</h4>
<table class="compact">
  <thead><tr><th style="width:150px">元素</th><th>表现</th></tr></thead>
  <tbody>
    <tr><td>选中环</td><td>脚下琥珀色椭圆环（沿用 v1.3）</td></tr>
    <tr><td>移动指令</td><td>从人到目标格的<b>琥珀色虚线</b>，目标处一个椭圆环 + 实心点，随呼吸脉动</td></tr>
    <tr><td>突击指令</td><td>同上，改为<b>红色</b>，目标端跟随敌人实时移动</td></tr>
    <tr><td>侧栏状态</td><td>职业行显示「听令 · 移动 / 听令 · 突击」，状态区多一行「指令 · 剩 N 分」</td></tr>
    <tr><td>下达瞬间</td><td>移动：目标点扩散环 + 音效；突击：目标掠袭者高亮 + 警报音</td></tr>
  </tbody>
</table>

<h4>5.19.5 与既有系统的关系</h4>
<p>指令是<b>纯增量</b>：没有玩家输入时 <code>order</code> 恒为 <code>null</code>，AI 行为与 v1.6 逐位一致。
这一点已在回归中验证（5 剧本 × 2 种子 × 2 难度，胜负分布与 v1.6 完全相同）。</p>
<p>三条边界：① 睡着的人不接受指令（叫醒一个睡着的人去干活，等于把 5.19.2 那个坑换个地方再挖）；
② 崩溃、倒地、被袭击打断时指令照常计时；③ 指令<b>不入存档</b>，读档后当晚重排。</p>

<h4>5.19.6 需求条目</h4>
<table class="compact">
  <thead><tr><th style="width:110px">编号</th><th>需求</th></tr></thead>
  <tbody>
    <tr><td><b>FR-5.19.1</b> 选中粒度</td><td>点击居民后进入"个人指挥"状态；点击其他居民切换选中；<code>Esc</code> 取消</td></tr>
    <tr><td><b>FR-5.19.2</b> 移动指令</td><td>选中居民时左键点可通行空地，下达移动指令并显示目标环</td></tr>
    <tr><td><b>FR-5.19.3</b> 突击指令</td><td>选中居民时左键点掠袭者，立即转入交战并锁定该目标</td></tr>
    <tr><td><b>FR-5.19.4</b> 不抢占建筑</td><td>点击建筑仍进入建筑/地块详情，不下达指令</td></tr>
    <tr><td><b>FR-5.19.5</b> 时限</td><td>指令时限 240 游戏分钟，到点自动交还 AI 并清空状态</td></tr>
    <tr><td><b>FR-5.19.6</b> 到达即交还</td><td>移动指令抵达目标 ±1.2 格内立即结束，不占用后续时间</td></tr>
    <tr><td><b>FR-5.19.7</b> 目标失效</td><td>突击目标死亡 / 倒地 / 不存在时，指令立即结束</td></tr>
    <tr><td><b>FR-5.19.8</b> 优先级</td><td>个人指令优先于全局命令与自主 AI；全局撤退不打断个人指令</td></tr>
    <tr><td><b>FR-5.19.9</b> 拒绝睡眠目标</td><td>对睡着的居民下达指令时拒绝并提示"已经睡下了，叫不醒"</td></tr>
    <tr><td><b>FR-5.19.10</b> 战术降速</td><td>接敌时倍速 &gt; 1 且未暂停，自动降为 1 倍速并提示</td></tr>
    <tr><td><b>FR-5.19.11</b> 倒计时显示</td><td>侧栏显示指令类型与剩余分钟，逐分钟刷新</td></tr>
    <tr><td><b>FR-5.19.12</b> 不入档</td><td>指令为临时状态，不写入存档；读档后不残留</td></tr>
  </tbody>
</table>

<h2 id="s6"><span class="no">06 / UI &amp; UX</span>界面与交互</h2>`;
rep('<h2 id="s6"><span class="no">06 / UI &amp; UX</span>界面与交互</h2>', s519, 's519');

/* ---------- §9.8 ---------- */
const s98 = `<h3 id="s9-8">9.8 v1.7 新增验收（个人指令）</h3>
<table class="compact">
  <thead><tr><th style="width:70px">编号</th><th style="width:120px">项</th><th>判定</th></tr></thead>
  <tbody>
    <tr><td><b>AC-71</b></td><td>移动指令生效</td><td>对 8 格外的可达目标下移动指令，40 游戏分钟后与目标距离显著缩短</td></tr>
    <tr><td><b>AC-72</b></td><td>到期交还</td><td>指令下达 240 分钟后 <code>order</code> 为空，居民恢复自主工作</td></tr>
    <tr><td><b>AC-73</b></td><td>到达即交还</td><td>移动指令抵达目标 1 格内后立即清空，不占用剩余时限</td></tr>
    <tr><td><b>AC-74</b></td><td>突击生效</td><td>对掠袭者下突击指令后，该居民当帧进入交战状态且锁定目标</td></tr>
    <tr><td><b>AC-75</b></td><td>拒绝睡眠目标</td><td>对睡眠中的居民下单返回失败且不产生指令，界面给出提示</td></tr>
    <tr><td><b>AC-76</b></td><td>战术降速</td><td>4 倍速下接敌，倍速变为 1 并弹出提示；1 倍速下接敌倍速不变</td></tr>
    <tr><td><b>AC-77</b></td><td>不入档</td><td>带指令存档并读档后，所有居民 <code>order</code> 为空</td></tr>
    <tr><td><b>AC-78</b></td><td>可视化</td><td>有指令的居民与目标之间出现虚线，目标处有椭圆环；无指令时不绘制</td></tr>
    <tr><td><b>AC-79</b></td><td>无回归</td><td>不加指令时 AI 行为与 v1.6 一致：长局回归胜负分布相同</td></tr>
    <tr><td><b>AC-80</b></td><td>零报错</td><td><code>?v17 / ?v16 / ?v15 / ?v14 / ?iotest / ?dump</code> 全部通过，<code>errs</code> 为空，默认地图直方图逐位一致</td></tr>
  </tbody>
</table>

<h2 id="s10"><span class="no">10 / METRICS</span>度量与埋点</h2>`;
rep('<h2 id="s10"><span class="no">10 / METRICS</span>度量与埋点</h2>', s98, 's98');

/* ---------- §11.9 ---------- */
const s119 = `<h3 id="s11-9">11.9 v1.7 交付清单与回归实测</h3>
<table class="compact">
  <thead><tr><th style="width:130px">交付项</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>个人指令</td><td><code>giveOrder / runOrder / clearOrder</code>（<code>js/3-sim.js</code>），插入居民状态机最高优先级</td></tr>
    <tr><td>输入映射</td><td>选中居民 + 左键：点空地=移动、点掠袭者=突击；<code>Esc</code> 取消选中（<code>js/4-ui.js</code>）</td></tr>
    <tr><td>指令可视化</td><td>虚线 + 目标环 + 实心点，移动为琥珀色、突击为红色（<code>js/2-render.js</code>）</td></tr>
    <tr><td>战术降速</td><td><code>spawnRaid</code> 内降档并提示（<code>js/3-sim.js</code>）</td></tr>
    <tr><td>侧栏反馈</td><td>「听令 · 移动 / 突击」+「指令 · 剩 N 分」+ 操作提示（<code>js/4-ui.js</code>）</td></tr>
    <tr><td>自检</td><td><code>?v17=1</code> 十项断言（含到期交还、拒绝睡眠、不入档）</td></tr>
    <tr><td>演示参数</td><td><code>?order=1</code> 生成一场交火并选中一名居民下突击令，停在可截图状态</td></tr>
  </tbody>
</table>

<p><b>回归实测（无玩家输入，验证纯增量）：</b></p>
<table class="compact">
  <thead><tr><th style="width:100px">难度</th><th style="width:90px">胜/总</th><th>评级分布</th><th style="width:150px">与 v1.6 对比</th></tr></thead>
  <tbody>
    <tr><td>温和</td><td>10 / 10</td><td>S×2 · A×5 · B×3</td><td>完全一致</td></tr>
    <tr><td>标准</td><td>6 / 10</td><td>A×3 · B×1 · D×5（阵亡）</td><td>完全一致</td></tr>
  </tbody>
</table>
<p>结论：<b>不加指令时 AI 行为逐局不变</b>，说明本版是叠加在旧逻辑之上的操作层，没有悄悄改变原有数值。
其余自检 <code>?v16 / ?v15 / ?v14 / ?iotest</code> 全部通过，默认地图直方图
<code>2002/131/57/483/625/141/281/24</code> 与 v1.4–v1.6 逐位一致。</p>

<h2 id="s12"><span class="no">12 / RISK</span>风险登记</h2>`;
rep('<h2 id="s12"><span class="no">12 / RISK</span>风险登记</h2>', s119, 's119');

fs.writeFileSync(P, h, 'utf8');
console.log('done, replacements =', n, 'size =', h.length);

const open = (h.match(/<div\b/g) || []).length, close = (h.match(/<\/div>/g) || []).length;
const to = (h.match(/<table\b/g) || []).length, tc = (h.match(/<\/table>/g) || []).length;
console.log('div', open, close, open === close ? 'BALANCED' : 'MISMATCH');
console.log('table', to, tc, to === tc ? 'BALANCED' : 'MISMATCH');
