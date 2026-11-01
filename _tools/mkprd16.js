const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const P = path.join(ROOT, 'PRD-边陲-v1.6.html');
fs.copyFileSync(path.join(ROOT, 'PRD-边陲-v1.5.html'), P);
let h = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const rep = (a, b, tag) => {
  if (!h.includes(a)) { console.log('MISS:', tag || a.slice(0, 60)); return; }
  h = h.split(a).join(b); n++;
};

/* ---------- 封面与修订记录 ---------- */
rep('<div class="bs">v1.5 · 2026-10-28</div>', '<div class="bs">v1.6 · 2026-10-28</div>', 'cover');
rep('<div class="k">文档版本</div><div class="v">v1.5</div>', '<div class="k">文档版本</div><div class="v">v1.6</div>', 'docver');
rep('<div class="k">产品版本</div><div class="v">1.5.0</div>', '<div class="k">产品版本</div><div class="v">1.6.0</div>', 'prodver');
rep('<div class="k">状态</div><div class="v">已实现 · 剧本与阶段结构</div>',
    '<div class="k">状态</div><div class="v">已实现 · 守夜与夜袭</div>', 'status');

const rev = `<tr><td><b>v1.6</b></td><td>2026-10-28</td><td>玩法层：把夜晚从"全员睡觉的八小时"改成"每夜一次的赌注"。新增夜袭（23:30 掷骰、规模约白天六成、从最近边界摸上来）、值守名额（0–4 人、火边打盹、遇袭才熬通宵）、偷袭判定（睡着的目标承伤 ×1.7）、夜间视野惩罚（无火把命中 ×0.75）、篝火压制（概率与规模双降）、新科技「守夜轮值」。新增 §5.18、§9.7、§11.7，FR-5.18.1–5.18.16、AC-61–AC-70。</td></tr>
    <tr><td><b>v1.5</b></td><td>2026-10-28</td>`;
rep('<tr><td><b>v1.5</b></td><td>2026-10-28</td>', rev, 'rev');

