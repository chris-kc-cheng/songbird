# Songbird maintenance

- Always retain the latest app screenshot in README.md.
- After UI changes, run `npm run screenshot` and include the updated `assets/screenshots/latest.png` with the change.
- The GitHub Pages workflow also regenerates and commits the screenshot on deployments. Keep that automation and the README image working when changing deployment or assets.

- Keep README.md focused on learners: practice instructions, songs, notation, hands and app use.
- Put setup commands, architecture, song-format details, tests, deployment and screenshot automation notes in DEVELOPMENT.md. Consult that guide when maintaining the app.
- Store all bundled music as version 2 song JSON files listed in songs/library.json. Do not embed notes, melodies or exercise construction in JavaScript. Keep fingering algorithmic.
