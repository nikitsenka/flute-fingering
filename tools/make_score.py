#!/usr/bin/env python3
"""The Zombie flute line -> score.js (VexFlow-shaped data).

The notes below were recovered from flute-zombie.drawio, which is no longer
kept in the repo; everything needed to regenerate score.js is the literal
data in this file, so it still runs on its own.

Pitches were read from the staff images by pixel analysis and cross-checked
against the fingering chart attached to each note in the drawio; rhythm was
read from 4x-upscaled crops and every measure is validated to 4 beats below.
"""
import json
import os

R = 'R'
DUR = {'w': 4.0, 'h': 2.0, 'q': 1.0, 'qd': 1.5, '8': 0.5}

# (measure number, notes, beams, ties, slurs, barline)
#   notes  : list of (pitch|'R', duration)
#   beams  : list of index groups
#   ties    : list of (i, j) index pairs, same pitch
#   slurs  : list of (i, j) index pairs within the measure
M = []


def m(n, notes, beams=(), ties=(), slurs=(), bar=None, repeat=None):
    M.append(dict(n=n, notes=list(notes), beams=[list(b) for b in beams],
                  ties=[list(t) for t in ties], slurs=[list(s) for s in slurs],
                  bar=bar, repeat=repeat))


# ---- system 1 : bars 14-16 -------------------------------------------------
m(14, [(R, 'w')])
m(15, [('b/4', '8'), ('c/5', 'q'), ('a/4', '8'), ('b/4', 'q'),
       ('g/4', '8'), ('a/4', '8')],
  beams=[(4, 5)], slurs=[(0, 1), (2, 3), (4, 5)], repeat='begin')
m(16, [(R, '8'), ('f#/4', '8'), ('g/4', '8'), ('f#/4', '8'),
       ('d/4', 'q'), ('d/4', 'q')],
  beams=[(1, 2, 3)], slurs=[(1, 3)])

# ---- system 2 : bars 17-19 -------------------------------------------------
m(17, [(R, 'q'), ('e/5', '8'), ('d/5', '8'), ('d/5', '8'), ('b/4', '8'),
       (R, 'q')],
  beams=[(1, 2), (3, 4)], ties=[(2, 3)])
m(18, [('d/5', '8'), ('c/5', 'q'), ('b/4', 'q'), ('a/4', '8'), (R, 'q')])
m(19, [('c/5', '8'), ('b/4', 'q'), ('a/4', 'q'), ('g/4', 'q'), ('a/4', '8')])

# ---- system 3 : bars 20-22 -------------------------------------------------
m(20, [('f#/4', 'q'), (R, 'q'), (R, 'h')])
m(21, [(R, 'q'), ('e/5', '8'), ('d/5', '8'), ('d/5', '8'), ('b/4', '8'),
       (R, 'q')],
  beams=[(1, 2), (3, 4)], ties=[(2, 3)])
m(22, [('d/5', '8'), ('c/5', 'q'), ('b/4', 'q'), ('a/4', '8'), (R, 'q')])

# ---- system 4 : bars 23-25 -------------------------------------------------
m(23, [('c/5', '8'), ('b/4', 'q'), ('a/4', 'q'), ('g/4', 'q'), ('a/4', '8')])
m(24, [('f#/4', 'q'), (R, 'q'), (R, '8'),
       ('f#/5', '8'), ('f#/5', '8'), ('e/5', '8')],
  beams=[(3, 4, 5)])
m(25, [(R, '8'), ('e/5', '8'), ('f#/5', '8'), ('e/5', '8'),
       (R, '8'), ('e/5', '8'), ('f#/5', '8'), ('g/5', '8')],
  beams=[(1, 2, 3), (5, 6, 7)])

# ---- system 5 : bars 26-28 -------------------------------------------------
m(26, [(R, '8'), ('e/5', '8'), ('f#/5', '8'), ('g/5', '8'),
       (R, '8'), ('g/5', '8'), ('f#/5', '8'), ('d/5', '8')],
  beams=[(1, 2, 3), (5, 6, 7)])
m(27, [('b/4', '8'), ('g/5', '8'), ('f#/5', '8'), ('d/5', '8'),
       (R, '8'), ('g/5', '8'), ('g/5', '8'), ('a/5', '8')],
  beams=[(0, 1, 2, 3), (5, 6, 7)])
m(28, [('f#/5', 'h'), (R, '8'), ('g/5', '8'), ('f#/5', '8'), ('e/5', '8')],
  beams=[(2, 3, 4)])

# ---- system 6 : bars 29-32 -------------------------------------------------
m(29, [(R, '8'), ('e/5', '8'), ('f#/5', '8'), ('e/5', '8'),
       (R, '8'), ('e/5', '8'), ('f#/5', '8'), ('e/5', '8')],
  beams=[(1, 2, 3), (5, 6, 7)])
m(30, [(R, '8'), ('e/5', '8'), ('f#/5', '8'), ('e/5', '8'),
       (R, '8'), ('g/5', '8'), ('f#/5', '8'), ('d/5', '8')],
  beams=[(1, 2, 3), (5, 6, 7)])
