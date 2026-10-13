/**
 * CYBER DASH 3D - Full Engine with Hardcore Obstacles & Special Moves
 * 
 * Obstacles:
 * 1. Ground Spikes (Single, Double, Triple, Quadruple)
 * 2. Rotating Buzzsaw Blades (Deadly razor gear spinning in 3D)
 * 3. Ceiling Spikes (Deadly when gravity is flipped or during high leaps)
 * 4. Multi-level Floating Runways
 * 
 * Special Moves & Interactive Mechanisms:
 * 1. Yellow Catapult Pad (The Flat Booster): Launches the cube high into the stratosphere (23.5 vy)
 * 2. Pink Mini-Spring Pad: Low-trajectory speed hop over razor saws (14.0 vy)
 * 3. Mid-Air Jump Orbs (Yellow Ring): Airborne rhythm jump when clicked/spaced near the orb
 * 4. Gravity Inversion Portal (Cyan/Violet Ring Gate): Flips gravity upside down to run on the ceiling!
 * 5. Aerial Dash Booster Ring (Cyan Orb): Bursts the cube forward with speed boost
 */

class GameEngine {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.currentLevelIndex = 0;
    this.state = 'MENU';
    this.cameraMode = 'DYNAMIC_3D';
    
    // Physics parameters
    this.BASE_GRAVITY = -48.0;
    this.gravityDir = 1; // 1 = normal downward, -1 = inverted ceiling gravity!
    this.JUMP_VELOCITY = 15.5;
    this.YELLOW_PAD_VELOCITY = 23.5; // High catapult
    this.PINK_PAD_VELOCITY = 14.2;   // Low fast hop
    this.ORB_JUMP_VELOCITY = 17.5;
    this.CUBE_SIZE = 1.0;
    this.CEILING_Y = 7.5; // Ceiling limit for upside down gravity

    // Player state
    this.player = {
      x: 0,
      y: 0.5,
      z: 0,
      vy: 0,
      isGrounded: true,
      currentPlatform: null,
      rotationAngle: 0,
      mesh: null,
      coreMaterial: null,
      wireMat: null
    };

    // Progression
    this.attempts = 1;
    this.bestScores = [0, 0, 0];

    // Three.js elements
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.obstacleGroup = null;
    this.particleGroup = null;
    this.ceilingGroup = null;
    this.groundGrid = null;
    this.ceilingGrid = null;
    this.lights = {};
    
    this.levelObjects = [];
    this.particles = [];
    this.shakeIntensity = 0;
    this.speedMultiplier = 1.0;

    this.lastTime = performance.now();

    this.initThree();
    this.initUI();
    this.setupInputs();
    this.updateLevelDisplay();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /* -------------------------------------------------------------
     THREE.JS SETUP
  ------------------------------------------------------------- */
  initThree() {
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(-6, 4.5, 9);
    this.camera.lookAt(4, 2, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.obstacleGroup = new THREE.Group();
    this.particleGroup = new THREE.Group();
    this.ceilingGroup = new THREE.Group();
    this.scene.add(this.obstacleGroup);
    this.scene.add(this.particleGroup);
    this.scene.add(this.ceilingGroup);

    this.createPlayerMesh();
    this.setupLighting();
    this.createGroundAndCeiling();
    this.createSpaceBackdrop();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  createPlayerMesh() {
    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(this.CUBE_SIZE, this.CUBE_SIZE, this.CUBE_SIZE);
    
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.15,
      metalness: 0.85,
      emissive: 0x005577,
      emissiveIntensity: 0.3
    });
    const cubeMesh = new THREE.Mesh(geom, mat);
    cubeMesh.castShadow = true;
    cubeMesh.receiveShadow = true;
    group.add(cubeMesh);

    const wireGeom = new THREE.EdgesGeometry(geom);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const wireframe = new THREE.LineSegments(wireGeom, wireMat);
    group.add(wireframe);

    // Glowing pupil
    const pupilGeom = new THREE.PlaneGeometry(0.45, 0.45);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const pupil = new THREE.Mesh(pupilGeom, pupilMat);
    pupil.position.set(0.05, 0.05, 0.505);
    group.add(pupil);

    const pupilEyeGeom = new THREE.PlaneGeometry(0.2, 0.2);
    const pupilEyeMat = new THREE.MeshBasicMaterial({ color: 0x001122, side: THREE.DoubleSide });
    const innerPupil = new THREE.Mesh(pupilEyeGeom, pupilEyeMat);
    innerPupil.position.set(0.1, 0.05, 0.508);
    group.add(innerPupil);

    group.position.set(0, 0.5, 0);
    this.scene.add(group);

    this.player.mesh = group;
    this.player.coreMaterial = mat;
    this.player.wireMat = wireMat;
  }

