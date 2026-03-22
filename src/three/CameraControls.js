import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function createCameraControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.09
  controls.enablePan = true
  controls.screenSpacePanning = true
  controls.panSpeed = 1
  controls.rotateSpeed = 0.8
  controls.zoomSpeed = 1.15
  controls.minDistance = 0.12
  controls.maxDistance = 96
  controls.minPolarAngle = 0.02
  controls.maxPolarAngle = Math.PI - 0.08
  controls.zoomToCursor = true
  controls.cursorStyle = 'grab'

  return controls
}
