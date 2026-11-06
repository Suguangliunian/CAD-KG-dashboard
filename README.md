# CAD-KG Experiment Explorer

[打开实验对照台](https://suguangliunian.github.io/CAD-KG-dashboard/) · [数据协议与本地运行说明](cad_dashboard/README.md)

CAD 实验的静态配对浏览框架，提供双侧三维视图、相机联动、操作步骤、样本筛选、代码、指标和证据下载。

当前为通用页面框架。默认的四条记录均是明确标注的界面示例，真实评测指标保持为空。使用页面的 JSON 模板接入后续实验。

页面与依赖位于 `cad_dashboard/`。GitHub Actions 从 `main` 分支发布这个目录；本站不包含 CAD-KG 研究仓库的代码、数据或提交历史。

## 本地运行

```sh
python -m http.server 8766 --bind 127.0.0.1 --directory cad_dashboard
```

打开 `http://127.0.0.1:8766/`。

## 数据规则测试

```sh
node --test cad_dashboard/tests/data-model.test.mjs
```

Three.js 固定为 0.180.0，许可证见 [vendor/LICENSE](cad_dashboard/vendor/LICENSE)。
