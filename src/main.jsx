import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  Box,
  ChevronsDown,
  ChevronsUp,
  Crosshair,
  Database,
  FileUp,
  Gauge,
  Info,
  Layers,
  List,
  LocateFixed,
  Maximize2,
  Pause,
  Pin,
  PinOff,
  Play,
  Radar,
  Route,
  RotateCcw,
  Satellite,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { spaceTargets } from './spaceTargets.js';
import './styles.css';

const targets = spaceTargets;
const assetPath = (url) => `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`;

const modules = [
  { id: 'orbit', name: '轨道仿真', icon: Satellite },
  { id: 'attitude', name: '姿态仿真', icon: Box },
  { id: 'debris', name: '空间碎片仿真', icon: Sparkles },
  { id: 'warning', name: '碰撞预警仿真', icon: ShieldAlert },
  { id: 'catalog', name: '目标列表', icon: List },
];

const conjunctions = [
  { primarySeq: 1, secondarySeq: 18, tca: '2026-06-25 17:42:18', distance: 0.82, velocity: 14.7, pc: '2.8e-4', level: '红色' },
  { primarySeq: 66, secondarySeq: 474, tca: '2026-06-25 21:08:55', distance: 2.36, velocity: 11.2, pc: '6.1e-5', level: '橙色' },
  { primarySeq: 121, secondarySeq: 509, tca: '2026-06-26 02:31:04', distance: 7.9, velocity: 5.4, pc: '8.5e-7', level: '黄色' },
];

const categoryLabels = {
  station: '空间站',
  capsule: '飞船',
  rocket: '火箭体',
  debris: '碎片',
  constellation: '星座',
  satellite: '卫星',
};

function formatSpeed(speed) {
  return Number.isInteger(speed) ? String(speed) : speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function altitudeToSceneRadius(alt) {
  return 1.78 + Math.log10(Number(alt) + 260) * 0.64;
}

function targetPosition(target, elapsed, speed) {
  const radius = altitudeToSceneRadius(target.alt);
  const phase = target.raan * 0.0174533 + elapsed * speed * (Math.PI * 2 / Math.max(target.period, 80)) * 0.72;
  const point = new THREE.Vector3(Math.cos(phase) * radius, Math.sin(phase) * radius, Math.sin(phase * 0.68) * 0.16);
  return point.applyEuler(new THREE.Euler(THREE.MathUtils.degToRad(target.inc), 0, THREE.MathUtils.degToRad(target.raan)));
}

function orbitPoints(target) {
  const radius = altitudeToSceneRadius(target.alt);
  const tilt = new THREE.Euler(THREE.MathUtils.degToRad(target.inc), 0, THREE.MathUtils.degToRad(target.raan));
  return Array.from({ length: 241 }, (_, index) => {
    const angle = (index / 240) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(angle * 0.68) * 0.16).applyEuler(tilt);
  });
}

function seededNoise(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, '#0b2841');
  ocean.addColorStop(0.5, '#0b4660');
  ocean.addColorStop(1, '#062033');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rand = seededNoise(42);
  const land = [
    [440, 340, 240, 150, -0.2], [610, 515, 160, 250, 0.18], [1010, 345, 310, 165, -0.06],
    [1215, 510, 270, 190, 0.24], [1515, 360, 250, 135, -0.18], [1615, 610, 180, 92, 0.08],
    [1780, 720, 160, 90, -0.12], [850, 720, 120, 66, 0.1],
  ];
  land.forEach(([x, y, rx, ry, rot]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#2f755d';
    ctx.beginPath();
    for (let i = 0; i <= 80; i += 1) {
      const a = (i / 80) * Math.PI * 2;
      const wobble = 0.82 + rand() * 0.36;
      const px = Math.cos(a) * rx * wobble;
      const py = Math.sin(a) * ry * (0.72 + rand() * 0.28);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = '#c8b47a';
    ctx.fillRect(-rx * 0.25, -ry * 0.2, rx * 0.56, ry * 0.28);
    ctx.restore();
    ctx.globalAlpha = 1;
  });

  for (let i = 0; i < 1200; i += 1) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    ctx.fillStyle = `rgba(220,255,246,${0.04 + rand() * 0.05})`;
    ctx.fillRect(x, y, 1 + rand() * 2, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const rand = seededNoise(88);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 380; i += 1) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const r = 8 + rand() * 32;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.1 + rand() * 0.16})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTextSprite(text, color = '#edf7f5') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const draw = (value) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(5, 8, 12, 0.62)';
    ctx.fillRect(0, 20, canvas.width, 88);
    ctx.strokeStyle = 'rgba(159, 246, 229, 0.34)';
    ctx.strokeRect(1, 21, canvas.width - 2, 86);
    ctx.fillStyle = color;
    ctx.font = '600 42px "PingFang SC", "Microsoft YaHei", Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, canvas.width / 2, canvas.height / 2);
  };
  draw(text);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(0.84, 0.21, 1);
  sprite.userData.setText = (value) => {
    draw(value);
    texture.needsUpdate = true;
  };
  return sprite;
}

function applyQuaternionToObject(object, targetQuaternion, alpha = 0.08) {
  object.quaternion.slerp(targetQuaternion, alpha);
}

