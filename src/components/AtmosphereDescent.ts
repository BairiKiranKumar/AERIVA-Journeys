import * as THREE from 'three';

/**
 * Atmospheric Cloud Descent Rig
 * Provides physical scale transition and visceral descent cues:
 * - 3D volumetric cloud puffs that rush past the camera during descent.
 * - Atmospheric scattering mist veil that interpolates during orbital entry.
 * - Connects the planetary scale of Earth with the human scale of the Maldives resort.
 */

export class AtmosphereDescent {
  public group: THREE.Group;
  public cloudPlanes: THREE.Mesh[] = [];
  private veilMesh: THREE.Mesh;
  public veilMaterial: THREE.ShaderMaterial;
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'AtmosphereDescentRig';

    // 1. Procedural Soft Cloud Texture using Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 128, 15, 128, 128, 120);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.35, 'rgba(235, 248, 252, 0.65)');
    grad.addColorStop(0.7, 'rgba(215, 240, 245, 0.22)');
    grad.addColorStop(1, 'rgba(200, 235, 240, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const cloudTex = new THREE.CanvasTexture(canvas);
    this.disposables.push(cloudTex);

    // 2. Multi-layered Cloud Puff Billboards along the descent corridor
    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    this.disposables.push(cloudMat);

    const cloudGeo = new THREE.PlaneGeometry(8, 8);
    this.disposables.push(cloudGeo);

    // Position cloud puffs in 3D space across the descent corridor
    const puffPositions = [
      new THREE.Vector3(-3.5, 5.5, 4.2),
      new THREE.Vector3(3.2, 4.8, 3.8),
      new THREE.Vector3(-1.2, 6.2, 2.5),
      new THREE.Vector3(2.4, 5.2, 1.2),
      new THREE.Vector3(-4.0, 4.5, -0.5),
      new THREE.Vector3(4.5, 5.8, -1.8),
      new THREE.Vector3(0.5, 6.8, -3.2),
      new THREE.Vector3(-2.8, 5.0, -4.5),
    ];

    puffPositions.forEach((pos, i) => {
      const mesh = new THREE.Mesh(cloudGeo, cloudMat.clone());
      this.disposables.push(mesh.material as THREE.Material);
      mesh.position.copy(pos);
      mesh.rotation.z = i * 0.75;
      mesh.scale.setScalar(1.2 + Math.sin(i) * 0.4);
      this.cloudPlanes.push(mesh);
      this.group.add(mesh);
    });

    // 3. Atmospheric Scattering Veil (Fullscreen sky mist)
    const veilGeo = new THREE.PlaneGeometry(2, 2);
    this.disposables.push(veilGeo);

    this.veilMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec2 vUv;

        void main() {
          // Soft radial vignette for atmospheric entry feel
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float vignette = 1.0 - smoothstep(0.2, 0.7, dist);
          float alpha = uOpacity * (0.85 + 0.15 * vignette);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      uniforms: {
        uOpacity: { value: 0.0 },
        uColor: { value: new THREE.Color(0xb2ede4) }, // Luminous tropical sky mist
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.disposables.push(this.veilMaterial);

    this.veilMesh = new THREE.Mesh(veilGeo, this.veilMaterial);
    this.veilMesh.frustumCulled = false;
    this.group.add(this.veilMesh);
  }

  /**
   * Update atmospheric opacity based on transition progress (0.0: Orbit -> 1.0: Locate -> 2.0: Arrive)
   */
  public updateTransition(transitionProgress: number) {
    // Transition peak happens between 1.3 and 1.7 (the descent phase through clouds)
    let veilAlpha = 0;
    let cloudAlpha = 0;

    if (transitionProgress >= 1.0 && transitionProgress <= 2.0) {
      const p = transitionProgress - 1.0; // 0.0 -> 1.0
      // Bell curve peak at p = 0.5 (progress 1.5)
      veilAlpha = Math.sin(p * Math.PI) * 0.55;
      cloudAlpha = Math.sin(p * Math.PI) * 0.85;
    }

    this.veilMaterial.uniforms.uOpacity.value = veilAlpha;

    this.cloudPlanes.forEach((plane, i) => {
      const mat = plane.material as THREE.MeshBasicMaterial;
      mat.opacity = cloudAlpha;
      plane.rotation.z += 0.001 * (i % 2 === 0 ? 1 : -1);
    });
  }

  public dispose() {
    this.disposables.forEach((item) => {
      if ('dispose' in item && typeof item.dispose === 'function') {
        item.dispose();
      }
    });
    this.group.clear();
  }
}

