# -*- coding: utf-8 -*-
"""在 v2.0 的 PRD 成品上增量生成 v2.1。只替换封面、修订记录，并插入 §11.13。"""
import io, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'PRD-边陲-v2.0.html')
DST = os.path.join(ROOT, 'PRD-边陲-v2.1.html')
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


rep('<div class="bs">v2.0 · 2026-10-30</div>', '<div class="bs">v2.1 · 2026-10-30</div>')
rep('<div class="k">文档版本</div><div class="v">v2.0</div>',
    '<div class="k">文档版本</div><div class="v">v2.1</div>')
rep('<div class="k">产品版本</div><div class="v">2.0.0</div>',
    '<div class="k">产品版本</div><div class="v">2.1.0</div>')
rep('<div class="k">状态</div><div class="v">已实现 · 决策层</div>',
    '<div class="k">状态</div><div class="v">已实现 · 农业与收成</div>')
rep('<title>边陲 FRONTIER · 产品需求文档（PRD）v2.0',
    '<title>边陲 FRONTIER · 产品需求文档（PRD）v2.1')

rev = ('<tr><td><b>v2.1</b></td><td>2026-10-30</td><td>农业线：种田从"圈一块地"变成"一条能插手的生产链"。'
       '新增<b>开荒</b>（荒地 46 分钟/格，重活，一人一天约一亩）、'
       '<b>四种作物</b>（麦 / 豆 / 根菜 / 药草，产量、生长速度、耗地与耐寒各不相同，侧栏可切换）、'
       '<b>地力</b>（按土质定底子，连作麦会衰减，种豆能养回来）、'
       '<b>偷粮贼</b>（只在有熟作物时出现，不伤人，搬走六成后逃跑，挨枪丢一半，打死可夺回）；'
       '「惨胜」判定从远征专属推广到所有野心。新增 §11.13（机制表、断言、回归与四条踩坑）。</td></tr>\n'
       '    <tr><td><b>v2.0</b></td><td>2026-10-30</td>')
rep('<tr><td><b>v2.0</b></td><td>2026-10-30</td>', rev)

