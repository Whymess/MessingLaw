#!/usr/bin/env python3
"""
Build paste-in versions of the site for page builders
(Squarespace, Square Online, Wix, WordPress, Webflow, ...).

    python3 tools/build-embeds.py                      # images served from /s/ (Squarespace file uploads)
    python3 tools/build-embeds.py --asset-base https://example.netlify.app/images/

Writes to embed/ (regenerated each run, never edit by hand):
    embed/head.html               fonts + scoped CSS + JS   -> site-wide "Code Injection > Header"
    embed/footer.html             firm footer (address, hours, newsletter)
    embed/pages/<page>.html       page content only          -> one Code/Embed block per page
    embed/standalone/<page>.html  head + content + footer in one paste (builders without site-wide injection)
    embed/IMAGES.txt              image files to upload to the builder / image host

Uses only the Python standard library.
"""
import argparse
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "embed"
PAGES = ["index.html", "team.html", "practice-industries.html", "contact.html", "schedule.html", "privacy.html"]

# Prefix used to scope every CSS rule. :is() takes the specificity of its most
# specific argument (the id), so these rules beat typical builder theme CSS,
# while still matching the .ml-site wrapper class.
P = ":is(#ml-site,.ml-site)"


# ---------------------------------------------------------------- CSS scoping
def split_top_level(s, sep=","):
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == sep and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def scope_selector(sel):
    if sel in (":root", "html", "body"):
        return P
    if sel.startswith(("html.", "body.")):
        return P + sel[4:]
    if sel.startswith(".no-js "):
        return None  # embedded content is visible by default; see .ml-js below
    if ".reveal" in sel:
        return f"{P}.ml-js {sel}"  # only hide-for-animation when JS is actually running
    return f"{P} {sel}"


def scope_css(css):
    out, i = [], 0
    while True:
        j = css.find("{", i)
        if j == -1:
            break
        prelude = css[i:j].strip()
        if prelude.startswith("@"):
            # find matching close brace for an at-rule block
            depth, k = 1, j + 1
            while depth:
                depth += {"{": 1, "}": -1}.get(css[k], 0)
                k += 1
            inner = css[j + 1:k - 1]
            out.append(f"{prelude} {{\n{scope_css(inner)}}}\n")
            i = k
        else:
            k = css.find("}", j)
            body = css[j + 1:k].strip()
            sels = [s for s in (scope_selector(x) for x in split_top_level(prelude)) if s]
            if sels:
                out.append(f"{', '.join(sels)} {{ {body} }}\n")
            i = k + 1
    return "".join(out)


# ---------------------------------------------------------------- HTML rewriting
def page_url(name):
    stem = name[:-5]
    return "/" if stem == "index" else "/" + stem


def rewrite(html, asset_base, used):
    def fix_url(u):
        if u.startswith("images/"):
            used.add(u[len("images/"):])
            return asset_base + u[len("images/"):]
        m = re.fullmatch(r"([a-z0-9-]+\.html)(#.*)?", u)
        if m and m.group(1) in PAGES:
            return page_url(m.group(1)) + (m.group(2) or "")
        return u

    html = re.sub(r'\b(src|href)="([^"]+)"', lambda m: f'{m.group(1)}="{fix_url(m.group(2))}"', html)
    html = re.sub(r'\bsrcset="([^"]+)"', lambda m: 'srcset="' + ", ".join(
        " ".join([fix_url(c.split()[0])] + c.split()[1:]) for c in m.group(1).split(",")) + '"', html)
    html = re.sub(r"url\('([^']+)'\)", lambda m: f"url('{fix_url(m.group(1))}')", html)
    return html


def between(html, start, end, include=False):
    a = html.index(start)
    b = html.index(end, a)
    return html[a:b + len(end)] if include else html[a + len(start):b]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--asset-base", default="/s/",
                    help="URL prefix where the image files are hosted (default: /s/, Squarespace's file-upload path)")
    args = ap.parse_args()
    base = args.asset_base if args.asset_base.endswith("/") else args.asset_base + "/"

    used = set()
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "pages").mkdir(parents=True)
    (OUT / "standalone").mkdir()

    # Head: fonts + scoped CSS + JS (copied from the static site's <head>)
    sample = (ROOT / "index.html").read_text(encoding="utf-8")
    # Whole <script>/<link> tags that load the Adobe Fonts kit (tags may span several lines).
    font_tags = "\n".join(
        m.group(0)
        for m in re.finditer(r"<(script|link)\b[^>]*use\.typekit\.net/ik/[^>]*>(?:</script>)?", sample)
    )
    # The static site self-hosts these (assets/fonts); builders can't serve them, so use Google Fonts.
    font_tags += ('\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Trykker'
                  '&amp;family=Barlow+Condensed:wght@500;700&amp;display=swap">')
    css = (ROOT / "assets/css/styles.css").read_text(encoding="utf-8")
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"@font-face\s*\{[^}]*\}", "", css)
    css = re.sub(r'url\("\.\./\.\./images/([^"]+)"\)',
                 lambda m: (used.add(m.group(1)) or f'url("{base}{m.group(1)}")'), css)
    reset = (f"{P} {{ display: block; text-align: left; }}\n"
             f"{P} * {{ white-space: normal; }}\n")  # neutralise common builder text resets
    js = (ROOT / "assets/js/main.js").read_text(encoding="utf-8")
    head = (f"<!-- Messing Law: shared styles & behaviour. Generated by tools/build-embeds.py; do not edit by hand. -->\n"
            f"{font_tags}\n<style>\n{reset}{scope_css(css)}</style>\n<script>\n{js}</script>\n")
    (OUT / "head.html").write_text(head, encoding="utf-8")

    footer = None
    for name in PAGES:
        html = (ROOT / name).read_text(encoding="utf-8")
        main_html = between(html, '<main id="main">', "</main>").strip()
        content = f'<div class="ml-site">\n{rewrite(main_html, base, used)}\n</div>\n'
        (OUT / "pages" / name).write_text(content, encoding="utf-8")
        if footer is None:
            f = between(html, '<footer class="site-footer">', "</footer>", include=True)
            footer = f'<div class="ml-site">\n{rewrite(f, base, used)}\n</div>\n'
            (OUT / "footer.html").write_text(footer, encoding="utf-8")
        (OUT / "standalone" / name).write_text(head + content + footer, encoding="utf-8")

    missing = sorted(u for u in used if not (ROOT / "images" / u).exists())
    (OUT / "IMAGES.txt").write_text(
        f"Upload these files from images/ so they are reachable at {base}<filename>\n\n"
        + "\n".join(sorted(used)) + "\n", encoding="utf-8")

    print(f"Built embed/ with images at {base}")
    for p in sorted(OUT.rglob("*.html")):
        print(f"  {p.relative_to(ROOT)}  {p.stat().st_size / 1024:.1f} KB")
    if missing:
        raise SystemExit(f"Missing image files: {missing}")


if __name__ == "__main__":
    main()
