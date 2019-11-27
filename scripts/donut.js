//==============================================================================
// Welcome to scripting in Spark AR Studio! Helpful links:
//
// Scripting Basics - https://fb.me/spark-scripting-basics
// Reactive Programming - https://fb.me/spark-reactive-programming
// Scripting Object Reference - https://fb.me/spark-scripting-reference
// Changelogs - https://fb.me/spark-changelog
//==============================================================================

// How to load in modules
const console = require('Diagnostics')
const R = require('Reactive')
const Shaders = require('Shaders')
const Scene = require('Scene')
const root = Scene.root
const Animation = require('Animation')
const FaceTracking = require('FaceTracking')
const Time = require('Time')
const Audio = require('Audio')
const Materials = require('Materials')
const Textures = require('Textures')
const Patches = require('Patches')
const camera = root.child('Device').child('Camera')

// ---------------------------- util --------------------------------

const log = str => console.log(str)

const toggle = (element, hide) => (element.hidden = hide)
const show = element => toggle(element, false)
const hide = element => toggle(element, true)

// Not using yet
const showMultiple = elements => elements.forEach(show)
const hideMultiple = elements => elements.forEach(hide)

// random number generation
const randomNum = (lower, upper) => Math.floor(Math.random() * upper) + lower
const randomNumNoFloat = (lower, upper) => Math.random() * upper + lower
const randomNegativePostiive = num => {
  num *= Math.floor(Math.random() * 2) == 1 ? 1 : -1
  return num
}

// Update Text
const updateText = (element, text) => {
  if (typeof text !== 'string') {
    text = text.toString()
  }
  element.text = text
}

const randomElement = elements => elements[randomNum(0, elements.length)]
const retrieveNonActive = elements => elements.filter(e => !e.active)

const tween = (driverParams, sampler, from, to, onComplete) => {
  const driver = Animation.timeDriver(driverParams)
  const animSampler = Animation.samplers[sampler](from, to)
  const signal = Animation.animate(driver, animSampler)
  driver.start()
  if (onComplete) driver.onCompleted().subscribe(onComplete)
  return { signal: signal, driver: driver }
}

const scaleTween = (element, driverParams, sampler, from, to, axisArray) => {
  const anim = tween(driverParams, sampler, from, to)
  axisArray.forEach(axis => (element.transform['scale' + axis.toUpperCase()] = anim.signal))
}

const bounce = (element, duration, from, to) => {
  const driverParameters = {
    durationMilliseconds: duration / 2,
    loopCount: 2,
    mirror: true
  }
  return scaleTween(element, driverParameters, 'easeInOutQuad', from, to, ['x', 'y'])
}

const alphaTween = (material, duration, alpha1, alpha2) => {
  const driverParameters = {
    durationMilliseconds: duration,
    loopCount: 1,
    mirror: false
  }
  const anim = tween(driverParameters, 'linear', alpha1, alpha2)
  const alpha = anim.signal
  console.watch('alpha', alpha)
  const colorMix = R.mix(color1, color2, alpha)
  material.setTexture(colorMix, { textureSlotName: textureSlot })
}

// ------------------------ end of util -----------------------------

// ------------------------ Game settings  --------------------------

const donutsContainer = root.find('Donuts')
const donuts = []
const numDonuts = 8
for (let i = 1; i <= numDonuts; i++) {
  const element = root.find('Donut_' + i)
  donuts.push({ element, active: false, eaten: false })
}

// FACE stuff
const face = FaceTracking.face(0)
const mouth = face.mouth
const mouthCenter = mouth.center

// AUDIO
const chomp = Audio.getPlaybackController('chomp')
let isChompAudioPlaying = false

// SCORE TEXT
let scoreText = root.find('ScoreText')
let scoreMat = Materials.get('scoreTextMaterial')
const textureSlot = Shaders.DefaultMaterialTextures.DIFFUSE

const color1 = R.pack4(0, 0, 0, 1)
const color2 = R.pack4(0, 255, 0, 1)

// ---------------------------- Levels parameters -------------------------

let levelTextCanvas = camera.find('LevelTextCanvas')
let levelTextYStart = -200
let levelText = root.find('LevelText')
// need to find the transform of this - set the initial x,y

const level1 = {
  animationTime: 3000,
  spawnDelay: 1000
}

//reference to levels works by indexing
const levels = [level1]

// ---------------------------- Game State --------------------------------
let score = 0
let currentLevel = 0
let gameState
const scoreIncrement = 100

const collisionDistance = 0.15

const resetDonut = d => {
  d.eaten = false
  d.active = false

  if (d.animationDriver) {
    d.animationDriver.reset()
    // d.animationDriver.stop()
  }
}

const checkCollision = (mouthLastPosX, mouthLastPosY) => {
  donuts.forEach(donut => {
    const donutLastPosX = donut.element.transform.x.pinLastValue()
    const donutLastPosY = donut.element.transform.y.pinLastValue()

    donut.lastX = donutLastPosX
    donut.lastY = donutLastPosY
  })

  // checking if any of the donuts have collided
  donuts.forEach(donut => {
    if (collision(donut.lastX, donut.lastY, mouthLastPosX, mouthLastPosY, collisionDistance) && donut.eaten === false) {
      donutCollision(donut)
    }
  })
}

