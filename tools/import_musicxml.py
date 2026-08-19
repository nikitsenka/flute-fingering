#!/usr/bin/env python3
"""MusicXML -> a songs.js entry.

make_score.py exists because the Zombie part had to be recovered from images.
This is the same job for the ordinary case: a MusicXML file you already have.

    python3 tools/import_musicxml.py tune.musicxml --id mario --title "Марио"

Reads .musicxml / .xml (plain) or .mxl (zipped), takes one melody line, and
prints a JS object you can paste into songs.js. Nothing is written in place --
look at the output, paste it in, then run `node tools/check_songs.js`.

The game is monophonic, so chords are reduced to their top note and only one
voice is read. Anything that will not play on the flute -- a pitch outside
c/4..b/5, an accidental with no fingering, a bar that does not add up -- is
reported on stderr rather than silently dropped.
"""
import argparse
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

# beats -> the duration codes game.html understands (BEATS in the inline script)
def sibling(name):
    return os.path.join(os.path.dirname(__file__), '..', name)


def durations():
    """(beats, code) pairs, longest first, read from durations.js so this tool
    and the pages cannot disagree about what a note length means."""
    with open(sibling('durations.js'), encoding='utf-8') as fh:
        source = fh.read()
    out = []
    for code, beats in re.findall(
            r'\{code:"([^"]+)",\s*beats:([0-9./ ]+?),', source):
        top, _, bottom = beats.partition('/')        # "0.75" or "2 / 3"
        out.append((float(top) / float(bottom or 1), code))
    if not out:
        sys.exit('could not read the table in durations.js')
    return out


DUR = None                 # filled in by main(), see durations()

# <key><fifths> -> VexFlow key signature name
FIFTHS = {0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
          -1: 'F', -2: 'Bb', -3: 'Eb', -4: 'Ab', -5: 'Db', -6: 'Gb', -7: 'Cb'}

SEMI = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}

def playable():
    """The pitches fingering.js can draw, read from the file itself so this
    list cannot drift out of step with it."""
    with open(sibling('fingering.js'), encoding='utf-8') as fh:
        source = fh.read()
    table = re.search(r'var FINGERINGS = \{(.*?)\n  \};', source, re.S)
    if not table:
        sys.exit('could not find FINGERINGS in fingering.js')
    return re.findall(r'"([a-g]#?/\d)"\s*:', table.group(1))


PLAYABLE = None            # filled in by main(), see playable()


def midi(pitch):
    step, octave = pitch.split('/')
    return (int(octave) + 1) * 12 + SEMI[step[0]] + (1 if '#' in step else 0)


def load(path):
    """Return the document root, unzipping .mxl if need be."""
    if not zipfile.is_zipfile(path):
        return ET.parse(path).getroot()
    with zipfile.ZipFile(path) as z:
        # META-INF/container.xml names the real score inside the container
        try:
            container = ET.fromstring(z.read('META-INF/container.xml'))
            name = container.find('.//rootfile').get('full-path')
        except Exception:
            names = [n for n in z.namelist()
                     if n.endswith(('.xml', '.musicxml')) and 'META-INF' not in n]
            if not names:
                sys.exit('%s: no score inside the .mxl container' % path)
            name = names[0]
        return ET.fromstring(z.read(name))


def strip_ns(root):
    """MusicXML is sometimes namespaced; make every tag a plain local name."""
    for el in root.iter():
        if isinstance(el.tag, str) and '}' in el.tag:
            el.tag = el.tag.split('}', 1)[1]
    return root


