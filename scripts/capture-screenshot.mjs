import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const root=resolve('.');
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
// Use the same subdirectory as GitHub project Pages to catch broken asset URLs.
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith('/songbird/')){res.writeHead(404).end();return;}
  const file=resolve(root,pathname.slice('/songbird/'.length)||'index.html');
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch(process.env.SCREENSHOT_BROWSER_CHANNEL?{channel:process.env.SCREENSHOT_BROWSER_CHANNEL}:{});
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()>=400&&response.url().startsWith('http://127.0.0.1:'))errors.push(`${response.status()} ${response.url()}`);});
 await page.goto(`http://127.0.0.1:${server.address().port}/songbird/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelectorAll('.key').length===88&&!document.querySelector('#play').disabled&&document.querySelectorAll('.hand-silhouette').length===2);
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#score svg').waitFor();
 if(errors.length)throw Error(errors.join('\n'));
 await mkdir('assets/screenshots',{recursive:true});
 await page.screenshot({path:'assets/screenshots/latest.png',fullPage:true,animations:'disabled'});
 // Verify that the same JSON index also drives a complete offline library.
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const titles=await page.evaluate(async()=>{
  const files=await fetch('songs/library.json').then(response=>response.json());
  return Promise.all(files.map(async file=>{
   const url=new URL(`songs/${file}`,location.href).href;
   const response=await caches.match(url);
   if(!response)throw Error(`Song missing from offline cache: ${file}`);
   return (await response.json()).title;
  }));
 });
 await page.context().setOffline(true);
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelectorAll('.key').length===88&&!document.querySelector('#play').disabled);
 const buttons=page.locator('#songs .song');
 if(await buttons.count()!==titles.length)throw Error('Offline library is incomplete');
 for(let i=0;i<titles.length;i++){
  await buttons.nth(i).click();
  await page.waitForFunction(title=>document.querySelector('#score-title').textContent===title&&!document.querySelector('#play').disabled,titles[i]);
  if(await page.locator('.key').count()!==88)throw Error(`Offline keyboard missing for ${titles[i]}`);
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`Saved assets/screenshots/latest.png; all ${titles.length} JSON songs open offline.`);
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