const donutCollision = d => {
  if (isChompAudioPlaying) {
    chomp.reset()
    chomp.setPlaying(isChompAudioPlaying)
  } else {
    isChompAudioPlaying = true
    chomp.setPlaying(isChompAudioPlaying)
  }
  bounce(scoreText, 1000, 1, 2)
  alphaTween(scoreMat, 200, 0, 1)
  alphaTween(scoreMat, 200, 1, 0)

  d.eaten = true
  hide(d.element)
  resetDonut(d)
  score += scoreIncrement
  updateText(scoreText, score)
}

//----------------------- ANIMATIONS --------------------------------------

// const ifCollision = (ax, ay, bx, by, coll) => {
//   return ax.sub(bx).lt(coll) && ay.sub(by).lt(coll)
// }

const collision = (x1, y1, x2, y2, distanceX) => {
  return Math.hypot(x2 - x1, y2 - y1) <= distanceX
}

let donutYStart = 0.5
// boundaries for spawning on X
const minX = -0.15
const maxX = 0.15

const initDonuts = donuts => {
  donuts.forEach((d, i) => {
    d.element.transform.y = donutYStart
    show(d.element)
  })
}

const dropDonut = (donut, animationTime) => {
  const donutTransform = donut.element.transform
  const donutPos = donutTransform.position

  let timeDriver = Animation.timeDriver({
    durationMilliseconds: 3000, // duration of drop from top to bottom
    loopCount: 1,
    mirror: false
  })
  const donutYSampler = Animation.samplers.linear(0.5, -0.5)
  const donutDropSignal = Animation.animate(timeDriver, donutYSampler)

  // Adding driver and animation to the donut
  donut.animationSignal = donutDropSignal
  donut.animationDriver = timeDriver
  donutTransform.y = donutDropSignal

  // random x starting point
  const randomX = randomNumNoFloat(minX, maxX)
  const randomNegPosX = randomNegativePostiive(randomX)
  donutTransform.x = randomNegPosX

  // rotate the donut
  const rotateDonutXSampler = Animation.samplers.linear(0, 20)
  const donutRotateSignal = Animation.animate(timeDriver, rotateDonutXSampler)
  donutTransform.rotationX = donutRotateSignal

  timeDriver.start()

  if (gameState != 'ended') {
    show(donut.element)
    donut.active = true
  }

  timeDriver.onCompleted().subscribe(e => {
    donut.active = false
    hide(donut.element)
  })

  return donut
}

//TODO; create a scoreAnim

const mouthOpen = mouth.openness.gt(0.3)

const mouthSub = mouthOpen.monitor().subscribe(e => {
  if (e.newValue) {
    const mouthLastPosX = mouthCenter.x.pinLastValue()
    const mouthLastPosY = mouthCenter.y.pinLastValue()
    checkCollision(mouthLastPosX, mouthLastPosY)
  }
})

const animateDonuts = (donuts, animationTime, spawnDelay) => {
  const nonActiveDonuts = retrieveNonActive(donuts)
  if (!nonActiveDonuts.length) {
    log('no donut to spawn')
    gameState = 'ended'
  } else {
    let currentDonut = randomElement(nonActiveDonuts)
    if (gameState == 'playing') {
      dropDonut(currentDonut, animationTime)
    }
  }

  const nextSpawnTimer = Time.setTimeout(() => {
    if (gameState == 'playing') {
      animateDonuts(donuts, levels[currentLevel].animationTime, levels[currentLevel].spawnDelay)
    }
  }, spawnDelay)

  return nextSpawnTimer
}

//----------------------- STARTS THE GAME -----------------------------

const startGame = () => {
  gameState = 'playing'
  updateText(scoreText, 0)
  // start with the first level values
  animateDonuts(donuts, levels[currentLevel].animationTime, levels[currentLevel].spawnDelay)
}

const countdown = () => {
  let sec = 3
  Time.setInterval(() => {
    updateText(levelText, sec)
    sec -= 1
    if (sec < 0) {
      hide(levelTextCanvas)
      Time.clearInterval
    }
  }, 1000)
}

const initGame = () => {
  updateText(scoreText, 'Open mouth to catch')
  initDonuts(donuts)
  levelTextCanvas.y = levelTextYStart
  show(levelTextCanvas)
  countdown()
  show(donutsContainer)
  currentLevel = 0 // which means level 1, when indexing
  gameState = 'not_started'
  Time.setTimeout(() => {
    startGame()
  }, 3500)
}

// THIS STARTS THE GAME // but only once a  face has been found - and is only triggered once anyway  trigger(1)
FaceTracking.count.trigger(1).subscribe(e => {
  initGame()
})

hide(donutsContainer)
hide(levelTextCanvas)
