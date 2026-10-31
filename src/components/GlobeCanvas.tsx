import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { type DestinationId } from '../data/destinations';
import { EarthGlobe } from './Earth3D';
import { MaldivesEnvironment } from './Maldives3D';
import { AtmosphereDescent } from './AtmosphereDescent';

export type JourneyStage = 0 | 1 | 2;

type Props = {
  stage: JourneyStage;
  destinationId: DestinationId;
  reducedMotion: boolean;
  onTap: () => void;
};

const TWO_PI = 2 * Math.PI;

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
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      canvas.parentElement?.classList.add('globe-fallback');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x04191d, 1.0); // Rich deep petrol background
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    // Distance haze matching AERIVA midnight teal
    const sceneFog = new THREE.FogExp2(0x06282e, 0.012);
    scene.fog = sceneFog;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 150);
    camera.position.set(0, 0.3, 10.6);

    // 1. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0x75c8c5, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x6ac2e2, 0x07262b, 1.15);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff3d6, 3.1);
    sun.position.set(12, 18, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 1.0;
    sun.shadow.camera.far = 45;
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    // Subtle blue fill from deep space
    const fillLight = new THREE.DirectionalLight(0x0a5969, 1.0);
    fillLight.position.set(-8, -4, -6);
    scene.add(fillLight);

    // 2. Starfield for orbital realism
    const starsGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < 350; i++) {
      const t = i * 12.9898;
      const x = Math.sin(t) * 43758.5453;
      const y = Math.sin(t * 1.27) * 32714.3123;
      const z = Math.sin(t * 1.71) * 19713.9181;
      positions.push((x - Math.floor(x) - 0.5) * 32, (y - Math.floor(y) - 0.5) * 22, -8 - (z - Math.floor(z)) * 25);
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xa2dcd3,
      size: 0.024,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // 3. Three Main Cinematic Layers
    const earth = new EarthGlobe(renderer);
    scene.add(earth.group);

    const descentRig = new AtmosphereDescent();
    scene.add(descentRig.group);

    const maldives = new MaldivesEnvironment();
    // Position Maldives scene in world coordinates
    maldives.group.position.set(0, -100, 0); // Initially tucked away until arrival
    scene.add(maldives.group);

    // Initial earth positioning
    earth.group.position.set(1.4, 0, 0);
    earth.group.rotation.set(0.12, 0.65, 0);

    // 4. Animation and Camera State Machine
    let animFrame = 0;
    let lastTime = performance.now();
    let currentProgress = stage as number; // 0.0 -> 1.0 -> 2.0
    let targetProgress = stage as number;

    // Pointer Interaction State
    let pointerDown = false;
    let moved = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let activePointerId: number | null = null;
    let spinVelocityX = 0;
    let spinVelocityY = 0;

    // Mouse Parallax for Stage 2 (Arrive)
    let mouseParallaxX = 0;
    let mouseParallaxY = 0;
    let targetParallaxX = 0;
    let targetParallaxY = 0;

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
      pointerDown = true;
      moved = false;
      activePointerId = event.pointerId;
      pointerStartX = lastPointerX = event.clientX;
      pointerStartY = lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      // Calculate normalized mouse coordinate for 3D parallax
      const rect = canvas.getBoundingClientRect();
      const normX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      targetParallaxX = normX;
      targetParallaxY = normY;

      if (!pointerDown) return;

      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      if (Math.abs(event.clientX - pointerStartX) + Math.abs(event.clientY - pointerStartY) > 6) {
        moved = true;
      }

      // Drag rotates Earth in stage 0
      if (stateRef.current.stage === 0) {
        earth.group.rotation.y += dx * 0.0055;
        earth.group.rotation.x = THREE.MathUtils.clamp(earth.group.rotation.x + dy * 0.0028, -0.65, 0.65);
        spinVelocityX = dx * 0.0008;
        spinVelocityY = dy * 0.0004;
      }

      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (pointerDown && !moved && stateRef.current.stage === 0) {
        stateRef.current.onTap();
      }
      pointerDown = false;
      activePointerId = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    // 5. Main Cinematic Render Loop
    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const { stage: activeStage, destinationId: currentDest, reducedMotion: motionOff } = stateRef.current;
      targetProgress = activeStage;

      // Smooth progress interpolation between acts
      if (motionOff) {
        currentProgress = targetProgress;
      } else {
        const speed = currentProgress < targetProgress ? 2.2 : 2.6;
        currentProgress += (targetProgress - currentProgress) * (1 - Math.exp(-dt * speed));
      }

      const isMobile = window.innerWidth <= 820;

      // --- ACT 1 & ACT 2: Earth Orientation & Camera ---
      const destOrientation = earth.getTargetOrientation(currentDest);

      if (currentProgress < 1.4) {
        // Orbit / Locate phase
        if (activeStage === 0 && !pointerDown && !motionOff) {
          earth.group.rotation.y += dt * 0.065 + spinVelocityX;
          earth.group.rotation.x += spinVelocityY;
          spinVelocityX *= Math.exp(-dt * 4.5);
          spinVelocityY *= Math.exp(-dt * 4.5);
        } else if (activeStage >= 1) {
          // Smoothly lock onto target destination
          const smooth = motionOff ? 1.0 : 1 - Math.exp(-dt * 3.2);
          earth.group.rotation.y += (closestAngle(earth.group.rotation.y, destOrientation.yaw) - earth.group.rotation.y) * smooth;
          earth.group.rotation.x += (destOrientation.pitch - earth.group.rotation.x) * smooth;
        }

        // Earth framing
        const earthTargetX = isMobile ? 0 : 1.5 - currentProgress * 0.6;
        earth.group.position.x = earthTargetX;
        earth.group.position.y = isMobile ? -0.2 : 0;
      }

      // Update Earth and Atmospheric Descent rigs
      earth.update(now * 0.001, currentDest, activeStage, motionOff);
      descentRig.updateTransition(currentProgress);

      // --- ACT 2 to ACT 3: Camera Journey Transition ---
      // Maldives 3D Arrival is featured for 'maldives'
      const isMaldivesArrival = currentDest === 'maldives';

      // Mouse Parallax smoothing
      mouseParallaxX += (targetParallaxX - mouseParallaxX) * 0.06;
      mouseParallaxY += (targetParallaxY - mouseParallaxY) * 0.06;

      if (currentProgress <= 1.0) {
        // Act 1 (Orbit) -> Act 2 (Locate)
        // Camera in orbital position
        const camZ = isMobile ? 12.0 : 10.6;
        camera.position.set(0, 0.3, camZ);
        camera.lookAt(isMobile ? 0 : 0.8, 0, 0);

        // Keep Maldives hidden
        maldives.group.position.set(0, -100, 0);
        earth.group.visible = true;
        starField.visible = true;
        sceneFog.density = 0.008;
      } else if (currentProgress > 1.0 && currentProgress < 1.99) {
        // Continuous Camera Descent Transition
        const p = currentProgress - 1.0; // 0.0 -> 1.0

        if (isMaldivesArrival) {
          // Camera descends from orbit through the clouds into an elevated aerial view over the lagoon
          const orbitCam = new THREE.Vector3(0, 0.3, isMobile ? 12.0 : 10.6);
          const lagoonCam = new THREE.Vector3(
            (isMobile ? 1.0 : 3.6) + mouseParallaxX * 0.85,
            (isMobile ? 5.8 : 5.2) + mouseParallaxY * 0.45,
            isMobile ? 12.5 : 10.8
          );

          // Eased camera path with acceleration into clouds
          const easeP = p * p * (3 - 2 * p);
          camera.position.lerpVectors(orbitCam, lagoonCam, easeP);

          const orbitLook = new THREE.Vector3(isMobile ? 0 : 0.8, 0, 0);
          const lagoonLook = new THREE.Vector3(-0.6, 0.4, -4.0);
          const currentLook = new THREE.Vector3().lerpVectors(orbitLook, lagoonLook, easeP);
          camera.lookAt(currentLook);

          // Transition visibility at cloud crossing (p = 0.5)
          if (p >= 0.48) {
            maldives.group.position.set(0, 0, 0);
            earth.group.visible = false;
            starField.visible = false;
            sceneFog.density = 0.016;
          } else {
            maldives.group.position.set(0, -100, 0);
            earth.group.visible = true;
            starField.visible = true;
            sceneFog.density = 0.008;
          }
        } else {
          // Honest fallback for Bali: keeps camera locked in high orbit view with destination marker
          camera.position.set(0, 0.3, isMobile ? 12.0 : 10.6);
          camera.lookAt(0, 0, 0);
          maldives.group.position.set(0, -100, 0);
          earth.group.visible = true;
        }
      } else {
        // Act 3: Arrived in 3D Maldives Island Environment!
        if (isMaldivesArrival) {
          maldives.group.position.set(0, 0, 0);
          earth.group.visible = false;
          starField.visible = false;
          sceneFog.density = 0.016;

          // Cinematic aerial glide over the resort
          const time = now * 0.0006;
          const driftX = Math.sin(time) * 0.28;
          const driftY = Math.cos(time * 0.8) * 0.14;

          const baseCamX = isMobile ? 1.0 : 3.6;
          const baseCamY = isMobile ? 5.8 : 5.2;
          const baseCamZ = isMobile ? 12.5 : 10.8;

          camera.position.set(
            baseCamX + mouseParallaxX * 0.95 + driftX,
            baseCamY + mouseParallaxY * 0.45 + driftY,
            baseCamZ - mouseParallaxY * 0.45
          );

          camera.lookAt(-0.6 + mouseParallaxX * 0.35, 0.4, -4.0);
        } else {
          maldives.group.position.set(0, -100, 0);
          earth.group.visible = true;
          camera.position.set(0, 0.3, 10.6);
          camera.lookAt(0, 0, 0);
        }
      }

      // Update dynamic 3D Maldives ocean ripples, frond sway, and lighting
      if (maldives.group.visible && maldives.group.position.y === 0) {
        maldives.update(now * 0.001);
      }

      renderer.render(scene, camera);
      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);

    // 6. Cleanup GPU Resources on Unmount
    return () => {
      cancelAnimationFrame(animFrame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);

      earth.dispose();
      descentRig.dispose();
      maldives.dispose();

      starsGeo.dispose();
      starsMat.dispose();
      renderer.dispose();
      canvas.parentElement?.classList.remove('globe-fallback');
    };
  }, []);

  return (
    <canvas
      className="globe-canvas"
      ref={canvasRef}
      aria-label="Cinematic 3D Earth to Maldives journey. Drag to rotate in orbit, or click to experience the island arrival."
    />
  );
}
