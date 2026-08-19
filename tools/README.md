# How the score and the fingerings were recovered

The source this describes, `flute-zombie.drawio`, is **no longer kept in the
repo**. This note is the record of where the data came from; nothing here can
be re-run against the original, but nothing needs to be — `make_score.py`
carries the transcribed notes as literals and regenerates `score.js` on its
own, and the flute chart is hand-maintained.

> The file this describes as `fingering.js` is now `instruments/flute.js`. It
> moved when the app grew a second instrument: `instruments.js` is the registry
> and every instrument is one module that signs into it. Everything below still
> describes that flute table, which came across unchanged.

The drawio held no musical data — it was 134 embedded PNGs: nine strips of
engraved staff, and 125 fingering charts rotated 90° and dropped under
individual notes. Everything originally in `score.js` and `fingering.js` was
read back out of those pixels.

## Pitches

For each staff strip: find the five staff lines (rows that are dark across
most of the width), then find the noteheads (3×3 erosion of the dark mask,
keeping blobs of 13–32 px that are at most 12×10). A notehead's centre row
converts to a diatonic step, and the bottom line is E4.

## Rhythm

Read by eye from 4×-upscaled crops annotated with the detected pitches and
barlines. `make_score.py` then asserts that every measure adds up to 4 beats,
which catches a misread duration immediately.

## Cross-check

Identical pitches carry byte-identical chart images, so the sequence of chart
images is an independent encoding of the sequence of pitches. Lining the two
up agreed everywhere except five notes (below), and the counts match exactly:

    125 charts + 24 notes in bars 37-40 (which the drawio left bare) = 149

…which is what `make_score.py` reports.

## Which chart means what

Twelve distinct chart images appear. Locating the filled (magenta, #c32679)
areas in each and normalising for the two different image scales gives, per
chart, the set of pressed keys. Matching those against the pitch each chart
sat under identifies every element of the diagram:

| element        | evidence |
|----------------|----------|
| E-flat key     | filled for every pitch except D4 and D5 — exactly the notes that release it |
| thumb B        | filled for everything except C5 — C natural is the note that lifts the thumb |
| LH1 / LH2 / LH3| drop out one at a time going B4 → A4 → G4 |
| RH1 / RH2 / RH3| added one at a time going G4 → F#4 → E5 → D4 |

That last row is the flute's natural D-major scale, which is the sanity check
that the reading is right: closing one more hole from the bottom walks down
D – C# – B – A – G – F# – E – D.

## Correction: RH1 vs RH3

The reading of the *images* above is right — those really are the filled areas —
but the last row of the table mislabels which key one of them is. It assumes the
right hand adds fingers top-down as the pitch falls, so the circle filled for
F#4 was called RH1 (index). On a Boehm flute the F# key is worked by the **ring**
finger and F natural by the **index**; the keywork does not follow the order the
tone holes sit in.

Adding F natural for the C major scale made this visible: the standard F♮
fingering is byte-identical to what `fingering.js` had stored for F#. So
`fingering.js` now uses the standard chart —

    F  natural   thumb + LH1 LH2 LH3 + RH1 + Eb
    F# (f#/4, f#/5)  thumb + LH1 LH2 LH3 + RH3 + Eb   <- was RH1

The D-major-walk sanity check below the table is therefore a description of the
hole positions, not of the fingerings.

Still unreconciled: `d/5` was decoded with LH1 lifted, which is the third-octave
D. Second-octave D shares D4's fingering. Left as decoded.

## The five mismatches in the source

The drawio pastes the wrong chart under five notes. `fingering.js` generates
diagrams from the pitch, so these are corrected:

- bar 28, last note — E5 written, D5 chart pasted
- bars 33 and 36 — four A5 notes carrying the G5 chart

## Regenerating

    python3 tools/make_score.py     # rewrites ../score.js, validates bar lengths