SEC = u"""
<h3 id="s11-13">11.13 v2.1 交付清单与回归实测</h3>

<h4>11.13.1 为什么先补农业，而不是先加敌人</h4>
<p>v2.0 之后"每天要拍板"这件事成立了，但拍板的<b>对象</b>还很窄：几乎全是"今天够不够力气砌墙"。
生产链上真正缺的是一环 —— <b>食物是唯一没有工序的资源</b>。木头要砍、石头要挖、药草要采，
唯独农田是"圈了一块地，然后它自己长"。这让"扩张"没有前置投入，也让粮食在所有资源里最没有存在感。</p>
<p>所以这一版把种田拆成四道工序，每一道都给玩家一个可切的位置：
<b>开荒 → 选种 → 等熟 → 抢收</b>。前三道是你主动安排的，第四道是别人替你安排的。</p>

<h4>11.13.2 机制表</h4>
<table>
  <thead><tr><th style="width:150px">项</th><th style="width:110px">数值</th><th>行为与理由</th></tr></thead>
  <tbody>
    <tr><td><b>开荒</b></td><td>46 分钟 / 格<br>干劲 0.108 / 分</td>
        <td>圈出来的农田先是<b>荒地</b>，必须有人翻过才能下种。46 分钟对齐"一段石墙 51 分钟"——
            一人一天（870 分钟）大约开一亩，于是"圈多大"第一次成了真决策。
            翻地顺手铲掉灌木与药草，并产出 2 木材 + 2 食物（不该是纯亏损）。</td></tr>
    <tr><td><b>麦</b></td><td>9 食物<br>生长 1.00×<br>地力 −0.55</td>
        <td>产量最高，长得最慢，地力掉得最快。连作三年，同一块地会越收越少。</td></tr>
    <tr><td><b>豆</b></td><td>5 食物<br>生长 1.62×<br>地力 +0.75</td>
        <td>产量最低，但长得最快（约 1050 分钟一茬），而且<b>养地</b>。轮作的另一半 ——
            没有它，地力系统只是一条单向下坡。</td></tr>
    <tr><td><b>根菜</b></td><td>7 食物<br>生长 1.14×<br>地力 −0.20</td>
        <td>中庸，但<b>冬天照长</b>（0.42 倍速）。其余作物在冬天完全停摆 ——
            以前"冬天一律不长"，等于冬天没有任何农业可做，只能干等。</td></tr>
    <tr><td><b>药草</b></td><td>3 药草<br>生长 1.15×<br>地力 −0.30</td>
        <td>不产粮，产医务所唯一的原料。野采永远不够用（常备 4 份就停），
            这格地是"要不要为治伤留一块田"的答案。</td></tr>
    <tr><td><b>地力</b></td><td>0.30 – 0.82<br>产量 ×(0.72 + 地力×0.56)</td>
        <td>开荒时按土质定：花甸 82 / 湿地 74 / 草地 62 / 泥土 52 / 碎石 38 / 沙地 30。
            收一茬按品种增减，收完再算。地表颜色跟着地力走 —— 地瘦了，土发白。</td></tr>
    <tr><td><b>偷粮贼</b></td><td>每 6 小时判一次<br>成熟 ≥2 格才刷<br>最多同时 2 个</td>
        <td>出现概率 <code>0.17 + 成熟格×0.012 + 天数×0.008</code>（上限 0.34）。
            <b>不伤人、不拆墙、不进营地</b>，只搬田里的成熟作物，每格拿走六成（麦约 6 份）。
            装够 3 份就跑；挨了枪丢下一半赃物加速逃；打死能把粮全拿回来。</td></tr>
    <tr><td><b>惨胜推广</b></td><td>目标日 ±1 天</td>
        <td>v1.8 的「惨胜」只对远征生效（三个巢端了但人没了）。v2.1 打开到所有野心：
            墙立起来了、人救回来了、巢平了，只是人正好倒在最后一天，不该按覆灭结算。</td></tr>
  </tbody>
</table>

<h4>11.13.3 验收断言（<code>?v21=1</code>，13 项全绿）</h4>
<pre>V21::{"checks":{
  "tillNeeded":true,   "tillWorks":true,   "sowCrop":true,
  "yieldOrder":true,   "fertCycle":true,   "cropRate":true,
  "rootWinter":true,   "cropDef":true,     "tillHeavy":true,
  "thiefOnlyRipe":true,"thiefNoMainRnd":true,
  "thiefLoot":true,    "thiefDrop":true
},"spot":"34,30","fert0":{"g":0,"got":0.62,"want":0.62},"sow":"bean",
 "yield":{"wheat":10,"bean":6},"fertAfter":{"wheat":0.612,"bean":0.82},
 "grow":{"wheat":0.1176,"bean":0.1906,"rootWinter":0.0563,"wheatWinter":0},
 "thiefSpawn":{"ripe":6,"noneRipe":0,"spawned":1,"rndCalls":0},
 "thiefRun":{"before":6,"after":5,"sack":6,"st":"move","rndCalls":0},"errs":[]}</pre>
<p>其中 <code>thiefNoMainRnd</code> 是这一版最关键的一条断言：断言里临时把全局 <code>RNG</code>
换成一个计数器，跑完偷粮贼的生成与行动后它必须仍是 0 —— <b>贼一次都不能消耗主随机流</b>。</p>

<h4>11.13.4 回归实测</h4>
<p>五野心 × 2 种子（温和）：<b>8 局过关</b>（其中 1 局是惨胜），2 局差一点
（筑城 s11 野心 75%、救人 s7 野心 94%）。
补跑筑城 / 救人的 s13、s17 四个种子<b>全胜</b>，合计 14 局 12 胜。
逐局核对过：失败的两局都是"最后一波没扛住"，不是"机制不可达"——
筑城 s7 在第 11 天时野心已 100%，第 12 天墙被拆到 16 段后全灭，改判为惨胜。</p>
<p>v2.0 的旧断言（v20 / v19 / v18 共 42 项）全部保持通过，<code>errs: []</code>。</p>

<h4>11.13.5 四条踩坑记录</h4>
<p><b>1. 开荒最贵的不是工时，是"圈地那一刻"。</b>最初在 <code>setZone('farm')</code> 里就把灌木铲掉，
理由是"留着永远开不了荒"。结果玩家一圈地，那几丛浆果当场消失，前期食物直接塌 ——
测出来的失败全是"第 4 天饿到没力气"，而不是"开荒太慢"。改成<b>开荒完成时才清</b>：
浆果可以一直摘到有人来翻这块地，代价落在"翻地的人"身上，而不是"圈地的那一刻"。</p>
<p><b>2. 偷粮贼必须有自己的随机数发生器。</b>它的出现条件依赖"田里有多少格熟了"，
而那取决于玩家这一局派了几个人种地。一旦它去消耗全局 <code>rnd</code>，一次触发就会把后面
所有世界线（谁在哪天受伤、夜袭打哪）整条重排，v2.0 的十局回归全部作废。
给它一条独立的 LCG（<code>thrnd()</code>）之后，这件事从"不可控"变成"可复现"。
连 <code>makeRaider</code> 里给它起名用的 <code>rint(1,9)</code> 都换掉了 —— 那一次调用就是 1 格位移。</p>
<p><b>3. 让居民自动追贼，是替玩家做了一个稳亏的决定。</b>第一版贼一出现，附近居民就扔下活去追
（沿用"13 格内自动接敌"）。它跑得快、打不死人，追它纯粹是工时损失 —— 结果筑城局全崩。
把贼从自动接敌列表里剔掉之后，它才回到设计意图：<b>打不打是玩家的选择</b>（点它集火 / 靠炮塔）。</p>
<p><b>4. 脚手架里的农田必须预置成"已开垦"。</b><code>build=2</code> 的理想玩家基线一圈就是 56 格，
如果这 56 格也要真开荒，等于三个半工日全扑在刨地上 —— 量出来的就不再是"目标可达性"，
而是"脚手架缺口"。所以在基线里直接落成熟地，开荒本身由 <code>?v21=1</code> 单独验。
（同 v2.0 补工坊那条：<b>测出来的应该是设计难度，不是测试脚本的疏漏</b>。）</p>

<h4>11.13.6 本期明确不做</h4>
<p>灌溉与水源（要改地形水系，代价远超收益）、作物轮作日历（地力已经能表达这件事，再加一层会变成表格游戏）、
 thief 的同伙与谈判、粮食腐败、把药草并入科技树。</p>

"""
KEY = u'<h2 id="s12">'
if KEY not in s:
    raise SystemExit('anchor not found')
s = s.replace(KEY, SEC + KEY, 1)
n += 1

io.open(DST, 'w', encoding='utf-8').write(s)
print('ok, replacements =', n, 'bytes =', len(s))
