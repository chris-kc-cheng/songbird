import test from 'node:test';
import assert from 'node:assert/strict';
import {PianoAudio,MetronomeAudio,PIANO_PARTIALS,releaseTime} from './piano-audio.js';
import {frequency} from './music.js';

test('piano has stereo room, pitch-dependent release, keyboard panning and cancellable tails',()=>{
 const oscillators=[],panners=[],envelopes=[];
 const parameter=()=>({events:[],setValueAtTime(value,time){this.events.push({value,time});},linearRampToValueAtTime(value,time){this.events.push({value,time});},exponentialRampToValueAtTime(value,time){this.events.push({value,time});}});
 const node=()=>({connect(){},disconnect(){this.disconnected=true;}});
 const context={currentTime:2,sampleRate:8000,destination:{},resume(){},
  createGain(){const gain={...node(),gain:parameter()};envelopes.push(gain);return gain;},
  createDynamicsCompressor(){return {...node(),threshold:{},knee:{},ratio:{},attack:{},release:{}};},
  createStereoPanner(){const panner={...node(),pan:{}};panners.push(panner);return panner;},
  createConvolver(){return node();},
  createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,getChannelData:i=>data[i]};},
  createOscillator(){const oscillator={...node(),frequency:{},start(time){this.startAt=time;},stop(time){this.stopAt=time;}};oscillators.push(oscillator);return oscillator;}
 };
 const piano=new PianoAudio(context);
 assert.equal(piano.impulse.numberOfChannels,2);
 assert.notDeepEqual(piano.impulse.getChannelData(0),piano.impulse.getChannelData(1));
 piano.play('C3',.25,90);piano.play('C6',.25,90);
 assert.equal(oscillators.length,PIANO_PARTIALS.length*2);
 assert.equal(oscillators[0].frequency.value,frequency('C3'));
 assert.ok(panners[0].pan.value<0);assert.ok(panners[1].pan.value>0);
 assert.ok(releaseTime('C3')>releaseTime('C6'));
 assert.ok(oscillators[0].stopAt>2+.25+.5);
 const envelope=envelopes[2].gain.events;
 assert.equal(envelope[1].time,2.003);
 assert.equal(envelope[2].time,2.25);
 assert.ok(envelope[3].time>envelope[2].time);
 assert.ok(envelope[2].value<envelope[1].value);
 const oldRoom=piano.room;piano.silence();
 assert.equal(piano.voices.size,0);assert.ok(oldRoom.disconnected);assert.notEqual(piano.room,oldRoom);
 assert.ok(oscillators.every(voice=>voice.stopAt===undefined));
});

test('metronome clicks are distinct, audible and separate from piano compression',()=>{
 const nodes=[];
 const parameter=()=>({events:[],setValueAtTime(value,time){this.events.push({value,time});},linearRampToValueAtTime(value,time){this.events.push({value,time});},exponentialRampToValueAtTime(value,time){this.events.push({value,time});}});
 const node=()=>({connections:[],connect(destination){this.connections.push(destination);},disconnect(){}});
 const ctx={currentTime:0,sampleRate:8000,destination:node(),
  createGain(){const n={...node(),gain:parameter()};nodes.push(n);return n;},
  createDynamicsCompressor(){return {...node(),threshold:{},knee:{},ratio:{},attack:{},release:{}};},
  createConvolver(){return node();},
  createBuffer(c,l){const data=Array.from({length:c},()=>new Float32Array(l));return {getChannelData:i=>data[i]};},
  createBufferSource(){const n={...node(),start(){},stop(){}};nodes.push(n);return n;}
 };
 const piano=new MetronomeAudio(ctx);piano.click(true,0);piano.click(false,.5,true);
 const clicks=[...piano.clicks];assert.equal(clicks[0].buffer,piano.tickBuffer);assert.equal(clicks[1].buffer,piano.tockBuffer);
 const tick=piano.tickBuffer.getChannelData(0),tock=piano.tockBuffer.getChannelData(0);
 assert.notDeepEqual(tick,tock);
 const energy=samples=>samples.reduce((sum,x)=>sum+x*x,0)/samples.length;
 assert.ok(energy(tick.slice(-80))<energy(tick.slice(0,80))*.001,'A wooden click decays quickly without a sustained beep');
 const gains=clicks.map(c=>c.connections[0]);
 assert.deepEqual(gains.map(g=>g.gain.events[0].value),[.9,.68]);
 assert.ok(gains.every(g=>g.connections[0]===piano.metronomeGain));
 assert.equal(piano.metronomeGain.connections[0],ctx.destination);
});
