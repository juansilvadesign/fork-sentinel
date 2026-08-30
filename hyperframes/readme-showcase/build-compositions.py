#!/usr/bin/env python3
"""Emit the two showcase compositions.

Generated rather than hand-written so the monospace column math is computed from
the same data the CLI prints, instead of being eyeballed into alignment.
"""
import html, pathlib

ROWS = [
    ("caveman", "JuliusBrussee/caveman", "3", "309", "DIVERGED", "1 closed", None),
    ("Sink", "miantiao-me/Sink", "2", "264", "DIVERGED", "—", None),
    ("moemail", "beilunyang/moemail", "1", "70", "DIVERGED", "—", None),
    ("ai-website-cloner-template", "JCodesMore/ai-website-cloner-template", "47", "26", "DIVERGED", "—", None),
    ("ZeroDelay", "joaogfc/ZeroDelay", "6", "13", "DIVERGED", "2 open · 4 merged",
     "work is on feat/community-suite, not main"),
    ("claude-switch", "Abhishek21k/claude-switch", "15", "9", "DIVERGED", "4 merged", None),
    ("cursor-talk-to-figma-mcp", "grab/cursor-talk-to-figma-mcp", "232", "0", "clean", "2 open · 1 merged", None),
]
HEAD = ["FORK", "UPSTREAM", "AHEAD", "BEHIND", "STATUS", "OUTBOUND PRS"]
W = [max(len(HEAD[i]), max(len(r[i]) for r in ROWS)) for i in range(5)]

PALETTE = """
  --bg:#0a0c10; --surface:#11151c; --surface2:#161b24; --line:#222936;
  --text:#e6e9ef; --muted:#8b94a7; --accent:#3fb950; --danger:#f85149; --amber:#d29922;
"""

FONTS = """
    @font-face{font-family:"InterVar";src:url("FONTBASE/fonts/inter-var.woff2")format("woff2");font-weight:100 900;font-display:block}
    @font-face{font-family:"JBMono";src:url("FONTBASE/fonts/jetbrains-mono-var.woff2")format("woff2");font-weight:100 800;font-display:block}
"""

def esc(s):
    return html.escape(s, quote=False)

def shell(title, body, script, duration, comp_id, fontbase):
    return f"""<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
{FONTS.replace("FONTBASE", fontbase)}
      *{{margin:0;padding:0;box-sizing:border-box}}
      :root{{{PALETTE}}}
      html,body{{width:1920px;height:1080px;overflow:hidden;background:var(--bg)}}
      body{{font-family:"InterVar",sans-serif;color:var(--text);
        background-image:radial-gradient(1400px 700px at 50% -240px,rgba(63,185,80,.10),transparent 70%)}}
      .clip{{position:absolute;inset:0}}
      .mono{{font-family:"JBMono",monospace;font-variant-ligatures:none}}
      .c-dim{{color:#808a9a}} .c-red{{color:var(--danger)}} .c-green{{color:var(--accent)}}
      .c-white{{color:#fff}} .c-muted{{color:var(--muted)}}
{body["style"]}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="{comp_id}" data-start="0" data-duration="{duration}"
         data-width="1920" data-height="1080" data-fps="30">
{body["html"]}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
{script}
      window.__timelines["{comp_id}"] = tl;
    </script>
  </body>
</html>
"""

