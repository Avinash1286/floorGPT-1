import * as THREE from 'three'
import { clampNormalizedPosition, getOpeningDimensions } from '../utils/geometryHelpers'
import {
  getCountertopTexture,
  getExteriorWallTexture,
  getFloorTextureForRoom,
  getHardscapeTexture,
  getWallTexture,
} from './TextureFactory'

const FLOOR_THICKNESS = 0.08
const CEILING_THICKNESS = 0.08
const WALL_HEIGHT = 2.8
const WALL_THICKNESS = 0.12
const DEFAULT_DOOR_HEIGHT = 2.1
const DEFAULT_WINDOW_HEIGHT = 1.2
const DEFAULT_WINDOW_SILL = 1.0
const MIN_PANEL_SPAN = 0.08
const MIN_OPENING_SPAN = 0.35
const WALL_EDGE_PADDING = 0.06
const WALL_ALIGNMENT_TOLERANCE = 0.14
const EXPLICIT_WALL_COLOR = '#E2E8F0'
const FOUNDATION_HEIGHT = 0.24
const FOUNDATION_MARGIN = 0.9
const ROOF_THICKNESS = 0.18
const ROOF_OVERHANG = 0.42
const PARAPET_HEIGHT = 0.22
const PARAPET_THICKNESS = 0.12
const OPENING_FRAME_THICKNESS = 0.06
const OPENING_FRAME_COLOR = '#F8FAFC'
const DOOR_LEAF_COLOR = '#8B5E34'
const FOUNDATION_COLOR = '#6B7280'
const FOUNDATION_TOP_COLOR = '#CBD5E1'
const ROOF_COLOR = '#334155'
const ROOF_GLASS_COLOR = '#BFDBFE'
const SITE_LAWN_COLOR = '#7CB342'
const SITE_CONCRETE_COLOR = '#D6D3D1'
const SITE_DRIVEWAY_COLOR = '#C7CDD4'
const SITE_SHRUB_COLOR = '#4CAF50'
const SITE_TREE_TRUNK_COLOR = '#7C5A3A'
const SITE_TREE_LEAF_COLOR = '#66BB6A'
const WOOD_COLOR = '#9A6B3F'
const UPHOLSTERY_COLOR = '#D0D7E2'
const DARK_UPHOLSTERY_COLOR = '#64748B'
const RUG_COLOR = '#C8B38A'
const COUNTER_COLOR = '#E2E8F0'
const CABINET_COLOR = '#94A3B8'
const BATH_FIXTURE_COLOR = '#F8FAFC'
const DEFAULT_STYLE_PALETTE = {
  base: '#F8FAFC',
  accent: '#475569',
  trim: '#CBD5E1',
  roof: ROOF_COLOR,
  glass: ROOF_GLASS_COLOR,
  hardscape: SITE_CONCRETE_COLOR,
  landscape: SITE_LAWN_COLOR,
}

const ROOM_SURFACE_PALETTES = {
  generic: {
    wall: '#F5F2EC',
    floor: '#A98361',
    ceiling: '#FBFCFD',
  },
  living: {
    wall: '#F4F0E8',
    floor: '#B48861',
    ceiling: '#FBFCFD',
  },
  dining: {
    wall: '#F3EFE6',
    floor: '#A97A54',
    ceiling: '#FBFCFD',
  },
  bedroom: {
    wall: '#F2EFE9',
    floor: '#B8916D',
    ceiling: '#FCFCFD',
  },
  kitchen: {
    wall: '#F7F5F1',
    floor: '#D4CEC4',
    ceiling: '#FCFCFD',
  },
  bathroom: {
    wall: '#F5F7F8',
    floor: '#D8DDE2',
    ceiling: '#FCFCFD',
  },
  porch: {
    wall: '#F6F3EE',
    floor: '#C7C0B4',
    ceiling: '#FBFCFD',
  },
  garage: {
    wall: '#EEF1F4',
    floor: '#A8ADB4',
    ceiling: '#FCFCFD',
  },
  storage: {
    wall: '#EFF2F5',
    floor: '#A8ADB3',
    ceiling: '#FCFCFD',
  },
}

function getStylePalette(style = {}) {
  const palette = style?.palette ?? {}

  return {
    base: typeof palette.base === 'string' && palette.base ? palette.base : DEFAULT_STYLE_PALETTE.base,
    accent:
      typeof palette.accent === 'string' && palette.accent ? palette.accent : DEFAULT_STYLE_PALETTE.accent,
    trim: typeof palette.trim === 'string' && palette.trim ? palette.trim : DEFAULT_STYLE_PALETTE.trim,
    roof: typeof palette.roof === 'string' && palette.roof ? palette.roof : DEFAULT_STYLE_PALETTE.roof,
    glass:
      typeof palette.glass === 'string' && palette.glass ? palette.glass : DEFAULT_STYLE_PALETTE.glass,
    hardscape:
      typeof palette.hardscape === 'string' && palette.hardscape
        ? palette.hardscape
        : DEFAULT_STYLE_PALETTE.hardscape,
    landscape:
      typeof palette.landscape === 'string' && palette.landscape
        ? palette.landscape
        : DEFAULT_STYLE_PALETTE.landscape,
  }
}

function createSurfaceMaterial({
  color,
  wireframe,
  opacity = 1,
  side = THREE.FrontSide,
  shadingMode = 'phong',
  shininess = 25,
  map = null,
  normalMap = null,
  roughnessMap = null,
  metalnessMap = null,
  normalScale = null,
  roughness = 0.7,
  metalness = 0.0,
  envMapIntensity = 0.6,
}) {
  const common = {
    color,
    wireframe,
    transparent: opacity < 1,
    opacity,
    side,
  }

  if (shadingMode === 'basic') {
    return new THREE.MeshBasicMaterial({ ...common, map })
  }

  if (shadingMode === 'lambert') {
    return new THREE.MeshLambertMaterial({ ...common, map })
  }

  if (shadingMode === 'standard') {
    const standardProps = {
      ...common,
      map: map || undefined,
      roughnessMap: roughnessMap || undefined,
      metalnessMap: metalnessMap || undefined,
      roughness,
      metalness,
      envMapIntensity,
    }

    if (normalMap) {
      standardProps.normalMap = normalMap
      standardProps.normalScale = normalScale ? normalScale.clone() : new THREE.Vector2(0.35, 0.35)
    }

    return new THREE.MeshStandardMaterial(standardProps)
  }

  return new THREE.MeshPhongMaterial({
    ...common,
    shininess,
    map,
  })
}

function createMaterial(color, options = {}) {
  return createSurfaceMaterial({
    color,
    opacity: 1,
    side: THREE.FrontSide,
    shininess: 25,
    ...options,
  })
}

function createGlassMaterial({ wireframe, shadingMode, style }) {
  const palette = getStylePalette(style)

  if (shadingMode === 'standard') {
    return new THREE.MeshPhysicalMaterial({
      color: palette.glass,
      wireframe,
      transparent: true,
      opacity: wireframe ? 0.75 : 0.12,
      side: THREE.DoubleSide,
      roughness: 0.02,
      metalness: 0.05,
      transmission: wireframe ? 0 : 0.92,
      thickness: 0.03,
      envMapIntensity: 1.45,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    })
  }

  return createSurfaceMaterial({
    color: palette.glass,
    wireframe,
    shadingMode,
    opacity: wireframe ? 0.75 : 0.36,
    side: THREE.DoubleSide,
    shininess: 80,
  })
}

function createMesh(geometry, material, shadowsEnabled) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = shadowsEnabled
  mesh.receiveShadow = shadowsEnabled
  return mesh
}

function normalizeWallName(value) {
  const safeValue = typeof value === 'string' ? value.toLowerCase().trim() : ''
  return ['north', 'south', 'east', 'west'].includes(safeValue) ? safeValue : 'north'
}

function toPositiveNumber(value, fallback) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback
}

function toNonNegativeNumber(value, fallback) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback
}

function getWallLength(room, side) {
  return side === 'north' || side === 'south' ? room.width : room.height
}

function getRoomSurfacePalette(roomKind, style) {
  const palette = getStylePalette(style)
  const roomPalette = ROOM_SURFACE_PALETTES[roomKind] ?? ROOM_SURFACE_PALETTES.generic

  const wall = new THREE.Color(roomPalette.wall)
  const floor = new THREE.Color(roomPalette.floor)
  const ceiling = new THREE.Color(roomPalette.ceiling)

  if (style?.hasExteriorReference) {
    wall.lerp(new THREE.Color(palette.base), 0.12)
    floor.lerp(new THREE.Color(palette.hardscape), 0.18)
  }

  ceiling.lerp(new THREE.Color(palette.trim), 0.1)

  return {
    wall: `#${wall.getHexString()}`,
    floor: `#${floor.getHexString()}`,
    ceiling: `#${ceiling.getHexString()}`,
  }
}

function getWallColor(roomKind, style) {
  return getRoomSurfacePalette(roomKind, style).wall
}

function getFloorColor(roomKind, style) {
  return getRoomSurfacePalette(roomKind, style).floor
}

function getCeilingColor(roomKind, style) {
  return getRoomSurfacePalette(roomKind, style).ceiling
}

function getSceneBounds(sceneGraph) {
  const rooms = sceneGraph?.rooms ?? []
  const walls = sceneGraph?.walls ?? []

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  rooms.forEach((room) => {
    minX = Math.min(minX, room.x)
    maxX = Math.max(maxX, room.x + room.width)
    minZ = Math.min(minZ, room.y)
    maxZ = Math.max(maxZ, room.y + room.height)
  })

  walls.forEach((wall) => {
    minX = Math.min(minX, wall.x1, wall.x2)
    maxX = Math.max(maxX, wall.x1, wall.x2)
    minZ = Math.min(minZ, wall.y1, wall.y2)
    maxZ = Math.max(maxZ, wall.y1, wall.y2)
  })

  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) {
    return null
  }

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: Math.max(maxX - minX, 1),
    depth: Math.max(maxZ - minZ, 1),
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  }
}

function getRoomBounds(room) {
  return {
    minX: room.x,
    maxX: room.x + room.width,
    minZ: room.y,
    maxZ: room.y + room.height,
    centerX: room.x + room.width / 2,
    centerZ: room.y + room.height / 2,
  }
}

function classifyRoomKind(roomName) {
  const label = String(roomName ?? '').toLowerCase()

  if (/master|bed|ch\.?bed/.test(label)) return 'bedroom'
  if (/lounge|living/.test(label)) return 'living'
  if (/dining/.test(label)) return 'dining'
  if (/kitchen|pantry|laundry|dirty kitchen/.test(label)) return 'kitchen'
  if (/t\/b|bath|toilet|wc|w\.i\.c/.test(label)) return 'bathroom'
  if (/porch|verand|entrance|foyer/.test(label)) return 'porch'
  if (/garage|carport/.test(label)) return 'garage'
  if (/store|storage|sto/.test(label)) return 'storage'

  return 'generic'
}

function createStyledBox({
  width,
  height,
  depth,
  color,
  x = 0,
  y = 0,
  z = 0,
  rotationY = 0,
  opacity = 1,
  side = THREE.FrontSide,
  shininess = 24,
  textureSet = null,
  options,
}) {
  const mesh = createMesh(
    new THREE.BoxGeometry(width, height, depth),
    createSurfaceMaterial({
      color,
      wireframe: options.wireframe,
      opacity,
      side,
      shadingMode: options.shadingMode,
      shininess,
      map: textureSet?.map ?? null,
      normalMap: textureSet?.normalMap ?? null,
      roughnessMap: textureSet?.roughnessMap ?? null,
      roughness: textureSet?.roughness ?? 0.7,
      metalness: textureSet?.metalness ?? 0.0,
      normalScale: textureSet?.normalScale ?? null,
    }),
    options.shadowsEnabled,
  )
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotationY
  return mesh
}

function createStyledCylinder({
  radiusTop,
  radiusBottom,
  height,
  radialSegments = 18,
  color,
  x = 0,
  y = 0,
  z = 0,
  rotationY = 0,
  options,
}) {
  const mesh = createMesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    createMaterial(color, {
      wireframe: options.wireframe,
      shadingMode: options.shadingMode,
      shininess: 18,
    }),
    options.shadowsEnabled,
  )
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotationY
  return mesh
}

function createFloorAccent({
  width,
  depth,
  color,
  y = 0.01,
  opacity = 0.95,
  options,
}) {
  return createStyledBox({
    width,
    height: 0.02,
    depth,
    color,
    x: 0,
    y,
    z: 0,
    opacity,
    options,
  })
}

function addIfPresent(group, object) {
  if (object) {
    group.add(object)
  }
}

function fitDimension(value, maxValue, ratio, minValue) {
  return Math.max(minValue, Math.min(value * ratio, maxValue))
}

