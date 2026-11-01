"""v1.8 野心回归：五种野心 × 剧本 × 难度，看目标是否可达、压力是否分叉。
file:// 协议，不经本地服务器。"""
import json, re, subprocess, sys

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "file:///C:/Users/Administrator/WorkBuddy/2026-10-21-09-42-04/%E8%BE%B9%E9%99%B2/index.html"
PROF = "C:/Users/Administrator/AppData/Local/Temp/prof-reg20"


def run(url, budget=38000):
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
           "--user-data-dir=" + PROF,
           "--virtual-time-budget=%d" % budget, "--dump-dom", url]
    p = subprocess.run(cmd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    m = re.search(r"<title>(.*?)</title>", p.stdout, re.S)
    return (m.group(1) if m else "").strip()


def one(scen, seed, diff, amb, watch=1, build=2, ticks=30000):
    url = ("%s?scen=%s&seed=%d&diff=%s&amb=%s&skipintro=1&watch=%d&test=%d&build=%d&auto=%d"
           % (BASE, scen, seed, diff, amb, watch, ticks, build,
              1))
    t = run(url)
    if not t.startswith("TEST::"):
        return {"scen": scen, "seed": seed, "amb": amb, "raw": t[:140]}
    d = json.loads(t[6:])
    last = d["out"][-1]
    return {
        "scen": scen, "seed": seed, "diff": diff, "amb": amb,
        "err": d["err"], "errs": d["errs"],
        "day": last["day"], "over": last["over"], "cols": len(last["cols"]),
        "grade": last.get("grade"), "score": last.get("score"),
        "ambDone": last.get("ambDone"), "ambAch": last.get("ambAch"),
        "ambState": last.get("amb"), "denCount": last.get("denCount"),
        "deaths": last.get("deaths"), "dens": last.get("dens"),
        "trades": last.get("trades"), "wealth": last.get("wealth"),
        "stage": "%s/%s/%s" % (last["stageIdx"], last["stageDone"], last["stageFailed"]),
        "kills": last["kills"], "raids": last["raids"],
        "night": last.get("nightTimes", -1), "repel": last.get("nightRepel", -1),
    }


def line(r):
    if "raw" in r:
        return "!! %s %s raw=%s" % (r["scen"], r["amb"], r["raw"])
    ok = r.get("over") in ("win", "pyrrhic") and not r.get("err") and not r.get("errs")
    flag = "OK " if ok else ".. "
    return ("%s %-7s %-8s s%-2d %-6s d%-2d pop%d %s sc%-3s amb%-3s "
            "death%d dens%d trade%d wealth%d kill%-3s raid%-3s night%d"
            % (flag, r["scen"], r["amb"], r["seed"], r.get("diff", ""),
               r["day"], r["cols"], r["over"], r["score"], r["ambDone"],
               r["deaths"] or 0, r["dens"] or 0, r["trades"] or 0,
               r["wealth"] or 0, r["kills"], r["raids"], r["night"]))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode == "all":
        # 每张野心配它最合适的剧本，温和难度先确认「可达」
        plan = [
            ("valley", "hold"), ("valley", "fortify"), ("valley", "raid"),
            ("road", "trade"), ("valley", "shelter"),
        ]
        for scen, amb in plan:
            for seed in (7, 11):
                print(line(one(scen, seed, "calm", amb)), flush=True)

    elif mode == "std":
        # 标准难度：五张野心各一局，看是不是都有活路
        plan = [
            ("valley", "hold"), ("valley", "fortify"), ("valley", "raid"),
            ("road", "trade"), ("valley", "shelter"),
        ]
        for scen, amb in plan:
            print(line(one(scen, 7, "std", amb)), flush=True)

    elif mode == "multi":
        amb = sys.argv[2] if len(sys.argv) > 2 else "hold"
        for scen in ["valley", "cliff", "plague", "road", "winter"]:
            for seed in (7, 11):
                print(line(one(scen, seed, "calm", amb)), flush=True)

    elif mode == "one":
        scen, seed, diff, amb = sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
        print(line(one(scen, seed, diff, amb)))
