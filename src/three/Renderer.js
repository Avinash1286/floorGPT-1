import * as THREE from 'three'

export function createRenderer(canvas, width, height) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  })

  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = true
  renderer.useLegacyLights = false

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)

  return renderer
}

export function resizeRenderer(renderer, camera, width, height) {
  const nextWidth = Math.max(1, width)
  const nextHeight = Math.max(1, height)

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(nextWidth, nextHeight, false)

  camera.aspect = nextWidth / nextHeight
  camera.updateProjectionMatrix()
}
