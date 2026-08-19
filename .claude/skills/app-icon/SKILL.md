---
name: app-icon
description: >-
  Draw app icons, bot and assistant avatars, favicons, and simple logo marks as hand-coded
  SVG, then rasterize them to PNG at the exact sizes a platform needs (Teams, Slack,
  favicon set, iOS/Android) and visually review the result before handing it over. Use this
  whenever someone asks for an icon, avatar, profile picture, app logo, favicon, or "a
  picture of X for our bot/app" — including "make it look like <brand>", "we need a new
  Teams icon", or turning an existing mark into an outline/monochrome/resized variant.
  There is no image-generation model here, so this is how icons actually get made: vector
  geometry you control, rendered and then looked at with your own eyes.
---

# App icons from hand-coded SVG

You have no image generator, but you can write SVG and you can see PNGs. That combination
is enough to produce a genuinely good flat icon, and it beats a generated image in ways
that matter here: it re-renders at any size without blurring, every dimension is editable
later, and the output is deterministic.

The one non-obvious requirement is that you must **look at what you drew**. Reasoning about
SVG coordinates is not the same as seeing the shape they make. Nearly every real mistake in
this workflow — a face that reads as the wrong animal, two circles that turn into a second
pair of eyes, a detail that dissolves at 32px — is invisible in the markup and obvious in
the render.

## The loop

1. **Settle the target.** Which platform, which sizes, which variants (color + outline?),
   transparent or filled background. See `references/platforms.md` for the common specs.
2. **Decide the mark in one sentence** before drawing: *"front-facing lion head, white on
   orange, spiked mane."* If you can't say it in a sentence, it's too complex to survive
   32 pixels.
3. **Write the SVG** (see below).
4. **Render it** with `scripts/render.py`.
5. **Read the PNG.** Look at it at final size *and* zoomed. Ask what a stranger sees, not
   what you intended.
6. **Fix and re-render.** Edit the source, never the PNG. Expect two or three passes — the
   first render is a draft, not a delivery.

## Designing something that survives 32px

An icon is not a small illustration; it's a silhouette with a couple of clues inside it.

- **One subject, centred**, with 8–12% padding so it doesn't collide with the circular or
  rounded-square masks platforms apply.
- **Two colors.** A background and a foreground. Details are *negative space* — the
  background color punched through the foreground shape, not a third color.
- **Flat.** No gradients, shadows, or 3D. They muddy at small sizes and clash with the flat
  UI around them.
- **No text**, no hairlines. Any stroke thinner than ~3% of the canvas disappears; round
  caps and joins (`stroke-linejoin="round"`) soften geometry that would otherwise look
  brittle.
- **Silhouette test:** if you filled the whole mark in one color, would it still be
  recognizable? If not, the outline variant will fail and so will the 16px favicon.

## Writing the SVG

For a mark with a handful of shapes, write the `.svg` by hand. Reach for a small Python
generator when the geometry repeats or needs arithmetic — radial arrays, star/burst manes,
rings of dots, anything on a circle. Computing 26 star points by hand invites a typo you'll
spend longer finding than the script took to write:

```python
def star(cx, cy, outer, inner, points):
    pts = []
    for i in range(points * 2):
        ang = math.radians(-90 + i * 180.0 / points)
        r = outer if i % 2 == 0 else inner
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"
```

A generator also gives you the two variants for free: write the shapes once as a function
of `(body_color, feature_color)`, then call it twice.

**Outline / monochrome variant.** Platforms that ask for one want a solid silhouette with
the details knocked out to transparent. Build it from the same geometry with a mask — white
keeps a pixel, black removes it:

```svg
<mask id="m">
  <!-- body shapes filled #FFFFFF, feature shapes filled #000000 -->
</mask>
<rect width="192" height="192" fill="#FFFFFF" mask="url(#m)"/>
```

## Rendering

```bash
python3 scripts/render.py icon.svg out.png --size 192            # final asset
python3 scripts/render.py icon.svg zoom.png --size 32 --scale 8  # zoomed review render
python3 scripts/render.py icon.svg check.png --size 32 --bg "#2b2b2b"
```

It prefers headless Chrome and falls back to `rsvg-convert`, ImageMagick, or `cairosvg`,
and it prints the actual dimensions and whether the file has an alpha channel — that
printout *is* your dimension check, so you don't need a separate `sips`/`identify` call.

If no rasterizer exists (a slim container, for instance), don't fake it: hand over the SVG,
say plainly that the PNG couldn't be produced here, and name what would need installing.

## Reviewing your own render

- **View it at the size it will actually be used.** A 192px render can look great while the
  32px version is mush.
- **A white-on-transparent icon looks like an empty white square** in most viewers. Always
  re-render it with `--bg "#2b2b2b"` before judging it, or you're reviewing nothing.
- **Watch for accidental readings.** Small paired circles become eyes; a round mark with
  radial spikes becomes a sun. Both happen constantly. If you see one, the fix is usually
  to change a shape's *character* (a slit instead of a dot), not to nudge it two pixels.
- **Check the mark against its neighbours** — a Teams or Slack avatar sits in a list of
  other avatars, so distinctiveness at a glance matters more than internal detail.

## Handing it over

Save the vector sources next to the PNGs (`assets/` is a good default) and commit both, so
the mark can be retuned later without redrawing it. Tell the user where the files are, the
exact size/format of each, and the steps to apply them in the target platform's UI — an
icon file is not the deliverable, the icon *in place* is.

## Reusing an existing brand's look

Requests are often "like <company>'s logo". Draw an original mark in their palette and
style rather than reproducing a trademarked logo, and say in one sentence that that's what
you did so the user can make their own call. This is a normal, low-drama caveat — mention
it once and move on.
