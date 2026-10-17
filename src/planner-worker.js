import {advanceFingering} from './music.js';
self.onmessage=({data})=>{
 const plan=data;
 function next(){
  try{const patch=advanceFingering(plan);self.postMessage(patch);if(!patch.done)setTimeout(next,0);}
  catch(error){self.postMessage({error:error.message});}
 }
 next();
};
