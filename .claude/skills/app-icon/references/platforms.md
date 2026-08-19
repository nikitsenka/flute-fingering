# Platform icon specs

Common requirements, for picking sizes before you draw. Platforms revise these, so when a
submission is on the line, check the vendor's current docs — treat this as a starting point,
not gospel.

## Microsoft Teams (app manifest)

| Asset | Size | Format |
| --- | --- | --- |
| Color icon | 192×192 | PNG, full-bleed artwork; transparent or filled background |
| Outline icon | 32×32 | PNG, **white only** on a transparent background |

The outline icon appears in the app bar and activity feed. It must be a flat white
silhouette — anti-aliased edges are fine, other colors are not. Both live under
**Developer Portal → Apps → *your app* → Configure → Basic information → App icons**.
An already-installed app keeps its old icon until the package is re-uploaded.

## Slack

App icon 512×512 PNG (square, no transparency needed — Slack rounds the corners). Larger
uploads up to 2000×2000 are accepted and downscaled.

## Web / favicon set

| Asset | Size | Notes |
| --- | --- | --- |
| `favicon.ico` | 16, 32, 48 in one file | The 16px version is the real design constraint |
| `apple-touch-icon.png` | 180×180 | No transparency; iOS composites on white |
| PWA manifest icons | 192×192 and 512×512 | |
| Maskable icon | 512×512 | Keep all meaningful content inside the centre 80% — the outer ring gets cropped |

## Mobile / desktop apps

- **iOS App Store:** 1024×1024 PNG, no alpha channel, square (the system rounds it).
- **Android adaptive:** export 432×432; anything outside the central ~264px circle can be
  cropped by the launcher's mask.
- **macOS:** 1024×1024 with roughly 10% transparent margin, then generate the `.icns` set.

## Rules of thumb across platforms

- Design at the largest required size and downscale; never upscale.
- Assume a circular mask unless you know otherwise — corners are unreliable real estate.
- Opaque backgrounds are safer than transparent ones for avatars, which get shown on both
  light and dark surfaces.
