// Hand for the try-on: a real 3D hand model (back of a right hand, fingers up), lit and tinted to the chosen skin tone.
// The model is the WebXR "generic-hand" (MIT, Amazon, @webxr-input-profiles/assets), vendored in assets/.
// It is drawn with an orthographic camera in view-box units (x right, y down), so the ring overlay lines up with it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LoopSubdivision } from 'three-subdivide';
import { useEffect, useRef } from 'preact/hooks';
import { html } from '../lib/html.js';

export const SKIN_TONES = [
  { id: 0, name: 'Light', skin: '#f1cdb6' },
  { id: 1, name: 'Light medium', skin: '#dba582' },
  { id: 2, name: 'Medium', skin: '#bd8058' },
  { id: 3, name: 'Medium deep', skin: '#8a573a' },
  { id: 4, name: 'Deep', skin: '#5a3825' },
];

export const VIEW = { w: 400, h: 560 };
export const FULL = { x: 30, y: 70, w: 340, h: 480 };
const BROAD = 1.12; // the broad hand is the same model, wider
const SCALE = 1950; // view-box units per metre of the model
const FINGERS = ['index', 'middle', 'ring', 'pinky'];
const SPREAD = { index: -5, ring: 4, pinky: 9 }; // degrees from the middle finger: a relaxed hand, fingers nearly together

// Where a ring sits on each finger of the slender hand (view-box units), and how wide the finger is there.
// Measured from the posed model with measureAnchors(); rerun it if the pose or SCALE changes.
const ANCHORS = {
  index: { x: 182.9, y: 238.1, angle: -5.9, width: 33.4 },
  middle: { x: 229.6, y: 225.6, angle: -0.6, width: 32.2 },
  ring: { x: 272.1, y: 240.1, angle: 3.6, width: 29.2 },
  pinky: { x: 311.5, y: 252.5, angle: 6.3, width: 26.5 },
};

/** Where a ring sits on the finger, in view-box units. */
export function ringAnchor(build, finger) {
  const a = ANCHORS[finger];
  if (build !== 'broad') return a;
  return { ...a, x: 200 + (a.x - 200) * BROAD, width: a.width * BROAD };
}

/** A tight crop centred on the ring, for the close-up view. */
export function closeUp(build, finger) {
  const a = ringAnchor(build, finger);
  return { x: a.x - 85, y: a.y - 120, w: 170, h: 230 };
}

let loading;
/**
 * Loads the model once and poses it: fingers together, back to the camera, in view-box units (y up, as three.js has it).
 * The pose is baked into a plain mesh and smoothed twice, because the model is low-poly and its fingertips come out flat.
 */
function loadHand() {
  return (loading ??= new GLTFLoader().loadAsync(new URL('../../assets/hand-right.glb', import.meta.url).href).then(({ scene }) => {
    const bones = {};
    scene.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) o.frustumCulled = false;
    });
    // All joints hang straight off the armature, so a finger turns by moving its joints round its knuckle.
    const P = (n) => bones[n].position;
    const axis = (f) => new THREE.Vector3().subVectors(P(`${f}-finger-tip`), P(`${f}-finger-phalanx-proximal`)).normalize();
    const N = new THREE.Vector3().subVectors(P('index-finger-phalanx-proximal'), P('pinky-finger-phalanx-proximal')).cross(axis('middle')).normalize();
    for (const [f, deg] of Object.entries(SPREAD)) {
      const mid = axis('middle'), d = axis(f);
      const now = Math.atan2(new THREE.Vector3().crossVectors(mid, d).dot(N), mid.dot(d));
      const q = new THREE.Quaternion().setFromAxisAngle(N, (deg * Math.PI) / 180 - now);
      const pivot = P(`${f}-finger-phalanx-proximal`).clone();
      for (const k of ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip']) {
        const b = bones[`${f}-finger-${k}`];
        b.position.sub(pivot).applyQuaternion(q).add(pivot);
        b.quaternion.premultiply(q);
      }
    }
    // Fingers up, back of the hand to the camera (thumb on the left), y flipped to view-box units.
    const hand = new THREE.Group();
    hand.add(scene);
    hand.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
    hand.scale.setScalar(SCALE);
    hand.updateMatrixWorld(true);
    // Stand the middle finger straight up.
    const up = bones['middle-finger-tip'].getWorldPosition(new THREE.Vector3()).sub(bones['middle-finger-phalanx-proximal'].getWorldPosition(new THREE.Vector3()));
    hand.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(up.x, up.y)));
    hand.updateMatrixWorld(true);
    const skinned = scene.getObjectByProperty('isSkinnedMesh', true);
    const pos = [];
    for (let i = 0, v = new THREE.Vector3(); i < skinned.geometry.attributes.position.count; i++) pos.push(...skinned.getVertexPosition(i, v).applyMatrix4(skinned.matrixWorld).toArray());
    let geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setIndex(skinned.geometry.index);
    geometry = LoopSubdivision.modify(mergeVertices(geometry), 2, { split: false });
    geometry.computeVertexNormals();
    // Centre it across the frame, fingertips just under the top.
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox, shift = new THREE.Vector3(200 - (min.x + max.x) / 2, -92 - max.y, 0);
    geometry.translate(shift.x, shift.y, 0);
    const joint = (n) => bones[n].getWorldPosition(new THREE.Vector3()).add(shift);
    return { geometry, joint };
  }));
}

