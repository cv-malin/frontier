import json, re, subprocess, sys

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "http://127.0.0.1:8898/index.html"
PROF = r"C:\Users\Administrator\WorkBuddy\2026-10-21-09-42-04\边陲\_tools\prof"

def run(url, budget=30000):
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--user-data-dir=" + PROF,
           "--virtual-time-budget=%d" % budget, "--dump-dom", url]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"<title>(.*?)</title>", p.stdout, re.S)
    return (m.group(1) if m else "").strip()

BUILD = "&build=1"

def one(scen, seed, diff):
    url = "%s?scen=%s&seed=%d&diff=%s&skipintro=1&test=40000%s" % (BASE, scen, seed, diff, BUILD)
    t = run(url)
    if not t.startswith("TEST::"):
        return {"scen": scen, "seed": seed, "diff": diff, "raw": t[:120]}
    d = json.loads(t[6:])
    last = d["out"][-1]
    return {"scen": scen, "seed": seed, "diff": diff, "err": d["err"], "errs": d["errs"],
            "day": last["day"], "over": last["over"], "cols": len(last["cols"]),
            "stage": "%s/%s/%s" % (last["stageIdx"], last["stageDone"], last["stageFailed"]),
            "kills": last["kills"], "raids": last["raids"], "res": last["res"]}

if __name__ == "__main__":
    diffs = sys.argv[1].split(",") if len(sys.argv) > 1 else ["mild"]
    for diff in diffs:
        print("==== diff=%s ====" % diff)
        for scen in ["valley", "cliff", "plague", "road", "winter"]:
            for seed in (7, 11):
                r = one(scen, seed, diff)
                flag = "OK " if r.get("over") == "win" and not r.get("err") and not r.get("errs") else "!! "
                print(flag, json.dumps(r, ensure_ascii=False))