function getRoomPlacement(room, margin = 0.42) {
  return {
    left: -room.width / 2 + margin,
    right: room.width / 2 - margin,
    top: -room.height / 2 + margin,
    bottom: room.height / 2 - margin,
  }
}

function buildRoomOpeningsIndex(sceneGraph) {
  const map = new Map()

  const ensureRoomEntry = (roomId) => {
    if (!map.has(roomId)) {
      map.set(roomId, {
        north: [],
        south: [],
        east: [],
        west: [],
      })
    }

    return map.get(roomId)
  }

  const doors = sceneGraph?.doors ?? []
  const windows = sceneGraph?.windows ?? []

  doors.forEach((door) => {
    if (!door?.room_id) {
      return
    }

    const byWall = ensureRoomEntry(door.room_id)
    const wall = normalizeWallName(door.wall)
    const dimensions = getOpeningDimensions(door.width, toPositiveNumber(door.height, DEFAULT_DOOR_HEIGHT))

    byWall[wall].push({
      type: 'door',
      position: clampNormalizedPosition(door.position),
      width: dimensions.width,
      height: dimensions.height,
      sillHeight: 0,
    })
  })

  windows.forEach((windowData) => {
    if (!windowData?.room_id) {
      return
    }

    const byWall = ensureRoomEntry(windowData.room_id)
    const wall = normalizeWallName(windowData.wall)
    const dimensions = getOpeningDimensions(
      windowData.width,
      toPositiveNumber(windowData.height, DEFAULT_WINDOW_HEIGHT),
    )

    byWall[wall].push({
      type: 'window',
      position: clampNormalizedPosition(windowData.position),
      width: dimensions.width,
      height: dimensions.height,
      sillHeight: toNonNegativeNumber(windowData.sillHeight, DEFAULT_WINDOW_SILL),
    })
  })

  return map
}

function normalizeWallOpenings(rawOpenings, wallLength) {
  const maxOpeningWidth = Math.max(MIN_OPENING_SPAN, wallLength - WALL_EDGE_PADDING * 2)

  const normalized = rawOpenings
    .map((opening) => {
      const requestedWidth = toPositiveNumber(opening.width, MIN_OPENING_SPAN)
      const width = Math.min(Math.max(requestedWidth, MIN_OPENING_SPAN), maxOpeningWidth)
      const center = clampNormalizedPosition(opening.position) * wallLength

      let start = center - width / 2
      let end = center + width / 2

      if (start < WALL_EDGE_PADDING) {
        end += WALL_EDGE_PADDING - start
        start = WALL_EDGE_PADDING
      }

      const rightLimit = wallLength - WALL_EDGE_PADDING
      if (end > rightLimit) {
        start -= end - rightLimit
        end = rightLimit
      }

      if (end - start < MIN_OPENING_SPAN) {
        return null
      }

      const sillHeight =
        opening.type === 'door'
          ? 0
          : Math.min(
              Math.max(toNonNegativeNumber(opening.sillHeight, DEFAULT_WINDOW_SILL), 0),
              WALL_HEIGHT - 0.4,
            )

      const openingHeight = Math.min(
        Math.max(toPositiveNumber(opening.height, DEFAULT_WINDOW_HEIGHT), 0.5),
        WALL_HEIGHT - sillHeight - 0.1,
      )

      const topY = sillHeight + openingHeight

      return {
        ...opening,
        start,
        end,
        sillHeight,
        topY,
      }
    })
    .filter(Boolean)
    .sort((first, second) => first.start - second.start)

  const accepted = []

  normalized.forEach((opening) => {
    const previous = accepted[accepted.length - 1]
    if (!previous) {
      accepted.push(opening)
      return
    }

    if (opening.start < previous.end + MIN_PANEL_SPAN) {
      const shiftedStart = previous.end + MIN_PANEL_SPAN
      if (opening.end - shiftedStart < MIN_OPENING_SPAN) {
        return
      }

      const updated = {
        ...opening,
        start: shiftedStart,
      }
      accepted.push(updated)
      return
    }

    accepted.push(opening)
  })

  return accepted
}

function createWallPanel({
  room,
  side,
  wallLength,
  start,
  end,
  baseY,
  height,
  material,
  shadowsEnabled,
}) {
  const length = end - start
  if (length < MIN_PANEL_SPAN || height <= 0.03) {
    return null
  }

  const centerAlong = -wallLength / 2 + start + length / 2
  const centerY = baseY + height / 2

  if (side === 'north' || side === 'south') {
    const mesh = createMesh(new THREE.BoxGeometry(length, height, WALL_THICKNESS), material, shadowsEnabled)
    mesh.position.set(centerAlong, centerY, side === 'north' ? -room.height / 2 : room.height / 2)
    return mesh
  }

  const mesh = createMesh(new THREE.BoxGeometry(WALL_THICKNESS, height, length), material, shadowsEnabled)
  mesh.position.set(side === 'east' ? room.width / 2 : -room.width / 2, centerY, centerAlong)
  return mesh
}

function createWindowGlass({
  room,
  side,
  wallLength,
  opening,
  wireframe,
  shadingMode,
  style,
  shadowsEnabled,
}) {
  const length = opening.end - opening.start
  const height = opening.topY - opening.sillHeight

  if (length < MIN_OPENING_SPAN || height <= 0.05) {
    return null
  }

  const centerAlong = -wallLength / 2 + opening.start + length / 2
  const centerY = opening.sillHeight + height / 2
  const material = createGlassMaterial({ wireframe, shadingMode, style })

  if (side === 'north' || side === 'south') {
    const mesh = createMesh(
      new THREE.BoxGeometry(length, height, WALL_THICKNESS * 0.5),
      material,
      shadowsEnabled,
    )
    mesh.position.set(centerAlong, centerY, side === 'north' ? -room.height / 2 : room.height / 2)
    return mesh
  }

  const mesh = createMesh(
    new THREE.BoxGeometry(WALL_THICKNESS * 0.5, height, length),
    material,
    shadowsEnabled,
  )
  mesh.position.set(side === 'east' ? room.width / 2 : -room.width / 2, centerY, centerAlong)
  return mesh
}

function createLinearWallPanel({
  orientation,
  wallLength,
  thickness,
  start,
  end,
  baseY,
  height,
  material,
  shadowsEnabled,
}) {
  const length = end - start
  if (length < MIN_PANEL_SPAN || height <= 0.03) {
    return null
  }

  const centerAlong = -wallLength / 2 + start + length / 2
  const centerY = baseY + height / 2

  if (orientation === 'horizontal') {
    const mesh = createMesh(new THREE.BoxGeometry(length, height, thickness), material, shadowsEnabled)
    mesh.position.set(centerAlong, centerY, 0)
    return mesh
  }

  const mesh = createMesh(new THREE.BoxGeometry(thickness, height, length), material, shadowsEnabled)
  mesh.position.set(0, centerY, centerAlong)
  return mesh
}

function createLinearWindowGlass({
  orientation,
  wallLength,
  thickness,
  opening,
  wireframe,
  shadingMode,
  style,
  shadowsEnabled,
}) {
  const length = opening.end - opening.start
  const height = opening.topY - opening.sillHeight

  if (length < MIN_OPENING_SPAN || height <= 0.05) {
    return null
  }

  const centerAlong = -wallLength / 2 + opening.start + length / 2
  const centerY = opening.sillHeight + height / 2
  const material = createGlassMaterial({ wireframe, shadingMode, style })

  if (orientation === 'horizontal') {
    const mesh = createMesh(
      new THREE.BoxGeometry(length, height, Math.max(thickness * 0.5, 0.04)),
      material,
      shadowsEnabled,
    )
    mesh.position.set(centerAlong, centerY, 0)
    return mesh
  }

  const mesh = createMesh(
    new THREE.BoxGeometry(Math.max(thickness * 0.5, 0.04), height, length),
    material,
    shadowsEnabled,
  )
  mesh.position.set(0, centerY, centerAlong)
  return mesh
}

function createLinearFeatureMesh({
  orientation,
  wallLength,
  featureThickness,
  start,
  end,
  baseY,
  height,
  material,
  shadowsEnabled,
}) {
  return createLinearWallPanel({
    orientation,
    wallLength,
    thickness: featureThickness,
    start,
    end,
    baseY,
    height,
    material,
    shadowsEnabled,
  })
}

function createLinearDoorLeaf({
  orientation,
  wallLength,
  thickness,
  opening,
  material,
  shadowsEnabled,
}) {
  const leafWidth = Math.max(opening.end - opening.start - OPENING_FRAME_THICKNESS * 1.4, 0.32)
  const leafHeight = Math.max(opening.topY - OPENING_FRAME_THICKNESS * 0.8, 0.7)
  const centerAlong = -wallLength / 2 + opening.start + (opening.end - opening.start) / 2
  const centerY = leafHeight / 2
  const leafDepth = Math.max(thickness * 0.22, 0.04)

  if (orientation === 'horizontal') {
    const mesh = createMesh(
      new THREE.BoxGeometry(leafWidth, leafHeight, leafDepth),
      material,
      shadowsEnabled,
    )
    mesh.position.set(centerAlong, centerY, 0)
    return mesh
  }

  const mesh = createMesh(
    new THREE.BoxGeometry(leafDepth, leafHeight, leafWidth),
    material,
    shadowsEnabled,
  )
  mesh.position.set(0, centerY, centerAlong)
  return mesh
}

function buildLinearOpeningFeatures({ orientation, wallLength, thickness, openings, options }) {
  const featureGroup = new THREE.Group()
  const frameMaterial = createMaterial(OPENING_FRAME_COLOR, {
    wireframe: options.wireframe,
    shadingMode: options.shadingMode,
    shininess: 60,
  })
  const doorMaterial = createMaterial(DOOR_LEAF_COLOR, {
    wireframe: options.wireframe,
    shadingMode: options.shadingMode,
    shininess: 16,
  })
  const frameDepth = Math.max(thickness * 0.62, 0.06)

  openings.forEach((opening) => {
    const openingLength = opening.end - opening.start
    const openingHeight = opening.topY - opening.sillHeight
    const sideFrameWidth = Math.min(OPENING_FRAME_THICKNESS, Math.max(openingLength * 0.18, 0.04))
    const headFrameHeight = Math.min(OPENING_FRAME_THICKNESS, Math.max(openingHeight * 0.08, 0.04))

    const leftFrame = createLinearFeatureMesh({
      orientation,
      wallLength,
      featureThickness: frameDepth,
      start: opening.start,
      end: Math.min(opening.start + sideFrameWidth, opening.end),
      baseY: opening.sillHeight,
      height: openingHeight,
      material: frameMaterial,
      shadowsEnabled: options.shadowsEnabled,
    })
    const rightFrame = createLinearFeatureMesh({
      orientation,
      wallLength,
      featureThickness: frameDepth,
      start: Math.max(opening.end - sideFrameWidth, opening.start),
      end: opening.end,
      baseY: opening.sillHeight,
      height: openingHeight,
      material: frameMaterial,
      shadowsEnabled: options.shadowsEnabled,
    })
    const headFrame = createLinearFeatureMesh({
      orientation,
      wallLength,
      featureThickness: frameDepth,
      start: opening.start,
      end: opening.end,
      baseY: Math.max(opening.topY - headFrameHeight, opening.sillHeight),
      height: headFrameHeight,
      material: frameMaterial,
      shadowsEnabled: options.shadowsEnabled,
    })

    if (leftFrame) {
      featureGroup.add(leftFrame)
    }
    if (rightFrame) {
      featureGroup.add(rightFrame)
    }
    if (headFrame) {
      featureGroup.add(headFrame)
    }

    if (opening.type === 'window') {
      const sillFrame = createLinearFeatureMesh({
        orientation,
        wallLength,
        featureThickness: frameDepth,
        start: opening.start,
        end: opening.end,
        baseY: opening.sillHeight,
        height: headFrameHeight,
        material: frameMaterial,
        shadowsEnabled: options.shadowsEnabled,
      })

      if (sillFrame) {
        featureGroup.add(sillFrame)
      }

      const mullionStart = opening.start + openingLength / 2 - sideFrameWidth / 2
      const mullionEnd = mullionStart + sideFrameWidth
      const mullionHeight = Math.max(openingHeight - headFrameHeight * 2, 0.16)
      const mullionBaseY = opening.sillHeight + headFrameHeight
      const mullion = createLinearFeatureMesh({
        orientation,
        wallLength,
        featureThickness: frameDepth * 0.85,
        start: mullionStart,
        end: mullionEnd,
        baseY: mullionBaseY,
        height: mullionHeight,
        material: frameMaterial,
        shadowsEnabled: options.shadowsEnabled,
      })

      if (mullion) {
        featureGroup.add(mullion)
      }

      return
    }

    const doorLeaf = createLinearDoorLeaf({
      orientation,
      wallLength,
      thickness,
      opening,
      material: doorMaterial,
      shadowsEnabled: options.shadowsEnabled,
    })

    if (doorLeaf) {
      featureGroup.add(doorLeaf)
    }
  })

  return featureGroup
}

