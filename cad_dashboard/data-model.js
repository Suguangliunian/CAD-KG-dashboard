export const SCHEMA = 'cad-kg-dashboard/v1';
export const STATUSES = ['pass', 'fail', 'unknown'];

export function validateDataset(data) {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  check(object(data) && data.schema === SCHEMA, `schema 必须为 ${SCHEMA}`);
  check(typeof data.isDemo === 'boolean', '请明确填写 isDemo: true 或 false');
  check(typeof data.title === 'string' && data.title.trim(), '实验 title 不能为空');
  check(Array.isArray(data.methods) && data.methods.length === 2, 'methods 需要恰好两种对照方法');
  const methodIds = new Set();
  for (const m of data.methods) {
    check(object(m) && /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(m.id) && !['constructor', 'prototype', '__proto__'].includes(m.id), '方法 id 需为字母开头的英文标识');
    check(!methodIds.has(m.id) && typeof m.name === 'string' && m.name.trim(), '方法 id 不能重复，name 不能为空'); methodIds.add(m.id);
  }
  check(Array.isArray(data.samples) && data.samples.length <= 5000, 'samples 必须为数组，最多 5000 条');
  const ids = new Set();
  for (const sample of data.samples) {
    check(object(sample) && typeof sample.id === 'string' && sample.id.length > 0 && sample.id.length <= 160, '每条样本需要非空 id（最多 160 字符）');
    check(!ids.has(sample.id), `样本 id 重复：${sample.id}`); ids.add(sample.id);
    check(typeof sample.title === 'string' && object(sample.methods), `${sample.id} 缺少 title 或 methods`);
    for (const id of methodIds) {
      const m = sample.methods[id]; check(object(m) && STATUSES.includes(m.status), `${sample.id}/${id} 的 status 应为 pass、fail 或 unknown`);
      if (m.metrics !== undefined) {
        check(object(m.metrics), `${sample.id}/${id} metrics 必须为对象`);
        for (const key of ['cd', 'iou', 'seconds']) {
          const value = m.metrics[key];
          check(value == null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && (key !== 'iou' || value <= 1)), `${sample.id}/${id} 的 ${key} 数值无效`);
        }
      }
      check(m.steps === undefined || (Array.isArray(m.steps) && m.steps.length <= 500), `${sample.id}/${id} steps 必须是最多 500 项的数组`);
      for (const step of m.steps || []) {
        check(object(step) && typeof step.label === 'string', `${sample.id}/${id} 步骤必须有 label`);
        if (step.code !== undefined) check(typeof step.code === 'string', '步骤 code 必须为文本');
        if (step.geometry != null) {
          const g = step.geometry;
          check(object(g) && ['demo', 'stl'].includes(g.kind), 'geometry.kind 支持 demo 或 stl');
          check(g.kind !== 'demo' || data.isDemo, '真实实验不能混入 demo 几何');
          if (g.kind === 'stl') check(typeof g.url === 'string' && g.url.trim(), 'STL 几何需要 url');
        }
        if (step.evidence !== undefined) check(Array.isArray(step.evidence) && step.evidence.every(e => typeof e === 'string'), '步骤 evidence 必须为文本数组');
      }
      if (m.assets !== undefined) check(Array.isArray(m.assets) && m.assets.every(a => object(a) && typeof a.name === 'string' && typeof a.url === 'string'), 'assets 每项需要 name 和 url');
    }
  }
  return data;
}

export function pairType(sample, methods) {
  const [a, b] = methods.map(m => sample.methods[m.id].status);
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  if (a === b) return a === 'pass' ? 'both-pass' : 'both-fail';
  return b === 'pass' ? 'right-only' : 'left-only';
}

export function summarize(data) {
  if (data.isDemo) return null;
  return {
    total: data.samples.length,
    methods: data.methods.map(m => ({
      pass: data.samples.filter(s => s.methods[m.id].status === 'pass').length,
      fail: data.samples.filter(s => s.methods[m.id].status === 'fail').length,
      unknown: data.samples.filter(s => s.methods[m.id].status === 'unknown').length,
    })),
    paired: data.samples.filter(s => data.methods.every(m => typeof s.methods[m.id].metrics?.cd === 'number')).length,
  };
}

export function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