/** Ring position and finger width for each finger of the posed slender hand. Paste the result into ANCHORS. */
export async function measureAnchors() {
  const { geometry, joint } = await loadHand();
  const view = (v) => new THREE.Vector2(v.x, -v.y);
  const p3 = geometry.attributes.position, verts = [];
  for (let i = 0; i < p3.count; i++) verts.push(new THREE.Vector2(p3.getX(i), -p3.getY(i)));
  const out = {};
  for (const f of FINGERS) {
    const a = view(joint(`${f}-finger-phalanx-proximal`));
    const b = view(joint(`${f}-finger-phalanx-intermediate`));
    const p = a.clone().lerp(b, f === 'pinky' ? 0.85 : 0.62);
    const along = b.clone().sub(a).normalize(), across = new THREE.Vector2(-along.y, along.x);
    // The finger's width there: the spread of mesh points in a thin slice across it, keeping points nearer this finger than its neighbours.
    const axes = FINGERS.filter((g) => g !== f).map((g) => {
      const o = view(joint(`${g}-finger-phalanx-proximal`)), e = view(joint(`${g}-finger-phalanx-intermediate`)).sub(o).normalize();
      return (v) => Math.abs(v.clone().sub(o).cross(e));
    });
    const slice = verts.map((v) => v.clone().sub(p)).filter((d) => Math.abs(d.dot(along)) < 3 && axes.every((dist) => dist(d.clone().add(p)) > Math.abs(d.dot(across)))).map((d) => d.dot(across));
    out[f] = { x: +p.x.toFixed(1), y: +p.y.toFixed(1), angle: +((Math.atan2(along.x, -along.y) * 180) / Math.PI).toFixed(1), width: +(Math.max(...slice) - Math.min(...slice)).toFixed(1) };
  }
  // The wrist, so the sleeve can cover where the model ends.
  const wrist = verts.filter((v) => Math.abs(v.y - 480) < 4).map((v) => v.x);
  out.wrist = [Math.min(...wrist), Math.max(...wrist), Math.max(...verts.map((v) => v.y))].map((v) => +v.toFixed(1));
  return out;
}

export function Hand({ tone = 1, build = 'slender', crop = FULL, className = '' }) {
  const canvas = useRef();
  const gl = useRef(null);
  const props = useRef();
  props.current = { tone, build, crop };

  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas.current, antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff6ee, 0x6b4a3a, 1.6));
    const key = new THREE.DirectionalLight(0xfff1e4, 2.6);
    key.position.set(-1.2, 1.6, 2);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.1);
    rim.position.set(1.5, -0.4, -1);
    scene.add(key, rim);
    const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
    camera.position.z = 1000;
    const material = new THREE.MeshPhysicalMaterial({ roughness: 0.62, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffd9c4') });
    const wide = new THREE.Group();
    scene.add(wide);

    const draw = () => {
      const el = canvas.current;
      if (!el || !el.clientWidth) return;
      const { tone, build, crop } = props.current;
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      // Same fit as an SVG viewBox with xMidYMid meet, which the try-on screen assumes.
      const s = Math.min(w / crop.w, h / crop.h), cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
      Object.assign(camera, { left: cx - w / s / 2, right: cx + w / s / 2, top: -(cy - h / s / 2), bottom: -(cy + h / s / 2) });
      camera.updateProjectionMatrix();
      const k = build === 'broad' ? BROAD : 1;
      wide.scale.set(k, 1, 1);
      wide.position.x = 200 * (1 - k);
      material.color.set(SKIN_TONES[tone].skin);
      renderer.render(scene, camera);
    };
    gl.current = { draw };
    let alive = true;
    loadHand().then(({ geometry }) => {
      if (!alive) return;
      wide.add(new THREE.Mesh(geometry, material));
      draw();
    });
    const ro = new ResizeObserver(draw);
    ro.observe(canvas.current);
    return () => {
      alive = false;
      ro.disconnect();
      wide.clear();
      material.dispose();
      renderer.dispose();
    };
  }, []);
  useEffect(() => gl.current?.draw(), [tone, build, crop.x, crop.y, crop.w, crop.h]);

  return html`<div class=${'hand ' + className} aria-hidden="true">
    <canvas ref=${canvas}></canvas>
    <svg viewBox=${`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} preserveAspectRatio="xMidYMid meet">
      <g transform=${build === 'broad' ? `translate(${200 * (1 - BROAD)} 0) scale(${BROAD} 1)` : ''}>
        <path class="sleeve" d="M194 472 C214 463 298 463 318 472 L326 584 L186 584 Z" />
        <path d="M194 472 C214 463 298 463 318 472" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2" />
        ${[214, 233, 252, 271, 290].map((x) => html`<line x1=${x} y1="470" x2=${x} y2="584" stroke="#000" stroke-opacity=".14" stroke-width="2" key=${x} />`)}
      </g>
    </svg>
  </div>`;
}