m(31, [('b/4', '8'), ('g/5', '8'), ('f#/5', '8'), ('d/5', '8'),
       (R, '8'), ('g/5', '8'), ('g/5', '8'), ('a/5', '8')],
  beams=[(0, 1, 2, 3), (5, 6, 7)])
m(32, [('f#/5', 'h'), (R, 'q'), ('f#/5', '8'), ('f#/5', '8')],
  beams=[(2, 3)], bar='double')

# ---- system 7 : bars 33-36 -------------------------------------------------
m(33, [('g/5', 'qd'), ('e/5', '8'), (R, 'q'), ('f#/5', '8'), ('a/5', '8')],
  beams=[(3, 4)])
m(34, [('g/5', 'qd'), ('e/5', '8'), (R, '8'),
       ('e/5', '8'), ('f#/5', '8'), ('d/5', '8')],
  beams=[(3, 4, 5)], slurs=[(0, 1), (3, 4)])
m(35, [(R, '8'), ('e/5', '8'), ('f#/5', '8'), ('d/5', '8'),
       (R, '8'), ('e/5', '8'), ('f#/5', '8'), ('f#/5', '8')],
  beams=[(1, 2, 3), (5, 6, 7)], slurs=[(1, 2), (5, 6)])
m(36, [('a/5', '8'), ('f#/5', '8'), ('a/5', '8'), ('f#/5', '8'),
       ('a/5', '8'), ('f#/5', '8'), ('f#/5', '8'), ('f#/5', '8')],
  beams=[(0, 1, 2, 3), (4, 5, 6, 7)], slurs=[(1, 2), (3, 4)])

# ---- system 8 : bars 37-40 -------------------------------------------------
m(37, [('g/5', 'qd'), ('e/5', '8'), ('e/5', 'q'),
       ('f#/5', '8'), ('a/5', '8')],
  beams=[(3, 4)])
m(38, [('g/5', 'qd'), ('e/5', '8'), (R, '8'),
       ('e/5', '8'), ('f#/5', '8'), ('d/5', '8')],
  beams=[(3, 4, 5)], slurs=[(0, 1), (3, 4)])
m(39, [(R, '8'), ('e/5', '8'), ('f#/5', '8'), ('d/5', '8'),
       (R, '8'), ('e/5', '8'), ('f#/5', '8'), ('f#/5', '8')],
  beams=[(1, 2, 3), (5, 6, 7)], slurs=[(1, 2), (5, 6)])
m(40, [('a/5', '8'), ('f#/5', '8'), ('a/5', '8'), ('f#/5', '8'),
       ('a/5', '8'), ('f#/5', '8'), ('a/5', '8'), ('e/5', '8')],
  beams=[(0, 1, 2, 3), (4, 5, 6, 7)], slurs=[(1, 2), (3, 4), (5, 6)])

# ---- system 9 : bars 41-44 -------------------------------------------------
m(41, [(R, '8'), ('g/5', '8'), (R, '8'), ('f#/5', '8'),
       (R, '8'), ('b/4', '8'), (R, '8'), ('c/5', '8')])
m(42, [(R, '8'), ('g/5', '8'), (R, '8'), ('f#/5', '8'),
       (R, '8'), ('c/5', '8'), (R, '8'), ('b/4', '8')])
m(43, [(R, '8'), ('g/5', '8'), (R, '8'), ('f#/5', '8'),
       (R, '8'), ('c/5', '8'), (R, '8'), ('b/4', '8')])
m(44, [(R, '8'), ('g/5', '8'), (R, '8'), ('f#/5', '8'),
       (R, '8'), ('c/5', '8'), (R, 'q')], bar='double')

# how the source drawio broke the music into systems (used as layout hints)
SYSTEMS = [[14, 15, 16], [17, 18, 19], [20, 21, 22], [23, 24, 25],
           [26, 27, 28], [29, 30, 31, 32], [33, 34, 35, 36],
           [37, 38, 39, 40], [41, 42, 43, 44]]

# slurs that cross a barline: ((measure number, note index), (measure, index))
CROSS_SLURS = [((26, 7), (27, 0)), ((30, 7), (31, 0))]

# ---------------------------------------------------------------------------
if __name__ == '__main__':
    for x in M:
        total = sum(DUR[d] for _, d in x['notes'])
        assert abs(total - 4.0) < 1e-9, (x['n'], total)
    notes = sum(1 for x in M for p, _ in x['notes'] if p != R)
    print('measures %d, sounding notes %d - every bar sums to 4 beats'
          % (len(M), notes))

    for si, grp in enumerate(SYSTEMS):
        for num in grp:
            next(x for x in M if x['n'] == num)['sys'] = si
    assert all('sys' in x for x in M)

    payload = {'key': 'G', 'time': '4/4', 'measures': M,
               'systems': SYSTEMS,
               'crossSlurs': [[list(a), list(b)] for a, b in CROSS_SLURS]}
    js = ('/* Zombie - flute line, bars 14-44.\n'
          '   Generated by tools/make_score.py - edit that, not this file.\n'
          '   Provenance of the transcription: tools/README.md. */\n'
          'const SCORE = ' + json.dumps(payload, indent=1) + ';\n')
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    open(os.path.join(root, 'score.js'), 'w').write(js)
    print('wrote score.js')
