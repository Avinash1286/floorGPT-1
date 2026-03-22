import { getRoomColor } from './colorPalette'

function buildWallsFromRooms(rooms) {
  return rooms.flatMap((room) => {
    const x1 = room.x
    const y1 = room.y
    const x2 = room.x + room.width
    const y2 = room.y + room.height

    return [
      { x1, y1, x2, y2: y1, thickness: 0.15 },
      { x1: x2, y1, x2, y2, thickness: 0.15 },
      { x1: x2, y1: y2, x2: x1, y2, thickness: 0.15 },
      { x1, y1: y2, x2: x1, y2: y1, thickness: 0.15 },
    ]
  })
}

export function createEmptySceneGraph() {
  return {
    scale: '1 unit = 1 meter',
    rooms: [],
    walls: [],
    doors: [],
    windows: [],
    style: {
      hasExteriorReference: false,
      confidence: 0,
      referenceSummary: '',
      palette: {},
      massing: {},
      facade: {},
      interior: {},
    },
    metadata: {
      totalArea: 0,
      roomCount: 0,
      floors: 1,
    },
  }
}

export function createMockSceneGraph(sourceName = 'sample-floorplan') {
  const baseRooms = [
    { id: 'room_1', name: 'Living Room', x: 0, y: 0, width: 5.8, height: 4.2 },
    { id: 'room_2', name: 'Kitchen', x: 5.8, y: 0, width: 3.2, height: 3.4 },
    { id: 'room_3', name: 'Bedroom', x: 0, y: 4.2, width: 4.4, height: 3.6 },
    { id: 'room_4', name: 'Bathroom', x: 4.4, y: 4.2, width: 2.1, height: 2.3 },
  ]

  const rooms = baseRooms.map((room, index) => ({
    ...room,
    color: getRoomColor(room.name, index),
  }))

  const walls = buildWallsFromRooms(rooms)
  const totalArea = rooms.reduce((sum, room) => sum + room.width * room.height, 0)

  return {
    scale: '1 unit = 1 meter (estimated)',
    rooms,
    walls,
    doors: [
      { room_id: 'room_1', wall: 'east', position: 0.35, width: 0.9, height: 2.1 },
      { room_id: 'room_3', wall: 'south', position: 0.45, width: 0.8, height: 2.0 },
    ],
    windows: [
      {
        room_id: 'room_1',
        wall: 'north',
        position: 0.5,
        width: 1.4,
        height: 1.2,
        sillHeight: 1.0,
      },
      {
        room_id: 'room_2',
        wall: 'east',
        position: 0.4,
        width: 1.2,
        height: 1.1,
        sillHeight: 0.95,
      },
    ],
    style: {
      hasExteriorReference: false,
      confidence: 0,
      referenceSummary: 'Mock floor plan scene',
      palette: {},
      massing: {},
      facade: {},
      interior: {},
    },
    metadata: {
      source: sourceName,
      totalArea: Number(totalArea.toFixed(2)),
      roomCount: rooms.length,
      floors: 1,
    },
  }
}

export function buildSceneMetrics(sceneGraph) {
  const rooms = sceneGraph?.rooms ?? []
  const totalAreaFromRooms = rooms.reduce((total, room) => {
    const area = Number(room.width) * Number(room.height)
    return Number.isFinite(area) ? total + area : total
  }, 0)

  const totalArea =
    typeof sceneGraph?.metadata?.totalArea === 'number'
      ? sceneGraph.metadata.totalArea
      : totalAreaFromRooms

  return {
    roomCount: rooms.length,
    wallCount: sceneGraph?.walls?.length ?? 0,
    totalArea: Number(totalArea.toFixed(1)),
  }
}
