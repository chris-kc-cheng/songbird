import {songs,names,midi,frequency,validateSong,handPitches,whiteIndex} from './music.js';
const $=s=>document.querySelector(s);
let song=songs[4],position=0,playing=false,timer,loop=false,sound=true,audio,filter='all',showHands=true;
const voices=new Set(),modes=new Set(['staff','number','letter']);
const colors={left:'#aa7357',right:'#34796e'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function allNotes(event){return ['left','right'].flatMap(side=>(event?.[side]?.notes??[]).map(n=>({...n,side})));}
function renderSongs(){
 const query=$('#search').value.toLowerCase();$('#songs').replaceChildren();
 songs.filter(s=>(filter==='all'||s.category===filter)&&`${s.title} ${s.composer}`.toLowerCase().includes(query)).forEach(s=>{
  const b=document.createElement('button');b.className=`song ${song===s?'chosen':''}`;
  b.innerHTML=`<span class="cover" style="--cover:${s.category==='chords'?'#ba9774':'#7b9c88'}">${s.category==='chords'?'♬':'♪'}</span><span><strong>${escape(s.title)}</strong><small>${escape(s.composer)}</small></span><span class="chevron">›</span>`;
  b.onclick=()=>loadSong(s);$('#songs').append(b);
 });
 if(!$('#songs').children.length)$('#songs').innerHTML='<p class="empty">No lessons found. Try another search.</p>';
}
function tone(note,duration=.55){
 if(!sound)return;
 audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const t=audio.currentTime;
 for(const [harmonic,level] of [[1,.10],[2,.032],[3,.012]]){
  const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=frequency(note)*harmonic;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+Math.max(.05,duration));
  o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration+.02);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};
 }
}
function silence(){for(const o of voices){try{o.stop();}catch{}}voices.clear();}
function playEvent(){allNotes(song.events[position]).forEach(n=>tone(n.pitch,song.events[position].beats*60/+$('#tempo').value*.92));}
function renderScore(){
 const start=Math.floor(position/4)*4,shown=song.events.slice(start,start+4);
 let svg='<svg viewBox="0 0 740 320" role="img" aria-label="Grand staff: right hand above, left hand below">';
 if(modes.has('staff')){
  for(const top of [38,150])for(let i=0;i<5;i++)svg+=`<line x1="28" y1="${top+i*10}" x2="712" y2="${top+i*10}" stroke="#b8c3b5" stroke-width=".8"/>`;
  svg+='<text x="38" y="81" font-size="60" font-family="serif">𝄞</text><text x="39" y="183" font-size="42" font-family="serif">𝄢</text><path d="M29 38v152m683-152v152" stroke="#9aaa98"/>';
  for(const y of [52,164]){svg+=`<text x="99" y="${y}" font-size="16">${song.timeSignature[0]}</text><text x="99" y="${y+18}" font-size="16">4</text>`;}
 }
 shown.forEach((event,i)=>{
  const x=190+i*140,on=start+i===position;
  if(on)svg+=`<rect x="${x-52}" y="8" width="104" height="304" rx="8" fill="#e8f0e5"/>`;
  for(const side of ['right','left']){
   const ns=event[side]?.notes??[],color=colors[side],base=side==='right'?88:175;
   if(modes.has('staff')){
    if(!ns.length)svg+=`<text x="${x}" y="${side==='right'?65:177}" text-anchor="middle" font-size="22" fill="#9aa794">𝄽</text>`;
    ns.forEach(n=>{
     const step=whiteIndex(n.pitch)-(side==='right'?7:0),y=base-step*5;
     const bottom=side==='right'?78:190,top=side==='right'?38:150;
     for(let ly=bottom+10;ly<=y;ly+=10)svg+=`<line x1="${x-13}" x2="${x+13}" y1="${ly}" y2="${ly}" stroke="${color}"/>`;
     for(let ly=top-10;ly>=y;ly-=10)svg+=`<line x1="${x-13}" x2="${x+13}" y1="${ly}" y2="${ly}" stroke="${color}"/>`;
     svg+=`<ellipse cx="${x}" cy="${y}" rx="8" ry="5" transform="rotate(-18 ${x} ${y})" fill="${event.beats>=2?'#fffefa':color}" stroke="${color}" stroke-width="1.5"/>`;
     if(event.beats<4)svg+=`<path d="M${x+7} ${y}v-29${event.beats<1?'q17 6 4 18':''}" fill="none" stroke="${color}" stroke-width="1.4"/>`;
     if(event.beats===.25)svg+=`<path d="M${x+7} ${y-23}q17 6 4 18" fill="none" stroke="${color}" stroke-width="1.4"/>`;
     if([.75,1.5,3,6].includes(event.beats))svg+=`<circle cx="${x+17}" cy="${y-2}" r="2" fill="${color}"/>`;
    });
   }
   const row=side==='right'?224:274;
   if(modes.has('number'))svg+=`<text x="${x}" y="${row}" text-anchor="middle" font-size="15" fill="${color}">${ns.length?ns.map(n=>`${names.indexOf(n.pitch[0])+1}${n.pitch[1]==='5'?'̇':n.pitch[1]==='3'?'̣':''}`).join(' · '):'—'}</text>`;
   if(modes.has('letter'))svg+=`<text x="${x}" y="${row+19}" text-anchor="middle" font-size="10" fill="${color}">${ns.length?ns.map(n=>n.pitch).join(' '):'Rest'}</text>`;
  }
  svg+=`<text x="${x}" y="308" text-anchor="middle" font-size="8" fill="#87917f">${event.beats} beat${event.beats===1?'':'s'}</text>`;
 });
 svg+='<text x="32" y="224" font-size="9" fill="#34796e">RH</text><text x="32" y="274" font-size="9" fill="#aa7357">LH</text>';
 $('#score').innerHTML=svg+'</svg>';
 $('#phrase').textContent=`STEPS ${start+1}–${start+shown.length} OF ${song.events.length}`;
}
function makeKeyboard(){
 const kb=$('#keyboard');
 for(let oct=3;oct<=5;oct++)for(const n of names){
  const note=n+oct,key=document.createElement('button');key.className='key white';key.dataset.note=note;key.setAttribute('aria-label',`Play ${note}`);key.textContent=note;
  key.onclick=()=>{tone(note);key.classList.add('pressed');setTimeout(()=>key.classList.remove('pressed'),180);};kb.append(key);
 }
 // Black keys preserve the physical 2 + 3 grouping; natural-note lessons use white keys.
 for(let i=0;i<21;i++){
  if(['E','B'].includes(names[i%7]))continue;
  const key=document.createElement('button');const pitch=names[i%7]+'#'+(3+Math.floor(i/7));key.className='key black';key.setAttribute('aria-label',`Play ${pitch}`);key.onclick=()=>tone(pitch);key.style.left=`calc(${(i+1)/21*100}% - 1.85%)`;kb.append(key);
 }
}
function placement(side,index=position){
 for(let i=index;i>=0;i--)if(song.events[i][side])return song.events[i][side].position;
 return side==='left'?'C3':'C4';
}
function drawHands(){
 const event=song.events[position],overlay=$('#hand-overlay');overlay.style.visibility=showHands?'visible':'hidden';
 let svg='';
 for(const side of ['left','right']){
  const active=event[side],placed=handPitches(placement(side),side),color=colors[side];
  const xs=placed.map(p=>5+(whiteIndex(p.pitch)+.5)*1040/21),center=(xs[0]+xs[4])/2;
  svg+=`<g class="drawn-hand" data-hand="${side}" opacity="${active?'.87':'.28'}"><title>${side} hand: ${placed.map(p=>`${p.pitch}, finger ${p.finger}`).join('; ')}</title>`;
  // Continuous palm with a relaxed wrist. Fingers remain in physical low-to-high order.
  svg+=`<path d="M${center-43} 299 L${center-49} 258 Q${xs[0]-15} 235 ${xs[0]-13} 201 Q${center} 180 ${xs[4]+13} 201 Q${xs[4]+15} 235 ${center+49} 258 L${center+43} 299" fill="${side==='left'?'#edceb5':'#f3d9bc'}" stroke="${color}" stroke-width="2"/>`;
  placed.forEach((p,i)=>{
   const x=xs[i],isOn=active?.notes.some(n=>n.pitch===p.pitch),tip=p.finger===1?159:p.finger===5?148:132+(p.finger===3?-8:0),knuckle=center+(i-2)*26;
   const d=`M${knuckle} 218 Q${x} 193 ${x} ${tip}`;
   svg+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="25" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${side==='left'?'#edceb5':'#f3d9bc'}" stroke-width="21" stroke-linecap="round"/><ellipse cx="${x}" cy="${tip+2}" rx="7" ry="9" fill="${isOn?color:'#fff4e4'}"/><text x="${x}" y="${tip+6}" text-anchor="middle" fill="${isOn?'white':color}" font-size="10" font-family="sans-serif">${p.finger}</text>`;
  });
  svg+=`<text x="${center}" y="274" text-anchor="middle" font-size="11" fill="${color}" font-family="sans-serif">${side.toUpperCase()} HAND</text></g>`;
 }
 overlay.innerHTML=svg;
}
function render(){
 renderScore();const event=song.events[position],next=song.events[position+1]??(loop?song.events[0]:null),current=allNotes(event),upcoming=allNotes(next);
 $('#counter').innerHTML=`${String(position+1).padStart(2,'0')} <span>/ ${song.events.length}</span>`;
 document.querySelectorAll('.white').forEach(k=>{
  const n=current.find(n=>n.pitch===k.dataset.note),nextNote=upcoming.find(n=>n.pitch===k.dataset.note);
  k.classList.toggle('current',!!n);k.classList.toggle('left-current',n?.side==='left');k.classList.toggle('upcoming',!n&&!!nextNote);k.querySelector('.finger-marker')?.remove();
  if(n){const marker=document.createElement('span');marker.className='finger-marker';marker.textContent=`${n.side==='left'?'L':'R'}${n.finger}`;k.append(marker);}
 });
 drawHands();
 const shifts=next?['left','right'].filter(side=>next[side]&&next[side].position!==placement(side)):[];
 $('#movement').textContent=shifts.length?'Reposition before the next step':next?'Keep your hand relaxed':'Lesson complete';
 $('#movement-notes').textContent=shifts.length?shifts.map(side=>`${side==='left'?'LH':'RH'}: ${placement(side)} → ${next[side].position}`).join(' · '):current.length?current.map(n=>`${n.side==='left'?'L':'R'}${n.finger}: ${n.pitch}`).join(' · '):'Rest — release both hands';
 $('#play').innerHTML=playing?'<span class="pause-symbol"></span>':'<span class="play-symbol"></span>';$('#play').setAttribute('aria-label',playing?'Pause':'Play');
}
function stop(){playing=false;clearTimeout(timer);silence();render();}
function schedule(){timer=setTimeout(()=>{if(position===song.events.length-1){if(!loop){stop();return;}position=0;}else position++;render();playEvent();schedule();},60000/+$('#tempo').value*song.events[position].beats);}
function play(){if(playing){stop();return;}if(position===song.events.length-1)position=0;playing=true;render();playEvent();schedule();}
function loadSong(s){stop();song=validateSong(s);position=0;$('#lesson-title').textContent=s.title;$('#score-title').textContent=s.title;$('#subtitle').textContent=s.composer??'Your imported lesson';$('#meter').textContent=s.timeSignature+' TIME';$('#tempo').value=s.tempo;updateTempo();renderSongs();render();}
function updateTempo(){$('#bpm').textContent=$('#tempo').value;$('#tempo-label').textContent=$('#tempo').value;}
$('#play').onclick=play;$('#reset').onclick=()=>{stop();position=0;render();};$('#next').onclick=()=>{stop();position=Math.min(position+1,song.events.length-1);render();playEvent();};
$('#tempo').oninput=()=>{if(playing)stop();updateTempo();};
$('#loop').onclick=()=>{loop=!loop;$('#loop').setAttribute('aria-pressed',loop);render();};
$('#sound').onclick=()=>{sound=!sound;if(!sound)silence();$('#sound').setAttribute('aria-pressed',sound);$('#sound').textContent=`♫ Sound ${sound?'on':'off'}`;};
$('#hands-toggle').onclick=()=>{showHands=!showHands;$('#hands-toggle').textContent=showHands?'Hide hands':'Show hands';$('#hands-toggle').setAttribute('aria-pressed',showHands);drawHands();};
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{const m=b.dataset.mode;if(modes.has(m)){if(modes.size===1)return;modes.delete(m);}else modes.add(m);b.classList.toggle('selected',modes.has(m));b.setAttribute('aria-pressed',modes.has(m));renderScore();};
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));renderSongs();};
$('#search').oninput=renderSongs;
$('#import-open').onclick=()=>{$('#import-error').textContent='';$('#import-dialog').showModal();};$('#close-dialog').onclick=()=>$('#import-dialog').close();
$('#import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw Error('Choose a JSON file smaller than 1 MB.');$('#import-notes').value=await file.text();$('#import-error').textContent='';}catch(err){$('#import-error').textContent=err.message;}};
$('#import-form').onsubmit=e=>{e.preventDefault();try{const text=$('#import-notes').value;if(text.length>1000000)throw Error('Song must be smaller than 1 MB.');const imported=validateSong(JSON.parse(text));loadSong(imported);$('#import-dialog').close();}catch(err){$('#import-error').textContent=err.message;}};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)&&!$('#import-dialog').open){e.preventDefault();play();}});
makeKeyboard();loadSong(song);