function SpaceScene({ activeModule, speed, paused, selectedSeq, onSelect, resetKey, isolateCategory, showOrbit, followTarget }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ activeModule, speed, paused, selectedSeq, isolateCategory, showOrbit, followTarget });

  useEffect(() => {
    stateRef.current = { activeModule, speed, paused, selectedSeq, isolateCategory, showOrbit, followTarget };
  }, [activeModule, speed, paused, selectedSeq, isolateCategory, showOrbit, followTarget]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, mount.clientWidth / mount.clientHeight, 0.1, 1400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    camera.position.set(0, 0.34, 6.1);
    const root = new THREE.Group();
    root.position.set(-0.1, 0.32, 0);
    scene.add(root);
    scene.add(new THREE.AmbientLight(0x88aabb, 0.44));
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.set(5.6, 2.4, 4.8);
    scene.add(sun);
    const rimLight = new THREE.DirectionalLight(0x8edfff, 0.9);
    rimLight.position.set(-4, 1.2, -2.5);
    scene.add(rimLight);

    const textureLoader = new THREE.TextureLoader();
    const dayTexture = textureLoader.load(assetPath('/textures/earth-day.jpg'));
    const nightTexture = textureLoader.load(assetPath('/textures/earth-night.jpg'));
    const cloudTexture = textureLoader.load(assetPath('/textures/earth-clouds.png'));
    const bumpTexture = textureLoader.load(assetPath('/textures/earth-bump.jpg'));
    const specularTexture = textureLoader.load(assetPath('/textures/earth-specular.jpg'));
    dayTexture.colorSpace = THREE.SRGBColorSpace;
    nightTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    dayTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    cloudTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    bumpTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    specularTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1.86, 192, 192),
      new THREE.MeshPhongMaterial({
        map: dayTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.028,
        specularMap: specularTexture,
        specular: new THREE.Color('#6aaed0'),
        shininess: 18,
        emissive: new THREE.Color('#24465a'),
        emissiveMap: nightTexture,
        emissiveIntensity: 0.16,
      }),
    );
    earth.rotation.y = -1.42;
    earth.rotation.x = THREE.MathUtils.degToRad(-7);
    root.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.892, 160, 160),
      new THREE.MeshPhongMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    clouds.rotation.copy(earth.rotation);
    root.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.98, 128, 128),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float rim = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 2.25);
            float verticalFade = smoothstep(-0.65, 0.95, vNormal.y);
            vec3 glow = mix(vec3(0.05, 0.36, 0.62), vec3(0.55, 0.88, 1.0), verticalFade);
            gl_FragColor = vec4(glow, rim * 0.48);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    root.add(atmosphere);

    const stars = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 1600; i += 1) {
      const radius = 38 + Math.random() * 48;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starPositions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi));
    }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#ffffff', size: 0.048, transparent: true, opacity: 0.56 })));

    const targetGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(targets.length * 3);
    const colors = new Float32Array(targets.length * 3);
    const baseColors = new Float32Array(targets.length * 3);
    const color = new THREE.Color();
    targets.forEach((target, index) => {
      color.set(target.color);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      baseColors[index * 3] = color.r;
      baseColors[index * 3 + 1] = color.g;
      baseColors[index * 3 + 2] = color.b;
    });
    targetGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    targetGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const targetPoints = new THREE.Points(
      targetGeometry,
      new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.92, sizeAttenuation: true }),
    );
    root.add(targetPoints);

    const selectedMarker = new THREE.Mesh(new THREE.SphereGeometry(0.085, 28, 28), new THREE.MeshBasicMaterial({ color: '#9ff6e5' }));
    root.add(selectedMarker);

    const selectedOrbit = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: '#9ff6e5', transparent: true, opacity: 0.82 }),
    );
    root.add(selectedOrbit);

    const warningLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: '#ff667e', transparent: true, opacity: 0.86 }),
    );
    root.add(warningLine);

    const encounterGroup = new THREE.Group();
    encounterGroup.position.set(0.82, 0.62, 0.96);
    encounterGroup.visible = false;
    root.add(encounterGroup);

    const encounterFrame = new THREE.Group();
    encounterGroup.add(encounterFrame);
    const encounterPathA = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.32, -0.18, -0.1),
        new THREE.Vector3(-0.64, -0.08, -0.03),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.68, 0.08, 0.03),
        new THREE.Vector3(1.36, 0.18, 0.1),
      ]),
      new THREE.LineBasicMaterial({ color: '#9ff6e5', transparent: true, opacity: 0.78 }),
    );
    const encounterPathB = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.1, 0.66, 0.34),
        new THREE.Vector3(-0.48, 0.28, 0.14),
        new THREE.Vector3(0.09, 0.1, 0.03),
        new THREE.Vector3(0.58, -0.18, -0.14),
        new THREE.Vector3(1.18, -0.58, -0.34),
      ]),
      new THREE.LineBasicMaterial({ color: '#ff8a64', transparent: true, opacity: 0.76 }),
    );
    encounterFrame.add(encounterPathA, encounterPathB);
    const encounterPrimary = new THREE.Mesh(new THREE.SphereGeometry(0.065, 28, 28), new THREE.MeshBasicMaterial({ color: '#9ff6e5' }));
    const encounterSecondary = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), new THREE.MeshBasicMaterial({ color: '#ff8a64' }));
    encounterFrame.add(encounterPrimary, encounterSecondary);
    const missVectorLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 }),
    );
    encounterFrame.add(missVectorLine);
    const riskEllipsoid = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 48, 24),
      new THREE.MeshBasicMaterial({ color: '#ff667e', transparent: true, opacity: 0.12, wireframe: true }),
    );
    riskEllipsoid.scale.set(1.5, 0.72, 0.48);
    encounterFrame.add(riskEllipsoid);
    const tcaRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.008, 12, 96),
      new THREE.MeshBasicMaterial({ color: '#ff667e', transparent: true, opacity: 0.78 }),
    );
    tcaRing.rotation.x = Math.PI / 2;
    encounterFrame.add(tcaRing);
    const avoidanceArrow = new THREE.ArrowHelper(new THREE.Vector3(-0.42, 0.62, 0.24).normalize(), new THREE.Vector3(0.1, 0.08, 0.02), 0.72, 0x8ef0a2, 0.14, 0.06);
    encounterFrame.add(avoidanceArrow);
    const encounterTitle = createTextSprite('碰撞预警：局部交会几何', '#edf7f5');
    encounterTitle.position.set(0, 0.98, 0);
    encounterTitle.scale.set(1.35, 0.28, 1);
    encounterGroup.add(encounterTitle);
    const encounterStatus = createTextSprite('传播轨道并搜索最近接近', '#ff8a9b');
    encounterStatus.position.set(0, -0.86, 0);
    encounterStatus.scale.set(1.45, 0.29, 1);
    encounterGroup.add(encounterStatus);
    const primaryLabel = createTextSprite('主目标', '#9ff6e5');
    primaryLabel.scale.set(0.54, 0.14, 1);
    encounterFrame.add(primaryLabel);
    const secondaryLabel = createTextSprite('伴随目标', '#ff8a64');
    secondaryLabel.scale.set(0.62, 0.15, 1);
    encounterFrame.add(secondaryLabel);

    const attitudeGroup = new THREE.Group();
    attitudeGroup.position.set(0.95, 0.42, 0.92);
    attitudeGroup.visible = false;
    root.add(attitudeGroup);

    const attitudeModel = new THREE.Group();
    attitudeGroup.add(attitudeModel);
    const attitudeAxes = new THREE.Group();
    attitudeGroup.add(attitudeAxes);

    const axisX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.82, 0xff667e, 0.16, 0.07);
    const axisY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.72, 0x8ef0a2, 0.14, 0.06);
    const axisZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.72, 0x7db6ff, 0.14, 0.06);
    attitudeAxes.add(axisX, axisY, axisZ);
    const axisXLabel = createTextSprite('+X 滚转轴', '#ff8a9b');
    axisXLabel.position.set(0.98, 0.02, 0);
    const axisYLabel = createTextSprite('+Y 俯仰轴', '#8ef0a2');
    axisYLabel.position.set(0, 0.88, 0);
    const axisZLabel = createTextSprite('+Z 天线视轴', '#7db6ff');
    axisZLabel.position.set(0, 0.02, 0.9);
    attitudeAxes.add(axisXLabel, axisYLabel, axisZLabel);

    const sunDirection = new THREE.Vector3(1.4, 0.68, 0.58).normalize();
    const sunArrow = new THREE.ArrowHelper(sunDirection, new THREE.Vector3(), 1.28, 0xffc46b, 0.18, 0.08);
    attitudeGroup.add(sunArrow);
    const sunLabel = createTextSprite('太阳方向', '#ffc46b');
    sunLabel.position.copy(sunDirection.clone().multiplyScalar(1.52));
    attitudeGroup.add(sunLabel);

    const earthArrow = new THREE.ArrowHelper(new THREE.Vector3(-1, -0.32, -0.34).normalize(), new THREE.Vector3(), 1.16, 0x7db6ff, 0.17, 0.07);
    attitudeGroup.add(earthArrow);
    const earthLabel = createTextSprite('对地方向/地心矢量', '#7db6ff');
    earthLabel.position.set(-1.24, -0.44, -0.38);
    attitudeGroup.add(earthLabel);

    const antennaCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.95, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: '#7db6ff', transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    antennaCone.rotation.x = Math.PI / 2;
    antennaCone.position.z = 0.58;
    attitudeAxes.add(antennaCone);

    const attitudeStageLabel = createTextSprite('姿态仿真：对日定向 → 姿态机动 → 对地定向', '#edf7f5');
    attitudeStageLabel.position.set(0, -0.95, 0);
    attitudeStageLabel.scale.set(1.7, 0.34, 1);
    attitudeGroup.add(attitudeStageLabel);
    const attitudeSunQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.34, -0.56, -0.12));
    const attitudeEarthQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.68, 0.22, 0.82));
    const attitudeInitialQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0.16, 0));
    let loadedAttitudeSeq = null;
    const gltfLoader = new GLTFLoader();
    const loadAttitudeModel = (target) => {
      loadedAttitudeSeq = target.seq;
      attitudeModel.clear();
      const fallbackModel = buildTargetModel(target);
      fallbackModel.scale.setScalar(0.66);
      attitudeModel.add(fallbackModel);
      const asset = modelAssetForTarget(target);
      if (!asset) return;
      gltfLoader.load(
        assetPath(asset.url),
        (gltf) => {
          if (loadedAttitudeSeq !== target.seq) return;
          attitudeModel.clear();
          const loadedModel = gltf.scene;
          fitModelToPreview(loadedModel, 1.05);
          attitudeModel.add(loadedModel);
        },
        undefined,
        () => {},
      );
    };
    const encounterPrimaryPath = [
      new THREE.Vector3(-1.32, -0.18, -0.1),
      new THREE.Vector3(-0.64, -0.08, -0.03),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.68, 0.08, 0.03),
      new THREE.Vector3(1.36, 0.18, 0.1),
    ];
    const encounterSecondaryPath = [
      new THREE.Vector3(-1.1, 0.66, 0.34),
      new THREE.Vector3(-0.48, 0.28, 0.14),
      new THREE.Vector3(0.09, 0.1, 0.03),
      new THREE.Vector3(0.58, -0.18, -0.14),
      new THREE.Vector3(1.18, -0.58, -0.34),
    ];
    const samplePath = (path, progress) => {
      const clamped = THREE.MathUtils.clamp(progress, 0, 1);
      const scaled = clamped * (path.length - 1);
      const index = Math.min(path.length - 2, Math.floor(scaled));
      return path[index].clone().lerp(path[index + 1], scaled - index);
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let zoom = 6.1;
    let lastSelected = null;
    const defaultRootPosition = new THREE.Vector3(-0.1, 0.32, 0);
    const focusAnchor = new THREE.Vector3(0, 0.34, 0);
    const rotatedFocus = new THREE.Vector3();
    const desiredRootPosition = new THREE.Vector3();
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.075;

    const onPointerDown = (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      root.rotation.y += (event.clientX - lastX) * 0.006;
      root.rotation.x += (event.clientY - lastY) * 0.004;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onWheel = (event) => {
      zoom = THREE.MathUtils.clamp(zoom + event.deltaY * 0.006, 4.4, 12.2);
      camera.position.z = zoom;
    };
    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(targetPoints)[0];
      if (hit?.index != null) onSelect(targets[hit.index].seq);
    };
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    renderer.domElement.addEventListener('click', onClick);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    let frame = 0;
    let lastTime = 0;
    let elapsed = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = window.performance.now() * 0.001;
      const delta = lastTime ? now - lastTime : 0;
      lastTime = now;
      const {
        activeModule: mode,
        speed: simSpeed,
        paused: isPaused,
        selectedSeq: focusSeq,
        isolateCategory: isolated,
        showOrbit: orbitVisible,
        followTarget: follow,
      } = stateRef.current;
      if (!isPaused) elapsed += delta;

      earth.rotation.y += isPaused ? 0 : delta * 0.012;
      clouds.rotation.y += isPaused ? 0 : delta * 0.018;
      root.rotation.y += isPaused ? 0 : delta * 0.0015;

      targets.forEach((target, index) => {
        const point = targetPosition(target, elapsed, simSpeed);
        positions[index * 3] = point.x;
        positions[index * 3 + 1] = point.y;
        positions[index * 3 + 2] = point.z;
        if (target.seq === focusSeq) selectedMarker.position.copy(point);
        const dim = isolated && target.category !== isolated && target.seq !== focusSeq;
        const boost = target.seq === focusSeq ? 1.35 : 1;
        colors[index * 3] = baseColors[index * 3] * (dim ? 0.22 : boost);
        colors[index * 3 + 1] = baseColors[index * 3 + 1] * (dim ? 0.22 : boost);
        colors[index * 3 + 2] = baseColors[index * 3 + 2] * (dim ? 0.22 : boost);
      });
      targetGeometry.attributes.position.needsUpdate = true;
      targetGeometry.attributes.color.needsUpdate = true;

      const selected = targets.find((target) => target.seq === focusSeq) || targets[0];
      if (lastSelected !== selected.seq) {
        selectedOrbit.geometry.dispose();
        selectedOrbit.geometry = new THREE.BufferGeometry().setFromPoints(orbitPoints(selected));
        selectedOrbit.material.color.set(selected.color);
        selectedMarker.material.color.set(selected.color);
        loadAttitudeModel(selected);
        lastSelected = selected.seq;
      }
      targetPoints.material.size = mode === 'debris' ? 0.056 : 0.043;
      selectedOrbit.visible = orbitVisible && mode !== 'attitude';
      targetPoints.visible = mode !== 'attitude';
      selectedMarker.visible = mode !== 'attitude';
      attitudeGroup.visible = mode === 'attitude';
      encounterGroup.visible = mode === 'warning';
      selectedMarker.scale.setScalar(follow ? 1.55 + Math.sin(now * 4) * 0.16 : 1.18);
      if (mode === 'attitude') {
        const attitudeCycle = ((elapsed * Math.max(simSpeed, 0.1)) % 24) / 24;
        let targetQuaternion = attitudeInitialQuaternion;
        if (attitudeCycle > 0.2 && attitudeCycle <= 0.5) targetQuaternion = attitudeSunQuaternion;
        if (attitudeCycle > 0.5 && attitudeCycle <= 0.72) {
          targetQuaternion = attitudeSunQuaternion.clone().slerp(attitudeEarthQuaternion, (attitudeCycle - 0.5) / 0.22);
        }
        if (attitudeCycle > 0.72) targetQuaternion = attitudeEarthQuaternion;
        applyQuaternionToObject(attitudeAxes, targetQuaternion, isPaused ? 0.03 : 0.075);
        applyQuaternionToObject(attitudeModel, targetQuaternion, isPaused ? 0.03 : 0.075);
        const earthDirection = earth.getWorldPosition(new THREE.Vector3()).sub(attitudeGroup.getWorldPosition(new THREE.Vector3())).normalize();
        const earthDirectionLocal = earthDirection.clone().transformDirection(attitudeGroup.matrixWorld.clone().invert());
        earthArrow.setDirection(earthDirectionLocal);
        const phaseLabel = attitudeCycle <= 0.2 ? '姿态建立' : attitudeCycle <= 0.5 ? '对日定向：太阳翼法线跟踪太阳' : attitudeCycle <= 0.72 ? '姿态机动：从对日转向对地' : '对地定向：天线视轴指向地心';
        if (attitudeStageLabel.userData.currentText !== phaseLabel) {
          attitudeStageLabel.userData.currentText = phaseLabel;
          attitudeStageLabel.userData.setText(phaseLabel);
        }
        root.position.lerp(new THREE.Vector3(-1.18, 0.26, 0), 0.08);
        camera.position.z += (5.15 - camera.position.z) * 0.04;
        camera.position.y += (0.42 - camera.position.y) * 0.04;
      } else if (mode === 'warning') {
        const progress = ((elapsed * Math.max(simSpeed, 0.08) * 0.075) % 1);
        const tcaWeight = 1 - Math.min(1, Math.abs(progress - 0.5) / 0.5);
        const primaryLocal = samplePath(encounterPrimaryPath, progress);
        const secondaryLocal = samplePath(encounterSecondaryPath, progress);
        encounterPrimary.position.copy(primaryLocal);
        encounterSecondary.position.copy(secondaryLocal);
        primaryLabel.position.copy(primaryLocal).add(new THREE.Vector3(0, 0.2, 0));
        secondaryLabel.position.copy(secondaryLocal).add(new THREE.Vector3(0, 0.22, 0));
        missVectorLine.geometry.setFromPoints([primaryLocal, secondaryLocal]);
        const missDistance = primaryLocal.distanceTo(secondaryLocal);
        const riskPulse = 0.88 + Math.sin(now * 5.5) * 0.08;
        riskEllipsoid.scale.set(1.5 * riskPulse, 0.72 * riskPulse, 0.48 * riskPulse);
        riskEllipsoid.material.opacity = 0.06 + tcaWeight * 0.2;
        tcaRing.scale.setScalar(1 + tcaWeight * 0.36);
        tcaRing.material.opacity = 0.38 + tcaWeight * 0.5;
        const statusLabel = progress < 0.34
          ? '轨道传播：筛选潜在交会'
          : progress < 0.49
            ? '接近 TCA：风险快速升高'
            : progress < 0.56
              ? `TCA 最近距离 ${conjunctions[0].distance.toFixed(2)} km · Pc ${conjunctions[0].pc}`
              : missDistance < 0.46
                ? '规避建议：沿法向施加微小脉冲'
                : '脱离风险包络：继续监测';
        if (encounterStatus.userData.currentText !== statusLabel) {
          encounterStatus.userData.currentText = statusLabel;
          encounterStatus.userData.setText(statusLabel);
        }
        encounterFrame.rotation.y += isPaused ? 0 : delta * 0.06;
        root.position.lerp(new THREE.Vector3(-1.05, 0.22, 0), 0.08);
        camera.position.z += (5.65 - camera.position.z) * 0.04;
        camera.position.y += (0.42 - camera.position.y) * 0.04;
      } else if (follow) {
        rotatedFocus.copy(selectedMarker.position).applyQuaternion(root.quaternion);
        desiredRootPosition.copy(focusAnchor).sub(rotatedFocus);
        root.position.lerp(desiredRootPosition, 0.16);
        camera.position.z += (5.35 - camera.position.z) * 0.05;
        camera.position.y += (0.34 - camera.position.y) * 0.05;
      } else {
        root.position.lerp(defaultRootPosition, 0.08);
        camera.position.z += (zoom - camera.position.z) * 0.035;
        camera.position.y += (0.34 - camera.position.y) * 0.035;
      }

      const primary = targets.find((target) => target.seq === conjunctions[0].primarySeq);
      const secondary = targets.find((target) => target.seq === conjunctions[0].secondarySeq);
      warningLine.visible = mode === 'warning';
      if (primary && secondary) {
        warningLine.geometry.setFromPoints([targetPosition(primary, elapsed, simSpeed), targetPosition(secondary, elapsed, simSpeed)]);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('click', onClick);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [resetKey, onSelect]);

  return <div ref={mountRef} className="scene" />;
}

