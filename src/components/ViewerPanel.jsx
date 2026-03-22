import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { createCameraControls } from '../three/CameraControls'
import {
  ENVIRONMENT_PRESETS,
  applyEnvironmentPreset,
  fitLightingToBounds,
  setupDefaultLighting,
  setupSceneEnvironment,
  updateLightingRig,
} from '../three/LightingSetup'
import { createRenderer, resizeRenderer } from '../three/Renderer'
import { buildSceneGroup, disposeObject3D } from '../three/SceneBuilder'
import { clearTextureCache } from '../three/TextureFactory'
import Minimap from './Minimap'
import Toolbar from './Toolbar'

const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(1.08, 0.8, 0.94).normalize()
const INITIAL_SHADOWS_ENABLED = true
const INITIAL_LIGHT_INTENSITY = 1
const INITIAL_ENVIRONMENT_PRESET = ENVIRONMENT_PRESETS[0]?.id ?? 'courtyard-sun'
const UI_SYNC_INTERVAL_MS = 110
const FLYTHROUGH_SEGMENT_MS = 2200
const WALKTHROUGH_EYE_HEIGHT = 1.68
const CAMERA_NEAR = 0.03
const PERSPECTIVE_MAX_POLAR = Math.PI - 0.08
const WALKTHROUGH_MAX_POLAR = Math.PI - 0.18
const INTERIOR_CUTAWAY_MARGIN = 0.28
const INTERIOR_CUTAWAY_DISTANCE = 3.4
const MIN_CAMERA_HEIGHT = 0.45

function easeInOutQuad(value) {
  if (value < 0.5) {
    return 2 * value * value
  }

  return 1 - (-2 * value + 2) ** 2 / 2
}

function buildRoomLayout(sceneGraph) {
  const rooms = sceneGraph?.rooms ?? []

  if (!rooms.length) {
    return { centeredRooms: [], waypoints: [] }
  }

  const minX = Math.min(...rooms.map((room) => room.x))
  const maxX = Math.max(...rooms.map((room) => room.x + room.width))
  const minZ = Math.min(...rooms.map((room) => room.y))
  const maxZ = Math.max(...rooms.map((room) => room.y + room.height))

  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2

  const centeredRooms = rooms.map((room) => {
    const roomCenterX = room.x + room.width / 2 - centerX
    const roomCenterZ = room.y + room.height / 2 - centerZ

    return {
      id: room.id,
      name: room.name,
      color: room.color,
      x: room.x - centerX,
      z: room.y - centerZ,
      width: room.width,
      depth: room.height,
      centerX: roomCenterX,
      centerZ: roomCenterZ,
    }
  })

  const waypoints = centeredRooms.map((room, index) => {
    const next = centeredRooms[(index + 1) % centeredRooms.length] ?? room
    let directionX = next.centerX - room.centerX
    let directionZ = next.centerZ - room.centerZ

    const magnitude = Math.hypot(directionX, directionZ)
    if (magnitude < 0.0001) {
      directionX = 0.86
      directionZ = 0.52
    } else {
      directionX /= magnitude
      directionZ /= magnitude
    }

    return {
      id: room.id,
      target: new THREE.Vector3(room.centerX, 1.42, room.centerZ),
      camera: new THREE.Vector3(room.centerX - directionX * 1.3, 1.72, room.centerZ - directionZ * 1.3),
    }
  })

  return { centeredRooms, waypoints }
}

function buildWalkthroughPose(rooms) {
  const preferredRoom =
    rooms.find((room) => /entrance|porch|verand|living|lounge/i.test(room.name)) ?? rooms[0]

  if (!preferredRoom) {
    return {
      position: new THREE.Vector3(0, WALKTHROUGH_EYE_HEIGHT, 4.5),
      target: new THREE.Vector3(0, WALKTHROUGH_EYE_HEIGHT, 0),
    }
  }

  const maxOffset = Math.max(preferredRoom.depth / 2 - 0.36, 0.18)
  const forwardOffset = Math.min(Math.max(preferredRoom.depth * 0.18, 0.42), maxOffset)

  return {
    position: new THREE.Vector3(
      preferredRoom.centerX,
      WALKTHROUGH_EYE_HEIGHT,
      preferredRoom.centerZ + forwardOffset,
    ),
    target: new THREE.Vector3(
      preferredRoom.centerX,
      WALKTHROUGH_EYE_HEIGHT,
      preferredRoom.centerZ,
    ),
  }
}

