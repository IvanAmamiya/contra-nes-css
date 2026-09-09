'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function decodeBRR(bytes){
 if((bytes.length-2)%9)throw Error('Expected BRR with a two-byte loop header');
 const samples=[];let p1=0,p2=0;
 for(let offset=2;offset<bytes.length;offset+=9){const header=bytes[offset],range=header>>4,filter=(header>>2)&3;
  for(let i=0;i<16;i++){let n=(bytes[offset+1+(i>>1)]>>(i%2?0:4))&15;if(n>=8)n-=16;let s=range<=12?(n<<range)>>1:n<0?-2048:0;
   if(filter===1)s+=p1+(-p1>>4);
   if(filter===2)s+=(p1<<1)+(-(p1*3)>>5)-p2+(p2>>4);
   if(filter===3)s+=(p1<<1)+(-(p1*13)>>6)-p2+((p2*3)>>4);
   s=Math.max(-32768,Math.min(32767,s));s=(s<<17)>>17;p2=p1;p1=s;samples.push(s*2/32768);
  }if(header&1)break;
 }return samples;
}
// NES-inspired 1-bit delta / 7-bit DAC conversion. The browser plays the decoded result.
function toDelta(pcm,rate=16000,maxSeconds=.32){const length=Math.min(Math.floor(pcm.length*rate/32000),Math.round(rate*maxSeconds));let dac=64;const data=[];for(let i=0;i<length;i++){const sample=pcm[Math.floor(i*32000/rate)]||0,target=64+sample*55;dac=Math.max(0,Math.min(127,dac+(target>=dac?2:-2)));data.push(dac);}return data;}
function build(){const root=path.resolve(__dirname,'..'),source=path.join(root,'assets/audio-source');const records={},samples={};for(const[id,file]of Object.entries({kick:'Kick Drum.brr',snare:'Snare Drum.brr',noise:'Noise.brr',death:'Death Scream SFX.brr'})){const bytes=fs.readFileSync(path.join(source,file)),pcm=decodeBRR(bytes);samples[id]={rate:16000,data:toDelta(pcm,16000,id==='death'?.28:.2)};records[id]={file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),decodedSamples:pcm.length,outputSamples:samples[id].data.length};}
 const attribution={source:'https://www.smwcentral.net/?p=section&a=details&id=39178',archive:'https://dl.smwcentral.net/39178/Contra%20III%20-%20The%20Alien%20Wars.zip',uploader:'brickblock369',game:'Contra III: The Alien Wars / Konami',conversion:'BRR decode → 16 kHz mono → 1-bit delta, 7-bit DAC; short instruments only',music:'Original FC-style sequences; not the original soundtrack',records};
 fs.writeFileSync(path.join(root,'assets/spirits-audio.json'),JSON.stringify(attribution,null,2));fs.writeFileSync(path.join(root,'assets/spirits-audio.js'),'window.SpiritsSamples='+JSON.stringify({samples,attribution})+';\n');console.log('Converted four Contra III BRR samples into FC-style delta audio.');}
if(require.main===module)build();module.exports={decodeBRR,toDelta};