  setupLighting() {
    this.lights.ambient = new THREE.AmbientLight(0x223366, 1.2);
    this.scene.add(this.lights.ambient);

    this.lights.dir = new THREE.DirectionalLight(0x00f0ff, 2.0);
    this.lights.dir.position.set(20, 30, 20);
    this.lights.dir.castShadow = true;
    this.scene.add(this.lights.dir);

    this.lights.cubePoint = new THREE.PointLight(0x00f0ff, 3.8, 14, 1.5);
    this.scene.add(this.lights.cubePoint);
  }

  createGroundAndCeiling() {
    // Floor
    const groundGeom = new THREE.BoxGeometry(2500, 4, 16);
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x070c1f,
      roughness: 0.6,
      metalness: 0.3
    });
    const ground = new THREE.Mesh(groundGeom, this.groundMat);
    ground.position.set(700, -2, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(1400, 350, 0x00ffff, 0x004488);
    gridHelper.position.set(700, 0.01, 0);
    gridHelper.scale.set(1, 1, 0.016);
    this.scene.add(gridHelper);
    this.groundGrid = gridHelper;

    // Ceiling runway for gravity flip inverted runs!
    const ceilingGeom = new THREE.BoxGeometry(2500, 2, 16);
    this.ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x0c071f,
      roughness: 0.7,
      metalness: 0.4
    });
    const ceiling = new THREE.Mesh(ceilingGeom, this.ceilingMat);
    ceiling.position.set(700, this.CEILING_Y + 1.5, 0);
    this.ceilingGroup.add(ceiling);

    const ceilingGrid = new THREE.GridHelper(1400, 350, 0xbf00ff, 0x440088);
    ceilingGrid.position.set(700, this.CEILING_Y + 0.49, 0);
    ceilingGrid.scale.set(1, 1, 0.016);
    this.ceilingGroup.add(ceilingGrid);
  }

  createSpaceBackdrop() {
    const particleCount = 1400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.2) * 1400;
      positions[i + 1] = (Math.random() - 0.2) * 90;
      positions[i + 2] = (Math.random() - 0.5) * 60 - 15;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.backdropMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.38,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    this.spaceParticles = new THREE.Points(geometry, this.backdropMat);
    this.scene.add(this.spaceParticles);
  }

  /* -------------------------------------------------------------
     ATMOSPHERE & OBSTACLE BUILDERS
  ------------------------------------------------------------- */
  applyAtmosphere(atmo) {
    this.scene.fog = new THREE.FogExp2(atmo.fogColor, atmo.fogDensity);
    this.scene.background = new THREE.Color(atmo.bgColor);

    this.lights.ambient.color.setHex(atmo.ambientColor);
    this.lights.dir.color.setHex(atmo.dirLightColor);
    this.lights.cubePoint.color.setHex(atmo.cubeGlow);

    this.groundMat.color.setHex(atmo.floorColor);
    this.backdropMat.color.setHex(atmo.skyParticles);

    this.player.coreMaterial.color.setHex(atmo.cubeColor);
    this.player.coreMaterial.emissive.setHex(atmo.cubeGlow);
    this.player.wireMat.color.setHex(atmo.cubeColor);
  }

  buildLevel(levelData) {
    while (this.obstacleGroup.children.length > 0) {
      const obj = this.obstacleGroup.children[0];
      this.obstacleGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    this.levelObjects = [];
    this.gravityDir = 1; // Reset to normal floor gravity

    const atmo = levelData.atmosphere;
    this.applyAtmosphere(atmo);
    this.buildGoalGate(levelData.length, atmo);

    levelData.elements.forEach(elem => {
      switch (elem.type) {
        case 'spike':
          this.createSpike(elem.x, elem.y || 0, false, atmo);
          break;
        case 'double_spike':
          this.createSpike(elem.x - 0.65, elem.y || 0, false, atmo);
          this.createSpike(elem.x + 0.65, elem.y || 0, false, atmo);
          break;
        case 'triple_spike':
          this.createSpike(elem.x - 1.2, elem.y || 0, false, atmo);
          this.createSpike(elem.x, elem.y || 0, false, atmo);
          this.createSpike(elem.x + 1.2, elem.y || 0, false, atmo);
          break;
        case 'quad_spike':
          this.createSpike(elem.x - 1.8, elem.y || 0, false, atmo);
          this.createSpike(elem.x - 0.6, elem.y || 0, false, atmo);
          this.createSpike(elem.x + 0.6, elem.y || 0, false, atmo);
          this.createSpike(elem.x + 1.8, elem.y || 0, false, atmo);
          break;
        case 'spike_ceiling':
          this.createSpike(elem.x, elem.y || this.CEILING_Y, true, atmo);
          break;
        case 'saw':
          this.createSawBlade(elem.x, elem.y || 1.5, atmo);
          break;
        case 'platform':
          this.createPlatform(elem.x, elem.y || 1.5, elem.length || 10, atmo);
          break;
        case 'pad':
          // Signature Yellow Flat Catapult Booster
          this.createCatapultPad(elem.x, elem.y || 0, 'yellow', atmo);
          break;
        case 'pink_pad':
          // Pink Mini Spring Pad (low hop)
          this.createCatapultPad(elem.x, elem.y || 0, 'pink', atmo);
          break;
        case 'orb':
          // Mid-Air Jump Ring (Yellow)
          this.createOrb(elem.x, elem.y || 2.5, 'yellow', atmo);
          break;
        case 'blue_orb':
          // Authentic GD Blue Gravity Ring (Flips gravity upon tap)
          this.createOrb(elem.x, elem.y || 2.5, 'blue', atmo);
          break;
        case 'portal_flip':
          // Gravity Flip Portal Ring!
          this.createGravityPortal(elem.x, elem.y || 3.0, atmo);
          break;
      }
    });
  }

  createSpike(x, y, isCeiling, atmo) {
    const spikeHeight = 1.2;
    const spikeRadius = 0.55;
    const geom = new THREE.ConeGeometry(spikeRadius, spikeHeight, 4);
    geom.rotateY(Math.PI / 4);
    if (isCeiling) {
      geom.rotateX(Math.PI);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: atmo.spikeColor,
      roughness: 0.2,
      metalness: 0.8,
      emissive: atmo.spikeColor,
      emissiveIntensity: 0.4
    });

    const mesh = new THREE.Mesh(geom, mat);
    const posY = isCeiling ? y - spikeHeight / 2 : y + spikeHeight / 2;
    mesh.position.set(x, posY, 0);
    mesh.castShadow = true;

    const edgeGeom = new THREE.EdgesGeometry(geom);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    mesh.add(new THREE.LineSegments(edgeGeom, edgeMat));

    this.obstacleGroup.add(mesh);

    this.levelObjects.push({
      type: 'spike',
      x: x,
      y: posY,
      width: spikeRadius * 1.5,
      height: spikeHeight * 0.9,
      mesh: mesh
    });
  }

  createSawBlade(x, y, atmo) {
    // 3D Rotating Razor Gear Saw
    const group = new THREE.Group();
    const radius = 1.1;
    const gearGeom = new THREE.CylinderGeometry(radius, radius, 0.2, 12);
    gearGeom.rotateX(Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: atmo.sawColor,
      emissive: atmo.sawColor,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1
    });
    const gearMesh = new THREE.Mesh(gearGeom, mat);
    group.add(gearMesh);

    // Inner teeth spikes
    for (let i = 0; i < 8; i++) {
      const toothGeom = new THREE.ConeGeometry(0.25, 0.6, 3);
      toothGeom.rotateZ(-Math.PI / 2);
      const tooth = new THREE.Mesh(toothGeom, mat);
      const angle = (i / 8) * Math.PI * 2;
      tooth.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      tooth.rotation.z = angle;
      group.add(tooth);
    }

    // Glowing center hub
    const hubGeom = new THREE.SphereGeometry(0.35, 12, 12);
    const hubMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    group.add(new THREE.Mesh(hubGeom, hubMat));

    group.position.set(x, y, 0);
    this.obstacleGroup.add(group);

    this.levelObjects.push({
      type: 'saw',
      x: x,
      y: y,
      radius: radius * 1.05,
      mesh: group
    });
  }

  createPlatform(x, y, length, atmo) {
    const height = 0.8;
    const depth = 2.4;
    const geom = new THREE.BoxGeometry(length, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: atmo.platformColor,
      roughness: 0.3,
      metalness: 0.7,
      emissive: atmo.gridColor,
      emissiveIntensity: 0.15
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x + length / 2, y + height / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Glowing top runway
    const borderGeom = new THREE.BoxGeometry(length, 0.08, depth + 0.1);
    const borderMat = new THREE.MeshBasicMaterial({ color: atmo.gridColor });
    const border = new THREE.Mesh(borderGeom, borderMat);
    border.position.set(0, height / 2 + 0.04, 0);
    mesh.add(border);

    this.obstacleGroup.add(mesh);

    this.levelObjects.push({
      type: 'platform',
      xStart: x,
      xEnd: x + length,
      topY: y + height,
      bottomY: y,
      mesh: mesh
    });
  }

  createCatapultPad(x, y, style, atmo) {
    const group = new THREE.Group();
    const padColor = style === 'pink' ? atmo.pinkPadColor : atmo.padColor;

    // Base plate
    const baseGeom = new THREE.BoxGeometry(1.6, 0.15, 1.8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x22222a, metalness: 0.9, roughness: 0.2 });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.075;
    group.add(baseMesh);

    // Glowing Flat Button Pad
    const padGeom = new THREE.BoxGeometry(1.3, 0.18, 1.5);
    const padMat = new THREE.MeshStandardMaterial({
      color: padColor,
      emissive: padColor,
      emissiveIntensity: 1.0,
      metalness: 0.3,
      roughness: 0.1
    });
    const padMesh = new THREE.Mesh(padGeom, padMat);
    padMesh.position.y = 0.18;
    group.add(padMesh);

    // Outer Glow Ring
    const ringGeom = new THREE.TorusGeometry(0.85, 0.06, 8, 24);
    ringGeom.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: padColor });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.y = 0.12;
    group.add(ringMesh);

    group.position.set(x, y, 0);
    this.obstacleGroup.add(group);

    this.levelObjects.push({
      type: style === 'pink' ? 'pink_pad' : 'pad',
      x: x,
      y: y + 0.2,
      width: 1.4,
      height: 0.5,
      mesh: group,
      ringMesh: ringMesh
    });
  }

  createOrb(x, y, style = 'yellow', atmo) {
    const group = new THREE.Group();
    const orbColor = style === 'blue' ? atmo.blueOrbColor : atmo.orbColor;

    const sphereGeom = new THREE.SphereGeometry(0.35, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: orbColor,
      emissive: orbColor,
      emissiveIntensity: 0.9
    });
    group.add(new THREE.Mesh(sphereGeom, sphereMat));

    const ringGeom = new THREE.TorusGeometry(0.65, 0.08, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: orbColor });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    group.add(ring);

    group.position.set(x, y, 0);
    this.obstacleGroup.add(group);

    this.levelObjects.push({
      type: style === 'blue' ? 'blue_orb' : 'orb',
      x: x,
      y: y,
      radius: 1.35,
      ringMesh: ring,
      mesh: group
    });
  }

  createGravityPortal(x, y, atmo) {
    // Holographic Gravity Distortion Portal
    const group = new THREE.Group();
    const portalGeom = new THREE.TorusGeometry(1.6, 0.2, 16, 32);
    portalGeom.rotateY(Math.PI / 2);
    const portalMat = new THREE.MeshStandardMaterial({
      color: atmo.portalColor,
      emissive: atmo.portalColor,
      emissiveIntensity: 1.3
    });
    group.add(new THREE.Mesh(portalGeom, portalMat));

    // Inner glowing field
    const fieldGeom = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16);
    fieldGeom.rotateZ(Math.PI / 2);
    const fieldMat = new THREE.MeshBasicMaterial({
      color: atmo.portalColor,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    group.add(new THREE.Mesh(fieldGeom, fieldMat));

    group.position.set(x, y, 0);
    this.obstacleGroup.add(group);

    this.levelObjects.push({
      type: 'portal_flip',
      x: x,
      y: y,
      width: 1.2,
      height: 3.2,
      triggered: false,
      mesh: group
    });
  }

  buildGoalGate(x, atmo) {
    const gateGroup = new THREE.Group();
    const portalGeom = new THREE.TorusGeometry(3.5, 0.35, 16, 32);
    portalGeom.rotateY(Math.PI / 2);
    const portalMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xffd166,
      emissiveIntensity: 1.2
    });
    gateGroup.add(new THREE.Mesh(portalGeom, portalMat));

    const planeGeom = new THREE.CircleGeometry(3.2, 32);
    planeGeom.rotateY(Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    gateGroup.add(new THREE.Mesh(planeGeom, planeMat));

    gateGroup.position.set(x, 3.5, 0);
    this.obstacleGroup.add(gateGroup);
  }

  /* -------------------------------------------------------------
     PARTICLE EFFECTS
  ------------------------------------------------------------- */
  spawnTrailParticle(x, y) {
    if (this.particles.length > 160) return;
    const geom = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({
      color: this.player.coreMaterial.color,
      transparent: true,
      opacity: 0.85
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x - 0.5, y + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
    this.particleGroup.add(mesh);

    this.particles.push({
      mesh: mesh,
      vx: -(Math.random() * 3 + 2),
      vy: (Math.random() - 0.5) * 2,
      vz: (Math.random() - 0.5) * 2,
      life: 0.35,
      maxLife: 0.35
    });
  }

  spawnCatapultParticles(x, y, colorHex = 0xffea00) {
    for (let i = 0; i < 26; i++) {
      const geom = new THREE.TetrahedronGeometry(0.16);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, 0);
      this.particleGroup.add(mesh);

      const angle = (i / 26) * Math.PI * 2;
      this.particles.push({
        mesh: mesh,
        vx: Math.cos(angle) * (Math.random() * 8 + 4),
        vy: Math.sin(angle) * 7 + (this.gravityDir > 0 ? 10 : -10),
        vz: (Math.random() - 0.5) * 6,
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  spawnDeathExplosion(x, y) {
    for (let i = 0; i < 45; i++) {
      const size = Math.random() * 0.25 + 0.1;
      const geom = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0xff0055 : 0x00f0ff,
        emissive: 0xff0055,
        emissiveIntensity: 0.8
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, 0);
      this.particleGroup.add(mesh);

      this.particles.push({
        mesh: mesh,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() * 16) + 2,
        vz: (Math.random() - 0.5) * 16,
        rotX: Math.random() * 10,
        rotY: Math.random() * 10,
        life: 0.9,
        maxLife: 0.9
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particleGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.rotX) {
        p.mesh.rotation.x += p.rotX * dt;
        p.mesh.rotation.y += p.rotY * dt;
      }
      p.mesh.material.opacity = p.life / p.maxLife;
    }
  }

  /* -------------------------------------------------------------
     PHYSICS & GAMEPLAY LOOP
  ------------------------------------------------------------- */
  startLevel(index) {
    this.currentLevelIndex = index;
    const levelData = LEVELS[this.currentLevelIndex];
    this.buildLevel(levelData);

    this.player.x = 0;
    this.player.y = 0.5;
    this.player.vy = 0;
    this.player.isGrounded = true;
    this.player.currentPlatform = null;
    this.player.rotationAngle = 0;
    this.player.mesh.visible = true;
    this.gravityDir = 1;

    document.getElementById('hud-level-name').innerText = `LEVEL ${index + 1}: ${levelData.title}`;
    document.getElementById('hud-attempt').innerText = this.attempts;
    document.getElementById('hud-speed').innerText = (levelData.speed / 16).toFixed(1) + 'x';
    document.getElementById('hud-progress-fill').style.width = '0%';
    document.getElementById('hud-progress-text').innerText = '0%';

    this.showScreen('hud');
    this.state = 'PLAYING';
    window.soundManager.startMusic(levelData.theme);
  }

  jump() {
    if (this.state !== 'PLAYING') return;

    // Normal or inverted jump from surface
    if (this.player.isGrounded) {
      this.player.vy = this.JUMP_VELOCITY * this.gravityDir;
      this.player.isGrounded = false;
      this.player.currentPlatform = null;
      window.soundManager.playJump();
      return;
    }

    // Mid-air Jump Orb / Blue Gravity Orb trigger
    for (const obj of this.levelObjects) {
      if (obj.type === 'orb' || obj.type === 'blue_orb') {
        const dx = this.player.x - obj.x;
        const dy = this.player.y - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < obj.radius) {
          if (obj.type === 'blue_orb') {
            // Blue Ring in Geometry Dash: Inverts gravity in mid-air and propels downward/upward!
            this.gravityDir *= -1;
            this.player.vy = 12.0 * this.gravityDir;
            window.soundManager.playGravityFlip();
            this.spawnCatapultParticles(obj.x, obj.y, 0x00d4ff);
          } else {
            // Standard Yellow Ring: Jump boost in mid-air
            this.player.vy = this.ORB_JUMP_VELOCITY * this.gravityDir;
            window.soundManager.playOrbTrigger();
            this.spawnCatapultParticles(obj.x, obj.y, 0xffd166);
          }
          obj.mesh.scale.set(1.5, 1.5, 1.5);
          break;
        }
      }
    }
  }

  triggerCatapult(pad, style = 'yellow') {
    const launchSpeed = style === 'pink' ? this.PINK_PAD_VELOCITY : this.YELLOW_PAD_VELOCITY;
    this.player.vy = launchSpeed * this.gravityDir;
    this.player.isGrounded = false;
    this.player.currentPlatform = null;
    this.shakeCamera(0.35);

    if (style === 'pink') {
      window.soundManager.playPinkPad();
      this.spawnCatapultParticles(pad.x, pad.y, 0xff00aa);
    } else {
      window.soundManager.playPadLaunch();
      this.spawnCatapultParticles(pad.x, pad.y, 0xffea00);
    }

    if (pad.mesh) {
      pad.mesh.scale.set(1.3, 0.4, 1.3);
      setTimeout(() => {
        if (pad.mesh) pad.mesh.scale.set(1.0, 1.0, 1.0);
      }, 140);
    }
  }

  updatePhysics(dt) {
    const levelData = LEVELS[this.currentLevelIndex];
    const speed = levelData.speed;

    // 1. Move Forward
    this.player.x += speed * dt;

    // 2. Vertical Gravity
    const currentGravity = this.BASE_GRAVITY * this.gravityDir;
    this.player.vy += currentGravity * dt;
    this.player.y += this.player.vy * dt;

    // 3. Platform & Floor / Ceiling Surface Collisions
    if (this.gravityDir === 1) {
      // Normal Floor Gravity
      let groundHeight = 0.5;

      for (const obj of this.levelObjects) {
        if (obj.type === 'platform') {
          const playerLeft = this.player.x - this.CUBE_SIZE * 0.4;
          const playerRight = this.player.x + this.CUBE_SIZE * 0.4;
          const playerBottom = this.player.y - this.CUBE_SIZE * 0.5;

          if (playerRight > obj.xStart && playerLeft < obj.xEnd) {
            const platformTop = obj.topY + this.CUBE_SIZE * 0.5;
            if (playerBottom <= obj.topY && this.player.y >= obj.topY - 0.25 && this.player.vy <= 0) {
              groundHeight = platformTop;
              this.player.currentPlatform = obj;
              break;
            } else if (this.player.y < obj.topY - 0.25 && this.player.y > obj.bottomY) {
              this.handleDeath();
              return;
            }
          }
        }
      }

      if (this.player.y <= groundHeight) {
        this.player.y = groundHeight;
        this.player.vy = 0;
        this.player.isGrounded = true;
        const nearestQuadrant = Math.round(this.player.rotationAngle / (Math.PI / 2)) * (Math.PI / 2);
        this.player.rotationAngle = nearestQuadrant;
      } else {
        this.player.isGrounded = false;
        this.player.rotationAngle -= Math.PI * 3.8 * dt;
      }
    } else {
      // Inverted Ceiling Gravity!
      const ceilingHeight = this.CEILING_Y - 0.5;

      if (this.player.y >= ceilingHeight) {
        this.player.y = ceilingHeight;
        this.player.vy = 0;
        this.player.isGrounded = true;
        const nearestQuadrant = Math.round(this.player.rotationAngle / (Math.PI / 2)) * (Math.PI / 2);
        this.player.rotationAngle = nearestQuadrant;
      } else {
        this.player.isGrounded = false;
        this.player.rotationAngle += Math.PI * 3.8 * dt;
      }
    }

    // 4. Gravity Flip Portals
    for (const obj of this.levelObjects) {
      if (obj.type === 'portal_flip' && !obj.triggered) {
        if (Math.abs(this.player.x - obj.x) < 0.9 && Math.abs(this.player.y - obj.y) < 2.0) {
          obj.triggered = true;
          this.gravityDir *= -1; // Invert gravity direction!
          this.player.vy = 8.0 * this.gravityDir;
          this.shakeCamera(0.4);
          window.soundManager.playGravityFlip();
          this.spawnCatapultParticles(obj.x, obj.y, 0x00ffcc);
          break;
        }
      }
    }

    // 5. Catapult Pads (Yellow & Pink)
    for (const obj of this.levelObjects) {
      if (obj.type === 'pad' || obj.type === 'pink_pad') {
        const dx = Math.abs(this.player.x - obj.x);
        const dy = Math.abs(this.player.y - obj.y);
        if (dx < obj.width * 0.55 && dy < 0.6) {
          this.triggerCatapult(obj, obj.type === 'pink_pad' ? 'pink' : 'yellow');
          break;
        }
      }
    }

    // 6. Deadly Hazards (Spikes & Rotating Buzzsaws)
    for (const obj of this.levelObjects) {
      if (obj.type === 'spike') {
        const dx = Math.abs(this.player.x - obj.x);
        const dy = Math.abs(this.player.y - obj.y);
        if (dx < obj.width * 0.44 && dy < obj.height * 0.44) {
          this.handleDeath();
          return;
        }
      } else if (obj.type === 'saw') {
        const dx = this.player.x - obj.x;
        const dy = this.player.y - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < obj.radius * 0.82) {
          this.handleDeath();
          return;
        }
      }
    }

    // 7. Update Mesh
    this.player.mesh.position.set(this.player.x, this.player.y, this.player.z);
    this.player.mesh.rotation.z = this.player.rotationAngle;

    // 8. Follow Light
    this.lights.cubePoint.position.set(this.player.x, this.player.y + 0.5, this.player.z + 1.5);

    // 9. Trail
    if (Math.random() < 0.65) {
      this.spawnTrailParticle(this.player.x, this.player.y);
    }

    // 10. Progress Tracking
    const progressPct = Math.min(100, Math.floor((this.player.x / levelData.length) * 100));
    document.getElementById('hud-progress-fill').style.width = `${progressPct}%`;
    document.getElementById('hud-progress-text').innerText = `${progressPct}%`;

    if (this.player.x >= levelData.length) {
      this.handleVictory();
    }
  }

  handleDeath() {
    this.state = 'DEAD';
    window.soundManager.stopMusic();
    window.soundManager.playDeath();
    this.shakeCamera(0.65);
    this.player.mesh.visible = false;
    this.spawnDeathExplosion(this.player.x, this.player.y);

    const levelData = LEVELS[this.currentLevelIndex];
    const pct = Math.min(99, Math.floor((this.player.x / levelData.length) * 100));
    if (pct > this.bestScores[this.currentLevelIndex]) {
      this.bestScores[this.currentLevelIndex] = pct;
      this.updateLevelDisplay();
    }

    document.getElementById('death-pct-num').innerText = pct;
    document.getElementById('death-attempt-num').innerText = this.attempts;
    this.attempts++;

    setTimeout(() => {
      this.showScreen('death-screen');
    }, 450);
  }

  handleVictory() {
    this.state = 'VICTORY';
    window.soundManager.stopMusic();
    window.soundManager.playVictory();
    this.bestScores[this.currentLevelIndex] = 100;
    this.updateLevelDisplay();

    document.getElementById('victory-lvl-name').innerText = LEVELS[this.currentLevelIndex].title;
    this.showScreen('victory-screen');
  }

  shakeCamera(intensity) {
    this.shakeIntensity = intensity;
  }

  updateCamera(dt) {
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeIntensity > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.5);
    }

    if (this.cameraMode === 'DYNAMIC_3D') {
      const targetCamX = this.player.x - 7.5;
      const targetCamY = THREE.MathUtils.clamp(this.player.y + 3.8, 3.5, 12.0);
      const targetCamZ = 8.8;

      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.14 + shakeX;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 0.09 + shakeY;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.1;

      this.camera.lookAt(this.player.x + 4.5, this.player.y * 0.4 + 1.8, 0);
    } else {
      this.camera.position.set(this.player.x + 3.0 + shakeX, this.player.y + 3.0 + shakeY, 15);
      this.camera.lookAt(this.player.x + 3.0, this.player.y + 1.0, 0);
    }
  }

  /* -------------------------------------------------------------
     RENDER & ANIMATION LOOP
  ------------------------------------------------------------- */
  animate(time) {
    requestAnimationFrame(this.animate);

    const dt = Math.min((time - this.lastTime) / 1000, 0.08);
    this.lastTime = time;

    // Rotate buzzsaws & rings
    for (const obj of this.levelObjects) {
      if (obj.type === 'saw' && obj.mesh) {
        obj.mesh.rotation.z += dt * 8.0; // High speed razor spinning
      }
      if (obj.type === 'orb' && obj.ringMesh) {
        obj.ringMesh.rotation.x += dt * 3.0;
        obj.ringMesh.rotation.y += dt * 2.2;
      }
      if ((obj.type === 'pad' || obj.type === 'pink_pad') && obj.ringMesh) {
        obj.ringMesh.rotation.z += dt * 3.5;
      }
      if (obj.type === 'portal_flip' && obj.mesh) {
        obj.mesh.rotation.y += dt * 2.5;
      }
    }

    if (this.state === 'PLAYING') {
      this.updatePhysics(dt);
    }

    this.updateParticles(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /* -------------------------------------------------------------
     UI & LEVEL CAROUSEL INTERFACES
  ------------------------------------------------------------- */
  initUI() {
    document.getElementById('btn-play').addEventListener('click', () => {
      this.startLevel(this.currentLevelIndex);
    });

    document.getElementById('lvl-prev').addEventListener('click', () => {
      this.currentLevelIndex = (this.currentLevelIndex - 1 + LEVELS.length) % LEVELS.length;
      this.updateLevelDisplay();
    });

    document.getElementById('lvl-next').addEventListener('click', () => {
      this.currentLevelIndex = (this.currentLevelIndex + 1) % LEVELS.length;
      this.updateLevelDisplay();
    });

    const audioBtn = document.getElementById('btn-audio-toggle');
    audioBtn.addEventListener('click', () => {
      const isEnabled = window.soundManager.toggleSound();
      audioBtn.innerText = isEnabled ? '🔊 SOUND: ON' : '🔇 SOUND: OFF';
    });

    const camBtn = document.getElementById('btn-camera-mode');
    camBtn.addEventListener('click', () => {
      this.cameraMode = this.cameraMode === 'DYNAMIC_3D' ? 'CLASSIC_SIDE' : 'DYNAMIC_3D';
      camBtn.innerText = this.cameraMode === 'DYNAMIC_3D' ? '📷 CAM: DYNAMIC 3D' : '📷 CAM: SIDE 2.5D';
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
      this.startLevel(this.currentLevelIndex);
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
      this.showScreen('menu-screen');
    });

    document.getElementById('btn-next-level').addEventListener('click', () => {
      this.currentLevelIndex = (this.currentLevelIndex + 1) % LEVELS.length;
      this.startLevel(this.currentLevelIndex);
    });

    document.getElementById('btn-victory-menu').addEventListener('click', () => {
      this.showScreen('menu-screen');
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.pauseGame();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.resumeGame();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.startLevel(this.currentLevelIndex);
    });

    document.getElementById('btn-pause-quit').addEventListener('click', () => {
      this.showScreen('menu-screen');
    });
  }

  updateLevelDisplay() {
    const lvl = LEVELS[this.currentLevelIndex];
    document.getElementById('level-difficulty-tag').innerText = lvl.difficulty;
    document.getElementById('level-title').innerText = lvl.title;
    document.getElementById('level-desc').innerText = lvl.description;
    document.getElementById('level-atmo').innerText = `ATMOSPHERE: ${lvl.atmosphere.name}`;
    document.getElementById('level-best-pct').innerText = `BEST: ${this.bestScores[this.currentLevelIndex]}%`;

    this.applyAtmosphere(lvl.atmosphere);
  }

  showScreen(screenId) {
    ['menu-screen', 'death-screen', 'victory-screen', 'pause-screen'].forEach(id => {
      const el = document.getElementById(id);
      if (id === screenId) {
        el.classList.remove('hidden');
        el.classList.add('active');
      } else {
        el.classList.remove('active');
        el.classList.add('hidden');
      }
    });

    const hud = document.getElementById('hud');
    if (screenId === 'hud') {
      hud.classList.remove('hidden');
    } else {
      hud.classList.add('hidden');
    }
  }

  pauseGame() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.showScreen('pause-screen');
    }
  }

  resumeGame() {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.showScreen('hud');
    }
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (this.state === 'MENU') {
          this.startLevel(this.currentLevelIndex);
        } else if (this.state === 'PLAYING') {
          this.jump();
        } else if (this.state === 'DEAD') {
          this.startLevel(this.currentLevelIndex);
        }
      }

      if (e.code === 'KeyR') {
        this.startLevel(this.currentLevelIndex);
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      }
    });

    window.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      if (this.state === 'PLAYING') {
        this.jump();
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameEngine = new GameEngine();
});
