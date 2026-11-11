import glob, os, sys
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(src, "..", "dustline.html")
def cat(p): return open(os.path.join(src, p), encoding="utf-8").read()
parts = [cat("blobs/a_head.html"), "/*@@BLOB b_fonts.css*/\n", cat("blobs/b_fonts.css"),
         "/*@@BLOB ui.html*/\n", cat("ui.html"),
         "<!--@@BLOB c_three.html-->\n", cat("blobs/c_three.html"),
         "<!--@@BLOB d_script_start.js-->\n", cat("blobs/d_script_start.js"),
         "//@@BLOB e_tex.js\n", cat("blobs/e_tex.js")]
for f in sorted(glob.glob(os.path.join(src, "g[0-9][0-9]*.js"))):
    parts += ["//@@MODULE " + os.path.basename(f) + "\n", cat(os.path.basename(f))]
parts += ["<!--@@NOTES PROGRESS.md\n", cat("PROGRESS.md")]
open(out, "w", encoding="utf-8", newline="").write("".join(parts) + "@@END NOTES-->\n")
print("built", out)
