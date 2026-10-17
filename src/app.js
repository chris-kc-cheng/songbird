import {rhythm,scoreGroups,beamSvg} from './notation.js';
import {Metronome} from './metronome.js';
import {handGeometry} from './hand-geometry.js';
import {PianoAudio,MetronomeAudio} from './piano-audio.js';
import {songs,names,midi,frequency,validateSong,generateFingering,createFingeringPlan,advanceFingering,handPitches,whiteIndex,keyPosition,fromMidi} from './music.js';
const $=s=>document.querySelector(s);
let song=songs.at(-1),position=0,playing=false,timer,audio,metronomeAudio,metronome,metronomeOn=false,eventStartedAt=0,filter='all',showHands=true;
let keyboardLow=0,keyboardCount=21,keyboardWidth=1050,loadRequest=0,selectedSong=song,loadingSong=false,activePlanner=null,pendingPlay=false;
const plannedSongs=new WeakMap(),progressivePlans=new WeakMap();
function ensurePrepared(){
 const plan=progressivePlans.get(song);
 while(plan&&position>=plan.ready&&plan.ready<plan.frames.length)advanceFingering(plan);
}
const pianoX=pitch=>5+(keyPosition(pitch)-keyboardLow+.5)*(keyboardWidth-10)/keyboardCount;
const playbackTempo=()=>+$('#tempo').value;
const modes=new Set(['staff','number','letter']);
const colors={left:'#aa7357',right:'#34796e'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function allNotes(event){return ['left','right'].flatMap(side=>(event?.[side]?.notes??[]).map(n=>({...n,side})));}
function renderSongs(){
 $('#library-count').textContent=String(songs.length).padStart(2,'0');
 const query=$('#search').value.toLowerCase();$('#songs').replaceChildren();
 songs.filter(s=>(filter==='all'||s.category===filter)&&`${s.title} ${s.composer}`.toLowerCase().includes(query)).forEach(s=>{
  const b=document.createElement('button');b.className=`song ${selectedSong===s?'chosen':''}`;
  b.innerHTML=`<span class="cover" style="--cover:${s.category==='chords'?'#ba9774':'#7b9c88'}">${s.category==='chords'?'♬':'♪'}</span><span><strong>${escape(s.title)}</strong><small>${escape(s.composer)}</small></span><span class="chevron">›</span>`;
  b.onclick=()=>loadSong(s).catch(error=>{$('#planning-status').textContent=error.message;});$('#songs').append(b);
 });
 if(!$('#songs').children.length)$('#songs').innerHTML='<p class="empty">No lessons found. Try another search.</p>';
}
function ensureAudio(){audio??=new PianoAudio(new (window.AudioContext||window.webkitAudioContext)());return audio;}
function metronomeFailed(error){
 metronomeOn=false;
 try{metronome?.stop();}catch{}
 $('#metronome').setAttribute('aria-pressed',false);$('#metronome').textContent='Metronome off';
 $('#planning-status').textContent='Metronome could not start. Piano playback continues.';
}
function startMetronome(){
 if(!metronomeOn)return;
 try{
  const instrument=ensureAudio();instrument.context.resume();
  metronomeAudio??=new MetronomeAudio(instrument.context);
  metronome??=new Metronome(metronomeAudio,{onError:metronomeFailed});
  metronome.start({bpm:playbackTempo(),timeSignature:selectedSong.timeSignature});
 }catch(error){metronomeFailed(error);}
}
function tone(note,duration=.55,velocity=80){
 ensureAudio();
 audio.play(note,duration,velocity);
}
function silence(){audio?.silence();}
function playEvent(resume=false){ensurePrepared();allNotes(song.events[position]).filter(n=>resume||!n.held).forEach(n=>tone(n.pitch,((resume?n.remaining:n.duration)??song.events[position].beats)*60/playbackTempo(),n.velocity??80));}
function renderScore(){
 if(loadingSong)return;
 const scoreWidth=Math.max(520,($('#score').clientWidth||764)-24);
 const columns=Math.max(2,Math.floor((scoreWidth-120)/140));
 const start=Math.floor(position/columns)*columns,shown=song.events.slice(start,start+columns);
 const notation=scoreGroups(song.events,song.timeSignature,start,columns,song.pickup??0);
 const beamed=new Set(notation.groups.flatMap(group=>group.items.map(item=>`${group.side}:${item.index}`)));
 const octaves=Object.fromEntries(['left','right'].map(side=>{const pitches=shown.flatMap(e=>e[side]?.notes??[]).map(n=>whiteIndex(n.pitch));const middle=pitches.length?(Math.min(...pitches)+Math.max(...pitches))/2:(side==='right'?12:1);return [side,Math.round((middle-(side==='right'?12:1))/7)];}));
 let svg=`<svg viewBox="0 0 ${scoreWidth} 320" role="img" aria-label="Grand staff: right hand above, left hand below">`;
 // Paint the active-step background first, beneath every staff line and note.
 const highlightX=190+(position-start)*140;
 svg+=`<rect x="${highlightX-52}" y="8" width="104" height="304" rx="8" fill="#e8f0e5"/>`;
 if(modes.has('staff')){
  for(const top of [38,150])for(let i=0;i<5;i++)svg+=`<line x1="28" y1="${top+i*10}" x2="${scoreWidth-28}" y2="${top+i*10}" stroke="#b8c3b5" stroke-width=".8"/>`;
  svg+=`<text x="38" y="81" font-size="60" font-family="serif">𝄞</text><text x="39" y="183" font-size="42" font-family="serif">𝄢</text><path d="M29 38v152m${scoreWidth-57}-152v152" stroke="#9aaa98"/>`;
  for(const y of [52,164]){svg+=`<text x="99" y="${y}" font-size="16">${song.timeSignature.split('/')[0]}</text><text x="99" y="${y+18}" font-size="16">${song.timeSignature.split('/')[1]}</text>`;}
 }
 shown.forEach((event,i)=>{
  const x=190+i*140;
  for(const side of ['right','left']){
   const ns=event[side]?.notes??[],color=colors[side],base=side==='right'?88:175;
   if(modes.has('staff')){
    if(!ns.length)svg+=`<text x="${x}" y="${side==='right'?65:177}" text-anchor="middle" font-size="22" fill="#9aa794">𝄽</text>`;
    ns.forEach(n=>{
     const step=whiteIndex(n.pitch)-octaves[side]*7-(side==='right'?7:0),y=base-step*5;
     const bottom=side==='right'?78:190,top=side==='right'?38:150;
     for(let ly=bottom+10;ly<=y;ly+=10)svg+=`<line x1="${x-13}" x2="${x+13}" y1="${ly}" y2="${ly}" stroke="${color}"/>`;
     for(let ly=top-10;ly>=y;ly-=10)svg+=`<line x1="${x-13}" x2="${x+13}" y1="${ly}" y2="${ly}" stroke="${color}"/>`;
     if(n.pitch.includes('#')||n.pitch.includes('b'))svg+=`<text x="${x-22}" y="${y+5}" font-size="15" fill="${color}">${n.pitch.includes('#')?'&#9839;':'&#9837;'}</text>`;
     if(n.held)svg+=`<path d="M${x-27} ${y+10}q14 8 27 0" fill="none" stroke="${color}"/>`;
     svg+=`<ellipse cx="${x}" cy="${y}" rx="8" ry="5" transform="rotate(-18 ${x} ${y})" fill="${(n.duration??event.beats)>=2?'#fffefa':color}" stroke="${color}" stroke-width="1.5"/>`;
     if(rhythm(n.duration??event.beats).dotted)svg+=`<circle cx="${x+17}" cy="${y-2}" r="2" fill="${color}"/>`;
    });
   }
   const attacks=ns.filter(n=>!n.held);
   if(modes.has('staff')&&attacks.length&&!beamed.has(`${side}:${start+i}`)){
    const duration=Math.min(...attacks.map(n=>n.duration??event.beats));
    if(duration<4){
     const ys=attacks.map(n=>base-(whiteIndex(n.pitch)-octaves[side]*7-(side==='right'?7:0))*5);
     const up=ys.reduce((a,b)=>a+b,0)/ys.length>=(side==='right'?58:170);
     const sx=x+(up?7:-7),sy=up?Math.max(...ys):Math.min(...ys),end=up?Math.min(...ys)-29:Math.max(...ys)+29;
     svg+=`<path d="M${sx} ${sy}V${end}" fill="none" stroke="${color}" stroke-width="1.4"/>`;
     for(let flag=0;flag<rhythm(duration).levels;flag++)svg+=`<path d="M${sx} ${end+(up?6:-6)*flag}q${up?15:-15} ${up?6:-6} ${up?4:-4} ${up?18:-18}" fill="none" stroke="${color}" stroke-width="1.8"/>`;
    }
   }

   const row=side==='right'?224:274;
   if(modes.has('number'))svg+=`<text x="${x}" y="${row}" text-anchor="middle" font-size="15" fill="${color}">${ns.length?ns.map(n=>`${/[#b]/.test(n.pitch)?n.pitch.slice(1,-1):''}${names.indexOf(n.pitch[0])+1} (${n.pitch.at(-1)})`).join(' / '):'Rest'}</text>`;
   if(modes.has('letter'))svg+=`<text x="${x}" y="${row+19}" text-anchor="middle" font-size="10" fill="${color}">${ns.length?ns.map(n=>n.pitch).join(' '):'Rest'}</text>`;
  }
  svg+=`<text x="${x}" y="308" text-anchor="middle" font-size="8" fill="#87917f">${Number(event.beats.toFixed(3))} beat${event.beats===1?'':'s'}</text>`;
 });
 if(modes.has('staff')){
  for(const index of notation.bars){const x=190+(index-start)*140-65;svg+=`<path class="bar-line" d="M${x} 38V190" stroke="#9aaa98" stroke-width="1"/>`;}
  for(const group of notation.groups){
   const side=group.side,base=side==='right'?88:175;
   svg+=beamSvg(group,n=>base-(whiteIndex(n.pitch)-octaves[side]*7-(side==='right'?7:0))*5,index=>190+(index-start)*140,colors[side]);
  }
 }
 for(const side of ['left','right'])if(octaves[side])svg+=`<text x="130" y="${side==='right'?26:138}" font-size="9" fill="#69796d">${Math.abs(octaves[side])*7+1}${octaves[side]>0?'va':'vb'}</text>`;
 svg+='<text x="32" y="224" font-size="9" fill="#34796e">RH</text><text x="32" y="274" font-size="9" fill="#aa7357">LH</text>';
 $('#score').innerHTML=svg+'</svg>';
 $('#phrase').textContent=`STEPS ${start+1}–${start+shown.length} OF ${song.events.length}`;
}
function makeKeyboard(){
 // A complete 88-key piano at a fixed physical scale. A wider viewport
 // reveals neighboring keys; neither the keys nor the hands are stretched.
 keyboardLow=-16;const high=35;
 keyboardCount=52;keyboardWidth=10+keyboardCount*36;
 const stage=$('.keyboard-stage');stage.style.width=`${keyboardWidth}px`;stage.style.minWidth=`${keyboardWidth}px`;
 $('#hand-overlay').setAttribute('viewBox',`0 0 ${keyboardWidth} 380`);
 const kb=$('#keyboard');kb.replaceChildren();
 for(let index=keyboardLow;index<=high;index++){
  const name=names[((index%7)+7)%7]+(3+Math.floor(index/7));
  const key=document.createElement('button');key.className='key white';key.dataset.note=name;key.setAttribute('aria-label',`Play ${name}`);key.textContent=name;
  key.onclick=()=>{tone(name);key.classList.add('pressed');setTimeout(()=>key.classList.remove('pressed'),180);};kb.append(key);
  if(!['E','B'].includes(name[0])&&index<high){
   const black=document.createElement('button'),pitch=fromMidi(midi(name)+1);black.className='key black';black.dataset.note=pitch;black.setAttribute('aria-label',`Play ${pitch}`);
   black.style.width=`${36*.77}px`;black.style.left=`${5+(index-keyboardLow+1)*36-36*.77/2}px`;
   black.onclick=()=>tone(pitch);kb.append(black);
  }
 }
}
function handPlacement(side,index=position){
 for(let i=index;i>=0;i--)if(song.events[i][side])return song.events[i][side].placement;
 return handPitches(side==='left'?'C3':'C4',side);
}
function drawHands(){
 if(loadingSong)return;
 const event=song.events[position],overlay=$('#hand-overlay');overlay.style.visibility=showHands?'visible':'hidden';
 let svg='';
 for(const side of ['left','right']){
  const active=event[side],placed=handPlacement(side),color=colors[side];
  const geometry=handGeometry(placed,pianoX,side),center=geometry.center;
  svg+=`<g class="drawn-hand" data-hand="${side}" opacity="${active?'1':'.65'}"><title>${side} hand: ${placed.map(p=>`${p.pitch}, finger ${p.finger}`).join('; ')}</title>`;
  // Flat warm colors, a bold contour and a rounded cuff keep the illustration
  // playful, with fixed-width fingers and a continuous palm silhouette.
  const skin=side==='left'?'#f4c7a6':'#ffdab8',outline='#805e4e';
  svg+=`<path class="hand-silhouette" d="${geometry.outline}" fill="${skin}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="${center+12}" cy="${geometry.palmY}" rx="25" ry="13" fill="white" opacity=".16"/><rect x="${center-47}" y="${geometry.wristY-18}" width="94" height="25" rx="10" fill="${color}" stroke="${outline}" stroke-width="2.5"/>`;
  geometry.fingers.forEach(p=>{
   const x=pianoX(p.pitch),y=p.tip.y+3,isOn=active?.notes.some(n=>midi(n.pitch)===midi(p.pitch));
   svg+=`<g transform="translate(${x} ${y})"><circle r="9" fill="${isOn?color:'#fff5e7'}" stroke="${isOn?outline:'#d7a987'}" stroke-width="1"/><text y="4" text-anchor="middle" fill="${isOn?'white':outline}" font-size="11" font-weight="700" font-family="sans-serif">${p.finger}</text></g>`;
  });
 }
 overlay.innerHTML=svg;
}
function render(){
 if(loadingSong)return;
 ensurePrepared();
 renderScore();const event=song.events[position],current=allNotes(event);
 $('#counter').innerHTML=`${String(position+1).padStart(2,'0')} <span>/ ${song.events.length}</span>`;
 document.querySelectorAll('.key').forEach(k=>{
  const n=current.find(n=>midi(n.pitch)===midi(k.dataset.note));
  k.classList.toggle('current',!!n);k.classList.toggle('left-current',n?.side==='left');k.querySelector('.finger-marker')?.remove();
  if(n){const marker=document.createElement('span');marker.className='finger-marker';marker.textContent=`${n.side==='left'?'L':'R'}${n.finger}`;k.append(marker);}
 });
 drawHands();
 // Center the visible keyboard around the hands currently being used. The
 // focus stays stable as different fingers play within one hand position.
 const scroll=$('.keyboard-scroll'),stage=$('.keyboard-stage');
 const sides=['left','right'].filter(side=>event[side]);
 const focus=(sides.length?sides:['left','right']).flatMap(side=>handPlacement(side).map(p=>pianoX(p.pitch)));
 const center=(Math.min(...focus)+Math.max(...focus))/2;
 scroll.scrollLeft=Math.max(0,Math.min(stage.offsetWidth-scroll.clientWidth,center-scroll.clientWidth/2));
 $('#play').innerHTML=playing?'<span class="pause-symbol"></span>':'<span class="play-symbol"></span>';$('#play').setAttribute('aria-label',playing?'Pause':'Play');
}
function stop(ringOut=false){playing=false;clearTimeout(timer);if(!ringOut)silence();render();}
function schedule(){
 timer=setTimeout(()=>{
  if(!playing)return;
  if(position===song.events.length-1){stop(true);return;}
  position++;eventStartedAt=performance.now();
  playEvent();schedule();render();
 },60000/playbackTempo()*song.events[position].beats);
}
function play(){
 if(loadingSong)return;if(playing){stop();return;}
 if(position===song.events.length-1)position=0;
 playing=true;eventStartedAt=performance.now();
 // Arm music first. Starting or restarting the optional click track must
 // never be able to prevent the next music event from being scheduled.
 playEvent(true);schedule();render();
}
async function loadSong(s){
 validateSong(s);
 const resume=playing||(loadingSong&&pendingPlay),request=++loadRequest;
 activePlanner?.cancel();activePlanner=null;
 selectedSong=s;loadingSong=true;pendingPlay=resume;
 playing=false;clearTimeout(timer);silence();position=0;
 // Reflect the selection before waiting for long-piece fingering generation.
 $('#score-title').textContent=s.title;$('#meter').textContent=s.timeSignature+' TIME';$('#tempo').value=s.tempo;
 $('#key-label').textContent=s.version===2?'ORIGINAL PITCHES':'C MAJOR';
 $('#lesson-source').hidden=s!==songs.at(-1);
 $('#score').innerHTML='<p class="score-loading" role="status">Preparing notes...</p>';
 $('#keyboard').replaceChildren();$('#hand-overlay').innerHTML='';$('#counter').textContent='...';
 $('#phrase').textContent='Preparing this song';
 $('#play').innerHTML='<span class="play-symbol"></span>';$('#play').setAttribute('aria-label','Play');
 for(const id of ['play','next','reset'])$('#'+id).disabled=true;
 $('#planning-status').textContent='Preparing this song...';
 updateTempo();startMetronome();renderSongs();
 let planned=plannedSongs.get(s);
 try{
  if(!planned){
   if(s.events.length>300){
    const plan=createFingeringPlan(s);planned=plan.song;progressivePlans.set(planned,plan);
   }else planned=generateFingering(s);
   if(request!==loadRequest)return;
   plannedSongs.set(s,planned);
  }
 }catch(error){if(request!==loadRequest)return;$('#planning-status').textContent=error.message;$('#score').innerHTML='<p class="score-loading">Could not prepare this song. Choose another song or try again.</p>';throw error;}
 if(request!==loadRequest)return;
 song=planned;loadingSong=false;pendingPlay=false;
 for(const id of ['play','next','reset'])$('#'+id).disabled=false;
 $('#planning-status').textContent='';
 makeKeyboard();renderSongs();render();
 const plan=progressivePlans.get(song);
 if(plan&&plan.ready<plan.frames.length&&typeof Worker!=='undefined'){
  try{
   const worker=new Worker(new URL('./planner-worker.js',import.meta.url),{type:'module'});
   activePlanner={worker,cancel:()=>worker.terminate()};
   const finish=()=>{worker.terminate();if(activePlanner?.worker===worker)activePlanner=null;};
   worker.onmessage=({data})=>{
    if(request!==loadRequest)return;
    if(data.error){finish();return;}
    if(data.start===plan.ready){
     plan.song.events.splice(data.start,data.events.length,...data.events);
     plan.ready=data.ready;plan.state=data.state;
    }
    if(data.done)finish();
   };
   worker.onerror=finish;
   worker.postMessage({frames:plan.frames,ready:plan.ready,state:plan.state});
  }catch{/* Upcoming passages can also be prepared on demand. */}
 }
 if(resume)play();
}
function updateTempo(){$('#bpm').textContent=$('#tempo').value;const effective=Number(playbackTempo().toFixed(2));$('#tempo-label').textContent=effective;}
$('#play').onclick=play;$('#reset').onclick=()=>{if(loadingSong)return;stop();position=0;render();};$('#next').onclick=()=>{if(loadingSong)return;stop();position=Math.min(position+1,song.events.length-1);render();playEvent(true);};
$('#tempo').oninput=()=>{if(playing)stop();updateTempo();startMetronome();};
$('#metronome').onclick=()=>{metronomeOn=!metronomeOn;$('#metronome').setAttribute('aria-pressed',metronomeOn);$('#metronome').textContent=`Metronome ${metronomeOn?'on':'off'}`;if(metronomeOn)startMetronome();else metronome?.stop();};
$('#hands-toggle').onclick=()=>{showHands=!showHands;$('#hands-toggle').textContent=showHands?'Hide hands':'Show hands';$('#hands-toggle').setAttribute('aria-pressed',showHands);drawHands();};
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{const m=b.dataset.mode;if(modes.has(m)){if(modes.size===1)return;modes.delete(m);}else modes.add(m);b.classList.toggle('selected',modes.has(m));b.setAttribute('aria-pressed',modes.has(m));renderScore();};
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));renderSongs();};
$('#search').oninput=renderSongs;
$('#import-open').onclick=()=>{$('#import-error').textContent='';$('#import-dialog').showModal();};$('#close-dialog').onclick=()=>$('#import-dialog').close();
$('#import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw Error('Choose a JSON file smaller than 1 MB.');$('#import-notes').value=await file.text();$('#import-error').textContent='';}catch(err){$('#import-error').textContent=err.message;}};
$('#import-form').onsubmit=async e=>{e.preventDefault();try{const text=$('#import-notes').value;if(text.length>1000000)throw Error('Song must be smaller than 1 MB.');const imported=validateSong(JSON.parse(text));await loadSong(imported);$('#import-dialog').close();}catch(err){$('#import-error').textContent=err.message;}};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','TEXTAREA','BUTTON','SELECT'].includes(document.activeElement.tagName)&&!$('#import-dialog').open){e.preventDefault();play();}});
loadSong(song).catch(error=>{$('#planning-status').textContent=error.message;});

if(typeof navigator!=='undefined'&&'serviceWorker' in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});

if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>render()).observe($('#score'));