def pitch_of(note):
    p = note.find('pitch')
    if p is None:
        return None
    step = p.findtext('step', '').strip().lower()
    octave = int(p.findtext('octave', '4'))
    alter = int(float(p.findtext('alter', '0') or 0))
    if alter == 1:
        return '%s#/%d' % (step, octave)
    if alter == -1:
        # respell the flat upward: bb -> a#, eb -> d#, ...
        n = midi('%s/%d' % (step, octave)) - 1
        names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
        return '%s/%d' % (names[n % 12], n // 12 - 1)
    if alter != 0:
        return None            # double sharps/flats: caller reports it
    return '%s/%d' % (step, octave)


def code_for(beats):
    for value, name in DUR:
        if abs(beats - value) < 1e-6:
            return name
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file', help='.musicxml, .xml or .mxl')
    ap.add_argument('--id', default='song', help='id used in the SONGS registry')
    ap.add_argument('--title', default='Новая песня', help='name shown in the picker')
    ap.add_argument('--var', default=None, help='JS variable name (default: ID upper-cased)')
    ap.add_argument('--part', default=None, help='part id to read (default: the first)')
    ap.add_argument('--staff', default=None,
                    help='staff to read in a multi-staff part, e.g. 1 for a piano '
                         'right hand (default: the staff of the first note)')
    ap.add_argument('--octave', type=int, default=0,
                    help='shift every note by N octaves to fit the flute')
    ap.add_argument('--first-bar', type=int, default=1, help='number of the first bar')
    args = ap.parse_args()

    global PLAYABLE, DUR
    PLAYABLE = playable()
    DUR = durations()

    root = strip_ns(load(args.file))

    parts = root.findall('part')
    if not parts:
        sys.exit('%s: no <part> found -- is this MusicXML?' % args.file)
    part = parts[0]
    if args.part:
        match = [p for p in parts if p.get('id') == args.part]
        if not match:
            sys.exit('no part with id %r; available: %s'
                     % (args.part, ', '.join(p.get('id') or '?' for p in parts)))
        part = match[0]
    elif len(parts) > 1:
        ids = ', '.join(p.get('id') or '?' for p in parts)
        warn('%d parts in this file (%s); reading %r. Use --part to pick another.'
             % (len(parts), ids, part.get('id')))

    divisions = 1        # ticks per quarter note, from the first <attributes>
    key = 'C'
    time_sig = '4/4'
    beats_per_bar = 4.0
    measures = []
    problems = []
    voice_wanted = None
    staff_wanted = args.staff
    staves = part.findtext('measure/attributes/staves')
    if staves and int(staves) > 1 and staff_wanted is None:
        warn('this part has %s staves (a piano arrangement?); reading the staff of '
             'the first note. Use --staff to pick another.' % staves)

    for index, measure in enumerate(part.findall('measure')):
        attrs = measure.find('attributes')
        if attrs is not None:
            if attrs.findtext('divisions'):
                divisions = int(attrs.findtext('divisions'))
            fifths = attrs.find('key/fifths')
            if fifths is not None:
                key = FIFTHS.get(int(fifths.text), 'C')
            time = attrs.find('time')
            if time is not None:
                top = int(time.findtext('beats', '4'))
                bottom = int(time.findtext('beat-type', '4'))
                time_sig = '%d/%d' % (top, bottom)
                beats_per_bar = top * 4.0 / bottom

        number = args.first_bar + index
        notes = []
        total = 0.0

        for note in measure.findall('note'):
            if note.find('grace') is not None:
                continue                          # no time of their own
            staff = note.findtext('staff', '1')
            if staff_wanted is None:
                staff_wanted = staff
            if staff != staff_wanted:
                continue                          # the other hand of a piano part
            voice = note.findtext('voice')
            if voice_wanted is None:
                voice_wanted = voice
            if voice != voice_wanted:
                continue                          # a second voice on the same staff
            if note.find('chord') is not None:
                # monophonic game: keep the highest note of the chord
                previous = pitch_of(note)
                if previous and notes and notes[-1][0] != 'R':
                    if midi(previous) > midi(notes[-1][0]):
                        notes[-1] = (previous, notes[-1][1])
                continue

            ticks = float(note.findtext('duration', '0') or 0)
            beats = ticks / divisions if divisions else 0.0
            code = code_for(beats)
            if code is None:
                problems.append('bar %d: %g beats has no duration code '
                                '(tuplet or an unusual value?)' % (number, beats))
                code = 'q'
                beats = 1.0

            if note.find('rest') is not None:
                notes.append(('R', code))
            else:
                pitch = pitch_of(note)
                if pitch is None:
                    problems.append('bar %d: unsupported accidental, skipped' % number)
                    notes.append(('R', code))
                else:
                    step, octave = pitch.split('/')
                    pitch = '%s/%d' % (step, int(octave) + args.octave)
                    if pitch not in PLAYABLE:
                        problems.append('bar %d: %s has no fingering' % (number, pitch))
                    notes.append((pitch, code))
            total += beats

        if not notes:
            continue
        if abs(total - beats_per_bar) > 1e-6:
            problems.append('bar %d: %g beats, expected %g'
                            % (number, total, beats_per_bar))
        measures.append((number, notes))

    if not measures:
        sys.exit('no notes found -- wrong part, or an empty score?')

    emit(args, measures, key, time_sig)

    used = sorted({n[0] for _, notes in measures for n in notes if n[0] != 'R'},
                  key=midi)
    warn('')
    warn('%d bars, %d notes, key %s, %s'
         % (len(measures), sum(len(n) for _, n in measures), key, time_sig))
    warn('range %s .. %s  (%d distinct pitches)' % (used[0], used[-1], len(used)))
    outside = [p for p in used if p not in PLAYABLE]
    if outside:
        warn('NOT PLAYABLE: %s' % ' '.join(outside))
        warn('try --octave -1 or --octave 1, or add these to fingering.js')
    for p in problems:
        warn('  ! %s' % p)
    if problems:
        warn('\n%d problem(s) -- fix these before pasting, or the game will '
             'mis-time the bars' % len(problems))


def emit(args, measures, key, time_sig):
    name = args.var or re.sub(r'[^A-Za-z0-9_]', '_', args.id).upper()
    out = ['var %s = {' % name,
           '  key: %s,' % js(key),
           '  time: %s,' % js(time_sig),
           '  measures: [']
    for i, (number, notes) in enumerate(measures):
        pairs = ', '.join('[%s,%s]' % (js(p), js(d)) for p, d in notes)
        last = i == len(measures) - 1
        out.append('    {n:%d, notes:[%s],' % (number, pairs))
        out.append('     beams:[], ties:[], slurs:[], bar:%s, repeat:null, sys:0}%s'
                   % (js('double') if last else 'null', '' if last else ','))
    out += ['  ],', '  systems: [], crossSlurs: []', '};', '',
            '/* add to the SONGS array: */',
            '/* {id:%s, title:%s, score:%s}, */' % (js(args.id), js(args.title), name)]
    print('\n'.join(out))


def js(value):
    return '"%s"' % str(value).replace('\\', '\\\\').replace('"', '\\"')


def warn(message):
    print(message, file=sys.stderr)


if __name__ == '__main__':
    main()
