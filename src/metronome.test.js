import test from 'node:test';
import assert from 'node:assert/strict';
import {Metronome} from './metronome.js';

test('metronome follows tempo, accents the measure and cancels scheduled clicks',()=>{
 let pump,cancelled=false;const clicks=[],directions=[];
 const audio={context:{currentTime:0},click:(accent,when,tock)=>{clicks.push({accent,when});directions.push(tock);},stopClicks(){this.stopped=true;}};
 const metronome=new Metronome(audio,{repeat:callback=>{pump=callback;return 7;},cancel:id=>{assert.equal(id,7);cancelled=true;}});
 metronome.start({bpm:120,timeSignature:'4/4'});
 for(let beat=1;beat<=4;beat++){audio.context.currentTime=beat*.5;pump();}
 assert.deepEqual(clicks.map(c=>c.when),[0,.5,1,1.5,2]);
 assert.deepEqual(clicks.map(c=>c.accent),[true,false,false,false,true]);
 assert.deepEqual(directions,[false,true,false,true,false]);
 metronome.stop();assert.ok(cancelled);assert.ok(audio.stopped);
});

test('3/8 clicks eighth-note pulses and joins playback at the current phase',()=>{
 let pump;const clicks=[];
 const audio={context:{currentTime:0},click:(accent,when)=>clicks.push({accent,when}),stopClicks(){}};
 const metronome=new Metronome(audio,{repeat:callback=>{pump=callback;return 1;},cancel(){}});
 metronome.start({bpm:60,timeSignature:'3/8',beat:.25});
 assert.equal(clicks.length,0);
 for(const time of [.2,.7,1.2]){audio.context.currentTime=time;pump();}
 assert.deepEqual(clicks,[{accent:false,when:.25},{accent:false,when:.75},{accent:true,when:1.25}]);
 metronome.stop();
});

test('click failures stay inside the metronome and do not escape into song startup',()=>{
 let intervalStarted=false,failure;
 const audio={context:{currentTime:0},click(){throw Error('Audio failure');},stopClicks(){}};
 const metro=new Metronome(audio,{repeat(){intervalStarted=true;},cancel(){},onError:error=>{failure=error;}});
 assert.doesNotThrow(()=>metro.start({bpm:72,timeSignature:'3/8'}));
 assert.equal(failure.message,'Audio failure');assert.equal(intervalStarted,false);
});
test('background-tab catch-up skips missed clicks without blocking the music timer',()=>{
 let pump;const clicks=[];
 const audio={context:{currentTime:0},click:(accent,when)=>clicks.push(when),stopClicks(){}};
 const metro=new Metronome(audio,{repeat:callback=>{pump=callback;return 1;},cancel(){}});
 metro.start({bpm:120,timeSignature:'4/4'});
 audio.context.currentTime=3600;pump();
 assert.equal(clicks.length,2);assert.equal(clicks.at(-1),3600);metro.stop();
});

test('tempo updates retain one continuous tick/tock clock until explicitly disabled',()=>{
 let pump,starts=0,stops=0;const clicks=[];
 const audio={context:{currentTime:0},click:(accent,when,tock)=>clicks.push({when,tock}),stopClicks(){stops++;}};
 const metro=new Metronome(audio,{repeat:callback=>{pump=callback;starts++;return 1;},cancel(){}});
 metro.start({bpm:120,timeSignature:'4/4'});
 metro.start({bpm:60,timeSignature:'4/4'});
 audio.context.currentTime=.5;pump();
 audio.context.currentTime=1.5;pump();
 assert.equal(starts,1);assert.equal(stops,0);
 assert.deepEqual(clicks,[{when:0,tock:false},{when:.5,tock:true},{when:1.5,tock:false}]);
 metro.stop();assert.equal(stops,1);
});

test('native browser timer functions are called with the global receiver',()=>{
 const originalRepeat=globalThis.setInterval,originalCancel=globalThis.clearInterval;
 let started=false,stopped=false;
 // Real browser timer methods reject an arbitrary class instance as receiver.
 globalThis.setInterval=function(callback,ms){assert.equal(this,globalThis);assert.equal(ms,25);started=true;return 31;};
 globalThis.clearInterval=function(id){assert.equal(this,globalThis);assert.equal(id,31);stopped=true;};
 try{
  const audio={context:{currentTime:0},click(){},stopClicks(){}};
  const metro=new Metronome(audio);
  assert.doesNotThrow(()=>metro.start({bpm:72,timeSignature:'3/8'}));
  assert.equal(metro.running,true);assert.ok(started);
  assert.doesNotThrow(()=>metro.stop());assert.ok(stopped);
 }finally{globalThis.setInterval=originalRepeat;globalThis.clearInterval=originalCancel;}
});