function targetText(target) {
  return `${target.name} ${target.type} ${target.orbit}`.toLowerCase();
}

function addMesh(group, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
}

function addCylinder(group, material, radius, depth, position, rotation = [0, 0, 0], segments = 32) {
  return addMesh(group, new THREE.CylinderGeometry(radius, radius, depth, segments), material, position, rotation);
}

function addSolarWing(group, material, side, width = 0.72, height = 0.24, count = 2, y = 0, z = 0) {
  const wing = new THREE.Group();
  for (let i = 0; i < count; i += 1) {
    const panel = addMesh(wing, new THREE.BoxGeometry(width, 0.018, height), material, [side * (0.28 + i * (width + 0.045)), y, z]);
    panel.rotation.z = side * 0.03;
    const frame = addMesh(wing, new THREE.BoxGeometry(width + 0.035, 0.01, 0.012), material, panel.position.toArray(), [0, 0, side * 0.03]);
    frame.position.z += height * 0.52;
  }
  group.add(wing);
  return wing;
}

function addDish(group, material, position, scale = 1, rotation = [Math.PI, 0, 0]) {
  const dish = addMesh(
    group,
    new THREE.SphereGeometry(0.18 * scale, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    material,
    position,
    rotation,
  );
  addCylinder(group, material, 0.018 * scale, 0.18 * scale, [position[0], position[1], position[2] - 0.09 * scale], [Math.PI / 2, 0, 0], 12);
  return dish;
}

function addAntenna(group, material, position, length = 0.42, angle = 0) {
  const mast = addCylinder(group, material, 0.01, length, position, [Math.PI / 2, angle, 0], 8);
  mast.position.z += Math.cos(angle) * length * 0.5;
  mast.position.x += Math.sin(angle) * length * 0.5;
  return mast;
}

function buildTargetModel(target) {
  const group = new THREE.Group();
  const text = targetText(target);
  const has = (...words) => words.some((word) => text.includes(word.toLowerCase()));
  const variant = Number(target.id || target.seq) % 5;
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#dce6e4', metalness: 0.55, roughness: 0.28 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f4f7f1', metalness: 0.28, roughness: 0.38 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#15212b', metalness: 0.42, roughness: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#caa14f', metalness: 0.35, roughness: 0.42 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: '#22272b', metalness: 0.75, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#87d8ff', emissive: '#1b7fb4', emissiveIntensity: 0.12, metalness: 0.1, roughness: 0.18 });
  const panelMat = new THREE.MeshStandardMaterial({ color: target.color, emissive: target.color, emissiveIntensity: 0.16, metalness: 0.16, roughness: 0.34 });

  if (target.category === 'station' && has('iss', '国际空间站')) {
    addCylinder(group, bodyMat, 0.08, 1.18, [0, 0, 0], [0, 0, Math.PI / 2], 24);
    addCylinder(group, darkMat, 0.018, 2.35, [0, 0, 0], [0, 0, Math.PI / 2], 10);
    [-0.42, -0.16, 0.12, 0.39].forEach((x, index) => {
      addCylinder(group, index % 2 ? whiteMat : bodyMat, 0.12, 0.24, [x, 0.08 * (index % 2 ? 1 : -1), 0], [Math.PI / 2, 0, 0], 28);
    });
    [-1, 1].forEach((side) => {
      [-0.62, 0.62].forEach((x) => addMesh(group, new THREE.BoxGeometry(0.36, 0.02, 0.48), panelMat, [x, side * 0.58, 0], [0, 0, side * 0.08]));
      addCylinder(group, darkMat, 0.012, 1.16, [0, side * 0.58, 0], [0, 0, Math.PI / 2], 8);
    });
  } else if (target.category === 'station') {
    addCylinder(group, whiteMat, 0.12, 0.96, [0, 0, 0], [0, 0, Math.PI / 2], 32);
    addCylinder(group, bodyMat, 0.1, 0.62, [-0.34, 0.22, 0], [Math.PI / 2, 0, 0.18], 32);
    addCylinder(group, bodyMat, 0.1, 0.62, [0.34, 0.22, 0], [Math.PI / 2, 0, -0.18], 32);
    addCylinder(group, darkMat, 0.016, 1.08, [0, 0, 0], [0, 0, Math.PI / 2], 10);
    [-1, 1].forEach((side) => addSolarWing(group, panelMat, side, 0.56, 0.22, 2, -0.18, 0));
    addDish(group, glassMat, [0.05, -0.16, 0.2], 0.72);
  } else if (target.category === 'capsule') {
    const shenzhouLike = has('神舟', 'soyuz', '联盟');
    const cargoLike = has('天舟', 'progress', 'cygnus', '货运');
    addMesh(group, new THREE.ConeGeometry(0.2, 0.34, 32), whiteMat, [0, 0.28, 0], [Math.PI, 0, 0]);
    addCylinder(group, bodyMat, shenzhouLike ? 0.2 : 0.23, cargoLike ? 0.64 : 0.42, [0, -0.1, 0], [0, 0, 0], 32);
    addCylinder(group, darkMat, 0.19, 0.1, [0, -0.47, 0], [0, 0, 0], 32);
    addMesh(group, new THREE.TorusGeometry(0.19, 0.012, 8, 32), darkMat, [0, 0.09, 0], [Math.PI / 2, 0, 0]);
    if (cargoLike || shenzhouLike) [-1, 1].forEach((side) => addSolarWing(group, panelMat, side, 0.48, 0.19, cargoLike ? 2 : 1, -0.12, 0));
    addAntenna(group, glassMat, [0, 0.2, 0.08], 0.28, 0.15);
  } else if (target.category === 'rocket') {
    addCylinder(group, bodyMat, 0.16, 1.22, [0, 0, 0], [0.08, 0, variant * 0.12], 36);
    addMesh(group, new THREE.ConeGeometry(0.16, 0.22, 36), whiteMat, [0, 0.72, 0], [0.08, 0, variant * 0.12]);
    addMesh(group, new THREE.CylinderGeometry(0.12, 0.19, 0.16, 32), nozzleMat, [0, -0.72, 0], [0.08, 0, variant * 0.12]);
    [-0.18, 0.18].forEach((x) => addMesh(group, new THREE.BoxGeometry(0.05, 0.34, 0.16), darkMat, [x, -0.2, 0], [0.08, 0, variant * 0.12]));
    addMesh(group, new THREE.TorusGeometry(0.16, 0.008, 8, 32), goldMat, [0, 0.2, 0], [Math.PI / 2, 0, 0]);
  } else if (target.category === 'debris') {
    for (let i = 0; i < 9; i += 1) {
      const size = 0.07 + ((i + variant) % 4) * 0.025;
      const geometry = i % 3 === 0 ? new THREE.TetrahedronGeometry(size) : new THREE.BoxGeometry(size * 1.5, size * 0.35, size);
      const shard = addMesh(group, geometry, i % 2 ? goldMat : darkMat, [Math.sin(i * 1.4) * 0.34, Math.cos(i * 1.9) * 0.25, Math.sin(i * 2.2) * 0.22]);
      shard.rotation.set(i * 0.7, i * 0.45, i * 0.22);
    }
  } else if (target.category === 'constellation' || has('starlink', 'oneweb', '星座')) {
    addMesh(group, new THREE.BoxGeometry(0.52, 0.08, 0.28), darkMat, [0, 0, 0]);
    addMesh(group, new THREE.BoxGeometry(0.86, 0.018, 0.3), panelMat, [0.68, 0, 0], [0, 0, 0.04]);
    addMesh(group, new THREE.BoxGeometry(0.08, 0.03, 0.26), bodyMat, [-0.32, 0, 0]);
    addAntenna(group, glassMat, [-0.22, 0.02, 0.08], 0.26, -0.25);
  } else if (has('北斗', 'gps', 'galileo', 'glonass', '导航')) {
    addMesh(group, new THREE.BoxGeometry(0.36, 0.34, 0.3), whiteMat, [0, 0, 0]);
    [-1, 1].forEach((side) => addSolarWing(group, panelMat, side, 0.42, 0.22, 2, 0, 0));
    addCylinder(group, goldMat, 0.06, 0.36, [0, 0.32, 0], [0, 0, 0], 20);
    addDish(group, glassMat, [0, 0.46, 0], 0.55, [0, 0, 0]);
    addAntenna(group, darkMat, [0, -0.18, 0.08], 0.34, 0.3);
  } else if (has('通信', 'comsat', 'intelsat', 'eutelsat', 'ses', 'geo')) {
    addMesh(group, new THREE.BoxGeometry(0.42, 0.46, 0.34), bodyMat, [0, 0, 0]);
    [-1, 1].forEach((side) => addSolarWing(group, panelMat, side, 0.58, 0.28, 2, 0, 0));
    addDish(group, goldMat, [0, 0.03, 0.32], 1.05);
    addDish(group, glassMat, [-0.18, -0.18, 0.24], 0.48);
  } else if (has('遥感', '资源', '高分', 'landsat', 'sentinel', 'spot', 'worldview', '观测', '气象', 'noaa', 'meteor')) {
    addMesh(group, new THREE.BoxGeometry(0.34, 0.52, 0.34), whiteMat, [0, 0, 0]);
    addCylinder(group, darkMat, 0.13, 0.22, [0, 0, 0.29], [Math.PI / 2, 0, 0], 28);
    addMesh(group, new THREE.CircleGeometry(0.12, 32), glassMat, [0, 0, 0.41], [0, 0, 0]);
    addSolarWing(group, panelMat, variant % 2 ? -1 : 1, 0.7, 0.26, 2, -0.04, 0);
    addCylinder(group, goldMat, 0.045, 0.32, [0.17, -0.34, 0], [0.3, 0, 0], 20);
  } else if (has('科学', '望远镜', 'hubble', 'xmm', 'chandra', '天文')) {
    addCylinder(group, whiteMat, 0.17, 0.72, [0, 0, 0], [0, 0, Math.PI / 2], 36);
    addCylinder(group, darkMat, 0.18, 0.12, [0.42, 0, 0], [0, 0, Math.PI / 2], 36);
    [-1, 1].forEach((side) => addSolarWing(group, panelMat, side, 0.38, 0.18, 2, 0.24, 0));
    addAntenna(group, glassMat, [-0.18, -0.12, 0.08], 0.34, -0.2);
  } else {
    addMesh(group, new THREE.BoxGeometry(0.38, 0.32, 0.28), bodyMat, [0, 0, 0]);
    [-1, 1].forEach((side) => addSolarWing(group, panelMat, side, 0.5 + variant * 0.03, 0.2, variant > 2 ? 2 : 1, 0, 0));
    addDish(group, darkMat, [0, 0.02, 0.27], 0.82);
    addAntenna(group, glassMat, [-0.12, 0.16, 0.08], 0.32, 0.1);
  }

  group.rotation.z = (variant - 2) * 0.035;
  return group;
}

function modelAssetForTarget(target) {
  const text = targetText(target);
  const name = target.name.toLowerCase();
  const has = (...words) => words.some((word) => text.includes(word.toLowerCase()));
  const nameHas = (...words) => words.some((word) => name.includes(word.toLowerCase()));
  const hasIssName = /(^|[^a-z])iss([^a-z]|$)/i.test(target.name);
  const variant = Number(target.id || target.seq) % 2;

  if (nameHas('中国空间站', 'css', '天和', '问天', '梦天', 'tiangong')) {
    return { url: '/models/ISS/ISS_B.glb', label: '空间站真实模型' };
  }
  if (hasIssName) return { url: variant ? '/models/ISS/ISS_A.glb' : '/models/ISS/ISS_B.glb', label: 'ISS 真实模型' };
  if (nameHas('gateway')) return { url: '/models/GATEWAY/Gateway_Core.glb', label: 'Gateway 真实模型' };
  if (nameHas('hubble space telescope') || name === 'hubble') return { url: variant ? '/models/HUBBLE/Hubble_A.glb' : '/models/HUBBLE/Hubble_B.glb', label: 'Hubble 真实模型' };
  if (nameHas('chandra')) return { url: '/models/CHANDRA/Chandra.glb', label: 'Chandra 真实模型' };
  if (nameHas('swift')) return { url: '/models/SWIFT/Swift.glb', label: 'Swift 真实模型' };
  if (nameHas('tess')) return { url: variant ? '/models/TESS/TESS_A.glb' : '/models/TESS/TESS_B.glb', label: 'TESS 真实模型' };
  if (nameHas('tdrs')) return { url: `/models/TDRS/TDRS_${['A', 'B', 'C', 'D'][Number(target.id || target.seq) % 4]}.glb`, label: 'TDRS 真实模型' };
  if (nameHas('landsat')) return { url: nameHas('landsat 8', 'landsat 9') ? '/models/LANDSAT/Landsat_4-5.glb' : '/models/LANDSAT/Landsat_1-3.glb', label: 'Landsat 真实模型' };
  if (nameHas('noaa', 'suomi')) return { url: '/models/NOAA/Suomi_NPP.glb', label: 'NOAA/Suomi 真实模型' };
  if (nameHas('glonass')) return { url: '/models/GLONASS/GLONASS-M.glb', label: 'GLONASS 真实模型' };
  if (nameHas('lro')) return { url: variant ? '/models/LRO/LRO_A.glb' : '/models/LRO/LRO_B.glb', label: 'LRO 真实模型' };
  if (nameHas('maven')) return { url: variant ? '/models/MAVEN/MAVEN_A.glb' : '/models/MAVEN/MAVEN_B.glb', label: 'MAVEN 真实模型' };
  if (nameHas('mro', 'mars reconnaissance')) return { url: `/models/MRO/MRO_${['A', 'B', 'C'][Number(target.id || target.seq) % 3]}.glb`, label: 'MRO 真实模型' };
  if (nameHas('osiris')) return { url: '/models/OSIRIS/OSIRIS-REx.glb', label: 'OSIRIS-REx 真实模型' };
  if (nameHas('trmm')) return { url: '/models/TRMM/TRMM.glb', label: 'TRMM 真实模型' };
  if (nameHas('神舟', 'shenzhou')) return { url: '/models/中国航天器/shenzhou_v.glb', label: '神舟真实模型' };
  if (nameHas('天舟', 'tianzhou')) return { url: '/models/中国航天器/tianzhou-2_cargo_ship.glb', label: '天舟真实模型' };
  if (nameHas('长征二号', 'cz-2f')) return { url: '/models/中国航天器/cz-2f.glb', label: '长征二号F真实模型' };
  if (nameHas('长征五号', 'long march 5', 'cz-5')) return { url: '/models/中国航天器/long_march_5_rocket.glb', label: '长征五号真实模型' };
  if (nameHas('玉兔', 'yutu')) return { url: '/models/中国航天器/yutu.glb', label: '玉兔真实模型' };
  if (target.category === 'rocket') return { url: '/models/agena.glb', label: 'NASA Agena 真实模型' };
  if (has('acrimsat')) return { url: '/models/acrimsat.glb', label: 'NASA ACRIMSAT 真实模型' };
  if (has('aim', 'aeronomy of ice')) return { url: '/models/aim.glb', label: 'NASA AIM 真实模型' };
  if (has('ace', 'advanced composition')) return { url: '/models/ace.glb', label: 'NASA ACE 真实模型' };
  if (has('atlast', '望远镜', 'telescope', '天文')) return { url: '/models/atlast.glb', label: 'NASA ATLAST 真实模型' };
  if (has('70-meter', '70 meter', '深空网', '天线')) return { url: '/models/dsn-dish.glb', label: 'NASA 70m 天线真实模型' };

  if (has('北斗', 'gps', 'galileo', '导航')) {
    return { url: '/models/GLONASS/GLONASS-M.glb', label: '导航卫星真实模型' };
  }
  if (target.category === 'satellite' && has('科学', '探测', '试验')) {
    return variant ? { url: '/models/ace.glb', label: 'NASA ACE 真实模型' } : { url: '/models/aim.glb', label: 'NASA AIM 真实模型' };
  }
  if (target.category === 'satellite' && has('遥感', '观测', '气象', '资源', '高分')) {
    return variant ? { url: '/models/LANDSAT/Landsat_4-5.glb', label: 'Landsat 真实模型' } : { url: '/models/NOAA/Suomi_NPP.glb', label: 'NOAA/Suomi 真实模型' };
  }
  if (target.category === 'station') {
    return { url: variant ? '/models/ISS/ISS_A.glb' : '/models/ISS/ISS_B.glb', label: '空间站真实模型' };
  }
  return null;
}

function fitModelToPreview(model, targetSize = 1.48) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  model.position.sub(center);
  model.scale.multiplyScalar(targetSize / maxAxis);
  model.rotation.y = -0.42;
  model.rotation.x = 0.12;
}

