# 与 nes-contra-us 的实现对照

参考仓库：[vermiceli/nes-contra-us](https://github.com/vermiceli/nes-contra-us/tree/687d651c021fd7020f10d05b970ccb62663c94bd)，核对提交 `687d651c021fd7020f10d05b970ccb62663c94bd`，日期 2026-09-09。

该仓库是 Contra 美版 NES 的带注释 6502 反汇编，附带图形、音频和敌人逻辑说明；它并不是可以直接放进网页的 JavaScript 游戏。其构建流程需要已有 ROM 提供缺失的图形与音频数据。本次读取代码和文档来校正规则，没有执行仓库构建脚本，也没有构建 ROM。参见 [仓库说明](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/README.md)。

## 已对齐的规则

| 主题 | 原版代码的行为 | 本版实现 |
|---|---|---|
| 射击输入 | 普通枪、F、S 看新按键；M、L 看持续按键 | `Player` 区分 `held` 与 `pressed`；J 不再统一连射 |
| 普通枪 | 同时最多四颗子弹，没有通用的 100 ms 开火冷却 | `RifleWeapon` 保留按键边缘和四个槽位限制 |
| M 机枪 | 最多六发；约每八帧一发；六发后有较长间隔 | `MachineWeapon.fireTime` 按同样的计数分支工作 |
| S 散弹 | 一次最多五发，总上限十发；剩余槽位不足时可发出部分散弹 | 限制十发，允许不足五发的一组；户外使用原版普通/R 两套 32 方向 8.8 速度表 |
| L 激光 | 四个片段；户外分别延迟 1、4、7、10 帧；新按键可重建光束 | 四段、相应延迟、长按续发、重新按下清除旧束 |
| R | 普通枪 / M 弹速由 3 提至 4 像素/帧；F 由 1.5 提至 2；L 弹速保持 4 | 按 60 Hz 换算为 180/240、90/120、240 像素/秒 |
| 玩家移动 | 基本水平速度为一像素/帧 | 60 像素/秒，固定 60 Hz 更新 |
| 重力和起跳 | 每帧向 Y 速度低字节加 `$23`；户外速度字节为 `$FB,$F0` | 重力 `35/256 × 60²`；起跳速度 `−4.0625 × 60`；未照搬全部字节进位和碰撞判定 |
| 姿态 | 站立、斜向瞄准、趴下、翻滚跳跃；水中向下时限制移动与射击 | 已实现对应操作与姿态；水中上下岸动画简化 |
| 生命 | 三条总生命，或代码开启三十条；死亡清空强化；新生命有 `$80` 帧保护 | 总生命 3/30；失去武器与 R；复活无敌 `128/60` 秒 |
| B 护罩 | 首关持续 `$80 × 8` 帧；接触敌人可消灭敌人 | 持续 `1024/60` 秒，接触伤害生效 |
| 奖命 | 首次 20,000 分，之后增加 30,000 分门槛 | 已按这个阈值计算 |
| 关底目标 | 首关目标为防御墙 / 装甲门，有分部敌人与爆炸流程 | 碉堡两门炮可独立摧毁；下方红色核心被毁后进入首关完成 |

射击、槽位与速度的依据：[bank6.asm，第 286–604 行](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank6.asm#L286-L604)、[速度表，第 879–980 行](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank6.asm#L879-L980)。

移动与重力的依据：[bank7.asm，第 4530–4665 行](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank7.asm#L4530-L4665)、[重力和位置累计，第 5110–5150 行](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank7.asm#L5110-L5150)。`$FBF0` 作为有符号 8.8 定点数是 −4.0625；不能把高字节注释的整数与低字节小数直接拼成 −5.94。

生命与护罩的依据：[初始生命与奖命，第 1165–1308 行](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank7.asm#L1165-L1308)、[新生命保护，第 4190–4203 行](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank7.asm#L4190-L4203)、[B 护罩，第 6858–6923 行](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank7.asm#L6858-L6923)。碉堡参照 [bank0.asm，第 2182 行起](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank0.asm#L2182)。

## 仍然不同的部分

| 维度 | 参考仓库 | 当前 JavaScript MVP |
|---|---|---|
| 范围 | 完整游戏及双人流程 | 单人第一关；没有后七关、双人、完整接关和片尾 |
| 程序结构 | 内存槽位、bank、例程指针表和状态编号 | `GameWorld`、`Player`、`Weapon`、`Enemy`、`CollisionSystem` 等对象 |
| 模拟方式 | NES 硬件、字节运算、帧计数与原版随机数 | 浮点坐标、固定 60 Hz、可重复的独立随机数；不是 CPU/PPU 模拟器 |
| 地图 | 压缩的原版 super-tile 数据与屏幕敌人配置 | 已解码原版十三屏，共 3328 像素；固定对象、两座四段断桥、水域和地面来自源表 |
| 敌人 | 固定生成、随机兵、各类多阶段例程，部分行为受武器强度影响 | 30 个固定对象记录已接入，包含重复生成的双胶囊；飞行胶囊左侧入场、向右 1.5 像素/帧。随机增援、枪手蹲起、炮台开闭、瞄准和血量仍有简化 |
| 碰撞 | 背景碰撞编码、各类碰撞偏移 / 表、精灵状态条件 | 按原版每隔 16 像素的采样和 $06/$f9/$ff 阈值生成地面、水域。实体受击框、上下岸、断桥触发时序仍为 JS 实现；子弹使用线段扫掠 |
| 武器细节 | S 有独立速度表；F 围绕移动中心旋转；L 有专属例程 | S 户外散射速度表及第 16/32 帧精灵变化已对齐；F 使用正弦偏移近似，L 的部分命中和重建细节简化 |
| 输入辅助 | 原版手柄输入 | 增加 H 连发手柄键、约 65 ms 离台宽限和 90 ms 跳跃缓冲；属于可玩性辅助 |
| 画面 | NES 256×240 nametable、图块、原作调色板与精灵 | 256×224 绘制区，4:3 显示。精灵与场景均采用提取的原版像素，DOM + CSS 硬边渐变与像素阴影显示；十三屏静态背景完整对应原图；动态炮台/装甲门破坏动画与调色板循环仍简化 |
| 音频 | NES 音频驱动、原曲与原音效数据 | Web Audio 合成短音效；未包含原版音乐 |
| 复活 / 过关 | 原版状态机、重新入场、出口行走与关间过场 | 当前视口内寻找安全落脚点；核心爆炸后显示首关完成 |

地图与敌人依据：[Enemy Routines.md](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/docs/Enemy%20Routines.md)。画面依据：[Graphics Documentation.md](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/docs/Graphics%20Documentation.md)。人物序列依据：[bank2.asm，第 893–1085 行](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank2.asm#L893-L1085)。

因此，本版是“参考原版规则的 JS 首关 MVP”，不是“原版 ROM 的完整或逐帧等价移植”。首关布局和固定配置已迁入；后续还原重点是敌人多阶段状态机、断桥时序、F 旋转轨迹与碉堡抛物线炮弹。

## 十三屏数据如何接入

tools/build-stage1.cjs 从 stage1-source.json 解码每屏 56 个 32×32 super-tile 索引，再从每块的左上、中上、左中、中中四个 8×8 tile 获取原版 16 像素间隔碰撞。场景像素取自 NES Maps 首关背景的 (512,16,3328,224)，测试将全部 728 块重建后逐像素与原始地图对照。

对象表的 X 字节实际上是触发卷轴偏移：普通对象生成中心为“屏号 × 256 + (X & 254) + 240”。重复数在类型字节的高两位。飞行胶囊在初始化例程中改为屏幕左侧 x=16、初始 Y 加 32；按原表，后段两个胶囊是 R/L。

依据：[首关屏幕表 bank2](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank2.asm#L48)、[对象加载例程](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank2.asm#L1538)、[首关对象表](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank2.asm#L2246)、[飞行胶囊初始化](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank0.asm#L680)。

## 面向对象原则如何落地

`GameWorld` 推进状态和协调对象；`Player` 把输入转换为动作；`Weapon` 子类各自控制弹数、射击边缘和计时；`CollisionSystem` 处理落地和子弹命中；`Renderer` 只读取游戏状态并绘制；`Sound` 消费事件；`Input` 处理键盘与多指触屏。

玩家通过组合持有武器。增加武器通常新增一个 `Weapon` 子类即可。`RunnerAI` / `SentryAI` 将行为与角色数据分开，测试直接驱动规则层，不依赖浏览器。激光在 `Player` 中仍有一处清除旧束的专用分支；这是 MVP 中保留的耦合点，后续可移入统一的武器替换 / 开火上下文接口。

原版的例程指针表也体现了行为分派，但它服务于 NES 的硬件和内存约束。这里采用对象和事件，是为了方便 JavaScript 项目的维护与测试。



v1.2.1：修正精灵库导出姿态的朝向差异。玩家默认朝右，跑兵/枪手默认朝左，CSS 镜像分别处理；固定枪手的水平朝向与现有瞄准方向同步。

v1.2.2：修正 S/M 子弹类型遗漏导致的普通弹素材回退。S 按中间、内两侧、外两侧顺序生成最多五弹，户外普通/R 速度分别读取原始 8.8 表；使用 sprite_1f → sprite_20 → sprite_21 的第 16、32 帧大小变化。M 使用 sprite_1f，普通敌弹使用 sprite_1e，大炮弹使用 sprite_21。碉堡炮弹轨迹仍保留现有近似。依据：[生成顺序与速度](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank6.asm#L1091)、[S 弹大小变化](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank6.asm#L1472)、[初始弹种精灵](https://github.com/vermiceli/nes-contra-us/blob/687d651c021fd7020f10d05b970ccb62663c94bd/src/bank6.asm#L655)。
