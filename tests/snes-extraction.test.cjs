'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {unpack,decodeTiles}=require('../tools/snes/konami.cjs');
const stream=(...data)=>{const b=Buffer.from([data.length+2,0,...data]);return b;};
test('Contra SNES A0-BF is zero-prefixed literals, not Genesis raw or a repeated pair',()=>{
 assert.deepEqual([...unpack(stream(0xa1,0x12,0x34,0x56),0).bytes],[0,0x12,0,0x34,0,0x56]);
});
test('Contra header includes itself; FF is 33 zero bytes; LZ overlaps ring history',()=>{
 assert.equal(unpack(stream(0xff),0).bytes.length,33);
 assert.deepEqual([...unpack(stream(0x82,0x12,0x34,0x0b,0xdf),0).bytes],[0x12,0x34,0x12,0x34,0x12,0x34]);
 assert.equal(unpack(stream(0xc2,0x55),0).bytes.toString('hex'),'55555555');
});
test('Truncated/oversized commands and unsupported interleave fail instead of emitting corrupt art',()=>{
 for(const b of [Buffer.from([99,0]),stream(0xa0,1),stream(0x83,1),stream(0),Buffer.from([2,128])])assert.throws(()=>unpack(b,0));
 assert.throws(()=>decodeTiles(Buffer.alloc(31)));
});
test('Planar channels preserve significance and pixel direction in 2/4bpp tiles',()=>{
 const b=Buffer.alloc(32);b[0]=0x80;b[1]=0x40;b[16]=0x20;b[17]=0x10;
 assert.deepEqual([...decodeTiles(b).subarray(0,8)],[1,2,4,8,0,0,0,0]);
 assert.deepEqual([...decodeTiles(b.subarray(0,16),2).subarray(0,8)],[1,2,0,0,0,0,0,0]);
});
