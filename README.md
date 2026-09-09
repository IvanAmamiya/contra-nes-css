# 魂斗罗 1 · JavaScript 首关 MVP

参照 FC / NES《魂斗罗》一代：丛林、岩壁、河水、爆炸桥、胶囊武器和关底碉堡。原生 JavaScript 控制游戏逻辑，**游戏画面完全由 DOM + CSS 绘制**，无 Canvas、SVG、WebGL 或位图显示。直接运行无需构建。

## 启动

直接双击本目录的 **index.html** 即可离线游戏；请保留旁边的 JS、CSS 与 assets 文件夹。

也可以在本目录执行：

```sh
npm start
```

打开 `http://127.0.0.1:4173/`。无需 `npm install`。端口被占用时可以通过 `PORT` 环境变量指定其他端口。

## 操作

| 按键 | 动作 |
|---|---|
| WASD / 方向键 | 移动与八方向瞄准 |
| J / X | 射击；普通枪、S、F 为点射，M、L 可持续按住 |
| K / Z / 空格 | 跳跃 |
| H | 模拟连发手柄 |
| 下 | 趴下；在水中时潜水 |
| 下 + 跳跃 | 下穿普通平台 |
| Enter / P / Esc | 暂停、继续 |
| M | 切换声音 |
| 暂停后 R | 从头重开 |

手机窄屏下显示触屏方向键与 A/B/连发按钮。默认声音关闭，点击“声音：关”可开启。

三条总生命，一击死亡；死亡后普通枪重生、失去 R，在当前画面重新出现并获得短暂无敌。左上奖章显示备用生命，屏幕外文字显示包括当前生命在内的总数。镜头只向右推进。

摧毁飞行胶囊或固定补给箱后才能拾取武器：M 机枪、S 五向散弹、F 火球、L 激光；R 提高弹速。B 护罩规则保留用于后续关卡，首关原始对象表不投放 B。击破碉堡下方红色核心即可完成第一关。

标题输入 **↑ ↑ ↓ ↓ ← → ← → B A**，再开始，可使用 30 命练习模式。按键中的 B/A 指字母键，不是游戏的射击/跳跃键。

## 本版范围

可玩的单人第一关 MVP。人物、敌人、武器与效果采用原版精灵，场景采用 NES Maps 原始像素图块，音效由 Web Audio 合成。未包含双人、后七关玩法和原版音乐；首关已采用原版 13 屏、3328 像素的地图，47 段地面由原始 super-tile 碰撞数据生成；固定对象位置和出场卷轴来自原版对象表。敌人状态机、断桥时序及部分武器参数仍有简化。

美术库已经收录 **233 个精灵文件 / 236 帧、八关静态背景、八张缩略图、一张首关对象图，以及 3,404 个原始 CHR 图案 / 7,836 个配色组合**。后七关素材可在 [原版素材浏览](art.html) 中查看。收录资源不等于已实现八关，也不表示已穷尽 ROM 的全部图形状态。

每个像素的颜色和透明度由 CSS 表示：场景采用硬边渐变，精灵采用像素阴影；原版首关的 728 个 32×32 场景块去重为 61 种 CSS 样式，镜头附近复用 70 个图块节点。JS 只切换动作、移动元素和管理游戏状态。PNG/GIF 原文件仅用于构建与验证，运行时不请求图片。

- [源码异同与已校准参数](SOURCE_COMPARISON.md)
- [测试报告](TEST_REPORT.md)
- [素材来源](ATTRIBUTION.md)

## 版本与后续开发

NES 首关稳定版本为 `v1.2.2`，保留在 `main` 分支。`feature/sfc-contra` 从同一发布提交建立，供后续 SFC 魂斗罗内容开发；当前还未包含 SFC 内容。切换前先保存正在进行的改动，再执行 `git switch feature/sfc-contra`。

发布静态网站执行 `npm run build`，输出到 `dist/`。构建会校验各 HTML 页引用的本地文件，只复制游玩、素材浏览、回归页及说明所需文件，不包含 Git 元数据或构建用原始图片。

### Vercel

已经提供 `vercel.json`：使用纯静态构建，跳过依赖安装，发布 `dist/`。不需要把本地 `server.cjs` 部署为服务端函数。Vercel 的安装与输出配置见 [官方说明](https://vercel.com/docs/project-configuration/vercel-json)。

首次部署在本目录执行 `npx vercel login`，登录后执行 `npx vercel --prod`；已关联项目后可执行 `npx vercel --prod --yes`。`.vercel/` 中的本地项目关联不进入 Git，`.vercelignore` 排除 Git、其他托管平台配置及构建用原图；保留回归页需要的两个浏览器脚本。

## 测试与代码

```sh
npm test
```

需要 Node.js 20 或更新版本。浏览器回归页：本目录 **qa.html**，或启动服务后访问 `http://127.0.0.1:4173/qa.html`。

| 文件 | 职责 |
|---|---|
| assets/stage1.js / stage1.css | 原版首关数据与原始像素 CSS 图块 |
| tools/build-stage1.cjs | 解码随包源表，生成关卡、碰撞与 CSS |
| tests/stage1.test.cjs | 原版坐标、胶囊飞行、完整地图像素及 385 个复活点 |
| core.js | 游戏对象、物理、武器、敌人、关卡与状态机 |
| css-renderer.js / css-renderer.css | CSS 图块、精灵、DOM 复用、画面缩放 |
| art.html / art.js | 全精灵、八关地图和原始 CHR 配色浏览 |
| app.js | 键盘/触屏输入、音效、菜单与动画循环 |
| tests/core.test.cjs | 规则、碰撞、武器和压力测试 |
| tests/ui.test.cjs | 执行真实 app.js 的输入生命周期测试；DOM 使用替身 |
| tests/playthrough.test.cjs | 正常输入驱动的整关模拟 |
| tests/assets.test.cjs | 素材完整性、CSS 像素还原、图块拼接与纯 CSS 约束 |
| tests/css-renderer.test.cjs | 动作选择、暂停、DOM 复用与释放 |
| tests/native-pixels.test.cjs | NES 2bpp 位平面、调色板与透明度 |
| tests/pilot.js | 仅输出按键的测试驾驶员 |

来源参考：用户提供的 [nes-contra-us](https://github.com/vermiceli/nes-contra-us)。详细说明固定了本次核对的提交版本。

## 重新生成 CSS 素材

游戏运行与测试都不需要安装依赖。只有重新生成素材时需要 Node.js 和构建依赖 Sharp：先执行 `npm install`，再执行 `npm run build:assets`。生成器读取包内原始 PNG/GIF 和 stage1-source.json 源表，输出 CSS、关卡数据和像素校验清单。`node tools/build-stage1.cjs 路径/nes-contra-us/src` 可从固定版本源码刷新首关表；普通构建不需要 ROM 或外部仓库。`tools/extract-native-tiles.cjs` 用于从指定的 `hires.txt`、`FCEUX.pal` 重新提取原始 CHR 匹配数据；已提取的数据随包提供。