function TargetModelPreview({ target, interactive = false, onOpen }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    camera.position.set(0, 0.2, interactive ? 4.1 : 3.2);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(2, 2, 3);
    scene.add(light);
    const rimLight = new THREE.DirectionalLight(0x9ff6e5, interactive ? 1.8 : 0.9);
    rimLight.position.set(-2.4, 0.8, -1.4);
    scene.add(rimLight);

    const controls = interactive ? new OrbitControls(camera, renderer.domElement) : null;
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.minDistance = 1.35;
      controls.maxDistance = 9;
      controls.target.set(0, 0, 0);
      controls.update();
    }

    const asset = modelAssetForTarget(target);
    const fallback = buildTargetModel(target);
    const model = new THREE.Group();
    model.add(fallback);
    scene.add(model);
    if (asset) {
      const loader = new GLTFLoader();
      loader.load(
        assetPath(asset.url),
        (gltf) => {
          model.clear();
          const loadedModel = gltf.scene;
          fitModelToPreview(loadedModel, interactive ? 2.55 : 1.9);
          model.add(loadedModel);
        },
        undefined,
        () => {
          model.clear();
          model.add(buildTargetModel(target));
        },
      );
    }
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (controls) {
        controls.update();
      } else {
        model.rotation.y += 0.01;
        model.rotation.x = Math.sin(window.performance.now() * 0.001) * 0.12;
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      controls?.dispose();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [target.seq, interactive]);

  return (
    <div
      ref={mountRef}
      className={`model-canvas ${interactive ? 'model-canvas-large' : 'model-canvas-clickable'}`}
      onClick={interactive ? undefined : onOpen}
      role={interactive || !onOpen ? undefined : 'button'}
      tabIndex={interactive || !onOpen ? undefined : 0}
      onKeyDown={(event) => {
        if (!interactive && onOpen && (event.key === 'Enter' || event.key === ' ')) onOpen();
      }}
      title={interactive ? undefined : '放大查看模型'}
    >
      {!interactive && onOpen && (
        <span className="model-expand-indicator">
          <Maximize2 size={14} />
        </span>
      )}
    </div>
  );
}

