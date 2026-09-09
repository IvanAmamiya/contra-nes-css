'use strict';
// Build-time only. The game itself loads CSS, never raster images.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function visibleHash(data) { const b=Buffer.from(data);for(let i=0;i<b.length;i+=4)if(!b[i+3])b.fill(0,i,i+4);return sha(b); }
function pixelBackground(data) { return `#${Buffer.from(data.subarray(0,4)).toString('hex')}`; }
function pixelGradients(data,w,h,opaqueOverlap=false){
  const rows=[];
  for(let y=0;y<h;y++){const runs=[];let start=0,last='';for(let x=0;x<=w;x++){const color=x===w?'':Buffer.from(data.subarray((y*w+x)*4,(y*w+x)*4+4)).toString('hex');if(x&&color!==last){runs.push(`#${last} ${start}px ${x}px`);start=x;}if(x<w)last=color;}rows.push(`linear-gradient(90deg,${runs.join(',')},#${last} ${w}px) 0px ${y}px/${w}px ${opaqueOverlap?2:1}px no-repeat`);}
  // Lower opaque rows cover the overlap from the row above. Same pixels, no scaling seams.
  return (opaqueOverlap?rows.reverse():rows).join(',');
}
function pixelShadows(data, width, height) {
  const result = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (i && data[i + 3]) result.push(`${x}px ${y}px #${Buffer.from(data.subarray(i, i + 4)).toString('hex')}`);
  }
  return result.join(',') || 'none';
}
async function build() {
  const files = fs.readdirSync(path.join(root, 'assets/source')).filter(n => /\.(png|gif)$/.test(n)).sort();
  const css = ['/* Generated losslessly from the reference sprite library. See ATTRIBUTION.md. */', '.nes-art{position:absolute;display:block;pointer-events:none;transform-origin:0 0}.nes-art::before{content:"";position:absolute;left:0;top:0;width:1px;height:1px;background:transparent}'];
  const assets = {};
  const fast=['/* Same source pixels, rendered as CSS hard-stop row gradients. */','.nes-art{position:absolute;display:block;pointer-events:none;transform-origin:0 0}.nes-art::before{display:none}'];
  for (const file of files) {
    const id = path.parse(file).name.replace(/[^a-zA-Z0-9_-]/g,'_'), input = fs.readFileSync(path.join(root, 'assets/source', file));
    const meta = await sharp(input, { animated: true }).metadata();
    const { data, info } = await sharp(input, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const count = meta.pages || 1, height = info.height / count, size = info.width * height * 4;
    const frames = [], shadows = [], backgrounds=[],gradients=[];
    for (let f = 0; f < count; f++) {
      const pixels = data.subarray(f * size, (f + 1) * size), key = `${id}${count > 1 ? `-f${f}` : ''}`;
      const shadow = pixelShadows(pixels, info.width, height); shadows.push(shadow);
      const background=pixelBackground(pixels);backgrounds.push(background);
      const gradient=pixelGradients(pixels,info.width,height);gradients.push(gradient);fast.push(`.art-${key}{width:${info.width}px;height:${height}px;background:${gradient}}`);
      css.push(`.art-${key}{width:${info.width}px;height:${height}px}.art-${key}::before{background:${background};box-shadow:${shadow}}`);
      frames.push({ key, duration: meta.delay?.[f] || 0, rgbaSha256: sha(pixels), visibleRgbaSha256:visibleHash(pixels) });
    }
    if (count > 1) {
      const duration = frames.reduce((n, f) => n + (f.duration || 100), 0); let elapsed = 0;
      css.push(`.art-${id}{width:${info.width}px;height:${height}px}.art-${id}::before{animation:art-${id} ${duration}ms steps(1,end) infinite}`);
      css.push(`@keyframes art-${id}{${frames.map((f, i) => { const rule = `${100 * elapsed / duration}%{background:${backgrounds[i]};box-shadow:${shadows[i]}}`; elapsed += f.duration || 100; return rule; }).join('')}100%{background:${backgrounds[0]};box-shadow:${shadows[0]}}}`);
      elapsed=0;fast.push(`.art-${id}{width:${info.width}px;height:${height}px;animation:fast-${id} ${duration}ms steps(1,end) infinite}@keyframes fast-${id}{${frames.map((f,i)=>{const rule=`${100*elapsed/duration}%{background:${gradients[i]}}`;elapsed+=f.duration||100;return rule;}).join('')}100%{background:${gradients[0]}}}`);
    }
    assets[id] = { file, width: info.width, height, sourceSha256: sha(input), frames };
  }
  const manifest = { version: 1, source: 'https://github.com/vermiceli/nes-contra-us', commit: '687d651c021fd7020f10d05b970ccb62663c94bd', sourceFiles: files.length, frameCount: Object.values(assets).reduce((n, a) => n + a.frames.length, 0), backgroundStatus: 'eight-static-maps-imported-see-backgrounds', assets };
  fs.writeFileSync(path.join(root, 'assets/nes-sprites.css'), css.join('\n'));
  fs.writeFileSync(path.join(root, 'assets/nes-sprites-fast.css'), fast.join('\n'));
  fs.writeFileSync(path.join(root, 'assets/manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(root, 'assets/manifest.js'), `window.ContraAssets=${JSON.stringify(manifest)};\n`);
  console.log(`Generated ${files.length} assets / ${manifest.frameCount} frames, ${Buffer.byteLength(css.join('\n'))} CSS bytes.`);
}
if (require.main === module) build().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { pixelShadows, pixelBackground, pixelGradients, visibleHash, build };
