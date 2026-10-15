// three.js scene wrapper for the ring. Modes:
//   studio – perspective, orbit controls, band runs top-to-bottom like the original sketch
//   hero   – perspective, slow auto-rotate
//   tryon  – orthographic, transparent, ring sits on a finger (an invisible occluder hides its back half)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(40,30,20,0.38)');
  grad.addColorStop(1, 'rgba(40,30,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class RingViewer {
  constructor(el, { mode = 'studio', autoRotate = false, zoom = mode !== 'hero' } = {}) {
    this.el = el;
    this.mode = mode;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    el.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.env;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(30, 60, 50);
    this.scene.add(key, new THREE.AmbientLight(0xfff6ea, 0.25));

    this.camera =
      mode === 'tryon' ? new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000) : new THREE.PerspectiveCamera(28, 1, 0.1, 2000);

    this.pivot = new THREE.Group();
    this.holder = new THREE.Group();
    this.pivot.add(this.holder);
    this.scene.add(this.pivot);

    this.material = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 1, roughness: 0.2, envMapIntensity: 1.15 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.holder.add(this.mesh);

    if (mode === 'tryon') {
      this.occluder = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 400, 48, 1, true),
        new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide })
      );
      this.occluder.renderOrder = -1;
      this.holder.add(this.occluder);
      this.holder.rotation.x = 0.32;
      this.camera.position.set(0, 0, 300);
      // Face-on view reflects the dark part of the room, so add a soft front light.
      const front = new THREE.DirectionalLight(0xfff4e6, 1.3);
      front.position.set(-20, 40, 100);
      this.scene.add(front);
      this.material.envMapIntensity = 1.5;
    } else {
      // Ring axis horizontal, band face running vertically, tipped so the opening shows on the left.
      this.holder.rotation.z = -Math.PI / 2;
      this.pivot.rotation.set(0.12, 0.55, 0);
      this.shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
      );
      this.shadow.rotation.x = -Math.PI / 2;
      this.scene.add(this.shadow);

      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.enablePan = false;
      this.controls.rotateSpeed = 0.8;
      this.controls.autoRotate = autoRotate && !reducedMotion();
      this.controls.autoRotateSpeed = 1.6;
      this.controls.enableZoom = zoom;
    }

    this.size = 0;
    this.visible = true;
    this.resize = this.resize.bind(this);
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(el);
    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting));
    this.io.observe(el);
    this.resize();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (!this.visible || document.hidden) return;
      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  setGeometry(geom, innerD, outerD) {
    const old = this.mesh.geometry;
    this.mesh.geometry = geom;
    old.dispose();
    if (this.occluder) this.occluder.scale.set((innerD / 2) * 0.995, 1, (innerD / 2) * 0.995);
    if (Math.abs(outerD - this.size) > 0.5) {
      const first = !this.size;
      this.size = outerD;
      this.fit(first);
    }
  }

  fit(resetAngle = false) {
    if (this.mode === 'tryon') return;
    const D = this.size || 22;
    const dist = (D / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * (this.mode === 'hero' ? 1.65 : 1.55);
    const dir = resetAngle ? new THREE.Vector3(0, 0.16, 1).normalize() : this.camera.position.clone().normalize();
    this.camera.position.copy(dir.multiplyScalar(dist));
    this.camera.lookAt(0, 0, 0);
    this.controls.minDistance = dist * 0.3;
    this.controls.maxDistance = dist * 2.2;
    this.shadow.position.y = -D / 2 - 2.5;
    this.shadow.scale.setScalar(D * 1.25);
    this.controls.update();
  }

  resetView() {
    this.fit(true);
  }

  /** Dolly the camera; factor < 1 moves closer. */
  zoomBy(factor) {
    if (!this.controls) return;
    const c = this.controls;
    const d = THREE.MathUtils.clamp(this.camera.position.length() * factor, c.minDistance, c.maxDistance);
    this.camera.position.setLength(d);
    c.update();
  }

  setAutoRotate(on) {
    if (this.controls) this.controls.autoRotate = on && !reducedMotion();
  }

  setLook({ color, metalness, roughness }) {
    this.material.color.set(color);
    this.material.metalness = metalness;
    this.material.roughness = roughness;
    this.material.needsUpdate = true;
  }

  /** Try-on: pixels per millimetre and the finger angle (radians). */
  setTryOn({ pxPerMM, angle = 0 }) {
    this.pxPerMM = pxPerMM;
    this.pivot.rotation.z = angle;
    this.resize();
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    if (this.mode === 'tryon') {
      const s = this.pxPerMM || 10;
      Object.assign(this.camera, { left: -w / 2 / s, right: w / 2 / s, top: h / 2 / s, bottom: -h / 2 / s });
    } else {
      this.camera.aspect = w / h;
    }
    this.camera.updateProjectionMatrix();
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    this.controls?.dispose();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }
}
