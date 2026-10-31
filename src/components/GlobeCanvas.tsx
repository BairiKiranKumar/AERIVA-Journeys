import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { destinationById, type DestinationId } from '../data/destinations';

export type JourneyStage = 0 | 1 | 2;

type Props = {
  stage: JourneyStage;
  destinationId: DestinationId;
  reducedMotion: boolean;
  onTap: () => void;
};

const TWO_PI = 2 * Math.PI;

// Uses the same UV convention as THREE.SphereGeometry.
function spherePoint(latitude: number, longitude: number, radius: number) {
  const phi = ((longitude + 180) * Math.PI) / 180;
  const theta = ((90 - latitude) * Math.PI) / 180;
  return new THREE.Vector3(
    -Math.cos(phi) * Math.sin(theta) * radius,
    Math.cos(theta) * radius,
    Math.sin(phi) * Math.sin(theta) * radius,
  );
}

function closestAngle(current: number, target: number) {
  let diff = ((target - current + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  if (Math.abs(diff) < 0.0001) diff = 0;
  return current + diff;
}

export default function GlobeCanvas({ stage, destinationId, reducedMotion, onTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ stage, destinationId, reducedMotion, onTap });
  stateRef.current = { stage, destinationId, reducedMotion, onTap };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      canvas.parentElement?.classList.add('globe-fallback');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
    camera.position.set(0, 0, 10.6);
    const globe = new THREE.Group();
    globe.rotation.set(0.13, 0.7, 0);
    scene.add(globe);

    const loader = new THREE.TextureLoader();
    const day = loader.load(`${import.meta.env.BASE_URL}media/earth-day.jpg`);
    day.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const clouds = loader.load(`${import.meta.env.BASE_URL}media/earth-clouds.png`);
    clouds.colorSpace = THREE.SRGBColorSpace;

    const earthGeo = new THREE.SphereGeometry(2.63, 96, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: day,
      roughness: 0.92,
      metalness: 0,
      emissive: new THREE.Color(0x07303b),
      emissiveIntensity: 0.14,
    });
    globe.add(new THREE.Mesh(earthGeo, earthMat));

    const cloudMat = new THREE.MeshLambertMaterial({
      map: clouds,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(2.66, 80, 48), cloudMat);
    globe.add(cloudMesh);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.85, 64, 48),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec3 vN; varying vec3 vView; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying vec3 vN; varying vec3 vView; void main() { float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.8); gl_FragColor = vec4(0.21, 0.72, 0.73, rim * 0.31); }`,
      }),
    );
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0x8fcac6, 1.0));
    const sun = new THREE.DirectionalLight(0xfff1cc, 3.25);
    sun.position.set(4, 2.5, 8);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x0c6576, 1.15);
    fill.position.set(-5, -3, -5);
    scene.add(fill);

    const markers = new Map<DestinationId, { ring: THREE.Mesh; dot: THREE.Mesh }>();
    (['maldives', 'bali'] as const).forEach((id) => {
      const location = destinationById(id);
      const anchor = spherePoint(location.latitude, location.longitude, 2.72);
      const normal = anchor.clone().normalize();
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xd6ffee }),
      );
      dot.position.copy(anchor);
      globe.add(dot);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.092, 0.107, 48),
        new THREE.MeshBasicMaterial({ color: 0x8de5ce, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false }),
      );
      ring.position.copy(anchor.clone().addScaledVector(normal, 0.02));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      globe.add(ring);
      markers.set(id, { ring, dot });
    });

    const starsGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    // Deterministic star field, limited enough to keep mobile GPU use low.
    for (let i = 0; i < 280; i++) {
      const t = i * 12.9898;
      const x = Math.sin(t) * 43758.5453;
      const y = Math.sin(t * 1.27) * 32714.3123;
      const z = Math.sin(t * 1.71) * 19713.9181;
      positions.push((x - Math.floor(x) - 0.5) * 22, (y - Math.floor(y) - 0.5) * 15, -1.5 - (z - Math.floor(z)) * 8);
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0x9bbeb3, size: 0.018, transparent: true, opacity: 0.35, depthWrite: false });
    scene.add(new THREE.Points(starsGeo, starsMat));

    let frame = 0;
    let last = performance.now();
    let pointerX = 0;
    let pointerY = 0;
    let pointerDown = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    let activePointer: number | null = null;
    let spinVelocity = 0;

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const onPointerDown = (event: PointerEvent) => {
      if (stateRef.current.stage === 2) return;
      pointerDown = true;
      moved = false;
      activePointer = event.pointerId;
      pointerX = lastX = event.clientX;
      pointerY = lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown || stateRef.current.stage !== 0) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (Math.abs(event.clientX - pointerX) + Math.abs(event.clientY - pointerY) > 6) moved = true;
      globe.rotation.y += dx * 0.006;
      globe.rotation.x = THREE.MathUtils.clamp(globe.rotation.x + dy * 0.003, -0.6, 0.6);
      spinVelocity = dx * 0.001;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (activePointer !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (pointerDown && !moved && stateRef.current.stage === 0) stateRef.current.onTap();
      pointerDown = false;
      activePointer = null;
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { stage: currentStage, destinationId: id, reducedMotion: motionOff } = stateRef.current;
      const dest = destinationById(id);
      if (currentStage === 0 && !pointerDown && !motionOff) {
        globe.rotation.y += dt * 0.07 + spinVelocity;
        spinVelocity *= Math.exp(-dt * 5);
      } else if (currentStage >= 1) {
        const p = spherePoint(dest.latitude, dest.longitude, 1).normalize();
        const yaw = Math.atan2(-p.x, p.z);
        const pitch = Math.atan2(p.y, Math.sqrt(p.x * p.x + p.z * p.z));
        const smooth = motionOff ? 1 : 1 - Math.exp(-dt * 2.8);
        globe.rotation.y += (closestAngle(globe.rotation.y, yaw) - globe.rotation.y) * smooth;
        globe.rotation.x += (pitch - globe.rotation.x) * smooth;
      }
      const focus = currentStage >= 1 ? 1.17 : 1;
      globe.scale.lerp(new THREE.Vector3(focus, focus, focus), motionOff ? 1 : 1 - Math.exp(-dt * 2.6));
      cloudMesh.rotation.y += motionOff ? 0 : dt * 0.005;
      atmosphere.rotation.copy(globe.rotation);
      atmosphere.scale.copy(globe.scale);
      markers.forEach(({ ring, dot }, markerId) => {
        const selected = markerId === id && currentStage >= 1;
        ring.scale.setScalar(selected ? 1.25 + (motionOff ? 0 : Math.sin(now * 0.003) * 0.15) : 0.75);
        (ring.material as THREE.MeshBasicMaterial).opacity = selected ? 0.98 : 0.55;
        dot.scale.setScalar(selected ? 1.3 : 0.8);
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      globe.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        }
      });
      day.dispose();
      clouds.dispose();
      (atmosphere.geometry as THREE.BufferGeometry).dispose();
      (atmosphere.material as THREE.Material).dispose();
      starsGeo.dispose();
      starsMat.dispose();
      renderer.dispose();
      canvas.parentElement?.classList.remove('globe-fallback');
    };
  }, []);

  return <canvas className="globe-canvas" ref={canvasRef} aria-label="Interactive 3D Earth. Drag to rotate, or use the destination buttons." />;
}
