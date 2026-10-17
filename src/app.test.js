import test from 'node:test';
import assert from 'node:assert/strict';
import {songs, frequency} from './music.js';
import {PIANO_PARTIALS,releaseTime} from './piano-audio.js';

test('complete-piece playback renders accidentals, holds and the ending without reattacking held notes',async()=>{
 const elements=new Map(),oscillators=[],strikes=[],audioContexts=[];let failStrike=false;let resizeCallback;
 globalThis.ResizeObserver=class{constructor(callback){resizeCallback=callback;}observe(){}};
 class Element{
  constructor(){
   this.value='';this.children=[];this.dataset={};this.style={};this.attributes={};this.classes=new Set();
   this.scrollLeft=0;this.clientWidth=650;
   this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c),toggle:(c,on)=>on?this.classes.add(c):this.classes.delete(c)};
  }
  get offsetWidth(){return parseFloat(this.style.minWidth)||650;}
  setAttribute(name,value){this.attributes[name]=value;}
  replaceChildren(){this.children=[];}
  append(child){this.children.push(child);}
  querySelector(){return null;}
 }
 globalThis.document={
  querySelector(selector){if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);},
  querySelectorAll(selector){return selector==='.key'?(elements.get('#keyboard')?.children??[]):[];},
  createElement(){return new Element();}
 };
 class AudioContext{
  constructor(){audioContexts.push(this);}
  currentTime=0;destination={};sampleRate=8000;
  resume(){}
  createBufferSource(){if(failStrike)throw Error('Click output failed');const n={connect(){},disconnect(){},start(){},stop(){}};strikes.push(n);return n;}
  createStereoPanner(){return {pan:{value:0},connect(){},disconnect(){}};}
  createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}};}
  createConvolver(){return {connect(){},disconnect(){}};}
  createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:i=>data[i]};}
  createOscillator(){const oscillator={frequency:{},connect(){},disconnect(){},start(){},stop(duration){this.stopAt=duration;}};oscillators.push(oscillator);return oscillator;}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 globalThis.window={addEventListener(){},AudioContext};
 const workers=[];
 globalThis.Worker=class{
  constructor(){workers.push(this);}
  postMessage(data){this.input=data;}
  terminate(){this.terminated=true;}
 };
 await import('./app.js');
 assert.equal(elements.get('#score-title').textContent,'F\u00fcr Elise','Fur Elise is selected on startup');
 const buttons=[...elements.get('#songs').children];
 assert.equal(buttons.length,11);
 // Selection and stopping are immediate, even before a slow worker replies.
 const abandoned=buttons.at(-1).onclick();
 assert.equal(elements.get('#score-title').textContent,'F\u00fcr Elise');
 assert.equal(elements.get('#keyboard').children.length,88);
 assert.equal(elements.get('#play').disabled,false);
 assert.ok(!elements.get('#score').innerHTML.includes('Preparing notes'),'Opening is ready even with a stalled worker');
 await buttons[0].onclick();await abandoned;
 assert.ok(workers[0].terminated,'A newer selection cancels the previous planner');
 assert.equal(elements.get('#score-title').textContent,songs[0].title);
 const ready=buttons.at(-1).onclick();
 await ready;delete globalThis.Worker;
 assert.equal(elements.get('#play').disabled,false);
 assert.equal(elements.get('#score-title').textContent,'F\u00fcr Elise');
 assert.equal(elements.get('#meter').textContent,'3/8 TIME');
 const keys=elements.get('#keyboard').children;
 assert.equal(keys.length,88);
 const fixedKeyboardWidth=elements.get('.keyboard-stage').style.width;
 const fixedHandViewBox=elements.get('#hand-overlay').attributes.viewBox;
 const visibleSteps=()=>Number(/STEPS 1\D+(\d+) OF/.exec(elements.get('#phrase').textContent)[1]);
 const narrowSteps=visibleSteps();
 elements.get('#score').clientWidth=1280;resizeCallback();
 assert.ok(visibleSteps()>narrowSteps,'Wider score displays more note columns');
 assert.equal(elements.get('.keyboard-stage').style.width,fixedKeyboardWidth);
 assert.equal(elements.get('#hand-overlay').attributes.viewBox,fixedHandViewBox);
 assert.equal(keys.length,88);

 for(const pitch of ['A1','E7','D#5'])assert.ok(keys.some(k=>k.dataset.note===pitch),pitch);
 assert.equal(elements.get('#lesson-source').hidden,false);
 const rightHand=elements.get('#hand-overlay').innerHTML.split('data-hand="right"')[1];
 const fingertipXs=[...rightHand.matchAll(/translate\(([-\d.]+) [-\d.]+\)/g)].map(match=>+match[1]);
 const handCenter=(Math.min(...fingertipXs)+Math.max(...fingertipXs))/2;
 assert.ok(Math.abs(elements.get('.keyboard-scroll').scrollLeft+elements.get('.keyboard-scroll').clientWidth/2-handCenter)<.001,'Keyboard is centered around the active hand');
 assert.ok(rightHand.includes('<circle r="9"'),'Cartoon fingertips use simple round pads');

 let scheduled,delay,totalMilliseconds=0,steps=0;
 const originalTimeout=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
 globalThis.setTimeout=(callback,ms)=>{scheduled=callback;delay=ms;return 1;};
 globalThis.clearTimeout=()=>{scheduled=undefined;};
 const originalMetInterval=globalThis.setInterval,originalMetCancel=globalThis.clearInterval;
 let metPump,metCancelled=false;
 globalThis.setInterval=callback=>{metPump=callback;return 7;};globalThis.clearInterval=()=>{metCancelled=true;};
 try{
  elements.get('#metronome').onclick();
  elements.get('#play').onclick();
  assert.equal(oscillators[0].frequency.value,frequency('E5'));
  while(scheduled){
   const svg=elements.get('#hand-overlay').innerHTML;
   assert.equal((svg.match(/class="hand-silhouette"/g)||[]).length,2);
   assert.ok(!/NaN|undefined/.test(svg));
   assert.ok(!/NaN|undefined/.test(elements.get('#score').innerHTML));
   if(steps===1){
    assert.ok(keys.find(k=>k.dataset.note==='D#5').classes.has('current'));
    assert.ok(elements.get('#score').innerHTML.includes('&#9839;'));
   }
   totalMilliseconds+=delay;audioContexts[0].currentTime=totalMilliseconds/1000;metPump();
   const callback=scheduled;scheduled=undefined;callback();steps++;
   assert.ok(steps<1000,'Playback must terminate');
  }
 }finally{if(elements.get('#metronome').attributes['aria-pressed'])elements.get('#metronome').onclick();globalThis.setInterval=originalMetInterval;globalThis.clearInterval=originalMetCancel;globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;}
 assert.ok(strikes.length>100,'Metronome and piano both produce sound through the full piece');
 assert.equal(steps,799);
 assert.equal(oscillators.length,1041*PIANO_PARTIALS.length,'Exactly one synthesized attack per source note');
 assert.ok(Math.abs(totalMilliseconds-187*60000/72)<.01);
 assert.equal(elements.get('#play').attributes['aria-label'],'Play');
 // Tempo controls event spacing and note lengths without changing pitch.
 globalThis.setTimeout=(callback,ms)=>{scheduled=callback;delay=ms;return 1;};
 globalThis.clearTimeout=()=>{scheduled=undefined;};
 try{
  elements.get('#reset').onclick();
  for(const bpm of [36,72,108,140]){
   elements.get('#tempo').value=bpm;elements.get('#tempo').oninput();
   assert.equal(elements.get('#play').attributes['aria-label'],'Play');
   assert.equal(scheduled,undefined);
   assert.equal(elements.get('#tempo-label').textContent,bpm);
   const before=oscillators.length;elements.get('#play').onclick();
   const seconds=.25*60/bpm;
   assert.ok(Math.abs(delay-seconds*1000)<.001);
   assert.equal(oscillators[before].frequency.value,frequency('E5'));
   assert.ok(Math.abs(oscillators[before].stopAt-(audioContexts[0].currentTime+seconds+releaseTime('E5')+.02))<1e-8);
  }
  elements.get('#tempo').oninput();
  assert.equal(scheduled,undefined);
 }finally{globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;}
 await buttons[0].onclick();
 assert.equal(elements.get('#tempo-label').textContent,songs[0].tempo);

 assert.equal(elements.get('#lesson-source').hidden,true);
 assert.equal(elements.get('#score-title').textContent,songs[0].title);
 elements.get('#hands-toggle').onclick();
 assert.equal(elements.get('#hand-overlay').style.visibility,'hidden');
 const originalInterval=globalThis.setInterval,originalCancel=globalThis.clearInterval;
 let pulse,cancelled=false;
 globalThis.setInterval=callback=>{pulse=callback;return 17;};
 globalThis.clearInterval=id=>{assert.equal(id,17);cancelled=true;};
 try{
  const before=strikes.length;
  elements.get('#metronome').onclick();
  assert.equal(elements.get('#metronome').attributes['aria-pressed'],true);
  assert.equal(strikes.length,before+1,'Enabling while paused plays an immediate wooden strike');
  assert.ok(strikes.at(-1).buffer);
  assert.equal(typeof metPump,'function');
  elements.get('#metronome').onclick();
  assert.equal(elements.get('#metronome').attributes['aria-pressed'],false);
  assert.ok(metCancelled);
  // Toggling the click channel must leave music and its pending timer intact.
  globalThis.setTimeout=(callback,ms)=>{scheduled=callback;delay=ms;return 1;};
  globalThis.clearTimeout=()=>{scheduled=undefined;};
  elements.get('#play').onclick();
  const nextNote=scheduled,pianoVoice=oscillators.at(-1),noteStop=pianoVoice.stopAt;
  elements.get('#metronome').onclick();
  assert.equal(elements.get('#play').attributes['aria-label'],'Pause');
  assert.equal(scheduled,nextNote);
  assert.equal(pianoVoice.stopAt,noteStop,'Starting clicks does not stop a piano voice');
  const countBefore=oscillators.length;
  nextNote();
  assert.ok(oscillators.length>countBefore,'The next music event plays while metronome is on');
  const ongoingPulse=metPump;
  elements.get('#play').onclick();
  assert.equal(elements.get('#metronome').attributes['aria-pressed'],true);
  assert.equal(metPump,ongoingPulse,'Pausing music does not restart the metronome');
  const strikesBeforePause=strikes.length;
  for(let i=0;i<80;i++){audioContexts[0].currentTime+=.025;metPump();}
  assert.ok(strikes.length>strikesBeforePause,'Ticks continue while the song is paused');
  elements.get('#reset').onclick();
  assert.equal(metPump,ongoingPulse,'Resetting the song does not restart clicks');
  await buttons[3].onclick();
  assert.equal(metPump,ongoingPulse,'Selecting a song updates rate without replacing the click clock');
  elements.get('#play').onclick();
  assert.equal(metPump,ongoingPulse,'Starting the song does not reset tick/tock');

  elements.get('#metronome').onclick();
  assert.equal(elements.get('#play').attributes['aria-label'],'Pause');
  failStrike=true;
  elements.get('#metronome').onclick();
  for(let i=0;i<100&&elements.get('#metronome').attributes['aria-pressed'];i++){audioContexts[0].currentTime+=.025;metPump();}
  assert.equal(elements.get('#metronome').attributes['aria-pressed'],false,'Only the failed metronome is disabled');
  assert.equal(elements.get('#play').attributes['aria-label'],'Pause','A click error must not pause music');
  const beforeFailure=oscillators.length;
  scheduled();
  assert.ok(oscillators.length>beforeFailure,'Piano advances after a metronome output failure');
  failStrike=false;
  elements.get('#play').onclick();

 }finally{globalThis.setInterval=originalInterval;globalThis.clearInterval=originalCancel;globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;}

});
