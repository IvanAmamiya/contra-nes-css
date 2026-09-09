#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "libretro.h"
static unsigned frame,pixel_format,dump_every=60; static uint16_t keys;
static int scripted;static uint16_t script[120000];
static bool env(unsigned cmd,void*data){switch(cmd){
 case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:pixel_format=*(unsigned*)data;return true;
 case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:*(const char**)data=".";return true;
 case RETRO_ENVIRONMENT_GET_CAN_DUPE:*(bool*)data=true;return true;
 case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE:*(bool*)data=false;return true;
 case RETRO_ENVIRONMENT_GET_INPUT_BITMASKS:return true;
 case RETRO_ENVIRONMENT_GET_LANGUAGE:*(unsigned*)data=RETRO_LANGUAGE_ENGLISH;return true;
 case RETRO_ENVIRONMENT_GET_AUDIO_VIDEO_ENABLE:*(int*)data=3;return true;
 default:return false;}}
static void dump(const char *name,void*data,size_t len){FILE*f=fopen(name,"wb");if(!f)exit(5);fwrite(data,1,len,f);fclose(f);}
static void video(const void*data,unsigned w,unsigned h,size_t pitch){
 if(!data||frame%120)return;char name[80];sprintf(name,"frame-%04u.ppm",frame);FILE*f=fopen(name,"wb");fprintf(f,"P6\n%u %u\n255\n",w,h);
 for(unsigned y=0;y<h;y++)for(unsigned x=0;x<w;x++){unsigned char c[3];unsigned p=pixel_format==1?*(uint32_t*)((char*)data+y*pitch+x*4):*(uint16_t*)((char*)data+y*pitch+x*2);
  if(pixel_format==1){c[0]=p>>16;c[1]=p>>8;c[2]=p;}else{c[0]=((p>>(pixel_format==2?11:10))&31)*255/31;c[1]=((p>>5)&(pixel_format==2?63:31))*255/(pixel_format==2?63:31);c[2]=(p&31)*255/31;}fwrite(c,1,3,f);
 }fclose(f);
}
static void audio(int16_t a,int16_t b){} static size_t audio_batch(const int16_t*d,size_t n){return n;}
static void poll(void){} static int16_t input(unsigned port,unsigned device,unsigned idx,unsigned id){if(port)return 0;return id==RETRO_DEVICE_ID_JOYPAD_MASK?keys:((keys>>id)&1);}
#define FN(ret,name,args) ret (*name)args=(void*)GetProcAddress(lib,#name);if(!name)return 3
int main(int argc,char**argv){if(argc<2)return 2;HMODULE lib=LoadLibraryA("snes9x_libretro.dll");if(!lib){printf("dll error %lu",GetLastError());return 3;}
 FN(void,retro_set_environment,(retro_environment_t));FN(void,retro_set_video_refresh,(retro_video_refresh_t));FN(void,retro_set_audio_sample,(retro_audio_sample_t));FN(void,retro_set_audio_sample_batch,(retro_audio_sample_batch_t));FN(void,retro_set_input_poll,(retro_input_poll_t));FN(void,retro_set_input_state,(retro_input_state_t));FN(void,retro_init,(void));FN(void,retro_deinit,(void));FN(void,retro_get_system_info,(struct retro_system_info*));FN(bool,retro_load_game,(const struct retro_game_info*));FN(void,retro_run,(void));FN(void*,retro_get_memory_data,(unsigned));FN(size_t,retro_get_memory_size,(unsigned));FN(size_t,retro_serialize_size,(void));FN(bool,retro_serialize,(void*,size_t));FN(bool,retro_unserialize,(const void*,size_t));
 retro_set_environment(env);retro_set_video_refresh(video);retro_set_audio_sample(audio);retro_set_audio_sample_batch(audio_batch);retro_set_input_poll(poll);retro_set_input_state(input);retro_init();
 struct retro_system_info info;retro_get_system_info(&info);printf("%s %s\n",info.library_name,info.library_version);
 FILE*f=fopen(argv[1],"rb");if(!f)return 4;fseek(f,0,SEEK_END);long n=ftell(f);rewind(f);void*r=malloc(n);fread(r,1,n,f);fclose(f);struct retro_game_info game={argv[1],r,n,NULL};if(!retro_load_game(&game))return 4;
 const char*load=getenv("CONTRA_LOAD_STATE");if(load){f=fopen(load,"rb");if(!f)return 6;fseek(f,0,SEEK_END);long len=ftell(f);rewind(f);void*b=malloc(len);fread(b,1,len,f);fclose(f);if(!retro_unserialize(b,len))return 7;free(b);}
 const char*inputs=getenv("CONTRA_INPUT");if(inputs){f=fopen(inputs,"r");if(!f)return 8;unsigned a,b,k;while(fscanf(f,"%u,%u,%u\n",&a,&b,&k)==3){if(b>120000||a>b)return 8;for(unsigned j=a;j<b;j++)script[j]=k;}fclose(f);scripted=1;}
 unsigned frames=getenv("CONTRA_FRAMES")?atoi(getenv("CONTRA_FRAMES")):3000;if(frames>120000)return 8;
 if(getenv("CONTRA_DUMP_EVERY"))dump_every=atoi(getenv("CONTRA_DUMP_EVERY"));
 if(getenv("CONTRA_OUT")&&!SetCurrentDirectoryA(getenv("CONTRA_OUT")))return 9;
 FILE*trace=fopen("trace.csv","w"),*ram=getenv("CONTRA_TRACE_RAM")?fopen("ram-frames.bin","wb"):NULL;if(!trace)return 5;fprintf(trace,"frame,flags,timer,lives,x,y,stage\n");
 for(frame=0;frame<frames;frame++){
  keys=(frame==120||frame==240||frame==360)?1<<RETRO_DEVICE_ID_JOYPAD_START:0;
  if(frame>=950&&frame<1080)keys=(1<<RETRO_DEVICE_ID_JOYPAD_RIGHT)|(1<<RETRO_DEVICE_ID_JOYPAD_Y);
  if(frame>=800&&frame<950||frame>=1080)keys=1<<RETRO_DEVICE_ID_JOYPAD_Y;
  if(scripted)keys=script[frame];
  unsigned char*m=retro_get_memory_data(RETRO_MEMORY_SAVE_RAM);
  if(argc>2&&strcmp(argv[2],"barrier-timer-experiment")==0&&frame==1200){m[0x1f88]=0;m[0x1f89]=2;}
  /* Explicit, opt-in laboratory interventions. Never written back to the ROM. */
  if(getenv("CONTRA_TIMER_HOLD")){m[0x1f88]=0;m[0x1f89]=2;}
  if(getenv("CONTRA_GUN")){m[0x1f84]=atoi(getenv("CONTRA_GUN"));m[0x1f85]=0;}
  retro_run();
  if(ram&&m)fwrite(m,1,0x2000,ram);
  if(m)fprintf(trace,"%u,%u,%u,%u,%u,%u,%u\n",frame,m[0x216],m[0x1f88]|m[0x1f89]<<8,m[0x1f8a],m[0x206]|m[0x207]<<8,m[0x210]|m[0x211]<<8,m[0x86]);
  if(dump_every&&(load||frame>=600)&&frame%dump_every==0){char name[50];sprintf(name,"vram-%u.bin",frame);dump(name,retro_get_memory_data(RETRO_MEMORY_VIDEO_RAM),retro_get_memory_size(RETRO_MEMORY_VIDEO_RAM));size_t s=retro_serialize_size();void*b=malloc(s);if(retro_serialize(b,s)){sprintf(name,"state-%u.bin",frame);dump(name,b,s);}free(b);}
 }fclose(trace);if(ram)fclose(ram);retro_deinit();free(r);return 0;}
