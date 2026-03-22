import { useMemo } from 'react'

const MINIMAP_WIDTH = 230
const MINIMAP_HEIGHT = 168
const PADDING = 12

function Minimap({ rooms, cameraPosition, activeRoomId }) {
  const layout = useMemo(() => {
    if (!rooms.length) {
      return {
        rooms: [],
        camera: { x: MINIMAP_WIDTH / 2, y: MINIMAP_HEIGHT / 2 },
      }
    }

    const minX = Math.min(...rooms.map((room) => room.x))
    const maxX = Math.max(...rooms.map((room) => room.x + room.width))
    const minZ = Math.min(...rooms.map((room) => room.z))
    const maxZ = Math.max(...rooms.map((room) => room.z + room.depth))

    const spanX = Math.max(maxX - minX, 1)
    const spanZ = Math.max(maxZ - minZ, 1)

    const availableWidth = MINIMAP_WIDTH - PADDING * 2
    const availableHeight = MINIMAP_HEIGHT - PADDING * 2

    const scale = Math.min(availableWidth / spanX, availableHeight / spanZ)
    const contentWidth = spanX * scale
    const contentHeight = spanZ * scale
    const offsetX = (MINIMAP_WIDTH - contentWidth) / 2
    const offsetY = (MINIMAP_HEIGHT - contentHeight) / 2

    const toViewX = (worldX) => offsetX + (worldX - minX) * scale
    const toViewY = (worldZ) => offsetY + (worldZ - minZ) * scale
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

    return {
      rooms: rooms.map((room) => ({
        ...room,
        viewX: toViewX(room.x),
        viewY: toViewY(room.z),
        viewWidth: room.width * scale,
        viewHeight: room.depth * scale,
      })),
      camera: {
        x: clamp(toViewX(cameraPosition.x), 6, MINIMAP_WIDTH - 6),
        y: clamp(toViewY(cameraPosition.z), 6, MINIMAP_HEIGHT - 6),
      },
    }
  }, [cameraPosition.x, cameraPosition.z, rooms])

  return (
    <aside className="pointer-events-none absolute bottom-4 right-4 z-30 w-[230px] overflow-hidden rounded-xl border border-slate-700/90 bg-slate-950/85 shadow-lg shadow-black/30 backdrop-blur-sm">
      <div className="border-b border-slate-700/80 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Minimap</p>
      </div>

      <svg viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`} className="h-[168px] w-full bg-slate-950">
        <rect x="0" y="0" width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} fill="#020617" />

        {layout.rooms.map((room) => (
          <g key={room.id}>
            <rect
              x={room.viewX}
              y={room.viewY}
              width={Math.max(room.viewWidth, 3)}
              height={Math.max(room.viewHeight, 3)}
              fill={room.color}
              fillOpacity={activeRoomId === room.id ? 0.78 : 0.58}
              stroke={activeRoomId === room.id ? '#22d3ee' : '#94a3b8'}
              strokeOpacity={activeRoomId === room.id ? 0.9 : 0.5}
              strokeWidth={activeRoomId === room.id ? 1.8 : 1}
              rx="2"
            />
          </g>
        ))}

        <circle cx={layout.camera.x} cy={layout.camera.y} r="3.5" fill="#22d3ee" />
      </svg>
    </aside>
  )
}

export default Minimap