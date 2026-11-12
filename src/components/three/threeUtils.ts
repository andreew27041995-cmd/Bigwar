import * as THREE from 'three';

// 1. Software WebGL Detection (Probe once and free context immediately)
let cachedIsSoftwareGl: boolean | null = null;

export function detectSoftwareGl(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererInfo = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoft = /SwiftShader|llvmpipe|Software|Mesa OffScreen/i.test(rendererInfo);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = isSoft;
    return isSoft;
  } catch {
    cachedIsSoftwareGl = false;
    return false;
  }
}

// 2. GPU Fence-Sync Frame Pacing for Software WebGL
export function createAfterDrawPacer(renderer: THREE.WebGLRenderer) {
  let cancelled = false;
  let timerId: number | null = null;
  let rafId: number | null = null;

  const gl = renderer.getContext() as WebGL2RenderingContext;

  const afterDraw = (cb: () => void) => {
    if (cancelled) return;
    if (typeof gl.fenceSync !== 'function') {
      timerId = window.setTimeout(cb, 16);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      timerId = window.setTimeout(cb, 16);
      return;
    }
    const t0 = performance.now();
    const poll = () => {
      if (cancelled) {
        gl.deleteSync(sync);
        return;
      }
      const status = gl.clientWaitSync(sync, 0, 0);
      if (
        status === gl.ALREADY_SIGNALED ||
        status === gl.CONDITION_SATISFIED ||
        performance.now() - t0 > 80
      ) {
        gl.deleteSync(sync);
        cb();
      } else {
        timerId = window.setTimeout(poll, 4);
      }
    };
    timerId = window.setTimeout(poll, 4);
  };

  const scheduleNextFrame = (tick: () => void, isSoftwareGl: boolean) => {
    if (cancelled) return;
    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      rafId = requestAnimationFrame(tick);
    }
  };

  const cancel = () => {
    cancelled = true;
    if (timerId !== null) clearTimeout(timerId);
    if (rafId !== null) cancelAnimationFrame(rafId);
  };

  return { scheduleNextFrame, cancel };
}

// 3. Procedural Canvas Textures (Zero external 404 dependencies)
export function createSandstoneTexture(
  renderer: THREE.WebGLRenderer,
  variant: 'light' | 'dark' | 'gold' | 'portal' = 'light'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const palettes = {
    light: { bg: '#d9aa63', brick: '#c28e46', line: '#704819', highlight: '#f3d299', glyph: '#5c3812' },
    dark: { bg: '#b8823c', brick: '#9c6b2b', line: '#4f300e', highlight: '#dfb16d', glyph: '#3d2208' },
    gold: { bg: '#f59e0b', brick: '#d97706', line: '#78350f', highlight: '#fef08a', glyph: '#451a03' },
    portal: { bg: '#6b21a8', brick: '#581c87', line: '#c084fc', highlight: '#e9d5ff', glyph: '#f3e8ff' }
  };
  const pal = palettes[variant];

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle sandstone grain
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 256;
    const y = (i * 139) % 256;
    ctx.fillStyle = i % 2 === 0 ? pal.highlight : pal.brick;
    ctx.globalAlpha = 0.14;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.globalAlpha = 1;

  // Beveled outer stone border
  ctx.strokeStyle = pal.highlight;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 244);

  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);

  // Inner ritual frame
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 212, 212);

  // Masonry joints
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 128);
  ctx.moveTo(64, 128);
  ctx.lineTo(64, 256);
  ctx.moveTo(192, 128);
  ctx.lineTo(192, 256);
  ctx.strokeStyle = pal.line;
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Subtle corner ornaments
  ctx.fillStyle = pal.glyph;
  ctx.globalAlpha = 0.45;
  ctx.font = 'bold 24px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❖', 42, 42);
  ctx.fillText('❖', 214, 42);
  ctx.fillText('❖', 42, 214);
  ctx.fillText('❖', 214, 214);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

// 4. Composite 3D Models (Every entity is a multi-part THREE.Group with bottom-center ground pivot y=0)