function findNearestRoomId(rooms, position) {
  if (!rooms.length) {
    return ''
  }

  let nearestRoomId = rooms[0].id
  let nearestDistance = Number.POSITIVE_INFINITY

  rooms.forEach((room) => {
    const distance = Math.hypot(position.x - room.centerX, position.z - room.centerZ)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestRoomId = room.id
    }
  })

  return nearestRoomId
}

function setRoomLabelState(element, isActive) {
  element.className = `room-label${isActive ? ' room-label-active' : ''}`
}

function createRoomLabel(room, isActive) {
  const element = document.createElement('div')
  element.textContent = room.name
  setRoomLabelState(element, isActive)

  const label = new CSS2DObject(element)
  label.position.set(room.centerX, 1.56, room.centerZ)
  label.name = `${room.id}-label`

  return { id: room.id, label, element }
}

function syncRoomLabels(labelObjects, activeRoomId) {
  labelObjects.forEach(({ id, element }) => {
    setRoomLabelState(element, id === activeRoomId)
  })
}

function getBoundsMetrics(bounds) {
  if (!bounds || bounds.isEmpty()) {
    return null
  }

  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bounds.getCenter(center)
  bounds.getSize(size)

  return {
    center,
    size,
    planSpan: Math.max(size.x, size.z, 1),
    radius: Math.max(size.length() / 2, 1),
  }
}

function configureOrbitControls(camera, controls, bounds, { topView = false, closeRange = false } = {}) {
  if (!camera || !controls) {
    return
  }

  const metrics = getBoundsMetrics(bounds)
  const planSpan = metrics?.planSpan ?? 12
  const radius = metrics?.radius ?? 12

  if (metrics) {
    controls.cursor.copy(metrics.center)
  }

  controls.minDistance = closeRange ? 0.06 : 0.12
  controls.maxDistance = topView
    ? Math.max(planSpan * 3.4, 18)
    : closeRange
      ? Math.max(planSpan * 1.7, 10)
      : Math.max(radius * 5.4, 40)
  controls.maxTargetRadius = topView
    ? Math.max(planSpan * 1.2, 8)
    : closeRange
      ? Math.max(planSpan * 1.1, 6)
      : Math.max(planSpan * 2.2, 16)
  controls.panSpeed = closeRange ? 1.12 : 0.95
  controls.rotateSpeed = closeRange ? 0.7 : 0.8
  controls.zoomSpeed = closeRange ? 1.28 : 1.15
  controls.dampingFactor = closeRange ? 0.11 : 0.09
  controls.minPolarAngle = topView ? 0 : 0.02
  controls.maxPolarAngle = topView ? Math.PI / 2 : closeRange ? WALKTHROUGH_MAX_POLAR : PERSPECTIVE_MAX_POLAR

  camera.near = CAMERA_NEAR
  camera.far = Math.max(320, radius * 15)
  camera.updateProjectionMatrix()
}

function isPointInsideFootprint(point, bounds, margin = 0) {
  if (!point || !bounds || bounds.isEmpty()) {
    return false
  }

  return (
    point.x >= bounds.min.x - margin &&
    point.x <= bounds.max.x + margin &&
    point.z >= bounds.min.z - margin &&
    point.z <= bounds.max.z + margin
  )
}

