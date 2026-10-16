import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { MachineComponent, SuctionSystemConfig, MaterialFeedConfig, ClearanceItem, TensionSegment, FabricRoutingConfig } from '../types/machine';
import { getLinearVelocity, formatSpeedDisplay, rpmToHz } from '../utils/physicsEngine';
import { buildContinuousFabricPath, createNaturalRibbonGeometry, PathSamplePoint } from '../utils/fabricPath';
import { Eye, EyeOff, RotateCcw, Box, Compass, Layers, Target, Sparkles, Sliders, Lock, Wind, ChevronDown, Check } from 'lucide-react';

// Tạo texture vải dệt sợi đan xen thực tế
function createFabricCanvasTexture(clothColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = clothColor || '#2563eb';
  ctx.fillRect(0, 0, 128, 128);

  // Sợi dệt dọc & ngang nổi
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < 128; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  for (let y = 0; y < 128; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 10);
  return texture;
}

// Tạo texture bề mặt dây quấn đồ kim răng cưa kim loại cuộn xoắn ốc (Metallic Card Clothing Wire Winding)
function generateCardClothingCanvasTexture(comp: MachineComponent): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const isMain = comp.type === 'main_drum';
  const isWorker = comp.type === 'worker_roller';
  const isStripper = comp.type === 'stripper_roller';
  const isFeed = comp.type === 'feed_roller';

  // Nền kim loại phôi trục sáng bóng công nghiệp
  const grad = ctx.createLinearGradient(0, 0, 2048, 0);
  if (isMain) {
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.2, '#0ea5e9');
    grad.addColorStop(0.5, '#38bdf8');
    grad.addColorStop(0.8, '#0ea5e9');
    grad.addColorStop(1, '#0284c7');
  } else if (isWorker) {
    grad.addColorStop(0, '#b45309');
    grad.addColorStop(0.3, '#f59e0b');
    grad.addColorStop(0.5, '#fbbf24');
    grad.addColorStop(0.8, '#f59e0b');
    grad.addColorStop(1, '#b45309');
  } else if (isStripper) {
    grad.addColorStop(0, '#be185d');
    grad.addColorStop(0.3, '#f43f5e');
    grad.addColorStop(0.5, '#fb7185');
    grad.addColorStop(0.8, '#f43f5e');
    grad.addColorStop(1, '#be185d');
  } else {
    grad.addColorStop(0, '#334155');
    grad.addColorStop(0.5, '#64748b');
    grad.addColorStop(1, '#334155');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 1024);

  if (comp.surfaceType === 'wire_teeth' || isMain || isWorker || isStripper) {
    // DÂY QUẤN KIM LOẠI ĐỒ KIM CÀO/XÉ DÀY ĐẶC (Dense Metallic Card Clothing Helical Wire)
    // Hàng trăm nghìn mũi kim vi mô dập nổi san sát nhau phủ kín hoàn toàn bề mặt
    const wireWidth = isMain ? 4 : 5;
    const toothPitch = isMain ? 3 : 4;
    const angleTilt = isMain ? 1.0 : -0.8; // Góc nghiêng ăn sợi của răng kim

    for (let y = 0; y < 1024; y += wireWidth) {
      // 1. Khe rãnh giữa các vòng dây quấn kề sát nhau
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, y, 2048, 1.0);

      // 2. Chân dải thép dập (Wire Base Shoulder) ánh kim
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, y + 1.0, 2048, wireWidth - 1.5);

      // 3. Hàng răng cưa kim loại dập nổi san sát nhau liên tục dọc theo vòng quấn
      for (let x = 0; x < 2048; x += toothPitch) {
        // Hông răng vát thép tôi cứng
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(x, y + wireWidth - 0.8);
        ctx.lineTo(x + toothPitch * 0.45 + angleTilt, y + 0.8);
        ctx.lineTo(x + toothPitch * 0.9, y + wireWidth - 0.8);
        ctx.closePath();
        ctx.fill();

        // Mũi răng nhọn hoắt ánh kim cương (Diamond Apex Tip)
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + toothPitch * 0.45 + angleTilt - 0.5, y + 0.5, 1.5, 1.5);
      }
    }
  } else if (comp.surfaceType === 'fluted_steel' || isFeed) {
    // Trục ép khía rãnh dọc dày đặc (Densely Ground Longitudinal Fluting)
    const fluteW = 6;
    for (let x = 0; x < 2048; x += fluteW) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, 0, 1.5, 1024);

      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 1.5, 0, fluteW - 2, 1024);

      // Sóng gờ sáng bóng
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 1.5, 0, 1.2, 1024);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Tạo dải lưới 3D tấm vải có bề rộng thực tế (Ribbon Quad Strip)
function buildFabricRibbonGeometry(curve: THREE.CatmullRomCurve3, width: number, segments = 100): THREE.BufferGeometry {
  const points = curve.getPoints(segments);
  const vertexCount = (segments + 1) * 2;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  const halfW = width / 2;

  for (let i = 0; i <= segments; i++) {
    const p = points[i];
    const u = i / segments;

    // Đỉnh trái
    positions[i * 6 + 0] = p.x;
    positions[i * 6 + 1] = p.y;
    positions[i * 6 + 2] = -halfW;

    uvs[i * 4 + 0] = 0;
    uvs[i * 4 + 1] = u * 8;

    // Đỉnh phải
    positions[i * 6 + 3] = p.x;
    positions[i * 6 + 4] = p.y;
    positions[i * 6 + 5] = halfW;

    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = u * 8;

    if (i < segments) {
      const row1 = i * 2;
      const row2 = (i + 1) * 2;
      indices.push(row1, row1 + 1, row2);
      indices.push(row1 + 1, row2 + 1, row2);
      // Mặt đối xứng để nhìn được cả 2 phía
      indices.push(row1, row2, row1 + 1);
      indices.push(row1 + 1, row2, row2 + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createCottonFlakeGeometry(radius: number): THREE.BufferGeometry {
  // Mảnh xơ bông / vảy vải dệt xé rách dẹt phẳng tự nhiên (Flattened Wispy Shredded Flake)
  // Tạo dạng đa giác phẳng mỏng (2D planar sheet với 14 chóp xơ tưa rách so le, nhìn hai mặt)
  // Bề dày Y cực mỏng (~0.06 - 0.09 bán kính), hoàn toàn không còn hình khối cầu hay bọt khí.
  const numPoints = 14;
  const positions: number[] = [0, 0, 0]; // Đỉnh tâm
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    // Bán kính lồi lõm ziczac tạo mép xơ rách tự nhiên của vải may mặc xé tơi
    const jag = 0.52 + Math.sin(i * 3.7) * 0.28 + Math.cos(i * 2.1) * 0.2;
    const r = radius * Math.max(0.42, jag);
    // Kéo dẹt phẳng theo phương Y, mở rộng theo X và Z
    const px = Math.cos(angle) * r * 1.55;
    const py = Math.sin(angle * 3.0) * (radius * 0.07); // Gần như phẳng hoàn toàn
    const pz = Math.sin(angle) * r * 0.95;

    positions.push(px, py, pz);
    uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);

    const nextIdx = (i + 1) % numPoints;
    // Mặt thuận
    indices.push(0, i + 1, nextIdx + 1);
    // Mặt nghịch (đảm bảo nhìn thấy 2 mặt khi dập dờn trong gió)
    indices.push(0, nextIdx + 1, i + 1);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

interface CottonTuftItem {
  mesh: THREE.Mesh;
  pathMode: 'main_carding' | 'falling_under';
  progress: number;
  speed: number;
  dropGapIndex: number;
  dropProgress: number;
  zOffset: number;
  baseScale: number;
  stage: 'carding' | 'dropping' | 'under_sweeping' | 'entering_hood' | 'inside_duct';
  ductProgress: number;
}

interface FiberParticleItem {
  pathMode: 'main_carding' | 'falling_under';
  progress: number;
  speed: number;
  dropGapIndex: number;
  dropProgress: number;
  zOffset: number;
  stage: 'carding' | 'dropping' | 'under_sweeping' | 'entering_hood' | 'inside_duct';
  ductProgress: number;
}

function samplePolyline(pts: { x: number; y: number }[], t: number): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };
  const clampedT = Math.max(0, Math.min(1, t));
  const numSegs = pts.length - 1;
  const floatIdx = clampedT * numSegs;
  const seg = Math.min(numSegs - 1, Math.floor(floatIdx));
  const frac = floatIdx - seg;
  return {
    x: pts[seg].x + (pts[seg + 1].x - pts[seg].x) * frac,
    y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * frac,
  };
}

interface Viewport3DProps {
  components: MachineComponent[];
  selectedId: string | null;
  onSelectComponent: (id: string | null) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  suctionConfig: SuctionSystemConfig;
  onChangeSuctionConfig?: (updated: SuctionSystemConfig) => void;
  materialConfig: MaterialFeedConfig;
  fabricRouting: FabricRoutingConfig;
  clearances: ClearanceItem[];
  tensions: TensionSegment[];
  isRunning: boolean;
  simSpeedMultiplier: number;
  onOpenGapCalibrator?: (idA: string, idB: string) => void;
  onOpenCardClothingModal?: () => void;
  showHUD?: boolean;
  onToggleHUD?: () => void;
  speedUnitMode?: 'hz' | 'rpm';
  isLocked?: boolean;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  components,
  selectedId,
  onSelectComponent,
  onUpdatePosition,
  suctionConfig,
  onChangeSuctionConfig,
  materialConfig,
  fabricRouting,
  clearances,
  tensions,
  isRunning,
  simSpeedMultiplier,
  onOpenGapCalibrator,
  onOpenCardClothingModal,
  showHUD = true,
  onToggleHUD,
  speedUnitMode = 'hz',
  isLocked = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Orbit state
  const isOrbiting = useRef(false);
  const isPanning = useRef(false);
  const isDraggingObj = useRef(false);
  const mousePrev = useRef({ x: 0, y: 0 });
  const cameraTarget = useRef(new THREE.Vector3(500, 250, 0));
  const cameraSpherical = useRef({ radius: 1200, phi: Math.PI / 3, theta: Math.PI / 4 });

  // Meshes lookup
  const meshesMap = useRef<Map<string, THREE.Group>>(new Map());
  const fiberParticlesRef = useRef<THREE.Points | null>(null);
  const fiberParticlesDataRef = useRef<FiberParticleItem[]>([]);
  const cottonTuftsGroupRef = useRef<THREE.Group | null>(null);
  const cottonTuftsDataRef = useRef<CottonTuftItem[]>([]);
  const webRibbonMeshRef = useRef<THREE.Mesh | null>(null);
  const baseRibbonPositionsRef = useRef<Float32Array | null>(null);
  const clothTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const clearance3dGroupRef = useRef<THREE.Group | null>(null);
  const underSuctionStreamGroupRef = useRef<THREE.Group | null>(null);
  const fabricEndPointRef = useRef<THREE.Vector3 | null>(null);

  const [activeCameraView, setActiveCameraView] = useState<'iso' | 'front' | 'top'>('iso');
  const [showSuctionQuickControls, setShowSuctionQuickControls] = useState<boolean>(false);

  // Convert Spherical to Camera Position
  const updateCameraFromSpherical = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, phi, theta } = cameraSpherical.current;
    const target = cameraTarget.current;

    cameraRef.current.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(target);
  }, []);

  // Quick preset camera views
  const setCameraView = (view: 'iso' | 'front' | 'top') => {
    setActiveCameraView(view);
    if (view === 'iso') {
      cameraSpherical.current = { radius: 1300, phi: Math.PI / 3.2, theta: Math.PI / 4.2 };
    } else if (view === 'front') {
      // Nhìn thẳng mặt cắt trục (mặt phẳng 2D bên hông)
      cameraSpherical.current = { radius: 1400, phi: Math.PI / 2, theta: 0 };
    } else if (view === 'top') {
      // Nhìn từ trên xuống
      cameraSpherical.current = { radius: 1300, phi: 0.05, theta: 0 };
    }
    updateCameraFromSpherical();
  };

  const resetCamera = () => {
    cameraTarget.current.set(550, 260, 0);
    setCameraView('iso');
  };

  // Khởi tạo ThreeJS Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131d2e); // Bright, clean technical studio backdrop
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 5000);
    cameraRef.current = camera;
    updateCameraFromSpherical();

    // Renderer với ACESFilmicToneMapping và độ sáng tăng cường (Crisp Bright CAD/CAM Studio)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Grid sàn công nghiệp sáng rõ & Khung máy
    const grid = new THREE.GridHelper(2600, 52, 0x64748b, 0x334155);
    grid.position.set(600, -20, 0);
    scene.add(grid);

    // Hệ thống chiếu sáng Studio công nghiệp đa điểm siêu sáng (High-Luminance Multi-Point Rig):
    // 1. Ánh sáng bán cầu (HemisphereLight) chiếu rọi từ trần và sàn, triệt tiêu hoàn toàn các bóng đen tối tăm
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 1.35);
    scene.add(hemiLight);

    // 2. Ambient light sáng rực rỡ, nhìn rõ từng chi tiết kim máy
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    // 3. Đèn chính (Key Directional Light) chiếu rọi từ trên cao chếch trước
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(800, 1400, 800);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    // 4. Đèn phụ (Fill Directional Light) làm sáng hông sau và các kẽ hở giữa các trục
    const dirLight2 = new THREE.DirectionalLight(0xf1f5f9, 1.4);
    dirLight2.position.set(-600, 900, -600);
    scene.add(dirLight2);

    // 5. Đèn trực diện góc nhìn người dùng (Front Viewport Light) soi sáng rõ mặt trước tang trống và răng kim
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.3);
    frontLight.position.set(500, 450, 1100);
    scene.add(frontLight);

    // 6. Đèn viền ánh kim phản chiếu sắc cạnh (Metallic Rim Light)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    rimLight.position.set(500, -200, -900);
    scene.add(rimLight);

    // 1. Hệ thống khối bông xơ 3D thể tích tơi xốp (Volumetric 3D Fluffy Cotton Tufts)
    const cottonTuftsGroup = new THREE.Group();
    scene.add(cottonTuftsGroup);
    cottonTuftsGroupRef.current = cottonTuftsGroup;

    const tuftCount = 85;
    const tuftsData: CottonTuftItem[] = [];
    const tuftMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
      flatShading: false,
    });

    const tuftShape = suctionConfig.tuftShape || 'fluffy_flake';
    const fallingRatio = (suctionConfig.fallingFiberRatio ?? 35) / 100;

    for (let i = 0; i < tuftCount; i++) {
      const r = 10 + Math.random() * 8;
      const tuftGeo =
        tuftShape === 'round'
          ? new THREE.DodecahedronGeometry(r, 1)
          : createCottonFlakeGeometry(r);
      const tuftMesh = new THREE.Mesh(tuftGeo, tuftMat);
      tuftMesh.castShadow = true;
      const s = 0.85 + Math.random() * 0.7;
      if (tuftShape === 'round') {
        tuftMesh.scale.set(s, s * 0.9, s * 1.1);
      } else {
        tuftMesh.scale.set(s * 1.6, s * 0.12, s * 1.25);
      }
      cottonTuftsGroup.add(tuftMesh);

      const isFalling = Math.random() < fallingRatio;
      tuftsData.push({
        mesh: tuftMesh,
        pathMode: isFalling ? 'falling_under' : 'main_carding',
        progress: i / tuftCount,
        speed: 0.5 + Math.random() * 0.35,
        dropGapIndex: Math.floor(Math.random() * 7),
        dropProgress: 0,
        zOffset: (Math.random() - 0.5) * 450,
        baseScale: s,
        stage: 'carding',
        ductProgress: 0,
      });
    }
    cottonTuftsDataRef.current = tuftsData;

    // 2. Hệ thống chùm hạt sợi bông nhuyễn (Fine cotton fiber stream)
    const particleCount = 1000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const fiberData: FiberParticleItem[] = [];
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 450;
      positions[i * 3 + 1] = 260;
      positions[i * 3 + 2] = 0;
      const isFalling = Math.random() < 0.28;
      fiberData.push({
        pathMode: isFalling ? 'falling_under' : 'main_carding',
        progress: i / particleCount,
        speed: 0.55 + Math.random() * 0.35,
        dropGapIndex: Math.floor(Math.random() * 7),
        dropProgress: 0,
        zOffset: (Math.random() - 0.5) * 450,
        stage: 'carding',
        ductProgress: 0,
      });
    }
    fiberParticlesDataRef.current = fiberData;
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 5.5,
      transparent: true,
      opacity: 0.9,
    });
    const fiberParticles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(fiberParticles);
    fiberParticlesRef.current = fiberParticles;

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [updateCameraFromSpherical]);

  // Cập nhật các khối 3D Trục, Trống, Dao, Ống Hút khi components thay đổi
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Xóa các mesh cũ
    meshesMap.current.forEach((group) => {
      scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    });
    meshesMap.current.clear();

    // Tạo khối 3D cho từng chi tiết máy
    components.forEach((comp) => {
      const group = new THREE.Group();
      group.name = comp.id;
      group.position.set(comp.x, comp.y, 0);

      const isSel = comp.id === selectedId;
      const radius = comp.diameter / 2;
      const cylinderLength = comp.length * 0.7; // Tỉ lệ chiều dài hiển thị 3D

      if (comp.type === 'cutter_knife') {
        // Tìm feed roller bên trái và main drum bên phải
        const feedRollers = components.filter((c) => c.type === 'feed_roller' && c.x < comp.x);
        let closestFeed: MachineComponent | null = null;
        let minFeedDist = Infinity;
        for (const f of feedRollers) {
          const d = Math.hypot(comp.x - f.x, comp.y - f.y);
          if (d < minFeedDist) {
            minFeedDist = d;
            closestFeed = f;
          }
        }

        const drums = components.filter((c) => c.type === 'main_drum' && c.x > comp.x);
        let closestDrum: MachineComponent | null = null;
        let minDrumDist = Infinity;
        for (const d of drums) {
          const dDist = Math.hypot(comp.x - d.x, comp.y - d.y);
          if (dDist < minDrumDist) {
            minDrumDist = dDist;
            closestDrum = d;
          }
        }

        // Tọa độ mũi dao mỏng vươn dài tới sát trống lớn, giữ khe hở chính xác 2.0 mm
        let localTipX = 48;
        let localTipY = 6;
        if (closestDrum) {
          const drumR = closestDrum.diameter / 2 + 2.5; // Bề mặt đỉnh kim trống lớn
          const dx = comp.x - closestDrum.x;
          const dy = (comp.y + 6) - closestDrum.y;
          const ang = Math.atan2(dy, dx);
          const drumSurfaceX = closestDrum.x + drumR * Math.cos(ang);
          const drumSurfaceY = closestDrum.y + drumR * Math.sin(ang);
          // Mũi dao cách bề mặt răng kim trống lớn đúng 2.0 mm
          const knifeTipWorldX = drumSurfaceX - 2.0 * Math.cos(ang);
          const knifeTipWorldY = drumSurfaceY - 2.0 * Math.sin(ang);
          localTipX = knifeTipWorldX - comp.x;
          localTipY = knifeTipWorldY - comp.y;
        }

        // Gốc của tấm dao mỏng (nằm tại bệ kẹp)
        const localRootX = -12;
        const localRootY = 2;
        const bladeSpan = Math.max(20, Math.hypot(localTipX - localRootX, localTipY - localRootY));
        const bladeTilt = Math.atan2(localTipY - localRootY, localTipX - localRootX);
        const midX = (localRootX + localTipX) / 2;
        const midY = (localRootY + localTipY) / 2;

        // 1. TẤM LƯỠI DAO MỎNG NHÔ RA (THIN PROTRUDING BLADE STRIP - DÀY 2.5mm)
        // Dạng miếng mỏng nhô ra sắc bén, không bị thô, chạy dọc chiều dài máy
        const bladeGeo = new THREE.BoxGeometry(bladeSpan, 2.5, cylinderLength * 0.99);
        const bladeMat = new THREE.MeshStandardMaterial({
          color: isSel ? 0xf43f5e : 0xe2e8f0,
          metalness: 0.94,
          roughness: 0.16,
        });
        const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
        bladeMesh.position.set(midX, midY, 0);
        bladeMesh.rotation.z = bladeTilt;
        group.add(bladeMesh);

        // Mép mài vát hợp kim sáng bóng tại mũi dao (Razor Bevel Tip - cách trống đúng 2.0mm)
        const edgeGeo = new THREE.BoxGeometry(4.0, 1.4, cylinderLength * 0.99);
        const edgeMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.98,
          roughness: 0.06,
        });
        const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
        edgeMesh.position.set(localTipX, localTipY, 0);
        edgeMesh.rotation.z = bladeTilt;
        group.add(edgeMesh);

        // 2. KHỐI BỆ GÁ KẸP ĐẾ DAO GỌN GÀNG (SLIM TOOL HOLDER CLAMP)
        const mountGeo = new THREE.BoxGeometry(16, 12, cylinderLength * 1.01);
        const mountMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.8,
          roughness: 0.4,
        });
        const mountMesh = new THREE.Mesh(mountGeo, mountMat);
        mountMesh.position.set(-18, -3, 0);
        group.add(mountMesh);

        // Hàng bu-lông lục giác chìm giữ tấm dao mỏng
        const boltGeo = new THREE.CylinderGeometry(2.2, 2.2, 3, 6);
        const boltMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
        const numBolts = Math.max(4, Math.round(cylinderLength / 140));
        for (let b = 0; b < numBolts; b++) {
          const zOffset = -cylinderLength * 0.45 + (cylinderLength * 0.9 / (numBolts - 1)) * b;
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.rotation.x = Math.PI / 2;
          bolt.position.set(-16, 3.5, zOffset);
          group.add(bolt);
        }

        // 3. TẤM LÓT ĐÓN LIỆU MỎNG (THIN FEED GUIDE SHEET)
        // Nối mượt mà từ đáy feed roller tới sống của tấm dao mỏng
        let guideSpan = 38;
        let guideOffsetY = -4;
        if (closestFeed) {
          const feedR = closestFeed.diameter / 2;
          const feedExitX = closestFeed.x + feedR * 0.72;
          const feedExitY = closestFeed.y - feedR + 2;
          guideSpan = Math.max(25, Math.abs(comp.x - feedExitX));
          guideOffsetY = (feedExitY - comp.y) / 2;
        }

        const guideGeo = new THREE.BoxGeometry(guideSpan, 1.4, cylinderLength * 0.98);
        const guideMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          metalness: 0.85,
          roughness: 0.25,
        });
        const guideMesh = new THREE.Mesh(guideGeo, guideMat);
        guideMesh.position.set(-guideSpan / 2 - 12, guideOffsetY, 0);
        guideMesh.rotation.z = Math.PI / 20;
        group.add(guideMesh);
      } else if (comp.type === 'suction_hood') {
        // Miệng hút chân không công nghiệp (Industrial Aerodynamic Suction Hood & Duct):
        // 1. Phễu nón thu gom khí động học dạng loe rộng bao trọn chiều dài trống máy xé
        const hoodWidth = cylinderLength * 1.05;
        const hoodDepth = radius * 1.6;
        const hoodHeight = 140;

        const hoodMouthGeo = new THREE.BoxGeometry(hoodDepth, hoodHeight, hoodWidth);
        const hoodMat = new THREE.MeshStandardMaterial({
          color: isSel ? 0x34d399 : 0x059669,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          metalness: 0.5,
          roughness: 0.25,
        });
        const hoodMouthMesh = new THREE.Mesh(hoodMouthGeo, hoodMat);
        hoodMouthMesh.rotation.z = -Math.PI / 4;
        group.add(hoodMouthMesh);

        // Khung viền và vành nẹp miệng hút bằng thép
        const rimGeo = new THREE.BoxGeometry(hoodDepth + 12, 14, hoodWidth + 12);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.3 });
        const rimMesh = new THREE.Mesh(rimGeo, rimMat);
        rimMesh.position.set(-hoodDepth * 0.2, -hoodHeight * 0.35, 0);
        rimMesh.rotation.z = -Math.PI / 4;
        group.add(rimMesh);

        // 2. Cút nối chuyển tiếp thu nhỏ từ phễu loe sang ống tròn phi 280-320mm
        const transGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.85, 110, 28);
        const transMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
        const transMesh = new THREE.Mesh(transGeo, transMat);
        transMesh.position.set(40, 85, 0);
        transMesh.rotation.z = -Math.PI / 6;
        group.add(transMesh);

        // 3. Đường ống dẫn khí & xơ chính (Pneumatic Suction Transport Duct) nối lên trần sang cyclone / buồng lắng
        const pipeRadius = radius * 0.52;
        const pipeGeo = new THREE.CylinderGeometry(pipeRadius, pipeRadius, 360, 24);
        const pipeMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          metalness: 0.8,
          roughness: 0.3,
        });
        const pipeMesh = new THREE.Mesh(pipeGeo, pipeMat);
        pipeMesh.position.set(85, 230, 0);
        pipeMesh.rotation.z = -Math.PI / 10;
        group.add(pipeMesh);

        // Cửa kính mica quan sát luồng xơ bay bên trong ống hút (Inspection Window)
        const windowGeo = new THREE.CylinderGeometry(pipeRadius * 1.01, pipeRadius * 1.01, 80, 16, 1, true, 0, Math.PI);
        const windowMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.45,
          roughness: 0.1,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        const windowMesh = new THREE.Mesh(windowGeo, windowMat);
        windowMesh.position.set(85, 220, 0);
        windowMesh.rotation.z = -Math.PI / 10;
        windowMesh.rotation.y = Math.PI / 2;
        group.add(windowMesh);

        // Vành bích nối bu-lông (Flanged Joint Ring)
        const flangeGeo = new THREE.TorusGeometry(pipeRadius * 1.16, 5, 8, 24);
        const flangeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
        const flangeMesh = new THREE.Mesh(flangeGeo, flangeMat);
        flangeMesh.position.set(85, 270, 0);
        flangeMesh.rotation.x = Math.PI / 2;
        group.add(flangeMesh);
      } else {
        // Trục tròn / Trống xé hình trụ (Cylinder)
        // Tạo nhóm rotor quay tự do quanh tâm trục của chính nó
        const rotorGroup = new THREE.Group();
        rotorGroup.name = 'rotor';

        const radialSegments = comp.diameter > 300 ? 48 : 32;
        const cylGeo = new THREE.CylinderGeometry(radius, radius, cylinderLength, radialSegments);
        // Xoay geometry để trục đối xứng nằm theo phương Z, tâm nằm tại (0,0,0)
        cylGeo.rotateX(Math.PI / 2);

        // Chất liệu kim loại công nghiệp sáng bóng cho tang trống và trục
        let baseColor = 0x64748b;
        let metalness = 0.82;
        let roughness = 0.28;

        if (comp.type === 'main_drum') {
          baseColor = isSel ? 0x38bdf8 : 0x0ea5e9; // Xanh lam rực rỡ, sáng bóng của trống xé chính
          metalness = 0.8;
          roughness = 0.22;
        } else if (comp.type === 'worker_roller') {
          baseColor = isSel ? 0xfbbf24 : 0xf59e0b; // Vàng hổ phách trục chải
          metalness = 0.8;
          roughness = 0.25;
        } else if (comp.type === 'stripper_roller') {
          baseColor = isSel ? 0xf472b6 : 0xf43f5e; // Hồng cánh sen trục bóc
          metalness = 0.8;
          roughness = 0.25;
        } else if (comp.type === 'feed_roller') {
          baseColor = isSel ? 0xe2e8f0 : 0x94a3b8; // Thép sáng trục cấp liệu
          metalness = 0.88;
          roughness = 0.2;
        } else if (comp.type === 'condenser_drum') {
          baseColor = isSel ? 0xc4b5fd : 0x8b5cf6; // Trống ngưng kết
          metalness = 0.75;
          roughness = 0.3;
        }

        // Bề mặt dây quấn đồ kim răng cưa kim loại cuộn xoắn ốc (Metallic Card Clothing Wire Winding)
        const cardTexture = generateCardClothingCanvasTexture(comp);
        const cylMat = new THREE.MeshStandardMaterial({
          map: cardTexture,
          color: isSel ? 0xffffff : baseColor,
          metalness,
          roughness,
        });

        const cylMesh = new THREE.Mesh(cylGeo, cylMat);
        rotorGroup.add(cylMesh);

        // Hàng răng cưa / kim xé 3D thật (3D Metallic Card Clothing Teeth Array)
        // Chuẩn hóa theo thực tế công nghiệp dệt: DÂY KIM QUẤN XOẮN ỐC LIÊN TỤC QUANH TRỐNG
        // Tuyệt đối không còn các vòng thanh đen rời rạc. Hàng nghìn mũi kim thép tôi cứng san sát nhau
        // phân bổ đều đặn và so le quanh chu vi để xé mịn sợi vải.
        const isMain = comp.type === 'main_drum';
        const isWorker = comp.type === 'worker_roller';
        const isStripper = comp.type === 'stripper_roller';
        const isCardingOrDrum = comp.surfaceType === 'wire_teeth' || isMain || isWorker || isStripper;

        if (isCardingOrDrum) {
          // Mật độ hàng răng dày đặc phủ kín bề mặt theo thực tế máy chải xé (Densely Packed Card Clothing Needles)
          // 72 hàng dọc Z × 136 răng/vòng = ~9.800+ mũi kim trên trống lớn, đan cài so le khít nhau
          const rowsZ = isMain ? 72 : isWorker ? 48 : isStripper ? 40 : 36;
          const teethPerRow = isMain ? 136 : isWorker ? 64 : isStripper ? 56 : 48;
          const totalTeeth = rowsZ * teethPerRow;

          // Góc nghiêng ăn sợi (Front Rake Angle) theo chiều quay chuẩn
          const toothTilt = isMain
            ? (comp.rotationDir === 'CW' ? 0.35 : -0.35)
            : isWorker
            ? 0.25
            : -0.25;

          // Mũi răng kim thép thanh mảnh sắc nhọn, mũi kim cương 4 cạnh
          const toothHeight = Math.max(5.0, radius * (isMain ? 0.038 : 0.055));
          const toothBase = Math.max(0.85, radius * 0.0085);

          const toothGeo = new THREE.ConeGeometry(toothBase, toothHeight, 4);
          toothGeo.rotateZ(-Math.PI / 2);
          toothGeo.rotateZ(toothTilt);

          const toothMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            metalness: 0.98,
            roughness: 0.1,
          });

          // Sử dụng InstancedMesh để dựng 10.000+ răng kim trong 1 Draw Call duy nhất (60 FPS mượt mà)
          const instancedTeeth = new THREE.InstancedMesh(toothGeo, toothMat, totalTeeth);
          instancedTeeth.castShadow = true;

          const dummy = new THREE.Object3D();
          let toothIdx = 0;

          for (let r = 0; r < rowsZ; r++) {
            const zPos = -cylinderLength / 2 + ((r + 0.5) / rowsZ) * cylinderLength;
            // Độ lệch góc quấn xoắn ốc liên tục (Continuous Helical Wire Winding Pitch)
            // Các mũi kim xếp so le khít nhau, phủ kín bề mặt trống như dây quấn máy cào xơ thật
            const helicalOffset = r * 0.43;

            for (let k = 0; k < teethPerRow; k++) {
              const angle = (k * Math.PI * 2) / teethPerRow + helicalOffset;
              const x = radius * Math.cos(angle);
              const y = radius * Math.sin(angle);

              dummy.position.set(x, y, zPos);
              dummy.rotation.set(0, 0, angle);
              dummy.scale.set(1, 1, 1);
              dummy.updateMatrix();

              instancedTeeth.setMatrixAt(toothIdx++, dummy.matrix);
            }
          }

          instancedTeeth.instanceMatrix.needsUpdate = true;
          rotorGroup.add(instancedTeeth);
        }

        // Nan hoa và vạch chữ thập mặt đầu trục để nhìn thấy chuyển động quay tròn quanh tâm
        const spokeGeo = new THREE.BoxGeometry(radius * 1.85, Math.max(3, radius * 0.03), 3);
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.85 });
        const spoke1 = new THREE.Mesh(spokeGeo, spokeMat);
        spoke1.position.z = cylinderLength / 2 + 2;
        rotorGroup.add(spoke1);

        const spoke2 = new THREE.Mesh(spokeGeo, spokeMat);
        spoke2.position.z = cylinderLength / 2 + 2;
        spoke2.rotation.z = Math.PI / 2;
        rotorGroup.add(spoke2);

        // Vạch tương tự ở mặt đáy trục
        const spokeBack1 = spoke1.clone();
        spokeBack1.position.z = -cylinderLength / 2 - 2;
        rotorGroup.add(spokeBack1);

        const spokeBack2 = spoke2.clone();
        spokeBack2.position.z = -cylinderLength / 2 - 2;
        rotorGroup.add(spokeBack2);

        // Cổ trục & Ổ bi bạc đạn ở hai đầu
        const shaftRadius = Math.max(14, radius * 0.25);
        const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, cylinderLength + 100, 20);
        shaftGeo.rotateX(Math.PI / 2);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
        const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
        rotorGroup.add(shaftMesh);

        // Đưa rotorGroup vào nhóm chính
        group.add(rotorGroup);

        // Vòng chỉ thị hướng quay cố định (CW / CCW Indicator) - gắn trên bệ đỡ tĩnh
        if (comp.rotationDir !== 'STATIC') {
          const arrowRadius = radius * 1.15;
          const arcGeo = new THREE.RingGeometry(arrowRadius - 4, arrowRadius + 4, 32, 1, 0, Math.PI * 1.4);
          const arcMat = new THREE.MeshBasicMaterial({
            color: comp.rotationDir === 'CW' ? 0x22c55e : 0x06b6d4,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
          });
          const arcMesh = new THREE.Mesh(arcGeo, arcMat);
          arcMesh.position.z = cylinderLength / 2 + 10;
          if (comp.rotationDir === 'CW') {
            arcMesh.rotation.y = Math.PI; // Lật mặt mũi tên nếu CW
          }
          group.add(arcMesh);
        }
      }

      // Viền chọn highlight nếu đang được click
      if (isSel) {
        const selRingGeo = new THREE.RingGeometry(radius + 8, radius + 14, 36);
        const selRingMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const selRing = new THREE.Mesh(selRingGeo, selRingMat);
        selRing.position.z = cylinderLength / 2 + 15;
        group.add(selRing);
      }

      scene.add(group);
      meshesMap.current.set(comp.id, group);
    });
  }, [components, selectedId]);

  // Tạo dải tấm vải/bông 3D uốn lượn nối qua các trục theo Fabric Routing
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (webRibbonMeshRef.current) {
      scene.remove(webRibbonMeshRef.current);
      webRibbonMeshRef.current.geometry.dispose();
      if (Array.isArray(webRibbonMeshRef.current.material)) {
        webRibbonMeshRef.current.material.forEach((m) => m.dispose());
      } else {
        webRibbonMeshRef.current.material.dispose();
      }
      webRibbonMeshRef.current = null;
    }

    // Xây dựng chuỗi điểm luồn vải theo fabricRouting với cung ôm thực tế
    let orderedRollers: { comp: MachineComponent; wrapMode: 'over' | 'under' | 'tangent' | 'carding_gap' }[] = [];

    if (!fabricRouting.autoRoute && fabricRouting.steps.length > 0) {
      fabricRouting.steps.forEach((step) => {
        if (!step.enabled) return;
        const comp = components.find((c) => c.id === step.rollerId);
        // Loại bỏ condenser_drum khỏi hành trình vải dệt nguyên tấm vì qua trống xé đã biến thành xơ bông
        if (comp && comp.type !== 'condenser_drum') {
          orderedRollers.push({ comp, wrapMode: step.wrapMode });
        }
      });
    }

    if (orderedRollers.length === 0) {
      const activeRollers = components
        .filter((c) => c.type !== 'suction_hood' && c.type !== 'condenser_drum')
        .sort((a, b) => (materialConfig.feedDirection === 'left_to_right' ? a.x - b.x : b.x - a.x));

      orderedRollers = activeRollers.map((comp) => ({
        comp,
        wrapMode:
          comp.type === 'feed_roller'
            ? 'under'
            : comp.type === 'cutter_knife'
            ? 'tangent'
            : comp.type === 'worker_roller' || comp.type === 'stripper_roller'
            ? 'carding_gap'
            : 'under',
      }));
    }

    if (orderedRollers.length < 2) return;

    // Tính toán cung ôm thực tế bám sát chu vi răng kim trống xé và các trục
    const { points } = buildContinuousFabricPath(
      orderedRollers,
      materialConfig.feedDirection,
      components
    );

    if (points.length > 0) {
      fabricEndPointRef.current = points[points.length - 1].clone();
    }

    const clothWidth = fabricRouting.clothWidthMm || 850;
    const { geometry: ribbonGeo } = createNaturalRibbonGeometry(points, clothWidth, 160, true);

    // Lưu tọa độ đỉnh gốc ban đầu để mô phỏng vi sóng dao động tự nhiên khi chuyển động
    const posAttr = ribbonGeo.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) {
      baseRibbonPositionsRef.current = new Float32Array(posAttr.array);
    }

    const texture = createFabricCanvasTexture(fabricRouting.clothColor || '#2563eb');
    clothTextureRef.current = texture;

    // Màu dải vải kết hợp cảnh báo lực căng
    const maxTension = Math.max(...tensions.map((t) => t.tensionN), materialConfig.nominalTensionN);
    let tensionTint = 0xffffff;
    if (maxTension > 500) tensionTint = 0xfecaca;
    else if (maxTension > 350) tensionTint = 0xfef08a;

    const ribbonMat = new THREE.MeshStandardMaterial({
      map: texture,
      color: tensionTint,
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    scene.add(ribbonMesh);
    webRibbonMeshRef.current = ribbonMesh;
  }, [components, materialConfig, tensions, fabricRouting]);

  // Cập nhật các đường gióng đo cự ly 3D (3D Calipers)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!clearance3dGroupRef.current) {
      clearance3dGroupRef.current = new THREE.Group();
      scene.add(clearance3dGroupRef.current);
    }
    const grp = clearance3dGroupRef.current;
    grp.clear();

    clearances.slice(0, 6).forEach((c) => {
      const compA = components.find((item) => item.id === c.idA);
      const compB = components.find((item) => item.id === c.idB);
      if (!compA || !compB || c.gapMm > 40) return;

      const pA = new THREE.Vector3(compA.x, compA.y, compA.length * 0.36);
      const pB = new THREE.Vector3(compB.x, compB.y, compB.length * 0.36);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([pA, pB]);
      const isCol = c.gapMm < 0;
      const isTight = c.gapMm >= 0 && c.gapMm < 1.0;
      const lineMat = new THREE.LineDashedMaterial({
        color: isCol ? 0xef4444 : isTight ? 0xf59e0b : 0x38bdf8,
        dashSize: 6,
        gapSize: 4,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      grp.add(line);
    });
  }, [components, clearances]);

  // Cập nhật đường ống luồng hút khí động học 3D vòng dưới các worker roller (Under-Roller Suction Streamline)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!underSuctionStreamGroupRef.current) {
      underSuctionStreamGroupRef.current = new THREE.Group();
      scene.add(underSuctionStreamGroupRef.current);
    }
    const grp = underSuctionStreamGroupRef.current;
    grp.clear();
    const showUnder = suctionConfig.showUnderSuctionPath !== false;
    const underOffset = suctionConfig.underSuctionOffsetMm ?? 38;

    const drum = components.find((c) => c.type === 'main_drum');
    const hood = components.find((c) => c.type === 'suction_hood');
    if (!drum || !hood || !suctionConfig.active || !showUnder) return;

    const workers = components
      .filter((c) => c.type === 'worker_roller' || c.type === 'stripper_roller')
      .sort((a, b) => {
        let angA = Math.atan2(a.y - drum.y, a.x - drum.x);
        let angB = Math.atan2(b.y - drum.y, b.x - drum.x);
        while (angA < -Math.PI) angA += Math.PI * 2;
        while (angB < -Math.PI) angB += Math.PI * 2;
        return angA - angB;
      });

    if (workers.length === 0) return;

    const underPts: THREE.Vector3[] = [];
    workers.forEach((w) => {
      const dx = w.x - drum.x;
      const dy = w.y - drum.y;
      const dist = Math.hypot(dx, dy) || 1;
      underPts.push(
        new THREE.Vector3(
          Number((w.x + (dx / dist) * (w.diameter / 2 + underOffset)).toFixed(2)),
          Number((w.y + (dy / dist) * (w.diameter / 2 + underOffset)).toFixed(2)),
          0
        )
      );
    });

    const hoodMouth = new THREE.Vector3(hood.x - 35, hood.y - 45, 0);
    underPts.push(hoodMouth);

    if (underPts.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(underPts, false, 'centripetal', 0.25);
      const sampled = curve.getPoints(60);

      // 1. Đường luồng hút trung tâm với vạch nét đứt chuyển động (Animated Suction Streamline)
      const lineGeo = new THREE.BufferGeometry().setFromPoints(sampled);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x10b981,
        dashSize: 14,
        gapSize: 7,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      grp.add(line);

      // 2. Ống khí động học phát sáng bán trong suốt (Aerodynamic Under-Channel Tube)
      const tubeGeo = new THREE.TubeGeometry(curve, 40, 10, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      grp.add(tubeMesh);
    }
  }, [components, suctionConfig]);

  // Vòng lặp render Animation theo thời gian thực (Real-time Physics Animation)
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (time: number) => {
      animFrameId.current = requestAnimationFrame(animate);

      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (isRunning) {
        // Quay các trục theo đúng RPM và chiều quay CW / CCW
        components.forEach((comp) => {
          if (comp.rotationDir === 'STATIC') return;
          const group = meshesMap.current.get(comp.id);
          if (!group) return;

          // Góc quay rad/s = (RPM * 2 * PI / 60) * simSpeedMultiplier
          const angularSpeed = ((comp.rpm * Math.PI * 2) / 60) * simSpeedMultiplier;
          const sign = comp.rotationDir === 'CW' ? -1 : 1;
          const deltaAngle = sign * angularSpeed * delta;

          // Quay nhóm rotor chuẩn xác quanh tâm trục đối xứng (Z) của chính chi tiết đó
          const rotor = group.getObjectByName('rotor');
          if (rotor) {
            rotor.rotation.z += deltaAngle;
          }
        });

        // Hoạt ảnh dải vải di chuyển tịnh tiến liên tục và vi dao động tự nhiên (Natural Dynamic Fabric Movement)
        if (clothTextureRef.current) {
          const speed = materialConfig.feedSpeedMPerMin;
          const dirSign = materialConfig.feedDirection === 'left_to_right' ? 1 : -1;
          clothTextureRef.current.offset.y -= dirSign * (speed / 18) * simSpeedMultiplier * delta;
        }

        // Chuyển động ôm vào tự nhiên: các điểm trên cung ôm trục giữ nguyên độ bám sát, các nhịp tự do có vi sóng nhẹ
        if (webRibbonMeshRef.current && baseRibbonPositionsRef.current) {
          const mesh = webRibbonMeshRef.current;
          const geo = mesh.geometry as THREE.BufferGeometry;
          const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
          if (posAttr) {
            const posArr = posAttr.array as Float32Array;
            const baseArr = baseRibbonPositionsRef.current;
            const count = posArr.length / 3;
            const timeSec = time / 1000;
            const feedSpeed = materialConfig.feedSpeedMPerMin;

            for (let i = 0; i < count; i += 2) {
              const bx = baseArr[i * 3 + 0];
              const by = baseArr[i * 3 + 1];

              // Kiểm tra xem vị trí có đang ôm sát mặt trục nào không
              let isHuggingRoller = false;
              for (let r = 0; r < components.length; r++) {
                const comp = components[r];
                if (comp.type === 'suction_hood') continue;
                const radius = comp.diameter / 2 + 5.5;
                const distSq = (bx - comp.x) * (bx - comp.x) + (by - comp.y) * (by - comp.y);
                if (distSq <= radius * radius) {
                  isHuggingRoller = true;
                  break;
                }
              }

              if (!isHuggingRoller) {
                // Nhịp tự do giữa các trục: sóng vải vi chấn động khí động học tự nhiên
                const wave = Math.sin((bx * 0.02) - (timeSec * feedSpeed * 0.28 * simSpeedMultiplier)) * 1.6;
                posArr[i * 3 + 1] = by + wave;
                posArr[(i + 1) * 3 + 1] = baseArr[(i + 1) * 3 + 1] + wave;
              } else {
                // Vị trí ôm vào trống: giữ ôm sát tuyệt đối và vững chắc
                posArr[i * 3 + 1] = by;
                posArr[(i + 1) * 3 + 1] = baseArr[(i + 1) * 3 + 1];
              }
            }
            posAttr.needsUpdate = true;
          }
        }

        // Chuyển động luồng hút khí động học vòng dưới các roller
        if (underSuctionStreamGroupRef.current) {
          underSuctionStreamGroupRef.current.traverse((obj) => {
            if (obj instanceof THREE.Line && obj.material) {
              (obj.material as any).dashOffset = ((obj.material as any).dashOffset || 0) - 65 * delta * simSpeedMultiplier;
            }
          });
        }

        // TÍNH TOÁN HÌNH HỌC LUỒNG XƠ (FIBER FLOW DYNAMICS & SUCTION AERODYNAMICS)
        const drum = components.find((c) => c.type === 'main_drum');
        const hood = components.find((c) => c.type === 'suction_hood');
        const knife = components.find((c) => c.type === 'cutter_knife');

        const drumCenter = drum ? { x: drum.x, y: drum.y } : { x: 480, y: 250 };
        const drumRadius = drum ? drum.diameter / 2 : 250;
        const drumLength = drum ? drum.length : 1000;

        // Trục chải vệ tinh (Worker Rollers & Stripper Rollers) sắp xếp theo chiều quay trống
        const sortedWorkers = components
          .filter((c) => c.type === 'worker_roller' || c.type === 'stripper_roller')
          .sort((a, b) => {
            let angA = Math.atan2(a.y - drumCenter.y, a.x - drumCenter.x);
            let angB = Math.atan2(b.y - drumCenter.y, b.x - drumCenter.x);
            while (angA < -Math.PI) angA += Math.PI * 2;
            while (angB < -Math.PI) angB += Math.PI * 2;
            return angA - angB;
          });

        const workerNips: { x: number; y: number }[] = [];
        const underPoints: { x: number; y: number }[] = [];

        sortedWorkers.forEach((w) => {
          const dx = w.x - drumCenter.x;
          const dy = w.y - drumCenter.y;
          const dist = Math.hypot(dx, dy) || 1;
          const ux = dx / dist;
          const uy = dy / dist;

          // Điểm nip trong khe chải giữa mặt trống và mặt trục
          workerNips.push({
            x: Number((drumCenter.x + ux * (drumRadius + 2.5)).toFixed(2)),
            y: Number((drumCenter.y + uy * (drumRadius + 2.5)).toFixed(2)),
          });

          const underOffset = suctionConfig.underSuctionOffsetMm ?? 38;
          // Điểm mép ngoài phía dưới của trục chải (trong luồng hút đáy vòng dưới các roller)
          underPoints.push({
            x: Number((w.x + ux * (w.diameter / 2 + underOffset)).toFixed(2)),
            y: Number((w.y + uy * (w.diameter / 2 + underOffset)).toFixed(2)),
          });
        });

        // Điểm xé tơi ban đầu (Tearing Point): Tại dao cắt & răng kim trống chính / trước worker 0
        let tearPoint = {
          x: drumCenter.x - drumRadius * 0.85,
          y: drumCenter.y - drumRadius * 0.45,
        };
        if (workerNips.length > 0) {
          tearPoint = {
            x: workerNips[0].x - 16,
            y: workerNips[0].y + 16,
          };
        } else if (knife) {
          tearPoint = { x: knife.x + 12, y: knife.y + 12 };
        }

        // Tọa độ phễu hút khí động, cút nối và ống thải lên trần
        const hoodMouth = hood
          ? { x: hood.x - 35, y: hood.y - 45 }
          : { x: drumCenter.x + drumRadius + 90, y: drumCenter.y + drumRadius * 0.8 };
        const hoodThroat = hood ? { x: hood.x + 35, y: hood.y + 75 } : { x: hoodMouth.x + 40, y: hoodMouth.y + 60 };
        const hoodExhaust = hood ? { x: hood.x + 85, y: hood.y + 260 } : { x: hoodMouth.x + 80, y: hoodMouth.y + 200 };

        // Chuỗi điểm chải chính (Main Carding Arc)
        const mainCardingPoly: { x: number; y: number }[] = [tearPoint, ...workerNips];
        if (workerNips.length === 0) {
          for (let a = -Math.PI * 0.8; a <= 0.35; a += 0.2) {
            mainCardingPoly.push({
              x: drumCenter.x + (drumRadius + 3) * Math.cos(a),
              y: drumCenter.y + (drumRadius + 3) * Math.sin(a),
            });
          }
        }

        // Chuỗi điểm luồng hút đáy vòng dưới (Under-Roller Suction Path)
        const underSuctionPoly: { x: number; y: number }[] =
          underPoints.length > 0
            ? [...underPoints, hoodMouth]
            : [tearPoint, { x: tearPoint.x + 60, y: tearPoint.y - 50 }, hoodMouth];

        const numWorkers = workerNips.length;
        const suctionMult = suctionConfig.active ? Math.max(0.7, suctionConfig.airVelocity / 22) : 0.35;

        // Hàm cập nhật trạng thái động học cho từng hạt xơ và chùm bông (Physics Engine Update)
        const updateEntity = (
          ent: {
            pathMode: 'main_carding' | 'falling_under';
            progress: number;
            speed: number;
            dropGapIndex: number;
            dropProgress: number;
            zOffset: number;
            stage: 'carding' | 'dropping' | 'under_sweeping' | 'entering_hood' | 'inside_duct';
            ductProgress: number;
          },
          dt: number,
          isTuft: boolean
        ): { x: number; y: number; z: number; scaleMod?: number } => {
          const dtSpeed = ent.speed * dt * simSpeedMultiplier * (isTuft ? 1.0 : 1.3);

          // GIAI ĐOẠN 1: BÁM DỌC TRỐNG XÉ QUA CÁC WORKER ROLLER
          if (ent.stage === 'carding') {
            ent.progress += dtSpeed * 0.55;

            // Nếu thuộc nhánh rơi khe hở giữa các worker:
            if (ent.pathMode === 'falling_under' && numWorkers >= 2) {
              const dropTriggerFrac = (ent.dropGapIndex + 0.6) / numWorkers;
              if (ent.progress >= dropTriggerFrac) {
                ent.stage = 'dropping';
                ent.dropProgress = 0;
              }
            }

            if (ent.stage === 'carding') {
              if (ent.progress >= 1.0) {
                // Đã đi qua worker roller cuối cùng -> bay ra và hội tụ vào miệng hút
                ent.stage = 'entering_hood';
                ent.progress = 0;
              } else {
                const pt = samplePolyline(mainCardingPoly, ent.progress);
                return {
                  x: pt.x,
                  y: pt.y,
                  z: ent.zOffset,
                };
              }
            }
          }

          // GIAI ĐOẠN 2: RƠI XUỐNG KHE HỞ GIỮA 2 WORKER ROLLER THEO TRỌNG LỰC
          if (ent.stage === 'dropping') {
            ent.dropProgress += dtSpeed * 2.2;
            const gapIdx = Math.min(numWorkers - 2, Math.max(0, ent.dropGapIndex));
            const topPt = samplePolyline(
              workerNips,
              numWorkers > 1 ? (gapIdx + 0.5) / (numWorkers - 1) : 0
            );
            const botPt = samplePolyline(
              underPoints,
              underPoints.length > 1 ? (gapIdx + 0.5) / (underPoints.length - 1) : 0
            );

            const t = Math.min(1.0, ent.dropProgress);
            const gravityY = t * t; // Gia tốc trọng trường rơi nhanh dần
            const curX = topPt.x + (botPt.x - topPt.x) * t;
            const curY = topPt.y + (botPt.y - topPt.y) * gravityY;

            if (ent.dropProgress >= 1.0) {
              // Khi rơi xuống phía dưới các roller -> Bị luồng hút đáy cực mạnh cuốn phăng đi!
              ent.stage = 'under_sweeping';
              ent.progress = underPoints.length > 1 ? (gapIdx + 0.5) / (underPoints.length - 1) : 0;
            }

            return {
              x: curX,
              y: curY,
              z: ent.zOffset,
            };
          }

          // GIAI ĐOẠN 3: ĐƯỢC HÚT QUÉT DỌC THEO ĐƯỜNG LUỒNG HÚT ĐÁY DƯỚI CÁC ROLLER
          if (ent.stage === 'under_sweeping') {
            ent.progress += dtSpeed * 1.35 * suctionMult;
            if (ent.progress >= 1.0) {
              ent.stage = 'entering_hood';
              ent.progress = 0;
            } else {
              const pt = samplePolyline(underSuctionPoly, ent.progress);
              return {
                x: pt.x,
                y: pt.y,
                z: ent.zOffset,
              };
            }
          }

          // GIAI ĐOẠN 4: HỘI TỤ TRỰC TIẾP VÀO MIỆNG HỌNG HÚT (KHÔNG BỊ BAY RA NGOÀI)
          if (ent.stage === 'entering_hood') {
            ent.progress += dtSpeed * 1.6 * suctionMult;
            const fromPt =
              ent.pathMode === 'falling_under'
                ? (underPoints.length > 0 ? underPoints[underPoints.length - 1] : tearPoint)
                : (workerNips.length > 0 ? workerNips[workerNips.length - 1] : mainCardingPoly[mainCardingPoly.length - 1]);

            const t = Math.min(1.0, ent.progress);
            const curX = fromPt.x + (hoodMouth.x - fromPt.x) * t;
            const curY = fromPt.y + (hoodMouth.y - fromPt.y) * t;

            // Thu hẹp triệt để bề rộng Z để chui trọn vẹn vào phễu hút, không bay ra ngoài
            const funnelZ = ent.zOffset * Math.max(0, 1.0 - t * t);

            if (ent.progress >= 1.0) {
              // Đã lọt vào bên trong miệng họng hút!
              ent.stage = 'inside_duct';
              ent.ductProgress = 0;
            }

            return {
              x: curX,
              y: curY,
              z: funnelZ,
            };
          }

          // GIAI ĐOẠN 5: CHUI HOÀN TOÀN TRONG ỐNG DẪN KHÍ & XƠ (INSIDE TRANSPORT DUCT)
          if (ent.stage === 'inside_duct') {
            ent.ductProgress += dtSpeed * 3.2 * suctionMult;
            const t = Math.min(1.0, ent.ductProgress);

            let curX: number, curY: number;
            if (t < 0.45) {
              const st = t / 0.45;
              curX = hoodMouth.x + (hoodThroat.x - hoodMouth.x) * st;
              curY = hoodMouth.y + (hoodThroat.y - hoodMouth.y) * st;
            } else {
              const st = (t - 0.45) / 0.55;
              curX = hoodThroat.x + (hoodExhaust.x - hoodThroat.x) * st;
              curY = hoodThroat.y + (hoodExhaust.y - hoodThroat.y) * st;
            }

            // Xoáy nhẹ bên trong lòng ống dẫn (tuyệt đối không vượt quá đường kính ống)
            const swirlZ = Math.sin(t * Math.PI * 4) * 12;
            const scaleMod = Math.max(0.18, 1.0 - t * 0.7);

            if (ent.ductProgress >= 1.0) {
              // Đã hút xong hoàn toàn -> Tái sinh tại điểm xé vải ban đầu!
              const fallingRatio = (suctionConfig.fallingFiberRatio ?? 30) / 100;
              ent.stage = 'carding';
              ent.progress = 0;
              ent.dropProgress = 0;
              ent.ductProgress = 0;
              ent.pathMode = Math.random() < fallingRatio ? 'falling_under' : 'main_carding';
              ent.dropGapIndex = Math.floor(Math.random() * Math.max(1, numWorkers - 1));
              ent.zOffset = (Math.random() - 0.5) * (drumLength * 0.5);
            }

            return {
              x: curX,
              y: curY,
              z: swirlZ,
              scaleMod,
            };
          }

          return { x: tearPoint.x, y: tearPoint.y, z: 0 };
        };

        // Cập nhật các khối bông xơ 3D thể tích (3D Fluffy Cotton Tufts)
        if (cottonTuftsDataRef.current && fabricRouting.fiberTuftParticles !== false) {
          const feedScaleFactor = Math.min(
            2.5,
            Math.max(
              0.7,
              (materialConfig.fabricLayers || 2) * 0.35 +
                (materialConfig.feedRateKgPerHour || 250) / 450
            )
          );
          const isRound = suctionConfig.tuftShape === 'round';

          cottonTuftsDataRef.current.forEach((tuft) => {
            const pos = updateEntity(tuft, delta, true);
            tuft.mesh.position.set(pos.x, pos.y, pos.z);

            const scaleMod = pos.scaleMod ?? 1.0;
            const s = tuft.baseScale * feedScaleFactor * scaleMod;
            if (isRound) {
              tuft.mesh.scale.set(s, s * 0.9, s * 1.1);
              tuft.mesh.rotation.x += 1.8 * delta;
              tuft.mesh.rotation.z += 1.4 * delta;
              tuft.mesh.rotation.y += 0.8 * delta;
            } else {
              // Dạng mảnh dẹt phẳng mỏng tự nhiên, xé rách tơi xốp (hoàn toàn không tròn như bọt khí)
              tuft.mesh.scale.set(s * 1.7, s * 0.12, s * 1.25);
              // Lượn bay dập dờn như mảnh vải mỏng hoặc cánh lá trong luồng gió
              tuft.mesh.rotation.z += (1.8 + tuft.speed * 0.8) * delta;
              tuft.mesh.rotation.x = Math.sin((time / 1000) * 4.5 + tuft.zOffset * 0.05) * 0.4;
              tuft.mesh.rotation.y += 0.5 * delta;
            }
          });
        }

        // Cập nhật chùm hạt sợi bông nhuyễn (Fine Fiber Stream)
        if (
          fiberParticlesRef.current &&
          fiberParticlesDataRef.current &&
          fabricRouting.fiberTuftParticles !== false
        ) {
          const positions = fiberParticlesRef.current.geometry.attributes.position.array as Float32Array;
          const fiberList = fiberParticlesDataRef.current;

          for (let i = 0; i < fiberList.length; i++) {
            const ent = fiberList[i];
            const pos = updateEntity(ent, delta, false);
            positions[i * 3 + 0] = pos.x;
            positions[i * 3 + 1] = pos.y;
            positions[i * 3 + 2] = pos.z;
          }
          fiberParticlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [components, isRunning, simSpeedMultiplier, suctionConfig]);

  // Xử lý chuột: Raycast click chọn trục & Kéo thả / Xoay Orbit Camera
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mousePrev.current = { x: e.clientX, y: e.clientY };

    if (e.button === 0) {
      // Chuột trái: Raycast xem có click trúng chi tiết trục nào không
      const container = mountRef.current;
      if (!container || !cameraRef.current || !sceneRef.current) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const candidateObjects: THREE.Object3D[] = [];
      meshesMap.current.forEach((grp) => {
        candidateObjects.push(...grp.children);
      });

      const intersects = raycaster.intersectObjects(candidateObjects, true);
      if (intersects.length > 0) {
        let topParent: THREE.Object3D | null = intersects[0].object;
        while (topParent && topParent.parent && topParent.parent !== sceneRef.current) {
          topParent = topParent.parent;
        }
        if (topParent && meshesMap.current.has(topParent.name)) {
          onSelectComponent(topParent.name);
          const comp = components.find((c) => c.id === topParent.name);
          if (!isLocked && (!comp || !comp.isLocked)) {
            isDraggingObj.current = true;
          }
          return;
        }
      }

      isOrbiting.current = true;
    } else if (e.button === 1 || e.button === 2) {
      // Chuột giữa hoặc chuột phải: Pan di chuyển điểm nhìn
      isPanning.current = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const dx = e.clientX - mousePrev.current.x;
    const dy = e.clientY - mousePrev.current.y;
    mousePrev.current = { x: e.clientX, y: e.clientY };

    if (isDraggingObj.current && selectedId) {
      // Kéo chi tiết được chọn trên mặt phẳng XY
      const selectedComp = components.find((c) => c.id === selectedId);
      if (selectedComp && !selectedComp.isLocked && !isLocked) {
        // Tỉ lệ scale kéo theo khoảng cách camera
        const scaleFactor = cameraSpherical.current.radius / 800;
        const newX = Math.round(selectedComp.x + dx * scaleFactor);
        const newY = Math.round(selectedComp.y - dy * scaleFactor);
        onUpdatePosition(selectedId, newX, newY);
      }
      return;
    }

    if (isOrbiting.current) {
      cameraSpherical.current.theta -= dx * 0.005;
      cameraSpherical.current.phi = Math.max(0.08, Math.min(Math.PI / 2 + 0.1, cameraSpherical.current.phi - dy * 0.005));
      updateCameraFromSpherical();
    } else if (isPanning.current) {
      const panSpeed = cameraSpherical.current.radius * 0.001;
      cameraTarget.current.x -= dx * panSpeed;
      cameraTarget.current.y += dy * panSpeed;
      updateCameraFromSpherical();
    }
  };

  const handleMouseUp = () => {
    isOrbiting.current = false;
    isPanning.current = false;
    isDraggingObj.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraSpherical.current.radius = Math.max(350, Math.min(3200, cameraSpherical.current.radius * zoomFactor));
    updateCameraFromSpherical();
  };

  // Trạng thái hiển thị thông số HUD (có thể ẩn/hiện bằng nút hoặc phím H)
  const [localShowHUD, setLocalShowHUD] = useState<boolean>(showHUD !== undefined ? showHUD : true);

  useEffect(() => {
    if (showHUD !== undefined) {
      setLocalShowHUD(showHUD);
    }
  }, [showHUD]);

  const toggleHUD = useCallback(() => {
    if (onToggleHUD) {
      onToggleHUD();
    } else {
      setLocalShowHUD((prev) => !prev);
    }
  }, [onToggleHUD]);

  // Phím tắt H để ẩn / hiện thông số cho màn hình thoáng đãng
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'h' || e.key === 'H') {
        toggleHUD();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      {/* Three.js Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Chế độ tối giản khi ẨN THÔNG SỐ (Minimal Zen Mode) */}
      {!localShowHUD && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <button
            onClick={toggleHUD}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-sky-300 backdrop-blur-md border border-slate-700/70 rounded-full shadow-xl text-xs font-medium transition-all hover:scale-105"
            title="Hiện lại toàn bộ thông số và thanh điều hướng (Phím H)"
          >
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>Hiện thông số (HUD) [Phím H]</span>
          </button>
        </div>
      )}

      {/* Floating 3D Navigation Controls HUD (Khi BẬT thông số) */}
      {localShowHUD && (
        <>
          <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl text-xs font-medium text-slate-300">
            <button
              onClick={() => setCameraView('iso')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeCameraView === 'iso' ? 'bg-sky-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Góc nhìn phối cảnh 3D không gian"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Phối cảnh 3D</span>
            </button>
            <button
              onClick={() => setCameraView('front')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeCameraView === 'front' ? 'bg-sky-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Nhìn trực diện mặt cắt ngang (Side Elevation)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Mặt cắt phẳng</span>
            </button>
            <button
              onClick={() => setCameraView('top')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeCameraView === 'top' ? 'bg-sky-600 text-white font-semibold shadow-sm' : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Nhìn thẳng từ trên nóc máy xuống"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Từ trên xuống</span>
            </button>
            <div className="w-px h-4 bg-slate-700 mx-0.5" />
            <button
              onClick={resetCamera}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Đặt lại góc quay mặc định"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {onOpenCardClothingModal && (
              <>
                <div className="w-px h-4 bg-slate-700 mx-0.5" />
                <button
                  onClick={onOpenCardClothingModal}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800/80 transition-colors text-[11px] font-semibold"
                  title="Soi phóng to chi tiết đồ kim, góc nghiêng răng cưa và bề mặt trống"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Soi bề mặt kim</span>
                </button>
              </>
            )}

            {isLocked && (
              <>
                <div className="w-px h-4 bg-slate-700 mx-0.5" />
                <span
                  className="flex items-center gap-1 font-semibold text-[11px] text-amber-300 bg-amber-950/80 px-2 py-1 rounded-lg border border-amber-600/70"
                  title="Vị trí dàn máy đang được khóa cố định, chống xê dịch"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Đã khóa vị trí</span>
                </span>
              </>
            )}

            {/* Bật/Tắt đường luồng hút khí động học dưới các trục & Điều chỉnh nhanh độ rộng/rơi xơ */}
            <div className="w-px h-4 bg-slate-700 mx-0.5" />
            <button
              onClick={() => {
                const show = suctionConfig.showUnderSuctionPath !== false;
                onChangeSuctionConfig?.({
                  ...suctionConfig,
                  showUnderSuctionPath: !show,
                });
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                suctionConfig.showUnderSuctionPath !== false
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-sm ring-1 ring-emerald-500/30'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Bật / tắt hiển thị đường luồng hút khí động học dưới các trục chải (2D & 3D)"
            >
              <Wind className="w-3.5 h-3.5 text-emerald-400" />
              <span>Đường hút: {suctionConfig.showUnderSuctionPath !== false ? 'HIỆN' : 'ẨN'}</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowSuctionQuickControls((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                  showSuctionQuickControls
                    ? 'bg-sky-950/90 border-sky-500 text-sky-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Tùy chỉnh vị trí/độ rộng luồng hút dưới trục (mm) và tỉ lệ rơi xơ (%)"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Rộng: {suctionConfig.underSuctionOffsetMm ?? 45}mm</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Popup chỉnh cự ly luồng hút & rơi xơ */}
              {showSuctionQuickControls && (
                <div className="absolute top-full mt-2 right-0 sm:left-0 z-50 w-72 p-3 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl space-y-3 text-xs text-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-semibold text-sky-300">
                    <span className="flex items-center gap-1.5">
                      <Wind className="w-4 h-4 text-emerald-400" /> Tùy Chỉnh Luồng Hút Đáy
                    </span>
                    <button
                      onClick={() => setShowSuctionQuickControls(false)}
                      className="text-slate-400 hover:text-slate-200 text-xs px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Độ rộng / Khoảng cách võng dưới trục chải */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Độ rộng luồng hút dưới trục:</span>
                      <span className="font-mono font-bold text-sky-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {suctionConfig.underSuctionOffsetMm ?? 45} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="160"
                      step="5"
                      value={suctionConfig.underSuctionOffsetMm ?? 45}
                      onChange={(e) =>
                        onChangeSuctionConfig?.({
                          ...suctionConfig,
                          underSuctionOffsetMm: Number(e.target.value),
                        })
                      }
                      className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="flex gap-1 pt-0.5">
                      {[25, 45, 80, 130].map((presetMm) => (
                        <button
                          key={presetMm}
                          onClick={() =>
                            onChangeSuctionConfig?.({
                              ...suctionConfig,
                              underSuctionOffsetMm: presetMm,
                            })
                          }
                          className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            (suctionConfig.underSuctionOffsetMm ?? 45) === presetMm
                              ? 'bg-sky-600 text-white border-sky-400 font-bold'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                          }`}
                        >
                          {presetMm}mm
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tỉ lệ xơ rơi qua khe hở do trọng lực */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Tỉ lệ xơ rơi qua khe:</span>
                      <span className="font-mono font-bold text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {suctionConfig.fallingFiberRatio ?? 35} %
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="85"
                      step="5"
                      value={suctionConfig.fallingFiberRatio ?? 35}
                      onChange={(e) =>
                        onChangeSuctionConfig?.({
                          ...suctionConfig,
                          fallingFiberRatio: Number(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="flex gap-1 pt-0.5">
                      {[
                        { val: 20, label: 'Ít (20%)' },
                        { val: 40, label: 'Vừa (40%)' },
                        { val: 65, label: 'Nhiều (65%)' },
                      ].map((item) => (
                        <button
                          key={item.val}
                          onClick={() =>
                            onChangeSuctionConfig?.({
                              ...suctionConfig,
                              fallingFiberRatio: item.val,
                            })
                          }
                          className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            (suctionConfig.fallingFiberRatio ?? 35) === item.val
                              ? 'bg-amber-600 text-white border-amber-400 font-bold'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kiểu dáng bông: Mảnh dẹt phẳng vs Tròn */}
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 block">Dáng hình xơ bông:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() =>
                          onChangeSuctionConfig?.({
                            ...suctionConfig,
                            tuftShape: 'fluffy_flake',
                          })
                        }
                        className={`py-1.5 px-2 rounded text-[10px] font-semibold border text-center transition-colors cursor-pointer ${
                          (suctionConfig.tuftShape || 'fluffy_flake') === 'fluffy_flake'
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Mảnh dẹt phẳng
                      </button>
                      <button
                        onClick={() =>
                          onChangeSuctionConfig?.({
                            ...suctionConfig,
                            tuftShape: 'round',
                          })
                        }
                        className={`py-1.5 px-2 rounded text-[10px] font-semibold border text-center transition-colors cursor-pointer ${
                          suctionConfig.tuftShape === 'round'
                            ? 'bg-sky-950 border-sky-500 text-sky-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Hạt tròn
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-slate-700 mx-0.5" />
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-[11px] text-emerald-300 font-medium select-none shadow-sm" title="Vải vụn dệt được xé tơi thành xơ bông và hút vào ống khí động, không còn cuộn vải gập lại">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Nạp vải ➔ Xé thành xơ ➔ Ống hút 100% xơ bông</span>
            </div>
            <button
              onClick={toggleHUD}
              className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
              title="Ẩn bớt bảng thông số để nhìn 3D rõ nét (Phím H)"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ẩn thông số [H]</span>
            </button>
          </div>

          {/* Overlay chú thích thao tác 3D */}
          <div className="absolute bottom-4 left-4 z-10 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-lg text-[11px] text-slate-400 pointer-events-none flex items-center gap-3">
            <span>Xoay góc: <strong className="text-slate-200">Chuột trái</strong></span>
            <span>·</span>
            <span>Di chuyển: <strong className="text-slate-200">Chuột phải / giữa</strong></span>
            <span>·</span>
            <span>Phóng to: <strong className="text-slate-200">Cuộn chuột</strong></span>
            <span>·</span>
            <span>Kéo trục: <strong className="text-sky-300">Click & Kéo</strong></span>
            <span>·</span>
            <span>Ẩn HUD: <strong className="text-amber-300">Phím H</strong></span>
          </div>

          {/* Active Selected Component Info Badge in 3D */}
          {selectedId && (
            <div className="absolute top-4 right-4 z-10 p-3.5 bg-slate-900/90 backdrop-blur-md border border-sky-500/50 rounded-xl shadow-2xl text-xs max-w-xs space-y-2">
              {(() => {
                const comp = components.find((c) => c.id === selectedId);
                if (!comp) return null;
                const v = getLinearVelocity(comp.diameter, comp.rpm);
                const pitch = comp.toothPitchMm || (comp.type === 'main_drum' ? 3.2 : 2.8);
                const angle = comp.toothAngleDeg || (comp.type === 'main_drum' ? 70 : 65);

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-800">
                      <span className="font-bold text-sky-300 truncate">{comp.name}</span>
                      <span className="font-mono text-[11px] bg-slate-800 text-sky-400 px-1.5 py-0.5 rounded">
                        Ø{comp.diameter} mm
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-300">
                      <div>
                        Vị trí: <span className="font-mono text-slate-100">X:{comp.x} Y:{comp.y}</span>
                      </div>
                      <div>
                        Tần số: <span className="font-mono text-emerald-400 font-bold">{rpmToHz(comp.rpm)} Hz</span>
                      </div>
                      <div>
                        Tốc độ: <span className="font-mono text-slate-100">{comp.rpm} RPM</span>
                      </div>
                      <div>
                        Vận tốc: <span className="font-mono text-emerald-400">{v} m/p</span>
                      </div>
                      <div>
                        Chiều quay: <span className="font-semibold text-amber-300">{comp.rotationDir}</span>
                      </div>
                      <div>
                        Đồ kim: <span className="font-mono text-sky-300">p{pitch}mm · {angle}°</span>
                      </div>
                    </div>

                    {onOpenCardClothingModal && (
                      <button
                        onClick={onOpenCardClothingModal}
                        className="w-full mt-1 py-1 px-2 bg-slate-800 hover:bg-slate-750 text-sky-300 rounded text-[10px] font-medium border border-slate-700/80 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-sky-400" />
                        <span>Xem vi mô bề mặt kim & profile răng</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
};
