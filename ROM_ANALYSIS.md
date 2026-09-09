# Contra III ROM 提取与护盾修复 · v2.0.1

本次已经实际运行本机 ROM，并解出首批 25 个已知背景、地图和精灵数据块。第一关其中 7 块共 **40,960 字节**与 Snes9x 运行时显存逐字节一致；JavaScript 图块解码器输出的 **131,072 个像素索引**也与未经修改的 SNESTilesKitten C 解码器完全相同。

[原配色与 FC 配色的纯 CSS 对照页](rom-art.html) · [数据块地址、长度及 SHA-256](assets/rom-extraction.json)

## 输入版本

使用本机已有文件，只读提取，没有改写原文件。1,048,576 字节，无 512 字节 copier header；内部标题 `CONTRA3 THE ALIEN WAR`，映射模式 `0x23`、芯片类型 `0x35`，128 KiB SA-1 BW-RAM。SHA-256：

`44ebb9a450b5b77341fc9130ab45767a13212c242350aad450a4526f8a8d8017`

这是带 SA-1 的修改版，文件名还标有西班牙语版本。它既不匹配 [SA1-Root 要求的美版原始 ROM](https://github.com/VitorVilela7/SA1-Root/blob/2a552ce891ee3b3d780fca446e5473463fd236f9/Contra-III/README.md)，也不匹配该项目 v1.2 发布的目标哈希；内部保存的校验和与实际累加值也不同。因此本报告只代表此输入版本，不能据此宣称全部行为已还原未修改美版。

## SNESTilesKitten 的使用与差异

检出 [SNESTilesKitten](https://github.com/Skarsnik/SNESTilesKitten/tree/7ed9e3fd1a1891bfb1dd32ac5b887722d0918562) 及其 `lowlevelstuff` 子模块 `4be0df0dc6ad3b3ab0d5397a172c67bb0e5767d9`；实际编译并调用原始 `unpack_bpp4_tile`，对照同一份 64 KiB VRAM 的全部图块输出。不是只阅读了 README。

该版本的 Konami1 插件不能直接正确解本作。对照 [Proton 的 Konami SNES 解压器](https://github.com/ProtonNoir/SNES-decompression-tools/blob/8149ef6f2bcf121565db63251fe0d3dc429d8b50/Konami/konami_d.cpp) 并以实际显存验证后，采用以下本作格式：长度头包含头自身；`A0–BF` 读取多个不同字节并分别在前面补零；`FF` 是 33 个零；LZ 使用 1024 字节窗口及 `0x3DF` 初始位置。未验证的交错格式拒绝处理。

初始数据地址参考 [Data Crystal 的原始 ROM 地址研究](https://datacrystal.tcrf.net/wiki/Contra_III:_The_Alien_Wars/ROM_map)，再核对解压长度及当前版本的运行结果。工厂、巢穴和布局块目前通过长度检查；**尚未逐关运行验证这些块的用途与排列**。`8193` 字节的块完整保留末尾字节，没有为了凑图块数量而静默截断。

JS 构建工具在 `tools/snes/`，许可为 GPL-3.0-or-later，附完整许可和来源；它不进入网页运行包。输出 `.stk` 指向已解压 `.bin`，在 Kitten 中使用 `compression=None` 查看，不能误选自带 Konami1。运行页面仍然只用 JS、DOM 和 CSS。

## 护盾证据与修复

Snes9x libretro `1.63 890b5d4` 能正常启动这份 ROM。核心 DLL SHA-256 为 `634c15450fffc40e5ceef8cefac7d1df4bcc22bc4f63ba3e14cf4cb81f6c4be7`。MesenCE 2.2.1 在同一文件上启动异常，未把其黑屏数据用于校准。

文件偏移 `0xC8BE` 的 B 道具处理代码装入 `0x0200`，随后写入玩家计时器。SA-1 重映射后的逻辑地址为 `$00:7F88`，对应 BW-RAM 偏移 `0x1F88`。

受控实验在第 1200 帧运行前，将此计时器设为 512，让 ROM 自己更新；帧末观察值为 511、510……1、0，第 1711 帧归零。**该实验是计时器注入，不是自然拾取 B 的录像。**自然拾取路径的初值来自上述代码；全部 512 个倒计时结果保存在 `tests/fixtures/contra3-protection.json`，回归测试逐帧对照。

普通按键启动记录中，玩家保护标志 mask `2` 从第 624 帧持续到第 720 帧，计 96 帧。另一次正常游戏死亡重生记录重复观察到 1247→1343、1417→1513，各 96 帧。

网页已修复：

- 原先关卡没有生成 B；现在三个改编关卡起段和中后段均有可拾取 B。
- B 时长改为 512 / 60 秒，约 8.53 秒；复活保护改为 96 / 60 秒。
- 保护期间抵挡敌弹和 Boss 接触，暂停冻结倒计时，重复拾取刷新时长；落坑仍会死亡。
- 炸弹不再套用 B 图标，而使用本次从 ROM HUD 提取并转为 CSS 的炸弹图标。
- 护盾期间人物持续显示，新增轮廓和倒计时提示；这些提示属于本版可读性改编，未宣称复刻原版保护动画。

## 当前边界

首屏对照图由显存图块、CGRAM 调色板和 OAM 精灵拼装，不是用截图当纹理。对照工具仅支持本场景的 Mode 1、8px 背景图块和 8/16px 精灵；没有实现所有优先级、HDMA 与颜色运算，不能当完整 PPU 模拟器使用。FC 版对中性色做蓝色转换，并按 16×16 区块限制四种颜色，保留像素位置。

游戏中的三个关卡、Boss 状态机、其他武器参数和音乐仍沿用 v2.0.0 的改编；本次完成的是实际提取通路及护盾修复，**不是整部 Contra III 已完整逆向或复刻**。没有把完整 ROM、模拟器存档或原始内存转储发布到 GitHub/Vercel。
