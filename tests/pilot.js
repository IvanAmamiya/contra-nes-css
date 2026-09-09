/* 端到端测试驾驶员：只读状态，输出正常按键，不改坐标、生命、武器或敌人。 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ContraPilot=factory();})(typeof window!=='undefined'?window:this,function(){
  return class Pilot {
    constructor(){this.lastJump=false;}
    next(world){
      const p=world.player,foot=p.y+p.h;
      const input={right:true,turbo:true};
      if(p.cx>world.boss.x-32){input.right=false;input.down=p.grounded;this.lastJump=false;return input;}
      if(p.grounded&&!p.respawnTimer&&!this.lastJump){
        const higher=world.level.platforms.some(t=>t.active&&t.x+t.w>p.cx+4&&t.x<p.cx+31&&t.y<foot-5&&t.y>=foot-59);
        const edge=p.support&&p.support.x+p.support.w-p.cx<18;
        const danger=world.enemies.some(e=>e.alive&&e.kind==='runner'&&e.x-p.x<28&&e.x>p.x&&Math.abs(e.y-p.y)<28);
        input.jump=!!(higher||edge||danger);
      }
      this.lastJump=!!input.jump;
      return input;
    }
  };
});
