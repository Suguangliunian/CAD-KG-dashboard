"""Generate interface examples only. No measured experiment results are used."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METHODS = [{"id": "baseline", "name": "Baseline", "revision": "example A"}, {"id": "ours", "name": "Ours", "revision": "example B"}]
EXAMPLES = [
    ("DEMO-001", "法兰连接件", "尺寸约束", "flange", "fail", "pass", "观察中心通孔与凸台的尺寸差异。旋转任一模型可联动另一侧，点击下方步骤查看构造过程。"),
    ("DEMO-002", "四孔安装板", "孔位与布局", "plate", "pass", "pass", "对照安装板的孔位布局和板厚。两侧模型共享坐标与缩放，适合观察相对尺寸。"),
    ("DEMO-003", "直角支撑架", "结构与支撑", "bracket", "fail", "fail", "检查底板、立板及支撑构造。此处的判定状态为筛选交互示例，与几何有效性无关。"),
    ("DEMO-004", "待补充的实验样本", "缺失数据", None, "unknown", "unknown", "演示缺少模型和评测记录时的页面状态。缺失的指标与证据保持为空，等待后续接入。"),
]
LABELS = ["创建草图", "拉伸成型", "添加特征", "最终模型"]

def example_code(shape, index, corrected):
    lines = ["# 界面示例代码；不是实验执行记录", "import cadquery as cq", ""]
    if shape == "flange":
        lines += ["part = cq.Workplane(\"XY\").circle(24)"]
        if index >= 1: lines += ["part = part.extrude(5)"]
        if index >= 2: lines += [f"part = part.faces(\">Z\").workplane().hole({16 if corrected else 10})"]
        if index >= 3: lines += ["# 凸台和安装孔的几何在预览中示意", "result = part"]
    elif shape == "plate":
        lines += ["part = cq.Workplane(\"XY\").rect(48, 34)"]
        if index >= 1: lines += [f"part = part.extrude({6 if corrected else 10})"]
        if index >= 2: lines += ["part = part.faces(\">Z\").workplane().hole(15)"]
        if index >= 3: lines += ["# 四个安装孔的布局在预览中示意", "result = part"]
    else:
        lines += ["base = cq.Workplane(\"XY\").rect(42, 34)"]
        if index >= 1: lines += ["base = base.extrude(4)"]
        if index >= 2: lines += [f"upright_height = {33 if corrected else 21}"]
        if index >= 3: lines += ["# 立板和支撑结构在预览中示意", "result = base"]
    return "\n".join(lines)

samples = []
for sid, title, category, shape, astatus, bstatus, description in EXAMPLES:
    sample = {"id": sid, "title": title, "category": category, "description": description, "methods": {}}
    for index, method in enumerate(METHODS):
        corrected = index == 1
        sample["methods"][method["id"]] = {
            "status": [astatus, bstatus][index],
            "metrics": {"cd": None, "iou": None, "seconds": None},
            "message": "仅用于演示界面，尚无真实评测结果。",
            "steps": [
                {"label": label, "code": example_code(shape, step, corrected),
                 "geometry": {"kind": "demo", "shape": shape, "variant": "corrected" if corrected else "original", "stage": step},
                 "evidence": ["来源：浏览器内程序生成的示例几何。", "代码片段和模型用于界面演示，尚未执行 CAD 验证；没有真实日志或检索证据。"]}
                for step, label in enumerate(LABELS)
            ] if shape else [],
            "assets": [],
        }
    samples.append(sample)

data = {"schema": "cad-kg-dashboard/v1", "isDemo": True, "title": "CAD-KG / Demo collection",
        "description": "当前为通用页面框架。4 个交互示例由程序构造，示例状态仅用于体验筛选；未接入训练、推理或评测数据。",
        "metricDefinition": "Chamfer、IoU 和耗时均未提供。真实实验接入时需记录 CD 的采样数、单位、归一化及距离定义。",
        "provenance": "示例生成器：tools/generate_demo.py；三维示意：viewer.js。", "methods": METHODS, "samples": samples}
template = {"schema": "cad-kg-dashboard/v1", "isDemo": False, "title": "我的 CAD 对照实验",
            "description": "填写数据集版本、实验条件和 pass/fail/unknown 的具体判定规则。",
            "metricDefinition": "填写 CD 的单位、距离定义、归一化、采样数，以及 IoU 的计算方式。",
            "provenance": "填写运行 ID、代码版本或来源哈希。",
            "methods": [{"id": "baseline", "name": "Baseline", "revision": "待填写"}, {"id": "ours", "name": "Ours", "revision": "待填写"}],
            "samples": [{"id": "SAMPLE-001", "title": "待填写的样本", "category": "待分类", "description": "填写输入任务与约束。", "methods": {
                name: {"status": "unknown", "metrics": {"cd": None, "iou": None, "seconds": None}, "message": "尚未评测",
                       "steps": [{"label": "最终模型", "code": "# 在这里填写实际代码", "geometry": None, "evidence": []}], "assets": []}
                for name in ["baseline", "ours"]}}]}
(ROOT / 'data').mkdir(exist_ok=True)
for name, content in [("experiment.json", data), ("template.json", template)]:
    (ROOT / 'data' / name).write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Created 4 explicitly marked interface examples and an unscored import template.')
