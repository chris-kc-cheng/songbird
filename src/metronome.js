export class Metronome{
 constructor(audio,{repeat=globalThis.setInterval.bind(globalThis),cancel=globalThis.clearInterval.bind(globalThis),onError=()=>{}}={}){this.audio=audio;this.repeat=repeat;this.cancel=cancel;this.onError=onError;}
 start({bpm,timeSignature,beat=0}){
  const [count,denominator]=timeSignature.split('/').map(Number),unit=4/denominator;
  if(!Number.isFinite(bpm)||bpm<=0||!Number.isFinite(beat)||!Number.isFinite(unit)||unit<=0||!Number.isFinite(count)||count<=0)throw Error('Invalid metronome timing.');
  this.bpm=bpm;this.unit=unit;this.count=count;
  // Updating tempo/meter never cancels a live click or resets tick/tock parity.
  if(this.running)return;
  this.running=true;
  this.tick=Math.ceil((beat-1e-8)/unit);
  this.nextTime=this.audio.context.currentTime+(this.tick*unit-beat)*60/bpm;
  const pump=()=>{
   try{
    const now=this.audio.context.currentTime,period=this.unit*60/this.bpm;
    if(this.nextTime<now-.005){const skipped=Math.ceil((now-.005-this.nextTime)/period);this.tick+=skipped;this.nextTime+=skipped*period;}
    for(let scheduled=0;scheduled<8&&this.nextTime<now+.1;scheduled++){
     this.audio.click(this.tick%this.count===0,Math.max(now,this.nextTime),this.tick%2===1);
     this.tick++;this.nextTime+=period;
    }
    return true;
   }catch(error){this.stop();this.onError(error);return false;}
  };
  if(pump())this.timer=this.repeat(pump,25);
 }
 stop(){if(this.timer!==undefined)this.cancel(this.timer);this.timer=undefined;this.running=false;this.audio.stopClicks();}
}
