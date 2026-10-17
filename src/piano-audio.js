import {frequency,midi} from './music.js';

export const PIANO_PARTIALS=[[1,.105],[2,.038],[3,.017],[4,.008],[6,.0035],[8,.0015]];
export const releaseTime=note=>Math.max(.28,Math.min(.85,.8-(midi(note)-36)*.008));

// Short broadband hammer transients and rapidly damped, inharmonic wood
// resonances make a mechanical tick/tock instead of a pitched oscillator beep.
function woodenClick(context,tock){
 const rate=context.sampleRate,buffer=context.createBuffer(1,Math.ceil(rate*.055),rate),samples=buffer.getChannelData(0);
 const modes=tock?[[690,1,.007],[1430,.45,.004],[2470,.18,.0025]]:[[950,1,.006],[1830,.42,.0035],[3210,.16,.002]];
 let seed=tock?3719:8191,peak=0;
 for(let i=0;i<samples.length;i++){
  const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=(seed/2147483648-1)*.65*Math.exp(-t/.0015);
  const body=modes.reduce((sum,[hz,level,decay])=>sum+Math.sin(2*Math.PI*hz*t)*level*Math.exp(-t/decay),0);
  samples[i]=(noise+body)*Math.min(1,t/.00035);peak=Math.max(peak,Math.abs(samples[i]));
 }
 for(let i=0;i<samples.length;i++)samples[i]*=.65/Math.max(.001,peak);
 return buffer;
}

// A self-contained piano-like instrument: fast hammer attack, decaying upper
// partials, pitch-dependent string release, keyboard panning and a stereo room.
export class PianoAudio{
 constructor(context){
  this.context=context;this.voices=new Set();
  this.master=context.createGain();this.master.gain.value=.8;
  this.compressor=context.createDynamicsCompressor();
  this.compressor.threshold.value=-15;this.compressor.knee.value=18;
  this.compressor.ratio.value=3;this.compressor.attack.value=.004;this.compressor.release.value=.2;
  this.master.connect(this.compressor);this.compressor.connect(context.destination);
  this.send=context.createGain();this.send.gain.value=.16;
  const seconds=1.7,length=Math.ceil(context.sampleRate*seconds);
  this.impulse=context.createBuffer(2,length,context.sampleRate);
  let seed=9127;
  for(let channel=0;channel<2;channel++){
   const samples=this.impulse.getChannelData(channel);
   for(let i=0;i<length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    samples[i]=(seed/2147483648-1)*Math.exp(-i/context.sampleRate*5.5)*(i<80?i/80:1);
   }
  }
  this.resetRoom();
 }
 resetRoom(){
  this.send.disconnect();this.room?.disconnect();
  this.room=this.context.createConvolver();this.room.buffer=this.impulse;
  this.send.connect(this.room);this.room.connect(this.master);
 }
 play(note,duration=.55,velocity=80){
  const ctx=this.context;ctx.resume();
  const t=ctx.currentTime,key=midi(note),length=Math.max(.015,duration),tail=releaseTime(note);
  const pan=ctx.createStereoPanner();pan.pan.value=Math.max(-.55,Math.min(.55,(key-64)/65));
  pan.connect(this.master);pan.connect(this.send);
  let remaining=PIANO_PARTIALS.length;
  for(const [harmonic,level] of PIANO_PARTIALS){
   const oscillator=ctx.createOscillator(),envelope=ctx.createGain();
   // Slight string inharmonicity gives the upper partials a piano-like shimmer.
   oscillator.frequency.value=frequency(note)*harmonic*Math.sqrt(1+.000025*(harmonic*harmonic-1));
   const attack=.003,amplitude=level*(velocity/100)**(harmonic===1?1:1.7);
   const decay=Math.max(.2,3.8-(key-36)*.027)/(1+(harmonic-1)*.24);
   const heldLevel=Math.max(.00001,amplitude*Math.exp(-length/decay));
   envelope.gain.setValueAtTime(.00001,t);
   envelope.gain.linearRampToValueAtTime(amplitude,t+attack);
   envelope.gain.exponentialRampToValueAtTime(heldLevel,t+length);
   envelope.gain.exponentialRampToValueAtTime(.00001,t+length+tail);
   oscillator.connect(envelope);envelope.connect(pan);
   oscillator.start(t);oscillator.stop(t+length+tail+.02);this.voices.add(oscillator);
   oscillator.onended=()=>{
    this.voices.delete(oscillator);oscillator.disconnect();envelope.disconnect();
    if(!--remaining)pan.disconnect();
   };
  }
 }
 silence(){
  for(const voice of this.voices){try{voice.stop();}catch{}}
  this.voices.clear();this.resetRoom();
 }
}

// A dedicated click channel cannot stop or reset piano voices or transport.
export class MetronomeAudio{
 constructor(context){
  this.context=context;this.clicks=new Set();
  // Keep the beat clear even while piano chords trigger the music compressor.
  this.metronomeGain=context.createGain();this.metronomeGain.gain.value=.7;
  this.metronomeGain.connect(context.destination);
  this.tickBuffer=woodenClick(context,false);this.tockBuffer=woodenClick(context,true);
 }
 click(accent,when=this.context.currentTime,tock=false){
  const strike=this.context.createBufferSource(),gain=this.context.createGain();
  strike.buffer=tock?this.tockBuffer:this.tickBuffer;
  gain.gain.setValueAtTime(accent?.9:.68,when);
  strike.connect(gain);gain.connect(this.metronomeGain);
  strike.start(when);strike.stop(when+.06);this.clicks.add(strike);
  strike.onended=()=>{this.clicks.delete(strike);strike.disconnect();gain.disconnect();};
 }
 stopClicks(){for(const click of this.clicks){try{click.stop();}catch{}}this.clicks.clear();}
 }
