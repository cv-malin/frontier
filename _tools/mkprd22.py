# -*- coding: utf-8 -*-
"""在 v2.1 的 PRD 成品上增量生成 v2.2。只换封面、修订记录，并插入 §11.14。"""
import io, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'PRD-边陲-v2.1.html')
DST = os.path.join(ROOT, 'PRD-边陲-v2.2.html')
if not os.path.exists(SRC):
    raise SystemExit('missing ' + SRC)
shutil.copyfile(SRC, DST)
s = io.open(DST, encoding='utf-8').read()
n = 0


def rep(a, b):
    global s, n
    if a not in s:
        print('MISS:', a[:70])
        return
    s = s.replace(a, b, 1)
    n += 1


rep('<div class="bs">v2.1 · 2026-10-30</div>', '<div class="bs">v2.2 · 2026-11-01</div>')
rep('<div class="k">文档版本</div><div class="v">v2.1</div>',
    '<div class="k">文档版本</div><div class="v">v2.2</div>')
rep('<div class="k">产品版本</div><div class="v">2.1.0</div>',
    '<div class="k">产品版本</div><div class="v">2.2.0</div>')
rep('<div class="k">状态</div><div class="v">已实现 · 农业与收成</div>',
    '<div class="k">状态</div><div class="v">已实现 · 因果可读与复盘</div>')
rep('<title>边陲 FRONTIER · 产品需求文档（PRD）v2.1',
    '<title>边陲 FRONTIER · 产品需求文档（PRD）v2.2')

rev = ('<tr><td><b>v2.2</b></td><td>2026-11-01</td><td>把"发生了什么"变成可查的记录：'
       '新增<b>每日快照</b>（state.snaps，每天一档，不抽签）、<b>每日事件</b>（state.dayLog）、'
       '<b>个人史</b>（c.hist，按天按类型去重）、<b>讣告</b>（谁死在第几天、死在谁手上）、'
       '侧栏<b>今日瓶颈</b>一行诊断、结算<b>复盘</b>（自动挑出"势"掉得最狠的三天并给出当天原话）、'
       '<b>跨局档案</b>（最近 20 局 + 同种子重打）。顺带修掉特效年龄为负导致的渲染异常。'
       '新增 §11.14（机制表、14 项断言、回归与三条踩坑）。</td></tr>\n'
       '    <tr><td><b>v2.1</b></td><td>2026-10-30</td>')
rep('<tr><td><b>v2.1</b></td><td>2026-10-30</td>', rev)