function shouldUseInteriorCutaway(camera, controls, bounds, holdCutaway = false) {
  if (!camera || !controls || !bounds || bounds.isEmpty()) {
    return false
  }

  const metrics = getBoundsMetrics(bounds)
  if (!metrics) {
    return false
  }

  const margin = holdCutaway ? INTERIOR_CUTAWAY_MARGIN * 1.75 : INTERIOR_CUTAWAY_MARGIN
  const closeDistance = holdCutaway ? INTERIOR_CUTAWAY_DISTANCE * 1.2 : INTERIOR_CUTAWAY_DISTANCE
  const indoorHeight = bounds.min.y + Math.min(metrics.size.y * 0.88, 3.6)
  const cameraInside = isPointInsideFootprint(camera.position, bounds, margin)
  const targetInside = isPointInsideFootprint(controls.target, bounds, margin)
  const closeToFocus = camera.position.distanceTo(controls.target) <= Math.max(closeDistance, metrics.planSpan * 0.36)
  const lowEnough = camera.position.y <= indoorHeight || controls.target.y <= WALKTHROUGH_EYE_HEIGHT + 0.35

  return lowEnough && (cameraInside || targetInside || closeToFocus)
}

function isRoofObject(object) {
  let current = object

  while (current) {
    if (current.name === 'roof-root' || current.name.startsWith('roof-')) {
      return true
    }

    current = current.parent
  }

  return false
}

function isCeilingObject(object) {
  let current = object

  while (current) {
    if (current.name?.endsWith('-ceiling')) {
      return true
    }

    current = current.parent
  }

  return false
}

function focusCameraOnPoint(camera, controls, point, bounds, { closeRange = false } = {}) {
  if (!camera || !controls || !point) {
    return
  }

  const metrics = getBoundsMetrics(bounds)
  const planSpan = metrics?.planSpan ?? 12
  const direction = new THREE.Vector3().subVectors(camera.position, point)

  if (direction.lengthSq() < 0.0001) {
    direction.copy(DEFAULT_VIEW_DIRECTION)
  } else {
    direction.normalize()
  }

  const distanceToPoint = camera.position.distanceTo(point)
  const focusDistance = closeRange
    ? THREE.MathUtils.clamp(distanceToPoint * 0.42, 0.85, Math.max(planSpan * 0.24, 2.1))
    : THREE.MathUtils.clamp(distanceToPoint * 0.7, 1.4, Math.max(planSpan * 0.72, 6.5))
  const nextTarget = point.clone()

  if (closeRange && nextTarget.y < WALKTHROUGH_EYE_HEIGHT - 0.12) {
    nextTarget.y = WALKTHROUGH_EYE_HEIGHT - 0.12
  }

  const nextPosition = point.clone().addScaledVector(direction, focusDistance)
  nextPosition.y = Math.max(
    closeRange && nextPosition.y < WALKTHROUGH_EYE_HEIGHT - 0.18 ? WALKTHROUGH_EYE_HEIGHT : nextPosition.y,
    MIN_CAMERA_HEIGHT,
  )

  camera.position.copy(nextPosition)
  controls.target.copy(nextTarget)
  controls.update()
}

function framePerspectiveCamera(camera, controls, bounds) {
  if (!camera || !controls || !bounds || bounds.isEmpty()) {
    return
  }

  const metrics = getBoundsMetrics(bounds)
  if (!metrics) {
    return
  }

  const { center, size } = metrics
  configureOrbitControls(camera, controls, bounds)

  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
  const fitHeightDistance = size.y / 2 / Math.tan(verticalFov / 2)
  const fitWidthDistance = size.x / 2 / Math.tan(horizontalFov / 2)
  const fitDepthDistance = size.z / 2 / Math.tan(verticalFov / 2)
  const distance =
    Math.max(fitHeightDistance * 1.14, fitWidthDistance, fitDepthDistance) + Math.max(size.y, 4.5) * 0.82

  camera.position.copy(center).addScaledVector(DEFAULT_VIEW_DIRECTION, distance)
  controls.target.set(center.x, center.y + Math.min(size.y * 0.22, 1.4), center.z)
  camera.far = Math.max(320, distance * 6)
  camera.updateProjectionMatrix()
  controls.update()
}

