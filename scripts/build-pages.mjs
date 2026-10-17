import {cp,mkdir,writeFile} from 'node:fs/promises';
// Explicit public files only: source tests, dependencies and repository metadata
// are never included in the Pages artifact.
await mkdir('_site',{recursive:true});
for(const file of ['index.html','style.css','manifest.webmanifest','song.schema.json','sw.js'])await cp(file,`_site/${file}`);
for(const folder of ['assets','songs'])await cp(folder,`_site/${folder}`,{recursive:true});
await mkdir('_site/src',{recursive:true});
for(const file of ['app.js','hand-geometry.js','metronome.js','notation.js','music.js','piano-audio.js','planner-worker.js'])await cp(`src/${file}`,`_site/src/${file}`);
await writeFile('_site/.nojekyll','');
console.log('GitHub Pages site prepared in _site/');
