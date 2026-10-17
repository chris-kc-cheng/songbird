import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {songs,midi,frequency,validateSong,generateFingering,handPitches,keyPosition,performanceEvents,createFingeringPlan,advanceFingering} from './music.js';
const copy=()=>structuredClone(songs[4]);
test('pitch conversion matches piano tuning',()=>{assert.equal(midi('C4'),60);assert.equal(frequency('A4'),440);assert.equal(frequency('A5'),880);assert.throws(()=>midi('C9'));assert.equal(midi('F#4'),66);});
test('all built-in lessons and exported examples validate',()=>{assert.equal(songs.length,11);songs.forEach(s=>assert.equal(validateSong(s),s));for(const file of ['first-chords','ode-to-joy','fur-elise'])validateSong(JSON.parse(readFileSync(new URL(`../songs/${file}.json`,import.meta.url))));});
test('mirrored five-finger positions put thumbs toward the middle',()=>{assert.deepEqual(handPitches('C3','left').map(n=>n.finger),[5,4,3,2,1]);assert.deepEqual(handPitches('C4','right').map(n=>n.finger),[1,2,3,4,5]);assert.equal(handPitches('C3','left')[4].pitch,'G3');assert.throws(()=>handPitches('G7','right'));});
test('chords use comfortable thirds with 5-3-1 and 1-3-5',()=>{for(const e of generateFingering(songs[4]).events){assert.deepEqual(e.left.notes.map(n=>n.finger),[5,3,1]);assert.deepEqual(e.right.notes.map(n=>n.finger),[1,3,5]);for(const side of ['left','right'])assert.equal(midi(e[side].notes[2].pitch)-midi(e[side].notes[0].pitch),7);}});
test('rejects stored fingering, duplicate pitches and crossing parts',()=>{
 let s=copy();s.events[0].right.notes[0].finger=5;assert.throws(()=>validateSong(s),/Unknown note/);
 s=copy();s.events[0].right.position='C4';assert.throws(()=>validateSong(s),/Unknown right/);
 s=copy();s.events[0].right.notes.push(s.events[0].right.notes[0]);assert.throws(()=>validateSong(s),/duplicate/);
 s=copy();s.events[0].left=structuredClone(s.events[0].right);assert.throws(()=>validateSong(s),/separate/);
});
test('planner considers the phrase and preserves source music',()=>{
 const s=structuredClone(songs[0]),before=JSON.stringify(s),planned=generateFingering(s);
 assert.equal(JSON.stringify(s),before);
 assert.ok(planned.events.every(e=>e.right.position==='C4'));
 assert.equal(planned.events[0].right.notes[0].finger,3);
 for(const song of songs)for(const e of generateFingering(song).events)for(const side of ['left','right'])if(e[side]){
  for(const n of e[side].notes)assert.ok(e[side].placement.some(p=>p.pitch===n.pitch&&p.finger===n.finger));
  if(e.left&&e.right)assert.ok(midi(e.left.placement[4].pitch)<midi(e.right.position));
 }
});
test('planner shifts for extended melodies and supports rests',()=>{
 const s=copy();s.events=['C4','D4','E4','F4','G4','A4','B4','C5'].map(pitch=>({beats:1,right:{notes:[{pitch}]}}));
 s.events.splice(3,0,{beats:1});
 const planned=generateFingering(s);assert.notEqual(planned.events[0].right.position,planned.events.at(-1).right.position);
 assert.deepEqual(generateFingering(s),planned);
 s.events=[{beats:1,right:{notes:[{pitch:'C4'},{pitch:'D5'}]}}];assert.throws(()=>generateFingering(s),/span/);
});
test('rejects bad timing, unknown fields, and invalid structures',()=>{for(const mutation of [s=>s.tempo=0,s=>s.events[0].beats=.3,s=>s.events=[],s=>s.events[0].right.notes=null,s=>s.version=2,s=>s.timeSignature='7/8',s=>s.extra=true,s=>s.events[0].right.position='G5',s=>s.title=' ']){const s=copy();mutation(s);assert.throws(()=>validateSong(s));}});
test('rests and variable duration events are supported',()=>{const s=copy();s.events=[{beats:.5},{beats:3,left:null,right:null},s.events[0]];assert.equal(validateSong(s),s);});

const lesson=events=>({...copy(),events});
test('sixth, seventh and octave chords get distinct fingers and explicit placements',()=>{
 for(const top of ['A4','B4','C5'])for(const side of ['left','right']){
  const source=lesson([{beats:2,[side]:{notes:[{pitch:'C4'},{pitch:top}]}}]);
  const before=JSON.stringify(source),hand=generateFingering(source).events[0][side];
  assert.equal(JSON.stringify(source),before);
  assert.equal(hand.span,['A4','B4','C5'].indexOf(top)+6);
  assert.deepEqual(hand.notes.map(n=>n.finger),side==='left'?[5,1]:[1,5]);
  assert.equal(hand.placement.length,5);
  for(const n of hand.notes)assert.ok(hand.placement.some(p=>p.pitch===n.pitch&&p.finger===n.finger));
 }
});
test('octave chords permit up to five simultaneous notes without repeated fingers',()=>{
 const hand=generateFingering(lesson([{beats:1,right:{notes:['C4','D4','E4','G4','C5'].map(pitch=>({pitch}))}}])).events[0].right;
 assert.equal(hand.span,8);assert.equal(new Set(hand.notes.map(n=>n.finger)).size,5);
 assert.throws(()=>generateFingering(lesson([{beats:1,right:{notes:[{pitch:'C4'},{pitch:'D5'}]}}])),/eight-white-key/);
});
test('C-major scales use thumb crossings instead of an eight-key static stretch',()=>{
 for(const side of ['left','right'])for(const descending of [false,true]){
  let pitches=['C4','D4','E4','F4','G4','A4','B4','C5'];
  let expected=side==='right'?[1,2,3,1,2,3,4,5]:[5,4,3,2,1,3,2,1];
  if(descending){pitches.reverse();expected.reverse();}
  const result=generateFingering(lesson(pitches.map(pitch=>({beats:1,[side]:{notes:[{pitch}]}}))));
  assert.deepEqual(result.events.map(e=>e[side].notes[0].finger),expected);
  assert.ok(result.events.every(e=>e[side].span===5));
 }
});
test('octave placement survives rests and returns to compact positions',()=>{
 const source=lesson([{beats:2,right:{notes:[{pitch:'C4'},{pitch:'C5'}]}},{beats:1},...Array.from({length:6},()=>({beats:1,right:{notes:[{pitch:'E4'}]}}))]);
 const result=generateFingering(source);
 assert.equal(result.events[0].right.span,8);assert.equal(result.events[1].right,undefined);
 assert.equal(result.events.at(-1).right.span,5);
});