function buildFoundation(bounds, options) {
  const group = new THREE.Group()
  group.name = 'foundation-root'
  const palette = getStylePalette(options.style)
  const slabTexture =
    options.shadingMode === 'standard'
      ? getHardscapeTexture(
          Math.max(1, Math.round((bounds.width + FOUNDATION_MARGIN) / 2)),
          Math.max(1, Math.round((bounds.depth + FOUNDATION_MARGIN) / 2)),
        )
      : null

  const slab = createStyledBox({
    width: bounds.width + FOUNDATION_MARGIN,
    height: FOUNDATION_HEIGHT,
    depth: bounds.depth + FOUNDATION_MARGIN,
    color: palette.accent || FOUNDATION_COLOR,
    x: bounds.centerX,
    y: -FOUNDATION_HEIGHT / 2,
    z: bounds.centerZ,
    textureSet: slabTexture,
    options,
  })

  const topPlate = createStyledBox({
    width: bounds.width + FOUNDATION_MARGIN * 0.72,
    height: 0.05,
    depth: bounds.depth + FOUNDATION_MARGIN * 0.72,
    color: palette.hardscape || FOUNDATION_TOP_COLOR,
    x: bounds.centerX,
    y: 0.025,
    z: bounds.centerZ,
    textureSet: slabTexture,
    options,
  })

  group.add(slab, topPlate)
  return group
}

function buildRoofDeck(bounds, options) {
  const group = new THREE.Group()
  group.name = 'roof-root'
  const palette = getStylePalette(options.style)
  const roofTexture =
    options.shadingMode === 'standard'
      ? getHardscapeTexture(
          Math.max(1, Math.round((bounds.width + ROOF_OVERHANG * 2) / 2.2)),
          Math.max(1, Math.round((bounds.depth + ROOF_OVERHANG * 2) / 2.2)),
        )
      : null
  const parapetTexture =
    options.shadingMode === 'standard'
      ? getExteriorWallTexture(
          Math.max(1, Math.round((bounds.width + ROOF_OVERHANG * 2) / 3)),
          1,
        )
      : null

  const roofY = WALL_HEIGHT + CEILING_THICKNESS + ROOF_THICKNESS / 2 + 0.03
  const roofWidth = bounds.width + ROOF_OVERHANG * 2
  const roofDepth = bounds.depth + ROOF_OVERHANG * 2

  const roof = createStyledBox({
    width: roofWidth,
    height: ROOF_THICKNESS,
    depth: roofDepth,
    color: palette.trim || ROOF_COLOR,
    x: bounds.centerX,
    y: roofY,
    z: bounds.centerZ,
    opacity: options.wireframe ? 0.9 : 0.84,
    textureSet: roofTexture,
    options,
  })

  const skylight = createMesh(
    new THREE.BoxGeometry(Math.max(bounds.width * 0.22, 1.2), 0.04, Math.max(bounds.depth * 0.16, 0.9)),
    createSurfaceMaterial({
      color: palette.glass || ROOF_GLASS_COLOR,
      wireframe: options.wireframe,
      opacity: options.wireframe ? 0.82 : 0.42,
      side: THREE.DoubleSide,
      shadingMode: options.shadingMode,
      shininess: 90,
    }),
    options.shadowsEnabled,
  )
  skylight.position.set(bounds.centerX, roofY + ROOF_THICKNESS / 2 + 0.04, bounds.centerZ)

  const northParapet = createStyledBox({
    width: roofWidth,
    height: PARAPET_HEIGHT,
    depth: PARAPET_THICKNESS,
    color: palette.accent,
    x: bounds.centerX,
    y: roofY + PARAPET_HEIGHT / 2,
    z: bounds.minZ - ROOF_OVERHANG,
    textureSet: parapetTexture,
    options,
  })

  const southParapet = createStyledBox({
    width: roofWidth,
    height: PARAPET_HEIGHT,
    depth: PARAPET_THICKNESS,
    color: palette.accent,
    x: bounds.centerX,
    y: roofY + PARAPET_HEIGHT / 2,
    z: bounds.maxZ + ROOF_OVERHANG,
    textureSet: parapetTexture,
    options,
  })

  const eastParapet = createStyledBox({
    width: PARAPET_THICKNESS,
    height: PARAPET_HEIGHT,
    depth: roofDepth,
    color: palette.accent,
    x: bounds.maxX + ROOF_OVERHANG,
    y: roofY + PARAPET_HEIGHT / 2,
    z: bounds.centerZ,
    textureSet: parapetTexture,
    options,
  })

  const westParapet = createStyledBox({
    width: PARAPET_THICKNESS,
    height: PARAPET_HEIGHT,
    depth: roofDepth,
    color: palette.accent,
    x: bounds.minX - ROOF_OVERHANG,
    y: roofY + PARAPET_HEIGHT / 2,
    z: bounds.centerZ,
    textureSet: parapetTexture,
    options,
  })

  const parapetCapColor = palette.trim
  const useCappedParapet = options.style?.facade?.parapetProfile !== 'flush'
  const northCap = createStyledBox({
    width: roofWidth + 0.04,
    height: 0.04,
    depth: PARAPET_THICKNESS + 0.04,
    color: parapetCapColor,
    x: bounds.centerX,
    y: roofY + PARAPET_HEIGHT + 0.02,
    z: bounds.minZ - ROOF_OVERHANG,
    options,
  })
  const southCap = createStyledBox({
    width: roofWidth + 0.04,
    height: 0.04,
    depth: PARAPET_THICKNESS + 0.04,
    color: parapetCapColor,
    x: bounds.centerX,
    y: roofY + PARAPET_HEIGHT + 0.02,
    z: bounds.maxZ + ROOF_OVERHANG,
    options,
  })
  const eastCap = createStyledBox({
    width: PARAPET_THICKNESS + 0.04,
    height: 0.04,
    depth: roofDepth + 0.04,
    color: parapetCapColor,
    x: bounds.maxX + ROOF_OVERHANG,
    y: roofY + PARAPET_HEIGHT + 0.02,
    z: bounds.centerZ,
    options,
  })
  const westCap = createStyledBox({
    width: PARAPET_THICKNESS + 0.04,
    height: 0.04,
    depth: roofDepth + 0.04,
    color: parapetCapColor,
    x: bounds.minX - ROOF_OVERHANG,
    y: roofY + PARAPET_HEIGHT + 0.02,
    z: bounds.centerZ,
    options,
  })

  group.add(roof, skylight, northParapet, southParapet, eastParapet, westParapet)

  if (useCappedParapet) {
    group.add(northCap, southCap, eastCap, westCap)
  }
  return group
}

function buildBaseboards(room, options) {
  const group = new THREE.Group()
  group.name = 'baseboards'
  const color = getStylePalette(options.style).trim
  const height = 0.12
  const thickness = 0.04

  const north = createStyledBox({
    width: room.width,
    height,
    depth: thickness,
    color,
    x: 0,
    y: height / 2,
    z: -room.height / 2 + thickness / 2,
    options,
  })
  const south = createStyledBox({
    width: room.width,
    height,
    depth: thickness,
    color,
    x: 0,
    y: height / 2,
    z: room.height / 2 - thickness / 2,
    options,
  })
  const east = createStyledBox({
    width: thickness,
    height,
    depth: room.height,
    color,
    x: room.width / 2 - thickness / 2,
    y: height / 2,
    z: 0,
    options,
  })
  const west = createStyledBox({
    width: thickness,
    height,
    depth: room.height,
    color,
    x: -room.width / 2 + thickness / 2,
    y: height / 2,
    z: 0,
    options,
  })

  group.add(north, south, east, west)
  return group
}

function buildBedroomFurniture(room, options) {
  const group = new THREE.Group()
  const placement = getRoomPlacement(room, 0.52)
  const rug = createFloorAccent({
    width: fitDimension(room.width, 2.6, 0.48, 1.7),
    depth: fitDimension(room.height, 2.2, 0.42, 1.4),
    color: '#CBB89A',
    options,
  })
  rug.position.z = 0.2
  group.add(rug)

  const bedWidth = fitDimension(room.width, 2.2, 0.46, 1.5)
  const bedDepth = fitDimension(room.height, 2.2, 0.38, 1.9)
  const bedCenterZ = placement.top + bedDepth / 2

  const bedBase = createStyledBox({
    width: bedWidth,
    height: 0.34,
    depth: bedDepth,
    color: WOOD_COLOR,
    x: 0,
    y: 0.17,
    z: bedCenterZ,
    options,
  })
  const mattress = createStyledBox({
    width: bedWidth * 0.94,
    height: 0.18,
    depth: bedDepth * 0.94,
    color: '#F8FAFC',
    x: 0,
    y: 0.44,
    z: bedCenterZ,
    options,
  })
  const headboard = createStyledBox({
    width: bedWidth,
    height: 0.9,
    depth: 0.12,
    color: DARK_UPHOLSTERY_COLOR,
    x: 0,
    y: 0.52,
    z: bedCenterZ - bedDepth / 2 + 0.04,
    options,
  })
  const leftStand = createStyledBox({
    width: 0.42,
    height: 0.42,
    depth: 0.38,
    color: WOOD_COLOR,
    x: -bedWidth / 2 - 0.32,
    y: 0.21,
    z: bedCenterZ - 0.15,
    options,
  })
  const rightStand = createStyledBox({
    width: 0.42,
    height: 0.42,
    depth: 0.38,
    color: WOOD_COLOR,
    x: bedWidth / 2 + 0.32,
    y: 0.21,
    z: bedCenterZ - 0.15,
    options,
  })
  const wardrobe = createStyledBox({
    width: fitDimension(room.width, 1.9, 0.22, 1.0),
    height: 2.1,
    depth: 0.62,
    color: '#CBD5E1',
    x: placement.right - 0.45,
    y: 1.05,
    z: placement.bottom - 0.4,
    options,
  })

  group.add(bedBase, mattress, headboard, leftStand, rightStand, wardrobe)
  return group
}

function buildLivingFurniture(room, options) {
  const group = new THREE.Group()
  const rug = createFloorAccent({
    width: fitDimension(room.width, 3.6, 0.55, 2.2),
    depth: fitDimension(room.height, 2.8, 0.46, 1.8),
    color: RUG_COLOR,
    options,
  })
  group.add(rug)

  const sofa = createStyledBox({
    width: fitDimension(room.width, 2.8, 0.42, 1.9),
    height: 0.78,
    depth: 0.92,
    color: UPHOLSTERY_COLOR,
    x: 0,
    y: 0.39,
    z: -room.height / 2 + 0.9,
    options,
  })
  const chaise = createStyledBox({
    width: 1.2,
    height: 0.64,
    depth: 1.55,
    color: '#BFC9D8',
    x: -fitDimension(room.width, 2.8, 0.42, 1.9) / 2 + 0.45,
    y: 0.32,
    z: -room.height / 2 + 1.22,
    options,
  })
  const coffee = createStyledBox({
    width: 1.1,
    height: 0.26,
    depth: 0.62,
    color: WOOD_COLOR,
    x: 0,
    y: 0.13,
    z: 0.15,
    options,
  })
  const console = createStyledBox({
    width: fitDimension(room.width, 2.1, 0.3, 1.2),
    height: 0.5,
    depth: 0.38,
    color: '#475569',
    x: 0,
    y: 0.25,
    z: room.height / 2 - 0.32,
    options,
  })
  const tv = createStyledBox({
    width: fitDimension(room.width, 1.4, 0.24, 0.8),
    height: 0.78,
    depth: 0.05,
    color: '#111827',
    x: 0,
    y: 1.05,
    z: room.height / 2 - 0.1,
    options,
  })

  group.add(sofa, chaise, coffee, console, tv)
  return group
}

function buildDiningFurniture(room, options) {
  const group = new THREE.Group()
  const tableWidth = fitDimension(room.width, 1.8, 0.32, 1.1)
  const tableDepth = fitDimension(room.height, 1.0, 0.24, 0.8)
  const tableTop = createStyledBox({
    width: tableWidth,
    height: 0.1,
    depth: tableDepth,
    color: WOOD_COLOR,
    x: 0,
    y: 0.78,
    z: 0,
    options,
  })
  const tableBase = createStyledCylinder({
    radiusTop: 0.12,
    radiusBottom: 0.2,
    height: 0.76,
    color: '#64748B',
    x: 0,
    y: 0.38,
    z: 0,
    options,
  })
  group.add(tableTop, tableBase)

  const chairOffsets = [
    [-tableWidth / 2 - 0.28, -0.25],
    [tableWidth / 2 + 0.28, -0.25],
    [-tableWidth / 2 - 0.28, 0.25],
    [tableWidth / 2 + 0.28, 0.25],
  ]
  chairOffsets.forEach(([x, z]) => {
    group.add(
      createStyledBox({
        width: 0.44,
        height: 0.86,
        depth: 0.44,
        color: '#D7DEE8',
        x,
        y: 0.43,
        z,
        options,
      }),
    )
  })

  return group
}

