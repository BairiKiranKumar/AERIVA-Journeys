import * as THREE from 'three';

/**
 * Cinematic 3D Maldives Island & Overwater Resort Environment
 * Replaces generic/low-poly visuals with an authentic, travel-film quality 3D scene:
 * - Crystal turquoise lagoon with dynamic GLSL ocean shader, physical Fresnel, sun specular glints, and shoreline caustics.
 * - Organic coral sand spit and submerged barrier reef topography.
 * - Serpentine wooden boardwalk jetty connecting 8 detailed overwater stilt bungalows.
 * - Villas feature teak sundecks, private turquoise plunge pools, tiered thatched roofs, railings, and warm lanterns.
 * - Clusters of curved coconut palms with multi-tiered swaying fronds and beach dunes.
 * - Coherent tropical sun lighting, soft contact shadows, and realistic aerial horizon haze.
 */

const WaterVertexShader = `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vWaveHeight;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Gerstner-style dual-frequency swell and surface wind ripples
    float w1 = sin(pos.x * 0.22 + pos.y * 0.18 + uTime * 1.4) * 0.09;
    float w2 = sin(pos.x * 0.55 - pos.y * 0.42 + uTime * 2.3) * 0.045;
    float w3 = cos(pos.x * 1.15 + pos.y * 0.95 + uTime * 3.4) * 0.02;
    float totalWave = w1 + w2 + w3;

    pos.z += totalWave; // In Three.js PlaneGeometry, normal is +Z before rotation
    vWaveHeight = totalWave;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;

    // Displaced normal computation for accurate specular shimmer
    float dx = 0.22 * cos(pos.x * 0.22 + pos.y * 0.18 + uTime * 1.4) * 0.09 +
               0.55 * cos(pos.x * 0.55 - pos.y * 0.42 + uTime * 2.3) * 0.045;
    float dy = 0.18 * cos(pos.x * 0.22 + pos.y * 0.18 + uTime * 1.4) * 0.09 -
               0.42 * cos(pos.x * 0.55 - pos.y * 0.42 + uTime * 2.3) * 0.045;
    vec3 displacedNormal = normalize(vec3(-dx, -dy, 1.0));
    vNormal = normalize(mat3(modelMatrix) * displacedNormal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WaterFragmentShader = `
  uniform float uTime;
  uniform vec3 uSunPosition;
  uniform vec3 uShallowColor;
  uniform vec3 uMidColor;
  uniform vec3 uDeepColor;
  uniform vec3 uSkyColor;
  uniform vec3 uIslandCenter;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vWaveHeight;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 sunDir = normalize(uSunPosition - vWorldPosition);
    vec3 normal = normalize(vNormal);

    // Distance to island spit to drive natural bathymetric color transition
    float distToIsland = length(vWorldPosition.xz - uIslandCenter.xz);
    
    // Depth: 0.0 in shallow sand spit -> 1.0 in deep outer Indian Ocean
    float depthFactor = smoothstep(2.5, 26.0, distToIsland);

    // Maldives signature water colors: radiant turquoise -> aquamarine -> deep ocean teal
    vec3 waterColor = mix(uShallowColor, uMidColor, smoothstep(0.0, 0.42, depthFactor));
    waterColor = mix(waterColor, uDeepColor, smoothstep(0.38, 1.0, depthFactor));

    // Underwater sunlight caustics in the translucent shallows
    if (depthFactor < 0.45) {
      float c1 = sin(vWorldPosition.x * 4.2 + uTime * 2.6) * cos(vWorldPosition.z * 4.2 + uTime * 2.2);
      float c2 = sin(vWorldPosition.x * 6.5 - uTime * 1.9 + c1) * cos(vWorldPosition.z * 6.5 + uTime * 2.8);
      float caustics = pow(max(0.0, c1 * 0.5 + c2 * 0.5 + 0.5), 3.0) * (1.0 - depthFactor / 0.45) * 0.35;
      waterColor += vec3(0.25, 0.42, 0.38) * caustics;
    }

    // Gentle shoreline foam edge
    float shoreEdge = smoothstep(4.0, 2.8, distToIsland);
    float foamNoise = sin(vWorldPosition.x * 8.0 + uTime * 3.5) * cos(vWorldPosition.z * 8.0 + uTime * 3.0);
    float foam = shoreEdge * (0.5 + 0.5 * foamNoise);
    waterColor = mix(waterColor, vec3(0.96, 0.99, 0.98), foam * 0.52);

    // Fresnel reflectance (Snell's window physics)
    float cosTheta = max(0.0, dot(viewDir, normal));
    float fresnel = 0.03 + 0.97 * pow(1.0 - cosTheta, 4.2);
    vec3 finalColor = mix(waterColor, uSkyColor, fresnel * 0.78);

    // Tropical sun specular reflection
    vec3 halfVector = normalize(sunDir + viewDir);
    float spec = pow(max(0.0, dot(normal, halfVector)), 80.0);
    vec3 sunSpec = vec3(1.0, 0.97, 0.90) * spec * 2.2;
    finalColor += sunSpec;

    // Atmospheric horizon haze
    float dist = length(vWorldPosition - cameraPosition);
    float fog = 1.0 - exp(-dist * 0.012);
    finalColor = mix(finalColor, uSkyColor, fog);

    gl_FragColor = vec4(finalColor, 0.94);
  }