test('complete Fur Elise retains every source note, repeats, range and ending',()=>{
 const full=songs.at(-1);
 assert.equal(full.title,'F\u00fcr Elise');assert.equal(full.version,2);
 assert.equal(full.timeSignature,'3/8');assert.equal(full.events.length,785);
 assert.ok(Math.abs(full.events.reduce((sum,e)=>sum+e.beats,0)-187)<1e-8);
 for(const [side,count] of [['right',605],['left',436]])assert.equal(full.events.reduce((sum,e)=>sum+(e[side]?.notes.length??0),0),count);
 assert.deepEqual(full.events.slice(0,5).map(e=>e.right.notes[0].pitch),['E5','D#5','E5','D#5','E5']);
 assert.deepEqual(full.events.at(-1).left.notes.map(n=>n.pitch),['A1','A2']);
 const pitches=full.events.flatMap(e=>['left','right'].flatMap(side=>e[side]?.notes??[])).map(n=>midi(n.pitch));
 assert.equal(Math.min(...pitches),33);assert.equal(Math.max(...pitches),100);
 // First repeat restarts after its first ending (12 quarter beats).
 let beat=0;const start=full.events.find(e=>{const found=Math.abs(beat-12)<1e-8;beat+=e.beats;return found;});
 assert.equal(start.right.notes[0].pitch,'E5');
 assert.ok(full.events.some(e=>e.right?.notes.some(n=>Math.abs(n.duration-1/6)<1e-7)));
});
test('accidentals and the full piano range convert to physical keys',()=>{
 assert.equal(midi('A0'),21);assert.equal(midi('C8'),108);assert.equal(midi('Bb4'),midi('A#4'));
 assert.equal(keyPosition('D#5'),keyPosition('D5')+.5);assert.equal(keyPosition('Bb4'),keyPosition('A#4'));
 for(const pitch of ['C0','C#8','B8'])assert.throws(()=>midi(pitch));
 const chord=lesson([{beats:1,right:{notes:[{pitch:'C4'},{pitch:'C#4'},{pitch:'E4'}]}}]);
 assert.equal(new Set(generateFingering(chord).events[0].right.notes.map(n=>n.finger)).size,3);
});
test('independent durations create held notes and exact release frames',()=>{
 const source={...lesson([{beats:.5,left:{notes:[{pitch:'A2',duration:1,velocity:70}]},right:{notes:[{pitch:'E5',duration:.25}]}},{beats:.5,right:{notes:[{pitch:'D#5',duration:.25}]}}]),version:2,timeSignature:'3/8'};
 validateSong(source);const frames=performanceEvents(source);
 assert.equal(frames.length,4);assert.equal(frames.reduce((sum,e)=>sum+e.beats,0),1);
 assert.equal(frames[0].left.notes[0].held,false);assert.equal(frames[1].left.notes[0].held,true);
 assert.equal(frames[1].right,undefined);assert.equal(frames[2].right.notes[0].held,false);
 const planned=generateFingering(source);assert.ok(planned.events.every(e=>e.left.notes[0].finger===planned.events[0].left.notes[0].finger));
 const bad=structuredClone(source);bad.events[0].left.notes[0].duration=0;assert.throws(()=>validateSong(bad),/duration/);
 bad.events[0].left.notes[0].duration=1;bad.events[0].left.notes[0].velocity=128;assert.throws(()=>validateSong(bad),/Velocity/);
});

test('progressive planning opens immediately and preserves held fingers across every passage',t=>{
 const source=songs.at(-1),start=performance.now(),plan=createFingeringPlan(source);
 t.diagnostic(`Opening prepared in ${Math.round(performance.now()-start)} ms`);
 assert.equal(plan.ready,8);assert.equal(plan.song.events.length,performanceEvents(source).length);
 const opening=structuredClone(plan.song.events.slice(0,8));
 while(plan.ready<plan.frames.length)advanceFingering(plan);
 assert.deepEqual(plan.song.events.slice(0,8),opening);
 for(let i=0;i<plan.ready;i++)for(const side of ['left','right']){
  for(const note of plan.song.events[i][side]?.notes??[]){
   assert.ok(note.finger>=1&&note.finger<=5);
   if(note.held){
    const previous=plan.song.events[i-1][side].notes.find(n=>midi(n.pitch)===midi(note.pitch));
    assert.equal(note.finger,previous.finger,`Held ${note.pitch} at frame ${i}`);
   }
  }
 }
 assert.equal(plan.song.events.flatMap(e=>['left','right'].flatMap(side=>(e[side]?.notes??[]).filter(n=>!n.held))).length,1041);
});
