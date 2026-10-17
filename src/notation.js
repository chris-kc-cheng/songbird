// Durations are quarter-note beats. Recognize ordinary, dotted and triplet
// values before deciding how many beams/flags a written note needs.
export function rhythm(duration){
 for(let level=0;level<=4;level++){
  const base=2**-level;
  for(const [factor,dotted,triplet] of [[1,false,false],[1.5,true,false],[2/3,false,true]]){
   if(Math.abs(duration-base*factor)<1e-6)return {levels:level,dotted,triplet};
  }
 }
 return {levels:duration<1?Math.max(1,Math.min(4,Math.round(Math.log2(1/duration)))):0,dotted:[3,6].includes(duration),triplet:false};
}

export function scoreGroups(events,timeSignature,start,count,pickup=0){
 const [numerator,denominator]=timeSignature.split('/').map(Number);
 const measure=numerator*4/denominator;
 const group=denominator===8?measure:1;
 const offset=pickup?measure-pickup:0;
 let beat=0;const visible=[];
 for(let index=0;index<Math.min(events.length,start+count);index++){
  if(index>=start)visible.push({index,beat,event:events[index]});
  beat+=events[index].beats;
 }
 const groups=[];
 for(const side of ['right','left']){
  let pending=[];
  const flush=()=>{if(pending.length>1)groups.push({side,items:pending});pending=[];};
  for(const {index,beat,event} of visible){
   const notes=(event[side]?.notes??[]).filter(note=>!note.held);
   if(!notes.length)continue; // another voice may subdivide a sounding note
   const duration=Math.min(...notes.map(n=>n.duration??event.beats)),written=rhythm(duration);
   if(!written.levels){flush();continue;}
   const bucket=Math.floor((beat+offset+1e-7)/group),previous=pending.at(-1);
   if(previous&&(previous.bucket!==bucket||Math.abs(previous.beat+previous.duration-beat)>1e-6))flush();
   pending.push({index,beat,duration,notes,bucket,...written});
  }
  flush();
 }
 return {groups,bars:visible.filter(({beat})=>beat>0&&Math.abs((beat+offset)/measure-Math.round((beat+offset)/measure))<1e-7).map(({index})=>index)};
}

export function beamSvg(group,noteY,noteX,color){
 const allY=group.items.flatMap(item=>item.notes.map(noteY));
 const staffMiddle=group.side==='right'?58:170;
 const up=allY.reduce((a,b)=>a+b,0)/allY.length>=staffMiddle;
 const beamY=up?Math.min(...allY)-30:Math.max(...allY)+30;
 const stems=group.items.map(item=>({x:noteX(item.index)+(up?7:-7),y:up?Math.max(...item.notes.map(noteY)):Math.min(...item.notes.map(noteY)),...item}));
 let svg=`<g class="beam-group" data-hand="${group.side}" fill="none" stroke="${color}">`;
 for(const stem of stems)svg+=`<path d="M${stem.x} ${stem.y}V${beamY}" stroke-width="1.4"/>`;
 const segment=(a,b,level)=>`<path class="note-beam" d="M${a} ${beamY+(up?6:-6)*(level-1)}H${b}" stroke-width="4"/>`;
 svg+=segment(stems[0].x,stems.at(-1).x,1);
 const max=Math.max(...stems.map(s=>s.levels));
 for(let level=2;level<=max;level++){
  let run=[];
  const flush=()=>{
   if(run.length>1)svg+=segment(run[0].x,run.at(-1).x,level);
   else if(run.length){const index=stems.indexOf(run[0]);svg+=segment(run[0].x,run[0].x+(index===stems.length-1?-14:14),level);}
   run=[];
  };
  for(const stem of stems){if(stem.levels>=level)run.push(stem);else flush();}flush();
 }
 for(let i=0;i+2<stems.length;i++)if(stems.slice(i,i+3).every(s=>s.triplet)){
  svg+=`<text x="${(stems[i].x+stems[i+2].x)/2}" y="${beamY+(up?-9:18)}" fill="${color}" stroke="none" font-size="12" text-anchor="middle">3</text>`;i+=2;
 }
 return svg+'</g>';
}