`;

export class MaldivesEnvironment {
  public group: THREE.Group;
  public waterMaterial: THREE.ShaderMaterial;
  private animatedMeshes: { mesh: THREE.Mesh | THREE.Group; update: (t: number) => void }[] = [];
  private disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Maldives3DScene';

    const islandCenter = new THREE.Vector3(5.5, 0, -2.5);

    // 1. Dynamic Ocean Water Surface
    const waterGeo = new THREE.PlaneGeometry(130, 130, 180, 180);
    this.disposables.push(waterGeo);

    this.waterMaterial = new THREE.ShaderMaterial({
      vertexShader: WaterVertexShader,
      fragmentShader: WaterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSunPosition: { value: new THREE.Vector3(18, 26, 20) },
        uShallowColor: { value: new THREE.Color(0x13e2d1) }, // Luminous shallow turquoise
        uMidColor: { value: new THREE.Color(0x0aa5b8) },     // Aquamarine lagoon
        uDeepColor: { value: new THREE.Color(0x03384a) },    // Deep Indian Ocean azure
        uSkyColor: { value: new THREE.Color(0x9de6e2) },     // Distant tropical horizon
        uIslandCenter: { value: islandCenter },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    this.disposables.push(this.waterMaterial);

    const waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 0;
    waterMesh.receiveShadow = true;
    this.group.add(waterMesh);

    // 2. Island Sand Spit & Coral Barrier Topography
    const islandGroup = this.buildIslandSandbar(islandCenter);
    this.group.add(islandGroup);

    // 3. Overwater Resort: Jetty Boardwalk and 8 Overwater Villas
    const resortGroup = this.buildOverwaterResort(islandCenter);
    this.group.add(resortGroup);

    // 4. Tropical Coconut Palm Groves
    const palmsGroup = this.buildPalmClusters(islandCenter);
    this.group.add(palmsGroup);

    // 5. Environmental Sky Atmosphere Dome
    const skyGroup = this.buildSkyAtmosphere();
    this.group.add(skyGroup);
  }

  private buildIslandSandbar(center: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const width = 16;
    const length = 28;
    const segsX = 64;
    const segsZ = 80;

    const terrainGeo = new THREE.PlaneGeometry(width, length, segsX, segsZ);
    this.disposables.push(terrainGeo);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getY(i);

      // Natural S-curved atoll sand spit
      const curveOffset = Math.sin(z * 0.18) * 2.2;
      const dx = (x - curveOffset) / (width * 0.44);
      const dz = z / (length * 0.48);
      const distSq = dx * dx + dz * dz;

      let elevation = 0;
      if (distSq < 1.0) {
        // Dune crest: ~0.42m above sea level
        const crest = Math.pow(Math.cos(distSq * (Math.PI / 2)), 1.4);
        elevation = crest * 0.46 - 0.06;
      } else {
        // Shallow underwater coral reef shelf
        const reefFalloff = Math.min(2.8, (distSq - 1.0) * 0.7);
        elevation = -0.18 - reefFalloff;
      }
      pos.setZ(i, elevation);
    }
    terrainGeo.computeVertexNormals();

    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xfbf6ea, // Pristine white coral sand
      roughness: 0.95,
      metalness: 0.01,
      flatShading: false,
    });
    this.disposables.push(sandMat);

    const islandMesh = new THREE.Mesh(terrainGeo, sandMat);
    islandMesh.rotation.x = -Math.PI / 2;
    islandMesh.position.set(center.x, 0, center.z);
    islandMesh.receiveShadow = true;
    islandMesh.castShadow = true;
    group.add(islandMesh);

    return group;
  }

  private buildOverwaterResort(islandCenter: THREE.Vector3): THREE.Group {
    const resort = new THREE.Group();

    // Physically based resort materials
    const plankMat = new THREE.MeshStandardMaterial({
      color: 0x987452, // Teak boardwalk timber
      roughness: 0.85,
      metalness: 0.03,
    });
    const pilingMat = new THREE.MeshStandardMaterial({
      color: 0x4a3625, // Deep wet timber pilings
      roughness: 0.95,
    });
    const thatchMat = new THREE.MeshStandardMaterial({
      color: 0xc49d68, // Natural sun-bleached woven palm thatch
      roughness: 0.90,
    });
    const timberWallMat = new THREE.MeshStandardMaterial({
      color: 0xcca67d, // Warm cedar pavilion walls
      roughness: 0.75,
    });
    const poolWaterMat = new THREE.MeshStandardMaterial({
      color: 0x16e8d6, // Vivid turquoise private plunge pool
      roughness: 0.15,
      metalness: 0.1,
    });
    const railingMat = new THREE.MeshStandardMaterial({
      color: 0x7c5d41,
      roughness: 0.88,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0xfcfbfa, // Crisp luxury sunbed linen
      roughness: 0.65,
    });
    const lanternGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffdf96,
    });

    [plankMat, pilingMat, thatchMat, timberWallMat, poolWaterMat, railingMat, cushionMat, lanternGlowMat].forEach(
      (m) => this.disposables.push(m)
    );

    // Serpentine Jetty Boardwalk Path Points
    const jettyPath = [
      new THREE.Vector3(islandCenter.x - 1.5, 0.22, islandCenter.z + 3.0),
      new THREE.Vector3(islandCenter.x - 3.8, 0.22, islandCenter.z + 1.2),
      new THREE.Vector3(islandCenter.x - 6.2, 0.22, islandCenter.z - 1.2),
      new THREE.Vector3(islandCenter.x - 8.2, 0.22, islandCenter.z - 4.2),
      new THREE.Vector3(islandCenter.x - 9.5, 0.22, islandCenter.z - 7.5),
      new THREE.Vector3(islandCenter.x - 10.0, 0.22, islandCenter.z - 11.0),
      new THREE.Vector3(islandCenter.x - 9.2, 0.22, islandCenter.z - 14.5),
    ];

    // Build Boardwalk Segments and Pilings
    const pilingGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
    this.disposables.push(pilingGeo);

    for (let i = 0; i < jettyPath.length - 1; i++) {
      const p1 = jettyPath[i];
      const p2 = jettyPath[i + 1];
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const dir = p2.clone().sub(p1);
      const len = dir.length();

      const segGeo = new THREE.BoxGeometry(1.25, 0.12, len);
      this.disposables.push(segGeo);
      const segMesh = new THREE.Mesh(segGeo, plankMat);
      segMesh.position.copy(mid);
      segMesh.lookAt(p2);
      segMesh.castShadow = true;
      segMesh.receiveShadow = true;
      resort.add(segMesh);

      // Pilings supporting the walkway
      [-0.5, 0.5].forEach((offset) => {
        const piling = new THREE.Mesh(pilingGeo, pilingMat);
        const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        piling.position.copy(mid).addScaledVector(normal, offset);
        piling.position.y = -0.55;
        piling.castShadow = true;
        resort.add(piling);
      });

      // Walkway lanterns
      const postGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.65, 6);
      const postMesh = new THREE.Mesh(postGeo, railingMat);
      const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      postMesh.position.copy(mid).addScaledVector(normal, 0.55);
      postMesh.position.y = 0.55;
      resort.add(postMesh);

      const lanternGeo = new THREE.SphereGeometry(0.045, 8, 6);
      const lanternMesh = new THREE.Mesh(lanternGeo, lanternGlowMat);
      lanternMesh.position.copy(postMesh.position);
      lanternMesh.position.y += 0.32;
      resort.add(lanternMesh);
    }

    // 8 Overwater Villas branched along the serpentine jetty
    const villaConfigs = [
      { pos: new THREE.Vector3(islandCenter.x - 4.5, 0.22, islandCenter.z - 0.2), rot: 0.32 },
      { pos: new THREE.Vector3(islandCenter.x - 7.0, 0.22, islandCenter.z - 2.8), rot: 0.48 },
      { pos: new THREE.Vector3(islandCenter.x - 8.8, 0.22, islandCenter.z - 5.8), rot: 0.65 },
      { pos: new THREE.Vector3(islandCenter.x - 9.4, 0.22, islandCenter.z - 9.2), rot: 0.82 },
      { pos: new THREE.Vector3(islandCenter.x - 8.5, 0.22, islandCenter.z - 12.8), rot: 1.05 },
      // Opposite side of the jetty for authentic resort layout
      { pos: new THREE.Vector3(islandCenter.x - 11.2, 0.22, islandCenter.z - 6.5), rot: -0.55 },
      { pos: new THREE.Vector3(islandCenter.x - 11.6, 0.22, islandCenter.z - 10.2), rot: -0.42 },
      { pos: new THREE.Vector3(islandCenter.x - 10.8, 0.22, islandCenter.z - 13.8), rot: -0.28 },
    ];

    // Villa Component Geometries
    const platformGeo = new THREE.BoxGeometry(3.6, 0.16, 4.0);
    const bodyGeo = new THREE.BoxGeometry(2.4, 1.45, 2.2);
    // Tiered authentic thatched hip roof
    const lowerRoofGeo = new THREE.ConeGeometry(2.2, 0.95, 4);
    lowerRoofGeo.rotateY(Math.PI / 4);
    const upperRoofGeo = new THREE.ConeGeometry(1.6, 0.85, 4);
    upperRoofGeo.rotateY(Math.PI / 4);
    const poolGeo = new THREE.BoxGeometry(1.1, 0.14, 1.3);
    const loungerGeo = new THREE.BoxGeometry(0.65, 0.12, 1.4);
    const cushionGeo = new THREE.BoxGeometry(0.58, 0.08, 1.32);
    const umbrellaGeo = new THREE.ConeGeometry(0.72, 0.22, 8);

    this.disposables.push(
      platformGeo, bodyGeo, lowerRoofGeo, upperRoofGeo, poolGeo, loungerGeo, cushionGeo, umbrellaGeo
    );

    villaConfigs.forEach(({ pos, rot }) => {
      const villa = new THREE.Group();
      villa.position.copy(pos);
      villa.rotation.y = rot;

      // 1. Deck Platform
      const deck = new THREE.Mesh(platformGeo, plankMat);
      deck.position.set(0, 0, 0);
      deck.castShadow = true;
      deck.receiveShadow = true;
      villa.add(deck);

      // 2. Stilts into water
      const corners = [
        [-1.6, -1.8], [1.6, -1.8],
        [-1.6, 1.8], [1.6, 1.8],
        [0, 0],
      ];
      corners.forEach(([cx, cz]) => {
        const p = new THREE.Mesh(pilingGeo, pilingMat);
        p.position.set(cx, -0.65, cz);
        p.castShadow = true;
        villa.add(p);
      });

      // 3. Villa Pavilion Body
      const body = new THREE.Mesh(bodyGeo, timberWallMat);
      body.position.set(0, 0.8, -0.65);
      body.castShadow = true;
      body.receiveShadow = true;
      villa.add(body);

      // 4. Multi-tiered Thatched Roof
      const lowerRoof = new THREE.Mesh(lowerRoofGeo, thatchMat);
      lowerRoof.position.set(0, 1.85, -0.65);
      lowerRoof.castShadow = true;
      villa.add(lowerRoof);

      const upperRoof = new THREE.Mesh(upperRoofGeo, thatchMat);
      upperRoof.position.set(0, 2.35, -0.65);
      upperRoof.castShadow = true;
      villa.add(upperRoof);

      // 5. Private Lagoon Plunge Pool
      const pool = new THREE.Mesh(poolGeo, poolWaterMat);
      pool.position.set(-0.95, 0.10, 0.95);
      villa.add(pool);

      // 6. Daybed / Sun Loungers
      const lounger = new THREE.Mesh(loungerGeo, plankMat);
      lounger.position.set(0.95, 0.14, 0.95);
      lounger.castShadow = true;
      villa.add(lounger);

      const cushion = new THREE.Mesh(cushionGeo, cushionMat);
      cushion.position.set(0.95, 0.22, 0.95);
      villa.add(cushion);

      // 7. Sun Umbrella
      const umbrellaPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.35, 6),
        railingMat
      );
      umbrellaPole.position.set(0.25, 0.68, 1.15);
      villa.add(umbrellaPole);

      const umbrellaTop = new THREE.Mesh(umbrellaGeo, cushionMat);
      umbrellaTop.position.set(0.25, 1.35, 1.15);
      umbrellaTop.castShadow = true;
      villa.add(umbrellaTop);

      // 8. Soft warm interior lantern light
      const interiorLight = new THREE.PointLight(0xffbe6b, 0.45, 4.2);
      interiorLight.position.set(0, 0.8, -0.65);
      villa.add(interiorLight);

      resort.add(villa);
    });

    return resort;
  }

  private buildPalmClusters(islandCenter: THREE.Vector3): THREE.Group {
    const palms = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x73573e,
      roughness: 0.92,
    });
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x1f7442, // Vibrant tropical palm green
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    this.disposables.push(trunkMat, frondMat);

    // Natural Palm Tree Groupings along the sandbar
    const palmLocations = [
      { x: islandCenter.x + 0.5, z: islandCenter.z + 2.5, scale: 1.1, rot: 0.2 },
      { x: islandCenter.x + 1.8, z: islandCenter.z + 4.2, scale: 0.95, rot: 0.7 },
      { x: islandCenter.x + 2.8, z: islandCenter.z + 1.0, scale: 1.25, rot: 1.4 },
      { x: islandCenter.x + 3.5, z: islandCenter.z - 1.8, scale: 1.15, rot: 2.1 },
      { x: islandCenter.x + 1.5, z: islandCenter.z - 3.5, scale: 1.0, rot: 2.8 },
      { x: islandCenter.x + 2.2, z: islandCenter.z - 6.2, scale: 1.3, rot: 0.5 },
      { x: islandCenter.x + 4.0, z: islandCenter.z - 4.5, scale: 1.05, rot: 1.2 },
      { x: islandCenter.x + 4.8, z: islandCenter.z - 0.5, scale: 1.2, rot: 1.9 },
      { x: islandCenter.x + 2.6, z: islandCenter.z - 9.0, scale: 1.1, rot: 0.8 },
      { x: islandCenter.x + 3.8, z: islandCenter.z - 8.0, scale: 0.9, rot: 1.6 },
    ];

    palmLocations.forEach((loc, idx) => {
      const palm = new THREE.Group();
      palm.position.set(loc.x, 0.32, loc.z);
      palm.scale.setScalar(loc.scale);

      // Curved Organic Palm Trunk
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.15 * Math.sin(loc.rot), 1.2, 0.15 * Math.cos(loc.rot)),
        new THREE.Vector3(0.42 * Math.sin(loc.rot), 2.5, 0.42 * Math.cos(loc.rot)),
        new THREE.Vector3(0.75 * Math.sin(loc.rot), 3.6, 0.75 * Math.cos(loc.rot)),
      ]);
      const trunkGeo = new THREE.TubeGeometry(trunkCurve, 14, 0.09, 8, false);
      this.disposables.push(trunkGeo);
      const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
      trunkMesh.castShadow = true;
      palm.add(trunkMesh);

      // Palm Crown Fronds
      const crown = new THREE.Group();
      crown.position.set(0.75 * Math.sin(loc.rot), 3.6, 0.75 * Math.cos(loc.rot));

      const frondsCount = 8;
      for (let f = 0; f < frondsCount; f++) {
        const angle = (f / frondsCount) * Math.PI * 2 + idx * 0.35;
        const frondGeo = new THREE.PlaneGeometry(0.42, 2.1, 4, 8);
        this.disposables.push(frondGeo);

        const fPos = frondGeo.attributes.position;
        for (let p = 0; p < fPos.count; p++) {
          const v = fPos.getY(p);
          const arch = Math.pow((v + 1.05) / 2.1, 2.1) * 0.42;
          fPos.setZ(p, -arch);
        }
        frondGeo.computeVertexNormals();

        const frondMesh = new THREE.Mesh(frondGeo, frondMat);
        frondMesh.rotation.y = angle;
        frondMesh.rotation.x = 0.75;
        frondMesh.castShadow = true;
        crown.add(frondMesh);
      }

      palm.add(crown);

      // Wind sway animation
      this.animatedMeshes.push({
        mesh: crown,
        update: (time) => {
          crown.rotation.z = Math.sin(time * 1.6 + idx * 0.8) * 0.055;
          crown.rotation.x = Math.cos(time * 1.3 + idx * 1.1) * 0.045;
        },
      });

      palms.add(palm);
    });

    return palms;
  }

  private buildSkyAtmosphere(): THREE.Group {
    const sky = new THREE.Group();

    const skyGeo = new THREE.SphereGeometry(75, 32, 24);
    this.disposables.push(skyGeo);

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float height = max(0.0, dir.y);
          // Tropical sky: warm sunlit horizon haze -> clear blue zenith
          vec3 zenith = vec3(0.18, 0.54, 0.78);
          vec3 horizon = vec3(0.74, 0.90, 0.93);
          vec3 sunGlow = vec3(1.0, 0.95, 0.85);

          vec3 col = mix(horizon, zenith, pow(height, 0.52));

          // Soft solar flare bloom around tropical sun
          vec3 sunDir = normalize(vec3(0.5, 0.65, 0.55));
          float sunDist = max(0.0, dot(dir, sunDir));
          col += sunGlow * pow(sunDist, 22.0) * 0.4;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.disposables.push(skyMat);

    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    sky.add(skyMesh);

    return sky;
  }

  public update(timeSeconds: number) {
    this.waterMaterial.uniforms.uTime.value = timeSeconds;
    this.animatedMeshes.forEach(({ update }) => update(timeSeconds));
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
