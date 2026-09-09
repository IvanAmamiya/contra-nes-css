(function(){
  'use strict';
  const {GameWorld,STEP}=window.ContraCore,renderer=new window.ContraRenderer(document.getElementById('game'));
  function run(seed,scene='win'){
    const w=new GameWorld(seed);w.reset('playing',30);const p=new window.ContraPilot();let frames=0,spreadFired=false;
    while(w.state==='playing'&&frames<18000){
      const input=p.next(w);if(scene==='soldier'||scene==='spread'&&spreadFired)input.turbo=false;
      w.update(STEP,input);w.drainEvents();frames++;
      if(scene==='spread'){
        const pellets=w.bullets.filter(b=>b.kind==='spread');if(pellets.length)spreadFired=true;
        if(pellets.length===5&&pellets.every(b=>b.age*60>=32-1e-7))break;
      }
      if(scene==='soldier'&&w.player.x>=168)break;if(scene==='jungle'&&w.player.x>=335)break;if(scene==='boss'&&w.boss.activated&&w.player.x> w.boss.x-40)break;
    }
    renderer.time=w.time+.04;renderer.clear();renderer.draw(w,0);
    return{seed,state:w.state,frames,score:w.score,lives:w.lives,deaths:w.deaths,x:Math.round(w.player.x)};
  }
  for(const scene of ['spread','soldier','jungle','boss','win'])document.getElementById('scene-'+scene).addEventListener('click',()=>{const r=run(1337,scene);document.getElementById('status').textContent='回放完成 / '+scene;document.getElementById('results').textContent=JSON.stringify(r,null,2);});
  document.getElementById('run-all').addEventListener('click',()=>{
    const start=performance.now(),results=[1,7,27,42,123,256,512,1024,1337,9001].map(seed=>run(seed));
    const pass=results.filter(r=>r.state==='won').length;
    document.getElementById('status').textContent=`${pass}/10 完整通关通过 · ${Math.round(performance.now()-start)} ms`;
    document.getElementById('results').textContent=results.map(r=>JSON.stringify(r)).join('\n');
  });
  renderer.draw(new GameWorld(),0);
  const rasterRequests=performance.getEntriesByType('resource').filter(e=>/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(e.name));
  document.getElementById('render-audit').textContent=`绘制检查：${document.querySelectorAll('canvas').length} 个 Canvas · ${document.querySelectorAll('img,svg').length} 个图片/SVG 元素 · ${rasterRequests.length} 次位图资源请求`;
  document.getElementById('run-baseline').addEventListener('click',()=>{
    const button=document.getElementById('run-baseline');if(button.disabled)return;button.disabled=true;
    const view=document.getElementById('game');view.style.visibility='hidden';let start,n=0;
    function frame(now){if(start===undefined)start=now;n++;if(n<240){requestAnimationFrame(frame);return;}view.style.visibility='';button.disabled=false;document.getElementById('status').textContent='空场帧率对照完成';document.getElementById('results').textContent=JSON.stringify({frames:n,elapsedMs:Math.round(now-start),fps:Number((239000/(now-start)).toFixed(1))},null,2);}
    requestAnimationFrame(frame);
  });
  function runRender(stepsPerFrame,buttonId){
    const button=document.getElementById(buttonId);if(button.disabled)return;button.disabled=true;
    const w=new GameWorld(1337);w.reset('playing',30);const pilot=new window.ContraPilot(),costs=[];let frames=0,start,last,maxNodes=0;const intervals=[];
    renderer.clear();
    function frame(now){
      if(start===undefined)start=now;if(last!==undefined)intervals.push(now-last);last=now;
      for(let i=0;i<stepsPerFrame;i++){w.update(STEP,pilot.next(w));for(const e of w.drainEvents())renderer.event(e);}
      const t=performance.now();renderer.draw(w,STEP*stepsPerFrame);costs.push(performance.now()-t);frames++;
      if(frames%60===0){maxNodes=Math.max(maxNodes,document.getElementById('game').querySelectorAll('*').length);document.getElementById('status').textContent=`CSS 渲染测试 ${frames}/600 帧`;}
      if(frames<600){requestAnimationFrame(frame);return;}
      costs.sort((a,b)=>a-b);intervals.sort((a,b)=>a-b);
      const result={frames,stepsPerFrame,finalState:w.state,camera:w.camera,simulatedSeconds:Number(w.time.toFixed(2)),elapsedMs:Math.round(now-start),fps:Number((599000/(now-start)).toFixed(1)),renderP95Ms:Number(costs[Math.floor(costs.length*.95)].toFixed(2)),intervalP95Ms:Number(intervals[Math.floor(intervals.length*.95)].toFixed(2)),maxNodes,canvasElements:document.querySelectorAll('canvas').length,imageElements:document.querySelectorAll('img').length};
      document.getElementById('status').textContent='CSS 渲染测试完成';document.getElementById('results').textContent=JSON.stringify(result,null,2);button.disabled=false;
    }
    requestAnimationFrame(frame);
  }
  document.getElementById('run-render').addEventListener('click',()=>runRender(1,'run-render'));
  document.getElementById('run-tour').addEventListener('click',()=>runRender(10,'run-tour'));
})();
