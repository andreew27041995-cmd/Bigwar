import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HeroState, PyramidCell, PlayerPosition, DamagePopup } from '../../types/game';
import {
  detectSoftwareGl,
  createAfterDrawPacer,
  createSandstoneTexture,
  createHero3DModel,
  createMonster3DModel,
  createPortal3DModel,
  createSack3DModel,
  createNpcSentinel3DModel,
  createEntity3DToken,
  disposeSceneGraph
} from './threeUtils';
import { isSimulatedBotNick } from '../../utils/botSimulation';

export interface Pyramid3DSceneProps {
  hero: HeroState;
  pyramidTier: number;
  pyramidMap: PyramidCell[][];
  playerPos: PlayerPosition;
  activeOtherPlayers: any[];
  activePyramidNpcs: any[];
  npcWanderPositions: Record<string, { row: number; col: number }>;
  damagePopups: DamagePopup[];
  currentUser?: string;
  cameraMode: 'overview' | 'chase';
  onBlockClick: (row: number, col: number) => void;
  onExitToCity: () => void;
}

const STEP_W = 1.32;
const STEP_H = 0.56;
const STEP_D = 1.16;

function getCellWorldPosition(row: number, col: number, target = new THREE.Vector3()): THREE.Vector3 {
  const x = (col - row / 2) * STEP_W;
  const y = (9 - row) * STEP_H + STEP_H; // Top surface of the step
  const z = (row - 4.5) * STEP_D;
  return target.set(x, y, z);
}

interface FloatingCellBadge {
  key: string;
  row: number;
  col: number;
  x: number;
  y: number;
  visible: boolean;
  isAdjacent: boolean;
  isPlayer: boolean;
  kind: 'player' | 'mob' | 'otherPlayer' | 'npc' | 'portal' | 'sack' | 'exit';
  title: string;
  subtitle?: string;
  icon: string;
  hpPct?: number;
  isBoss?: boolean;
  isOnline?: boolean;
  isCrystal?: boolean;
}