function buildKitchenFurniture(room, options) {
  const group = new THREE.Group()
  const counterRunX = fitDimension(room.width, room.width - 0.5, 0.78, 1.8)
  const counterRunZ = fitDimension(room.height, room.height - 0.5, 0.76, 1.6)
  const countertopTexture =
    options.shadingMode === 'standard'
      ? getCountertopTexture(Math.max(1, Math.round(counterRunX)), 1)
      : null

  const northCounter = createStyledBox({
    width: counterRunX,
    height: 0.92,
    depth: 0.62,
    color: CABINET_COLOR,
    x: 0,
    y: 0.46,
    z: -room.height / 2 + 0.38,
    options,
  })
  const eastCounter = createStyledBox({
    width: 0.62,
    height: 0.92,
    depth: counterRunZ,
    color: CABINET_COLOR,
    x: room.width / 2 - 0.38,
    y: 0.46,
    z: 0,
    options,
  })
  const northTop = createStyledBox({
    width: counterRunX,
    height: 0.05,
    depth: 0.64,
    color: COUNTER_COLOR,
    x: 0,
    y: 0.94,
    z: -room.height / 2 + 0.38,
    textureSet: countertopTexture,
    options,
  })
  const eastTop = createStyledBox({
    width: 0.64,
    height: 0.05,
    depth: counterRunZ,
    color: COUNTER_COLOR,
    x: room.width / 2 - 0.38,
    y: 0.94,
    z: 0,
    textureSet: countertopTexture,
    options,
  })
  const islandWidth = fitDimension(room.width, 1.8, 0.26, 1.0)
  const islandDepth = fitDimension(room.height, 0.95, 0.18, 0.7)
  const island = createStyledBox({
    width: islandWidth,
    height: 0.94,
    depth: islandDepth,
    color: '#E5E7EB',
    x: 0,
    y: 0.47,
    z: 0.35,
    options,
  })
  const islandTop = createStyledBox({
    width: islandWidth + 0.1,
    height: 0.05,
    depth: islandDepth + 0.1,
    color: COUNTER_COLOR,
    x: 0,
    y: 0.97,
    z: 0.35,
    textureSet: countertopTexture,
    options,
  })

  group.add(northCounter, eastCounter, northTop, eastTop, island, islandTop)
  return group
}

function buildBathroomFurniture(room, options) {
  const group = new THREE.Group()
  const vanity = createStyledBox({
    width: fitDimension(room.width, 1.1, 0.36, 0.72),
    height: 0.86,
    depth: 0.46,
    color: '#DCE4EE',
    x: -room.width / 2 + 0.55,
    y: 0.43,
    z: -room.height / 2 + 0.34,
    options,
  })
  const toiletBase = createStyledBox({
    width: 0.42,
    height: 0.42,
    depth: 0.6,
    color: BATH_FIXTURE_COLOR,
    x: room.width / 2 - 0.4,
    y: 0.21,
    z: room.height / 2 - 0.46,
    options,
  })
  const showerGlass = createStyledBox({
    width: fitDimension(room.width, 0.9, 0.22, 0.55),
    height: 1.9,
    depth: 0.04,
    color: '#BFDBFE',
    x: 0,
    y: 0.95,
    z: room.height / 2 - 0.18,
    opacity: options.wireframe ? 0.8 : 0.35,
    side: THREE.DoubleSide,
    shininess: 90,
    options,
  })
  const tileMat = createFloorAccent({
    width: room.width * 0.82,
    depth: room.height * 0.82,
    color: '#E5E7EB',
    y: 0.012,
    options,
  })

  group.add(tileMat, vanity, toiletBase, showerGlass)
  return group
}

function buildPorchFurniture(room, options) {
  const group = new THREE.Group()
  const bench = createStyledBox({
    width: fitDimension(room.width, 1.5, 0.35, 0.9),
    height: 0.52,
    depth: 0.48,
    color: WOOD_COLOR,
    x: 0,
    y: 0.26,
    z: -room.height / 2 + 0.4,
    options,
  })
  const planterLeft = createStyledCylinder({
    radiusTop: 0.22,
    radiusBottom: 0.24,
    height: 0.46,
    color: '#9CA3AF',
    x: -room.width / 2 + 0.45,
    y: 0.23,
    z: room.height / 2 - 0.4,
    options,
  })
  const plantLeft = createStyledCylinder({
    radiusTop: 0.16,
    radiusBottom: 0.24,
    height: 0.68,
    color: SITE_SHRUB_COLOR,
    x: -room.width / 2 + 0.45,
    y: 0.67,
    z: room.height / 2 - 0.4,
    options,
  })
  const porchTile = createFloorAccent({
    width: room.width * 0.88,
    depth: room.height * 0.88,
    color: '#D1D5DB',
    y: 0.012,
    options,
  })

  group.add(porchTile, bench, planterLeft, plantLeft)
  return group
}

function buildGarageFurniture(room, options) {
  const group = new THREE.Group()
  const carBody = createStyledBox({
    width: fitDimension(room.width, 2.2, 0.62, 1.6),
    height: 0.8,
    depth: fitDimension(room.height, 4.4, 0.7, 3.0),
    color: '#374151',
    x: 0,
    y: 0.48,
    z: 0,
    options,
  })
  const windshield = createStyledBox({
    width: fitDimension(room.width, 1.6, 0.42, 1.0),
    height: 0.36,
    depth: fitDimension(room.height, 1.1, 0.2, 0.8),
    color: '#BFDBFE',
    x: 0,
    y: 0.84,
    z: -0.4,
    opacity: options.wireframe ? 0.8 : 0.45,
    side: THREE.DoubleSide,
    shininess: 90,
    options,
  })
  group.add(carBody, windshield)
  return group
}

function buildStorageFurniture(room, options) {
  const group = new THREE.Group()
  const shelf = createStyledBox({
    width: fitDimension(room.width, room.width - 0.4, 0.72, 0.9),
    height: 1.9,
    depth: 0.36,
    color: '#B8C3D1',
    x: 0,
    y: 0.95,
    z: -room.height / 2 + 0.22,
    options,
  })
  group.add(shelf)
  return group
}

function buildGenericFurniture(room, options) {
  const group = new THREE.Group()
  const accent = createFloorAccent({
    width: fitDimension(room.width, 1.6, 0.34, 0.8),
    depth: fitDimension(room.height, 1.2, 0.28, 0.7),
    color: '#CBD5E1',
    options,
  })
  accent.position.z = 0.1
  group.add(accent)
  return group
}

function buildRoomFurnishing(room, options) {
  const group = new THREE.Group()
  group.name = 'room-furnishing'

  switch (classifyRoomKind(room.name)) {
    case 'bedroom':
      group.add(buildBedroomFurniture(room, options))
      break
    case 'living':
      group.add(buildLivingFurniture(room, options))
      break
    case 'dining':
      group.add(buildDiningFurniture(room, options))
      break
    case 'kitchen':
      group.add(buildKitchenFurniture(room, options))
      break
    case 'bathroom':
      group.add(buildBathroomFurniture(room, options))
      break
    case 'porch':
      group.add(buildPorchFurniture(room, options))
      break
    case 'garage':
      group.add(buildGarageFurniture(room, options))
      break
    case 'storage':
      group.add(buildStorageFurniture(room, options))
      break
    default:
      group.add(buildGenericFurniture(room, options))
      break
  }

  return group
}

function getFrontAnchor(bounds, rooms) {
  const candidate =
    rooms.find((room) => /entrance|porch|verand|garage|carport/i.test(room.name)) ??
    rooms.find((room) => /living|lounge/i.test(room.name)) ??
    rooms[0]

  if (!candidate) {
    return {
      edge: 'south',
      centerX: bounds.centerX,
      centerZ: bounds.maxZ,
      room: null,
    }
  }

  const roomBounds = getRoomBounds(candidate)
  const distances = [
    { edge: 'north', distance: Math.abs(roomBounds.minZ - bounds.minZ) },
    { edge: 'south', distance: Math.abs(bounds.maxZ - roomBounds.maxZ) },
    { edge: 'west', distance: Math.abs(roomBounds.minX - bounds.minX) },
    { edge: 'east', distance: Math.abs(bounds.maxX - roomBounds.maxX) },
  ]
  distances.sort((a, b) => a.distance - b.distance)

  return {
    edge: distances[0].edge,
    centerX: roomBounds.centerX,
    centerZ: roomBounds.centerZ,
    room: candidate,
  }
}

function buildSiteContext(bounds, rooms, options) {
  const group = new THREE.Group()
  group.name = 'site-context'
  const palette = getStylePalette(options.style)
  const hardscapeTexture =
    options.shadingMode === 'standard'
      ? getHardscapeTexture(
          Math.max(1, Math.round((bounds.width + 4) / 2.4)),
          Math.max(1, Math.round((bounds.depth + 4) / 2.4)),
        )
      : null

  const lawn = createStyledBox({
    width: bounds.width + 18,
    height: 0.05,
    depth: bounds.depth + 18,
    color: palette.landscape,
    x: bounds.centerX,
    y: -FOUNDATION_HEIGHT - 0.05,
    z: bounds.centerZ,
    options,
  })
  const apron = createStyledBox({
    width: bounds.width + 4,
    height: 0.03,
    depth: bounds.depth + 4,
    color: palette.hardscape,
    x: bounds.centerX,
    y: -FOUNDATION_HEIGHT - 0.015,
    z: bounds.centerZ,
    textureSet: hardscapeTexture,
    options,
  })

  group.add(lawn, apron)

  const front = getFrontAnchor(bounds, rooms)
  const pathWidth = front.room ? Math.min(Math.max(front.room.width * 0.55, 1.6), 3.8) : 2.4
  const pathLength = 6
  let walkway

  if (front.edge === 'south' || front.edge === 'north') {
    walkway = createStyledBox({
      width: pathWidth,
      height: 0.035,
      depth: pathLength,
      color: palette.hardscape,
      x: front.centerX,
      y: -FOUNDATION_HEIGHT - 0.01,
      z: front.edge === 'south' ? bounds.maxZ + pathLength / 2 + 1.2 : bounds.minZ - pathLength / 2 - 1.2,
      textureSet: hardscapeTexture,
      options,
    })
  } else {
    walkway = createStyledBox({
      width: pathLength,
      height: 0.035,
      depth: pathWidth,
      color: palette.hardscape,
      x: front.edge === 'east' ? bounds.maxX + pathLength / 2 + 1.2 : bounds.minX - pathLength / 2 - 1.2,
      y: -FOUNDATION_HEIGHT - 0.01,
      z: front.centerZ,
      textureSet: hardscapeTexture,
      options,
    })
  }

  group.add(walkway)

  const shrubPositions = [
    [bounds.minX - 1.8, bounds.maxZ + 2.2],
    [bounds.maxX + 1.8, bounds.maxZ + 2.0],
    [bounds.minX - 2.1, bounds.minZ - 1.8],
    [bounds.maxX + 2.2, bounds.minZ - 1.6],
  ]

  shrubPositions.forEach(([x, z]) => {
    group.add(
      createStyledCylinder({
        radiusTop: 0.38,
        radiusBottom: 0.52,
        height: 0.72,
        color: SITE_SHRUB_COLOR,
        x,
        y: -FOUNDATION_HEIGHT + 0.31,
        z,
        options,
      }),
    )
  })

  const treeBaseX = bounds.minX - 4.5
  const treeBaseZ = bounds.maxZ + 3.5
  const trunk = createStyledCylinder({
    radiusTop: 0.14,
    radiusBottom: 0.18,
    height: 2.8,
    color: SITE_TREE_TRUNK_COLOR,
    x: treeBaseX,
    y: 1.4 - FOUNDATION_HEIGHT,
    z: treeBaseZ,
    options,
  })
  const foliage = createStyledCylinder({
    radiusTop: 0.9,
    radiusBottom: 1.2,
    height: 2.2,
    color: SITE_TREE_LEAF_COLOR,
    x: treeBaseX,
    y: 3.1 - FOUNDATION_HEIGHT,
    z: treeBaseZ,
    options,
  })

  group.add(trunk, foliage)
  return group
}

