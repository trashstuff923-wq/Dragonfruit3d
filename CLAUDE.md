# Dragonfruit 3D — Project Context for Claude Code

## What this is
- Small 3D printing business in Singapore, run by Viaan (a kid — be patient, explain things clearly, and don't assume professional dev knowledge)
- Website: **dragonfruit3d.com**
- Hosted on Netlify (NOT a build pipeline — pure static drag-drop deploys)
- Contact email: dragonfruit3d@protonmail.com
- Printer: Bambu Lab P1S with AMS unit (4 filament slots)

## Tech stack — DO NOT add a build system
- **Vanilla HTML + CSS + JS** — no React, no Vue, no webpack, no npm, no TypeScript
- **Three.js r128** loaded from cdnjs (`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`) for 3D
- Inline `<style>` and `<script>` blocks in each HTML file — no separate .css/.js files
- Netlify Forms for quote/contact/order submissions
- Stripe Payment Links for checkout

This is by design. The owner is learning, the code is simple to understand, and there's no build step to break. **Do not refactor toward React / bundlers / TypeScript** unless explicitly asked.

## Deployment
- **Use the drag-drop deploys page**: https://app.netlify.com/sites/luxury-parfait-9a0d6b/deploys (scroll to bottom for drop zone)
- This is FREE — no build minutes consumed
- Do NOT use `netlify deploy` CLI or `netlify-cli deploy --prod` — those run a build and burn build minutes (Viaan has a free-tier limit)
- Site ID: `32c232be-94b8-4f97-9bfb-8fcaa35e50be`
- Team ID: `699ad5868c460fc5b75a8f43`
- Site slug: `luxury-parfait-9a0d6b`

## Brand / Style guide (strict — don't deviate)
- Primary: **hot pink `#ff0096`**
- Secondary: **purple `#9D4EDD`**
- Accent: **sky cyan `#00d4ff`**
- **No green anywhere.** Previously rejected mint #00ff9d.
- Fonts: **Orbitron** (headings, UPPERCASE) + **Space Mono** (body, code comments)
- Aesthetic: cyberpunk / neon / grid lines. Dark backgrounds, glowing accents.
- Code comments in UI text style `// like this` (Space Mono) are a signature touch

## File structure
```
index.html                        # Homepage with product cards + Three.js STL viewer modal
customize-vase.html               # Vase customizer (Three.js procedural geometry) — version stamp at line 2
credits.html                      # Model attributions
thank-you.html                    # Post-Stripe-checkout page
benchy-viewer-dragonfruit.html    # Standalone Benchy viewer (rarely used)
dragonfruit-logo.html             # Logo design page
netlify.toml                      # Has STL + image cache headers — DON'T break these
*.stl                             # 6 STL files at root, decimated for web (see below)
images/                           # Product photos + logos
cards-FRONT.pdf / cards-BACK.pdf  # Business cards (A4, 3 per page)
dragonfruit-logo-flat.svg         # Vector logo
```

## STL file caveat — IMPORTANT
The STLs on the site are **decimated (simplified) versions** for fast web preview only:
- `cat-stand.stl` — 12MB (originally 59MB, 250k tris)
- `dragon.stl` — 4MB (originally 16MB, 80k tris)
- `3dbenchy.stl` — 3MB (originally 11MB, 60k tris)
- Others are tiny (already low-poly originals)

**For actual 3D printing**, Viaan keeps the original full-detail STLs on his local computer. The web versions are display-only. Don't try to "fix" the low-poly look — it's intentional for fast loading.

If you ever need to re-decimate, use `open3d` Python lib:
```python
mesh = o3d.io.read_triangle_mesh(path)
simplified = mesh.simplify_quadric_decimation(target_tri_count)
simplified.compute_vertex_normals()   # REQUIRED — STL save fails without normals
simplified.compute_triangle_normals()
o3d.io.write_triangle_mesh(path, simplified, write_ascii=False)
```

## Current version of vase customizer: v19
The top of `customize-vase.html` has a `<!-- ... v19 ... -->` stamp. Bump it when you make changes. Also bump the visible `<div>...v19</div>` near the bottom of the same file (used to verify the live site is running the latest).

### Vase customizer architecture (Three.js)
- 4 styles: **pottery** (LatheGeometry), **twisted** (polygonal extrude, faceted by design), **wave** (sine radii), **ribbed** (cosine)
- 3 patterns: bands, stripes, split. (Gradient was REMOVED — not AMS-printable.)
- 12 color swatches with surcharges (Ice Blue +$1, Glow Blue +$3, Indigo no surcharge)
- "Number of colors" slider (2–4) and "Number of bands/stripes" slider (2–12, hidden for split/single)
- **Two-layer rendering:** outer mesh (DoubleSide, vertex colors) + inner mesh (BackSide, 93% X/Z, 96% Y scaled, lifted 3mm, 40% darker vertex colors). This gives the hollow-vase look. Don't switch to single-mesh — it removes the hollow appearance.
- Top caps were REMOVED from `buildExtruded` and `buildTwistedPoly` so the inner mesh shows through the open top. Don't add them back.
- P1S size limits enforced via `scaledP()`: max 25cm tall × 23cm wide. Sliders can exceed this in cm display but actual mesh clamps.

### Pricing constants (customize-vase.html, in `COST` object)
```js
filamentPerGram: 0.05, printRateGramsPerHr: 15, machineHourly: 2,
brimGrams: 2, purgeGramsPerSwap: 1.5, purgeSwapsPerCm: 1.5,
failureRate: 0.05, markup: 1.4, setupFee: 3, minOrder: 12
```
Don't change these without asking.

## 3D viewer (in index.html)
- Modal that loads any STL on click
- Uses `MeshPhongMaterial` with `side: THREE.DoubleSide` — this is INTENTIONAL (fixes "wireframe-looking" appearance on decimated STLs whose triangle windings may be inconsistent)
- 12 color swatches inside the viewer
- "Auto Rotate" + "Reset View" buttons

## Netlify Forms (already configured)
1. **custom-vase** (id `69f43c9a18867100086fa1eb`) — vase customizer quote requests
2. **orders** (id `69aeb03de9e7e80007ed42f7`) — Stripe order log (BUGGED, see below)
3. **contact** (id `69aeb03de9e7e80007ed42f6`)
4. **quote** (id `69aeb03de9e7e80007ed42f5`)

## Known bugs / pending work
1. **Orders form fires BEFORE Stripe checkout completes** — in `index.html` around line 3661, `submitOrderToNetlify()` runs immediately followed by `window.location.href = url`. Result: every click of "Buy" logs an order even if the customer never pays. ~17 orders in the form so far, probably half are fake/duplicates. **Fix options:**
   - (A) Move `submitOrderToNetlify()` inside the `success === 'true'` handler on the thank-you page
   - (B) Build a Stripe webhook → Netlify Function to log only paid orders (proper but more work)
2. **Customer contact info missing on orders** — all submissions show "Guest / No email / No phone" because checkout doesn't collect them. Stripe Payment Links can collect email if configured in Stripe Dashboard.
3. **Cat Phone Stand model attribution** — already in credits.html under "Models from MakerWorld community designers": "Cat Phone Stand · Designed by Jaroslaw on MakerWorld"

## Local dev
```bash
cd ~/Projects/dragonfruit3d-COMPLETE   # NOT in iCloud (Desktop/Documents are iCloud-synced)
python3 -m http.server 8000
# Open http://localhost:8000
```

## Recurring user issues (heads up)
- **iCloud storage often full** → downloaded tar.gz files become cloud-stub placeholders that Archive Utility can't extract. Always extract via Terminal: `tar -xzf file.tar.gz`. Don't double-click.
- Owner prefers testing on localhost:8000 before deploying to "save Netlify credits" (note: drag-drop deploys don't actually use credits, but he likes to verify locally regardless)
- Owner gets confused between versions across downloads — keep version stamps in customize-vase.html clear and bump them every change

## What NOT to do
- ❌ Add green to the palette
- ❌ Add a build system (no npm, no webpack, no React)
- ❌ Replace inline scripts with external .js files (keeps things simple for the owner to read)
- ❌ Remove the version markers in customize-vase.html (top stamp + visible div)
- ❌ Re-add top caps to `buildExtruded` / `buildTwistedPoly` (breaks hollow-vase look)
- ❌ Switch viewer material away from DoubleSide (causes wireframe look)
- ❌ Suggest using Netlify CLI deploy (burns build minutes — use drag-drop instead)
- ❌ Replace decimated STLs with originals without re-decimating (loads slow)

## Working style preference
The owner is a kid running a real business. He learns by reading code and asking questions. Prefer:
- Short, focused responses over walls of text
- Showing what you're doing in code rather than long explanations
- Honest acknowledgement when you don't know or got something wrong
- Verifying your changes work (visual tests for UI, real curl tests for deploy state) before declaring "done"
- When deploying: remind him to drag the folder to the Netlify deploys page, not run CLI
