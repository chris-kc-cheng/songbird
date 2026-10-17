const CACHE='songbird-v8';
const ASSETS=["./", "index.html", "style.css", "manifest.webmanifest", "song.schema.json", "assets/songbird.png", "assets/icons/songbird-192.png", "assets/icons/songbird-512.png", "src/app.js", "src/hand-geometry.js", "src/metronome.js", "src/notation.js", "src/music.js", "src/piano-audio.js", "src/planner-worker.js", "songs/first-chords.json", "songs/fur-elise.json", "songs/ode-to-joy.json"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('songbird-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
  return response;
 }).catch(async()=>{const cached=await caches.match(event.request);if(cached)return cached;if(event.request.mode==='navigate')return caches.match('./');return Response.error();}));
});