/* ---------- §5.18 ---------- */
const s518 = `<h3 id="s5-18">5.18 守夜与夜袭 <span class="b b-new">v1.6 新增</span></h3>

<p><b>问题：</b>v1.5 之前，一天的节奏是这样的 —— 06:00 结算、白天干活、21:30 全员上床、05:30 起床。
也就是说，<b>每局有八个小时既没有威胁，也没有决策</b>。这八小时只做一件事：恢复体力。
而策略游戏的紧张感恰恰来自"资源不够分"，夜里把所有人力都拿去睡觉，等于每天放弃一次取舍机会。</p>

<p>本章只做一件事：<b>让夜晚成为一个要下注的时段</b>。玩家每晚决定派几个人不睡，
去赌"今晚会不会有人摸上来"。赌对了省一场损失，赌错了第二天少半天人力。</p>

<div class="callout">
<b>为什么选这一处动刀：</b>它同时修掉了两个问题 —— ① 玩法只有一条路（白天生产、晚上睡觉，任何剧本都一样）；
② 反馈延迟太长（一个决定要三天后才知道对不对）。守夜的反馈是<b>当晚</b>就有的：来没来、死没死人、明天谁在打瞌睡。
</div>

<h4>5.18.1 夜间时序</h4>
<table class="compact">
  <thead><tr><th style="width:90px">时刻</th><th style="width:130px">事件</th><th>规则</th></tr></thead>
  <tbody>
    <tr><td><b>21:30</b></td><td>排班</td><td>按玩家设定的值守人数点名，被点到的人不睡、去篝火旁站岗；同时掷骰决定今夜是否有夜袭</td></tr>
    <tr><td><b>23:30</b></td><td>判定</td><td>有夜袭 → 出兵；没有 → <b>换班</b>，守卫回去睡，只扣少量体力与心情</td></tr>
    <tr><td><b>05:30</b></td><td>收工</td><td>熬过通宵的守卫挂上"疲劳"，次日上半天效率下降，会睡到 10:00 补觉</td></tr>
  </tbody>
</table>

<h4>5.18.2 值守名额与点名规则</h4>
<p>侧栏常驻「今夜值守」面板，用 −/+ 调 0–4 人，改动即时生效（已排班时当场重排）。点名按三项加权排序，
取分数最高的 N 人：<code>血量比 × 40 + 体力 × 0.6 + 格斗技能 × 2</code>。
体力低的人自动被轮换出去，所以连续守夜不会一直压在同一个人身上。</p>

<h4>5.18.3 夜袭的概率与规模</h4>
<table class="compact">
  <thead><tr><th style="width:150px">项</th><th>公式 / 取值</th></tr></thead>
  <tbody>
    <tr><td>触发条件</td><td>第 3 天起；<b>当天是白天袭击日则不掷骰</b>（一天两波只会让人疲惫，不会让人紧张）</td></tr>
    <tr><td>概率</td><td><code>0.14 + (天数 − 3) × 0.022</code>，再加剧本修正，再减篝火压制（每座 −8%，上限 −24%），钳制在 0–75%</td></tr>
    <tr><td>剧本修正</td><td>冬临 +10%（夜长）、疫区 +6%（病弱）、断崖 −12%（崖壁难爬）、商道 −2%</td></tr>
    <tr><td>规模</td><td><code>(1 + ⌊天/3⌋ + ⌊人口/3⌋) × 0.42 × 难度 × 剧本袭击系数 × 剧本夜袭系数</code>，再乘篝火压制（每座 −15%），上限 8 人</td></tr>
    <tr><td>出生点</td><td>从<b>离营地最近</b>的可达边界摸上来（白天袭击是随机边界），反应窗口明显更短</td></tr>
    <tr><td>强度</td><td>兵种等级 <code>⌊天/3⌋</code>，白天袭击不加难度补偿</td></tr>
  </tbody>
</table>

<h4>5.18.4 代价与结算</h4>
<table class="compact">
  <thead><tr><th style="width:130px">情形</th><th>消耗</th><th>次日</th></tr></thead>
  <tbody>
    <tr><td>站岗（21:30–23:30）</td><td>火边打盹，体力按 <b>+0.075/分</b> 恢复（睡床是 +0.30/分）</td><td>—</td></tr>
    <tr><td>平安夜换班</td><td>体力 −10、心情 −2</td><td>正常</td></tr>
    <tr><td>遇袭熬通宵</td><td>体力 −12、心情 −7</td><td><b>疲劳</b>：上半天工作速度 ×0.84（研究「守夜轮值」后 ×0.93），睡到 10:00 才起</td></tr>
    <tr><td>无人值守</td><td>睡着的人被击中时承伤 <b>×1.7</b>，且被打醒（会清空当前工作）</td><td>—</td></tr>
    <tr><td>夜间视野</td><td>没有火把的居民命中 <b>×0.75</b>；值守者举火，不受影响</td><td>—</td></tr>
  </tbody>
</table>

<div class="callout">
<b>设计要点：守夜的昂贵只体现在"真的打起来"。</b>第一版实现让守卫整夜不睡、次日效率 −26%，
结果无论当晚有没有敌人都要付全价，等于给玩家加了一份固定税 —— 实测中三人营地会因此稳定崩盘。
改成"打盹 + 平安夜换班"之后，成本才落在它该落的地方：<b>遇袭的夜晚很贵，平静的夜晚几乎免费</b>。
</div>

<h4>5.18.5 新科技：守夜轮值</h4>
<table class="compact">
  <thead><tr><th style="width:110px">科技</th><th style="width:150px">成本 / 时间</th><th>效果</th></tr></thead>
  <tbody>
    <tr><td>守夜轮值</td><td>木 18 · 食 6 · 180</td><td>疲劳惩罚由 ×0.84 提到 ×0.93；值守者当夜修墙速度 +50%</td></tr>
  </tbody>
</table>
<p>它把"科技选择"从纯数值拉到了夜晚：选了它，你就更敢在后期连续排人守夜；不选，就得靠篝火和墙省人。</p>

<h4>5.18.6 需求条目</h4>
<table class="compact">
  <thead><tr><th style="width:120px">编号</th><th>需求</th></tr></thead>
  <tbody>
    <tr><td><b>FR-5.18.1</b> 排班时刻</td><td>每日 21:30 自动排班，玩家设定的人数在 0–4 之间钳制，且不超过存活人数。</td></tr>
    <tr><td><b>FR-5.18.2</b> 点名规则</td><td>按「血量比×40 + 体力×0.6 + 格斗×2」降序取前 N 人；同分按 id 升序。</td></tr>
    <tr><td><b>FR-5.18.3</b> 唤醒</td><td>被点名的人若已躺下，必须被唤醒（清空睡眠与当前工作），体力低于 9 时放弃唤醒。</td></tr>
    <tr><td><b>FR-5.18.4</b> 站岗</td><td>守卫前往篝火旁（无篝火则床铺质心）最近的空位，按 id 偏移避免重叠；每 20 分钟修补半径 3 内最破的一座实心建筑。</td></tr>
    <tr><td><b>FR-5.18.5</b> 打盹</td><td>守卫在夜间不扣体力，改为 +0.075/分。</td></tr>
    <tr><td><b>FR-5.18.6</b> 掷骰</td><td>21:30 掷一次，结果当晚不变；玩家在 21:30 后调整人数不影响已定的敌情，只影响应战人手。</td></tr>
    <tr><td><b>FR-5.18.7</b> 平安夜</td><td>23:30 无夜袭时自动换班，守卫解除岗位、回床、体力 −10、心情 −2。</td></tr>
    <tr><td><b>FR-5.18.8</b> 遇袭</td><td>23:30 出兵，从最近可达边界生成；镜头甩向敌情、屏幕泛红、播放警报。</td></tr>
    <tr><td><b>FR-5.18.9</b> 偷袭</td><td>睡眠中的居民被掠袭者击中时承伤 ×1.7，同时被唤醒并清空当前工作。</td></tr>
    <tr><td><b>FR-5.18.10</b> 夜间视野</td><td>夜间（21:30–05:30）非守卫居民的射击命中 ×0.75。</td></tr>
    <tr><td><b>FR-5.18.11</b> 篝火压制</td><td>每座建成的篝火使夜袭概率 −8%（上限 −24%）、规模 −15%（上限 −36%）。</td></tr>
    <tr><td><b>FR-5.18.12</b> 疲劳</td><td>熬通宵的守卫次日上半天（12:00 前）工作速度 ×0.84，有「守夜轮值」时为 ×0.93。</td></tr>
    <tr><td><b>FR-5.18.13</b> 补觉</td><td>疲劳者体力低于 42 时白天会去睡，睡到体力 82 或 10:00 才起。</td></tr>
    <tr><td><b>FR-5.18.14</b> 面板</td><td>侧栏常驻「今夜值守」：人数 −/+、夜袭风险百分比、篝火数、在岗名单、本局夜袭与"有备"次数。</td></tr>
    <tr><td><b>FR-5.18.15</b> 成员标记</td><td>值守者在成员列表显示「守夜中」，地图上带火把光晕与状态点。</td></tr>
    <tr><td><b>FR-5.18.16</b> 存档</td><td>人数、夜袭次数、"有备"次数、每人疲劳标记随存档往返；夜间临时状态（值守/敌情）不入档，读档后当晚重排。</td></tr>
  </tbody>
</table>

<div class="callout">
<b>平衡备注（实测记录）：</b>本章实现过程中发现三个会让整局"静默崩盘"的问题，均已修复并写入回归：
① 守卫只被标记、没有被真正叫醒 —— 他 21:30 已经躺下，睡眠分支不会因为标记就醒；
② 换班时只清标记、没清岗位 —— <code>job.type</code> 仍是 guard，这个人将永远不再被重新分配工作，白天不干活也不睡觉，体力一路掉到 0；
③ 夜袭与白天袭击日几乎完全重叠 —— 原规则要求"今天和明天都不是袭击日"，而袭击日每两天一次，导致整局只掷得出 1–2 次。
三者的共同症状都是<b>看起来一切正常，但玩家在第三天就输了</b>。这也说明为什么改动必须跑长局回归，短测是看不出来的。
</div>

`;
rep('<h2 id="s6">', s518 + '<h2 id="s6">', 'insert-518');

