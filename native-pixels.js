(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ContraNativePixels=factory();})(typeof window==='undefined'?this:window,function(){
  'use strict';
  function indices(hex){const bytes=hex.match(/../g).map(x=>parseInt(x,16)),result=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)result.push(((bytes[y]>>(7-x))&1)|(((bytes[y+8]>>(7-x))&1)<<1));return result;}
  function colors(hex,palette,rgb){const pal=palette.match(/../g).map(x=>parseInt(x,16));return indices(hex).map(i=>pal[i]===255?'#00000000':rgb[pal[i]&63]+'ff');}
  function css(hex,palette,rgb){const pixels=colors(hex,palette,rgb),rows=[];for(let y=0;y<8;y++){const stops=[];for(let x=0;x<8;x++)stops.push(`${pixels[y*8+x]} ${x}px ${x+1}px`);rows.push(`linear-gradient(90deg,${stops.join(',')},${pixels[y*8+7]} 8px) 0px ${y}px/8px 1px no-repeat`);}return rows.join(',');}
  return{indices,colors,css};
});
