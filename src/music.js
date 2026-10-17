export const names = ['C','D','E','F','G','A','B'];
export function midi(note) {
  const m = /^([A-G])(#?)([3-5])$/.exec(note);
  if (!m) throw Error('Use natural notes C3–B5, such as C4.');
  return 12 * (+m[3] + 1) + ({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]) + (m[2] ? 1 : 0);
}
export const frequency = note => 440 * 2 ** ((midi(note)-69)/12);
export const whiteIndex = note => (+note[1]-3)*7 + names.indexOf(note[0]);
export function handPitches(position, hand) {
  if(!/^[A-G][3-5]$/.test(position))throw Error('Hand positions use natural notes C3–E5.');
  midi(position);
  const base = whiteIndex(position);
  if (base > 16) throw Error('Hand positions must leave room for all five fingers (C3–E5).');
  return Array.from({length:5},(_,i)=>{
    const index=base+i;
    return {pitch:names[index%7]+(3+Math.floor(index/7)),finger:hand==='left'?5-i:i+1};
  });
}
const exact = (obj, keys, label) => {
  if (!obj || typeof obj!=='object' || Array.isArray(obj)) throw Error(`${label} must be an object.`);
  for (const key of Object.keys(obj)) if (!keys.includes(key)) throw Error(`Unknown ${label} field: ${key}`);
};
export function validateSong(song) {
  exact(song,['version','title','composer','category','tempo','timeSignature','events'],'song');
  if(song.version!==1)throw Error('Song version must be 1.');
  if(typeof song.title!=='string'||!song.title.trim()||song.title.length>80)throw Error('Title must be 1–80 characters.');
  if(song.composer!==undefined&&(typeof song.composer!=='string'||song.composer.length>120))throw Error('Composer must be text up to 120 characters.');
  if(!['melody','chords'].includes(song.category))throw Error('Category must be melody or chords.');
  if(!Number.isInteger(song.tempo)||song.tempo<35||song.tempo>140)throw Error('Tempo must be an integer from 35 to 140.');
  if(!['4/4','3/4','2/4'].includes(song.timeSignature))throw Error('Supported time signatures: 4/4, 3/4, 2/4.');
  if(!Array.isArray(song.events)||song.events.length<1||song.events.length>512)throw Error('Include 1–512 events.');
  song.events.forEach((event,i)=>{
    exact(event,['beats','left','right'],`event ${i+1}`);
    if(![.25,.5,.75,1,1.5,2,3,4,6].includes(event.beats))throw Error(`Event ${i+1}: use a supported duration (0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4 or 6 beats).`);
    for(const side of ['left','right']) {
      const hand=event[side]; if(hand===undefined||hand===null)continue;
      exact(hand,['position','notes'],`${side} hand`);
      const placement=handPitches(hand.position,side);
      if(!Array.isArray(hand.notes)||hand.notes.length<1||hand.notes.length>5)throw Error('Each active hand needs 1–5 notes.');
      const used=new Set();
      hand.notes.forEach(note=>{
        exact(note,['pitch','finger'],'note');
        if(typeof note.pitch!=='string'||!/^[A-G][3-5]$/.test(note.pitch))throw Error('Lessons currently support natural notes C3–B5.');
        midi(note.pitch);
        if(!Number.isInteger(note.finger)||!placement.some(p=>p.pitch===note.pitch&&p.finger===note.finger))throw Error(`Event ${i+1}: ${side} ${note.pitch} does not match finger ${note.finger} in ${hand.position} five-finger position.`);
        if(used.has(note.finger))throw Error('A finger cannot play two notes at once.');used.add(note.finger);
      });
    }
    if(event.left&&event.right){
      const left=handPitches(event.left.position,'left'),right=handPitches(event.right.position,'right');
      if(midi(left[4].pitch)>=midi(right[0].pitch))throw Error(`Event ${i+1}: hand positions overlap. Use separate registers.`);
    }
  });
  return song;
}
function melody(title,composer,sequence,tempo=76) {
  const events=sequence.split(' ').map(token=>{
    const [pitch,beats='1']=token.split(':');
    const position=pitch==='A4'?'D4':'C4';
    return {beats:+beats,right:{position,notes:[{pitch,finger:handPitches(position,'right').find(n=>n.pitch===pitch).finger}]}};
  });
  return {version:1,title,composer,category:'melody',tempo,timeSignature:'4/4',events};
}
export const songs = [
 melody('Ode to Joy','Ludwig van Beethoven · 1824','E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2'),
 melody('Hot Cross Buns','Traditional · English folk tune','E4 D4 C4:2 E4 D4 C4:2 C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 E4 D4 C4:2'),
 melody('Mary Had a Little Lamb','Traditional · 19th-century melody','E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4'),
 melody('Twinkle, Twinkle, Little Star','Traditional · French melody, 18th century','C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2',68),
 {version:1,title:'First chords · C, F & G',composer:'Songbird · original exercise',category:'chords',tempo:50,timeSignature:'4/4',events:['C','F','G','C'].map(root=>{const left=handPitches(root+'3','left'),right=handPitches(root+'4','right');return {beats:4,left:{position:root+'3',notes:[left[0],left[2],left[4]]},right:{position:root+'4',notes:[right[0],right[2],right[4]]}};})},
 {version:1,title:'Together in C',composer:'Songbird · original exercise',category:'chords',tempo:60,timeSignature:'4/4',events:['C4','D4','E4','G4','E4','D4','C4'].map(pitch=>({beats:2,left:{position:'C3',notes:[{pitch:'C3',finger:5},{pitch:'E3',finger:3},{pitch:'G3',finger:1}]},right:{position:'C4',notes:[{pitch,finger:handPitches('C4','right').find(n=>n.pitch===pitch).finger}]}}))}
];
songs.forEach(validateSong);