export function createHero3DModel(options: {
  isMainHero?: boolean;
  isAdmin?: boolean;
  isPremium?: boolean;
  isOnline?: boolean;
}): THREE.Group {
  const group = new THREE.Group();

  const primaryArmorColor = options.isMainHero
    ? 0xfbbf24 // Pharaoh Gold
    : options.isAdmin
    ? 0xef4444 // Crimson Admin
    : options.isOnline
    ? 0x38bdf8 // Azure Online Rival
    : 0x94a3b8; // Slate Offline Rival

  const capeColor = options.isMainHero ? 0xdc2626 : options.isOnline ? 0x991b1b : 0x475569;

  const goldMat = new THREE.MeshStandardMaterial({
    color: primaryArmorColor,
    metalness: 0.78,
    roughness: 0.24
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b66,
    metalness: 0.08,
    roughness: 0.65
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    metalness: 0.1,
    roughness: 0.75
  });
  const capeMat = new THREE.MeshStandardMaterial({
    color: capeColor,
    metalness: 0.15,
    roughness: 0.6,
    side: THREE.DoubleSide
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: options.isMainHero ? 0x67e8f9 : 0xe2e8f0,
    emissive: options.isMainHero ? 0x0891b2 : 0x000000,
    emissiveIntensity: options.isMainHero ? 0.45 : 0,
    metalness: 0.9,
    roughness: 0.15
  });

  // 1. Glowing ground aura ring (y = 0.02)
  const auraGeo = new THREE.RingGeometry(0.28, 0.38, 24);
  auraGeo.rotateX(-Math.PI / 2);
  const auraMat = new THREE.MeshBasicMaterial({
    color: options.isMainHero ? 0x10b981 : options.isOnline ? 0xef4444 : 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85
  });
  const auraRing = new THREE.Mesh(auraGeo, auraMat);
  auraRing.position.y = 0.02;
  auraRing.name = 'auraRing';
  group.add(auraRing);

  // 2. Left & Right Armored Boots + Legs (y = 0.0 .. 0.34)
  const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.32, 10);
  const leftLeg = new THREE.Mesh(legGeo, goldMat);
  leftLeg.position.set(-0.09, 0.16, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, goldMat);
  rightLeg.position.set(0.09, 0.16, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // 3. Egyptian Royal Kilt (Shendyt) (y = 0.28 .. 0.44)
  const kiltGeo = new THREE.CylinderGeometry(0.15, 0.19, 0.18, 12);
  const kilt = new THREE.Mesh(kiltGeo, clothMat);
  kilt.position.set(0, 0.34, 0);
  kilt.castShadow = true;
  group.add(kilt);

  // Golden belt buckle
  const beltGeo = new THREE.TorusGeometry(0.15, 0.025, 8, 16);
  beltGeo.rotateX(Math.PI / 2);
  const belt = new THREE.Mesh(beltGeo, goldMat);
  belt.position.set(0, 0.42, 0);
  group.add(belt);

  // 4. Muscular Armored Torso (y = 0.42 .. 0.76)
  const torsoGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.34, 12);
  const torso = new THREE.Mesh(torsoGeo, skinMat);
  torso.position.set(0, 0.58, 0);
  torso.castShadow = true;
  group.add(torso);

  // Golden Pharaoh Usekh Collar / Chestplate
  const collarGeo = new THREE.CylinderGeometry(0.21, 0.18, 0.12, 12);
  const collar = new THREE.Mesh(collarGeo, goldMat);
  collar.position.set(0, 0.7, 0);
  collar.castShadow = true;
  group.add(collar);

  // 5. Royal Cape on Back
  const capeGeo = new THREE.PlaneGeometry(0.34, 0.52);
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(0, 0.46, -0.16);
  cape.rotation.x = 0.15;
  group.add(cape);

  // 6. Head + Pharaoh Nemes Headdress (y = 0.78 .. 1.05)
  const headGeo = new THREE.SphereGeometry(0.13, 14, 14);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.87, 0);
  head.castShadow = true;
  group.add(head);

  // Nemes Crown / Helmet
  const crownGeo = new THREE.ConeGeometry(0.17, 0.24, 6);
  const crown = new THREE.Mesh(crownGeo, goldMat);
  crown.position.set(0, 0.98, -0.01);
  crown.castShadow = true;
  group.add(crown);

  // Glowing Eyes
  const eyeGeo = new THREE.SphereGeometry(0.022, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({
    color: options.isMainHero ? 0x38bdf8 : 0xfbbf24
  });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.045, 0.88, 0.115);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.045, 0.88, 0.115);
  group.add(leftEye, rightEye);

  // 7. Right Arm + Khopesh Sword Pivot (for attack swing animation)
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.22, 0.66, 0.04);
  weaponPivot.name = 'weaponPivot';

  const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.24, 8);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.set(0, -0.08, 0.06);
  rightArm.rotation.x = Math.PI / 3;
  weaponPivot.add(rightArm);

  // Sword Hilt
  const hiltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8);
  const hilt = new THREE.Mesh(hiltGeo, goldMat);
  hilt.position.set(0, -0.12, 0.16);
  hilt.rotation.x = Math.PI / 6;
  weaponPivot.add(hilt);

  // Curved Khopesh Blade
  const bladeGeo = new THREE.BoxGeometry(0.035, 0.42, 0.08);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0, 0.12, 0.22);
  blade.rotation.x = Math.PI / 8;
  blade.castShadow = true;
  weaponPivot.add(blade);

  group.add(weaponPivot);

  // 8. Left Arm + Golden Egyptian Shield
  const shieldPivot = new THREE.Group();
  shieldPivot.position.set(-0.22, 0.62, 0.06);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(0, -0.06, 0.04);
  leftArm.rotation.x = Math.PI / 4;
  shieldPivot.add(leftArm);

  const shieldGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.04, 6);
  shieldGeo.rotateX(Math.PI / 2);
  const shield = new THREE.Mesh(shieldGeo, goldMat);
  shield.position.set(-0.04, -0.04, 0.12);
  shield.castShadow = true;
  shieldPivot.add(shield);

  group.add(shieldPivot);

  return group;
}

