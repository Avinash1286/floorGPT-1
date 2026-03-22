import { z } from 'zod'
import { getRoomColor, withValidatedHexColor } from '../utils/colorPalette'
import { clampNormalizedPosition } from '../utils/geometryHelpers'
import { createEmptySceneGraph } from '../utils/sceneBuilder'

const looseArraySchema = z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(z.unknown()))

const roomSchema = z
  .object({
    id: z.string().optional().default(''),
    name: z.string().optional().default('Room'),
    x: z.coerce.number().default(0),
    y: z.coerce.number().default(0),
    width: z.coerce.number().positive().default(4),
    height: z.coerce.number().positive().default(3),
    color: z.string().optional(),
  })
  .passthrough()

const wallSchema = z
  .object({
    x1: z.coerce.number(),
    y1: z.coerce.number(),
    x2: z.coerce.number(),
    y2: z.coerce.number(),
    thickness: z.coerce.number().positive().default(0.15),
  })
  .passthrough()

const doorSchema = z
  .object({
    room_id: z.string().optional().default(''),
    wall: z.string().optional().default('north'),
    position: z.coerce.number().default(0.5),
    width: z.coerce.number().positive().default(0.9),
    height: z.coerce.number().positive().optional(),
  })
  .passthrough()

const windowSchema = z
  .object({
    room_id: z.string().optional().default(''),
    wall: z.string().optional().default('north'),
    position: z.coerce.number().default(0.5),
    width: z.coerce.number().positive().default(1.2),
    height: z.coerce.number().positive().optional(),
    sillHeight: z.coerce.number().nonnegative().optional(),
  })
  .passthrough()

const metadataSchema = z
  .object({
    totalArea: z.coerce.number().optional(),
    roomCount: z.coerce.number().optional(),
    floors: z.coerce.number().optional(),
  })
  .passthrough()

const stylePaletteSchema = z
  .object({
    base: z.string().optional(),
    accent: z.string().optional(),
    trim: z.string().optional(),
    roof: z.string().optional(),
    glass: z.string().optional(),
    hardscape: z.string().optional(),
    landscape: z.string().optional(),
  })
  .passthrough()

const styleMassingSchema = z
  .object({
    upperLevel: z.coerce.boolean().optional(),
    upperLevelWidthFactor: z.coerce.number().optional(),
    upperLevelDepthFactor: z.coerce.number().optional(),
    upperLevelOffsetX: z.coerce.number().optional(),
    upperLevelOffsetZ: z.coerce.number().optional(),
    upperLevelHeight: z.coerce.number().optional(),
  })
  .passthrough()

const styleFacadeSchema = z
  .object({
    columnCount: z.coerce.number().optional(),
    columnWidth: z.coerce.number().optional(),
    columnStyle: z.string().optional(),
    canopyDepth: z.coerce.number().optional(),
    balcony: z.coerce.boolean().optional(),
    balconyWidthFactor: z.coerce.number().optional(),
    balconyDepth: z.coerce.number().optional(),
    frontWindowColumns: z.coerce.number().optional(),
    railingPattern: z.string().optional(),
    sideScreen: z.coerce.boolean().optional(),
    parapetProfile: z.string().optional(),
    accentWallSide: z.string().optional(),
    accentWallWidth: z.coerce.number().optional(),
    accentWallDepth: z.coerce.number().optional(),
    steps: z.coerce.number().optional(),
    hasFacadeBands: z.coerce.boolean().optional(),
    carport: z.coerce.boolean().optional(),
    terrace: z.coerce.boolean().optional(),
    railing: z.coerce.boolean().optional(),
  })
  .passthrough()

const styleInteriorSchema = z
  .object({
    theme: z.string().optional(),
    furnishingDensity: z.string().optional(),
  })
  .passthrough()

const styleSchema = z
  .object({
    hasExteriorReference: z.coerce.boolean().optional(),
    confidence: z.coerce.number().optional(),
    referenceSummary: z.string().optional(),
    palette: stylePaletteSchema.optional(),
    massing: styleMassingSchema.optional(),
    facade: styleFacadeSchema.optional(),
    interior: styleInteriorSchema.optional(),
  })
  .passthrough()

const sceneGraphSchema = z
  .object({
    scale: z.string().optional().default('1 unit = 1 meter'),
    rooms: looseArraySchema.default([]),
    walls: looseArraySchema.default([]),
    doors: looseArraySchema.default([]),
    windows: looseArraySchema.default([]),
    style: z.unknown().optional(),
    metadata: z.unknown().optional(),
  })
  .passthrough()

