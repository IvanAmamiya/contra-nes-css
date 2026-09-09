(function(){
  'use strict';
  const $=id=>document.getElementById(id),assets=window.ContraAssets,bg=window.ContraBackgrounds;
  function list(){
    const query=$('asset-search').value.toLowerCase().trim(),entries=Object.entries(assets.assets).filter(([id])=>id.includes(query));
    $('asset-count').textContent=`${assets.sourceFiles} 个文件 / ${assets.frameCount} 帧 · 显示 ${entries.length} 个`;
    const fragment=document.createDocumentFragment();
    for(const[id,a]of entries){const card=document.createElement('figure');card.className='sprite-card';card.dataset.asset=id;const view=document.createElement('div');view.className='sprite-view';const holder=document.createElement('div');holder.className='sprite-holder';holder.style.width=a.width+'px';holder.style.height=a.height+'px';const art=document.createElement('div');art.className=`nes-art art-${id}`;art.setAttribute('aria-hidden','true');holder.appendChild(art);view.appendChild(holder);card.appendChild(view);const caption=document.createElement('figcaption');caption.textContent=`${id} · ${a.width}×${a.height}${a.frames.length>1?' · 4 帧动画':''}`;card.appendChild(caption);fragment.appendChild(card);}
    $('sprite-grid').replaceChildren(fragment);
  }
  $('asset-search').addEventListener('input',list);list();
  for(let i=1;i<=8;i++)for(const suffix of ['', '-title']){const option=document.createElement('option');option.value=`stage-${i}${suffix}`;option.textContent=`第 ${i} 关 · ${suffix?'关卡缩略图':'完整背景地图'}`;$('map-select').appendChild(option);}
  const objects=document.createElement('option');objects.value='stage-1-objects';objects.textContent='第一关 · 对象定位图';$('map-select').appendChild(objects);
  function draw(){const id=$('map-select').value,map=bg.maps[id],x=Number($('map-x').value),y=Number($('map-y').value);const w=Math.min(256,map.width-x),h=Math.min(224,map.height-y);$('map-frame').replaceChildren(window.ContraCssTiles.region(id,x,y,w,h));$('map-status').textContent=`${map.width} × ${map.height} 原始像素 · X ${x} / Y ${y}`;}
  function choose(){const id=$('map-select').value,map=bg.maps[id];$('map-x').max=Math.max(0,map.width-256);$('map-y').max=Math.max(0,map.height-224);$('map-x').value=id.endsWith('title')?0:Math.min(512,map.width-256);$('map-y').value=0;draw();}
  $('map-select').addEventListener('change',choose);$('map-x').addEventListener('input',draw);$('map-y').addEventListener('input',draw);$('map-credit').addEventListener('click',()=>{$('map-x').value=0;$('map-y').value=0;draw();});
  const resize=()=>{const width=$('map-preview').getBoundingClientRect().width-2;$('map-frame').style.transform=`scale(${width/256})`;};new ResizeObserver(resize).observe($('map-preview'));resize();choose();
  const native=window.ContraNativeTiles;let page=0;const perPage=128;
  function nativePage(){const total=Math.ceil(native.pairCount/perPage),fragment=document.createDocumentFragment();for(let i=page*perPage;i<Math.min(native.pairCount,(page+1)*perPage);i++){const p=native.pairs[i],card=document.createElement('div');card.className='native-card';const art=document.createElement('div');art.className='native-pixel';art.style.background=window.ContraNativePixels.css(native.patterns[p.pattern],p.palette,native.rgb);card.appendChild(art);const caption=document.createElement('small');caption.textContent=`${i} · ${p.palette}`;card.appendChild(caption);fragment.appendChild(card);}$('native-grid').replaceChildren(fragment);$('native-status').textContent=`${native.patternCount} 种图案 / ${native.pairCount} 种配色组合 · ${page+1}/${total} 页`;$('native-prev').disabled=page===0;$('native-next').disabled=page===total-1;}
  $('native-prev').addEventListener('click',()=>{page--;nativePage();});$('native-next').addEventListener('click',()=>{page++;nativePage();});nativePage();
})();
