# Songbird

A beginner piano practice app with a cartoon songbird mascot, grand-staff / numbered / letter notation, synthesized audio, timed melodies and chords, and translucent **both-hand silhouettes directly over the piano keys**.

## Run

Python 3 and Node 20+ are available in the cloud environment. No dependency installation or build is needed.

```sh
cd /workspace/piano
npm start
```

The static server listens on port 3000. Click Play to enable browser audio. Space toggles playback outside form controls. Click a white or black key to try a note. Hide hands exposes key labels. Tempo changes pause playback so the next event starts with predictable timing.

## Included lessons

New simple arrangements of public-domain melodies: Ode to Joy (Beethoven), Hot Cross Buns, Mary Had a Little Lamb, and Twinkle, Twinkle, Little Star. No third-party recording or modern arrangement is included. Original exercises: First chords (C, F and G major triads in both hands) and Together in C (left-hand chord with right-hand melody).

## Hand guidance

View the keyboard from above, as the player. Thumb = 1, index = 2, middle = 3, ring = 4, little = 5. Right-hand fingers ascend 1–5; left-hand fingers ascend 5–1. `position` is the **lowest white key** of a five-finger position, not necessarily the thumb. For a C position, the left little finger is on C and thumb on G; the right thumb is on C and little finger on G. Chord lessons use left 5–3–1 and right 1–3–5 over a fifth, without crossovers or octave stretches. Idle hands appear faded. Active fingertips are coloured and touch their assigned keys; the other fingers show the full resting position. Shift prompts appear before an upcoming hand-position change.

These are suggested placements, not hand tracking or personalized ergonomic advice. Pause and move at your own pace; do not force a stretch. The first version deliberately supports natural notes in five-finger positions. Sharps/flats, hand crossing, pedal, and free-form finger substitutions are not supported.

## Import JSON songs

Click **Import song**, select a `.json` file or paste JSON, then Load song. Download links in the dialog provide the schema and a full example. Imports remain in memory until refresh.

- [JSON Schema, draft 2020-12](song.schema.json)
- [Both-hand chord example](songs/first-chords.json)
- [Melody example](songs/ode-to-joy.json)

```json
{
  "version": 1,
  "title": "My first chord",
  "composer": "Your name",
  "category": "chords",
  "tempo": 60,
  "timeSignature": "4/4",
  "events": [{
    "beats": 4,
    "left": {
      "position": "C3",
      "notes": [
        {"pitch": "C3", "finger": 5},
        {"pitch": "E3", "finger": 3},
        {"pitch": "G3", "finger": 1}
      ]
    },
    "right": {
      "position": "C4",
      "notes": [
        {"pitch": "C4", "finger": 1},
        {"pitch": "E4", "finger": 3},
        {"pitch": "G4", "finger": 5}
      ]
    }
  }]
}
```

Events play sequentially. All notes and both hands within one event sound simultaneously for `beats` quarter-note beats. Omit a hand or use `null` for its rest; omit both for a full rest. Repeated notes rearticulate. Supported durations: 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6. Different durations between hands require splitting into events; ties and independent overlapping voices are not yet supported.

Natural pitches C3–B5; `C4` is middle C. Numbered notation is fixed to C major (`1 = C`), with octave dots. Hand positions C3–E5 leave room for all five white keys. Both-hand positions must occupy separate registers. Runtime validation supplements JSON Schema with matching finger/pitch checks, unique fingers, and non-overlapping hands. Files are limited to 1 MB / 512 events. Use your own music or music you have permission to use.

The staff shows event groups of four with rhythmic noteheads and flags; it is a practice display, not a full engraving engine with automatic bars/beaming or ties.

## Checks

```sh
npm test
```

Unit tests cover pitch tuning, all built-in and example songs, mirrored finger positions, chord spans, invalid imports, overlap, timing, and rests. Browser smoke tests exercise lesson switching, simultaneous chord highlighting, hand silhouettes, file/paste import, playback, filters, and responsive layout.
