/* Test driver: observes state and emits ordinary controls, never edits a game entity. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SpiritsPilot=factory();})(typeof window!=='undefined'?window:this,function(){return class Pilot{
 constructor(){this.lastJump=false;this.frames=0;}
 next(w){this.frames++;const p=w.player,input={right:true,fire:true};
  if(p.respawnTimer)return{};
  if(w.level.data.rom&&!w.boss.activated){
   if(p.clinging){input.right=true;input.down=false;if(p.clinging.type==='wall')input.up=true;else input.jump=p.cx>p.clinging.x+p.clinging.w-12&&!this.lastJump;}
   else if(p.touchingWall)input.up=true;
   else if(p.grounded&&!this.lastJump){const foot=p.y+p.h,edge=p.support&&p.support.x+p.support.w-p.cx<8,higher=w.level.platforms.some(t=>t.x+t.w>p.cx+6&&t.x<p.cx+14&&t.y<foot-8&&t.y>=foot-68);input.jump=!!(edge||higher);}
   else if(!p.grounded&&w.level.grips.some(g=>g.x+g.w>p.cx&&g.x<p.cx+12&&g.y>p.y-8&&g.y<p.y+p.h))input.up=true;
   this.lastJump=!!input.jump;return input;
  }
  if(w.boss.activated&&p.cx>w.camera+100){input.right=false;const target=w.boss.parts.find(b=>b.alive);if(target){const dy=target.cy-(p.y+11),dx=target.cx-p.cx;if(dy<-dx*.45){input.up=true;input.right=true;input.lock=true;}
   if(p.weapon.code==='F'&&dx>66)input.swap=!p.wasSwap;
   if(p.grounded&&!this.lastJump&&this.frames%90<3)input.jump=true;
   if(p.bombs&&w.boss.parts.some(b=>b.alive&&b.hp<b.maxHp*.65))input.bomb=!p.wasBomb;
  }}else if(p.grounded&&!this.lastJump){const foot=p.y+p.h,higher=w.level.platforms.some(t=>t.active&&t.x+t.w>p.cx+4&&t.x<p.cx+28&&t.y<foot-5&&t.y>=foot-59),edge=p.support&&p.support.x+p.support.w-p.cx<22,danger=w.enemies.some(e=>e.alive&&e.x-p.x>0&&e.x-p.x<26&&Math.abs(e.y-p.y)<28);input.jump=!!(higher||edge||danger);}
  this.lastJump=!!input.jump;return input;
 }
};});