export function createMonster3DModel(options: {
  isBoss?: boolean;
  mobLvl?: number;
  icon?: string;
}): THREE.Group {
  const group = new THREE.Group();
  const isBoss = Boolean(options.isBoss);
  const scale = isBoss ? 1.25 : 0.95;

  const bodyColor = isBoss
    ? 0x991b1b // Crimson Boss
    : (options.mobLvl || 1) >= 10
    ? 0x581c87 // Shadow Anubis
    : (options.mobLvl || 1) >= 5
    ? 0x78350f // Ancient Mummy Bronze
    : 0xb45309; // Desert Scorpion Amber

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: isBoss ? 0.55 : 0.35,
    roughness: 0.4
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: isBoss ? 0xfacc15 : 0xd97706,
    metalness: 0.85,
    roughness: 0.2
  });

  const glowMat = new THREE.MeshBasicMaterial({
    color: isBoss ? 0xff0044 : 0xfbbf24
  });

  // 1. Menacing ground ring
  const ringGeo = new THREE.RingGeometry(0.24 * scale, 0.33 * scale, 20);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: isBoss ? 0xef4444 : 0xf97316,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: isBoss ? 0.85 : 0.55
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.02;
  group.add(ring);

  // 2. Monster Lower Pedestal / Legs
  const baseGeo = new THREE.CylinderGeometry(0.18 * scale, 0.22 * scale, 0.26 * scale, 8);
  const base = new THREE.Mesh(baseGeo, bodyMat);
  base.position.y = 0.13 * scale;
  base.castShadow = true;
  group.add(base);

  // 3. Armored Carapace / Torso
  const torsoGeo = new THREE.DodecahedronGeometry(0.22 * scale, 0);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.y = 0.42 * scale;
  torso.castShadow = true;
  group.add(torso);

  // 4. Shoulder Spikes / Jackal Ears
  const spikeGeo = new THREE.ConeGeometry(0.07 * scale, 0.24 * scale, 5);
  const leftSpike = new THREE.Mesh(spikeGeo, goldMat);
  leftSpike.position.set(-0.18 * scale, 0.58 * scale, 0);
  leftSpike.rotation.z = 0.35;
  const rightSpike = new THREE.Mesh(spikeGeo, goldMat);
  rightSpike.position.set(0.18 * scale, 0.58 * scale, 0);
  rightSpike.rotation.z = -0.35;
  group.add(leftSpike, rightSpike);

  // 5. Monster Head + Glowing Eyes
  const headGeo = new THREE.OctahedronGeometry(0.15 * scale, 1);
  const head = new THREE.Mesh(headGeo, isBoss ? goldMat : bodyMat);
  head.position.set(0, 0.68 * scale, 0.03 * scale);
  head.castShadow = true;
  group.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.03 * scale, 6, 6);
  const leftEye = new THREE.Mesh(eyeGeo, glowMat);
  leftEye.position.set(-0.055 * scale, 0.7 * scale, 0.13 * scale);
  const rightEye = new THREE.Mesh(eyeGeo, glowMat);
  rightEye.position.set(0.055 * scale, 0.7 * scale, 0.13 * scale);
  group.add(leftEye, rightEye);

  // 6. Claws / Twin Blades
  const clawGeo = new THREE.ConeGeometry(0.05 * scale, 0.28 * scale, 4);
  const leftClaw = new THREE.Mesh(clawGeo, goldMat);
  leftClaw.position.set(-0.24 * scale, 0.42 * scale, 0.15 * scale);
  leftClaw.rotation.x = Math.PI / 2.5;
  const rightClaw = new THREE.Mesh(clawGeo, goldMat);
  rightClaw.position.set(0.24 * scale, 0.42 * scale, 0.15 * scale);
  rightClaw.rotation.x = Math.PI / 2.5;
  group.add(leftClaw, rightClaw);

  // 7. Boss Crown if isBoss
  if (isBoss) {
    const crownGeo = new THREE.TorusGeometry(0.12 * scale, 0.025 * scale, 8, 16);
    crownGeo.rotateX(Math.PI / 2);
    const crown = new THREE.Mesh(crownGeo, goldMat);
    crown.position.set(0, 0.88 * scale, 0);
    group.add(crown);
  }

  return group;
}

