import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

const ENVIRONMENT_SUN_DIRECTION = new THREE.Vector3(0.68, 0.82, 0.34).normalize()
const hdriCache = new Map()

export const ENVIRONMENT_PRESETS = [
  {
    id: 'courtyard-sun',
    label: 'Courtyard Sun',
    path: '/assets/hdr/quadrangle_sunny_1k.hdr',
  },
  {
    id: 'clear-morning',
    label: 'Clear Morning',
    path: '/assets/hdr/qwantani_morning_puresky_1k.hdr',
  },
]

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const SKY_FRAGMENT_SHADER = `
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  varying vec3 vWorldPosition;

  void main() {
    vec3 direction = normalize(vWorldPosition);
    float upward = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
    float skyBlend = smoothstep(0.12, 0.98, upward);
    float groundBlend = smoothstep(-0.08, 0.12, direction.y);

    vec3 sky = mix(horizonColor, zenithColor, skyBlend);
    sky = mix(groundColor, sky, groundBlend);

    float sunDot = max(dot(direction, normalize(sunDirection)), 0.0);
    float sunHalo = pow(sunDot, 6.0) * 0.38;
    float sunGlow = pow(sunDot, 72.0) * 1.1;
    vec3 color = sky + sunColor * (sunHalo + sunGlow);

    gl_FragColor = vec4(color, 1.0);
  }
`

function createSkyMaterial(sunDirection = ENVIRONMENT_SUN_DIRECTION) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenithColor: { value: new THREE.Color('#7bb4ff') },
      horizonColor: { value: new THREE.Color('#dff0ff') },
      groundColor: { value: new THREE.Color('#ecedf0') },
      sunColor: { value: new THREE.Color('#fff0c6') },
      sunDirection: { value: sunDirection.clone() },
    },
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
  })
}

function createEnvironmentTexture(renderer, sunDirection = ENVIRONMENT_SUN_DIRECTION) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  pmremGenerator.compileEquirectangularShader()

  const envScene = new THREE.Scene()
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(120, 64, 32), createSkyMaterial(sunDirection))
  envScene.add(skyDome)

  const envMap = pmremGenerator.fromScene(envScene, 0.05).texture

  skyDome.geometry.dispose()
  skyDome.material.dispose()
  pmremGenerator.dispose()

  return envMap
}

function createSkyDome() {
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(180, 64, 32),
    createSkyMaterial(ENVIRONMENT_SUN_DIRECTION),
  )
  skyDome.name = 'environment-sky-dome'
  skyDome.renderOrder = -100
  return skyDome
}

function createShadowCatcher() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320),
    new THREE.ShadowMaterial({
      color: new THREE.Color('#0f172a'),
      opacity: 0.16,
    }),
  )

  ground.name = 'environment-shadow-catcher'
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.04
  ground.receiveShadow = true
  return ground
}

export function setupSceneEnvironment(scene, renderer) {
  const envMap = createEnvironmentTexture(renderer)
  const skyDome = createSkyDome()

  scene.environment = envMap
  scene.add(skyDome)
  scene.userData.environmentMap = envMap

  return envMap
}

function loadHdriTexture(path) {
  if (hdriCache.has(path)) {
    return hdriCache.get(path)
  }

  const loader = new RGBELoader()
  const texturePromise = loader.loadAsync(path)
  hdriCache.set(path, texturePromise)
  return texturePromise
}

export async function applyEnvironmentPreset(scene, renderer, presetId = ENVIRONMENT_PRESETS[0].id) {
  const preset = ENVIRONMENT_PRESETS.find((entry) => entry.id === presetId) ?? ENVIRONMENT_PRESETS[0]

  try {
    const hdrTexture = await loadHdriTexture(preset.path)
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()
    const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture
    pmremGenerator.dispose()

    if (scene.userData.loadedEnvironmentMap?.dispose) {
      scene.userData.loadedEnvironmentMap.dispose()
    }

    if (scene.userData.environmentMap?.dispose && scene.userData.environmentMap !== envMap) {
      scene.userData.environmentMap.dispose()
      scene.userData.environmentMap = null
    }

    scene.environment = envMap
    scene.userData.loadedEnvironmentMap = envMap
    scene.userData.environmentPreset = preset.id
    return envMap
  } catch (error) {
    console.warn('[FloorGPT] Failed to load HDR environment preset.', presetId, error)
    return scene.environment
  }
}

