# Cantopop Piano

A responsive piano practice app with staff, numbered and letter notation, synthesized piano audio, adjustable tempo, looping, a playable three-octave keyboard, and suggested right-hand finger cues.

## Run

Requires Python 3; no dependency installation or build is necessary.

```sh
cd /workspace/piano
npm start
```

Serves on port 3000. Click Play to enable browser audio. Space toggles playback when focus is outside a form or button.

## Scores

The included lesson is an original 16-note exercise. Library entries are song discovery metadata, not included arrangements. Selecting an entry opens the note importer. Paste your authorized score as 2–128 space- or comma-separated notes, such as `C4 D4 E4 F#4 G4`. Supported octaves: 3–5; all notes are quarter notes in C major. Imported lessons are held in memory for the current session. Finger suggestions are introductory cues, not professionally edited arrangement fingerings. MIDI input, chords, varied durations, flats, left-hand arrangements, and score-file parsing are not implemented.

## Validate

`npm test` runs pitch conversion and importer tests using Node 20+. Browser smoke checks cover searching/filtering, timed playback, score import, highlighted keys, notation switches, and mobile layout.
