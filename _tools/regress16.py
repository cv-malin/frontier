"""v1.6 守夜机制回归：file:// 协议，不经本地服务器"""
import json, re, subprocess, sys, os

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "file:///C:/Users/Administrator/WorkBuddy/2026-10-21-09-42-04/%E8%BE%B9%E9%99%B2/index.html"
PROF = r"C:\Users\Administrator\WorkBuddy\2026-10-21-09-42-04\边陲\_tools\prof17"

def run(url, budget=38000):
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
           "--user-data-dir=" + PROF,
           "--virtual-time-budget=%d" % budget, "--dump-dom", url]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"<title>(.*?)</title>", p.stdout, re.S)
    return (m.group(1) if m else "").strip()

def one(scen, seed, diff, watch=1, build=2, ticks=30000):
    url = "%s?scen=%s&seed=%d&diff=%s&skipintro=1&watch=%d&test=%d&build=%d" % (
        BASE, scen, seed, diff, watch, ticks, build)
    t = run(url)
    if not t.startswith("TEST::"):
        return {"scen": scen, "seed": seed, "diff": diff, "watch": watch, "raw": t[:140]}
    d = json.loads(t[6:])
    last = d["out"][-1]
    return {"scen": scen, "seed": seed, "diff": diff, "watch": watch,
            "err": d["err"], "errs": d["errs"],
            "day": last["day"], "over": last["over"], "cols": len(last["cols"]),
            "grade": last["grade"], "score": last["score"],
            "stage": "%s/%s/%s" % (last["stageIdx"], last["stageDone"], last["stageFailed"]),
            "kills": last["kills"], "raids": last["raids"],
            "night": last.get("nightTimes", -1), "repel": last.get("nightRepel", -1),
            "fatigue": last.get("watchFatigue", -1)}

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "balance"
    if mode == "balance":
        for diff in ["calm", "std"]:
            print("==== diff=%s ====" % diff)
            for scen in ["valley", "cliff", "plague", "road", "winter"]:
                for seed in (7, 11):
                    r = one(scen, seed, diff)
                    flag = "OK " if r.get("over") == "win" and not r.get("err") and not r.get("errs") else "!! "
                    print(flag, json.dumps(r, ensure_ascii=False))
    elif mode == "compare":
        # 同一局，守夜 0 人 vs 2 人，看差别落在哪
        for scen in ["valley", "winter", "cliff"]:
            for w in (0, 1, 2):
                r = one(scen, 7, "std", watch=w)
                print(json.dumps(r, ensure_ascii=False))
