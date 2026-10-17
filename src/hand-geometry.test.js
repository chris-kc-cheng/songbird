import test from 'node:test';
import assert from 'node:assert/strict';
import {handGeometry} from './hand-geometry.js';
import {handPitches,keyPosition} from './music.js';

const pianoX=pitch=>400+keyPosition(pitch)*49.5;
const wide=side=>['C4','F4','G4','A4','C5'].map((pitch,i)=>({pitch,finger:side==='right'?i+1:5-i}));

test('every finger keeps its width along the entire curve, including extended thumbs',()=>{
 for(const side of ['left','right'])for(const placement of [handPitches('C4',side),wide(side)]){
  const geometry=handGeometry(placement,pianoX,side);
  assert.ok(!/NaN|undefined/.test(geometry.outline));
  assert.equal((geometry.outline.match(/M/g)||[]).length,1);
  assert.ok(geometry.outline.endsWith(' Z'));
  for(const finger of geometry.fingers)for(let i=0;i<finger.left.length;i++){
   const a=finger.left[i],b=finger.right[i];
   assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-finger.width)<1e-8);
  }
 }
});

test('thumb extends outward from its palm joint without fattening the fingers or wrist',()=>{
 const compact=handGeometry(handPitches('C4','right'),pianoX,'right');
 const extended=handGeometry(wide('right'),pianoX,'right');
 assert.ok(Math.abs(extended.fingers[0].nail.angle)>Math.abs(compact.fingers[0].nail.angle));
 for(let i=0;i<5;i++){
  assert.equal(compact.fingers[i].width,extended.fingers[i].width);
  const compactRoot=(compact.fingers[i].left[0].x+compact.fingers[i].right[0].x)/2;
  const extendedRoot=(extended.fingers[i].left[0].x+extended.fingers[i].right[0].x)/2;
  assert.ok(Math.abs((compactRoot-compact.center)-(extendedRoot-extended.center))<1e-8);
 }
});

test('black-key fingertips remain aligned with their assigned keys',()=>{
 const placement=handPitches('C4','right');placement[1].pitch='D#4';
 const geometry=handGeometry(placement,pianoX,'right');
 for(const finger of geometry.fingers){
  const left=finger.left.at(-1),right=finger.right.at(-1);
  assert.ok(Math.abs((left.x+right.x)/2-pianoX(finger.pitch))<1e-8);
 }
 assert.ok(geometry.fingers[1].nail.y<100);
});

test('thumb length stays fixed as its basal joint opens across different spans',()=>{
 for(const side of ['left','right']){
  const poses=[handPitches('C4',side),wide(side)];
  const lengths=poses.map(placement=>{
   const thumb=handGeometry(placement,pianoX,side).fingers[0];
   const length=Math.hypot(thumb.tip.x-thumb.root.x,thumb.tip.y-thumb.root.y);
   assert.ok(Math.abs(length-72)<1e-8);
   let curveLength=0;
   for(let i=1;i<thumb.left.length;i++){
    const center=k=>({x:(thumb.left[k].x+thumb.right[k].x)/2,y:(thumb.left[k].y+thumb.right[k].y)/2});
    const a=center(i-1),b=center(i);curveLength+=Math.hypot(a.x-b.x,a.y-b.y);
   }
   assert.ok(Math.abs(curveLength-72)<1e-8);
   return length;
  });
  assert.ok(Math.abs(lengths[0]-lengths[1])<1e-8);
 }
});
test('other fingers bend with fixed bones and contact the same key-edge rail',()=>{
 for(const side of ['left','right'])for(const placement of [handPitches('C4',side),wide(side)]){
  const fingers=handGeometry(placement,pianoX,side).fingers.slice(1);
  for(const finger of fingers){
   assert.equal(finger.tip.y,156);
   const {root,joint,tip,bones}=finger;
   assert.ok(joint.z>0);
   assert.ok(Math.abs(Math.hypot(joint.x-root.x,joint.y-root.y,joint.z)-bones[0])<1e-8);
   assert.ok(Math.abs(Math.hypot(tip.x-joint.x,tip.y-joint.y,joint.z)-bones[1])<1e-8);
  }
 }
});

test('mixed black/white-key chords reposition the palm without stretching bones',()=>{
 const placement=['E4','G4','A#4','B4','C#5'].map((pitch,i)=>({pitch,finger:i+1}));
 for(const finger of handGeometry(placement,pianoX,'right').fingers){
  const {root,tip,joint,bones}=finger;
  if(joint){
   assert.ok(Math.abs(Math.hypot(joint.x-root.x,joint.y-root.y,joint.z)-bones[0])<1e-8);
   assert.ok(Math.abs(Math.hypot(tip.x-joint.x,tip.y-joint.y,joint.z)-bones[1])<1e-8);
  }else assert.ok(Math.abs(Math.hypot(tip.x-root.x,tip.y-root.y)-72)<1e-8);
 }
});

test('thumb contacts white keys at the front edge and black keys farther back',()=>{
 for(const side of ['left','right']){
  for(const placement of [handPitches('C4',side),wide(side)]){
   const geometry=handGeometry(placement,pianoX,side);
   assert.equal(geometry.fingers[0].tip.y,156);
   assert.ok(geometry.fingers.slice(1).every(f=>f.tip.y===156));
   const thumb=geometry.fingers[0];assert.ok(Math.abs(Math.hypot(thumb.tip.x-thumb.root.x,thumb.tip.y-thumb.root.y)-72)<1e-8);
  }
  const placement=handPitches('C4',side),thumb=placement.find(p=>p.finger===1);
  thumb.pitch=side==='right'?'C#4':'G#4';
  assert.equal(handGeometry(placement,pianoX,side).fingers[0].tip.y,82);
 }
});
