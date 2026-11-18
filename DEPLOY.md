# Deploying the Messing Law site

The site is plain HTML/CSS/JS with no build step and no dependencies. You can use it in two ways:

| Option | Best for | What you upload |
|---|---|---|
| **A. Host as-is** | Netlify, Cloudflare Pages, GitHub Pages, Vercel, any cPanel/Apache host | The whole folder |
| **B. Paste into a page builder** | Squarespace, Square Online, WordPress, Webflow, Wix | The snippets in `embed/` |

---

## A. Host as-is (static hosting)

Upload the folder, except `embed/`, `tools/` and `DEPLOY.md`, which do nothing on a live server. Everything works with relative paths, so it also works from a sub-folder.

- **Netlify / Cloudflare Pages**: drag the folder into the dashboard. Clean URLs (`/contact`) and `404.html` work automatically.
- **GitHub Pages**: push to a repo and enable Pages. Clean URLs and `404.html` work automatically.
- **Vercel**: `vercel.json` turns on clean URLs.
- **cPanel / Apache shared hosting (GoDaddy, Bluehost, …)**: upload into `public_html/`. `.htaccess` handles clean URLs, the 404 page and caching. Make sure hidden files are uploaded too.
- **Just opening the files**: double-click `index.html`. Everything works except the Adobe fonts (see below).

### Before going live
1. **Remove the "don't index me" flags.** These are on because this is a demo:
   - delete `<meta name="robots" content="noindex, nofollow">` from every `.html` file
   - change `robots.txt` to `User-agent: *` / `Allow: /`
2. **Connect the forms.** The contact and newsletter forms post to whatever URL is in `data-endpoint="..."`, for example a free [Formspree](https://formspree.io) form URL. Until that's set, they show a friendly "please email/call us" message.
3. **Fonts.** The Proxima Nova / DIN fonts come from the Adobe Fonts kit of the original site, which only serves fonts to domains listed in that kit. On a new domain (or a `*.netlify.app` preview), add the domain in Adobe Fonts → Web Projects. Until then the site falls back to Barlow Condensed and Helvetica, so it still looks right but not identical.

---

## B. Squarespace, Square Online and other page builders

Builders don't accept a folder of HTML files, but they do accept HTML pasted into a "Code" / "Embed" block. `tools/build-embeds.py` turns each page into such a snippet:

- All CSS is scoped to a `.ml-site` wrapper, so it doesn't break the builder's theme and the theme doesn't break it.
- Internal links become `/team`, `/practice-industries`, `/contact`, `/schedule`, `/privacy` (name the builder pages with those URL slugs).
- Images point at a URL prefix of your choice (`--asset-base`).
- If the builder blocks JavaScript, content is still fully visible. You only lose the fade-in animation, team bio pop-ups and practice-area search.

```
embed/head.html              shared fonts + styles + script   (paste ONCE, site-wide)
embed/pages/<page>.html      the content of each page          (one code block per page)
embed/footer.html            firm footer: address, hours, newsletter (optional)
embed/standalone/<page>.html head + content + footer in one   (for builders with no site-wide code injection)
embed/IMAGES.txt             the image files you need to upload
```

Rebuild after changing any page, CSS or JS:

```bash
python3 tools/build-embeds.py                                   # images at /s/<file>  (Squarespace default)
python3 tools/build-embeds.py --asset-base https://cdn.example.com/images/
```

### Where to put the images
Pick one place and pass its URL as `--asset-base`:
- **Squarespace file uploads**: upload each file listed in `embed/IMAGES.txt` via any text link → *File* → upload. Squarespace serves these at `https://yourdomain.com/s/<filename>`, which matches the default `/s/`. Open one uploaded image's link to confirm the path before building.
- **Any static host**: deploy the site as in option A (a free Netlify site is enough), then build with `--asset-base https://your-site.netlify.app/images/`. This works for every builder.

### Squarespace (7.0 / 7.1)
Needs a plan that allows Code Injection and JavaScript in Code Blocks (Core/Business or higher).
1. **Settings → Advanced → Code Injection → Header**: paste all of `embed/head.html`.
2. Create pages with URL slugs `/` (home), `/team`, `/practice-industries`, `/contact`, `/schedule`, `/privacy`.
3. On each page, add a **Code** block (set it to HTML and turn *Display Source* off) and paste the matching `embed/pages/<page>.html`.
4. Optional: paste `embed/footer.html` into a Code block in the site footer, or use Squarespace's own footer.
5. Use Squarespace's own navigation as the site menu. The custom header isn't included in the snippets, since the builder provides one.

### Square Online
Add an **Embed code** section to each page and paste `embed/standalone/<page>.html` (it includes the styles and script). Build with an `--asset-base` pointing at a static host, because Square Online has no public file path for images.

### WordPress
Paste `embed/head.html` once via a header plugin (e.g. *WPCode*), or use the standalone files. Put each `embed/pages/<page>.html` in a **Custom HTML** block on the matching page.

### Wix
Wix's *Embed HTML* element runs code inside a sandboxed frame, so links inside it open within the frame and the frame doesn't size itself to the content. It works for single pages via `embed/standalone/<page>.html`, but option A or Squarespace gives a much better result.

### Forms on builders
Either set `data-endpoint` to a Formspree URL (works everywhere), or delete the form from the snippet and use the builder's own Form block in its place.
