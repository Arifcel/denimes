# Denimes — website

A static website (plain HTML, CSS and JavaScript, no build step). Open `index.html` in a browser, or serve the folder with any static host.

To preview locally, run `node .claude/serve.mjs` (port 8080 by default, or pass another port) and open http://localhost:8080/. Pushing to `main` deploys the site on Vercel (`vercel.json` sets no framework, so the files are served as they are).

The layout and visual language are inspired by an existing investment-firm site. All text, artwork and code here are original. The copy is sample copy, and everything the owner must supply is marked with a `data-placeholder` attribute.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home: rotating dotted globe and headline |
| `thesis.html` | Investment thesis (long-form essay) |
| `portfolio.html` | Portfolio grid with sector filter |
| `team.html` | Team |
| `blog.html` / `post.html` | Blog index and article template |
| `partners.html` | Network, stats and dotted world map |
| `legal.html` | Legal / terms (placeholder structure) |
| `login.html` | Investor portal link |

## Structure

```
*.html               one file per page (see Pages)
vercel.json          Vercel settings (static, no framework)
.claude/serve.mjs    local preview server (not deployed)
assets/
  css/style.css      shared tokens, header, overlay menu, footer, components
  css/<page>.css     page-specific styles
  js/main.js         menu, reveal-on-scroll, globe and world-map renderers
  js/globe-data.js   land mask used by the globe and the world map
  js/<page>.js       optional page scripts (e.g. portfolio filter)
  img/favicon.svg
```

Fonts come from Google Fonts: Newsreader (serif) and Hanken Grotesk (sans).

## Content to replace

Search the project for `data-placeholder` to find every item. Here is what each kind means:

| `data-placeholder` | What to supply |
| --- | --- |
| `contact-email` | Real contact address (menu and login page; currently `hello@example.com`) |
| `address` | Office address in the footer |
| `sample-copy` | Sample marketing and essay text; rewrite it in your own voice |
| `portfolio-company` | Portfolio companies: name, sector, logo, one-line description |
| `team-member` | Team members: name, role, photo, bio |
| `blog-post` | Blog posts: title and body (the sample article in `post.html` is illustrative) |
| `post-date` | Publication date of each post (`Month DD, YYYY`) |
| `post-excerpt` | One- or two-sentence summary shown in the blog list |
| `post-image` | Post artwork; currently generated SVG patterns |
| `post-category` | Category label above the article title |
| `post-author` / `author` | Author name on the article and its author box |
| `read-time` | Estimated reading time |
| `quote-source` | Attribution for the pull quote in the article |
| `pagination` | Blog pagination; wire it up once there are more posts |
| `stat` | Figures on the partners page |
| `legal-text` | Terms, privacy and disclaimers; have these written by counsel |
| `last-updated` | "Last updated" date for each legal section |
| `login-url` | Link to your investor portal |

Also review the page `<title>` and `<meta name="description">` tags, and the favicon (`assets/img/favicon.svg`).

## Customising the globe

Every `<canvas data-globe>` accepts data attributes: `data-color` (r,g,b), `data-alpha`, `data-scale`, `data-scale-w` (radius cap as a fraction of the canvas width), `data-x`, `data-y`, `data-speed`, `data-tilt`, `data-rim` and `data-start`. Moving the cursor over a globe pushes its dots aside and lights them up; the holes stay open for a moment, then slowly close. `data-hover` sets the strength of this effect (`0` turns it off), `data-hover-color` (r,g,b) sets the colour of the pushed dots and `data-hover-linger` sets how many seconds a hole stays open (default `1.5`). The world map (`<canvas data-worldmap>`) takes `data-color` (r,g,b), `data-alpha`, `data-regions` (na, ca, sa, eu, me, af, as, oc) and `data-accent` (r,g,b). Animation is disabled when the visitor prefers reduced motion.