/* ---------- §9.7 ---------- */
const s97 = `<h3>9.7 v1.6 守夜与夜袭验收 <span class="b b-new">v1.6 新增</span></h3>
<table class="compact">
  <thead><tr><th style="width:90px">编号</th><th>用例</th><th style="width:230px">通过标准</th></tr></thead>
  <tbody>
    <tr><td><b>AC-61</b></td><td>21:30 自动排班</td><td>值守人数为 2 时，恰好 2 人被标记且在岗；日志出现排班记录</td></tr>
    <tr><td><b>AC-62</b></td><td>点名上限</td><td>设 4 人但只剩 2 人存活时，实际值守 2 人，面板显示 <code>2 / 2</code></td></tr>
    <tr><td><b>AC-63</b></td><td>平安夜换班</td><td>23:30 无夜袭时全员解除岗位，日志出现"守到半夜"，次日无疲劳标记</td></tr>
    <tr><td><b>AC-64</b></td><td>夜袭出兵</td><td>23:30 有夜袭时敌人数 > 0，屏幕泛红，警报音效触发</td></tr>
    <tr><td><b>AC-65</b></td><td>偷袭倍率</td><td>睡眠目标承伤为清醒目标的 1.7 倍（容差 ±5%）</td></tr>
    <tr><td><b>AC-66</b></td><td>夜间视野</td><td>同一天赋的居民在 23:30 命中率低于 12:00，守卫不受影响</td></tr>
    <tr><td><b>AC-67</b></td><td>篝火压制</td><td>建一座篝火后夜袭概率下降 8 个百分点，规模不上升</td></tr>
    <tr><td><b>AC-68</b></td><td>疲劳与补觉</td><td>熬通宵的守卫次日 12:00 前工作速度 ≤ 0.84，且 10:00 前处于睡眠</td></tr>
    <tr><td><b>AC-69</b></td><td>存档往返</td><td>存读档后值守人数、夜袭次数、"有备"次数一致，疲劳标记保留</td></tr>
    <tr><td><b>AC-70</b></td><td>无回归</td><td>默认地图直方图与 v1.5 逐位一致；v15 / v14 / iotest 自检全部通过</td></tr>
  </tbody>
</table>

`;
rep('<h2 id="s10">', s97 + '<h2 id="s10">', 'insert-97');