export function createPortal3DModel(): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x4c1d95,
    metalness: 0.4,
    roughness: 0.5
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xd8b4fe,
    emissive: 0x9333ea,
    emissiveIntensity: 0.85,
    metalness: 0.8,
    roughness: 0.15
  });

  // Left & Right Obelisk Pillars
  const pillarGeo = new THREE.BoxGeometry(0.1, 0.7, 0.1);
  const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
  leftPillar.position.set(-0.26, 0.35, 0);
  const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
  rightPillar.position.set(0.26, 0.35, 0);
  group.add(leftPillar, rightPillar);

  // Top Arch Lintel
  const topGeo = new THREE.BoxGeometry(0.66, 0.1, 0.14);
  const topArch = new THREE.Mesh(topGeo, stoneMat);
  topArch.position.set(0, 0.72, 0);
  group.add(topArch);

  // Spinning Vortex Ring
  const vortexGeo = new THREE.TorusGeometry(0.2, 0.035, 10, 24);
  const vortex = new THREE.Mesh(vortexGeo, crystalMat);
  vortex.position.set(0, 0.38, 0);
  vortex.name = 'portalVortex';
  group.add(vortex);

  // Inner Floating Octahedron Core
  const coreGeo = new THREE.OctahedronGeometry(0.11, 0);
  const core = new THREE.Mesh(coreGeo, crystalMat);
  core.position.set(0, 0.38, 0);
  core.name = 'portalCore';
  group.add(core);

  return group;
}

export function createSack3DModel(isCrystal: boolean): THREE.Group {
  const group = new THREE.Group();

  if (isCrystal) {
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.7,
      metalness: 0.85,
      roughness: 0.1
    });
    const mainShard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), crystalMat);
    mainShard.position.set(0, 0.22, 0);
    const sideShard1 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 5), crystalMat);
    sideShard1.position.set(-0.12, 0.15, 0.05);
    sideShard1.rotation.z = 0.35;
    const sideShard2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), crystalMat);
    sideShard2.position.set(0.12, 0.14, -0.04);
    sideShard2.rotation.z = -0.35;
    group.add(mainShard, sideShard1, sideShard2);
  } else {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.2
    });
    const chestWoodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      metalness: 0.2,
      roughness: 0.65
    });
    // Treasure chest body
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.24), chestWoodMat);
    base.position.set(0, 0.1, 0);
    // Golden lid
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 10), goldMat);
    lid.rotation.z = Math.PI / 2;
    lid.position.set(0, 0.2, 0);
    // Lock plate
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.26), goldMat);
    lock.position.set(0, 0.16, 0);
    group.add(base, lid, lock);
  }

  return group;
}