export function setupDefaultLighting(scene, { shadowsEnabled = true } = {}) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.24)

  const hemisphere = new THREE.HemisphereLight(0xcbe5ff, 0xd3c2a4, 0.42)
  hemisphere.position.set(0, 30, 0)

  const sunTarget = new THREE.Object3D()
  sunTarget.name = 'sun-target'

  const fillTarget = new THREE.Object3D()
  fillTarget.name = 'fill-target'

  const rimTarget = new THREE.Object3D()
  rimTarget.name = 'rim-target'

  const sun = new THREE.DirectionalLight(0xfff5dc, 2.08)
  sun.position.set(24, 28, 16)
  sun.target = sunTarget
  sun.castShadow = shadowsEnabled
  sun.shadow.mapSize.set(4096, 4096)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 120
  sun.shadow.camera.left = -18
  sun.shadow.camera.right = 18
  sun.shadow.camera.top = 18
  sun.shadow.camera.bottom = -18
  sun.shadow.bias = -0.00008
  sun.shadow.normalBias = 0.02

  const fill = new THREE.DirectionalLight(0xd6e6ff, 0.42)
  fill.position.set(-18, 14, -18)
  fill.target = fillTarget

  const rim = new THREE.DirectionalLight(0xffffff, 0.18)
  rim.position.set(10, 10, -24)
  rim.target = rimTarget

  const interior = new THREE.PointLight(0xfff1d8, 0.2, 28, 2)
  interior.position.set(0, 4.2, 0)

  const ground = createShadowCatcher()

  scene.add(ground, ambient, hemisphere, sunTarget, fillTarget, rimTarget, sun, fill, rim, interior)

  return { ambient, hemisphere, sun, fill, rim, interior, ground, sunTarget, fillTarget, rimTarget }
}

export function fitLightingToBounds(rig, bounds) {
  if (!rig || !bounds || bounds.isEmpty()) {
    return
  }

  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bounds.getCenter(center)
  bounds.getSize(size)

  const radius = Math.max(size.x, size.z) * 0.7 + 5
  const heightOffset = Math.max(size.y, 3)
  const targetY = center.y + Math.min(heightOffset * 0.32, 2.4)

  rig.sunTarget.position.set(center.x, targetY, center.z)
  rig.fillTarget.position.set(center.x, targetY * 0.85, center.z)
  rig.rimTarget.position.set(center.x, targetY * 0.55, center.z)

  rig.sun.position.set(
    center.x + radius * 0.95,
    center.y + heightOffset + radius * 1.22,
    center.z + radius * 0.72,
  )
  rig.fill.position.set(
    center.x - radius * 0.92,
    center.y + heightOffset * 0.8 + radius * 0.28,
    center.z - radius * 0.94,
  )
  rig.rim.position.set(
    center.x - radius * 0.18,
    center.y + heightOffset * 0.54 + 2.2,
    center.z - radius * 1.55,
  )
  rig.interior.position.set(center.x, center.y + Math.min(heightOffset * 0.68, 4.6), center.z)

  const shadowSpan = Math.max(size.x, size.z) * 0.86 + 3.2
  rig.sun.shadow.camera.left = -shadowSpan
  rig.sun.shadow.camera.right = shadowSpan
  rig.sun.shadow.camera.top = shadowSpan
  rig.sun.shadow.camera.bottom = -shadowSpan
  rig.sun.shadow.camera.near = Math.max(0.8, radius * 0.12)
  rig.sun.shadow.camera.far = Math.max(36, heightOffset + radius * 4.8)
  rig.sun.shadow.camera.updateProjectionMatrix()

  rig.sun.target.updateMatrixWorld()
  rig.fill.target.updateMatrixWorld()
  rig.rim.target.updateMatrixWorld()
}

export function updateLightingRig(
  rig,
  {
    lightIntensity = 1,
    shadowsEnabled = true,
  } = {},
) {
  const normalizedIntensity = Math.min(Math.max(lightIntensity, 0.35), 1.8)

  rig.ambient.intensity = 0.1 + normalizedIntensity * 0.16
  rig.hemisphere.intensity = 0.14 + normalizedIntensity * 0.24
  rig.sun.intensity = 1.22 + normalizedIntensity * 0.9
  rig.fill.intensity = 0.14 + normalizedIntensity * 0.22
  rig.rim.intensity = 0.06 + normalizedIntensity * 0.12
  rig.interior.intensity = 0.04 + normalizedIntensity * 0.12

  rig.sun.castShadow = shadowsEnabled
  rig.ground.visible = shadowsEnabled
  rig.ground.receiveShadow = shadowsEnabled
}
