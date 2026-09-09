'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
// Only this generated directory may be replaced. Never export the Git checkout.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw Error('Invalid output path');
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw Error('Output must not be a symlink');
fs.rmSync(output, { recursive: true, force: true });
const files = fs.readdirSync(root).filter(name => /\.(html|css|js|md|png)$/.test(name));
files.push('browser-test-results.json', 'css-render-performance.json', 'css-full-map-performance.json', 'test-results.txt');
files.push('spirits-browser-results.json','spirits-performance.json','spirits-audio-results.json','spirits-mobile-results.json','spirits-test-results.txt');
files.push('rom-patch-browser-results.json','rom-patch-performance.json','rom-patch-test-results.txt');
files.push('city-browser-results.json','city-performance.json','city-test-results.txt');
for (const name of fs.readdirSync(path.join(root, 'assets'))) {
  if (/\.(js|css|json|pal)$/.test(name)) files.push('assets/' + name);
}
files.push('tests/pilot.js', 'tests/browser-qa.js');
for (const name of files.sort()) {
  const destination = path.join(output, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, name), destination);
}
for (const name of files.filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(output, name), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const reference = match[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(reference)) continue;
    const target = path.resolve(output, path.dirname(name), reference.split(/[?#]/)[0]);
    if (!target.startsWith(output + path.sep) || !fs.statSync(target, { throwIfNoEntry: false })?.isFile()) {
      throw Error('Missing local reference: ' + name + ' -> ' + reference);
    }
  }
}
console.log('Static release: ' + files.length + ' files; page references verified.');