# ---------------------------------------------------------------- terminal
def build_terminal():
    TOTAL, FS = 14, 23
    lines, tl = [], []

    def line(idx, cls, inner, at, indent=0):
        lines.append(
            f'        <div class="tline mono {cls}" id="l{idx}" '
            f'style="left:{56 + indent}px;top:{90 + idx * 38}px">{inner}</div>')
        tl.append(f'      tl.fromTo("#l{idx}",{{opacity:0,x:-14}},'
                  f'{{opacity:1,x:0,duration:.28,ease:"power2.out"}},{at:.2f});')

    hdr = "  ".join(HEAD[i].ljust(W[i]) for i in range(5)) + "  " + HEAD[5]
    i = 0
    line(i, "c-dim", '<span class="c-green">$</span> <span id="typed">fork-sentinel</span>'
         '<span id="caret">&#9608;</span>', 0.55); i += 1
    line(i, "", '<span class="c-white">fork-sentinel</span> '
         '<span class="c-dim">&#183; juansilvadesign &#183; 69 of 69 forks scanned</span>', 2.55); i += 1
    line(i, "c-dim", "&nbsp;", 2.6); i += 1
    line(i, "c-dim", esc(hdr), 3.05); i += 1

    at = 3.55
    for fork, up, ahead, behind, status, prs, note in ROWS:
        cells = (f'{esc(fork.ljust(W[0]))}  {esc(up.ljust(W[1]))}  '
                 f'{esc(ahead.ljust(W[2]))}  {esc(behind.ljust(W[3]))}  ')
        tone = "c-red" if status == "DIVERGED" else "c-green"
        line(i, "", f'{cells}<span class="{tone}">{esc(status.ljust(W[4]))}</span>  '
                    f'<span class="c-muted">{esc(prs)}</span>', at); i += 1
        at += 0.52
        if note:
            line(i, "c-dim", "&nbsp;&nbsp;&nbsp;&nbsp;-&gt; " + esc(note), at); i += 1
            at += 0.42

    at += 0.25
    line(i, "c-dim", "&nbsp;", at); i += 1
    line(i, "c-white", "9 forks diverged &#8212; upstream moved under patches you wrote.", at); i += 1
    at += 0.62
    line(i, "c-dim", "52 forks not shown: 5 upstream deleted &#183; 1 unrelated history "
                     "&#183; 46 never patched", at)

    body_html = f"""      <div class="clip" id="scene-term" data-start="0" data-duration="{TOTAL}">
        <div id="win">
          <div id="bar"><i></i><i></i><i></i><span class="mono">fork-sentinel</span></div>
          <div id="pane">
{chr(10).join(lines)}
          </div>
        </div>
      </div>
      <div class="clip" id="scene-end" data-start="11.4" data-duration="2.6">
        <div id="endcard">
          <div id="mark">&#9672; fork-sentinel</div>
          <div id="tag">69 forks in. 9 that can actually break you, out.</div>
          <div id="url" class="mono">juansilvadesign.github.io/fork-sentinel</div>
        </div>
      </div>"""

    style = f"""      #win{{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);
        width:1680px;height:824px;background:#070910;border:1px solid var(--line);
        border-radius:16px;overflow:hidden;box-shadow:0 40px 120px -40px #000;
        display:flex;flex-direction:column}}
      #bar{{display:flex;align-items:center;gap:9px;padding:16px 20px;background:var(--surface2);
        border-bottom:1px solid var(--line)}}
      #bar i{{width:13px;height:13px;border-radius:50%;background:#2d3542}}
      #bar span{{margin-left:10px;font-size:17px;color:var(--muted)}}
      #pane{{position:relative;flex:1;min-height:0}}
      .tline{{position:absolute;white-space:pre;font-size:{FS}px;line-height:1.5;letter-spacing:0}}
      #typed{{display:inline-block;overflow:hidden;white-space:nowrap;
        vertical-align:bottom;width:0}}
      #caret{{color:var(--accent)}}
      #scene-end{{opacity:0}}
      #endcard{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:22px;background:var(--bg)}}
      #mark{{font-size:96px;font-weight:800;letter-spacing:-.035em}}
      #tag{{font-size:38px;color:#c3cad6}}
      #url{{font-size:30px;color:var(--accent);margin-top:8px}}"""

    script = f"""      tl.fromTo("#win",{{opacity:0,scale:.965}},{{opacity:1,scale:1,duration:.55,ease:"power2.out"}},0);
      tl.fromTo("#typed",{{width:0}},{{width:"13ch",duration:1.15,ease:"steps(13)"}},0.75);
      tl.to("#caret",{{opacity:0,duration:.01,repeat:7,yoyo:true,repeatDelay:.38,ease:"none"}},0.1);
      tl.to("#caret",{{opacity:0,duration:.2}},2.35);
{chr(10).join(tl)}
      tl.to("#win",{{opacity:0,duration:.4,ease:"power2.inOut"}},11.2);
      tl.to("#scene-end",{{opacity:1,duration:.5,ease:"power2.out"}},11.4);
      tl.fromTo("#mark",{{opacity:0,y:22}},{{opacity:1,y:0,duration:.55,ease:"power3.out"}},11.55);
      tl.fromTo("#tag",{{opacity:0,y:16}},{{opacity:1,y:0,duration:.5,ease:"power3.out"}},11.78);
      tl.fromTo("#url",{{opacity:0}},{{opacity:1,duration:.5}},12.0);"""

    return shell("fork-sentinel — the run", {"html": body_html, "style": style},
                 script, TOTAL, "terminal", "assets")

