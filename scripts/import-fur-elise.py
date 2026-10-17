"""Rebuild the complete practice data from the bundled public-domain MIDI.

Source: Mutopia-2015/08/18-931, Breitkopf & Hartel (1888).
The two piano tracks are the original upper/lower staves; never split by pitch.
"""
from collections import defaultdict, deque
from pathlib import Path
import hashlib
import json
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/scores/fur-elise.mid'


def read_midi(data):
    assert data[:4] == b'MThd'
    fmt, tracks, ppq = struct.unpack('>HHH', data[8:14])
    assert fmt == 1 and not ppq & 0x8000
    cursor = 8 + int.from_bytes(data[4:8], 'big')
    result, metadata = [], []
    for track in range(tracks):
        assert data[cursor:cursor+4] == b'MTrk'
        size = int.from_bytes(data[cursor+4:cursor+8], 'big')
        chunk = data[cursor+8:cursor+8+size]
        cursor += 8 + size
        offset, tick, running = 0, 0, None
        pending = defaultdict(deque)
        notes = []

        def variable():
            nonlocal offset
            value = 0
            while True:
                byte = chunk[offset]
                offset += 1
                value = (value << 7) | (byte & 127)
                if byte < 128:
                    return value

        while offset < len(chunk):
            tick += variable()
            status = chunk[offset]
            if status >= 128:
                offset += 1
                if status < 240:
                    running = status
            else:
                assert running is not None
                status = running
            if status == 255:
                kind = chunk[offset]
                offset += 1
                length = variable()
                value = chunk[offset:offset+length]
                offset += length
                metadata.append((track, tick, kind, value))
            elif status in (240, 247):
                length = variable()
                offset += length
            else:
                kind, channel = status & 240, status & 15
                length = 1 if kind in (192, 208) else 2
                values = chunk[offset:offset+length]
                offset += length
                if kind == 144 and values[1]:
                    pending[(channel, values[0])].append((tick, values[1]))
                elif kind == 128 or (kind == 144 and values[1] == 0):
                    start, velocity = pending[(channel, values[0])].popleft()
                    notes.append(dict(start=start, end=tick, key=values[0], velocity=velocity))
        assert not any(pending.values()), 'Unclosed MIDI notes'
        if notes:
            result.append((track, sorted(notes, key=lambda n: (n['start'], n['key']))))
    return ppq, result, metadata


def pitch(key):
    return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][key % 12] + str(key // 12 - 1)


def convert():
    data = SOURCE.read_bytes()
    ppq, tracks, metadata = read_midi(data)
    assert len(tracks) == 2
    # This edition's LilyPond MIDI plays each volta body once and then BOTH
    # alternatives in sequence. Unfold the two marked repeats explicitly:
    # opening body 0..11, endings 11..12 / 12..13.5 quarter beats;
    # second body 13.5..33, endings 33..34.5 / 34.5..36.
    # These boundaries come from the bundled .ly, not motif guessing.
    source_end = max(n['end'] for _, notes in tracks for n in notes)
    segments = [(0, 12*ppq), (0, 11*ppq), (12*ppq, int(34.5*ppq)),
                (int(13.5*ppq), 33*ppq), (int(34.5*ppq), source_end)]
    expanded = []
    for track, notes in tracks:
        output, cursor = [], 0
        for start, finish in segments:
            for note in notes:
                if start <= note['start'] < finish:
                    assert note['end'] <= finish, 'Note crosses repeat boundary'
                    output.append({**note, 'start': cursor+note['start']-start,
                                   'end': cursor+note['end']-start})
            cursor += finish-start
        expanded.append((track, output))
    tracks = expanded
    attacks = defaultdict(lambda: defaultdict(list))
    for (_, notes), side in zip(tracks, ['right', 'left']):
        for note in notes:
            attacks[note['start']][side].append({
                'pitch': pitch(note['key']),
                'duration': (note['end'] - note['start']) / ppq,
                'velocity': note['velocity'],
            })
    end = max(n['end'] for _, notes in tracks for n in notes)
    boundaries = sorted(set(attacks) | {0, end})
    events = []
    for start, finish in zip(boundaries, boundaries[1:]):
        event = {'beats': (finish-start)/ppq}
        for side, notes in attacks[start].items():
            event[side] = {'notes': notes}
        events.append(event)
    tempo = next(int.from_bytes(value, 'big') for _, _, kind, value in metadata if kind == 81)
    song = dict(version=2, title='F\u00fcr Elise', composer='Ludwig van Beethoven - WoO 59',
                category='chords', tempo=round(60000000/tempo), timeSignature='3/8', pickup=0.5, events=events)
    (ROOT / 'songs/fur-elise.json').write_text(json.dumps(song, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    report = dict(source='https://www.mutopiaproject.org/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/',
                  edition='Mutopia-2015/08/18-931; Breitkopf & Hartel, 1888', license='Public Domain',
                  midiSha256=hashlib.sha256(data).hexdigest(), ticksPerQuarter=ppq,
                  notesByHand={side: len(notes) for (_, notes), side in zip(tracks, ['right', 'left'])},
                  repeatsExpanded=True, sourceBeats=source_end/ppq,
                  eventCount=len(events), totalBeats=end/ppq,
                  lowest=pitch(min(n['key'] for _, notes in tracks for n in notes)),
                  highest=pitch(max(n['key'] for _, notes in tracks for n in notes)))
    (ROOT / 'assets/scores/fur-elise-source.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))


if __name__ == '__main__':
    convert()
