import sys, os, re
src, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, "blobs"), exist_ok=True)
pat = re.compile(r'^(?:/\*@@BLOB (\S+)\*/|<!--@@BLOB (\S+?)-->|//@@BLOB (\S+)|//@@MODULE (\S+)|<!--@@NOTES (\S+))$')
name, buf = "blobs/a_head.html", []
def flush():
    if name: open(os.path.join(out, name), "w", encoding="utf-8").write("".join(buf))
for line in open(src, encoding="utf-8"):
    m = pat.match(line.rstrip("\n"))
    if m:
        flush(); buf = []
        n = [x for x in m.groups() if x][0]
        name = n if (m.group(4) or m.group(5) or n == "ui.html") else "blobs/" + n
        continue
    if line.startswith("@@END NOTES"): continue
    buf.append(line)
flush()