function formatIssues(issues) {
  return issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.join('.') || 'root'
      return `${path}: ${issue.message}`
    })
    .join(' | ')
}

function normalizeWallName(value) {
  const safeValue = typeof value === 'string' ? value.toLowerCase().trim() : ''
  return ['north', 'south', 'east', 'west'].includes(safeValue) ? safeValue : 'north'
}

function clampNumber(value, min, max, fallback) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return Math.min(Math.max(numberValue, min), max)
}

function normalizeArrayItems(items, schema, mapper) {
  return items.flatMap((item, index) => {
    const parsedItem = schema.safeParse(item)
    if (!parsedItem.success) {
      return []
    }

    return [mapper(parsedItem.data, index)]
  })
}

export function normalizeSceneGraph(input) {
  let source = input

  if (typeof input === 'string') {
    try {
      source = JSON.parse(input)
    } catch {
      throw new Error('Scene payload is not valid JSON.')
    }
  }

  if (!source || typeof source !== 'object') {
    throw new Error('Scene payload is invalid. Expected a JSON object.')
  }

  const parsed = sceneGraphSchema.safeParse(source)
  if (!parsed.success) {
    throw new Error(`Scene validation failed: ${formatIssues(parsed.error.issues)}`)
  }

  const normalizedRooms = normalizeArrayItems(parsed.data.rooms, roomSchema, (room, index) => {
    const name = room.name?.trim() || `Room ${index + 1}`
    return {
      ...room,
      id: room.id || `room_${index + 1}`,
      name,
      color: withValidatedHexColor(getRoomColor(name, index, room.color)),
    }
  })

  if (!normalizedRooms.length) {
    throw new Error('No valid rooms were detected in the parsed floor plan output.')
  }

  const normalizedWalls = normalizeArrayItems(parsed.data.walls, wallSchema, (wall) => ({
    ...wall,
    thickness: wall.thickness > 0 ? wall.thickness : 0.15,
  }))

  const normalizedDoors = normalizeArrayItems(parsed.data.doors, doorSchema, (door) => ({
    ...door,
    wall: normalizeWallName(door.wall),
    position: clampNormalizedPosition(door.position),
    width: Math.max(0.4, door.width),
    height: Number.isFinite(door.height) ? Math.max(1.8, door.height) : undefined,
  }))

  const normalizedWindows = normalizeArrayItems(parsed.data.windows, windowSchema, (windowData) => ({
    ...windowData,
    wall: normalizeWallName(windowData.wall),
    position: clampNormalizedPosition(windowData.position),
    width: Math.max(0.4, windowData.width),
    height: Number.isFinite(windowData.height) ? Math.max(0.5, windowData.height) : undefined,
    sillHeight: Number.isFinite(windowData.sillHeight)
      ? Math.max(0, windowData.sillHeight)
      : undefined,
  }))

  const derivedArea = normalizedRooms.reduce((sum, room) => sum + room.width * room.height, 0)
  const parsedMetadata = metadataSchema.safeParse(parsed.data.metadata)
  const normalizedMetadata = parsedMetadata.success ? parsedMetadata.data : {}
  const parsedStyle = styleSchema.safeParse(parsed.data.style)
  const normalizedStyle = parsedStyle.success ? parsedStyle.data : {}

  const metadata = {
    totalArea:
      typeof normalizedMetadata.totalArea === 'number'
        ? normalizedMetadata.totalArea
        : Number(derivedArea.toFixed(2)),
    roomCount: normalizedRooms.length,
    floors: normalizedMetadata.floors ?? 1,
  }

  const style = {
    hasExteriorReference: Boolean(normalizedStyle.hasExteriorReference),
    confidence: clampNumber(normalizedStyle.confidence, 0, 1, 0),
    referenceSummary: normalizedStyle.referenceSummary?.trim?.() || '',
    palette: {
      base: normalizedStyle.palette?.base
        ? withValidatedHexColor(normalizedStyle.palette.base, '#F8FAFC')
        : undefined,
      accent: normalizedStyle.palette?.accent
        ? withValidatedHexColor(normalizedStyle.palette.accent, '#475569')
        : undefined,
      trim: normalizedStyle.palette?.trim
        ? withValidatedHexColor(normalizedStyle.palette.trim, '#CBD5E1')
        : undefined,
      roof: normalizedStyle.palette?.roof
        ? withValidatedHexColor(normalizedStyle.palette.roof, '#334155')
        : undefined,
      glass: normalizedStyle.palette?.glass
        ? withValidatedHexColor(normalizedStyle.palette.glass, '#BFDBFE')
        : undefined,
      hardscape: normalizedStyle.palette?.hardscape
        ? withValidatedHexColor(normalizedStyle.palette.hardscape, '#D6D3D1')
        : undefined,
      landscape: normalizedStyle.palette?.landscape
        ? withValidatedHexColor(normalizedStyle.palette.landscape, '#7CB342')
        : undefined,
    },
    massing: {
      upperLevel: Boolean(normalizedStyle.massing?.upperLevel),
      upperLevelWidthFactor: clampNumber(normalizedStyle.massing?.upperLevelWidthFactor, 0.25, 0.85, 0.52),
      upperLevelDepthFactor: clampNumber(normalizedStyle.massing?.upperLevelDepthFactor, 0.25, 0.85, 0.34),
      upperLevelOffsetX: clampNumber(normalizedStyle.massing?.upperLevelOffsetX, -0.35, 0.35, 0.14),
      upperLevelOffsetZ: clampNumber(normalizedStyle.massing?.upperLevelOffsetZ, -0.35, 0.35, -0.08),
      upperLevelHeight: clampNumber(normalizedStyle.massing?.upperLevelHeight, 2.2, 3.8, 2.9),
    },
    facade: {
      columnCount: clampNumber(normalizedStyle.facade?.columnCount, 0, 6, 4),
      columnWidth: clampNumber(normalizedStyle.facade?.columnWidth, 0.16, 0.5, 0.24),
      columnStyle: normalizedStyle.facade?.columnStyle?.trim?.().toLowerCase?.() || 'banded-square',
      canopyDepth: clampNumber(normalizedStyle.facade?.canopyDepth, 0.8, 3.2, 1.9),
      balcony: Boolean(normalizedStyle.facade?.balcony),
      balconyWidthFactor: clampNumber(normalizedStyle.facade?.balconyWidthFactor, 0.2, 0.9, 0.52),
      balconyDepth: clampNumber(normalizedStyle.facade?.balconyDepth, 0.7, 2.4, 1.35),
      frontWindowColumns: clampNumber(normalizedStyle.facade?.frontWindowColumns, 2, 5, 3),
      railingPattern:
        normalizedStyle.facade?.railingPattern?.trim?.().toLowerCase?.() === 'posts'
          ? 'posts'
          : 'horizontal-bars',
      sideScreen:
        typeof normalizedStyle.facade?.sideScreen === 'boolean'
          ? normalizedStyle.facade.sideScreen
          : true,
      parapetProfile:
        normalizedStyle.facade?.parapetProfile?.trim?.().toLowerCase?.() === 'flush'
          ? 'flush'
          : 'capped',
      accentWallSide: ['north', 'south', 'east', 'west'].includes(
        String(normalizedStyle.facade?.accentWallSide ?? '').toLowerCase().trim(),
      )
        ? String(normalizedStyle.facade?.accentWallSide).toLowerCase().trim()
        : 'east',
      accentWallWidth: clampNumber(normalizedStyle.facade?.accentWallWidth, 0.3, 2.2, 0.9),
      accentWallDepth: clampNumber(normalizedStyle.facade?.accentWallDepth, 0.1, 0.7, 0.24),
      steps: clampNumber(normalizedStyle.facade?.steps, 0, 8, 4),
      hasFacadeBands: Boolean(normalizedStyle.facade?.hasFacadeBands),
      carport: Boolean(normalizedStyle.facade?.carport),
      terrace: Boolean(normalizedStyle.facade?.terrace),
      railing: Boolean(normalizedStyle.facade?.railing),
    },
    interior: {
      theme: normalizedStyle.interior?.theme?.trim?.() || '',
      furnishingDensity: normalizedStyle.interior?.furnishingDensity?.trim?.().toLowerCase?.() || '',
    },
  }

  return {
    ...createEmptySceneGraph(),
    ...parsed.data,
    rooms: normalizedRooms,
    walls: normalizedWalls,
    doors: normalizedDoors,
    windows: normalizedWindows,
    style,
    metadata,
  }
}