function getFrontRooms(bounds, rooms, edge) {
  const threshold = 0.6

  return rooms
    .filter((room) => {
      const roomBounds = getRoomBounds(room)

      if (edge === 'south') {
        return Math.abs(bounds.maxZ - roomBounds.maxZ) <= threshold
      }

      if (edge === 'north') {
        return Math.abs(roomBounds.minZ - bounds.minZ) <= threshold
      }

      if (edge === 'east') {
        return Math.abs(bounds.maxX - roomBounds.maxX) <= threshold
      }

      return Math.abs(roomBounds.minX - bounds.minX) <= threshold
    })
    .sort((left, right) => {
      const leftBounds = getRoomBounds(left)
      const rightBounds = getRoomBounds(right)

      return edge === 'north' || edge === 'south'
        ? leftBounds.centerX - rightBounds.centerX
        : leftBounds.centerZ - rightBounds.centerZ
    })
}

function buildFrontSteps(roomBounds, frontEdge, options, color, stepCount = 3) {
  const steps = new THREE.Group()

  if (stepCount < 1) {
    return steps
  }

  const width = Math.max(roomBounds.maxX - roomBounds.minX + 0.72, 1.7)
  const depth = 0.36
  const stepHeight = 0.1

  for (let index = 0; index < stepCount; index += 1) {
    const currentWidth = width + index * 0.24
    const currentDepth = depth + index * 0.02
    const y = 0.02 - index * stepHeight

    steps.add(
      createStyledBox({
        width: frontEdge === 'north' || frontEdge === 'south' ? currentWidth : currentDepth,
        height: stepHeight,
        depth: frontEdge === 'north' || frontEdge === 'south' ? currentDepth : currentWidth,
        color,
        x:
          frontEdge === 'north' || frontEdge === 'south'
            ? roomBounds.centerX
            : frontEdge === 'east'
              ? roomBounds.maxX + 0.2 + index * 0.08
              : roomBounds.minX - 0.2 - index * 0.08,
        y,
        z:
          frontEdge === 'south'
            ? roomBounds.maxZ + 0.24 + index * 0.11
            : frontEdge === 'north'
              ? roomBounds.minZ - 0.24 - index * 0.11
              : roomBounds.centerZ,
        options,
      }),
    )
  }

  return steps
}

function buildModernRailing({
  centerX,
  centerZ,
  width,
  depth,
  edge,
  y,
  color,
  pattern = 'posts',
  options,
}) {
  const group = new THREE.Group()
  const railHeight = 1.02
  const topRailThickness = 0.06
  const postThickness = 0.05
  const postHeight = 0.9
  const horizontalBarOffsets = [0.28, 0.52, 0.76]

  const addHorizontalBars = ({ alongWidth, frontPosition, lateralCenter }) => {
    horizontalBarOffsets.forEach((offsetY) => {
      if (alongWidth) {
        group.add(
          createStyledBox({
            width,
            height: 0.03,
            depth: 0.04,
            color,
            x: centerX,
            y: y + offsetY,
            z: frontPosition,
            options,
          }),
        )
      } else {
        group.add(
          createStyledBox({
            width: 0.04,
            height: 0.03,
            depth,
            color,
            x: frontPosition,
            y: y + offsetY,
            z: lateralCenter,
            options,
          }),
        )
      }
    })
  }

  if (edge === 'north' || edge === 'south') {
    const frontZ = edge === 'south' ? centerZ + depth / 2 - 0.04 : centerZ - depth / 2 + 0.04
    const sideOffset = width / 2 - 0.05

    group.add(
      createStyledBox({
        width,
        height: topRailThickness,
        depth: 0.08,
        color,
        x: centerX,
        y: y + railHeight,
        z: frontZ,
        options,
      }),
    )
    ;[-1, 1].forEach((side) => {
      group.add(
        createStyledBox({
          width: 0.08,
          height: topRailThickness,
          depth,
          color,
          x: centerX + side * sideOffset,
          y: y + railHeight,
          z: centerZ,
          options,
        }),
      )
    })

    if (pattern === 'horizontal-bars') {
      addHorizontalBars({ alongWidth: true, frontPosition: frontZ, lateralCenter: centerZ })
      ;[-1, 1].forEach((side) => {
        group.add(
          createStyledBox({
            width: postThickness,
            height: postHeight,
            depth: postThickness,
            color,
            x: centerX + side * sideOffset,
            y: y + postHeight / 2,
            z: frontZ,
            options,
          }),
        )
      })
    } else {
      const postCount = Math.max(4, Math.round(width / 0.78))
      for (let index = 0; index < postCount; index += 1) {
        const t = postCount === 1 ? 0.5 : index / (postCount - 1)
        const x = centerX - width / 2 + t * width
        group.add(
          createStyledBox({
            width: postThickness,
            height: postHeight,
            depth: postThickness,
            color,
            x,
            y: y + postHeight / 2,
            z: frontZ,
            options,
          }),
        )
      }
    }

    return group
  }

  const frontX = edge === 'east' ? centerX + width / 2 - 0.04 : centerX - width / 2 + 0.04
  const sideOffset = depth / 2 - 0.05

  group.add(
    createStyledBox({
      width: 0.08,
      height: topRailThickness,
      depth,
      color,
      x: frontX,
      y: y + railHeight,
      z: centerZ,
      options,
    }),
  )
  ;[-1, 1].forEach((side) => {
    group.add(
      createStyledBox({
        width,
        height: topRailThickness,
        depth: 0.08,
        color,
        x: centerX,
        y: y + railHeight,
        z: centerZ + side * sideOffset,
        options,
      }),
    )
  })

  if (pattern === 'horizontal-bars') {
    addHorizontalBars({ alongWidth: false, frontPosition: frontX, lateralCenter: centerZ })
    ;[-1, 1].forEach((side) => {
      group.add(
        createStyledBox({
          width: postThickness,
          height: postHeight,
          depth: postThickness,
          color,
          x: frontX,
          y: y + postHeight / 2,
          z: centerZ + side * sideOffset,
          options,
        }),
      )
    })
  } else {
    const postCount = Math.max(4, Math.round(depth / 0.78))
    for (let index = 0; index < postCount; index += 1) {
      const t = postCount === 1 ? 0.5 : index / (postCount - 1)
      const z = centerZ - depth / 2 + t * depth
      group.add(
        createStyledBox({
          width: postThickness,
          height: postHeight,
          depth: postThickness,
          color,
          x: frontX,
          y: y + postHeight / 2,
          z,
          options,
        }),
      )
    }
  }

  return group
}

function buildModernColumn({
  x,
  z,
  height,
  width,
  depth,
  color,
  accentColor,
  styleVariant = 'banded-square',
  options,
}) {
  const group = new THREE.Group()
  const hasBands = styleVariant !== 'plain'
  const isSlim = styleVariant === 'slim'
  const shaftWidth = isSlim ? width * 0.78 : width
  const shaftDepth = isSlim ? depth * 0.78 : depth

  group.add(
    createStyledBox({
      width: shaftWidth,
      height,
      depth: shaftDepth,
      color,
      x,
      y: height / 2,
      z,
      textureSet:
        options.shadingMode === 'standard' ? getExteriorWallTexture(1, Math.max(1, Math.round(height / 2))) : null,
      options,
    }),
  )

  if (hasBands) {
    group.add(
      createStyledBox({
        width: shaftWidth + 0.08,
        height: 0.16,
        depth: shaftDepth + 0.08,
        color: accentColor,
        x,
        y: 0.08,
        z,
        options,
      }),
    )

    group.add(
      createStyledBox({
        width: shaftWidth + 0.1,
        height: 0.14,
        depth: shaftDepth + 0.1,
        color: accentColor,
        x,
        y: height - 0.07,
        z,
        options,
      }),
    )

    group.add(
      createStyledBox({
        width: shaftWidth + 0.04,
        height: 0.12,
        depth: shaftDepth + 0.04,
        color: accentColor,
        x,
        y: Math.min(height * 0.28, 0.84),
        z,
        options,
      }),
    )
  }

  return group
}

function buildFacadeWindowArray({
  centerX,
  centerY,
  centerZ,
  span,
  height,
  panelCount = 3,
  edge,
  options,
  style,
  frameColor,
}) {
  const group = new THREE.Group()
  const frameThickness = 0.08
  const frameDepth = 0.12
  const mullionThickness = 0.05
  const inset = 0.02
  const glassMaterial = createGlassMaterial({
    wireframe: options.wireframe,
    shadingMode: options.shadingMode,
    style,
  })
  const frameMaterial = createMaterial(frameColor, {
    wireframe: options.wireframe,
    shadingMode: options.shadingMode,
    shininess: 50,
  })

  const addPiece = (width, pieceHeight, depth, x, y, z) => {
    const mesh = createMesh(new THREE.BoxGeometry(width, pieceHeight, depth), frameMaterial, options.shadowsEnabled)
    mesh.position.set(x, y, z)
    group.add(mesh)
  }

  const horizontal = edge === 'north' || edge === 'south'
  const frontOffset = horizontal ? centerZ : centerX
  const panelSpan = Math.max((span - frameThickness * 2 - mullionThickness * (panelCount - 1)) / panelCount, 0.26)

  if (horizontal) {
    addPiece(span, frameThickness, frameDepth, centerX, centerY + height / 2 - frameThickness / 2, centerZ)
    addPiece(span, frameThickness, frameDepth, centerX, centerY - height / 2 + frameThickness / 2, centerZ)
    addPiece(frameThickness, height, frameDepth, centerX - span / 2 + frameThickness / 2, centerY, centerZ)
    addPiece(frameThickness, height, frameDepth, centerX + span / 2 - frameThickness / 2, centerY, centerZ)

    for (let index = 1; index < panelCount; index += 1) {
      const mullionX = centerX - span / 2 + frameThickness + panelSpan * index + mullionThickness * (index - 0.5)
      addPiece(mullionThickness, height - frameThickness * 2, frameDepth, mullionX, centerY, centerZ)
    }

    for (let index = 0; index < panelCount; index += 1) {
      const panelCenterX =
        centerX - span / 2 + frameThickness + panelSpan / 2 + index * (panelSpan + mullionThickness)
      const glass = createMesh(
        new THREE.BoxGeometry(panelSpan - inset, height - frameThickness * 2 - inset, frameDepth * 0.45),
        glassMaterial,
        options.shadowsEnabled,
      )
      glass.position.set(panelCenterX, centerY, frontOffset)
      group.add(glass)
    }

    return group
  }

  addPiece(frameDepth, frameThickness, span, centerX, centerY + height / 2 - frameThickness / 2, centerZ)
  addPiece(frameDepth, frameThickness, span, centerX, centerY - height / 2 + frameThickness / 2, centerZ)
  addPiece(frameDepth, height, frameThickness, centerX, centerY, centerZ - span / 2 + frameThickness / 2)
  addPiece(frameDepth, height, frameThickness, centerX, centerY, centerZ + span / 2 - frameThickness / 2)

  for (let index = 1; index < panelCount; index += 1) {
    const mullionZ = centerZ - span / 2 + frameThickness + panelSpan * index + mullionThickness * (index - 0.5)
    addPiece(frameDepth, height - frameThickness * 2, mullionThickness, centerX, centerY, mullionZ)
  }

  for (let index = 0; index < panelCount; index += 1) {
    const panelCenterZ =
      centerZ - span / 2 + frameThickness + panelSpan / 2 + index * (panelSpan + mullionThickness)
    const glass = createMesh(
      new THREE.BoxGeometry(frameDepth * 0.45, height - frameThickness * 2 - inset, panelSpan - inset),
      glassMaterial,
      options.shadowsEnabled,
    )
    glass.position.set(frontOffset, centerY, panelCenterZ)
    group.add(glass)
  }

  return group
}

function buildSlattedScreen({ centerX, centerY, centerZ, span, height, edge, color, options }) {
  const group = new THREE.Group()
  const slatCount = Math.max(6, Math.round(span / 0.28))
  const slatThickness = 0.05
  const screenDepth = 0.14
  const horizontal = edge === 'north' || edge === 'south'

  for (let index = 0; index < slatCount; index += 1) {
    const t = slatCount === 1 ? 0.5 : index / (slatCount - 1)

    if (horizontal) {
      const x = centerX - span / 2 + t * span
      group.add(
        createStyledBox({
          width: slatThickness,
          height,
          depth: screenDepth,
          color,
          x,
          y: centerY,
          z: centerZ,
          options,
        }),
      )
    } else {
      const z = centerZ - span / 2 + t * span
      group.add(
        createStyledBox({
          width: screenDepth,
          height,
          depth: slatThickness,
          color,
          x: centerX,
          y: centerY,
          z,
          options,
        }),
      )
    }
  }

  return group
}

