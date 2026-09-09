# 参考与素材来源

v2.0.1：构建时提取参考 SNESTilesKitten（Sylvain "Skarsnik" Colinet）与 Proton 的 Konami SNES 解压研究。`tools/snes/` 中的工具附 GPL-3.0-or-later 许可，游戏运行时不加载它们。炸弹图标和 ROM 对照页来自本机已有的修改版 ROM，素材版权仍属 Konami。确切输入哈希、源码提交和验证边界见 [ROM_ANALYSIS.md](ROM_ANALYSIS.md)。

本项目为使用原生 JavaScript 重新实现的《魂斗罗》一代首关练习及《魂斗罗精神》FC 风格扩展，不是 Konami 官方产品。

参考项目：[vermiceli/nes-contra-us](https://github.com/vermiceli/nes-contra-us/tree/687d651c021fd7020f10d05b970ccb62663c94bd)。本次核对版本：`687d651c021fd7020f10d05b970ccb62663c94bd`。

`assets/source/` 完整收录该版本 [Contra 精灵库](https://github.com/vermiceli/nes-contra-us/tree/687d651c021fd7020f10d05b970ccb62663c94bd/docs/sprite_library/contra_sprites) 的 **233 个文件**：232 个 PNG、1 个四帧 GIF，共 236 帧（其中包括另存的 GIF 单帧）。覆盖 P1/P2、室内外人物、敌人、子弹、道具、爆炸、生命奖章和结局精灵。原文件未修改，文件 SHA-256、尺寸、帧时长及像素校验值见 `assets/manifest.json`。精灵的提取、标注和反汇编整理来自参考项目及其贡献者。

`assets/background-source/` 收录 [NES Maps 的八关背景](https://nesmaps.com/maps/Contra/ContraBG.html)、八张站点关卡缩略图与首关对象定位图，共 17 张 PNG。地图作者为 **Rick N. Bruns**。保留完整原文件及作者署名；完整 URL 和文件哈希在 `assets/backgrounds.json`。这些是已提取的静态地图：部分图片包含地图作者的文字、标题或位置说明，并非直接的 ROM nametable 导出。游戏首关使用背景源图 `(512,16)` 起的 `3328×224` 原始像素区域，保留完整十三屏布局；左侧 512 像素的作者说明区不进入游戏。标题徽标以 CSS 裁切去除旁边的关卡文字。

补充的 `assets/native-tiles.json` 来自 [Contra80s 1.2 发布包](https://github.com/TasticHacks/Contra80s/releases/tag/1.2) 中 `hires.txt` 的 **原始图块匹配键**。提取 13,218 条有效记录，去重后为 **3,404 个 16 字节 CHR 图案、7,836 个图案/调色板组合**。根据 [Mesen 官方格式文档](https://github.com/SourMesen/Mesen/blob/master/Docs/content/hdpacks/_index.md)，CHR RAM 的 32 位十六进制匹配键就是原始 16 字节图案，另有 4 字节 NES 调色板索引。仅提取这些原始数据；没有使用发布包的现代替换图像、音频或代码。此参考并未证明穷尽了整份 ROM 的所有未使用图块或运行时图形状态。

原始 CHR 浏览器保留 NES 色号，并用 [FCEUX.pal](https://github.com/TASEmulators/fceux/blob/master/output/palettes/FCEUX.pal) 的 64 色 RGB 表显示。NES 模拟输出没有唯一的 RGB 对照；地图/精灵的 CSS 转换保留各自来源图像的颜色，CHR 浏览器明确采用 FCEUX 调色板。

游戏画面使用 **DOM + CSS 硬边渐变与像素阴影**，素材浏览页还使用 CSS box-shadow。PNG/GIF 仅作为构建输入和校验依据，游戏不加载位图，也不使用 Canvas、SVG 或 WebGL。NES 音效为程序合成；扩展的采样来源见下文。页面普通文字使用系统字体。

原作名称、角色和图像属于 Konami。此处记录来源，不对原作资产授予额外许可。本包没有附带原版 ROM 或原版音乐。

逻辑参照位置与具体异同见 [SOURCE_COMPARISON.md](SOURCE_COMPARISON.md)。

## Contra III / 魂斗罗精神扩展

场景和 Boss 原图由 Rick N. Bruns / [SNES Maps](https://www.snesmaps.com/maps/Contra3/sprites/Contra3Sprites.html) 整理，原作美术属于 Konami。`assets/sfc-source/sources.json` 记录 16 个源文件的 URL 和 SHA-256。原文件仅用于构建，运行时使用经过裁切、缩小、调色、16×16 属性区配色限制的 CSS 图块。此扩展的美术转换有意改变源像素；NES 模式仍保留原像素。

四种短 BRR 采样来自 [brickblock369 在 SMW Central 发布的 Contra III 音色包](https://www.smwcentral.net/?p=section&a=details&id=39178)，原音频属于 Konami。保留 Kick Drum、Snare Drum、Noise、Death Scream SFX；转换为单声道低精度 delta 音频，最长 0.28 秒。来源、哈希和转换详情在 `assets/spirits-audio.json`。背景编曲为此工程新写的 FC 风格序列，没有收录完整原版音乐。

另参考 [Vitor Vilela 的 Contra III SA-1 Root](https://github.com/VitorVilela7/SA1-Root/blob/master/Contra-III/README.md)（提交 `2a552ce891ee3b3d780fca446e5473463fd236f9`）的性能与设置保存目标，以及 [Nintendo 托管的官方说明书](https://www.nintendo.co.jp/clvs/manuals/common/pdf/CLV-P-SACCE.pdf) 中的武器和操作说明。没有移植 SA-1 汇编或应用 ROM 补丁。详细异同见 [SPIRITS.md](SPIRITS.md)。


首关逻辑源表来自同一提交的 `src/bank2.asm`（13 屏压缩索引、30 个固定对象记录）与 `src/bank3.asm`（super-tile 组成）。数据快照在 `assets/stage1-source.json`，生成结果在 `assets/stage1.json`，记录提交与 SHA-256。水域、地面采用原版 16 像素间隔的碰撞采样；固定对象按卷轴位置触发，飞行胶囊额外应用 `bank0.asm` 的左侧入场位置。


## v2.1.0 城市重建

首关追加元图块位于 ROM 偏移 0x54DBC。背景、人物及弹体经 SNESTilesKitten 兼容解码与 Snes9x VRAM/OAM 拼装，再转换成 CSS。逐帧参考和各项限制见 [ROM_CITY.md](ROM_CITY.md)。关底美术继续使用已归属的 SNES Maps 图，现保留原生 160×168 尺寸；未冒充本轮 ROM 动态提取。
