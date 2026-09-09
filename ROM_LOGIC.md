# Contra III 逻辑逆向记录 · v2.1.1

已经完成 **局部反汇编与运行追踪**，能把实际执行的指令、实体状态和逐帧位置连起来。尚未完成全游戏反编译，也没有得到可重新编译原 ROM 的完整源工程。

图形解包只产生图块、布局、调色板和精灵；原始游戏逻辑保存在 ROM 的机器指令与数据表中，需要另外逆向。[SNESTilesKitten](https://github.com/Skarsnik/SNESTilesKitten) 是图形处理工具。[SA1-Root](https://github.com/VitorVilela7/SA1-Root/blob/master/Contra-III/README.md) 提供优化补丁与地址重映射线索，不能视为 Contra III 全部源码。本轮公开仓库检索未找到完整、已注释的 Contra III 反汇编工程。

## 基线与实际输出

- 本地 SA-1 修改版 ROM，SHA-256：`44ebb9a450b5b77341fc9130ab45767a13212c242350aad450a4526f8a8d8017`。这些地址和测量不能直接推广至所有原版美、日、欧 ROM。
- [libretro/snes9x](https://github.com/libretro/snes9x/tree/890b5d445538fe790aa3add3d5702c80f551e0ae)，提交 `890b5d445538fe790aa3add3d5702c80f551e0ae`。在 SA-1 指令执行前加入只读记录点；没有修改寄存器或模拟 RAM。
- 每条记录包含帧号、PC、操作码、P/A/X/Y/D/DB、对象类型/状态、镜头与脚底坐标。按 P 的 M/X 位确定立即数宽度，再对照固定哈希的 ROM 字节解码；不沿着未知数据表盲目线性反汇编。
- 公开的小型证据：[rom-logic.json](assets/rom-logic.json)。它保留运行/输入/状态哈希、状态转移与少量指令。完整 ROM、CPU 日志、RAM、快照和 DLL 留在私有工作目录。

| 实验 | 帧数 | 记录指令数 | 去重的地址/宽度组合 | 结果 |
|---|---:|---:|---:|---|
| 金属台阶 | 160 | 136,927 | 845 | 定位平台判定与落地对齐，111 帧 JS 位置对照零差异 |
| 第一堵墙 | 240 | 94,906 | 330 | 核心死亡、部件停用、破坏状态推进与对象移除 |
| 可驾驶坦克 | 360 | 91,503 | 356 | 上车判定、驾驶员登记与坦克状态切换 |

三份日志均未达到 500,000 条截断上限。这里是 **按对象筛选的 SA-1 日志**：X 暂时用于查表的指令会被过滤，不构成完整调用图；尚未记录主 CPU、SPC 音频 CPU 和 DMA 的全部执行。

追踪器对照：同一台阶存档和 160 帧输入，用未修改核心与加记录点核心各跑一次。采集到的 1,310,720 字节 BW-RAM 完全相同，零差异；RAM 哈希与两份核心哈希记录在证据 JSON。此结论覆盖本段实验，不能推广为所有状态都已验证。

## 已确认的位置

以下为 CPU 地址。当前基线的低 bank LoROM 窗口按 `(bank & 0x7F) * 0x8000 + (address & 0x7FFF)` 映射；工具拒绝猜测 SA-1 可编程高 bank 和 RAM 映射。

| 地址 | 运行证据 | 对重建的用途 |
|---|---|---|
| `$00:E16E` 起 | 从实体坐标和采样偏移查询碰撞表 | 找到场景碰撞的实际入口 |
| `$01:857A`、`$01:85D0` | 第 94、128 帧，平台分支输入 `A=$0004` | 金属平台既可攀附，也可落脚 |
| `$01:93DB` 起 | 按 8 像素格对齐物理脚底，清除竖直运动量 | 修正落地采样和对齐 |
| `$01:C5E1–C5F6` | 核心 HP 变负后，给三组墙体部件写入 `$8000` 标志，推进状态 | 确认墙体死亡不是单独隐藏图片 |
| `$01:C5F9`、`$01:C629`、`$01:C637` 起 | 墙对象依次进入状态 3、4、5，之后移除 | 为后续分阶段爆炸与背景刷新提供入口 |
| `$01:B9DE–BA45` | 检查顶部接触和玩家横坐标，登记驾驶员 | 确认上车使用碰撞条件 |
| `$01:BA28–BA2E` | 写玩家状态 9，坦克状态从 1 递增为 2 | 确认坦克和人物是互相关联的状态机 |

台阶实测：以第 48 帧的落地状态初始化；第 60 帧跳跃，第 94 帧落在脚底 y=144 的平台；第 105 帧再次跳跃，第 128 帧落在 y=72 的平台。第 49–159 帧，共 **111 帧横坐标、脚底坐标精确相同**。测试只调用玩家与碰撞更新，不把 NPC、受击框或全场景行为包含在这个等价结论里。

坦克实测：第 40 帧坦克进入状态 2，玩家进入状态 9；第 60 帧跳跃后玩家回到状态 3、坦克回到状态 1。尚未完成驾驶速度、炮弹、受损/爆炸和全部动作的验证与游戏接入。

墙体实测：第 90 帧停用核心和炮口部件，第 91 帧进入破坏状态，第 103 帧推进至后续状态，第 201 帧移除墙对象。周围实体在这段过程中仍有活动，不能把“死亡当帧清空所有敌人”声称为已经证明的原版行为。

## 本次游戏修复与边界

- `0x0004` 金属台阶接入落脚碰撞，可跳上、站立、下穿；保留攀附。
- 实体柱体增加侧面与底面阻挡，玩家可沿侧面向上攀爬到柱顶。攀爬速度和姿势属于当前适配，未声明逐帧等价；斜坡轮廓仍近似。
- 按用户要求，小 Boss 击破时立即清除附近敌兵和敌弹，并短暂停止新刷兵。保留补给和远处对象；此即时清场是本项目选择，原版破坏过渡还需继续移植。
- 城市玩家恢复原来的 FC/NES 人物及相应尺寸，跑动、跳跃、趴下、攀附使用 FC 精灵；护罩与枪口随之对齐。此处有意保留 FC 人物，不宣称原 SFC 受击框等价。

**仍未完成：**可驾驶坦克、火场机关、榴弹坦克中 Boss、关底 Boss 完整动画，以及工厂/巢穴同规格重建。定位某个汇编入口不等于完成该机制。全套音乐、双人和俯视关仍在既有未完成范围内。

## 复现实验

在私有目录取得上面指定版本的 Snes9x 源码，使用工具安装记录点，再构建 Windows libretro 核心：

```powershell
node tools/snes/install-trace.cjs PRIVATE_SNES9X_CHECKOUT
mingw32-make -C PRIVATE_SNES9X_CHECKOUT/libretro -j 6 platform=win LTO= CC=gcc CXX=g++
gcc -O2 -I PRIVATE_LIBRETRO_HEADERS tools/snes/probe.c -o PRIVATE_RUNTIME/probe.exe
```

将生成的 `snes9x_libretro.dll` 放入该私有运行目录。`CONTRA_LOAD_STATE`、`CONTRA_INPUT` 在切换输出目录前解析；`CONTRA_CPU_TRACE` 在 `CONTRA_OUT` 中创建。环境路径优先使用相对 ASCII 路径，避免 Windows C 运行库的路径编码差异。

台阶输入 CSV（结束帧不包含；后面的行覆盖前面的行）：

```csv
0,48,130
48,100,2
60,61,3
100,160,130
105,106,131
```

位掩码：Y 射击为 2、右为 128、B 跳跃为 1。加载既有 `city-walk/state-480.bin`，设置 `CONTRA_FRAMES=160`、`CONTRA_DUMP_EVERY=8`、`CONTRA_TRACE_RAM=1`、`CONTRA_CPU_TRACE=cpu.csv`、`CONTRA_TRACE_ACTOR=254`、`CONTRA_TRACE_LAST=159`，输出到 `trace-stairs-landing`。254 是工具表示玩家的筛选值，不是 ROM 原对象类型。

墙与坦克分别加载 `city-later/state-1080.bin`、`state-1440.bin`，使用 4、9 作为对象筛选；输入和起始状态哈希见公开证据 JSON。这些实验不设置 `CONTRA_TIMER_HOLD` 或 `CONTRA_GUN`；加载的探索状态可能带有先前授予的保护，不把它当成无干预完整通关。

追踪器对照需要同一 `probe.c` 另配未修改核心，放在 `cpu-control-runtime`；相同台阶输入输出到 `trace-stairs-control`，不开启 CPU 日志。证据生成器检查这两份逐帧 RAM 相同后才输出。安装脚本已在干净的指定版本源码上验证，并检查重复运行不重复插入记录点。

```powershell
node tools/snes/trace-disassemble.cjs ROM_PATH PRIVATE_RUN/cpu.csv PRIVATE_RUN/executed.json
node tools/snes/logic-reference.cjs PRIVATE_WORK tests/fixtures/city-logic-reference.json
node tools/snes/logic-evidence.cjs PRIVATE_WORK assets/rom-logic.json
node --test tests/*.test.cjs
```

反汇编工具的操作码/寻址表来自 GPL-3.0 的 [MesenCE](https://github.com/nesdev-org/MesenCE/blob/c6cea79f36afd33954fde6174418b3d944d0da88/Core/SNES/Debugger/SnesDisUtils.cpp)，工具目录保留同许可。这些构建/分析工具不在网页中运行；游戏仍是 JavaScript 与纯 DOM/CSS。

## 本轮验证

260 项自动测试通过，包含 111 帧台阶独立对照、平台下穿、柱体攀爬、小 Boss 死亡当帧残留敌弹保护、FC 人物姿势及反汇编宽度/分支边界检查。浏览器三关各 10 次，共 30/30 次通关通过。

本机 600 帧渲染测试：57.8 FPS，绘制 P95 为 0.50 ms，最多 167 个 DOM 节点，Canvas/图片节点/位图请求均为 0。通关和性能测试用于验证可玩性与回归，不证明所有 SFC 行为已经还原。
