# CAD-KG 实验对照台

一个可直接发布到 GitHub Pages 的静态页面。当前版本为通用框架，默认的四条记录均为明确标注的交互示例，不包含真实实验成绩。

支持：双侧 STL/示例模型浏览、联动相机、实体/线框、按步骤浏览、样本搜索与结果筛选、指标总览、分页结果表、代码与证据、JSON 导入、CSV 和单样本导出、样本步骤深链接。

## 本地预览

在此目录执行 `python -m http.server 8766 --bind 127.0.0.1`，然后访问 `http://127.0.0.1:8766/`。请使用 HTTP 服务，直接打开 HTML 文件无法加载 ES modules 和 JSON。

三维依赖在 `vendor/`，页面运行不依赖外部 CDN。Three.js 固定为 0.180.0，MIT 许可证保存在 `vendor/LICENSE`。示例模型为程序构造，不需要 CAD 后端。WebGL 不可用时，代码、指标和证据仍可查看。

## 接入真实数据

1. 下载 `data/template.json`，保留 `schema: "cad-kg-dashboard/v1"`，设置 `isDemo: false`。
2. `methods` 固定包含两种待比较方法，每种方法有唯一 `id`、显示 `name` 和可选 `revision`。
3. `samples` 的每个样本包含唯一 `id`、`title`、`category`、`description` 及以方法 ID 为键的 `methods`。
4. 方法结果包含 `status`（`pass`、`fail`、`unknown`）、`metrics`（`cd`、`iou`、`seconds`）、`steps` 和 `assets`。缺少数值时填 `null`，不要填 0。
5. 一个步骤可包含 `label`、`code`、`evidence` 字符串数组，以及 `geometry: {"kind":"stl","url":"./assets/sample-001/ours.stl"}`。无模型时填 `null`。
6. 下载附件使用 `assets: [{"name":"执行日志","url":"./assets/sample-001/run.txt"}]`。

两个方法必须来自同一输入样本，并共享建模坐标、单位和朝向。视图以两个模型的共同包围盒居中及缩放，不分别归一化。步骤默认按序号浏览，序号相同不等于语义对齐；较短的序列停在最后一步。当前框架提供三维步骤浏览，未实现视频时间同步、在线修复、自动几何评分或 GLB 加载。

每条样本都应提供两个方法的记录；缺失的运行使用 `unknown`。统计始终来自完整输入集，筛选仅影响列表和表格。共同可评几何计数要求两侧均有数值 CD；其可比较性还依赖你在 `metricDefinition` 中提供的一致评测协议。

`isDemo: true` 时，所有汇总和逐样本指标显示为空，CSV 中指标也为空；导出会保留示例标识。真实实验拒绝使用 `kind: "demo"` 的示意模型。界面不会把模型文件缺失改记为实验失败。

“导入实验”只在当前浏览器读取 JSON，不上传或持久保存。相对资源地址以网页目录为基准；本地文件 JSON 不会自动授权读取同目录 STL。请先把 STL 放入本地 HTTP 服务目录，或使用允许跨域访问的 HTTPS 地址。单个 JSON 限制 12 MB、5000 样本；单个 STL 限制 50 MB。大型数据建议拆分实验批次。

要持续发布数据，更新 `data/experiment.json` 并提交引用的资源。只有发布数据支持通过 `?sample=SAMPLE-001&step=0` 分享；本地导入数据应导出 JSON 后再分享。

## GitHub Pages

仓库配套工作流 `.github/workflows/cad-dashboard-pages.yml` 仅上传 `cad_dashboard/`。

仓库设置：**Settings → Pages → Build and deployment → Source → GitHub Actions**。当前默认分支为 `cadquery`；推送该分支的页面变更后自动发布，也可在 Actions 中手动执行 `Deploy CAD dashboard`。

预期地址为 `https://suguangliunian.github.io/CAD-KG-dashboard/`；是否已上线以工作流成功和实际 HTTP 检查为准。仓库可见性与 Pages 发布源是两个设置。工作流不会把其他研究目录打包到页面。

无打包构建步骤。文件分工：`app.js` 负责交互，`data-model.js` 负责数据校验和统计，`viewer.js` 负责三维展示，`styles.css` 负责布局。`tools/generate_demo.py` 可重新生成示例和模板；接入真实数据后不要再运行它覆盖 `data/experiment.json`。
