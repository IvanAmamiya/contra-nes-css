'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{decode,romOffset}=require('../tools/snes/trace-disassemble.cjs');
test('65C816 运行标志决定 M/X 立即数宽度，不能线性猜测',()=>{
 const r=Buffer.alloc(0x10000);r.set([0xa9,0x34,0x12],0x8000);r.set([0xa2,0x78,0x56],0x8010);
 assert.equal(decode(r,0x018000,0).operand,'#$1234');assert.equal(decode(r,0x018000,32).operand,'#$34');
 assert.equal(decode(r,0x018010,32).operand,'#$5678');assert.equal(decode(r,0x018010,16).operand,'#$78');
});
test('分支按 CPU 地址及有符号偏移解码，短分支不跨 bank',()=>{
 const r=Buffer.alloc(0x10000);r.set([0xd0,0xfc],0x8010);r.set([0x82,0xfc,0xff],0x8020);
 assert.equal(decode(r,0x018010,0).operand,'$01800E');assert.equal(decode(r,0x018020,0).operand,'$01801F');
 r.set([0x54,0x40,0x05],0x8030);assert.equal(decode(r,0x018030,0).operand,'$05,$40');
});
test('未知 SA-1 可编程映射、RAM、越界字节明确拒绝',()=>{
 assert.equal(romOffset(0x01ba28),0xba28);assert.throws(()=>romOffset(0x406000),/Unmapped/);assert.throws(()=>romOffset(0xc00000),/Unmapped/);
 assert.throws(()=>decode(Buffer.alloc(8),0x018000,0),/Truncated/);
});
