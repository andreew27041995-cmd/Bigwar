import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  detectSoftwareGl,
  createAfterDrawPacer,
  createSandstoneTexture,
  createHero3DModel,
  createEntity3DToken,
  createFullBodyHero3DStandee,
  disposeSceneGraph
} from './threeUtils';

export interface City3DSceneProps {
  pyramidTier?: number;
  isPremium?: boolean;
  isAdmin?: boolean;
  interactiveMode?: boolean;
  heroAvatar?: string;
  heroNick?: string;
  heroLevel?: number;
  heroHp?: number;
  heroMaxHp?: number;
  onEnterPyramid: () => void;
  onOpenShop?: () => void;
  onOpenPort?: () => void;
  onOpenFishing?: () => void;
  onOpenBank?: () => void;
  onOpenClans?: () => void;
  onOpenClanPyramid?: () => void;
  onOpenWheel?: () => void;
  onOpenCharModal?: () => void;
}

interface LandmarkPin {
  id: string;
  label: string;
  icon: string;
  colorClass: string;
  worldPos: THREE.Vector3;
  onClick: () => void;
}

export const City3DScene: React.FC<City3DSceneProps> = ({
  pyramidTier = 1,
  isPremium = false,
  isAdmin = false,
  interactiveMode = false,
  heroAvatar = '🧙‍♂️',
  heroNick = 'Герой',
  heroLevel = 1,
  heroHp,
  heroMaxHp,
  onEnterPyramid,
  onOpenShop,
  onOpenPort,
  onOpenFishing,
  onOpenBank,
  onOpenClans,
  onOpenClanPyramid,
  onOpenWheel,
  onOpenCharModal
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredLandmark, setHoveredLandmark] = useState<string | null>(null);
  const [projectedPins, setProjectedPins] = useState<
    Array<{ id: string; label: string; icon: string; colorClass: string; x: number; y: number; visible: boolean; onClick: () => void }>
  >([]);

  // Keep latest callbacks in ref so WebGL click listeners never go stale
  const callbacksRef = useRef({
    onEnterPyramid,
    onOpenShop,
    onOpenPort,
    onOpenFishing,
    onOpenBank,
    onOpenClans,
    onOpenClanPyramid,
    onOpenWheel,
    onOpenCharModal
  });
  useEffect(() => {
    callbacksRef.current = {
      onEnterPyramid,
      onOpenShop,
      onOpenPort,
      onOpenFishing,
      onOpenBank,
      onOpenClans,
      onOpenClanPyramid,
      onOpenWheel,
      onOpenCharModal
    };
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const isSoftwareGl = detectSoftwareGl();

    // 1. Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false
      });
    } catch {
      return;
    }

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene & Environment
    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x160924);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x160924, 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 120);
    camera.position.set(0, 12.5, 19.5);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 1.8, -1.5);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minPolarAngle = 0.25;
    controls.minDistance = 8;
    controls.maxDistance = 32;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controls.update();

    // 4. Studio + Atmospheric Egyptian Night Lighting
    const hemiLight = new THREE.HemisphereLight(0xfbbf24, 0x3b0764, 0.85);
    hemiLight.position.set(0, 25, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    dirLight.position.set(14, 22, 12);
    if (!isSoftwareGl) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(1024, 1024);
      dirLight.shadow.camera.near = 2;
      dirLight.shadow.camera.far = 55;
      const d = 18;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.bias = -0.0005;
    }
    scene.add(dirLight);

    const oasisGlow = new THREE.PointLight(0x2dd4bf, 3.2, 16, 1.6);
    oasisGlow.position.set(-6.5, 2.2, 3.5);
    scene.add(oasisGlow);

    const pyramidFireLight = new THREE.PointLight(0xf97316, 4.5, 20, 1.5);
    pyramidFireLight.position.set(0, 5.5, -3.5);
    scene.add(pyramidFireLight);

    // 5. Textures & Shared Materials
    const sandstoneLightTex = createSandstoneTexture(renderer, 'light');
    const sandstoneDarkTex = createSandstoneTexture(renderer, 'dark');
    const goldTex = createSandstoneTexture(renderer, 'gold');

    const sandGroundMat = new THREE.MeshStandardMaterial({
      color: 0xc28e46,
      roughness: 0.88,
      metalness: 0.08
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      map: sandstoneLightTex,
      roughness: 0.65,
      metalness: 0.15
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      map: sandstoneDarkTex,
      roughness: 0.7,
      metalness: 0.18
    });
    const goldMat = new THREE.MeshStandardMaterial({
      map: goldTex,
      color: 0xfacc15,
      roughness: 0.22,
      metalness: 0.88
    });

    // 6. Desert Island Base + Sacred Nile River
    const groundGeo = new THREE.CylinderGeometry(24, 26, 1.2, 36);
    const groundMesh = new THREE.Mesh(groundGeo, sandGroundMat);
    groundMesh.position.y = -0.6;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Paved Royal Courtyard Plaza
    const plazaGeo = new THREE.CylinderGeometry(7.2, 7.6, 0.18, 24);
    const plazaMesh = new THREE.Mesh(plazaGeo, darkStoneMat);
    plazaMesh.position.set(0, 0.09, 1.2);
    plazaMesh.receiveShadow = true;
    scene.add(plazaMesh);

    // Sacred Nile River & Harbor Basin (West & South-West)
    const waterGeo = new THREE.CylinderGeometry(8.5, 8.5, 0.16, 28);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2,
      emissive: 0x0e7490,
      emissiveIntensity: 0.25,
      roughness: 0.12,
      metalness: 0.75
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(-7.5, 0.06, 3.2);
    scene.add(waterMesh);

    //Clickable Buildings Registry
    const clickableGroups: THREE.Object3D[] = [];
    const registerClickable = (group: THREE.Object3D, id: string, onClick: () => void) => {
      group.userData.landmarkId = id;
      group.userData.onClick = onClick;
      group.traverse((child) => {
        child.userData.landmarkId = id;
        child.userData.onClick = onClick;
      });
      clickableGroups.push(group);
    };

    // ==================== BUILDING 1: THE GREAT STEPPED PYRAMID (Center-North) ====================
    const greatPyramidGroup = new THREE.Group();
    greatPyramidGroup.position.set(0, 0, -5.8);

    const numSteps = 7;
    for (let i = 0; i < numSteps; i++) {
      const w = 9.2 - i * 1.15;
      const h = 0.75;
      const stepGeo = new THREE.BoxGeometry(w, h, w);
      const stepMesh = new THREE.Mesh(stepGeo, i % 2 === 0 ? stoneMat : darkStoneMat);
      stepMesh.position.y = i * h + h / 2;
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      greatPyramidGroup.add(stepMesh);
    }

    // Golden Pyramidion Capstone at the Apex
    const capstoneGeo = new THREE.ConeGeometry(1.15, 1.35, 4);
    capstoneGeo.rotateY(Math.PI / 4);
    const capstoneMesh = new THREE.Mesh(capstoneGeo, goldMat);
    capstoneMesh.position.y = numSteps * 0.75 + 0.65;
    capstoneMesh.castShadow = true;
    greatPyramidGroup.add(capstoneMesh);

    // Grand Temple Staircase & Glowing Portal Entrance
    const stairsGeo = new THREE.BoxGeometry(2.1, 2.6, 2.4);
    const stairsMesh = new THREE.Mesh(stairsGeo, goldMat);
    stairsMesh.position.set(0, 1.3, 4.1);
    greatPyramidGroup.add(stairsMesh);

    const portalArchGeo = new THREE.BoxGeometry(1.2, 1.7, 0.3);
    const portalArchMat = new THREE.MeshBasicMaterial({
      color: pyramidTier === 3 ? 0xf43f5e : pyramidTier === 2 ? 0xa855f7 : 0x38bdf8
    });
    const portalArch = new THREE.Mesh(portalArchGeo, portalArchMat);
    portalArch.position.set(0, 1.2, 5.25);
    greatPyramidGroup.add(portalArch);

    // Twin Obelisks Flanking the Pyramid Entrance
    const obeliskGeo = new THREE.CylinderGeometry(0.18, 0.34, 3.6, 4);
    const leftObelisk = new THREE.Mesh(obeliskGeo, goldMat);
    leftObelisk.position.set(-3.2, 1.8, 5.0);
    leftObelisk.castShadow = true;
    const rightObelisk = new THREE.Mesh(obeliskGeo, goldMat);
    rightObelisk.position.set(3.2, 1.8, 5.0);
    rightObelisk.castShadow = true;
    greatPyramidGroup.add(leftObelisk, rightObelisk);

    scene.add(greatPyramidGroup);
    registerClickable(greatPyramidGroup, 'pyramid', () => callbacksRef.current.onEnterPyramid());

    // ==================== BUILDING 2: PORT HARBOR, SHIP & ALTAR (West) ====================
    const portGroup = new THREE.Group();
    portGroup.position.set(-7.8, 0.15, -0.5);

    // Wooden Pier
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75, metalness: 0.1 });
    const pierMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 1.4), woodMat);
    pierMesh.position.set(1.6, 0.2, 0);
    portGroup.add(pierMesh);

    // Pharaoh Galley Ship (Multi-part hull + deck + mast + billowing sail)
    const shipGroup = new THREE.Group();
    shipGroup.position.set(-0.8, 0.25, 0.2);
    const hullMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.4, 2.8, 10), woodMat);
    hullMesh.rotation.z = Math.PI / 2;
    hullMesh.scale.set(0.65, 1, 1);
    shipGroup.add(hullMesh);

    const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), goldMat);
    mastMesh.position.y = 1.2;
    shipGroup.add(mastMesh);

    const sailMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      side: THREE.DoubleSide
    });
    const sailMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.35), sailMat);
    sailMesh.position.set(0, 1.35, 0.15);
    shipGroup.add(sailMesh);

    portGroup.add(shipGroup);

    // Relic Modification Altar next to Port
    const altarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.6, 8), darkStoneMat);
    altarBase.position.set(2.2, 0.3, -1.6);
    const altarCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.85,
        metalness: 0.9,
        roughness: 0.1
      })
    );
    altarCrystal.position.set(2.2, 1.15, -1.6);
    portGroup.add(altarBase, altarCrystal);

    scene.add(portGroup);
    registerClickable(portGroup, 'port', () => callbacksRef.current.onOpenPort?.());

    // ==================== BUILDING 3: SACRED NILE FISHING DOCK (South-West) ====================
    const fishingGroup = new THREE.Group();
    fishingGroup.position.set(-5.8, 0.15, 5.2);

    const dockMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 1.2), woodMat);
    dockMesh.position.set(0, 0.18, 0);
    fishingGroup.add(dockMesh);

    // Palm Tree at Fishing Oasis
    const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 8), woodMat);
    trunkMesh.position.set(0.9, 1.1, -0.5);
    fishingGroup.add(trunkMesh);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.55 });
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 4), leafMat);
      leaf.position.set(0.9 + Math.cos((l * Math.PI * 2) / 5) * 0.45, 2.15, -0.5 + Math.sin((l * Math.PI * 2) / 5) * 0.45);
      leaf.rotation.z = -Math.cos((l * Math.PI * 2) / 5) * 0.9;
      leaf.rotation.x = Math.sin((l * Math.PI * 2) / 5) * 0.9;
      fishingGroup.add(leaf);
    }

    // Giant 3D Bobber Float on Water
    const bobberGroup = new THREE.Group();
    bobberGroup.position.set(-1.3, 0.25, 0.6);
    const bobberBottom = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    const bobberTop = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.4, roughness: 0.2 })
    );
    bobberTop.position.y = 0.35;
    bobberGroup.add(bobberBottom, bobberTop);
    fishingGroup.add(bobberGroup);

    scene.add(fishingGroup);
    registerClickable(fishingGroup, 'fishing', () => callbacksRef.current.onOpenFishing?.());

    // ==================== BUILDING 4: ROYAL BAZAAR SHOP (East) ====================
    const shopGroup = new THREE.Group();
    shopGroup.position.set(6.4, 0, 1.4);

    const shopBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 2.6), stoneMat);
    shopBase.position.y = 0.75;
    shopBase.castShadow = true;
    shopGroup.add(shopBase);

    const tentMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.2,
      roughness: 0.5
    });
    const shopRoof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.3, 4), tentMat);
    shopRoof.rotation.y = Math.PI / 4;
    shopRoof.position.y = 2.15;
    shopGroup.add(shopRoof);

    const shopCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), goldMat);
    shopCrown.position.y = 3.0;
    shopGroup.add(shopCrown);

    scene.add(shopGroup);
    registerClickable(shopGroup, 'shop', () => callbacksRef.current.onOpenShop?.());

    // ==================== BUILDING 5: CRYSTAL TREASURY BANK (South-East) ====================
    const bankGroup = new THREE.Group();
    bankGroup.position.set(5.2, 0, 5.6);

    const bankPodium = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.9, 8), darkStoneMat);
    bankPodium.position.y = 0.45;
    bankGroup.add(bankPodium);

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.75,
      metalness: 0.9,
      roughness: 0.1
    });
    const bankCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), crystalMat);
    bankCrystal.position.y = 1.95;
    bankGroup.add(bankCrystal);

    const bankRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 10, 24), goldMat);
    bankRing.position.y = 1.95;
    bankGroup.add(bankRing);

    scene.add(bankGroup);
    registerClickable(bankGroup, 'bank', () => callbacksRef.current.onOpenBank?.());

    // ==================== BUILDING 6: CLAN CITADEL & CLAN PYRAMID (North-East) ====================
    const clanGroup = new THREE.Group();
    clanGroup.position.set(6.8, 0, -3.5);

    const clanPyrMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.35,
      metalness: 0.6,
      roughness: 0.3
    });
    const clanPyramidMesh = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.8, 4), clanPyrMat);
    clanPyramidMesh.rotation.y = Math.PI / 4;
    clanPyramidMesh.position.y = 1.4;
    clanPyramidMesh.castShadow = true;
    clanGroup.add(clanPyramidMesh);

    const clanTopGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), goldMat);
    clanTopGem.position.y = 3.05;
    clanGroup.add(clanTopGem);

    scene.add(clanGroup);
    registerClickable(clanGroup, 'clanPyramid', () => {
      if (callbacksRef.current.onOpenClanPyramid) {
        callbacksRef.current.onOpenClanPyramid();
      } else if (callbacksRef.current.onOpenClans) {
        callbacksRef.current.onOpenClans();
      }
    });

    // ==================== BUILDING 7: HALL OF FORTUNE / ROULETTE (North-West) ====================
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(-6.5, 0, -4.4);

    const wheelStand = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.8, 12), darkStoneMat);
    wheelStand.position.y = 0.4;
    wheelGroup.add(wheelStand);

    const fortuneWheel = new THREE.Group();
    fortuneWheel.position.set(0, 1.95, 0);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.14, 12, 24), goldMat);
    const wheelHub = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.5 })
    );
    fortuneWheel.add(wheelRim, wheelHub);
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6), goldMat);
      spoke.rotation.z = (s * Math.PI) / 4;
      fortuneWheel.add(spoke);
    }
    wheelGroup.add(fortuneWheel);

    scene.add(wheelGroup);
    registerClickable(wheelGroup, 'wheel', () => callbacksRef.current.onOpenWheel?.());

    // ==================== 8. CENTRAL 3D HERO IN COURTYARD ====================
    // Only the character with their actively equipped skin/avatar in full height without circle ("без кружочка, в рост, не вверх ногами")
    const heroModel = createFullBodyHero3DStandee({
      iconOrAvatar: heroAvatar || '🧙‍♂️',
      name: heroNick || 'Герой',
      level: heroLevel || 1,
      hp: heroHp,
      maxHp: heroMaxHp,
      isPremium
    });
    heroModel.position.set(0, 0.04, 2.4);
    scene.add(heroModel);
    registerClickable(heroModel, 'hero', () => callbacksRef.current.onOpenCharModal?.());

    // 9. Floating Fireflies / Desert Gold Embers Particle Cloud
    const particleCount = isSoftwareGl ? 35 : 80;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 28;
      particlePositions[i * 3 + 1] = 0.6 + Math.random() * 8;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.22,
      transparent: true,
      opacity: 0.75
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 10. Landmark Pins for 3D Projection
    const landmarks: LandmarkPin[] = [
      {
        id: 'pyramid',
        label: `Пирамида ${pyramidTier}`,
        icon: '🏛️',
        colorClass: 'border-amber-400 bg-amber-950/95 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.6)]',
        worldPos: new THREE.Vector3(0, 6.9, -5.8),
        onClick: () => callbacksRef.current.onEnterPyramid()
      },
      {
        id: 'port',
        label: 'Порт и Алтарь',
        icon: '⚓',
        colorClass: 'border-cyan-400 bg-cyan-950/95 text-cyan-200',
        worldPos: new THREE.Vector3(-7.8, 2.9, -0.5),
        onClick: () => callbacksRef.current.onOpenPort?.()
      },
      {
        id: 'fishing',
        label: 'Рыбалка 3D',
        icon: '🎣',
        colorClass: 'border-teal-400 bg-teal-950/95 text-teal-200',
        worldPos: new THREE.Vector3(-5.8, 2.4, 5.2),
        onClick: () => callbacksRef.current.onOpenFishing?.()
      },
      {
        id: 'shop',
        label: 'Магазин',
        icon: '🛒',
        colorClass: 'border-emerald-400 bg-emerald-950/95 text-emerald-200',
        worldPos: new THREE.Vector3(6.4, 3.4, 1.4),
        onClick: () => callbacksRef.current.onOpenShop?.()
      },
      {
        id: 'bank',
        label: 'Банк',
        icon: '🏦',
        colorClass: 'border-sky-400 bg-sky-950/95 text-sky-200',
        worldPos: new THREE.Vector3(5.2, 3.1, 5.6),
        onClick: () => callbacksRef.current.onOpenBank?.()
      },
      {
        id: 'clanPyramid',
        label: 'Битва Кланов',
        icon: '🔺',
        colorClass: 'border-red-400 bg-red-950/95 text-red-200',
        worldPos: new THREE.Vector3(6.8, 3.5, -3.5),
        onClick: () => callbacksRef.current.onOpenClanPyramid?.()
      },
      {
        id: 'wheel',
        label: 'Фортуна',
        icon: '🎰',
        colorClass: 'border-rose-400 bg-rose-950/95 text-rose-200',
        worldPos: new THREE.Vector3(-6.5, 3.3, -4.4),
        onClick: () => callbacksRef.current.onOpenWheel?.()
      }
    ];

    // 11. Raycasting for Click & Hover on 3D Buildings
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 8) return; // Dragged camera, not a click

      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableGroups, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        if (hitObj.userData?.onClick) {
          hitObj.userData.onClick();
        }
      }
    };

    let lastHoverCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 60) return;
      lastHoverCheck = now;

      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableGroups, true);
      if (hits.length > 0 && hits[0].object.userData?.landmarkId) {
        setHoveredLandmark(hits[0].object.userData.landmarkId);
        canvas.style.cursor = 'pointer';
      } else {
        setHoveredLandmark(null);
        canvas.style.cursor = 'grab';
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);

    // 12. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 13. Animation Loop with Pre-allocated Vector and Software GL Frame Pacing
    const clock = new THREE.Clock();
    const pacer = createAfterDrawPacer(renderer);
    const tempProjVec = new THREE.Vector3();
    let frameCounter = 0;

    const tick = () => {
      const elapsed = clock.getElapsedTime();
      frameCounter++;

      controls.update();

      // Animate Golden Capstone & Crystals
      capstoneMesh.rotation.y = elapsed * 0.45;
      altarCrystal.rotation.y = -elapsed * 1.1;
      altarCrystal.position.y = 1.15 + Math.sin(elapsed * 2.5) * 0.1;

      bankCrystal.rotation.y = elapsed * 0.9;
      bankCrystal.position.y = 1.95 + Math.sin(elapsed * 2.2) * 0.12;
      bankRing.rotation.x = Math.sin(elapsed * 1.2) * 0.45;
      bankRing.rotation.y = elapsed * 0.7;

      // Animate Harbor Ship & Fishing Bobber on Sacred Nile
      shipGroup.position.y = 0.25 + Math.sin(elapsed * 1.8) * 0.07;
      shipGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.04;
      bobberGroup.position.y = 0.24 + Math.sin(elapsed * 3.2) * 0.08;

      // Spin Wheel of Fortune & Clan Gem
      fortuneWheel.rotation.z = elapsed * 1.1;
      clanTopGem.rotation.y = elapsed * 1.3;

      // Hero breathing poise
      heroModel.position.y = 0.18 + Math.sin(elapsed * 1.8) * 0.012;
      heroModel.rotation.y = Math.sin(elapsed * 0.5) * 0.18;

      // Flickering Pyramid Firelight
      pyramidFireLight.intensity = 4.2 + Math.sin(elapsed * 7.5) * 0.6;

      // Update projected 2D landmark pins every 3 frames when in interactive 3D mode
      if (frameCounter % 3 === 0) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const nextPins = landmarks.map((lm) => {
          tempProjVec.copy(lm.worldPos).project(camera);
          const x = ((tempProjVec.x + 1) / 2) * w;
          const y = (-(tempProjVec.y - 1) / 2) * h;
          const visible = tempProjVec.z < 1 && x > 20 && x < w - 20 && y > 40 && y < h - 20;
          return {
            id: lm.id,
            label: lm.label,
            icon: lm.icon,
            colorClass: lm.colorClass,
            x,
            y,
            visible,
            onClick: lm.onClick
          };
        });
        setProjectedPins(nextPins);
      }

      renderer.render(scene, camera);
      pacer.scheduleNextFrame(tick, isSoftwareGl);
    };

    pacer.scheduleNextFrame(tick, isSoftwareGl);

    return () => {
      pacer.cancel();
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      envTarget.dispose();
      disposeSceneGraph(scene);
      renderer.dispose();
    };
  }, [pyramidTier, isPremium, isAdmin, heroAvatar, heroNick, heroLevel, heroHp, heroMaxHp]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden select-none">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* Interactive 3D Landmark Floating Pins (always clickable in 3D Explorer mode, subtle in standard mode) */}
      <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
        {projectedPins.map(
          (pin) =>
            pin.visible && (
              <button
                key={pin.id}
                type="button"
                onClick={pin.onClick}
                style={{
                  transform: `translate3d(${Math.round(pin.x)}px, ${Math.round(pin.y)}px, 0) translate(-50%, -50%)`
                }}
                className={`pointer-events-auto absolute top-0 left-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-black whitespace-nowrap transition-transform active:scale-90 cursor-pointer ${
                  pin.colorClass
                } ${
                  hoveredLandmark === pin.id ? 'scale-110 ring-2 ring-white' : ''
                } ${interactiveMode ? 'opacity-100' : 'opacity-85 hover:opacity-100'}`}
              >
                <span>{pin.icon}</span>
                <span>{pin.label}</span>
              </button>
            )
        )}
      </div>
    </div>
  );
};