function buildCarportModule({
  garageBounds,
  frontEdge,
  canopyDepth,
  columnWidth,
  palette,
  columnStyle = 'banded-square',
  options,
}) {
  const group = new THREE.Group()
  const canopyWidth = Math.max(garageBounds.maxX - garageBounds.minX + 0.5, 2.8)
  const slabDepth = Math.max(canopyDepth + 0.5, 3.2)
  const slabY = 2.78
  const slabCenterZ =
    frontEdge === 'south'
      ? garageBounds.maxZ + slabDepth / 2 - 0.08
      : frontEdge === 'north'
        ? garageBounds.minZ - slabDepth / 2 + 0.08
        : garageBounds.centerZ

  const hardscapeTexture =
    options.shadingMode === 'standard'
      ? getHardscapeTexture(Math.max(1, Math.round(canopyWidth / 2)), Math.max(1, Math.round(slabDepth / 2)))
      : null

  group.add(
    createStyledBox({
      width: canopyWidth,
      height: 0.14,
      depth: slabDepth,
      color: palette.trim,
      x: garageBounds.centerX,
      y: slabY,
      z: slabCenterZ,
      textureSet: hardscapeTexture,
      options,
    }),
  )

  const frontColumnZ = frontEdge === 'south' ? slabCenterZ + slabDepth / 2 - 0.2 : slabCenterZ - slabDepth / 2 + 0.2
  ;[-1, 1].forEach((side) => {
    group.add(
      buildModernColumn({
        x: garageBounds.centerX + side * (canopyWidth / 2 - 0.22),
        z: frontColumnZ,
        height: 2.72,
        width: Math.max(columnWidth, 0.22),
        depth: Math.max(columnWidth, 0.22),
        color: palette.base,
        accentColor: palette.accent,
        styleVariant: columnStyle,
        options,
      }),
    )
  })

  group.add(
    createStyledBox({
      width: canopyWidth + 0.1,
      height: 0.08,
      depth: 0.1,
      color: palette.accent,
      x: garageBounds.centerX,
      y: slabY - 0.08,
      z: frontEdge === 'south' ? slabCenterZ + slabDepth / 2 - 0.04 : slabCenterZ - slabDepth / 2 + 0.04,
      options,
    }),
  )

  return group
}

function buildExteriorAccents(bounds, rooms, options) {
  const group = new THREE.Group()
  group.name = 'exterior-accents'
  const front = getFrontAnchor(bounds, rooms)
  const style = options.style ?? {}
  const palette = getStylePalette(style)
  const facadeTexture =
    options.shadingMode === 'standard'
      ? getExteriorWallTexture(
          Math.max(1, Math.round(bounds.width / 3)),
          Math.max(1, Math.round((WALL_HEIGHT + 1.2) / 2)),
        )
      : null

  if (!front.room) {
    return group
  }

  const frontRooms = getFrontRooms(bounds, rooms, front.edge)
  const activeFrontRooms = frontRooms.length ? frontRooms : [front.room]
  const frontMinX = Math.min(...activeFrontRooms.map((room) => getRoomBounds(room).minX))
  const frontMaxX = Math.max(...activeFrontRooms.map((room) => getRoomBounds(room).maxX))
  const columnCount = Math.max(2, Math.round(style?.facade?.columnCount ?? 4))
  const columnWidth = Number(style?.facade?.columnWidth) || 0.24
  const canopyDepth = Number(style?.facade?.canopyDepth) || 1.9
  const frontSpanX = Math.max(frontMaxX - frontMinX, 1.8)
  const frontageCenterX = (frontMinX + frontMaxX) / 2
  const garageRoom = rooms.find((room) => /garage|carport/i.test(room.name))
  const livingRoom = rooms.find((room) => /living|lounge/i.test(room.name)) ?? front.room
  const porchRoom =
    rooms.find((room) => /porch|entrance|verand/i.test(room.name)) ??
    livingRoom ??
    front.room
  const porchBounds = getRoomBounds(porchRoom)
  const livingBounds = getRoomBounds(livingRoom)
  const terraceBaseY = WALL_HEIGHT + CEILING_THICKNESS + ROOF_THICKNESS + 0.02
  const frontWindowColumns = Math.max(2, Math.min(5, Math.round(style?.facade?.frontWindowColumns ?? 3)))
  const columnStyle = style?.facade?.columnStyle || 'banded-square'
  const railingPattern =
    style?.facade?.railingPattern === 'posts'
      ? 'posts'
      : style?.hasExteriorReference
        ? 'horizontal-bars'
        : 'posts'
  const showUpperLevel =
    Boolean(style?.hasExteriorReference) ||
    Boolean(style?.massing?.upperLevel) ||
    Boolean(style?.facade?.balcony) ||
    Boolean(style?.facade?.terrace)

  if (front.edge === 'south' || front.edge === 'north') {
    const columnZ = front.edge === 'south' ? bounds.maxZ + 0.06 : bounds.minZ - 0.06
    const canopyZ =
      front.edge === 'south'
        ? bounds.maxZ + canopyDepth / 2 - 0.06
        : bounds.minZ - canopyDepth / 2 + 0.06
    const frontWidth = frontSpanX + 0.95
    const startX = frontMinX + 0.35
    const endX = frontMaxX - 0.35

    for (let index = 0; index < columnCount; index += 1) {
      const t = columnCount === 1 ? 0.5 : index / (columnCount - 1)
      const x = startX + (endX - startX) * t

      group.add(
        buildModernColumn({
          x,
          z: columnZ,
          height: 2.75,
          width: columnWidth,
          depth: columnWidth,
          color: palette.base,
          accentColor: palette.accent,
          styleVariant: columnStyle,
          options,
        }),
      )
    }

    group.add(
      createStyledBox({
        width: frontWidth,
        height: 0.18,
        depth: canopyDepth,
        color: palette.trim,
        x: frontageCenterX,
        y: 2.84,
        z: canopyZ,
        textureSet: facadeTexture,
        options,
      }),
    )

    if (style?.facade?.hasFacadeBands) {
      group.add(
        createStyledBox({
          width: frontWidth + 0.28,
          height: 0.22,
          depth: 0.16,
          color: palette.accent,
          x: frontageCenterX,
          y: 1.02,
          z: front.edge === 'south' ? bounds.maxZ + 0.12 : bounds.minZ - 0.12,
          options,
        }),
      )
      group.add(
        createStyledBox({
          width: frontWidth + 0.44,
          height: 0.14,
          depth: 0.18,
          color: palette.trim,
          x: frontageCenterX,
          y: 2.48,
          z: front.edge === 'south' ? bounds.maxZ + 0.16 : bounds.minZ - 0.16,
          options,
        }),
      )
    }

    group.add(buildFrontSteps(porchBounds, front.edge, options, palette.hardscape, Number(style?.facade?.steps) || 3))

    group.add(
      buildFacadeWindowArray({
        centerX: livingBounds.centerX + Math.min(livingRoom.width * 0.06, 0.28),
        centerY: 1.45,
        centerZ:
          front.edge === 'south'
            ? livingBounds.maxZ + WALL_THICKNESS * 0.2
            : livingBounds.minZ - WALL_THICKNESS * 0.2,
        span: Math.min(Math.max(livingRoom.width * 0.64, 1.8), 3.4),
        height: 1.28,
        panelCount: frontWindowColumns,
        edge: front.edge,
        options,
        style,
        frameColor: palette.accent,
      }),
    )
  }

  if (showUpperLevel) {
    const upperWidthFactor = Number(style?.massing?.upperLevelWidthFactor) || 0.52
    const upperDepthFactor = Number(style?.massing?.upperLevelDepthFactor) || 0.34
    const upperHeight = Number(style?.massing?.upperLevelHeight) || 2.9
    const upperCenterX = bounds.centerX + bounds.width * (Number(style?.massing?.upperLevelOffsetX) || 0.14)
    const upperCenterZ = bounds.centerZ + bounds.depth * (Number(style?.massing?.upperLevelOffsetZ) || -0.08)
    const upperWidth = Math.max(bounds.width * upperWidthFactor, 3.6)
    const upperDepth = Math.max(bounds.depth * upperDepthFactor, 3.1)
    const upperY = terraceBaseY + upperHeight / 2

    group.add(
      createStyledBox({
        width: upperWidth,
        height: upperHeight,
        depth: upperDepth,
        color: palette.base,
        x: upperCenterX,
        y: upperY,
        z: upperCenterZ,
        textureSet: facadeTexture,
        options,
      }),
    )
    group.add(
      createStyledBox({
        width: upperWidth + 0.14,
        height: 0.14,
        depth: 0.18,
        color: palette.accent,
        x: upperCenterX,
        y: upperY + upperHeight / 2 - 0.38,
        z:
          front.edge === 'south'
            ? upperCenterZ + upperDepth / 2 - 0.05
            : front.edge === 'north'
              ? upperCenterZ - upperDepth / 2 + 0.05
              : upperCenterZ,
        options,
      }),
    )

    if (style?.facade?.balcony || style?.facade?.terrace) {
      const balconyWidth = Math.max(
        upperWidth * (Number(style?.facade?.balconyWidthFactor) || 0.52),
        2.4,
      )
      const balconyDepth = Number(style?.facade?.balconyDepth) || 1.35
      const balconyCenterX = upperCenterX + bounds.width * 0.04
      const balconyCenterZ =
        front.edge === 'south'
          ? bounds.maxZ + balconyDepth / 2 - 0.06
          : front.edge === 'north'
            ? bounds.minZ - balconyDepth / 2 + 0.06
            : bounds.centerZ

      group.add(
        createStyledBox({
          width: front.edge === 'north' || front.edge === 'south' ? balconyWidth : balconyDepth,
          height: 0.14,
          depth: front.edge === 'north' || front.edge === 'south' ? balconyDepth : balconyWidth,
          color: palette.trim,
          x: front.edge === 'north' || front.edge === 'south' ? balconyCenterX : bounds.centerX,
          y: terraceBaseY + 0.07,
          z: front.edge === 'north' || front.edge === 'south' ? balconyCenterZ : bounds.centerZ,
          textureSet: facadeTexture,
          options,
        }),
      )
      group.add(
        createStyledBox({
          width: front.edge === 'north' || front.edge === 'south' ? balconyWidth + 0.14 : balconyDepth + 0.14,
          height: 0.08,
          depth: 0.1,
          color: palette.accent,
          x: front.edge === 'north' || front.edge === 'south' ? balconyCenterX : bounds.centerX,
          y: terraceBaseY,
          z:
            front.edge === 'south'
              ? balconyCenterZ + balconyDepth / 2 - 0.03
              : front.edge === 'north'
                ? balconyCenterZ - balconyDepth / 2 + 0.03
                : bounds.centerZ,
          options,
        }),
      )

      if (style?.facade?.railing ?? true) {
        group.add(
          buildModernRailing({
            centerX: front.edge === 'north' || front.edge === 'south' ? balconyCenterX : bounds.centerX,
            centerZ: front.edge === 'north' || front.edge === 'south' ? balconyCenterZ : bounds.centerZ,
            width: front.edge === 'north' || front.edge === 'south' ? balconyWidth : balconyDepth,
            depth: front.edge === 'north' || front.edge === 'south' ? balconyDepth : balconyWidth,
            edge: front.edge,
            y: terraceBaseY + 0.07,
            color: palette.accent,
            pattern: railingPattern,
            options,
          }),
        )
      }
    }

    group.add(
      buildFacadeWindowArray({
        centerX: upperCenterX - upperWidth * 0.08,
        centerY: upperY + 0.1,
        centerZ:
          front.edge === 'south'
            ? upperCenterZ + upperDepth / 2 + 0.01
            : front.edge === 'north'
              ? upperCenterZ - upperDepth / 2 - 0.01
              : upperCenterZ,
        span: Math.min(Math.max(upperWidth * 0.46, 1.8), 3.3),
        height: 0.92,
        panelCount: frontWindowColumns,
        edge: front.edge,
        options,
        style,
        frameColor: palette.accent,
      }),
    )
  }

  if (style?.hasExteriorReference || style?.facade?.carport) {
    const accentSide = style?.facade?.accentWallSide || 'east'
    const accentWallWidth = Number(style?.facade?.accentWallWidth) || 0.9
    const accentWallDepth = Number(style?.facade?.accentWallDepth) || 0.24
    const accentHeight = terraceBaseY + (showUpperLevel ? (Number(style?.massing?.upperLevelHeight) || 2.9) : 0.8)

    if (accentSide === 'east' || accentSide === 'west') {
      const accentX = accentSide === 'east' ? bounds.maxX + accentWallDepth / 2 : bounds.minX - accentWallDepth / 2
      group.add(
        createStyledBox({
          width: accentWallDepth,
          height: accentHeight,
          depth: Math.max(bounds.depth * 0.7, 4.4),
          color: palette.accent,
          x: accentX,
          y: accentHeight / 2 - 0.02,
          z: bounds.centerZ,
          options,
        }),
      )

      if (style?.facade?.sideScreen ?? true) {
        group.add(
          buildSlattedScreen({
            centerX: accentX,
            centerY: Math.min(accentHeight * 0.48, 2.6),
            centerZ: bounds.centerZ + bounds.depth * 0.12,
            span: Math.max(bounds.depth * 0.46, 2.2),
            height: Math.min(accentHeight * 0.5, 3.1),
            edge: accentSide,
            color: palette.trim,
            options,
          }),
        )
      }

      if (style?.facade?.hasFacadeBands) {
        ;[-0.9, 0, 0.9].forEach((offset) => {
          group.add(
            createStyledBox({
              width: accentWallDepth + 0.02,
              height: 0.12,
              depth: Math.max(accentWallWidth, 0.55),
              color: palette.trim,
              x: accentX,
              y: 1.6 + offset * 0.7,
              z: bounds.centerZ + offset,
              options,
            }),
          )
        })
      }
    }
  }

  if (garageRoom && (style?.facade?.carport || style?.hasExteriorReference)) {
    const garageBounds = getRoomBounds(garageRoom)
    group.add(
      buildCarportModule({
        garageBounds,
        frontEdge: front.edge,
        canopyDepth,
        columnWidth,
        palette,
        columnStyle,
        options,
      }),
    )
  }

  return group
}