pathlib.Path("index.html").write_text(build_terminal(), encoding="utf-8")
print("index.html written (terminal run, 14s)")

# ---------------------------------------------------------------- funnel
def build_funnel():
    TOTAL, COLS = 12, 12
    # Fixed index sets: no Math.random anywhere, and diverged is a strict subset
    # of maintained, because a diverged fork is by definition one you patched.
    MAINTAINED = [2, 5, 9, 14, 17, 21, 26, 30, 33, 38, 41, 47, 52, 56, 60, 64, 68]
    DIVERGED = [5, 14, 21, 30, 38, 47, 56, 64, 68]
    assert len(MAINTAINED) == 17 and len(DIVERGED) == 9
    assert set(DIVERGED) <= set(MAINTAINED)

    tiles = []
    for i in range(69):
        kind = "d" if i in DIVERGED else ("m" if i in MAINTAINED else "b")
        tiles.append(f'          <div class="tile t-{kind}" id="k{i}"></div>')

    callouts = [("caveman", "309 behind"), ("Sink", "264 behind"),
                ("ai-website-cloner-template", "26 behind")]
    co_html = "\n".join(
        f'          <div class="co" id="co{n}"><span class="mono co-n">{esc(name)}</span>'
        f'<span class="mono co-b">{esc(val)}</span></div>'
        for n, (name, val) in enumerate(callouts))

    body_html = f"""      <div class="clip" id="scene-grid" data-start="0" data-duration="{TOTAL}">
        <div id="cap"><span id="cap-n">69</span><span id="cap-t">forks</span></div>
        <div id="grid">
{chr(10).join(tiles)}
        </div>
        <div id="colist">
{co_html}
        </div>
      </div>
      <div class="clip" id="scene-end" data-start="9.5" data-duration="2.5">
        <div id="endcard">
          <div id="mark">&#9672; fork-sentinel</div>
          <div id="tag">Find the forks you actually maintain.</div>
          <div id="url" class="mono">juansilvadesign.github.io/fork-sentinel</div>
        </div>
      </div>"""

    style = """      #cap{position:absolute;top:205px;left:0;right:0;display:flex;align-items:baseline;
        justify-content:center;gap:22px}
      #cap-n{font-size:118px;font-weight:800;letter-spacing:-.04em;line-height:1}
      #cap-t{font-size:40px;color:var(--muted)}
      #grid{position:absolute;left:50%;top:420px;transform:translateX(-50%);
        display:grid;grid-template-columns:repeat(12,110px);gap:16px}
      .tile{height:64px;border-radius:8px;background:var(--surface2);
        border:1px solid var(--line)}
      #colist{position:absolute;left:50%;top:400px;transform:translateX(-50%);
        width:1000px;display:flex;flex-direction:column;gap:18px;opacity:0}
      .co{display:flex;justify-content:space-between;align-items:center;
        background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--danger);
        border-radius:10px;padding:22px 30px}
      .co-n{font-size:34px;color:var(--text)}
      .co-b{font-size:34px;color:var(--danger)}
      #scene-end{opacity:0}
      #endcard{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:22px;background:var(--bg)}
      #mark{font-size:96px;font-weight:800;letter-spacing:-.035em}
      #tag{font-size:38px;color:#c3cad6}
      #url{font-size:30px;color:var(--accent);margin-top:8px}"""

    bookmarks = [i for i in range(69) if i not in MAINTAINED]
    demoted = [i for i in MAINTAINED if i not in DIVERGED]
    sel = lambda ids: ",".join(f"#k{i}" for i in ids)

    script = f"""      tl.fromTo("#cap",{{opacity:0,y:18}},{{opacity:1,y:0,duration:.5,ease:"power3.out"}},0.15);
      tl.fromTo(".tile",{{opacity:0,scale:.72}},
        {{opacity:1,scale:1,duration:.5,ease:"power2.out",stagger:{{each:0.012,from:"start"}}}},0.35);

      // 69 -> 17: the bookmark majority recedes, it is never deleted from the frame.
      tl.to("{sel(bookmarks)}",{{opacity:.10,scale:.86,duration:.6,ease:"power2.inOut",
        stagger:{{each:0.004}}}},2.35);
      tl.to("{sel(MAINTAINED)}",{{borderColor:"#3fb950",backgroundColor:"rgba(63,185,80,.16)",
        duration:.5,ease:"power2.out"}},2.5);
      tl.to("#cap-n",{{innerText:"17",duration:.35,snap:{{innerText:1}},ease:"none"}},2.5);
      tl.to("#cap-t",{{innerText:"carry your own commits",duration:.001}},2.55);

      // 17 -> 9: only the ones upstream moved under.
      tl.to("{sel(demoted)}",{{opacity:.16,scale:.88,borderColor:"#222936",
        backgroundColor:"#161b24",duration:.55,ease:"power2.inOut"}},4.85);
      tl.to("{sel(DIVERGED)}",{{borderColor:"#f85149",backgroundColor:"rgba(248,81,73,.20)",
        duration:.5,ease:"power2.out"}},5.0);
      tl.to("#cap-n",{{innerText:"9",duration:.35,snap:{{innerText:1}},ease:"none"}},5.0);
      tl.to("#cap-t",{{innerText:"diverged \\u2014 upstream moved",duration:.001}},5.05);

      // Name the worst three, so the count stops being abstract.
      tl.to("#grid",{{opacity:.14,duration:.55,ease:"power2.inOut"}},7.15);
      tl.to("#colist",{{opacity:1,duration:.4}},7.25);
      tl.fromTo("#co0",{{opacity:0,x:-26}},{{opacity:1,x:0,duration:.42,ease:"power3.out"}},7.3);
      tl.fromTo("#co1",{{opacity:0,x:-26}},{{opacity:1,x:0,duration:.42,ease:"power3.out"}},7.55);
      tl.fromTo("#co2",{{opacity:0,x:-26}},{{opacity:1,x:0,duration:.42,ease:"power3.out"}},7.8);

      tl.to("#cap,#grid,#colist",{{opacity:0,duration:.35,ease:"power2.inOut"}},9.1);
      tl.to("#scene-end",{{opacity:1,duration:.5,ease:"power2.out"}},9.5);
      tl.fromTo("#mark",{{opacity:0,y:22}},{{opacity:1,y:0,duration:.55,ease:"power3.out"}},9.65);
      tl.fromTo("#tag",{{opacity:0,y:16}},{{opacity:1,y:0,duration:.5,ease:"power3.out"}},9.88);
      tl.fromTo("#url",{{opacity:0}},{{opacity:1,duration:.5}},10.1);"""

    return shell("fork-sentinel — the funnel", {"html": body_html, "style": style},
                 script, TOTAL, "funnel", "assets")

pathlib.Path("compositions").mkdir(exist_ok=True)
pathlib.Path("compositions/funnel.html").write_text(build_funnel(), encoding="utf-8")
print("compositions/funnel.html written (funnel, 12s)")
