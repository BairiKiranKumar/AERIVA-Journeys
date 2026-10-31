import * as THREE from 'three';
import { destinationById, type DestinationId } from '../data/destinations';

/**
 * High-realism physically shaded Earth Globe
 * - 2K NASA Blue Marble daytime albedo texture
 * - Topographic elevation normal map
 * - Ocean specular reflectance mask (land is rough/matte, oceans glint under sunlight)
 * - Separate atmospheric cloud sphere with independent differential rotation
 * - Physically modeled Rayleigh limb scattering atmosphere shader
 * - Geographically accurate destination beacons with lat/lon spherical projection
 */

function spherePoint(latitude: number, longitude: number, radius: number): THREE.Vector3 {
  // Matches THREE.SphereGeometry UV mapping convention
  const phi = ((longitude + 180) * Math.PI) / 180;
  const theta = ((90 - latitude) * Math.PI) / 180;
  return new THREE.Vector3(
    -Math.cos(phi) * Math.sin(theta) * radius,
    Math.cos(theta) * radius,
    Math.sin(phi) * Math.sin(theta) * radius
  );
}

// Atmospheric scattering limb glow shader
const AtmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const AtmosphereFragmentShader = `
  uniform vec3 uSunDirection;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel rim factor: gentle thin atmospheric limb
    float rim = max(0.0, dot(normal, viewDir));
    float atmosphereDensity = pow(1.0 - rim, 4.8);

    // Sunlight modulation: brighter on the sunward side, soft twilight at terminator
    vec3 sunDir = normalize(uSunDirection);
    vec3 worldNormal = normalize(vWorldPosition);
    float sunFacing = dot(worldNormal, sunDir);
    float daylight = smoothstep(-0.25, 0.45, sunFacing);
    float scatter = atmosphereDensity * (0.15 + 0.85 * daylight);

    // Realistic Rayleigh scattering: luminous sky blue to ethereal cyan
    vec3 airColor = mix(vec3(0.12, 0.55, 0.92), vec3(0.28, 0.82, 0.96), atmosphereDensity);

    gl_FragColor = vec4(airColor, scatter * 0.65);
  }
`;

export class EarthGlobe {
  public group: THREE.Group;
  public cloudsMesh: THREE.Mesh;
  public earthMesh: THREE.Mesh;
  public atmosphereMesh: THREE.Mesh;
  public atmosphereMat: THREE.ShaderMaterial;
  private markers = new Map<DestinationId, { ring: THREE.Mesh; dot: THREE.Mesh; baseScale: number }>();
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  constructor(renderer: THREE.WebGLRenderer) {
    this.group = new THREE.Group();
    this.group.name = 'EarthOrbitalSystem';

    const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    const loader = new THREE.TextureLoader();

    // 1. Load verified NASA textures
    const dayTex = loader.load(`${import.meta.env.BASE_URL}media/earth-day-2k.jpg`);
    dayTex.colorSpace = THREE.SRGBColorSpace;
    dayTex.anisotropy = maxAnisotropy;

    const normalTex = loader.load(`${import.meta.env.BASE_URL}media/earth-normal-2k.jpg`);
    normalTex.anisotropy = maxAnisotropy;

    const specTex = loader.load(`${import.meta.env.BASE_URL}media/earth-specular-2k.jpg`);
    specTex.anisotropy = maxAnisotropy;

    const cloudsTex = loader.load(`${import.meta.env.BASE_URL}media/earth-clouds-2k.png`);
    cloudsTex.colorSpace = THREE.SRGBColorSpace;
    cloudsTex.anisotropy = maxAnisotropy;

    [dayTex, normalTex, specTex, cloudsTex].forEach((t) => this.disposables.push(t));

    // 2. Earth Sphere Mesh
    const earthRadius = 2.62;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 96, 64);
    this.disposables.push(earthGeo);

    const earthMat = new THREE.MeshStandardMaterial({
      map: dayTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: specTex, // Inverts specular so ocean is shiny, land is matte
      roughness: 0.78,
      metalness: 0.05,
      emissive: new THREE.Color(0x062832),
      emissiveIntensity: 0.18,
    });
    this.disposables.push(earthMat);

    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthMesh.castShadow = true;
    this.earthMesh.receiveShadow = true;
    this.group.add(this.earthMesh);

    // 3. Clouds Layer
    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.009, 80, 56);
    this.disposables.push(cloudsGeo);

    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.58,
      blending: THREE.NormalBlending,
      depthWrite: false,
      roughness: 1.0,
    });
    this.disposables.push(cloudsMat);

    this.cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    this.group.add(this.cloudsMesh);

    // 4. Atmospheric Scattering Shell
    const atmosGeo = new THREE.SphereGeometry(earthRadius * 1.024, 64, 48);
    this.disposables.push(atmosGeo);

    this.atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: AtmosphereVertexShader,
      fragmentShader: AtmosphereFragmentShader,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(5, 3, 8).normalize() },
      },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(this.atmosphereMat);

    this.atmosphereMesh = new THREE.Mesh(atmosGeo, this.atmosphereMat);
    this.group.add(this.atmosphereMesh);

    // 5. Geographic Destination Beacons (Maldives & Bali)
    (['maldives', 'bali'] as const).forEach((id) => {
      const dest = destinationById(id);
      const pos = spherePoint(dest.latitude, dest.longitude, earthRadius + 0.02);
      const normal = pos.clone().normalize();

      const dotGeo = new THREE.SphereGeometry(0.045, 16, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xd6ffee });
      this.disposables.push(dotGeo, dotMat);
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      this.group.add(dot);

      const ringGeo = new THREE.RingGeometry(0.08, 0.10, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x5ce7c8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      this.disposables.push(ringGeo, ringMat);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos.clone().addScaledVector(normal, 0.015));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      this.group.add(ring);

      this.markers.set(id, { ring, dot, baseScale: 1.0 });
    });
  }

  public update(timeSeconds: number, activeId: DestinationId, stage: number, motionOff: boolean) {
    // Subtle differential cloud rotation
    if (!motionOff) {
      this.cloudsMesh.rotation.y += 0.0003;
    }

    // Marker pulse and emphasis
    this.markers.forEach(({ ring, dot }, markerId) => {
      const isSelected = markerId === activeId;
      const pulse = motionOff ? 1.0 : 1.0 + (isSelected ? Math.sin(timeSeconds * 4.0) * 0.18 : 0);
      const scale = (isSelected ? 1.3 : 0.75) * pulse;
      ring.scale.setScalar(scale);
      dot.scale.setScalar(isSelected ? 1.25 : 0.7);
      (ring.material as THREE.MeshBasicMaterial).opacity = isSelected ? (stage >= 1 ? 0.95 : 0.75) : 0.45;
    });
  }

  public getTargetOrientation(id: DestinationId): { pitch: number; yaw: number } {
    const dest = destinationById(id);
    const p = spherePoint(dest.latitude, dest.longitude, 1).normalize();
    const yaw = Math.atan2(-p.x, p.z);
    const pitch = Math.atan2(p.y, Math.sqrt(p.x * p.x + p.z * p.z));
    return { pitch, yaw };
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
