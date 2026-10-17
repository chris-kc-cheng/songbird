import {keyPosition} from './music.js';

const widths=[26,23,24,22,20];
const THUMB_LENGTH=72;
const CONTACT={white:156,black:82};
const bones=[[0,0],[82,72],[88,78],[83,73],[77,66]];
const rootOffsets=[-83,-48,-12,24,57];
const rootHeights=[220,220,217,220,225];
const point=p=>`${p.x.toFixed(3)} ${p.y.toFixed(3)}`;

// Build constant-width curved fingers first, then trace their outer edges and
// the webs between them as ONE closed palm/finger/wrist outline.
export function handGeometry(placement,pianoX,side){
 const direction=side==='right'?1:-1;
 const placed=[...placement].sort((a,b)=>a.finger-b.finger);
 const targets=placed.map(p=>direction*pianoX(p.pitch));
 // Shift the palm to fit the reach of fixed-length fingers. The thumb
 // rotates at its basal joint; an octave never makes its shaft longer.
 const contactY=p=>Number.isInteger(keyPosition(p.pitch))?CONTACT.white:CONTACT.black;
 const preferred=(targets[2]+targets[3])/2-10;
 // Solve the palm position around a fixed thumb length AND the same key-edge
 // contact rail as the other fingers. Reposition the hand, never its fingertip.
 let best=null;
 const minimum=targets[0]+rootOffsets[0]*-1+8;
 const maximum=targets[0]+rootOffsets[0]*-1+THUMB_LENGTH-.1;
 const candidates=[Math.max(minimum,Math.min(maximum,preferred)),...Array.from({length:161},(_,i)=>minimum+(maximum-minimum)*i/160)];
 for(const center of candidates){
  const dx=targets[0]-(center+rootOffsets[0]);
  const palmShift=contactY(placed[0])+Math.sqrt(THUMB_LENGTH**2-dx**2)-rootHeights[0];
  let error=0;
  for(let i=1;i<5;i++){
   const distance=Math.hypot(targets[i]-center-rootOffsets[i],contactY(placed[i])-rootHeights[i]-palmShift);
   error+=Math.max(0,distance-bones[i][0]-bones[i][1]+.01)**2+Math.max(0,Math.abs(bones[i][0]-bones[i][1])+.01-distance)**2;
  }
  const cost=error*1e6+(center-preferred)**2+palmShift**2*.02;
  if(!best||cost<best.cost)best={center,palmShift,cost};
 }
 const {center,palmShift}=best;
 const global=p=>({x:p.x*direction,y:p.y});
 const fingers=placed.map((p,i)=>{
  const root={x:center+rootOffsets[i],y:rootHeights[i]+palmShift};
  const dx=targets[i]-root.x;
  // Every fingertip meets the same contact rail, including the short thumb.
  const tip={x:targets[i],y:contactY(p)};
  const reach=tip.x-root.x;
  const c1=i===0?{x:root.x+dx/3,y:root.y+(tip.y-root.y)/3}:{x:root.x+reach*.18,y:root.y-20};
  const c2=i===0?{x:root.x+dx*2/3,y:root.y+(tip.y-root.y)*2/3}:{x:tip.x-reach*.12,y:tip.y+19};
  let joint=null;
  if(i>0){
   // Fixed phalange lengths fold UP out of the keyboard plane. Their top-down
   // projection shortens as they curl, while all fingertips meet the same rail.
   const [upper,lower]=bones[i],distance=Math.hypot(dx,tip.y-root.y);
   const along=(upper**2-lower**2+distance**2)/(2*distance);
   joint={x:root.x+dx*along/distance,y:root.y+(tip.y-root.y)*along/distance,z:Math.sqrt(Math.max(0,upper**2-along**2))};
  }
  const left=[],right=[];
  let tangent;
  for(let step=0;step<=20;step++){
   const t=step/20,u=1-t;
   const x=u*u*u*root.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*tip.x;
   const y=u*u*u*root.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*tip.y;
   const dx=3*u*u*(c1.x-root.x)+6*u*t*(c2.x-c1.x)+3*t*t*(tip.x-c2.x);
   const dy=3*u*u*(c1.y-root.y)+6*u*t*(c2.y-c1.y)+3*t*t*(tip.y-c2.y);
   const length=Math.hypot(dx,dy),radius=widths[i]/2;
   tangent={x:dx/length,y:dy/length};
   const nx=dy/length*radius,ny=-dx/length*radius;
   left.push({x:x+nx,y:y+ny});right.push({x:x-nx,y:y-ny});
  }
  const nail=global({x:tip.x-tangent.x*5,y:tip.y-tangent.y*5});
  return {finger:p.finger,pitch:p.pitch,width:widths[i],left,right,root,tip,joint,bones:i===0?[THUMB_LENGTH]:bones[i],
   nail:{...nail,angle:Math.atan2(tangent.y,tangent.x*direction)*180/Math.PI+90}};
 });
 let outline=`M${point(global({x:center-43,y:294+palmShift}))} Q${point(global({x:center-52,y:268+palmShift}))} ${point(global(fingers[0].left[0]))}`;
 fingers.forEach((finger,i)=>{
  outline+=finger.left.slice(1).map(p=>` L${point(global(p))}`).join('');
  const radius=finger.width/2;
  outline+=` A${radius} ${radius} 0 0 ${direction===1?1:0} ${point(global(finger.right.at(-1)))}`;
  outline+=finger.right.slice(0,-1).reverse().map(p=>` L${point(global(p))}`).join('');
  const next=fingers[i+1];
  if(next){
   const a=finger.right[0],b=next.left[0];
   outline+=` Q${point(global({x:(a.x+b.x)/2,y:Math.max(a.y,b.y)+7}))} ${point(global(b))}`;
  }
 });
 outline+=` Q${point(global({x:center+85,y:250+palmShift}))} ${point(global({x:center+46,y:294+palmShift}))} Z`;
 let creases=`M${point(global({x:center-68,y:239}))} Q${point(global({x:center-38,y:232}))} ${point(global({x:center-34,y:259}))} M${point(global({x:center-26,y:244}))} Q${point(global({x:center+7,y:234}))} ${point(global({x:center+40,y:246}))}`;
 for(const finger of fingers)if(finger.joint){
  const joint=finger.joint,radius=finger.width*.3;
  creases+=` M${point(global({x:joint.x-radius,y:joint.y}))} Q${point(global({x:joint.x,y:joint.y+3}))} ${point(global({x:joint.x+radius,y:joint.y}))}`;
 }
 return {outline,creases,fingers,center:center*direction,wristY:294+palmShift,palmY:250+palmShift};
}
