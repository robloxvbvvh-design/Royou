const {chromium}=require('playwright');
const [,, w, nw]=process.argv; const W=+w, NW=+nw, FPS=30, N=Math.round(27*FPS);
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1920,height:1080}});
 await p.goto('file:///home/user/Royou/doshirak-ad/ad.html'); await p.evaluate(()=>document.fonts.ready);
 p.on('pageerror',e=>console.error('ERR',e.message));
 for(let f=W; f<N; f+=NW){
  await p.evaluate(t=>render(t), f/FPS);
  await p.screenshot({path:`/home/user/Royou/doshirak-ad/frames/f${String(f).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});
 }
 await b.close();
})();