function buildLinearWallWithOpenings({ orientation, wallLength, thickness, openings, material, options }) {
  const { wireframe, shadingMode, shadowsEnabled } = options
  const wallGroup = new THREE.Group()
  const normalizedOpenings = normalizeWallOpenings(openings, wallLength)

  if (!normalizedOpenings.length) {
    const fullPanel = createLinearWallPanel({
      orientation,
      wallLength,
      thickness,
      start: 0,
      end: wallLength,
      baseY: 0,
      height: WALL_HEIGHT,
      material,
      shadowsEnabled,
    })

    if (fullPanel) {
      wallGroup.add(fullPanel)
    }

    return wallGroup
  }

  let cursor = 0

  normalizedOpenings.forEach((opening) => {
    if (opening.start - cursor > MIN_PANEL_SPAN) {
      const leadingSegment = createLinearWallPanel({
        orientation,
        wallLength,
        thickness,
        start: cursor,
        end: opening.start,
        baseY: 0,
        height: WALL_HEIGHT,
        material,
        shadowsEnabled,
      })

      if (leadingSegment) {
        wallGroup.add(leadingSegment)
      }
    }

    if (opening.sillHeight > 0.02) {
      const bottomSegment = createLinearWallPanel({
        orientation,
        wallLength,
        thickness,
        start: opening.start,
        end: opening.end,
        baseY: 0,
        height: opening.sillHeight,
        material,
        shadowsEnabled,
      })

      if (bottomSegment) {
        wallGroup.add(bottomSegment)
      }
    }

    if (opening.topY < WALL_HEIGHT - 0.02) {
      const topSegment = createLinearWallPanel({
        orientation,
        wallLength,
        thickness,
        start: opening.start,
        end: opening.end,
        baseY: opening.topY,
        height: WALL_HEIGHT - opening.topY,
        material,
        shadowsEnabled,
      })

      if (topSegment) {
        wallGroup.add(topSegment)
      }
    }

    if (opening.type === 'window') {
      const glass = createLinearWindowGlass({
        orientation,
        wallLength,
        thickness,
        opening,
        wireframe,
        shadingMode,
        style: options.style,
        shadowsEnabled,
      })

      if (glass) {
        wallGroup.add(glass)
      }
    }

    cursor = opening.end
  })

  if (wallLength - cursor > MIN_PANEL_SPAN) {
    const trailingSegment = createLinearWallPanel({
      orientation,
      wallLength,
      thickness,
      start: cursor,
      end: wallLength,
      baseY: 0,
      height: WALL_HEIGHT,
      material,
      shadowsEnabled,
    })

    if (trailingSegment) {
      wallGroup.add(trailingSegment)
    }
  }

  const featureGroup = buildLinearOpeningFeatures({
    orientation,
    wallLength,
    thickness,
    openings: normalizedOpenings,
    options: { wireframe, shadingMode, shadowsEnabled },
  })

  if (featureGroup.children.length) {
    wallGroup.add(featureGroup)
  }

  return wallGroup
}

function isAlignedWall(dx, dz) {
  return Math.abs(dx) <= WALL_ALIGNMENT_TOLERANCE || Math.abs(dz) <= WALL_ALIGNMENT_TOLERANCE
}

function buildGlobalOpenings(sceneGraph) {
  const roomsById = new Map((sceneGraph?.rooms ?? []).map((room) => [room.id, room]))
  const openings = []

  const pushOpening = (entry, type) => {
    const room = roomsById.get(entry?.room_id)
    if (!room) {
      return
    }

    const wall = normalizeWallName(entry.wall)
    const dimensions = getOpeningDimensions(
      entry.width,
      type === 'door'
        ? toPositiveNumber(entry.height, DEFAULT_DOOR_HEIGHT)
        : toPositiveNumber(entry.height, DEFAULT_WINDOW_HEIGHT),
    )

    const opening = {
      type,
      sillHeight:
        type === 'door' ? 0 : toNonNegativeNumber(entry.sillHeight, DEFAULT_WINDOW_SILL),
      height: dimensions.height,
    }

    if (wall === 'north' || wall === 'south') {
      const wallLength = room.width
      const center = clampNormalizedPosition(entry.position) * wallLength
      const line = wall === 'north' ? room.y : room.y + room.height

      openings.push({
        ...opening,
        axis: 'horizontal',
        line,
        start: room.x + center - dimensions.width / 2,
        end: room.x + center + dimensions.width / 2,
      })
      return
    }

    const wallLength = room.height
    const center = clampNormalizedPosition(entry.position) * wallLength
    const line = wall === 'west' ? room.x : room.x + room.width

    openings.push({
      ...opening,
      axis: 'vertical',
      line,
      start: room.y + center - dimensions.width / 2,
      end: room.y + center + dimensions.width / 2,
    })
  }

  ;(sceneGraph?.doors ?? []).forEach((door) => pushOpening(door, 'door'))
  ;(sceneGraph?.windows ?? []).forEach((windowData) => pushOpening(windowData, 'window'))

  return openings
}

function dedupeGlobalOpenings(openings) {
  const deduped = []

  openings.forEach((opening) => {
    const duplicate = deduped.find(
      (candidate) =>
        candidate.axis === opening.axis &&
        candidate.type === opening.type &&
        Math.abs(candidate.line - opening.line) <= WALL_ALIGNMENT_TOLERANCE &&
        Math.abs(candidate.start - opening.start) <= WALL_ALIGNMENT_TOLERANCE &&
        Math.abs(candidate.end - opening.end) <= WALL_ALIGNMENT_TOLERANCE &&
        Math.abs(candidate.sillHeight - opening.sillHeight) <= 0.08 &&
        Math.abs(candidate.height - opening.height) <= 0.08,
    )

    if (!duplicate) {
      deduped.push(opening)
    }
  })

  return deduped
}

function snapToTolerance(value, tolerance = WALL_ALIGNMENT_TOLERANCE) {
  return Math.round(value / tolerance) * tolerance
}

function collectRoomTopologyEdges(rooms) {
  return rooms.flatMap((room) => {
    const roomBounds = getRoomBounds(room)
    return [
      {
        axis: 'horizontal',
        line: roomBounds.minZ,
        start: roomBounds.minX,
        end: roomBounds.maxX,
        roomId: room.id,
      },
      {
        axis: 'horizontal',
        line: roomBounds.maxZ,
        start: roomBounds.minX,
        end: roomBounds.maxX,
        roomId: room.id,
      },
      {
        axis: 'vertical',
        line: roomBounds.minX,
        start: roomBounds.minZ,
        end: roomBounds.maxZ,
        roomId: room.id,
      },
      {
        axis: 'vertical',
        line: roomBounds.maxX,
        start: roomBounds.minZ,
        end: roomBounds.maxZ,
        roomId: room.id,
      },
    ]
  })
}

function mergeSortedPoints(points, tolerance = WALL_ALIGNMENT_TOLERANCE) {
  const sorted = [...points].sort((left, right) => left - right)
  const merged = []

  sorted.forEach((point) => {
    const last = merged[merged.length - 1]
    if (typeof last === 'number' && Math.abs(last - point) <= tolerance) {
      merged[merged.length - 1] = (last + point) / 2
      return
    }

    merged.push(point)
  })

  return merged
}

