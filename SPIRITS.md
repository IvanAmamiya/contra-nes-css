# 魂斗罗精神 · FC 风格扩展 v2.0.1

本次通过实际 ROM 解包建立素材与计时校验流程，修复 B 道具缺失和炸弹图标混用。详见 [ROM_ANALYSIS.md](ROM_ANALYSIS.md)。下述关卡和 Boss 仍是改编版本，不代表已全部按 ROM 重建。

保留魂斗罗 1 丛林关，新增三个横版选段：城市废墟、钢铁工厂、异形巢穴。每段 1280×224 像素，分别对战 Beast Kimkoh、BOB 双机兵、装甲异形脑。平台重新编排，Boss 使用两阶段攻击；异形脑破甲后缩小为核心受击框。关卡编号 1 / 3 / 6 对应参考来源，不表示已经实现其余关卡。

## FC 化

源场景先按 2×2 像素简化纹理，城市中性色建筑改为蓝色层次，暖色管线保留赭黄。每个 16×16 背景区块只使用一套四配色之一：共享黑色 + 三种色。全局最多 13 色；运行时 32×32 CSS 硬边渐变块复用 70 个 DOM 节点。平台采用同一配色系统，明亮顶边明确显示可站立位置。

Boss 缩为 FC 画面适用尺寸，并限制配色。人物沿用原 NES 精灵。游戏场景没有 Canvas、SVG、WebGL 或位图请求。此处是 FC 美术风格改编，不是可在真实 FC 上运行的 ROM，也没有模拟精灵扫描线限制。

## 操作与规则

| 操作 | 键盘 |
| --- | --- |
| 移动 / 八向瞄准 | WASD / 方向键 |
| 持续开火 | J；H 为连发手柄 |
| 跳跃 / 脱离攀附 | K / 空格 |
| 双武器切换 | Q |
| Helio 炸弹 | E |
| 站定瞄准 | Shift + 方向 |
| 双枪旋转射击 | U |
| 攀附金色网格 | 接近时按住 ↑，方向键移动 |
| 松手 / 下穿 | ↓ + 跳跃 |
| 暂停 / 继续 | P / Enter |
| 重开 | 暂停后 R |

M 机枪、S 五方向散弹、H 追踪弹、C 爆破弹、L 穿透激光、F 短程火焰。拾取替换当前武器槽，死亡只丢失当前槽武器，保留另一槽。为了便于试玩，初始装备 M/H，初始一枚炸弹，死亡后恢复一枚；炸弹上限五枚。原版弹速、攻击计时、运动轨迹未逐帧复刻。

默认 30 命，可直接选 3 命。三个新关和 NES 丛林都能自由进入；通关后可跳到下一个新关。20,000 分奖励一命，之后每 60,000 分一命，上限 30；NES 模式保留其原本的计分规则。最高分按关卡与初始生命模式分别存储，声音、关卡与生命设置保存在浏览器本机。

## 音频资源及处理

使用 Konami《Contra III: The Alien Wars》的 Kick Drum、Snare Drum、Noise 和 Death Scream SFX 四种短 BRR 采样，来自 [brickblock369 的 SMW Central 乐器包](https://www.smwcentral.net/?p=section&a=details&id=39178)。原始样本保存在 `assets/audio-source`，哈希和转换参数见 `assets/spirits-audio.json`。

构建时解码 BRR，转换为 16 kHz 单声道、1-bit delta / 7-bit DAC 风格的短样本，再由浏览器 AudioBuffer 播放；最长 0.28 秒。配器使用两个方波声部、三角波低音、噪声和单个采样声部，最多同时五声部。三段背景序列是为此版编写的原创 FC 风格编曲，不是原版完整配乐或原曲翻制。没有 SNES 混响或立体声采样层叠。

## 与指定 SA-1 参考的异同

参考 [VitorVilela7/SA1-Root 的 Contra-III README](https://github.com/VitorVilela7/SA1-Root/blob/master/Contra-III/README.md)，本次阅读提交 `2a552ce891ee3b3d780fca446e5473463fd236f9`，以及 `Contra-III/sa1.asm` 的 APU/PPU callback 部分。

| SA-1 项目的做法 | 此 JavaScript 版 |
| --- | --- |
| 为美版 Contra III ROM 加速，减少原版减速与加载 | 固定 60 Hz 规则时钟，长帧最多补六步；CSS 节点复用，子弹与效果数量有界 |
| 将内存映射到 128 KB BW-RAM，由 SA-1 执行游戏逻辑 | 独立规则对象、碰撞层、渲染器和音频层，不存在 SNES/SA-1 CPU 或 RAM 重映射 |
| APU 上传和 PPU 操作回调 SNES CPU | 规则层产生事件，浏览器渲染与音频消费事件；只是架构层面的借鉴 |
| 保存最高分和设置 | localStorage 按关卡/生命模式保存最高分，保存选关、生命、声音 |
| 补丁仅适配美版，不适配日版 Contra Spirits 的编译代码 | 本版独立实现，无 ROM 补丁应用；主题称《魂斗罗精神》，素材部分来自美版 |

SA-1 仓库不是完整关卡与美术素材库，也没有把该项目的汇编转换或嵌入此版。武器、攀附和双枪机制还参考了 [Nintendo 托管的官方说明书扫描](https://www.nintendo.co.jp/clvs/manuals/common/pdf/CLV-P-SACCE.pdf)。

## 场景素材

Konami 原始游戏图像；地图和精灵整理来自 Rick N. Bruns / [SNES Maps](https://www.snesmaps.com/maps/Contra3/sprites/Contra3Sprites.html)。原图、下载 URL 与 SHA-256 见 `assets/sfc-source/sources.json`，裁切、调色和区块属性见 `assets/spirits-art.json`，转换工具 `tools/build-spirits-art.cjs`。新增的素材仍属于各自原权利人；工程不附加对这些素材的开源许可。

## 测试与边界

`npm test` 覆盖原 NES 回归、扩展机制、三关各十种随机种子的正常按键完整通关，以及随机输入压力。`spirits-qa.html` 提供浏览器通关、场景/Boss 回放、600 帧性能和音频启停检查。具体发布验证见 `SPIRITS_TEST_REPORT.md`。

这是三个横版选段的可玩扩展；俯视关卡、双人、坦克/摩托和完整六关流程尚未实现。Git 分支 `feature/sfc-contra` 保留后续开发，`main` 为经过测试后发布的版本。
