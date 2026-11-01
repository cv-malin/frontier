"""对同一条时间线做逐段采样，定位 cliff 从哪一天开始掉队"""
import sys, json, shutil, os
sys.path.insert(0, os.path.dirname(__file__))
import regress16 as R

ROOT = r"C:\Users\Administrator\WorkBuddy\2026-10-21-09-42-04\边陲"
JS = os.path.join(ROOT, "js")
BAK = os.path.join(ROOT, "_backup-v15")

def sample(tag, ticks=12000):
    url = "%s?scen=cliff&seed=7&diff=calm&skipintro=1&watch=1&test=%d&build=2" % (R.BASE, ticks)
    t = R.run(url, 30000)
    if not t.startswith("TEST::"):
        print(tag, "RAW", t[:120]); return
    d = json.loads(t[6:])
    for s in d["out"]:
        cols = s["cols"]
        print(tag, "day%2d" % s["day"],
              "pop=%d" % len(cols),
              "hp=%s" % ",".join(str(c["h"]) for c in cols),
              "re=%s" % ",".join(str(c["re"]) for c in cols),
              "job=%s" % ",".join(str(c.get("job")) + ("*" if c.get("ow") else "") for c in cols),
              "wood=%d stone=%d food=%d" % (s["res"]["wood"], s["res"]["stone"], s["res"]["food"]),
              "built=%d raids=%d kills=%d" % (s["built"], s["raids"], s["kills"]))
    print(tag, "errs", d["errs"])

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "both"
    if which in ("both", "v16"):
        sample("v16")
    if which in ("both", "v15"):
        shutil.copytree(JS, r"C:\tmp\cur16b", dirs_exist_ok=True)
        for f in os.listdir(BAK):
            shutil.copy(os.path.join(BAK, f), os.path.join(JS, f))
        sample("v15")
        for f in os.listdir(r"C:\tmp\cur16b"):
            shutil.copy(os.path.join(r"C:\tmp\cur16b", f), os.path.join(JS, f))
        print("restored")
