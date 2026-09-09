/* Read-only instruction tracing for libretro/snes9x commit 890b5d4.
 * Include after cpuops.cpp in sa1cpu.cpp; call ContraTraceInstruction(Op)
 * immediately before Registers.PCw++. No register or emulated RAM writes.
 */
#include <stdio.h>
#include <stdlib.h>
static unsigned contraFrame,contraRows;
static FILE *contraTrace;
static bool contraTraceInitialized;
static unsigned contraFirst,contraLast=120000,contraActor=0xffff,contraLimit=500000;
extern "C" __declspec(dllexport) void retro_contra_trace_frame(unsigned frame){contraFrame=frame;}
static void ContraTraceInstruction(unsigned opcode){
 if(!contraTraceInitialized){
  contraTraceInitialized=true;
  const char *file=getenv("CONTRA_CPU_TRACE");if(!file)return;
  contraTrace=fopen(file,"w");if(!contraTrace)return;
  if(getenv("CONTRA_TRACE_FIRST"))contraFirst=atoi(getenv("CONTRA_TRACE_FIRST"));
  if(getenv("CONTRA_TRACE_LAST"))contraLast=atoi(getenv("CONTRA_TRACE_LAST"));
  if(getenv("CONTRA_TRACE_ACTOR"))contraActor=atoi(getenv("CONTRA_TRACE_ACTOR"));
  fprintf(contraTrace,"frame,pc,opcode,p,a,x,y,d,db,actor,state,camera,feet\n");
 }
 if(!contraTrace||contraFrame<contraFirst||contraFrame>contraLast||contraRows>=contraLimit)return;
 unsigned x=SA1Registers.X.W,actor=0xffff,state=0;
 if(SA1Registers.D.W==0x6000&&x>=0x200&&x<0xac0&&(x&63)==0){
  actor=x<0x280?254:(Memory.SRAM[x+16]|Memory.SRAM[x+17]<<8);
  state=Memory.SRAM[x+18]|Memory.SRAM[x+19]<<8;
 }
 if(contraActor!=0xffff&&actor!=contraActor)return;
 unsigned p=(SA1Registers.PL&~0xc3)|(SA1._Carry?1:0)|(SA1._Zero==0?2:0)|(SA1._Overflow?64:0)|(SA1._Negative&128);
 fprintf(contraTrace,"%u,%06X,%02X,%02X,%04X,%04X,%04X,%04X,%02X,%u,%u,%u,%u\n",contraFrame,SA1Registers.PBPC,opcode,p,SA1Registers.A.W,x,SA1Registers.Y.W,SA1Registers.D.W,SA1Registers.DB,actor,state,Memory.SRAM[0x1380]|Memory.SRAM[0x1381]<<8,Memory.SRAM[0x20e]|Memory.SRAM[0x20f]<<8);
 if(++contraRows==contraLimit)fflush(contraTrace);
}
