import { PairedViewer, assetURL } from './viewer.js';
import { validateDataset, pairType, summarize, csvCell } from './data-model.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const sides = ['left', 'right'];
const labels = { pass: '通过', fail: '未通过', unknown: '未裁定' };
const state = { data: null, selected: null, filtered: [], step: 0, page: 0, imported: false, timer: null, loadSerial: 0 };
const viewer = new PairedViewer($('#left-viewer'), $('#right-viewer'));
const glyph = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 4 11 6v13l-11 6-11-6V10Z" stroke="currentColor" stroke-width="1.2"/><path d="m5 10 11 6 11-6M16 16v13M10.5 7l11 6v7l-5.5 3" stroke="currentColor" stroke-width="1.2"/></svg>';
function el(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
function setText(selector, value) { $(selector).textContent = value; }
function textValue(value, fallback = '') { return typeof value === 'string' ? value : fallback; }
function number(value, digits = 4) { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—'; }
function error(message) { $('#error').hidden = !message; $('#error').textContent = message || ''; }
let toastTimer;
function toast(message) { clearTimeout(toastTimer); setText('#toast', message); $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500); }
function stop() { clearInterval(state.timer); state.timer = null; setText('#play-steps', '▶ 自动浏览'); }
function sample() { return state.data?.samples.find(s => s.id === state.selected); }
function methodData(s, index) { return s.methods[state.data.methods[index].id]; }
function stepAt(m) { return m.steps?.[Math.min(state.step, m.steps.length - 1)] || null; }
function stepCount(s) { return Math.max(0, ...state.data.methods.map((_, i) => methodData(s, i).steps?.length || 0)); }
function statusNode(value) { return el('span', (state.data.isDemo ? '示例 · ' : '') + labels[value], 'status ' + (state.data.isDemo ? 'demo' : value)); }
function download(name, content, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function setURL() {
  const url = new URL(location.href);
  if (!state.imported && state.selected) { url.searchParams.set('sample', state.selected); url.searchParams.set('step', state.step); }
  else { url.searchParams.delete('sample'); url.searchParams.delete('step'); }
  history.replaceState(null, '', url);
}
function renderSummary() {
  const d = state.data; const stats = summarize(d);
  setText('#dataset-name', d.title);
  $('#mode-banner').classList.toggle('real-data', !d.isDemo);
  setText('.demo-tag', d.isDemo ? '交互示例' : '实验数据');
  setText('#mode-text', d.isDemo ? '当前为程序生成的界面示例，尚未接入实验结果；所有评测指标留空。' : `${d.title} · ${d.samples.length} 条样本${state.imported ? ' · 本地导入，仅在当前浏览器中读取' : ''}`);
  $('#reset-demo').hidden = !state.imported;
  setText('#stat-total', stats ? stats.total : '—');
  setText('#stat-total-note', stats ? '完整数据集，包含未裁定样本' : '等待接入真实数据');
  setText('#stat-paired', stats ? stats.paired : '—');
  sides.forEach((side, i) => {
    const m = d.methods[i]; setText(`#${side}-summary-label`, m.name + ' 通过率'); setText(`#${side}-name`, m.name); setText(`#${side}-revision`, textValue(m.revision));
    setText(`#${side}-table-label`, m.name); setText(`#${side}-code-label`, m.name);
    const item = stats?.methods[i]; setText(`#stat-${side}`, stats?.total ? (100 * item.pass / stats.total).toFixed(1) + '%' : '—');
    setText(`#stat-${side}-note`, stats ? `${item.pass} 通过 / ${stats.total} 总数 · ${item.unknown} 未裁定` : '按完整样本分母统计');
  });
  setText('#collection-status', d.isDemo ? '界面示例 · 非实验结果' : '完整样本索引');
  setText('#protocol-description', textValue(d.description, '请随数据注明实验条件、评测版本和判定规则。'));
  setText('#metric-definition', textValue(d.metricDefinition, '指标定义未提供；请勿跨实验直接比较 CD 数值。'));
  setText('#provenance', textValue(d.provenance));
  setText('#table-caption', d.isDemo ? '示例仅用于展示交互，指标不参与统计。' : '总表跟随筛选；顶部汇总始终保留完整数据分母。');
}
function install(data, imported = false, fromURL = false) {
  validateDataset(data); stop(); state.data = data; state.imported = imported; state.page = 0;
  $('#search').value = ''; $('#category').replaceChildren(new Option('全部类型', 'all')); $('#outcome').value = 'all';
  const categories = data.samples.map(s => textValue(s.category, '未分类'));
  for (const c of [...new Set(categories)].sort()) $('#category').append(new Option(c, c));
  const q = new URLSearchParams(location.search); state.selected = fromURL ? q.get('sample') : null;
  renderSummary(); filter(true);
  if (fromURL && sample() && q.has('step')) { const raw = Number(q.get('step')); if (Number.isInteger(raw) && raw >= 0) setStep(raw); }
  error('');
}
function filter(resetStep = false) {
  if (!state.data) return;
  stop(); const query = $('#search').value.trim().toLowerCase(); const category = $('#category').value; const outcome = $('#outcome').value;
  state.filtered = state.data.samples.filter(s => (!query || `${s.id} ${s.title} ${textValue(s.description)}`.toLowerCase().includes(query)) && (category === 'all' || textValue(s.category, '未分类') === category) && (outcome === 'all' || pairType(s, state.data.methods) === outcome));
  state.page = 0;
  setText('#sample-count', `${state.data.samples.length} 个${state.data.isDemo ? '示例' : '样本'}`);
  setText('#filtered-count', `${String(state.filtered.length).padStart(2, '0')} / ${String(state.data.samples.length).padStart(2, '0')}`);
  const selected = state.filtered.find(s => s.id === state.selected) || state.filtered[0];
  if (selected) choose(selected.id, resetStep || selected.id !== state.selected);
  else { state.selected = null; $('#sample-content').hidden = true; $('#empty-state').hidden = false; renderList(); renderTable(); setURL(); }
}
function renderList() {
  const list = $('#sample-list'); list.replaceChildren();
  for (const s of state.filtered) {
    const button = el('button', undefined, 'sample-item' + (s.id === state.selected ? ' selected' : ''));
    button.setAttribute('aria-pressed', String(s.id === state.selected));
    const icon = el('span', undefined, 'sample-glyph'); icon.innerHTML = glyph;
    const text = el('span', undefined, 'item-text'); text.append(el('span', s.id, 'item-id'), el('span', s.title, 'item-title'), el('span', textValue(s.category, '未分类'), 'item-category'));
    button.append(icon, text, el('span', '›', 'item-chevron')); button.onclick = () => choose(s.id); list.append(button);
  }
  if (!state.filtered.length) list.append(el('p', '没有匹配的样本', 'empty-list'));
}
function choose(id, resetStep = true) {
  stop(); const s = state.data.samples.find(s => s.id === id); if (!s) return;
  state.selected = id; if (resetStep) state.step = Math.max(0, stepCount(s) - 1);
  $('#sample-content').hidden = false; $('#empty-state').hidden = true;
  setText('#sample-id', (state.data.isDemo ? 'DEMO / ' : 'SAMPLE / ') + s.id);
  setText('#sample-title', s.title); setText('#sample-description', textValue(s.description));
  const index = state.filtered.findIndex(item => item.id === id);
  setText('#sample-position', `${String(index + 1).padStart(2, '0')} / ${String(state.filtered.length).padStart(2, '0')}`);
  $('#previous').disabled = index <= 0; $('#next').disabled = index < 0 || index >= state.filtered.length - 1;
  sides.forEach((side, i) => {
    const m = methodData(s, i); const n = statusNode(m.status); n.id = side + '-status'; $(`#${side}-status`).replaceWith(n);
    for (const key of ['cd', 'iou', 'time']) setText(`#${side}-${key}`, state.data.isDemo ? '—' : number(m.metrics?.[key === 'time' ? 'seconds' : key], key === 'time' ? 2 : 4));
    setText(`#${side}-message`, state.data.isDemo ? '程序生成的示例几何 · 状态与代码仅供体验交互' : textValue(m.message, '未提供运行说明'));
  });
  renderList(); renderTable(); renderStep(true); renderAssets();
}
function setStep(index) { const s = sample(); if (!s) return; state.step = Math.max(0, Math.min(index, stepCount(s) - 1)); renderStep(false); }
function renderStep(resetView) {
  const s = sample(); if (!s) return; const count = stepCount(s); const container = $('#steps'); container.replaceChildren();
  for (let index = 0; index < count; index++) {
    const a = methodData(s, 0).steps?.[index], b = methodData(s, 1).steps?.[index];
    const title = a?.label === b?.label ? a.label : `步骤 ${index + 1}`;
    const button = el('button', undefined, 'step-button' + (index === state.step ? ' active' : ''));
    button.setAttribute('aria-pressed', String(index === state.step)); button.append(el('span', String(index + 1).padStart(2, '0'), 'step-number'), el('span', title));
    button.onclick = () => { stop(); setStep(index); }; container.append(button);
  }
  if (!count) container.append(el('p', '尚未提供操作步骤', 'muted'));
  setText('#step-position', count ? `${state.step + 1} / ${count}` : '0 / 0'); $('#play-steps').disabled = count < 2;
  const steps = state.data.methods.map((_, i) => stepAt(methodData(s, i)));
  sides.forEach((side, i) => {
    setText(`#${side}-code`, steps[i]?.code || '此步骤尚未提供代码。');
    const total = methodData(s, i).steps?.length || 0;
    setText(`#${side}-code-label`, `${state.data.methods[i].name} · ${steps[i]?.label || '无步骤'}${total && state.step >= total ? ' · 保持最后步骤' : ''}`);
  });
  const evidence = $('#detail-evidence'); evidence.replaceChildren();
  steps.forEach((step, i) => {
    const entries = step?.evidence?.length ? step.evidence : ['此步骤没有附加证据。'];
    for (const item of entries) { const row = el('div', undefined, 'evidence-item'); row.append(el('span', state.data.methods[i].name, 'evidence-label'), el('p', item)); evidence.append(row); }
  });
  viewer.show(steps.map(s => s?.geometry || null), state.data.isDemo, resetView).catch(e => error(e.message));
  setURL();
}
function renderAssets() {
  const s = sample(); const container = $('#detail-assets'); container.replaceChildren();
  const sampleDownload = el('button', '↓ 当前样本 JSON', 'asset-link'); sampleDownload.onclick = () => download('cadkg-sample.json', JSON.stringify({ ...state.data, samples: [s] }, null, 2)); container.append(sampleDownload);
  state.data.methods.forEach((m, i) => {
    for (const asset of methodData(s, i).assets || []) {
      try { const a = el('a', `↓ ${m.name} / ${asset.name}`, 'asset-link'); a.href = assetURL(asset.url); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.download = ''; container.append(a); }
      catch { container.append(el('p', `${asset.name}：资源地址无效`, 'muted')); }
    }
  });
  container.append(el('p', state.data.isDemo ? '示例没有真实实验附件。导入数据后可在这里下载模型、日志和代码。' : '附件使用数据文件提供的地址。相对地址以当前网页目录为基准。', 'trace-note'));
}
function renderTable() {
  const body = $('#result-rows'); body.replaceChildren(); const pages = Math.max(1, Math.ceil(state.filtered.length / 10)); state.page = Math.min(state.page, pages - 1);
  for (const s of state.filtered.slice(state.page * 10, state.page * 10 + 10)) {
    const tr = el('tr'); if (s.id === state.selected) tr.className = 'selected';
    const title = el('td', s.title); title.append(el('span', s.id, 'table-id')); tr.append(title, el('td', textValue(s.category, '未分类')));
    for (let i = 0; i < 2; i++) { const td = el('td'); td.append(statusNode(methodData(s, i).status)); tr.append(td); }
    for (let i = 0; i < 2; i++) tr.append(el('td', state.data.isDemo ? '—' : number(methodData(s, i).metrics?.cd), 'numeric'));
    const td = el('td'); const button = el('button', '查看 ↗'); button.onclick = () => { choose(s.id); $('#workspace').scrollIntoView({ behavior: 'smooth' }); }; td.append(button); tr.append(td); body.append(tr);
  }
  setText('#table-count', `${state.filtered.length} 条${state.data.isDemo ? '示例' : '记录'}`);
  setText('#page-label', `${state.page + 1} / ${pages}`); $('#page-prev').disabled = state.page === 0; $('#page-next').disabled = state.page >= pages - 1; $('#table-empty').hidden = state.filtered.length > 0;
}
function resetFilters() { $('#search').value = ''; $('#category').value = 'all'; $('#outcome').value = 'all'; filter(); }
async function loadDefault() {
  const serial = ++state.loadSerial;
  try { const r = await fetch('./data/experiment.json'); if (!r.ok) throw new Error(`数据加载失败（HTTP ${r.status}）`); const d = await r.json(); if (serial === state.loadSerial) install(d, false, true); }
  catch (e) { if (serial === state.loadSerial) { error(e.message + '。请通过 HTTP 服务打开页面，或点击“导入实验”。'); $('#sample-content').hidden = true; $('#empty-state').hidden = false; } }
}
$('#search').oninput = () => filter(); $('#category').onchange = () => filter(); $('#outcome').onchange = () => filter();
$('#clear-filters').onclick = resetFilters; $('#empty-reset').onclick = resetFilters;
$('#previous').onclick = () => { const i = state.filtered.findIndex(s => s.id === state.selected); if (i > 0) choose(state.filtered[i - 1].id); };
$('#next').onclick = () => { const i = state.filtered.findIndex(s => s.id === state.selected); if (i >= 0 && i + 1 < state.filtered.length) choose(state.filtered[i + 1].id); };
$('#page-prev').onclick = () => { state.page--; renderTable(); }; $('#page-next').onclick = () => { state.page++; renderTable(); };
$('#sync-camera').onchange = e => { viewer.sync = e.target.checked; if (viewer.sync && viewer.views[0]) viewer.syncFrom(viewer.views[0]); };
$('#reset-camera').onclick = () => viewer.reset();
$$('[data-view]').forEach(button => { button.onclick = () => { $$('[data-view]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); viewer.setWire(button.dataset.view === 'wire'); }; });
$('#play-steps').onclick = () => { if (state.timer) return stop(); if (!sample() || stepCount(sample()) < 2) return; if (state.step >= stepCount(sample()) - 1) setStep(0); setText('#play-steps', 'Ⅱ 暂停浏览'); state.timer = setInterval(() => { if (state.step >= stepCount(sample()) - 1) stop(); else setStep(state.step + 1); }, 1600); };
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
function selectTab(button) { $$('[data-tab]').forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1; $('#detail-' + b.dataset.tab).hidden = !active; }); }
$$('[data-tab]').forEach((button, index, buttons) => { button.onclick = () => selectTab(button); button.onkeydown = e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length; selectTab(buttons[next]); buttons[next].focus(); }; });
$('#copy-link').onclick = async () => { if (state.imported) return toast('本地导入的数据尚未发布；可在“文件下载”导出当前样本。'); try { await navigator.clipboard.writeText(location.href); toast('已复制当前样本和步骤的链接'); } catch { toast('可直接复制地址栏中的样本链接'); } };
$('#template').onclick = async () => { try { const r = await fetch('./data/template.json'); if (!r.ok) throw Error('模板加载失败'); download('cadkg-experiment-template.json', await r.text()); } catch (e) { error(e.message); } };
$('#import').onclick = () => $('#file-input').click();
$('#file-input').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  const serial = ++state.loadSerial;
  try { if (file.size > 12 * 1024 * 1024) throw Error('JSON 文件请控制在 12 MB 内'); const d = JSON.parse(await file.text()); validateDataset(d); if (serial === state.loadSerial) { install(d, true); toast('已导入：' + d.title); } }
  catch (e) { if (serial === state.loadSerial) error('导入失败：' + e.message); } finally { $('#file-input').value = ''; }
};
$('#reset-demo').onclick = loadDefault;
$('#export-csv').onclick = () => {
  if (!state.data) return;
  const rows = [['is_demo', 'sample_id', 'title', 'category', ...state.data.methods.flatMap(m => [m.id + '_status', m.id + '_cd', m.id + '_iou', m.id + '_seconds'])]];
  for (const s of state.filtered) rows.push([state.data.isDemo, s.id, s.title, textValue(s.category), ...state.data.methods.flatMap((_, i) => { const m = methodData(s, i); return [m.status, ...(state.data.isDemo ? [null, null, null] : [m.metrics?.cd, m.metrics?.iou, m.metrics?.seconds])]; })]);
  download('cadkg-results.csv', '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};
window.cadkgDashboard = { getState: () => ({ sample: state.selected, step: state.step, filtered: state.filtered.length, isDemo: state.data?.isDemo, imported: state.imported }), viewer };
loadDefault();