function buildMergedTopologySegments(rooms) {
  const edges = collectRoomTopologyEdges(rooms)
  const groups = new Map()

  edges.forEach((edge) => {
    const key = `${edge.axis}:${snapToTolerance(edge.line)}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }

    groups.get(key).push(edge)
  })

  const segments = []

  groups.forEach((groupEdges, key) => {
    const axis = key.startsWith('horizontal') ? 'horizontal' : 'vertical'
    const line = groupEdges.reduce((sum, edge) => sum + edge.line, 0) / groupEdges.length
    const points = mergeSortedPoints(
      groupEdges.flatMap((edge) => [edge.start, edge.end]),
      WALL_ALIGNMENT_TOLERANCE,
    )

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]
      const end = points[index + 1]
      if (end - start < MIN_PANEL_SPAN) {
        continue
      }

      const midpoint = (start + end) / 2
      const coveringEdges = groupEdges.filter(
        (edge) =>
          midpoint >= edge.start - WALL_ALIGNMENT_TOLERANCE &&
          midpoint <= edge.end + WALL_ALIGNMENT_TOLERANCE,
      )

      if (!coveringEdges.length) {
        continue
      }

      const uniqueRooms = [...new Set(coveringEdges.map((edge) => edge.roomId))]
      segments.push({
        axis,
        line,
        start,
        end,
        kind: uniqueRooms.length > 1 ? 'interior' : 'exterior',
      })
    }
  })

  return segments
}

function getTopologySegmentOpenings(segment, globalOpenings) {
  return globalOpenings
    .filter(
      (opening) =>
        opening.axis === segment.axis &&
        Math.abs(opening.line - segment.line) <= WALL_ALIGNMENT_TOLERANCE,
    )
    .map((opening) => {
      const overlapStart = Math.max(opening.start, segment.start)
      const overlapEnd = Math.min(opening.end, segment.end)
      const width = overlapEnd - overlapStart

      return {
        ...opening,
        width,
        position: ((overlapStart + overlapEnd) / 2 - segment.start) / Math.max(segment.end - segment.start, 0.001),
      }
    })
    .filter((opening) => opening.width >= MIN_OPENING_SPAN)
}

function buildMergedWallTopology(sceneGraph, options) {
  const wallGroup = new THREE.Group()
  wallGroup.name = 'topology-wall-root'

  const rooms = sceneGraph?.rooms ?? []
  if (!rooms.length) {
    return wallGroup
  }

  const segments = buildMergedTopologySegments(rooms)
  const globalOpenings = dedupeGlobalOpenings(buildGlobalOpenings(sceneGraph))
  const palette = getStylePalette(options.style)
  const baseWallColor = palette.base

  segments.forEach((segment, index) => {
    const openings = getTopologySegmentOpenings(segment, globalOpenings)
    const thickness = segment.kind === 'interior' ? WALL_THICKNESS : WALL_THICKNESS * 1.08
    const segmentLength = segment.end - segment.start
    const wallMaterial =
      options.shadingMode === 'standard'
        ? (() => {
            const wallTex = getExteriorWallTexture(Math.max(1, Math.round(segmentLength / 2)), 1)
            return createSurfaceMaterial({
              color: baseWallColor,
              wireframe: options.wireframe,
              shadingMode: options.shadingMode,
              opacity: 0.98,
              map: wallTex.map,
              normalMap: wallTex.normalMap,
              roughnessMap: wallTex.roughnessMap,
              roughness: wallTex.roughness,
              metalness: wallTex.metalness,
              normalScale: wallTex.normalScale,
              envMapIntensity: 0.5,
            })
          })()
        : createMaterial(baseWallColor, {
            wireframe: options.wireframe,
            shadingMode: options.shadingMode,
            opacity: 0.98,
          })
    const segmentMesh = buildLinearWallWithOpenings({
      orientation: segment.axis,
      wallLength: segmentLength,
      thickness,
      openings,
      material: wallMaterial,
      options,
    })

    segmentMesh.name = `topology-wall-${index + 1}`
    if (segment.axis === 'horizontal') {
      segmentMesh.position.set((segment.start + segment.end) / 2, 0, segment.line)
    } else {
      segmentMesh.position.set(segment.line, 0, (segment.start + segment.end) / 2)
    }

    wallGroup.add(segmentMesh)
  })

  return wallGroup
}

function getExplicitWallOpenings(wall, globalOpenings) {
  const dx = wall.x2 - wall.x1
  const dz = wall.y2 - wall.y1

  if (!isAlignedWall(dx, dz)) {
    return []
  }

  if (Math.abs(dz) <= WALL_ALIGNMENT_TOLERANCE) {
    const line = (wall.y1 + wall.y2) / 2
    const start = Math.min(wall.x1, wall.x2)
    const end = Math.max(wall.x1, wall.x2)

    return globalOpenings
      .filter(
        (opening) =>
          opening.axis === 'horizontal' && Math.abs(opening.line - line) <= WALL_ALIGNMENT_TOLERANCE,
      )
      .map((opening) => {
        const overlapStart = Math.max(opening.start, start)
        const overlapEnd = Math.min(opening.end, end)
        const width = overlapEnd - overlapStart

        return {
          ...opening,
          width,
          position: ((overlapStart + overlapEnd) / 2 - start) / Math.max(end - start, 0.001),
        }
      })
      .filter((opening) => opening.width >= MIN_OPENING_SPAN)
  }

  const line = (wall.x1 + wall.x2) / 2
  const start = Math.min(wall.y1, wall.y2)
  const end = Math.max(wall.y1, wall.y2)

  return globalOpenings
    .filter(
      (opening) =>
        opening.axis === 'vertical' && Math.abs(opening.line - line) <= WALL_ALIGNMENT_TOLERANCE,
    )
    .map((opening) => {
      const overlapStart = Math.max(opening.start, start)
      const overlapEnd = Math.min(opening.end, end)
      const width = overlapEnd - overlapStart

      return {
        ...opening,
        width,
        position: ((overlapStart + overlapEnd) / 2 - start) / Math.max(end - start, 0.001),
      }
    })
    .filter((opening) => opening.width >= MIN_OPENING_SPAN)
}

function buildExplicitWalls(sceneGraph, options) {
  const wallGroup = new THREE.Group()
  wallGroup.name = 'explicit-wall-root'

  const explicitWalls = sceneGraph?.walls ?? []
  const globalOpenings = buildGlobalOpenings(sceneGraph)
  const material = createMaterial(EXPLICIT_WALL_COLOR, {
    wireframe: options.wireframe,
    shadingMode: options.shadingMode,
    opacity: 0.98,
  })

  explicitWalls.forEach((wall, index) => {
    const thickness = toPositiveNumber(wall.thickness, WALL_THICKNESS)
    const dx = wall.x2 - wall.x1
    const dz = wall.y2 - wall.y1
    const length = Math.hypot(dx, dz)

    if (length < MIN_PANEL_SPAN) {
      return
    }

    const isHorizontal = Math.abs(dz) <= WALL_ALIGNMENT_TOLERANCE
    const isVertical = Math.abs(dx) <= WALL_ALIGNMENT_TOLERANCE

    if (isHorizontal || isVertical) {
      const orientation = isHorizontal ? 'horizontal' : 'vertical'
      const openings = getExplicitWallOpenings(wall, globalOpenings)
      const alignedWall = buildLinearWallWithOpenings({
        orientation,
        wallLength: isHorizontal ? Math.abs(dx) : Math.abs(dz),
        thickness,
        openings,
        material,
        options,
      })

      alignedWall.name = `wall-${index + 1}`
      alignedWall.position.set((wall.x1 + wall.x2) / 2, 0, (wall.y1 + wall.y2) / 2)
      wallGroup.add(alignedWall)
      return
    }

    const diagonalWall = createMesh(
      new THREE.BoxGeometry(length, WALL_HEIGHT, thickness),
      material,
      options.shadowsEnabled,
    )
    diagonalWall.name = `wall-${index + 1}`
    diagonalWall.position.set((wall.x1 + wall.x2) / 2, WALL_HEIGHT / 2, (wall.y1 + wall.y2) / 2)
    diagonalWall.rotation.y = Math.atan2(dz, dx)
    wallGroup.add(diagonalWall)
  })

  return wallGroup
}

function buildWallWithOpenings(room, side, rawOpenings, options, material) {
  const { wireframe, shadingMode, shadowsEnabled } = options
  const wallGroup = new THREE.Group()
  wallGroup.name = `${side}-wall`

  const wallLength = getWallLength(room, side)
  const openings = normalizeWallOpenings(rawOpenings, wallLength)
  const orientation = side === 'north' || side === 'south' ? 'horizontal' : 'vertical'

  if (!openings.length) {
    const fullPanel = createWallPanel({
      room,
      side,
      wallLength,
      start: 0,
      end: wallLength,
      baseY: 0,
      height: WALL_HEIGHT,
      material,
      shadowsEnabled,
    })

    if (fullPanel) {
      wallGroup.add(fullPanel)
    }

    return wallGroup
  }

  let cursor = 0

  openings.forEach((opening) => {
    if (opening.start - cursor > MIN_PANEL_SPAN) {
      const leftSegment = createWallPanel({
        room,
        side,
        wallLength,
        start: cursor,
        end: opening.start,
        baseY: 0,
        height: WALL_HEIGHT,
        material,
        shadowsEnabled,
      })

      if (leftSegment) {
        wallGroup.add(leftSegment)
      }
    }

    if (opening.sillHeight > 0.02) {
      const bottomSegment = createWallPanel({
        room,
        side,
        wallLength,
        start: opening.start,
        end: opening.end,
        baseY: 0,
        height: opening.sillHeight,
        material,
        shadowsEnabled,
      })

      if (bottomSegment) {
        wallGroup.add(bottomSegment)
      }
    }

    if (opening.topY < WALL_HEIGHT - 0.02) {
      const topSegment = createWallPanel({
        room,
        side,
        wallLength,
        start: opening.start,
        end: opening.end,
        baseY: opening.topY,
        height: WALL_HEIGHT - opening.topY,
        material,
        shadowsEnabled,
      })

      if (topSegment) {
        wallGroup.add(topSegment)
      }
    }

    if (opening.type === 'window') {
      const glass = createWindowGlass({
        room,
        side,
        wallLength,
        opening,
        wireframe,
        shadingMode,
        style: options.style,
        shadowsEnabled,
      })

      if (glass) {
        wallGroup.add(glass)
      }
    }

    cursor = opening.end
  })

  if (wallLength - cursor > MIN_PANEL_SPAN) {
    const rightSegment = createWallPanel({
      room,
      side,
      wallLength,
      start: cursor,
      end: wallLength,
      baseY: 0,
      height: WALL_HEIGHT,
      material,
      shadowsEnabled,
    })

    if (rightSegment) {
      wallGroup.add(rightSegment)
    }
  }

  const featureGroup = buildLinearOpeningFeatures({
    orientation,
    wallLength,
    thickness: WALL_THICKNESS,
    openings,
    options: { wireframe, shadingMode, shadowsEnabled },
  })

  if (featureGroup.children.length) {
    if (orientation === 'horizontal') {
      featureGroup.position.z = side === 'north' ? -room.height / 2 : room.height / 2
    } else {
      featureGroup.position.x = side === 'east' ? room.width / 2 : -room.width / 2
    }

    wallGroup.add(featureGroup)
  }

  return wallGroup
}

function buildRoom(room, index, openingsIndex, options, { includeWalls = true } = {}) {
  const { wireframe, shadingMode, shadowsEnabled, roofVisible = true } = options
  const group = new THREE.Group()
  group.name = room.id || `room-${index + 1}`

  // Determine room kind for texture selection
  const roomKind = classifyRoomKind(room.name)

  // Floor material — use textures in standard mode
  let floorMaterial
  if (shadingMode === 'standard') {
    const repeatX = Math.max(1, Math.round(room.width / 2))
    const repeatZ = Math.max(1, Math.round(room.height / 2))
    const floorTex = getFloorTextureForRoom(roomKind, repeatX, repeatZ)
    floorMaterial = createSurfaceMaterial({
      color: getFloorColor(roomKind, options.style),
      wireframe,
      shadingMode,
      map: floorTex.map,
      normalMap: floorTex.normalMap,
      roughnessMap: floorTex.roughnessMap,
      roughness: floorTex.roughness,
      metalness: floorTex.metalness,
      normalScale: floorTex.normalScale,
    })
  } else {
    floorMaterial = createMaterial(getFloorColor(roomKind, options.style), {
      wireframe,
      shadingMode,
      shininess: 18,
    })
  }

  const floor = createMesh(
    new THREE.BoxGeometry(room.width, FLOOR_THICKNESS, room.height),
    floorMaterial,
    shadowsEnabled,
  )
  floor.name = `${group.name}-floor`
  floor.position.y = FLOOR_THICKNESS / 2

  const ceiling = createMesh(
    new THREE.BoxGeometry(room.width, CEILING_THICKNESS, room.height),
    createMaterial(getCeilingColor(roomKind, options.style), {
      wireframe,
      shadingMode,
      opacity: roofVisible ? 0.1 : 0.03,
      shininess: 6,
    }),
    shadowsEnabled,
  )
  ceiling.name = `${group.name}-ceiling`
  ceiling.position.y = WALL_HEIGHT

  group.add(floor, ceiling)
  addIfPresent(group, buildBaseboards(room, options))
  addIfPresent(group, buildRoomFurnishing(room, options))

  if (includeWalls) {
    const wallColor = getWallColor(roomKind, options.style)

    // Wall material — use plaster texture in standard mode
    let wallMaterial
    if (shadingMode === 'standard') {
      const wallTex = getWallTexture(2, 1)
      wallMaterial = createSurfaceMaterial({
        color: wallColor,
        wireframe,
        shadingMode,
        opacity: 0.98,
        map: wallTex.map,
        normalMap: wallTex.normalMap,
        roughnessMap: wallTex.roughnessMap,
        roughness: wallTex.roughness,
        metalness: wallTex.metalness,
        normalScale: wallTex.normalScale,
      })
    } else {
      wallMaterial = createMaterial(wallColor, {
        wireframe,
        shadingMode,
        opacity: 0.98,
      })
    }

    const roomOpenings = openingsIndex.get(room.id) ?? {
      north: [],
      south: [],
      east: [],
      west: [],
    }

    const northWall = buildWallWithOpenings(room, 'north', roomOpenings.north, options, wallMaterial)
    const southWall = buildWallWithOpenings(room, 'south', roomOpenings.south, options, wallMaterial)
    const eastWall = buildWallWithOpenings(room, 'east', roomOpenings.east, options, wallMaterial)
    const westWall = buildWallWithOpenings(room, 'west', roomOpenings.west, options, wallMaterial)

    group.add(northWall, southWall, eastWall, westWall)
  }

  group.position.set(room.x + room.width / 2, 0, room.y + room.height / 2)
  return group
}

export function buildSceneGroup(
  sceneGraph,
  {
    wireframe = false,
    shadingMode = 'phong',
    shadowsEnabled = true,
    roofVisible = true,
  } = {},
) {
  const root = new THREE.Group()
  root.name = 'building-root'

  const options = {
    wireframe,
    shadingMode,
    shadowsEnabled,
    roofVisible,
    style: sceneGraph?.style ?? {},
  }

  const rooms = sceneGraph?.rooms ?? []
  const openingsIndex = buildRoomOpeningsIndex(sceneGraph)
  const explicitWalls = sceneGraph?.walls ?? []
  const hasExplicitWalls = explicitWalls.length > 0
  const bounds = getSceneBounds(sceneGraph)

  if (!rooms.length && !hasExplicitWalls) {
    const placeholder = createMesh(
      new THREE.BoxGeometry(4, 0.06, 4),
      createMaterial('#334155', {
        wireframe,
        shadingMode,
        opacity: 0.65,
      }),
      shadowsEnabled,
    )
    placeholder.position.y = 0.03
    root.add(placeholder)
    return root
  }

  if (bounds) {
    addIfPresent(root, buildSiteContext(bounds, rooms, options))
    root.add(buildFoundation(bounds, options))
    addIfPresent(root, buildExteriorAccents(bounds, rooms, options))
  }

  rooms.forEach((room, index) => {
    root.add(buildRoom(room, index, openingsIndex, options, { includeWalls: false }))
  })

  if (rooms.length) {
    root.add(buildMergedWallTopology(sceneGraph, options))
  } else if (hasExplicitWalls) {
    root.add(buildExplicitWalls(sceneGraph, options))
  }

  if (roofVisible && bounds) {
    root.add(buildRoofDeck(bounds, options))
  }

  if (bounds) {
    root.position.set(-bounds.centerX, 0, -bounds.centerZ)
  } else {
    const center = new THREE.Vector3()
    const box = new THREE.Box3().setFromObject(root)
    box.getCenter(center)
    root.position.sub(center)
  }

  return root
}

export function disposeObject3D(object) {
  const geometries = new Set()
  const materials = new Set()

  object.traverse((node) => {
    if ('geometry' in node && node.geometry) {
      geometries.add(node.geometry)
    }

    if ('material' in node && node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach((material) => materials.add(material))
      } else {
        materials.add(node.material)
      }
    }
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}