function frameTopCamera(camera, controls, bounds) {
  if (!camera || !controls || !bounds || bounds.isEmpty()) {
    return
  }

  const metrics = getBoundsMetrics(bounds)
  if (!metrics) {
    return
  }

  const { center, size } = metrics
  configureOrbitControls(camera, controls, bounds, { topView: true })

  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const distanceForDepth = size.z / 2 / Math.tan(verticalFov / 2)
  const distanceForWidth = size.x / 2 / (Math.tan(verticalFov / 2) * camera.aspect)
  const height = Math.max(distanceForDepth, distanceForWidth) * 1.28 + size.y

  camera.position.set(center.x, center.y + height, center.z + 0.001)
  camera.lookAt(center)
  controls.target.copy(center)
  camera.far = Math.max(320, height * 5)
  camera.updateProjectionMatrix()
  controls.update()
}

function ViewerPanel({ sceneGraph, isLoading }) {
  const panelRef = useRef(null)
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const roomRootRef = useRef(null)
  const lightingRigRef = useRef(null)
  const labelRendererRef = useRef(null)
  const labelObjectsRef = useRef([])
  const centeredRoomsRef = useRef([])
  const sceneBoundsRef = useRef(null)
  const pendingCameraFrameRef = useRef(true)
  const gridRef = useRef(null)
  const renderFrameRef = useRef(0)
  const flythroughFrameRef = useRef(0)
  const uiSyncTimestampRef = useRef(0)
  const walkthroughActiveRef = useRef(false)
  const flythroughActiveRef = useRef(false)
  const viewModeRef = useRef('perspective')
  const interiorCutawayActiveRef = useRef(false)

  const [viewMode, setViewMode] = useState('perspective')
  const [shadingMode, setShadingMode] = useState('standard')
  const [wireframe, setWireframe] = useState(false)
  const [roofVisible, setRoofVisible] = useState(true)
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [shadowsEnabled, setShadowsEnabled] = useState(INITIAL_SHADOWS_ENABLED)
  const [lightIntensity, setLightIntensity] = useState(INITIAL_LIGHT_INTENSITY)
  const [environmentPreset, setEnvironmentPreset] = useState(INITIAL_ENVIRONMENT_PRESET)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFlythroughRunning, setIsFlythroughRunning] = useState(false)
  const [walkthroughEnabled, setWalkthroughEnabled] = useState(false)
  const [activeRoomId, setActiveRoomId] = useState('')
  const [cameraPosition, setCameraPosition] = useState({ x: 0, z: 0 })
  const [interiorCutawayActive, setInteriorCutawayActive] = useState(false)

  const roomLayout = useMemo(() => buildRoomLayout(sceneGraph), [sceneGraph])
  const displayedActiveRoomId = activeRoomId || roomLayout.centeredRooms[0]?.id || ''
  const walkthroughActive =
    walkthroughEnabled && viewMode === 'perspective' && roomLayout.centeredRooms.length > 0
  const flythroughActive =
    isFlythroughRunning &&
    !walkthroughActive &&
    viewMode === 'perspective' &&
    roomLayout.waypoints.length >= 2
  const effectiveRoofVisible =
    roofVisible && viewMode !== 'top' && !flythroughActive && !walkthroughActive && !interiorCutawayActive

  const resetCamera = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const sceneBounds = sceneBoundsRef.current

    if (!camera || !controls) {
      return
    }

    if (viewMode === 'top') {
      setInteriorCutawayActive(false)
      frameTopCamera(camera, controls, sceneBounds)
      return
    }

    if (walkthroughActive) {
      const pose = buildWalkthroughPose(roomLayout.centeredRooms)
      configureOrbitControls(camera, controls, sceneBounds, { closeRange: true })
      camera.position.copy(pose.position)
      controls.target.copy(pose.target)
      controls.update()
      setInteriorCutawayActive(true)
      return
    }

    if (sceneBounds?.isBox3 && !sceneBounds.isEmpty()) {
      setInteriorCutawayActive(false)
      framePerspectiveCamera(camera, controls, sceneBounds)
      return
    }

    camera.position.set(14, 9, 14)
    controls.target.set(0, 0, 0)
    controls.update()
    setInteriorCutawayActive(false)
  }

  const handleToggleFlythrough = () => {
    if (roomLayout.waypoints.length < 2) {
      return
    }

    if (walkthroughEnabled) {
      setWalkthroughEnabled(false)
    }

    if (!isFlythroughRunning && viewMode !== 'perspective') {
      setViewMode('perspective')
    }

    setIsFlythroughRunning((current) => !current)
  }

  const handleToggleWalkthrough = () => {
    if (!roomLayout.centeredRooms.length) {
      return
    }

    if (isFlythroughRunning) {
      setIsFlythroughRunning(false)
    }

    if (!walkthroughEnabled && viewMode !== 'perspective') {
      setViewMode('perspective')
    }

    setWalkthroughEnabled((current) => !current)
  }

  const handleToggleFullscreen = async () => {
    const panel = panelRef.current

    if (!panel) {
      return
    }

    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen()
        return
      }

      await panel.requestFullscreen()
    } catch (error) {
      console.warn('[FloorGPT] Fullscreen toggle failed.', error)
    }
  }

  useEffect(() => {
    centeredRoomsRef.current = roomLayout.centeredRooms
  }, [roomLayout.centeredRooms])

  useEffect(() => {
    pendingCameraFrameRef.current = true
  }, [sceneGraph])

  useEffect(() => {
    walkthroughActiveRef.current = walkthroughActive
    flythroughActiveRef.current = flythroughActive
    viewModeRef.current = viewMode
    interiorCutawayActiveRef.current = interiorCutawayActive
  }, [flythroughActive, interiorCutawayActive, viewMode, walkthroughActive])

  useEffect(() => {
    const panel = panelRef.current

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panel)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current

    if (!container || !canvas) {
      return undefined
    }

    const width = container.clientWidth || 1
    const height = container.clientHeight || 1

    const renderer = createRenderer(canvas, width, height)
    renderer.domElement.tabIndex = 0

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(width, height)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.inset = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    labelRenderer.domElement.style.zIndex = '20'
    container.appendChild(labelRenderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog('#dfeaf5', 52, 168)

    const camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 300)
    camera.position.set(14, 9, 14)

    const controls = createCameraControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)

    const roomRoot = new THREE.Group()
    roomRoot.name = 'room-root'
    scene.add(roomRoot)

    const grid = new THREE.GridHelper(42, 42, '#94A3B8', '#CBD5E1')
    grid.position.y = -0.02
    grid.visible = false
    scene.add(grid)

    const lightingRig = setupDefaultLighting(scene, {
      shadowsEnabled: INITIAL_SHADOWS_ENABLED,
    })
    updateLightingRig(lightingRig, {
      lightIntensity: INITIAL_LIGHT_INTENSITY,
      shadowsEnabled: INITIAL_SHADOWS_ENABLED,
    })

    // Set up PMREM environment map for PBR reflections
    setupSceneEnvironment(scene, renderer)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    labelRendererRef.current = labelRenderer
    controlsRef.current = controls
    roomRootRef.current = roomRoot
    lightingRigRef.current = lightingRig
    gridRef.current = grid

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = container.clientWidth || 1
      const nextHeight = container.clientHeight || 1
      resizeRenderer(renderer, camera, nextWidth, nextHeight)
      labelRenderer.setSize(nextWidth, nextHeight)
    })
    resizeObserver.observe(container)

    const renderLoop = (timestamp = 0) => {
      if (controls.enabled) {
        controls.update()
      }

      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)

      if (timestamp - uiSyncTimestampRef.current >= UI_SYNC_INTERVAL_MS) {
        const nextActiveRoomId = findNearestRoomId(centeredRoomsRef.current, camera.position)
        const nextInteriorCutawayActive =
          walkthroughActiveRef.current ||
          (viewModeRef.current === 'perspective' &&
            !flythroughActiveRef.current &&
            shouldUseInteriorCutaway(camera, controls, sceneBoundsRef.current, interiorCutawayActiveRef.current))
        setCameraPosition({ x: camera.position.x, z: camera.position.z })
        setActiveRoomId((current) => (current === nextActiveRoomId ? current : nextActiveRoomId))
        setInteriorCutawayActive((current) => {
          if (current === nextInteriorCutawayActive) {
            return current
          }

          interiorCutawayActiveRef.current = nextInteriorCutawayActive
          return nextInteriorCutawayActive
        })
        uiSyncTimestampRef.current = timestamp
      }

      renderFrameRef.current = window.requestAnimationFrame(renderLoop)
    }

    renderFrameRef.current = window.requestAnimationFrame(renderLoop)

    return () => {
      window.cancelAnimationFrame(renderFrameRef.current)
      window.cancelAnimationFrame(flythroughFrameRef.current)
      resizeObserver.disconnect()

      controls.dispose()
      labelObjectsRef.current.forEach(({ label }) => label.removeFromParent())
      labelObjectsRef.current = []
      disposeObject3D(scene)
      const environmentMaps = new Set([
        scene.environment,
        scene.userData.loadedEnvironmentMap,
        scene.userData.environmentMap,
      ])
      environmentMaps.forEach((environmentMap) => {
        if (environmentMap?.dispose) {
          environmentMap.dispose()
        }
      })
      if (scene.environment) {
        scene.environment = null
      }
      scene.clear()
      renderer.dispose()
      labelRenderer.domElement.remove()
      clearTextureCache()

      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      labelRendererRef.current = null
      controlsRef.current = null
      roomRootRef.current = null
      lightingRigRef.current = null
      sceneBoundsRef.current = null
      gridRef.current = null
    }
  }, [])

  useEffect(() => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    const roomRoot = roomRootRef.current

    if (!renderer || !camera || !controls || !roomRoot) {
      return undefined
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

    const handleDoubleClick = (event) => {
      if (viewMode !== 'perspective' || flythroughActive) {
        return
      }

      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)

      const intersections = raycaster.intersectObject(roomRoot, true)
      const preferredHit =
        intersections.find(
          (hit) =>
            hit.point.y <= WALKTHROUGH_EYE_HEIGHT + 0.35 &&
            !isRoofObject(hit.object) &&
            !isCeilingObject(hit.object),
        ) ??
        intersections.find((hit) => !isRoofObject(hit.object) && !isCeilingObject(hit.object)) ??
        intersections[0]

      const focusPoint = preferredHit?.point?.clone() ?? new THREE.Vector3()
      if (!preferredHit && !raycaster.ray.intersectPlane(groundPlane, focusPoint)) {
        return
      }

      const prefersInteriorFocus = focusPoint.y <= WALKTHROUGH_EYE_HEIGHT + 0.35
      const closeRange =
        walkthroughActive ||
        prefersInteriorFocus ||
        shouldUseInteriorCutaway(camera, controls, sceneBoundsRef.current, interiorCutawayActiveRef.current)

      focusCameraOnPoint(camera, controls, focusPoint, sceneBoundsRef.current, { closeRange })

      const nextInteriorCutawayActive =
        walkthroughActive ||
        prefersInteriorFocus ||
        shouldUseInteriorCutaway(camera, controls, sceneBoundsRef.current, interiorCutawayActiveRef.current)
      setInteriorCutawayActive((current) => {
        if (current === nextInteriorCutawayActive) {
          return current
        }

        interiorCutawayActiveRef.current = nextInteriorCutawayActive
        return nextInteriorCutawayActive
      })
    }

    renderer.domElement.addEventListener('dblclick', handleDoubleClick)

    return () => {
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [flythroughActive, viewMode, walkthroughActive])

  useEffect(() => {
    const roomRoot = roomRootRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    const lightingRig = lightingRigRef.current
    if (!roomRoot) {
      return
    }

    while (roomRoot.children.length) {
      const child = roomRoot.children[0]
      roomRoot.remove(child)
      disposeObject3D(child)
    }

    labelObjectsRef.current.forEach(({ label }) => label.removeFromParent())
    labelObjectsRef.current = []

    const nextGroup = buildSceneGroup(sceneGraph, {
      wireframe,
      shadingMode,
      roofVisible: effectiveRoofVisible,
      shadowsEnabled,
    })
    roomRoot.add(nextGroup)

    const nextBounds = new THREE.Box3().setFromObject(nextGroup)
    sceneBoundsRef.current = nextBounds

    if (lightingRig) {
      fitLightingToBounds(lightingRig, nextBounds)
    }

    if (camera && controls && pendingCameraFrameRef.current && !walkthroughActive && !flythroughActive) {
      if (viewMode === 'top') {
        frameTopCamera(camera, controls, nextBounds)
      } else {
        framePerspectiveCamera(camera, controls, nextBounds)
      }
      pendingCameraFrameRef.current = false
    }

    if (!walkthroughActive && labelsVisible) {
      labelObjectsRef.current = roomLayout.centeredRooms.map((room) => {
        const roomLabel = createRoomLabel(room, room.id === displayedActiveRoomId)
        roomRoot.add(roomLabel.label)
        return roomLabel
      })
    }
  }, [
    displayedActiveRoomId,
    effectiveRoofVisible,
    roomLayout.centeredRooms,
    sceneGraph,
    shadingMode,
    shadowsEnabled,
    flythroughActive,
    labelsVisible,
    walkthroughActive,
    viewMode,
    wireframe,
  ])

  useEffect(() => {
    const scene = sceneRef.current
    const renderer = rendererRef.current

    if (!scene || !renderer) {
      return
    }

    applyEnvironmentPreset(scene, renderer, environmentPreset).catch((error) => {
      console.warn('[FloorGPT] Environment preset update failed.', error)
    })
  }, [environmentPreset])

  useEffect(() => {
    const labelRenderer = labelRendererRef.current

    if (!labelRenderer) {
      return
    }

    labelRenderer.domElement.style.display = labelsVisible ? 'block' : 'none'
  }, [labelsVisible])

  useEffect(() => {
    syncRoomLabels(labelObjectsRef.current, displayedActiveRoomId)
  }, [displayedActiveRoomId])

  useEffect(() => {
    const lightingRig = lightingRigRef.current
    const renderer = rendererRef.current

    if (!lightingRig || !renderer) {
      return
    }

    updateLightingRig(lightingRig, { lightIntensity, shadowsEnabled })
    renderer.shadowMap.enabled = shadowsEnabled
    renderer.shadowMap.needsUpdate = true
  }, [lightIntensity, shadowsEnabled])

  useEffect(() => {
    const grid = gridRef.current

    if (!grid) {
      return
    }

    grid.visible = wireframe || viewMode === 'top'
  }, [viewMode, wireframe])

  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const sceneBounds = sceneBoundsRef.current

    if (!camera || !controls) {
      return
    }

    if (viewMode === 'top') {
      controls.enabled = true
      frameTopCamera(camera, controls, sceneBounds)
      return
    }

    if (flythroughActive) {
      controls.enabled = false
      return
    }

    if (walkthroughActive) {
      controls.enabled = true
      configureOrbitControls(camera, controls, sceneBounds, { closeRange: true })
      const pose = buildWalkthroughPose(roomLayout.centeredRooms)
      camera.position.copy(pose.position)
      controls.target.copy(pose.target)
      controls.update()
      return
    }

    controls.enabled = true
    framePerspectiveCamera(camera, controls, sceneBounds)
  }, [flythroughActive, roomLayout.centeredRooms, walkthroughActive, viewMode])

  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const waypoints = roomLayout.waypoints

    if (!camera || !controls) {
      return undefined
    }

    const shouldRunFlythrough =
      isFlythroughRunning &&
      !walkthroughActive &&
      viewMode === 'perspective' &&
      waypoints.length >= 2

    if (!shouldRunFlythrough) {
      return undefined
    }

    controls.enabled = false

    let cancelled = false
    let waypointIndex = 0
    let fromPosition = camera.position.clone()
    let fromTarget = controls.target.clone()
    let toWaypoint = waypoints[waypointIndex]
    let segmentStart = performance.now()
    let initialized = false

    const runFlythrough = (timestamp) => {
      if (cancelled) {
        return
      }

      if (!initialized) {
        setActiveRoomId(toWaypoint.id)
        initialized = true
      }

      const progressRaw = Math.min((timestamp - segmentStart) / FLYTHROUGH_SEGMENT_MS, 1)
      const progress = easeInOutQuad(progressRaw)

      camera.position.lerpVectors(fromPosition, toWaypoint.camera, progress)
      controls.target.lerpVectors(fromTarget, toWaypoint.target, progress)

      if (progressRaw >= 1) {
        waypointIndex = (waypointIndex + 1) % waypoints.length
        fromPosition = camera.position.clone()
        fromTarget = controls.target.clone()
        toWaypoint = waypoints[waypointIndex]
        segmentStart = timestamp
        setActiveRoomId(toWaypoint.id)
      }

      flythroughFrameRef.current = window.requestAnimationFrame(runFlythrough)
    }

    flythroughFrameRef.current = window.requestAnimationFrame(runFlythrough)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(flythroughFrameRef.current)
    }
  }, [isFlythroughRunning, roomLayout.waypoints, walkthroughActive, viewMode])

  const handleChangeViewMode = (nextViewMode) => {
    if (nextViewMode === 'top') {
      if (isFlythroughRunning) {
        setIsFlythroughRunning(false)
      }

      if (walkthroughEnabled) {
        setWalkthroughEnabled(false)
      }
    }

    setViewMode(nextViewMode)
  }

  return (
    <section
      ref={panelRef}
      className={`viewer-panel panel relative overflow-hidden ${
        isFullscreen ? 'h-screen rounded-none border-0' : 'h-[560px]'
      }`}
    >
      <div className="absolute inset-x-0 top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="panel-title">3D viewer</h2>
            <p className="panel-subtitle mt-1">Procedural interior and exterior scene rendered in WebGL.</p>
          </div>

          <Toolbar
            viewMode={viewMode}
            onChangeViewMode={handleChangeViewMode}
            environmentPreset={environmentPreset}
            environmentOptions={ENVIRONMENT_PRESETS}
            onChangeEnvironmentPreset={setEnvironmentPreset}
            labelsVisible={labelsVisible}
            onToggleLabels={() => setLabelsVisible((current) => !current)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            shadingMode={shadingMode}
            onChangeShadingMode={setShadingMode}
            wireframe={wireframe}
            onToggleWireframe={() => setWireframe((current) => !current)}
            roofVisible={roofVisible}
            onToggleRoof={() => setRoofVisible((current) => !current)}
            shadowsEnabled={shadowsEnabled}
            onToggleShadows={() => setShadowsEnabled((current) => !current)}
            lightIntensity={lightIntensity}
            onChangeLightIntensity={setLightIntensity}
            isFlythroughRunning={flythroughActive}
            canFlythrough={roomLayout.waypoints.length > 1}
            onToggleFlythrough={handleToggleFlythrough}
            isWalkthroughRunning={walkthroughActive}
            canWalkthrough={roomLayout.centeredRooms.length > 0}
            onToggleWalkthrough={handleToggleWalkthrough}
            onResetCamera={resetCamera}
          />
        </div>
      </div>

      <div ref={containerRef} className="absolute inset-x-0 bottom-0 top-[84px]">
        <canvas ref={canvasRef} className="h-full w-full" />

        <Minimap
          rooms={roomLayout.centeredRooms}
          cameraPosition={cameraPosition}
          activeRoomId={displayedActiveRoomId}
        />

        {walkthroughActive ? (
          <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-cyan-500/40 bg-slate-950/85 px-3 py-2 text-xs text-cyan-100">
            Walkthrough: drag to look around, scroll to move in or out, and right-drag to slide through rooms.
          </div>
        ) : viewMode === 'perspective' && !flythroughActive ? (
          <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-slate-700/70 bg-slate-950/78 px-3 py-2 text-xs text-slate-200">
            Mouse guide: scroll zooms to the cursor, right-drag pans, and double-click refocuses the camera.
          </div>
        ) : null}

        {isLoading ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl border border-cyan-500/40 bg-slate-950/90 px-3 py-2 text-xs text-cyan-100">
            Building scene geometry from parsed plan...
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default ViewerPanel
