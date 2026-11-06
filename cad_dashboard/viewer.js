import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { STLLoader } from './vendor/STLLoader.js';

export function assetURL(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('资源地址为空');
  const url = new URL(value, document.baseURI);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('资源必须使用 HTTP(S) 或相对路径');
  return url.href;
}

function ringShape(outer, inner, holes = 0, offset = 0) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const center = new THREE.Path();
  center.absarc(offset, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(center);
  for (let i = 0; i < holes; i++) {
    const a = Math.PI / 4 + i * Math.PI * 2 / holes;
    const hole = new THREE.Path();
    hole.absarc(Math.cos(a) * outer * .73, Math.sin(a) * outer * .73, .105, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

function demoModel(spec, color) {
  const group = new THREE.Group();
  const stage = Math.max(0, Math.min(3, Number(spec.stage) || 0));
  const fixed = spec.variant === 'corrected';
  const mat = new THREE.MeshStandardMaterial({ color, metalness: .24, roughness: .38, side: THREE.DoubleSide });
  const mesh = (geometry, x = 0, y = 0, z = 0) => {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(x, y, z); item.castShadow = true; item.receiveShadow = true;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), new THREE.LineBasicMaterial({ color: color === 0xa7baf0 ? 0xc3d1fa : 0xb9f5de, transparent: true, opacity: .25 }));
    item.add(edge); group.add(item); return item;
  };
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: stage > 0, bevelSegments: 2, steps: 1, bevelSize: .018, bevelThickness: .018, curveSegments: 48 });
  if (spec.shape === 'bracket') {
    mesh(new THREE.BoxGeometry(2.1, 1.7, stage ? .22 : .018), 0, 0, .11);
    if (stage > 0) mesh(new THREE.BoxGeometry(2.1, .22, fixed ? 1.65 : 1.05), 0, .74, fixed ? .93 : .63);
    if (stage > 1) {
      for (const x of [-.68, .68]) mesh(extrude(ringShape(.22, .105), .14), x, -.3, .22);
    }
    if (stage > 2 && fixed) {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.85, 0); s.lineTo(.85, 1.1); s.closePath();
      const brace = mesh(extrude(s, .12)); brace.rotation.x = Math.PI / 2; brace.rotation.z = Math.PI / 2; brace.position.set(-.7, -.04, .23);
    }
  } else if (spec.shape === 'plate') {
    const shape = new THREE.Shape();
    shape.moveTo(-1.2, -.85); shape.lineTo(1.2, -.85); shape.lineTo(1.2, .85); shape.lineTo(-1.2, .85); shape.closePath();
    if (stage > 1) {
      for (const x of [-.8, .8]) for (const y of [-.48, .48]) {
        const h = new THREE.Path(); h.absarc(x, y + (fixed ? 0 : .17), .16, 0, Math.PI * 2, true); shape.holes.push(h);
      }
      const h = new THREE.Path(); h.absarc(0, 0, .38, 0, Math.PI * 2, true); shape.holes.push(h);
    }
    mesh(extrude(shape, stage ? (fixed ? .28 : .48) : .015));
  } else {
    mesh(extrude(ringShape(1.17, stage > 1 ? (fixed ? .38 : .24) : .001, stage > 1 ? 4 : 0), stage ? .23 : .015));
    if (stage > 0) mesh(extrude(ringShape(.66, stage > 1 ? (fixed ? .38 : .24) : .001), stage > 2 ? .62 : .37), 0, 0, .23);
    if (stage > 2) mesh(extrude(ringShape(.71, fixed ? .38 : .24), .09), 0, 0, .78);
  }
  return group;
}

function disposeObject(obj) {
  const materials = new Set();
  obj.traverse(child => { child.geometry?.dispose(); if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => materials.add(m)); });
  materials.forEach(m => m.dispose());
}