function App() {
  const [activeModule, setActiveModule] = useState('orbit');
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState(1);
  const [query, setQuery] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [modal, setModal] = useState(null);
  const [followTarget, setFollowTarget] = useState(false);
  const [isolateCategory, setIsolateCategory] = useState(null);
  const [showOrbit, setShowOrbit] = useState(true);
  const [showTargetCard, setShowTargetCard] = useState(true);
  const [rightPanelPinned, setRightPanelPinned] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [epoch] = useState(() => new Date(Date.UTC(2026, 5, 25, 8, 0, 0)));
  const [elapsedHours, setElapsedHours] = useState(0);
  const selected = targets.find((target) => target.seq === selectedSeq) || targets[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!paused) setElapsedHours((value) => value + speed / 3600);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, speed]);

  const simTime = useMemo(() => new Date(epoch.getTime() + elapsedHours * 3600000), [epoch, elapsedHours]);
  const stats = useMemo(() => {
    const official = targets.filter((target) => target.official).length;
    const debris = targets.filter((target) => target.category === 'debris' || target.category === 'rocket').length;
    const leo = targets.filter((target) => String(target.orbit).includes('LEO') || String(target.orbit).includes('SSO')).length;
    const geo = targets.filter((target) => String(target.orbit).includes('GEO')).length;
    return { official, reserve: targets.length - official, debris, leo, geo };
  }, []);

  const metrics = useMemo(() => {
    const radius = 6378 + selected.alt;
    const velocity = Math.sqrt(398600.4418 / radius);
    return {
      semiMajor: radius.toFixed(1),
      velocity: velocity.toFixed(2),
      period: selected.period.toFixed(1),
      coverage: Math.min(42, Math.max(6, selected.alt / 290)).toFixed(1),
    };
  }, [selected]);

  const catalogTargets = useMemo(() => {
    const text = catalogFilter.trim().toLowerCase();
    return text
      ? targets.filter((target) =>
        String(target.seq).includes(text) ||
        String(target.id).includes(text) ||
        target.name.toLowerCase().includes(text) ||
        target.orbit.toLowerCase().includes(text) ||
        categoryLabels[target.category].includes(text))
      : targets;
  }, [catalogFilter]);

  const runSearch = () => {
    const text = query.trim().toLowerCase();
    const found = targets.find((target) =>
      String(target.seq) === text ||
      String(target.id).includes(text) ||
      target.name.toLowerCase().includes(text) ||
      target.cospar.toLowerCase().includes(text) ||
      target.orbit.toLowerCase().includes(text));
    if (found) setSelectedSeq(found.seq);
  };

  const startScenario = (id) => {
    if (id === 'catalog') {
      setCatalogOpen((value) => !value);
      return;
    }
    setCatalogOpen(false);
    setActiveModule(id);
    if (id === 'warning') setSelectedSeq(conjunctions[0].primarySeq);
    if (id === 'debris') setSelectedSeq(targets.find((target) => target.category === 'debris')?.seq || 1);
    if (id === 'attitude') setSelectedSeq(targets.find((target) => target.category === 'station')?.seq || 1);
  };

  const selectTarget = useCallback((seq) => {
    setSelectedSeq(seq);
    setShowTargetCard(true);
  }, []);

  const focusSelected = () => {
    setFollowTarget(true);
    setShowOrbit(true);
    setResetKey((value) => value + 1);
  };

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <Radar size={25} />
          <div>
            <strong>天巡态势感知仿真软件</strong>
            <em>{targets.length} 教学空间目标 · 轨道 / 姿态 / 碎片 / 预警</em>
          </div>
        </div>
        <div className="time-strip">
          <span>UTC 仿真时刻</span>
          <strong>{simTime.toISOString().replace('T', ' ').slice(0, 19)}</strong>
        </div>
        <div className="status-strip">
          <span>SGP4 方针</span>
          <span>{targets.length} 目标</span>
          <span>x{formatSpeed(speed)}</span>
        </div>
      </header>

      <aside
        className={`side-menu ${catalogOpen ? 'catalog-open' : ''}`}
        aria-label="仿真模块"
        onClick={(event) => {
          const button = event.target.closest('button[data-module]');
          if (button) startScenario(button.dataset.module);
        }}
      >
        {modules.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} data-module={item.id} className={(activeModule === item.id || (item.id === 'catalog' && catalogOpen)) ? 'active' : ''} title={item.name}>
              <Icon size={20} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </aside>

      <aside className={`loaded-targets-panel ${catalogOpen ? 'open' : ''}`} aria-label="当前加载目标列表">
        <div className="loaded-targets-title">
          <span>当前目标列表</span>
          <strong>{catalogTargets.length}/{targets.length}</strong>
        </div>
        <input
          value={catalogFilter}
          onChange={(event) => setCatalogFilter(event.target.value)}
          placeholder="筛选名称 / NORAD / 轨道"
        />
        <div className="loaded-targets-list">
          {catalogTargets.map((target) => (
            <button key={`${target.seq}-${target.id}`} className={target.seq === selectedSeq ? 'active' : ''} onClick={() => selectTarget(target.seq)}>
              <span>{target.seq}</span>
              <strong>{target.name}</strong>
              <em>{target.id} · {target.orbit}</em>
            </button>
          ))}
        </div>
      </aside>

      <section className="stage">
        <SpaceScene
          activeModule={activeModule}
          speed={speed}
          paused={paused}
          selectedSeq={selectedSeq}
          onSelect={selectTarget}
          resetKey={resetKey}
          isolateCategory={isolateCategory}
          showOrbit={showOrbit}
          followTarget={followTarget}
        />

        {!showTargetCard && (
          <div className="orbit-readout">
            <span>当前目标</span>
            <strong>{selected.name}</strong>
            <small>{selected.id} / {selected.cospar} / {selected.orbit} / {selected.altRange} / {categoryLabels[selected.category]}</small>
          </div>
        )}

        <div className="control-pad" aria-label="时间轴控制">
          <span className="live-badge">{paused ? '暂停' : '运行'}</span>
          <button onClick={() => setSpeed((value) => Math.max(0.05, Number((value / 2).toFixed(3))))} title="减慢"><ChevronsDown size={18} /></button>
          <button onClick={() => setPaused(true)} title="暂停"><Pause size={18} /></button>
          <button onClick={() => setPaused(false)} title="运行"><Play size={18} /></button>
          <button onClick={() => setSpeed((value) => Math.min(32, Number((value * 2).toFixed(3))))} title="加速"><ChevronsUp size={18} /></button>
          <button onClick={() => { setElapsedHours(0); setResetKey((value) => value + 1); }} title="重置"><RotateCcw size={18} /></button>
          <input className="timeline" type="range" min="0" max="72" step="1" value={Math.min(72, elapsedHours)} onChange={(event) => setElapsedHours(Number(event.target.value))} />
          <span className="time-label">T+{elapsedHours.toFixed(1)} h</span>
        </div>

        {showTargetCard && (
          <section className="target-card" aria-label="选中目标操作">
            <button className="target-card-close" onClick={() => setShowTargetCard(false)} title="关闭"><X size={15} /></button>
            <div className="target-card-head">
              <span className="target-status">{selected.official ? 'ACTIVE CATALOG' : 'RESERVE'}</span>
              <strong>{selected.name}</strong>
              <small>NORAD {selected.id} · {selected.cospar} · {selected.orbit} · {selected.altRange}</small>
            </div>
            <div className="target-card-actions">
              <button className={followTarget ? 'active' : ''} onClick={() => setFollowTarget((value) => !value)}><Crosshair size={15} />{followTarget ? '取消跟随' : '跟随'}</button>
              <button onClick={focusSelected}><LocateFixed size={15} />聚焦</button>
              <button className={isolateCategory === selected.category ? 'active' : ''} onClick={() => setIsolateCategory((value) => (value === selected.category ? null : selected.category))}><Layers size={15} />同类</button>
              <button className={showOrbit ? 'active' : ''} onClick={() => setShowOrbit((value) => !value)}><Route size={15} />轨道</button>
              <button onClick={() => setModal('targetDetail')}><Info size={15} />详情</button>
            </div>
            <div className="target-card-readouts">
              <span><em>类型</em>{categoryLabels[selected.category]}</span>
              <span><em>优先级</em>{selected.priority}级</span>
              <span><em>周期</em>{selected.period.toFixed(1)} min</span>
              <span><em>风险</em>{selected.risk}</span>
            </div>
          </section>
        )}
      </section>

      <aside className={`right-panel ${rightPanelPinned ? 'pinned' : ''}`}>
        <div className="right-panel-handle" aria-hidden="true">
          <LocateFixed size={16} />
          <span>目标信息</span>
        </div>
        <div className="right-panel-toolbar">
          <span>目标信息</span>
          <button onClick={() => setRightPanelPinned((value) => !value)} title={rightPanelPinned ? '取消固定' : '固定面板'}>
            {rightPanelPinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
        </div>
        <section className="tool-panel search-box">
          <div className="panel-title"><span>目标检索</span><LocateFixed size={16} /></div>
          <div className="search-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runSearch(); }} placeholder="序号、NORAD、名称或轨道" />
            <button onClick={runSearch} title="搜索"><Search size={17} /></button>
          </div>
        </section>

        <section className="tool-panel model-panel">
          <div className="panel-title"><span>选中目标模型</span><span>{categoryLabels[selected.category]}</span></div>
          <TargetModelPreview target={selected} onOpen={() => setModal('modelViewer')} />
          <div className="model-meta">
            <strong>{selected.name}</strong>
            <span>NORAD {selected.id} · {selected.priority}级 · {modelAssetForTarget(selected)?.label || '参数化目标模型'} · {selected.official ? '正式目标' : '备用目标'}</span>
          </div>
        </section>

        {activeModule === 'attitude' && (
          <section className="tool-panel attitude-flow-panel">
            <div className="panel-title"><span>姿态仿真流程</span><Box size={16} /></div>
            <div className="attitude-flow">
              <span><strong>1</strong><em>姿态建立</em></span>
              <span><strong>2</strong><em>对日定向</em></span>
              <span><strong>3</strong><em>姿态机动</em></span>
              <span><strong>4</strong><em>对地定向</em></span>
            </div>
            <p>主视图显示目标本体、机体系三轴、太阳方向、地心矢量和天线视轴。</p>
          </section>
        )}

        {activeModule === 'warning' && (
          <section className="tool-panel conjunction-flow-panel">
            <div className="panel-title"><span>交会预警流程</span><AlertTriangle size={16} /></div>
            <div className="conjunction-summary">
              <span><em>主目标</em><strong>{targets.find((target) => target.seq === conjunctions[0].primarySeq)?.name}</strong></span>
              <span><em>伴随目标</em><strong>{targets.find((target) => target.seq === conjunctions[0].secondarySeq)?.name}</strong></span>
            </div>
            <div className="attitude-flow conjunction-flow">
              <span><strong>1</strong><em>轨道传播</em></span>
              <span><strong>2</strong><em>TCA 搜索</em></span>
              <span><strong>3</strong><em>Pc 风险评估</em></span>
              <span><strong>4</strong><em>规避脉冲</em></span>
            </div>
            <div className="conjunction-telemetry">
              <span><em>最近距离</em><strong>{conjunctions[0].distance} km</strong></span>
              <span><em>相对速度</em><strong>{conjunctions[0].velocity} km/s</strong></span>
              <span><em>碰撞概率</em><strong>{conjunctions[0].pc}</strong></span>
              <span><em>预警等级</em><strong>{conjunctions[0].level}</strong></span>
            </div>
            <p>主视图显示两目标预测轨迹、TCA 附近最近距离线、协方差风险包络和法向规避建议。</p>
          </section>
        )}

        <section className="tool-panel metrics-panel">
          <div className="panel-title"><span>仿真结果</span><Gauge size={16} /></div>
          <MetricGrid items={[['半长轴', `${metrics.semiMajor} km`], ['速度', `${metrics.velocity} km/s`], ['周期', `${metrics.period} min`], ['覆盖角', `${metrics.coverage} deg`]]} />
        </section>

        <section className="tool-panel dataset-panel">
          <div className="panel-title"><span>教学目标库</span><Database size={16} /></div>
          <MetricGrid compact items={[['正式', stats.official], ['备用', stats.reserve], ['低轨/SSO', stats.leo], ['碎片/火箭体', stats.debris]]} />
        </section>

        <section className="tool-panel warning-panel">
          <div className="panel-title"><span>碰撞预警事件</span><AlertTriangle size={16} /></div>
          <div className="warning-list">
            {conjunctions.map((item) => (
              <button key={`${item.primarySeq}-${item.secondarySeq}`} className={item.level === '红色' ? 'hot' : ''} onClick={() => { setActiveModule('warning'); selectTarget(item.primarySeq); }}>
                <strong>{item.level}</strong>
                <span>{targets.find((target) => target.seq === item.primarySeq)?.id} / {targets.find((target) => target.seq === item.secondarySeq)?.id}</span>
                <em>{item.distance} km · {item.tca.slice(5)}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="target-list">
          <div className="panel-title"><span>目标信息库</span><span>{targets.length}</span></div>
          <div className="table-head"><span>序号</span><span>名称</span><span>轨道</span><span>类型</span></div>
          <div className="table-body">
            {targets.map((target) => (
              <button key={target.seq} className={target.seq === selectedSeq ? 'active' : ''} onClick={() => selectTarget(target.seq)}>
                <span>{target.seq}</span><span>{target.name}</span><span>{target.orbit}</span><span>{categoryLabels[target.category]}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className={`modal ${modal === 'modelViewer' ? 'model-viewer-modal' : ''}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <strong>{modalTitle(modal)}</strong>
              <button onClick={() => setModal(null)}>×</button>
            </div>
            {modalContent(modal, setModal, selected)}
          </div>
        </div>
      )}

      <div className="floating-actions">
        <button onClick={() => setModal('database')} title="目标库"><Database size={16} /></button>
        <button onClick={() => setModal('tle')} title="TLE"><FileUp size={16} /></button>
        <button onClick={() => setModal('settings')} title="参数"><Settings size={16} /></button>
      </div>
    </main>
  );
}

function MetricGrid({ items, compact = false }) {
  return (
    <div className={`metric-grid ${compact ? 'compact' : ''}`}>
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function modalTitle(modal) {
  return {
    database: '目标库加载',
    tle: 'TLE 文件加载',
    settings: '仿真参数设置',
    targetDetail: '目标详情',
    modelViewer: '目标模型',
  }[modal];
}

function modalContent(modal, setModal, selected) {
  if (modal === 'tle') {
    return (
      <div className="tle-box">
        <button><FileUp size={17} />选择文件</button>
        <pre>{`CSS / TIANHE
1 48274U 21035A 26175.51736111 .00012237 00000-0 21994-3 0 9993
2 48274 41.4700 32.2001 0004025 275.7183 16.3853 15.50381322448632`}</pre>
      </div>
    );
  }
  if (modal === 'settings') {
    return (
      <div className="form-grid">
        <label>预报时长<input defaultValue="72 h" /></label>
        <label>积分步长<input defaultValue="60 s" /></label>
        <label>目标来源<input defaultValue="教学必备550空间目标清单" /></label>
        <button onClick={() => setModal(null)}>应用参数</button>
      </div>
    );
  }
  if (modal === 'targetDetail') {
    return (
      <div className="detail-grid">
        <span><em>目标名称</em><strong>{selected.name}</strong></span>
        <span><em>NORAD</em><strong>{selected.id}</strong></span>
        <span><em>COSPAR</em><strong>{selected.cospar}</strong></span>
        <span><em>轨道类型</em><strong>{selected.orbit}</strong></span>
        <span><em>高度范围</em><strong>{selected.altRange}</strong></span>
        <span><em>目标类型</em><strong>{selected.type}</strong></span>
        <span><em>优先级</em><strong>{selected.priority}级</strong></span>
        <span><em>清单状态</em><strong>{selected.official ? '正式目标' : '备用目标'}</strong></span>
        <p>{selected.note || '暂无备注。'}</p>
      </div>
    );
  }
  if (modal === 'modelViewer') {
    return (
      <div className="model-viewer-content">
        <TargetModelPreview target={selected} interactive />
        <div className="model-viewer-meta">
          <strong>{selected.name}</strong>
          <span>NORAD {selected.id} · {selected.cospar} · {modelAssetForTarget(selected)?.label || '参数化目标模型'}</span>
        </div>
      </div>
    );
  }
  return <p className="modal-copy">已加载教学必备550空间目标清单。前500个为正式教学目标，后50个为备用目标。</p>;
}

createRoot(document.getElementById('root')).render(<App />);
