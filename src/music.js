import library from '../songs/library.json' with {type:'json'};
export const names = ['C','D','E','F','G','A','B'];
export function midi(note) {
  const m=/^([A-G])([#b]?)([0-8])$/.exec(note);
  if(!m)throw Error('Use piano pitches A0-C8, such as C4 or D#5.');
  const value=12*(+m[3]+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]])+(m[2]==='#'?1:m[2]==='b'?-1:0);
  if(value<21||value>108)throw Error('Use piano pitches A0-C8.');
  return value;
}
export const fromMidi=value=>['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][value%12]+(Math.floor(value/12)-1);
export const frequency=note=>440*2**((midi(note)-69)/12);
// Staff spelling and physical keyboard position differ for accidentals.
export const whiteIndex=note=>(+note.at(-1)-3)*7+names.indexOf(note[0]);
export const keyPosition=note=>{const canonical=fromMidi(midi(note));return whiteIndex(canonical)+(canonical.includes('#')?.5:0);};
const pitchAt=i=>{const base=Math.floor(i),name=names[((base%7)+7)%7];return name+(i!==base?'#':'')+(3+Math.floor(base/7));};
export function handPitches(position,hand) {
  if(!/^[A-G][0-8]$/.test(position))throw Error('Hand positions use natural piano pitches.');
  midi(position);const base=whiteIndex(position);
  if(base+4>35)throw Error('Leave room for all five fingers below C8.');
  return Array.from({length:5},(_,i)=>({pitch:pitchAt(base+i),finger:hand==='left'?5-i:i+1}));
}
const exact = (obj, keys, label) => {
  if (!obj || typeof obj!=='object' || Array.isArray(obj)) throw Error(`${label} must be an object.`);
  for (const key of Object.keys(obj)) if (!keys.includes(key)) throw Error(`Unknown ${label} field: ${key}`);
};
export function validateSong(song) {
  exact(song,['version','title','composer','category','tempo','timeSignature','pickup','events'],'song');
  if(![1,2].includes(song.version))throw Error('Song version must be 1 or 2.');
  if(typeof song.title!=='string'||!song.title.trim()||song.title.length>80)throw Error('Title must be 1–80 characters.');
  if(song.composer!==undefined&&(typeof song.composer!=='string'||song.composer.length>120))throw Error('Composer must be text up to 120 characters.');
  if(!['melody','chords'].includes(song.category))throw Error('Category must be melody or chords.');
  if(!Number.isInteger(song.tempo)||song.tempo<35||song.tempo>140)throw Error('Tempo must be an integer from 35 to 140.');
  if(!['4/4','3/4','2/4','3/8'].includes(song.timeSignature))throw Error('Supported time signatures: 4/4, 3/4, 2/4, 3/8.');
  if(!Array.isArray(song.events)||song.events.length<1||song.events.length>4096)throw Error('Include 1-4096 events.');
  if(song.pickup!==undefined&&(!Number.isFinite(song.pickup)||song.pickup<0||song.pickup>=+song.timeSignature.split('/')[0]*4/+song.timeSignature.split('/')[1]))throw Error('Pickup must be shorter than one measure.');
  song.events.forEach((event,i)=>{
    exact(event,['beats','left','right'],`event ${i+1}`);
    if(song.version===1?![.25,.5,.75,1,1.5,2,3,4,6].includes(event.beats):!Number.isFinite(event.beats)||event.beats<1/1536||event.beats>16)throw Error(`Event ${i+1}: invalid beat duration.`);
    for(const side of ['left','right']) {
      const hand=event[side]; if(hand===undefined||hand===null)continue;
      exact(hand,['notes'],`${side} hand`);
      if(!Array.isArray(hand.notes)||hand.notes.length<1||hand.notes.length>5)throw Error('Each active hand needs 1-5 notes.');
      const used=new Set();
      hand.notes.forEach(note=>{
        exact(note,song.version===2?['pitch','duration','velocity']:['pitch'],'note');
        if(typeof note.pitch!=='string')throw Error('Each note needs a piano pitch.');
        const key=midi(note.pitch);
        if(song.version===2&&(!Number.isFinite(note.duration)||note.duration<=0||note.duration>64))throw Error('Version 2 notes need a duration in beats (up to 64).');
        if(note.velocity!==undefined&&(!Number.isInteger(note.velocity)||note.velocity<1||note.velocity>127))throw Error('Velocity must be an integer from 1 to 127.');
        if(used.has(key))throw Error('A hand cannot play a duplicate pitch.');used.add(key);
      });
      const indices=hand.notes.map(n=>keyPosition(n.pitch));
      if(Math.max(...indices)-Math.min(...indices)>7.001)throw Error(`Event ${i+1}: notes exceed an eight-white-key (octave) span.`);
    }
    if(event.left&&event.right){
      if(Math.max(...event.left.notes.map(n=>midi(n.pitch)))>=Math.min(...event.right.notes.map(n=>midi(n.pitch))))throw Error(`Event ${i+1}: hands must use separate registers.`);
    }
  });
  return song;
}
// Library order and song content live in JSON; fingering is generated below.
export const songs=await Promise.all(library.map(async file=>{
  const {default:song}=await import(new URL(`../songs/${file}`,import.meta.url).href,{with:{type:'json'}});
  return song;
}));
songs.forEach(validateSong);

// Five ordered fingers can occupy any five of up to eight white keys.
// Compact positions cost less; wider shapes are available for chords/extensions.
const shapes=[];
for(let span=4;span<=7;span++)for(let a=1;a<span-2;a++)for(let b=a+1;b<span-1;b++)for(let c=b+1;c<span;c++)shapes.push([0,a,b,c,span]);
const layouts=shapes.flatMap(offsets=>Array.from({length:52-offsets[4]},(_,i)=>offsets.map(n=>n+i-16)));
const sameLayout=(a,b)=>a.every((n,i)=>n===b[i]);

// Recognize one-octave, adjacent-white-key runs. These are C-major/A-minor
// patterns, not a generic claim about every key or every passage.
function scaleHints(events,side) {
  const hints=new Map();
  for(let start=0;start+7<events.length;start++){
    const run=events.slice(start,start+8).map(e=>e[side]?.notes);
    if(run.some(notes=>notes?.length!==1||notes[0].held||/[#b]/.test(notes[0].pitch)))continue;
    const indices=run.map(notes=>whiteIndex(notes[0].pitch)),direction=Math.sign(indices[1]-indices[0]);
    if(!direction||!indices.every((n,i)=>n===indices[0]+i*direction))continue;
    const low=((Math.min(...indices)%7)+7)%7;
    if(low!==0&&low!==5)continue;
    const ascending=side==='right'?[1,2,3,1,2,3,4,5]:[5,4,3,2,1,3,2,1];
    const fingers=direction===1?ascending:[...ascending].reverse();
    fingers.forEach((finger,i)=>hints.set(start+i,finger));
    start+=6;
  }
  return hints;
}

function planHand(events,side,seed) {
  const initial=seed?seed.placement.map(p=>keyPosition(p.pitch)):(side==='left'?[0,1,2,3,4]:[7,8,9,10,11]);
  const fingerAt=i=>side==='left'?5-i:i+1,hints=scaleHints(events,side);
  let previous=[{keys:initial,cost:0,path:null,notes:seed?.notes.map(n=>keyPosition(n.pitch))??[]}];
  events.forEach((event,index)=>{
    const notes=event[side]?.notes??[],indices=notes.map(n=>keyPosition(n.pitch));
    const heldIndices=notes.flatMap((n,i)=>n.held?[indices[i]]:[]);
    if(!notes.length){previous=previous.map(prev=>({...prev,path:prev,notes:[]}));return;}
    const other=event[side==='left'?'right':'left']?.notes.map(n=>keyPosition(n.pitch));
    const required=new Map(indices.map(n=>[Math.floor(n),n]));
    let candidates=layouts.filter(keys=>indices.every(n=>keys.includes(Math.floor(n)))).map(keys=>keys.map(k=>required.get(k)??k));
    if(required.size<indices.length){
      // Rare adjacent natural/accidental chords need two fingers on one letter.
      candidates=[];const requiredKeys=[...new Set(indices)].sort((a,b)=>a-b);
      const optional=Array.from({length:52},(_,i)=>i-16).filter(k=>!requiredKeys.includes(k)&&k>=requiredKeys[0]-7&&k<=requiredKeys.at(-1)+7);
      const fill=(start,keys)=>{
        if(keys.length===5){const sorted=[...keys].sort((a,b)=>a-b);if(sorted[4]-sorted[0]<=7)candidates.push(sorted);return;}
        for(let j=start;j<optional.length;j++)fill(j+1,[...keys,optional[j]]);
      };
      fill(0,requiredKeys);
    }
    candidates=candidates.filter(keys=>keys[4]-keys[0]<=7.001&&(!other||
      (side==='left'?keys[4]<Math.min(...other):keys[0]>Math.max(...other))));
    const states=[];
    for(const keys of candidates){
      let cost=Infinity,best=null;
      const span=keys[4]-keys[0],extension=Math.max(0,span-4)*1.2;
      const hint=hints.get(index),hintCost=hint&&fingerAt(keys.indexOf(indices[0]))!==hint?30:0;
      const sorted=[...indices].sort((a,b)=>a-b);
      const triad=sorted.length===3&&sorted[1]-sorted[0]===2&&sorted[2]-sorted[1]===2;
      const chordCost=triad&&sorted.some((key,i)=>keys.indexOf(key)!==i*2)?12:0;
      for(const prev of previous){
        if(heldIndices.some(key=>prev.keys.indexOf(key)!==keys.indexOf(key)))continue;
        const displacement=Math.abs(keys[0]-prev.keys[0]);
        const movement=sameLayout(keys,prev.keys)?0:2+displacement*.7+keys.reduce((sum,k,i)=>sum+Math.abs(k-prev.keys[i]),0)*.08;
        // Keep repeated pitches on the same finger when the phrase allows it.
        const repeated=indices.reduce((sum,n)=>sum+(prev.notes.includes(n)&&prev.keys.indexOf(n)!==keys.indexOf(n)?2:0),0);
        const total=prev.cost+movement+extension+hintCost+chordCost+repeated;
        if(total<cost){cost=total;best=prev;}
      }
      if(best)states.push({keys,cost,path:best,notes:indices});
    }
    if(!states.length)throw Error(`Event ${index+1}: no separate ${side}-hand placement fits within eight white keys.`);
    // Bounded phrase search; long pieces run in a background worker.
    previous=states.sort((a,b)=>a.cost-b.cost).slice(0,48);
  });
  const result=Array(events.length);let state=previous.reduce((a,b)=>a.cost<=b.cost?a:b);
  for(let i=events.length-1;i>=0;i--){
    const placement=state.keys.map((key,j)=>({pitch:pitchAt(key),finger:fingerAt(j)}));
    const notes=events[i][side]?.notes;
    result[i]=notes?{
      position:pitchAt(state.keys[0]),span:Math.ceil(state.keys[4]-state.keys[0])+1,placement,
      notes:notes.map(n=>({...n,finger:placement.find(p=>midi(p.pitch)===midi(n.pitch)).finger}))
    }:null;
    state=state.path;
  }
  return result;
}

// Expand independent note lengths into display frames. Held notes are visualized
// and retain their assigned finger, but playback never reattacks them.
export function performanceEvents(input){
 const snap=n=>Math.round(n*1e9)/1e9;
 const attacks=new Map(),boundaries=new Set([0]);let beat=0;
 for(const event of input.events){
  const time=snap(beat);boundaries.add(time);
  for(const side of ['left','right'])for(const note of event[side]?.notes??[]){
   const end=snap(time+note.duration);boundaries.add(end);
   if(!attacks.has(time))attacks.set(time,[]);
   attacks.get(time).push({...note,side,end});
  }
  beat=snap(beat+event.beats);boundaries.add(beat);
 }
 const times=[...boundaries].sort((a,b)=>a-b),active={left:[],right:[]},frames=[];
 for(let i=0;i<times.length-1;i++){
  const time=times[i],frame={beats:times[i+1]-time};
  for(const side of ['left','right'])active[side]=active[side].filter(n=>n.end>time+1e-8).map(n=>({...n,held:true}));
  for(const note of attacks.get(time)??[]){
   active[note.side]=active[note.side].filter(n=>midi(n.pitch)!==midi(note.pitch));
   active[note.side].push({...note,held:false});
  }
  for(const side of ['left','right'])if(active[side].length)frame[side]={notes:active[side].map(({side:part,end,...note})=>({...note,remaining:end-time}))};
  frames.push(frame);
 }
 return frames;
}

export function generateFingering(input) {
  validateSong(input);
  const events=input.version===2?performanceEvents(input):input.events;
  const left=planHand(events,'left'),right=planHand(events,'right');
  return {...input,events:events.map((event,i)=>{
    const generated={...event};
    if(left[i])generated.left=left[i];
    if(right[i])generated.right=right[i];
    return generated;
  })};
}

// Commit a short passage with lookahead, carrying the previous hand pose across
// boundaries so held notes keep their fingers. Already displayed frames never change.
export function advanceFingering(plan,count=32){
 const start=plan.ready,end=Math.min(start+count,plan.frames.length);
 const window=plan.frames.slice(start,Math.min(end+16,plan.frames.length));
 const hands=Object.fromEntries(['left','right'].map(side=>[side,planHand(window,side,plan.state[side])]));
 const events=window.slice(0,end-start).map((event,i)=>{
  const generated={...event};
  for(const side of ['left','right'])if(hands[side][i])generated[side]=hands[side][i];
  return generated;
 });
 for(const side of ['left','right'])for(const event of events)if(event[side])plan.state[side]=event[side];
 plan.ready=end;
 if(plan.song)plan.song.events.splice(start,events.length,...events);
 return {start,events,ready:end,state:{...plan.state},done:end===plan.frames.length};
}
export function createFingeringPlan(input){
 validateSong(input);
 const frames=input.version===2?performanceEvents(input):input.events;
 const plan={frames,ready:0,state:{},song:{...input,events:frames.slice()}};
 advanceFingering(plan,8);
 return plan;
}