class ModelView {
  constructor(element, color, changed) {
    this.element = element; this.color = color; this.placeholder = element.querySelector('.viewer-placeholder');
    this.scene = new THREE.Scene(); this.content = new THREE.Group(); this.scene.add(this.content);
    this.camera = new THREE.PerspectiveCamera(34, 1, .01, 500); this.camera.up.set(0, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', 'CAD 三维模型');
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false; this.controls.minDistance = 1; this.controls.maxDistance = 30;
    this.controls.addEventListener('change', () => { this.render(); changed(this); });
    this.scene.add(new THREE.AmbientLight(0xbecfe6, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 3.5); key.position.set(-3, -4, 7); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.normalBias = .035;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9bbdff, 1.5); fill.position.set(4, 3, 4); this.scene.add(fill);
    this.grid = new THREE.GridHelper(12, 32, 0x3b4c60, 0x293747); this.grid.rotation.x = Math.PI / 2; this.grid.position.z = -.028;
    this.grid.material.transparent = true; this.grid.material.opacity = .4; this.scene.add(this.grid);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ color: 0x000000, opacity: .22 })); this.floor.receiveShadow = true; this.floor.position.z = -.024; this.scene.add(this.floor);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(element); this.resize();
  }
  resize() { const w = this.element.clientWidth, h = this.element.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.render(); }
  render() { this.renderer.render(this.scene, this.camera); }
  clear() { for (const obj of [...this.content.children]) { this.content.remove(obj); disposeObject(obj); } }
  message(text) { this.placeholder.textContent = text || ''; this.placeholder.hidden = !text; }
  setWire(wire) { this.content.traverse(obj => { if (obj.isMesh) obj.material.wireframe = wire; }); this.render(); }
  reset() { this.camera.position.set(3.2, -4.3, 3.1); this.controls.target.set(0, 0, .55); this.controls.update(); this.render(); }
}

export class PairedViewer {
  constructor(left, right) {
    this.serial = 0; this.sync = true; this.lock = false; this.wire = false; this.views = [];
    try {
      this.views.push(new ModelView(left, 0xa7baf0, v => this.syncFrom(v)));
      this.views.push(new ModelView(right, 0x86d9be, v => this.syncFrom(v)));
      this.views.forEach(v => v.reset());
    } catch (error) {
      this.unavailable = true;
      [left, right].forEach(el => { const msg = el.querySelector('.viewer-placeholder'); msg.hidden = false; msg.textContent = '当前浏览器不支持 WebGL，仍可查看代码、指标和证据。'; });
    }
  }
  syncFrom(source) {
    if (!this.sync || this.lock) return;
    this.lock = true;
    for (const v of this.views) if (v !== source) {
      v.camera.position.copy(source.camera.position); v.camera.quaternion.copy(source.camera.quaternion);
      v.controls.target.copy(source.controls.target); v.controls.update(); v.render();
    }
    this.lock = false;
  }
  reset() { this.views.forEach(v => v.reset()); }
  setWire(value) { this.wire = value; this.views.forEach(v => v.setWire(value)); }
  async show(specs, isDemo, reset = false) {
    if (this.unavailable) return;
    const version = ++this.serial;
    this.views.forEach(v => { v.clear(); v.message('正在读取模型…'); });
    const results = await Promise.allSettled(specs.map(async (spec, i) => {
      if (!spec) return null;
      if (spec.kind === 'demo') {
        if (!isDemo) throw new Error('真实实验不能使用示例模型');
        return demoModel(spec, this.views[i].color);
      }
      if (spec.kind !== 'stl') throw new Error('当前三维视图支持 STL 文件');
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
      let geometry;
      try {
        const response = await fetch(assetURL(spec.url), { signal: controller.signal });
        if (!response.ok) throw new Error(`模型载入失败（HTTP ${response.status}）`);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 50 * 1024 * 1024) throw new Error('单个 STL 请控制在 50 MB 内');
        geometry = new STLLoader().parse(buffer);
        const pos = geometry.getAttribute('position');
        if (!pos || !pos.count || !pos.array.every(Number.isFinite)) { geometry.dispose(); throw new Error('STL 几何为空或含无效坐标'); }
        geometry.computeVertexNormals();
      } finally { clearTimeout(timeout); }
      const obj = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: this.views[i].color, metalness: .15, roughness: .45, side: THREE.DoubleSide })); obj.castShadow = true; obj.receiveShadow = true; return obj;
    }));
    if (version !== this.serial) { for (const r of results) if (r.status === 'fulfilled' && r.value) disposeObject(r.value); return; }
    const bounds = new THREE.Box3();
    for (const r of results) if (r.status === 'fulfilled' && r.value) bounds.union(new THREE.Box3().setFromObject(r.value));
    const size = bounds.isEmpty() ? new THREE.Vector3(1, 1, 1) : bounds.getSize(new THREE.Vector3());
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const scale = 2.5 / Math.max(size.x, size.y, size.z, .000001);
    results.forEach((r, i) => {
      const v = this.views[i];
      if (r.status === 'rejected') { v.message(r.reason?.message || '模型载入失败'); v.render(); return; }
      if (!r.value) { v.message('该步骤尚未提供模型文件'); v.render(); return; }
      const obj = r.value; obj.scale.multiplyScalar(scale); obj.position.set(-center.x * scale, -center.y * scale, -bounds.min.z * scale);
      v.content.add(obj); v.message(''); v.setWire(this.wire); if (reset) v.reset(); else v.render();
    });
  }
}
