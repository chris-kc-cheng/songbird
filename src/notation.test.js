import test from 'node:test';
import assert from 'node:assert/strict';
import {rhythm,scoreGroups,beamSvg} from './notation.js';
const note=(pitch='C4',duration=.25)=>({beats:duration,right:{notes:[{pitch,duration}]}});

test('eighths, sixteenths, dotted values and triplets get correct beam levels',()=>{
 assert.equal(rhythm(.5).levels,1);assert.equal(rhythm(.25).levels,2);assert.equal(rhythm(.125).levels,3);
 assert.deepEqual(rhythm(.75),{levels:1,dotted:true,triplet:false});
 assert.deepEqual(rhythm(1/6),{levels:2,dotted:false,triplet:true});
 assert.equal(rhythm(1).levels,0);
});
test('4/4 groups short notes by quarter beat, with no beams across rests',()=>{
 const events=Array.from({length:8},()=>note());
 assert.deepEqual(scoreGroups(events,'4/4',0,8).groups.map(g=>g.items.length),[4,4]);
 const rests=[note(),{beats:.25},note(),note()];
 assert.deepEqual(scoreGroups(rests,'4/4',0,4).groups.map(g=>g.items.map(n=>n.index)),[[2,3]]);
});
test('3/8 respects pickup, measure boundaries, chords and held subdivisions',()=>{
 const events=Array.from({length:8},()=>note());
 const result=scoreGroups(events,'3/8',0,8,.5);
 assert.deepEqual(result.groups.map(g=>g.items.length),[2,6]);assert.deepEqual(result.bars,[2]);
 const chord=note();chord.right.notes.push({pitch:'E4',duration:.25});
 assert.equal(scoreGroups([chord,note()],'4/4',0,2).groups[0].items[0].notes.length,2);
 const held=[note('C4',.5),{beats:.25,right:{notes:[{pitch:'C4',duration:.5,held:true}]}},note('D4',.5)];
 held[0].beats=.25;
 assert.equal(scoreGroups(held,'4/4',0,3).groups[0].items.length,2);
});
test('beam drawing includes secondary beams and triplet labels',()=>{
 const events=Array.from({length:3},()=>note('C4',1/6));
 const group=scoreGroups(events,'3/8',0,3).groups[0];
 const svg=beamSvg(group,()=>70,index=>190+index*140,'#34796e');
 assert.equal((svg.match(/class="note-beam"/g)||[]).length,2);
 assert.ok(svg.includes('>3</text>'));assert.ok(!svg.includes('NaN'));
});
