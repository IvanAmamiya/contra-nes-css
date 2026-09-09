// SPDX-License-Identifier: GPL-3.0-or-later
// Install our read-only hook into a separately obtained Snes9x source checkout.
'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(process.argv[2]||''),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(commit!=='890b5d445538fe790aa3add3d5702c80f551e0ae')throw Error('Expected libretro/snes9x commit 890b5d4');
const file=path.join(root,'sa1cpu.cpp');let source=fs.readFileSync(file,'utf8');
if(!source.includes('#include "contra-trace-hook.h"')){
 const include='#include "cpuops.cpp"',increment='\n\t\tRegisters.PCw++;';
 if(source.split(include).length!==2||source.split(increment).length!==2)throw Error('Unexpected source layout');
 source=source.replace(include,include+'\n#include "contra-trace-hook.h"').replace(increment,'\n\t\tContraTraceInstruction(Op);'+increment);
 fs.writeFileSync(file,source);
}
fs.copyFileSync(path.join(__dirname,'trace-hook.h'),path.join(root,'contra-trace-hook.h'));
console.log('SA-1 trace hook installed. Build the private libretro core separately.');