export function createNpcSentinel3DModel(isOwn: boolean): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: isOwn ? 0x10b981 : 0x14b8a6,
    metalness: 0.8,
    roughness: 0.22
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.85,
    roughness: 0.2
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: isOwn ? 0x6ee7b7 : 0x5eead4
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.22, 8), goldMat);
  base.position.y = 0.11;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.22), metalMat);
  body.position.y = 0.38;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), coreMat);
  core.position.set(0, 0.38, 0.1);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), goldMat);
  head.position.y = 0.65;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.2), coreMat);
  visor.position.set(0, 0.66, 0.01);

  group.add(base, body, core, head, visor);
  return group;
}

// 5. High-Definition 3D Entity Token Medallions with Character Avatars & Monster Art Preservation
const tokenTextureCache = new Map<string, THREE.CanvasTexture>();

export function getEntityTokenTexture(
  iconOrAvatar: string,
  kind: 'hero' | 'mob' | 'otherPlayer' | 'npc',
  isBoss = false
): THREE.CanvasTexture {
  const cacheKey = `${kind}_${isBoss ? 'boss_' : ''}${iconOrAvatar}`;
  if (tokenTextureCache.has(cacheKey)) {
    return tokenTextureCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  tokenTextureCache.set(cacheKey, texture);

  const drawTokenCanvas = (imgElement?: HTMLImageElement | ImageBitmap) => {
    ctx.clearRect(0, 0, 256, 256);

    // Ornate Circular Golden Medallion Background
    const centerX = 128;
    const centerY = 128;
    const radius = 118;

    // Outer Glow / Rim Gradient
    const rimGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.75, centerX, centerY, radius);
    if (kind === 'hero') {
      rimGrad.addColorStop(0, '#042f2e');
      rimGrad.addColorStop(0.7, '#0f766e');
      rimGrad.addColorStop(1, '#10b981');
    } else if (kind === 'mob') {
      if (isBoss) {
        rimGrad.addColorStop(0, '#450a0a');
        rimGrad.addColorStop(0.7, '#991b1b');
        rimGrad.addColorStop(1, '#ef4444');
      } else {
        rimGrad.addColorStop(0, '#291102');
        rimGrad.addColorStop(0.7, '#78350f');
        rimGrad.addColorStop(1, '#f59e0b');
      }
    } else if (kind === 'otherPlayer') {
      rimGrad.addColorStop(0, '#082f49');
      rimGrad.addColorStop(0.7, '#0284c7');
      rimGrad.addColorStop(1, '#38bdf8');
    } else {
      rimGrad.addColorStop(0, '#064e3b');
      rimGrad.addColorStop(0.7, '#059669');
      rimGrad.addColorStop(1, '#34d399');
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Dark Inner Portrait Area
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 10, 0, Math.PI * 2);
    ctx.fillStyle = kind === 'hero' ? '#091e1d' : kind === 'mob' ? (isBoss ? '#200707' : '#1a0e05') : '#081726';
    ctx.fill();
    ctx.clip();

    // Inner subtle radial spotlight
    const spotGrad = ctx.createRadialGradient(centerX, centerY - 15, 10, centerX, centerY, radius - 10);
    spotGrad.addColorStop(0, kind === 'hero' ? 'rgba(45,212,191,0.35)' : isBoss ? 'rgba(239,68,68,0.4)' : 'rgba(251,191,36,0.3)');
    spotGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, 256, 256);

    // Draw Image Sprite OR Emoji / Text
    if (imgElement) {
      try {
        const iw = imgElement.width || 256;
        const ih = imgElement.height || 256;
        const scale = Math.min((radius * 1.7) / iw, (radius * 1.7) / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = centerX - dw / 2;
        const dy = centerY - dh / 2;
        ctx.drawImage(imgElement, dx, dy, dw, dh);
      } catch {
        // Fallback if drawImage fails
        drawFallbackIcon();
      }
    } else {
      drawFallbackIcon();
    }
    ctx.restore();

    // Golden Hieroglyphic Bezel Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.lineWidth = 9;
    ctx.strokeStyle = isBoss ? '#facc15' : '#eab308';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 8, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    // Four Cardinal Gold Ornaments
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('❖', centerX, centerY - radius + 5);
    ctx.fillText('❖', centerX, centerY + radius - 5);
    ctx.fillText('❖', centerX - radius + 5, centerY);
    ctx.fillText('❖', centerX + radius - 5, centerY);
    ctx.restore();

    texture.needsUpdate = true;
  };

  const drawFallbackIcon = () => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cleanStr = String(iconOrAvatar || '').trim();
    if (cleanStr.length <= 4) {
      // Emoji
      ctx.font = '112px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(cleanStr || (kind === 'hero' ? '🤴' : kind === 'mob' ? '🧟' : '👤'), 128, 138);
    } else {
      // First letters
      ctx.font = 'bold 72px sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(cleanStr.slice(0, 2).toUpperCase(), 128, 132);
    }
  };

  // Check if iconOrAvatar is a valid URL / image asset
  const isImageUrl =
    typeof iconOrAvatar === 'string' &&
    (iconOrAvatar.startsWith('http://') ||
      iconOrAvatar.startsWith('https://') ||
      iconOrAvatar.startsWith('data:image/') ||
      iconOrAvatar.startsWith('/') ||
      iconOrAvatar.startsWith('./') ||
      iconOrAvatar.includes('.svg') ||
      iconOrAvatar.includes('.png') ||
      iconOrAvatar.includes('.webp'));

  drawTokenCanvas(); // Initial render immediately

  if (isImageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      drawTokenCanvas(img);
    };
    img.onerror = () => {
      drawTokenCanvas();
    };
    img.src = iconOrAvatar;
  }

  return texture;
}