export const Pyramid3DScene: React.FC<Pyramid3DSceneProps> = ({
  hero,
  pyramidTier,
  pyramidMap,
  playerPos,
  activeOtherPlayers,
  activePyramidNpcs,
  npcWanderPositions,
  damagePopups,
  currentUser = '',
  cameraMode,
  onBlockClick,
  onExitToCity
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [badges, setBadges] = useState<FloatingCellBadge[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Refs for reactive props accessed inside the WebGL loop & click handlers
  const stateRef = useRef({
    hero,
    pyramidTier,
    pyramidMap,
    playerPos,
    activeOtherPlayers,
    activePyramidNpcs,
    npcWanderPositions,
    currentUser,
    cameraMode,
    onBlockClick,
    onExitToCity
  });

  useEffect(() => {
    stateRef.current = {
      hero,
      pyramidTier,
      pyramidMap,
      playerPos,
      activeOtherPlayers,
      activePyramidNpcs,
      npcWanderPositions,
      currentUser,
      cameraMode,
      onBlockClick,
      onExitToCity
    };
  });

  // Track last attack animation trigger when player clicks an adjacent enemy or damage popup spawns
  const attackAnimUntilRef = useRef<number>(0);
  const attackTargetPosRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (damagePopups.length > 0) {
      attackAnimUntilRef.current = performance.now() + 550;
    }
  }, [damagePopups]);

  // Rebuild dynamic entities (monsters, sacks, portals, other players, NPCs) when map or players change
  const dynamicRebuildRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (dynamicRebuildRef.current) {
      dynamicRebuildRef.current();
    }
  }, [pyramidMap, activeOtherPlayers, activePyramidNpcs, npcWanderPositions, playerPos, pyramidTier]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const isSoftwareGl = detectSoftwareGl();

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
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene & Atmosphere by Pyramid Tier
    const scene = new THREE.Scene();
    const tierBgColors: Record<number, number> = {
      1: 0x1a0d05, // Tomb of Cheops Warm Amber Night
      2: 0x140826, // Temple of Anubis Mystic Violet
      3: 0x24070d  // Hall of Ra Solar Crimson
    };
    const bgHex = tierBgColors[stateRef.current.pyramidTier] || 0x1a0d05;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.025);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.5, 100);
    camera.position.set(0, 11.2, 14.8);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 2.6, 0.4);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minPolarAngle = 0.2;
    controls.minDistance = 5.5;
    controls.maxDistance = 26;
    controls.enablePan = false;
    controls.update();

    // Studio & Temple Lighting
    const hemiLight = new THREE.HemisphereLight(0xfde68a, 0x291306, 0.9);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.3);
    sunLight.position.set(10, 18, 12);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 45;
      const d = 12;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    const apexLight = new THREE.PointLight(0xfacc15, 3.8, 15, 1.5);
    apexLight.position.set(0, 7.6, -5.3);
    scene.add(apexLight);

    // Procedural Textures & Materials
    const stoneLightTex = createSandstoneTexture(renderer, 'light');
    const stoneDarkTex = createSandstoneTexture(renderer, 'dark');
    const goldTex = createSandstoneTexture(renderer, 'gold');
    const portalTex = createSandstoneTexture(renderer, 'portal');

    const stepMatEven = new THREE.MeshStandardMaterial({
      map: stoneLightTex,
      roughness: 0.62,
      metalness: 0.14
    });
    const stepMatOdd = new THREE.MeshStandardMaterial({
      map: stoneDarkTex,
      roughness: 0.68,
      metalness: 0.16
    });
    const goldMat = new THREE.MeshStandardMaterial({
      map: goldTex,
      color: 0xfacc15,
      roughness: 0.22,
      metalness: 0.86
    });
    const portalStepMat = new THREE.MeshStandardMaterial({
      map: portalTex,
      roughness: 0.35,
      metalness: 0.5
    });

    // Desert Floor & Monumental Backing Slope
    const desertMat = new THREE.MeshStandardMaterial({
      color: 0x8f5b24,
      roughness: 0.9,
      metalness: 0.05
    });
    const desertFloor = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 1.0, 32), desertMat);
    desertFloor.position.y = -0.5;
    desertFloor.receiveShadow = true;
    scene.add(desertFloor);

    // Decorative Blue Crystal Obelisks on Left & Right Foreground Corners
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      metalness: 0.85,
      roughness: 0.15
    });
    const leftCrystal = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.4, 5), crystalMat);
    leftCrystal.position.set(-7.6, 1.1, 5.6);
    leftCrystal.rotation.z = -0.15;
    const rightCrystal = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.4, 5), crystalMat);
    rightCrystal.position.set(7.6, 1.1, 5.6);
    rightCrystal.rotation.z = 0.15;
    scene.add(leftCrystal, rightCrystal);

    // 55 Stepped Pyramid Cells (row 0..9, col 0..row)
    const stepMeshes: THREE.Mesh[] = [];
    const stepHighlightMeshes: Map<string, THREE.Mesh> = new Map();
    const stepGeo = new THREE.BoxGeometry(STEP_W * 0.96, STEP_H, STEP_D * 0.95);
    const highlightGeo = new THREE.PlaneGeometry(STEP_W * 0.88, STEP_D * 0.86);
    highlightGeo.rotateX(-Math.PI / 2);

    const pyramidBlocksGroup = new THREE.Group();
    scene.add(pyramidBlocksGroup);

    const tempPos = new THREE.Vector3();

    for (let r = 0; r < 10; r++) {
      // Backing solid stone row beam so there are no hollow gaps under the steps
      const rowWidth = (r + 1) * STEP_W + 0.6;
      const rowHeight = (9 - r + 1) * STEP_H;
      const rowBeamGeo = new THREE.BoxGeometry(rowWidth, rowHeight, STEP_D * 0.98);
      const rowBeam = new THREE.Mesh(rowBeamGeo, r % 2 === 0 ? stepMatOdd : stepMatEven);
      rowBeam.position.set(0, rowHeight / 2 - 0.02, (r - 4.5) * STEP_D);
      rowBeam.receiveShadow = true;
      pyramidBlocksGroup.add(rowBeam);

      for (let c = 0; c <= r; c++) {
        getCellWorldPosition(r, c, tempPos);
        const stepMesh = new THREE.Mesh(stepGeo, (r + c) % 2 === 0 ? stepMatEven : stepMatOdd);
        stepMesh.position.set(tempPos.x, tempPos.y - STEP_H / 2 + 0.02, tempPos.z);
        stepMesh.castShadow = true;
        stepMesh.receiveShadow = true;
        stepMesh.userData = { row: r, col: c };
        pyramidBlocksGroup.add(stepMesh);
        stepMeshes.push(stepMesh);

        // Tactical Highlight Frame on Top Surface of Each Step
        const hlMat = new THREE.MeshBasicMaterial({
          color: 0xfde047,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide
        });
        const hlMesh = new THREE.Mesh(highlightGeo, hlMat);
        hlMesh.position.set(tempPos.x, tempPos.y + 0.035, tempPos.z);
        hlMesh.userData = { row: r, col: c };
        pyramidBlocksGroup.add(hlMesh);
        stepHighlightMeshes.set(`${r}-${c}`, hlMesh);
      }
    }

    // Golden Pyramidion Capstone Floating Above Row 0 [0, 0]
    getCellWorldPosition(0, 0, tempPos);
    const capstoneGeo = new THREE.ConeGeometry(0.85, 1.1, 4);
    capstoneGeo.rotateY(Math.PI / 4);
    const capstoneMesh = new THREE.Mesh(capstoneGeo, goldMat);
    capstoneMesh.position.set(tempPos.x, tempPos.y + 1.45, tempPos.z);
    capstoneMesh.castShadow = true;
    scene.add(capstoneMesh);

    // 3D Stone Exit Archway at [9, 0] (Bottom-Left Base Step)
    getCellWorldPosition(9, 0, tempPos);
    const exitArchGroup = new THREE.Group();
    exitArchGroup.position.set(tempPos.x, tempPos.y, tempPos.z + 0.35);
    const archPillarGeo = new THREE.BoxGeometry(0.12, 0.75, 0.12);
    const leftArchPillar = new THREE.Mesh(archPillarGeo, goldMat);
    leftArchPillar.position.set(-0.35, 0.38, 0);
    const rightArchPillar = new THREE.Mesh(archPillarGeo, goldMat);
    rightArchPillar.position.set(0.35, 0.38, 0);
    const topArchBar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.16), crystalMat);
    topArchBar.position.set(0, 0.78, 0);
    exitArchGroup.add(leftArchPillar, rightArchPillar, topArchBar);
    scene.add(exitArchGroup);

    // Main 3D Player Hero Model (Preserving full avatar image on 3D golden pedestal)
    const heroGroup = createEntity3DToken({
      iconOrAvatar: stateRef.current.hero.avatar || '🤴',
      kind: 'hero',
      name: stateRef.current.currentUser || 'Герой',
      level: stateRef.current.hero.level,
      hp: stateRef.current.hero.hp,
      maxHp: stateRef.current.hero.maxHp,
      isPremium: Boolean(stateRef.current.hero.isPremium)
    });
    heroGroup.scale.setScalar(1.08);
    getCellWorldPosition(stateRef.current.playerPos.row, stateRef.current.playerPos.col, tempPos);
    heroGroup.position.copy(tempPos);
    scene.add(heroGroup);

    // Dynamic Entities Container (Monsters, Portals, Sacks, Other Players, NPCs)
    const dynamicEntitiesGroup = new THREE.Group();
    scene.add(dynamicEntitiesGroup);

    const rebuildDynamicEntities = () => {
      // Clear previous dynamic models
      while (dynamicEntitiesGroup.children.length > 0) {
        const child = dynamicEntitiesGroup.children[0];
        dynamicEntitiesGroup.remove(child);
        disposeSceneGraph(child);
      }

      const {
        pyramidMap: map,
        playerPos: pPos,
        activeOtherPlayers: otherPlayers,
        activePyramidNpcs: npcs,
        npcWanderPositions: wanderPos,
        currentUser: curUser
      } = stateRef.current;

      // Update Step Highlight Colors & Spawn Entities
      for (let r = 0; r < Math.min(10, map.length); r++) {
        const rowCells = map[r] || [];
        for (let c = 0; c <= r; c++) {
          const cell = rowCells[c];
          if (!cell) continue;

          const isPlayer = r === pPos.row && c === pPos.col;
          const isExit = r === map.length - 1 && c === 0;
          const isSpawnNextToExit = r === map.length - 1 && c === 1;
          const isAdjacent = Math.abs(r - pPos.row) <= 1 && Math.abs(c - pPos.col) <= 1;
          const isPortal = cell.type === 'portal' || cell.type === 'nextTier';
          const isSack = cell.type === 'sack' && !isExit && !isSpawnNextToExit;
          const isMob =
            (cell.type === 'mob' || (Number(cell.mobHp) > 0 && Boolean(cell.mobName))) &&
            !isPlayer &&
            !isExit &&
            !isSpawnNextToExit;

          const otherOnCell = isMob
            ? []
            : otherPlayers.filter((p: any) => {
                if (p.isSimulatedBot || isSimulatedBotNick(p.nick || p.name)) return false;
                return Number(p.row) === r && Number(p.col) === c;
              });
          const isOtherPlayer = !isMob && otherOnCell.length > 0;

          const npcList = isMob
            ? []
            : npcs.filter((n: any) => {
                const pos = wanderPos[n.ownerNick.toLowerCase()] || { row: n.row, col: n.col };
                return pos.row === r && pos.col === c;
              });
          const npcOnCell = npcList[0] || null;

          // Update Tactical Tile Highlight
          const hlMesh = stepHighlightMeshes.get(`${r}-${c}`);
          if (hlMesh) {
            const mat = hlMesh.material as THREE.MeshBasicMaterial;
            if (isPlayer) {
              mat.color.setHex(0x10b981); // Bright Emerald under Hero
              mat.opacity = 0.65;
            } else if (isPortal) {
              mat.color.setHex(0xa855f7);
              mat.opacity = 0.55;
            } else if (isMob && isAdjacent) {
              mat.color.setHex(0xef4444); // Attackable Adjacent Monster
              mat.opacity = 0.55;
            } else if (isOtherPlayer && isAdjacent) {
              mat.color.setHex(0xf97316);
              mat.opacity = 0.55;
            } else if (isAdjacent) {
              mat.color.setHex(0xfde047); // Reachable Step
              mat.opacity = 0.32;
            } else {
              mat.opacity = 0.0;
            }
          }

          getCellWorldPosition(r, c, tempPos);

          // Place 3D Portal
          if (isPortal) {
            const portalModel = createPortal3DModel();
            portalModel.position.copy(tempPos);
            portalModel.userData = { row: r, col: c, isPortal: true };
            dynamicEntitiesGroup.add(portalModel);
          }
          // Place 3D Treasure Sack or Crystal Cluster
          else if (isSack) {
            const isCrystal =
              cell.rareBossId === 'crystal' || Boolean(cell.sackCrystals && cell.sackCrystals > 0);
            const sackModel = createSack3DModel(isCrystal);
            sackModel.position.copy(tempPos);
            sackModel.userData = { row: r, col: c, isSack: true };
            dynamicEntitiesGroup.add(sackModel);
          }
          // Place 3D Monster / Boss (Preserving monster icon/art on 3D pedestal with 3D HP bar)
          else if (isMob && cell.mobMaxHp) {
            const mobModel = createEntity3DToken({
              iconOrAvatar: cell.icon || '🧟',
              kind: 'mob',
              name: cell.mobName,
              level: cell.mobLvl,
              hp: cell.mobHp,
              maxHp: cell.mobMaxHp,
              isBoss: cell.isBoss
            });
            mobModel.position.copy(tempPos);
            mobModel.userData = { row: r, col: c, isMob: true, isBoss: cell.isBoss };
            dynamicEntitiesGroup.add(mobModel);
          }

          // Place 3D Other Player (Preserving other player avatar/skin in 3D)
          if (isOtherPlayer) {
            const pData = otherOnCell[0];
            const isOnline = pData ? Boolean(pData.isOnline) : Boolean(cell.playerIsOnline ?? true);
            const rivalModel = createEntity3DToken({
              iconOrAvatar: pData?.avatar || cell.playerAvatar || '🥷',
              kind: 'otherPlayer',
              name: pData?.nick || cell.playerNick,
              level: pData?.lvl || cell.playerLvl,
              hp: pData?.hp || cell.playerHp,
              maxHp: pData?.maxHp || cell.playerMaxHp,
              isOnline
            });
            rivalModel.scale.setScalar(0.95);
            rivalModel.position.copy(tempPos);
            if (isPlayer) {
              rivalModel.position.x += 0.28;
            }
            rivalModel.userData = { row: r, col: c };
            dynamicEntitiesGroup.add(rivalModel);
          }

          // Place 3D Roaming NPC Sentinel
          if (npcOnCell && !isMob) {
            const npcModel = createEntity3DToken({
              iconOrAvatar: npcOnCell.icon || '🤖',
              kind: 'npc',
              name: npcOnCell.name,
              hp: npcOnCell.hp,
              maxHp: npcOnCell.maxHp
            });
            npcModel.scale.setScalar(0.88);
            npcModel.position.copy(tempPos);
            if (isPlayer || isOtherPlayer) {
              npcModel.position.x -= 0.3;
            }
            npcModel.userData = { row: r, col: c };
            dynamicEntitiesGroup.add(npcModel);
          }
        }
      }
    };

    dynamicRebuildRef.current = rebuildDynamicEntities;
    rebuildDynamicEntities();

    // Raycasting for Clicking 3D Steps / Monsters
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const findCellFromHit = (obj: THREE.Object3D | null): { row: number; col: number } | null => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (typeof cur.userData?.row === 'number' && typeof cur.userData?.col === 'number') {
          return { row: cur.userData.row, col: cur.userData.col };
        }
        cur = cur.parent;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      const isTouch = e.pointerType === 'touch' || ('ontouchstart' in window);
      if (dist > (isTouch ? 35 : 12)) return; // Allow mobile finger taps without accidental orbit-drag discard

      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const targets = [...stepMeshes, ...dynamicEntitiesGroup.children];
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const cellCoords = findCellFromHit(hits[0].object);
        if (cellCoords) {
          const { playerPos: pPos, onBlockClick: handleClick } = stateRef.current;
          const isAdj =
            Math.abs(cellCoords.row - pPos.row) <= 1 && Math.abs(cellCoords.col - pPos.col) <= 1;
          if (isAdj) {
            // Trigger 3D Hero Lunge / Sword Swing toward clicked cell
            const targetWorld = getCellWorldPosition(cellCoords.row, cellCoords.col, new THREE.Vector3());
            attackTargetPosRef.current = targetWorld;
            attackAnimUntilRef.current = performance.now() + 450;
          }
          handleClick(cellCoords.row, cellCoords.col);
        }
      }
    };

    let lastMoveCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveCheck < 50) return;
      lastMoveCheck = now;

      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(stepMeshes, false);
      if (hits.length > 0) {
        const cellCoords = findCellFromHit(hits[0].object);
        if (cellCoords) {
          const { playerPos: pPos } = stateRef.current;
          const isAdj =
            Math.abs(cellCoords.row - pPos.row) <= 1 && Math.abs(cellCoords.col - pPos.col) <= 1;
          setHoveredCell(cellCoords);
          canvas.style.cursor = isAdj ? 'pointer' : 'grab';
          return;
        }
      }
      setHoveredCell(null);
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);

    // Resize Observer
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

    // Render Loop with Pre-Allocated Math Objects
    const clock = new THREE.Clock();
    const pacer = createAfterDrawPacer(renderer);
    const targetHeroWorldPos = new THREE.Vector3();
    const desiredCamTarget = new THREE.Vector3();
    const desiredCamPos = new THREE.Vector3();
    const projVec = new THREE.Vector3();
    let frameCount = 0;

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      frameCount++;

      const {
        playerPos: pPos,
        cameraMode: camMode,
        pyramidMap: map,
        hero: curHero,
        activeOtherPlayers: otherPlayers,
        activePyramidNpcs: npcs,
        npcWanderPositions: wanderPos,
        currentUser: curUser
      } = stateRef.current;

      // 1. Smoothly Interpolate 3D Hero Position across Pyramid Steps
      getCellWorldPosition(pPos.row, pPos.col, targetHeroWorldPos);
      heroGroup.position.lerp(targetHeroWorldPos, Math.min(1, delta * 10));

      // Rotate Hero toward attack target or camera
      if (attackTargetPosRef.current) {
        const dx = attackTargetPosRef.current.x - heroGroup.position.x;
        const dz = attackTargetPosRef.current.z - heroGroup.position.z;
        if (Math.hypot(dx, dz) > 0.05) {
          const targetAngle = Math.atan2(dx, dz);
          heroGroup.rotation.y = THREE.MathUtils.lerp(heroGroup.rotation.y, targetAngle, 0.25);
        }
      } else {
        heroGroup.rotation.y = THREE.MathUtils.lerp(heroGroup.rotation.y, 0, 0.1);
      }

      // Hero Sword Swing Animation during Combat / Step Click
      const weaponPivot = heroGroup.getObjectByName('weaponPivot');
      const nowMs = performance.now();
      if (weaponPivot) {
        if (nowMs < attackAnimUntilRef.current) {
          const phase = (attackAnimUntilRef.current - nowMs) / 450;
          weaponPivot.rotation.x = Math.sin(phase * Math.PI * 2) * 1.35;
        } else {
          weaponPivot.rotation.x = Math.sin(elapsed * 2.5) * 0.08;
        }
      }

      // 2. Camera Choreography (Overview vs Chase)
      if (camMode === 'chase') {
        desiredCamTarget.set(
          heroGroup.position.x,
          heroGroup.position.y + 0.65,
          heroGroup.position.z
        );
        controls.target.lerp(desiredCamTarget, Math.min(1, delta * 6));
      } else {
        desiredCamTarget.set(0, 2.7, 0.2);
        controls.target.lerp(desiredCamTarget, Math.min(1, delta * 4));
      }
      controls.update();

      // 3. Animate Capstone & Dynamic Entities
      capstoneMesh.rotation.y = elapsed * 0.6;
      capstoneMesh.position.y =
        getCellWorldPosition(0, 0, projVec).y + 1.45 + Math.sin(elapsed * 2.2) * 0.08;

      // Token Medallion & Portal Animations
      const heroTokenFace = heroGroup.getObjectByName('tokenFace');
      if (heroTokenFace) {
        heroTokenFace.position.y = 0.5 * heroGroup.scale.y + Math.sin(elapsed * 2.8) * 0.035;
      }

      dynamicEntitiesGroup.children.forEach((entity, idx) => {
        const tokenFace = entity.getObjectByName('tokenFace');
        if (tokenFace) {
          tokenFace.position.y = 0.5 * (entity.scale.y || 1) + Math.sin(elapsed * 2.2 + idx) * 0.025;
        }

        if (entity.userData?.isMob) {
          entity.rotation.y = Math.sin(elapsed * 1.4 + idx) * 0.22;
        } else if (entity.userData?.isPortal) {
          const vortex = entity.getObjectByName('portalVortex');
          const core = entity.getObjectByName('portalCore');
          if (vortex) vortex.rotation.z = elapsed * 2.2;
          if (core) core.rotation.y = -elapsed * 2.5;
        } else if (entity.userData?.isSack) {
          entity.rotation.y = elapsed * 0.9;
        }
      });

      // 4. Project Floating Tactical Badges Every 3 Frames
      if (frameCount % 3 === 0) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const nextBadges: FloatingCellBadge[] = [];

        for (let r = 0; r < Math.min(10, map.length); r++) {
          const rowCells = map[r] || [];
          for (let c = 0; c <= r; c++) {
            const cell = rowCells[c];
            if (!cell) continue;

            const isPlayer = r === pPos.row && c === pPos.col;
            const isExit = r === map.length - 1 && c === 0;
            const isSpawnNextToExit = r === map.length - 1 && c === 1;
            const isAdjacent = Math.abs(r - pPos.row) <= 1 && Math.abs(c - pPos.col) <= 1;
            const isPortal = cell.type === 'portal' || cell.type === 'nextTier';
            const isSack = cell.type === 'sack' && !isExit && !isSpawnNextToExit;
            const isMob =
              (cell.type === 'mob' || (Number(cell.mobHp) > 0 && Boolean(cell.mobName))) &&
              !isPlayer &&
              !isExit &&
              !isSpawnNextToExit;

            const otherOnCell = isMob
              ? []
              : otherPlayers.filter((p: any) => Number(p.row) === r && Number(p.col) === c);
            const isOtherPlayer =
              !isMob &&
              (otherOnCell.length > 0 ||
                cell.type === 'player' ||
                Boolean(
                  cell.playerNick &&
                    (!curUser || cell.playerNick.toLowerCase() !== curUser.trim().toLowerCase())
                ));

            const npcList = isMob
              ? []
              : npcs.filter((n: any) => {
                  const pos = wanderPos[n.ownerNick.toLowerCase()] || { row: n.row, col: n.col };
                  return pos.row === r && pos.col === c;
                });
            const npcOnCell = npcList[0] || null;

            if (!isPlayer && !isMob && !isOtherPlayer && !npcOnCell && !isPortal && !isSack && !isExit) {
              continue;
            }

            getCellWorldPosition(r, c, projVec);
            projVec.y += isPlayer || isMob || isOtherPlayer ? 1.05 : 0.65;
            projVec.project(camera);

            const sx = ((projVec.x + 1) / 2) * w;
            const sy = (-(projVec.y - 1) / 2) * h;
            const visible = projVec.z < 1 && sx > 10 && sx < w - 10 && sy > 20 && sy < h - 10;

            if (isPlayer) {
              nextBadges.push({
                key: `p-${r}-${c}`,
                row: r,
                col: c,
                x: sx,
                y: sy,
                visible,
                isAdjacent: true,
                isPlayer: true,
                kind: 'player',
                title: curUser || 'Вы',
                subtitle: `Ур.${curHero.level}`,
                icon: '👑',
                hpPct: Math.max(0, Math.min(100, (curHero.hp / Math.max(1, curHero.maxHp)) * 100))
              });
            } else if (isMob && cell.mobMaxHp) {
              nextBadges.push({
                key: `m-${r}-${c}`,
                row: r,
                col: c,
                x: sx,
                y: sy,
                visible,
                isAdjacent,
                isPlayer: false,
                kind: 'mob',
                title: `L${cell.mobLvl}`,
                subtitle: cell.mobName || 'Монстр',
                icon: cell.icon && !cell.icon.startsWith('http') && !cell.icon.startsWith('data:') ? cell.icon : cell.isBoss ? '👑' : '🦂',
                hpPct: Math.max(0, Math.min(100, ((cell.mobHp || 0) / Math.max(1, cell.mobMaxHp)) * 100)),
                isBoss: cell.isBoss
              });
            } else if (isOtherPlayer) {
              const pData = otherOnCell[0];
              const enemyNick = pData?.nick || pData?.name || cell.playerNick || 'Соперник';
              const enemyLvl = pData?.lvl || cell.playerLvl || 1;
              const enemyHp = pData?.hp ?? cell.playerHp ?? 100;
              const enemyMaxHp = pData?.maxHp ?? cell.playerMaxHp ?? 100;
              const enemyIsOnline = pData ? Boolean(pData.isOnline) : Boolean(cell.playerIsOnline ?? true);
              nextBadges.push({
                key: `op-${r}-${c}`,
                row: r,
                col: c,
                x: sx,
                y: sy,
                visible,
                isAdjacent,
                isPlayer: false,
                kind: 'otherPlayer',
                title: enemyNick,
                subtitle: `Ур.${enemyLvl}`,
                icon: enemyIsOnline ? '⚔️' : '🛡️',
                hpPct: Math.max(0, Math.min(100, (enemyHp / Math.max(1, enemyMaxHp)) * 100)),
                isOnline: enemyIsOnline
              });
            } else if (npcOnCell) {
              nextBadges.push({
                key: `npc-${r}-${c}`,
                row: r,
                col: c,
                x: sx,
                y: sy,
                visible,
                isAdjacent,
                isPlayer: false,
                kind: 'npc',
                title: npcOnCell.isOwn ? 'ВАШ NPC' : npcOnCell.ownerNick,
                icon: npcOnCell.icon || '🤖',
                hpPct: Math.max(0, Math.min(100, (npcOnCell.hp / Math.max(1, npcOnCell.maxHp)) * 100))
              });
            } else if (isPortal) {
              nextBadges.push({
                key: `port-${r}-${c}`,
                row: r,
                col: c,
                x: sx,
                y: sy,
                visible,
                isAdjacent,
                isPlayer: false,
                kind: 'portal',
                title: 'ПОРТАЛ',
                icon: '🌀'
              });
            } else if (isSack) {
              const isCrystal =
                cell.rareBossId === 'crystal' || Boolean(cell.sackCrystals && cell.sackCrystals > 0);
              nextBadges.push({
                key: `sack-${r}-${c}`,
                row: r,
                col: c,
                x: sx,
                y: sy,
                visible,
                isAdjacent,
                isPlayer: false,
                kind: 'sack',
                title: isCrystal ? '+25 💎' : 'КЛАД',
                icon: isCrystal ? '💎' : '💰',
                isCrystal
              });
            } else if (isExit) {
              nextBadges.push({
                key: `exit-${r}-${c}`,
                row: r,
                col: c,
                x: sx,
                y: sy,
                visible,
                isAdjacent,
                isPlayer: false,
                kind: 'exit',
                title: 'ВЫХОД',
                icon: '🚪'
              });
            }
          }
        }
        setBadges(nextBadges);
      }

      renderer.render(scene, camera);
      pacer.scheduleNextFrame(tick, isSoftwareGl);
    };

    pacer.scheduleNextFrame(tick, isSoftwareGl);

    return () => {
      pacer.cancel();
      dynamicRebuildRef.current = null;
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      envTarget.dispose();
      disposeSceneGraph(scene);
      renderer.dispose();
    };
  }, []);

  const firstLineRow = (pyramidMap.length || 10) - 1;
  const isOnFirstLine = playerPos.row === firstLineRow;

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 w-full overflow-hidden select-none">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* Projected 3D Tactical Badges Over Entities (Monsters, Players, Portals, Treasure) */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {badges.map((b) => {
          if (!b.visible) return null;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                if (b.isAdjacent) {
                  attackTargetPosRef.current = getCellWorldPosition(b.row, b.col, new THREE.Vector3());
                  attackAnimUntilRef.current = performance.now() + 450;
                }
                onBlockClick(b.row, b.col);
              }}
              style={{
                transform: `translate3d(${Math.round(b.x)}px, ${Math.round(b.y)}px, 0) translate(-50%, -100%)`
              }}
              className={`pointer-events-auto absolute top-0 left-0 flex flex-col items-center rounded-md border px-1.5 py-0.5 text-[7.5px] font-black leading-none transition-transform active:scale-90 ${
                b.kind === 'player'
                  ? 'border-emerald-400 bg-slate-950/95 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.7)] z-30'
                  : b.kind === 'mob'
                  ? b.isBoss
                    ? 'border-yellow-400 bg-red-950/95 text-yellow-200 shadow-[0_0_10px_rgba(239,68,68,0.8)] z-20 cursor-pointer'
                    : 'border-red-500/80 bg-slate-950/92 text-amber-100 cursor-pointer'
                  : b.kind === 'otherPlayer'
                  ? 'border-red-400 bg-red-950/95 text-red-100 cursor-pointer'
                  : b.kind === 'portal'
                  ? 'border-purple-400 bg-purple-950/95 text-purple-200 cursor-pointer'
                  : b.kind === 'sack'
                  ? b.isCrystal
                    ? 'border-cyan-300 bg-cyan-950/95 text-cyan-200 cursor-pointer'
                    : 'border-amber-400 bg-amber-950/95 text-amber-200 cursor-pointer'
                  : b.kind === 'exit'
                  ? 'border-cyan-400/80 bg-slate-950/95 text-cyan-300 cursor-pointer'
                  : 'border-teal-400 bg-slate-950/95 text-teal-200 cursor-pointer'
              } ${b.isAdjacent && !b.isPlayer ? 'ring-1 ring-yellow-300/80 hover:scale-110' : 'opacity-90'}`}
              title={`${b.subtitle || b.title} [${b.row}, ${b.col}]`}
            >
              <div className="flex items-center gap-0.5 whitespace-nowrap">
                <span>{b.icon}</span>
                <span>{b.title}</span>
              </div>
              {typeof b.hpPct === 'number' && (
                <div className="mt-0.5 h-[3px] w-9 overflow-hidden rounded-full bg-slate-800 border border-black/60">
                  <div
                    className={`h-full ${
                      b.kind === 'player' ? 'bg-emerald-400' : 'bg-red-500'
                    }`}
                    style={{ width: `${b.hpPct}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom 3D Controls Hint & Carved Exit Button */}
      <div className="pointer-events-none absolute bottom-1.5 inset-x-0 z-20 flex flex-col items-center gap-1 px-2">
        <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-slate-950/90 px-2.5 py-0.5 text-[7.5px] font-bold text-amber-200/90 shadow">
          <span>👆 Вращение: свайп пальцем</span>
          <span>•</span>
          <span>⚔️ Шаг и бой: тап по соседней ступени</span>
          {hoveredCell && (
            <>
              <span>•</span>
              <span className="text-yellow-300 font-black">
                [{hoveredCell.row}, {hoveredCell.col}]
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          data-tutorial="pyramid-exit"
          onClick={() => onExitToCity()}
          title={
            isOnFirstLine
              ? 'Выйти из 3D Пирамиды в город (вы на 1-й линии)'
              : 'Выход работает только когда персонаж стоит на 1-й линии (нижний ряд у входа)!'
          }
          className={`pointer-events-auto group relative flex items-center justify-center gap-1.5 rounded-md border-2 px-4 py-0.5 transition-all active:scale-95 cursor-pointer ${
            isOnFirstLine
              ? 'border-cyan-400/90 bg-gradient-to-b from-[#2b353b] via-[#162026] to-[#0b1114] text-cyan-300 shadow-[0_3px_8px_rgba(0,0,0,0.9),0_0_12px_rgba(56,189,248,0.45)] hover:border-cyan-300'
              : 'border-slate-600/80 bg-gradient-to-b from-[#1e2226] via-[#121619] to-[#090b0d] text-slate-400 opacity-80 hover:border-amber-500/60'
          }`}
        >
          <span className="text-[8px]">{isOnFirstLine ? '❖' : '🔒'}</span>
          <span className="font-serif text-[10px] sm:text-[11px] font-black tracking-[0.14em] uppercase">
            {isOnFirstLine ? 'ВЫХОД В ГОРОД' : 'ВЫХОД (1-Я ЛИНИЯ)'}
          </span>
          <span className="text-[8px]">❖</span>
        </button>
      </div>
    </div>
  );
};