/* ---------- §11.7 ---------- */
const s117 = `<h3>11.7 v1.6（已交付） <span class="b b-new">v1.6 新增</span></h3>
<p>本期只动玩法结构的一处：<b>夜晚</b>。战斗与生产的数值曲线保持 v1.5 的取值，新增压力由夜袭单独承担。</p>
<table class="compact">
  <thead><tr><th style="width:130px">模块</th><th>已实现内容</th><th style="width:90px">状态</th></tr></thead>
  <tbody>
    <tr><td>夜袭</td><td>21:30 掷骰、23:30 出兵、最近边界生成、与白天袭击日互斥、篝火压制</td><td><span class="b b-ship">完成</span></td></tr>
    <tr><td>值守</td><td>0–4 人名额、三项加权点名、火边打盹、平安夜换班、遇袭熬通宵</td><td><span class="b b-ship">完成</span></td></tr>
    <tr><td>偷袭与视野</td><td>睡眠目标承伤 ×1.7 并唤醒；夜间非守卫命中 ×0.75</td><td><span class="b b-ship">完成</span></td></tr>
    <tr><td>疲劳</td><td>上半天效率 ×0.84、补觉到 10:00、成员与地图状态标记</td><td><span class="b b-ship">完成</span></td></tr>
    <tr><td>科技</td><td>「守夜轮值」：疲劳惩罚减半、守夜修墙 +50%</td><td><span class="b b-ship">完成</span></td></tr>
    <tr><td>界面</td><td>侧栏「今夜值守」面板（人数、风险、篝火、在岗名单、本局统计）、成员「守夜中」、地图火把光晕</td><td><span class="b b-ship">完成</span></td></tr>
  </tbody>
</table>

<p><b>回归实测</b>（理想基地基线，5 剧本 × 2 种子 × 2 难度，每局 30000 分钟）：</p>
<table class="compact">
  <thead><tr><th style="width:110px">难度</th><th style="width:110px">胜场</th><th>分档分布</th><th>备注</th></tr></thead>
  <tbody>
    <tr><td>温和</td><td><b>10 / 10</b></td><td>S×2 · A×5 · B×3</td><td>10 局共触发 36 次夜袭，全部被值守者挡下</td></tr>
    <tr><td>标准</td><td><b>6 / 10</b></td><td>S×1 · A×3 · B×0 · 败×4</td><td>失败局多在终局前的最后一场袭击翻车，阶段进度普遍已完成</td></tr>
    <tr><td>低投入基线</td><td>20 / 20 胜</td><td>恒为 C</td><td>说明评分区分的是投入，不只是输赢</td></tr>
  </tbody>
</table>

<p><b>本期明确不做：</b>昼夜光照的实时光照模型、看守的巡逻路径编辑器、夜袭的攻城器械、可选择的值班表（按人固定班次）。
其中"按人固定班次"是最自然的下一步：现在点名是自动的，玩家只能调人数，不能指定"让老周守、让阿吉睡"。</p>

`;
rep('<h2 id="s12">', s117 + '<h2 id="s12">', 'insert-117');

/* ---------- 目录条目 ---------- */
rep('<a href="#s6">6 界面与交互</a>', '<a href="#s5-18">5.18 守夜与夜袭</a>\n  <a href="#s6">6 界面与交互</a>', 'toc');

fs.writeFileSync(P, h.replace(/\n/g, '\r\n'), 'utf8');
const open = (h.match(/<div/g) || []).length, close = (h.match(/<\/div>/g) || []).length;
const to = (h.match(/<table/g) || []).length, tc = (h.match(/<\/table>/g) || []).length;
console.log('done, replacements =', n, 'size =', h.length);
console.log('div', open, close, open === close ? 'BALANCED' : 'MISMATCH');
console.log('table', to, tc, to === tc ? 'BALANCED' : 'MISMATCH');