export function createEntity3DToken(options: {
  iconOrAvatar: string;
  kind: 'hero' | 'mob' | 'otherPlayer' | 'npc';
  name?: string;
  level?: number;
  hp?: number;
  maxHp?: number;
  isBoss?: boolean;
  isOnline?: boolean;
  isPremium?: boolean;
}): THREE.Group {
  const group = new THREE.Group();
  const isBoss = Boolean(options.isBoss);
  const isHero = options.kind === 'hero';
  const scale = isBoss ? 1.3 : isHero ? 1.12 : 0.96;

  // 1. Ground Glowing Aura Ring at y = 0.02
  const auraGeo = new THREE.RingGeometry(0.32 * scale, 0.44 * scale, 24);
  auraGeo.rotateX(-Math.PI / 2);
  const auraColor = isHero
    ? 0x10b981
    : isBoss
    ? 0xef4444
    : options.kind === 'mob'
    ? 0xf97316
    : options.isOnline
    ? 0x38bdf8
    : 0x94a3b8;

  const auraMat = new THREE.MeshBasicMaterial({
    color: auraColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: isHero ? 0.95 : isBoss ? 0.9 : 0.7
  });
  const auraRing = new THREE.Mesh(auraGeo, auraMat);
  auraRing.position.y = 0.02;
  auraRing.name = 'auraRing';
  group.add(auraRing);

  // 2. 3D Beveled Stone & Gold Pedestal Stand at y = 0.0 .. 0.16
  const pedGoldMat = new THREE.MeshStandardMaterial({
    color: isBoss ? 0xfacc15 : isHero ? 0xfbbf24 : 0xd97706,
    metalness: 0.85,
    roughness: 0.22
  });
  const pedBaseGeo = new THREE.CylinderGeometry(0.34 * scale, 0.4 * scale, 0.14 * scale, 20);
  const pedBase = new THREE.Mesh(pedBaseGeo, pedGoldMat);
  pedBase.position.y = 0.07 * scale;
  pedBase.castShadow = true;
  pedBase.receiveShadow = true;
  group.add(pedBase);

  // Decorative Torus rim on pedestal
  const pedRimGeo = new THREE.TorusGeometry(0.35 * scale, 0.025 * scale, 8, 20);
  pedRimGeo.rotateX(Math.PI / 2);
  const pedRim = new THREE.Mesh(pedRimGeo, pedGoldMat);
  pedRim.position.y = 0.14 * scale;
  group.add(pedRim);

  // 3. Upright 3D Medallion Token Face with Texture
  const texture = getEntityTokenTexture(options.iconOrAvatar, options.kind, isBoss);
  const tokenMat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    roughness: 0.35,
    metalness: 0.45,
    side: THREE.DoubleSide
  });

  // Thin cylindrical coin for 3D depth
  const coinGeo = new THREE.CylinderGeometry(0.36 * scale, 0.36 * scale, 0.04 * scale, 24);
  coinGeo.rotateX(Math.PI / 2); // face front
  const coinMesh = new THREE.Mesh(coinGeo, tokenMat);
  coinMesh.position.y = 0.5 * scale;
  coinMesh.castShadow = true;
  coinMesh.name = 'tokenFace';
  group.add(coinMesh);

  // Golden Outer Ring for Coin
  const coinRimGeo = new THREE.TorusGeometry(0.36 * scale, 0.028 * scale, 8, 24);
  const coinRim = new THREE.Mesh(coinRimGeo, pedGoldMat);
  coinRim.position.y = 0.5 * scale;
  group.add(coinRim);

  // 4. Boss Crown if isBoss
  if (isBoss) {
    const crownGeo = new THREE.ConeGeometry(0.18 * scale, 0.22 * scale, 5);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      metalness: 0.9,
      roughness: 0.15
    });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(0, 0.96 * scale, 0);
    crown.rotation.x = Math.PI;
    group.add(crown);
  }

  // 5. Floating 3D Mini Health Bar at y = 0.92 * scale
  if (typeof options.hp === 'number' && typeof options.maxHp === 'number' && options.maxHp > 0) {
    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.y = (isBoss ? 1.08 : 0.96) * scale;
    hpBarGroup.name = 'hpBar';

    const barW = 0.62 * scale;
    const barH = 0.07 * scale;
    const hpPct = Math.max(0, Math.min(1, options.hp / options.maxHp));

    // Background dark bar
    const bgGeo = new THREE.PlaneGeometry(barW, barH);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    hpBarGroup.add(bgMesh);

    // Foreground green/red bar
    const fgW = Math.max(0.01, barW * hpPct);
    const fgGeo = new THREE.PlaneGeometry(fgW, barH * 0.78);
    const fgColor = hpPct > 0.4 ? (isHero ? 0x10b981 : 0x22c55e) : hpPct > 0.2 ? 0xf59e0b : 0xef4444;
    const fgMat = new THREE.MeshBasicMaterial({ color: fgColor, side: THREE.DoubleSide });
    const fgMesh = new THREE.Mesh(fgGeo, fgMat);
    fgMesh.position.set(-barW / 2 + fgW / 2, 0, 0.005);
    hpBarGroup.add(fgMesh);

    group.add(hpBarGroup);
  }

  return group;
}

