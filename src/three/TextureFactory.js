import * as THREE from 'three'

const textureCache = new Map()

const MATERIAL_LIBRARY = {
  woodFloor: {
    basePath: '/assets/materials/wood-floor',
    roughness: 0.68,
    metalness: 0.02,
    normalScale: new THREE.Vector2(0.38, 0.38),
  },
  plasterWall: {
    basePath: '/assets/materials/plaster-wall',
    roughness: 0.88,
    metalness: 0.0,
    normalScale: new THREE.Vector2(0.28, 0.28),
  },
  pavement: {
    basePath: '/assets/materials/pavement',
    roughness: 0.82,
    metalness: 0.0,
    normalScale: new THREE.Vector2(0.54, 0.54),
  },
}

function createTextureLoader() {
  const loader = new THREE.TextureLoader()
  loader.crossOrigin = 'anonymous'
  return loader
}

function configureTexture(texture, repeatX, repeatY, colorTexture = false) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function loadTexture(url, repeatX, repeatY, colorTexture = false) {
  const loader = createTextureLoader()
  const texture = loader.load(url)
  return configureTexture(texture, repeatX, repeatY, colorTexture)
}

function getTextureSet(materialId, repeatX = 1, repeatY = 1) {
  const definition = MATERIAL_LIBRARY[materialId]

  if (!definition) {
    return {
      map: null,
      normalMap: null,
      roughnessMap: null,
      roughness: 0.8,
      metalness: 0.0,
      normalScale: new THREE.Vector2(0.35, 0.35),
    }
  }

  const key = `${materialId}-${repeatX}-${repeatY}`
  if (textureCache.has(key)) {
    return textureCache.get(key)
  }

  const result = {
    map: loadTexture(`${definition.basePath}/color.jpg`, repeatX, repeatY, true),
    normalMap: loadTexture(`${definition.basePath}/normal.jpg`, repeatX, repeatY),
    roughnessMap: loadTexture(`${definition.basePath}/roughness.jpg`, repeatX, repeatY),
    roughness: definition.roughness,
    metalness: definition.metalness,
    normalScale: definition.normalScale.clone(),
  }

  textureCache.set(key, result)
  return result
}

export function clearTextureCache() {
  textureCache.forEach((entry) => {
    if (entry.map) entry.map.dispose()
    if (entry.normalMap) entry.normalMap.dispose()
    if (entry.roughnessMap) entry.roughnessMap.dispose()
  })
  textureCache.clear()
}

export function getFloorTextureForRoom(roomKind, repeatX = 2, repeatZ = 2) {
  switch (roomKind) {
    case 'bedroom':
    case 'living':
    case 'dining':
      return getTextureSet('woodFloor', repeatX, repeatZ)
    case 'kitchen':
    case 'bathroom':
    case 'garage':
    case 'storage':
    case 'porch':
      return getTextureSet('pavement', repeatX, repeatZ)
    default:
      return getTextureSet('woodFloor', repeatX, repeatZ)
  }
}

export function getWallTexture(repeatX = 2, repeatZ = 1) {
  return getTextureSet('plasterWall', repeatX, repeatZ)
}

export function getExteriorWallTexture(repeatX = 1, repeatZ = 1) {
  return getTextureSet('plasterWall', repeatX, repeatZ)
}

export function getHardscapeTexture(repeatX = 1, repeatZ = 1) {
  return getTextureSet('pavement', repeatX, repeatZ)
}

export function getCountertopTexture(repeatX = 1, repeatZ = 1) {
  return getTextureSet('pavement', repeatX, repeatZ)
}