SEC = u"""
<h3 id="s11-14">11.14 v2.2 交付清单与回归实测</h3>

<h4>11.14.1 为什么这一版不做内容，只做记录</h4>
<p>v2.0 解决了"每天要不要拍板"，v2.1 解决了"拍板的对象够不够多"。到这一步，机制层面的短板
已经不在数量上了 —— 再堆一栋建筑、再加一种作物，边际效用掉得很快。真正的短板换成了三句话：</p>
<p>　　① <b>玩家看不懂今天为什么是这样。</b>（因果不可读）<br>
　　② <b>输了不知道为什么输。</b>（失败不可学）<br>
　　③ <b>一局结束就是结束。</b>（重开没有钩子）</p>
<p>这三件事共用同一份数据：<b>这一局到底发生过什么</b>。所以 v2.2 只做一件事 ——
把过程记下来，然后在对的地方露出来。这是"完成度高的独立游戏"和"耐玩的游戏"之间最常见的那道坎。</p>

<h4>11.14.2 机制表</h4>
<table>
  <thead><tr><th style="width:150px">项</th><th style="width:130px">数据结构</th><th>行为与理由</th></tr></thead>
  <tbody>
    <tr><td><b>每日快照</b></td><td><code>state.snaps[]</code><br>一天一档，上限 60</td>
        <td>在跨天的那一刻落档：人口、士气、粮、木石、墙/炮/床、在建工地、平均饥饿与精力、科技数、阶段。
            只读仓库与地形，<b>一次 rnd 都不抽</b> —— 见 11.14.5 第 1 条。</td></tr>
    <tr><td><b>每日事件</b></td><td><code>state.dayLog{ day: [] }</code></td>
        <td>危机结算、阶段达标/未达标、第二幕成交与拒绝、倒下、阵亡、旧伤落定。
            复盘要靠它说出"当天到底发生了什么"，否则只能甩数字。</td></tr>
    <tr><td><b>个人史</b></td><td><code>c.hist[]</code><br>上限 14 条</td>
        <td>只记"这个人身上发生了什么"：被谁打伤、倒下、用草药处理伤口、饿到发慌、落下旧伤。
            去重有两个键：<b>一模一样的一句</b>（挨饿一天会触发几十次），以及<b>分组键</b>
            （挨打只留当天第一条 —— 同一晚被三个人打，不需要三条一模一样的记录）。</td></tr>
    <tr><td><b>讣告</b></td><td><code>state.kia[]</code></td>
        <td>名字、第几天、死在谁手上。死因由 <code>hurt()</code> 里的 <code>lastHitBy</code> 一路带下来。
            以前战报只有"阵亡 2 人"，玩家连死在谁手上都不知道。</td></tr>
    <tr><td><b>今日瓶颈</b></td><td>侧栏一行，最多三句</td>
        <td>按优先级：人躺下了 → 没吃饱 → 工地停着没人盖 → 劲用完了 → 带伤 → 闲着。
            玩家最常问的就是"为什么墙不涨"，答案通常只有这四个。这一行的价值大于十条日志。</td></tr>
    <tr><td><b>复盘</b></td><td>结算页，最多三天</td>
        <td>先算每天的"势"（<code>dayPower</code>：人 ×7 + 士气 ×0.3 + 粮 + 建筑 + 墙炮 − 倒地 ×6
            − 断粮罚 8），再挑下跌幅最大的三天。有当日事件就用事件原话，没有才退回快照差值。
            全胜的局不硬凑三条教训 —— 没有明显崩盘就只给最差的一天。</td></tr>
    <tr><td><b>跨局档案</b></td><td><code>localStorage['frontier-runs']</code><br>最近 20 局</td>
        <td>剧本 / 野心 / 难度 / <b>种子</b> / 结局 / 分数 / 阵亡数。开场页列出最近 5 条，
            每条可"同种子重打"。刻意<b>不存快照</b>：那是几百 KB 的事，而玩家真正想要的是"再来一次这一局"。</td></tr>
  </tbody>
</table>

<h4>11.14.3 断言（<code>?v22=1</code>，14 项）</h4>
<table>
  <thead><tr><th style="width:170px">断言</th><th>验证什么</th></tr></thead>
  <tbody>
    <tr><td><code>snapPush</code></td><td>跨天落档，且记的是"刚过完的那一天"</td></tr>
    <tr><td><code>snapNoRnd</code></td><td><b>快照全程不消耗主随机流</b>（替换全局 RNG 计数验证为 0）</td></tr>
    <tr><td><code>histDedup</code></td><td>同一天同一句只留一条</td></tr>
    <tr><td><code>histWoundOnce</code></td><td>同一晚被两个人打，只留一条"被打伤"</td></tr>
    <tr><td><code>kiaRecord</code></td><td>讣告记下名字、日期、死因</td></tr>
    <tr><td><code>bottleneck</code></td><td>全员没劲时说出"劲用完了"，而不是"人人有活干"</td></tr>
    <tr><td><code>bottleneckOk</code></td><td>状态正常时不给红色告警（不狼来了）</td></tr>
    <tr><td><code>pmDetect</code></td><td>复盘能定位崩塌那一天</td></tr>
    <tr><td><code>pmEvent</code></td><td>复盘带上当天的原话，而不是只给跌幅</td></tr>
    <tr><td><code>recordOnce</code></td><td>一局只记一次（结算会被反复打开）</td></tr>
    <tr><td><code>recordSeed</code></td><td>档案里带种子，且结局判定正确</td></tr>
    <tr><td><code>seedReplay</code></td><td><b>同种子复现同一张图</b>（地形指纹比对）—— 否则"同种子重打"只是换了个开局</td></tr>
    <tr><td><code>saveArch</code></td><td>存档带上 snaps / dayLog / kia / seed，读档后复盘仍然可用</td></tr>
    <tr><td><code>histGuard</code></td><td>老存档没有 <code>hist</code> 字段时，个人面板不崩</td></tr>
  </tbody>
</table>

<h4>11.14.4 回归实测</h4>
<p>五野心 × 2 种子（温和）：<b>与 v2.1 逐局一致</b> —— 8 局过关（含 1 局惨胜），
2 局差一点（筑城 s11 野心 75%、救人 s7 野心 94%）。这个"一致"本身就是结论：
v2.2 改的全是记录，<b>没有动世界线</b>。</p>
<p>旧断言 v21（13 项）/ v20（14 项）/ v19（15 项）全部保持通过，<code>errs: []</code>。</p>

<h4>11.14.5 三条踩坑记录</h4>
<p><b>1. 记录本身绝对不能抽签。</b>v2.1 已经踩过一次（偷粮贼必须用自己的 PRNG）。
这一版更危险：快照每天落一次、个人史每次受伤都要写，稍不注意就会在 <code>snapshotDay</code>
里顺手 <code>rnd()</code> 一下（比如随机取个抖动值）。那样 v2.0 以来的十局长局回归会全部作废，
而且失效是<b>静默</b>的 —— 游戏照样能玩，只是每一局的"世界"都悄悄变了。
所以 <code>snapNoRnd</code> 是这一版的命门断言，用临时替换全局 <code>RNG</code> 计数的方式硬验。</p>
<p><b>2. 负数年龄会让整帧绘制中断。</b>特效的 <code>f.t</code> 取的是 <code>performance.now()</code>，
而绘制时拿到的是 rAF 时间戳 —— 后者是<b>本帧开始</b>的时刻，可能比 <code>f.t</code> 还早几百毫秒
（特效是在同一帧的模拟步里刚创建的）。于是 <code>age</code> 为负，<code>ring</code> 的半径算成负数，
<code>ctx.arc</code> 抛 <code>IndexSizeError</code>，<b>从这一行往后整帧的绘制全部中断</b>。
控制台里表现为一行"Uncaught"，画面上是"偶尔少画一半东西"。修法是给 age 夹上下界。</p>
<p><b>3. 存档一直漏了 <code>vigor</code>。</b>v2.0 加干劲时只写了 <code>loadGame</code> 的兜底，
忘了 <code>saveGame</code> 的字段。读档后半天里，每个人的干劲是 <code>undefined</code>，
被当成"没劲"处理 —— 表面上像是"读档之后节奏变了"，其实是数据没存。
这一版补上，并且把<b>干劲 / 个人史 / snaps / kia / seed</b> 一次性列进存档清单核对。</p>

<h4>11.14.6 本期明确不做</h4>
<p>时间线回放（要把每帧状态都存下来，成本是当前方案的两个数量级，而收益主要在"复盘"——已经用另一种方式拿到了）、
局内成就系统（那是留存本身有问题的游戏用来补留存的）、把运行档案同步到云端、
给复盘加"如果你当时……"的建议（教玩家怎么打是攻略的事，游戏该做的是把发生过什么讲清楚）。</p>

"""
KEY = u'<h2 id="s12">'
if KEY not in s:
    raise SystemExit('anchor not found')
s = s.replace(KEY, SEC + KEY, 1)
n += 1

io.open(DST, 'w', encoding='utf-8').write(s)
print('ok, replacements =', n, 'bytes =', len(s))