/**
 * 6. Full-Body 3D Character Standee for the Oasis Courtyard (Main Screen)
 * Renders the character in full standing height without a circular medallion ("без кружочка, в рост, не вверх ногами")
 */
export function createFullBodyHero3DStandee(options: {
  iconOrAvatar: string;
  name?: string;
  level?: number;
  hp?: number;
  maxHp?: number;
  isPremium?: boolean;
}): THREE.Group {
  const group = new THREE.Group();
  const scale = 1.35;

  // 1. Soft Rectangular / Elliptical Shadow Ground Decal (No circular coin or medallion)
  const shadowGeo = new THREE.PlaneGeometry(0.75 * scale, 0.35 * scale);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 64;
  const sctx = shadowCanvas.getContext('2d')!;
  const sgrad = sctx.createRadialGradient(64, 32, 2, 64, 32, 30);
  sgrad.addColorStop(0, 'rgba(0,0,0,0.7)');
  sgrad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  sgrad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = sgrad;
  sctx.beginPath();
  sctx.ellipse(64, 32, 60, 28, 0, 0, Math.PI * 2);
  sctx.fill();
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.8
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02;
  group.add(shadowMesh);

  // 2. Upright Full-Body Texture (Transparent background, NO circle, upright and not upside down)
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768; // 2:3 vertical aspect ratio for full-body height
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const renderCanvas = (img?: HTMLImageElement | ImageBitmap) => {
    ctx.clearRect(0, 0, 512, 768);

    if (img) {
      // Draw image in full height, centered and upright
      const imgAspect = img.width / img.height;
      const targetAspect = 512 / 768;
      let drawW = 512;
      let drawH = 768;
      let drawX = 0;
      let drawY = 0;

      if (imgAspect > targetAspect) {
        drawW = 512;
        drawH = 512 / imgAspect;
        drawX = 0;
        drawY = 768 - drawH; // align to feet
      } else {
        drawH = 768;
        drawW = 768 * imgAspect;
        drawX = (512 - drawW) / 2;
        drawY = 0;
      }

      // Soft ambient ground contact shadow under feet
      ctx.save();
      const shadowGrad = ctx.createRadialGradient(256, 740, 10, 256, 740, 160);
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0.65)');
      shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(256, 740, 150, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw character image upright
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else {
      // Emoji or text fallback in full height
      const cleanStr = String(options.iconOrAvatar || '🧙‍♂️').trim();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (cleanStr.length <= 4) {
        ctx.font = '280px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillText(cleanStr || '🧙‍♂️', 256, 384);
      } else {
        ctx.font = 'bold 160px sans-serif';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(cleanStr.slice(0, 2).toUpperCase(), 256, 384);
      }
    }
    texture.needsUpdate = true;
  };

  renderCanvas();

  const isImageUrl =
    typeof options.iconOrAvatar === 'string' &&
    (options.iconOrAvatar.startsWith('http://') ||
      options.iconOrAvatar.startsWith('https://') ||
      options.iconOrAvatar.startsWith('data:image/') ||
      options.iconOrAvatar.startsWith('/') ||
      options.iconOrAvatar.startsWith('./') ||
      options.iconOrAvatar.includes('.svg') ||
      options.iconOrAvatar.includes('.png') ||
      options.iconOrAvatar.includes('.webp') ||
      options.iconOrAvatar.includes('.jpg') ||
      options.iconOrAvatar.includes('.jpeg'));

  if (isImageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => renderCanvas(img);
    img.onerror = () => renderCanvas();
    img.src = options.iconOrAvatar;
  }

  // Vertical cutout plane for the character in full height (upright)
  const planeGeo = new THREE.PlaneGeometry(0.88 * scale, 1.32 * scale);
  const planeMat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    roughness: 0.35,
    metalness: 0.15,
    side: THREE.DoubleSide
  });
  const planeMesh = new THREE.Mesh(planeGeo, planeMat);
  planeMesh.position.y = 0.66 * scale; // centered so feet touch ground at y=0
  planeMesh.castShadow = true;
  group.add(planeMesh);

  // 3. Floating 3D Nameplate & Title above head
  const labelGroup = new THREE.Group();
  labelGroup.position.y = 1.42 * scale;

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const lctx = labelCanvas.getContext('2d')!;
  lctx.clearRect(0, 0, 256, 64);
  lctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  lctx.beginPath();
  lctx.roundRect(8, 8, 240, 48, 12);
  lctx.fill();
  lctx.strokeStyle = '#f59e0b';
  lctx.lineWidth = 3;
  lctx.stroke();

  lctx.fillStyle = '#fde68a';
  lctx.font = 'bold 24px sans-serif';
  lctx.textAlign = 'center';
  lctx.textBaseline = 'middle';
  const displayNick = options.name ? `${options.name} (${options.level || 1} ур.)` : `Герой (${options.level || 1} ур.)`;
  lctx.fillText(displayNick.slice(0, 18), 128, 32);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelMat = new THREE.MeshBasicMaterial({
    map: labelTex,
    transparent: true,
    side: THREE.DoubleSide
  });
  const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.85 * scale, 0.22 * scale), labelMat);
  labelGroup.add(labelPlane);
  group.add(labelGroup);

  return group;
}

export function disposeSceneGraph(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          disposeMaterialTextures(m);
          m.dispose();
        });
      } else {
        disposeMaterialTextures(mesh.material);
        mesh.material.dispose();
      }
    }
  });
}

function disposeMaterialTextures(mat: THREE.Material) {
  const anyMat = mat as any;
  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap'].forEach((k) => {
    if (anyMat[k] && typeof anyMat[k].dispose === 'function') {
      anyMat[k].dispose();
    }
  });
}
