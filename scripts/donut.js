/**
 * (c) Facebook, Inc. and its affiliates. Confidential and proprietary.
 */

//==============================================================================
// Welcome to scripting in Spark AR Studio! Helpful links:
//
// Scripting Basics - https://fb.me/spark-scripting-basics
// Reactive Programming - https://fb.me/spark-reactive-programming
// Scripting Object Reference - https://fb.me/spark-scripting-reference
// Changelogs - https://fb.me/spark-changelog
//==============================================================================

// How to load in modules
const Diagnostics = require('Diagnostics')
const Reactive = require('Reactive')
const Scene = require('Scene')
const root = Scene.root
const Animation = require('Animation')
const FaceTracking = require('FaceTracking')
const Time = require('Time')
const Audio = require('Audio')

// ---------------------------- util --------------------------------

const log = str => Diagnostics.log(str)

const toggle = (element, hide) => (element.hidden = hide)
const hide = element => toggle(element, true)
const show = element => toggle(element, false)

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

// ------------------------ end of util -----------------------------

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
let scorePlusContainer = root.find('scorePlusContainer')
let scoreText = root.find('ScoreText')

// ---------------------------- Levels parameters -------------------------

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

const donutCollision = d => {
  if (isChompAudioPlaying) {
    chomp.reset()
    chomp.setPlaying(isChompAudioPlaying)
  } else {
    isChompAudioPlaying = true
    chomp.setPlaying(isChompAudioPlaying)
  }
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
  const rotateDonutXSampler = Animation.samplers.easeInCubic(0, 20)
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
  // start with the first level values
  animateDonuts(donuts, levels[currentLevel].animationTime, levels[currentLevel].spawnDelay)
}

const initGame = () => {
  initDonuts(donuts)
  show(donutsContainer)
  currentLevel = 0 // which means level 1, when indexing
  updateText(scoreText, 0)
  gameState = 'not_started'
  // randomizeDonuts(donuts)  - not sure I need one...
  startGame()
}

// THIS STARTS THE GAME // but only once a  face has been found
// only do this once
FaceTracking.count.trigger(1).subscribe(e => {
  Time.setTimeout(() => {
    initGame()
  }, 1000)
})

hide(donutsContainer)

// ---------CODE THAT IS BEING USED / HAS BEEN REFACTORED-----------

// const donutYSampler = Animation.samplers.linear(0.5, -0.5)
// const donutDropAnimation = Animation.animate(timeDriver, donutYSampler)

//  --------- ROTATION STUFF - may be partly used later on ---------

// const rotateDonutXSampler = Animation.samplers.linear(0, 10)
// const donutRotateAnimation = Animation.animate(timeDriver, rotateDonutXSampler)
// donut1Transform.rotationX = donutRotateAnimation
// donut1Transform.x = x

// --------------OLD CODE---------------

// const randomiseXValue = () => {
//   let x = Math.random() * 0.3 - 0.15
//   return x
// }

// const update = () => {
//   x = randomiseXValue()
//   donut1Transform.x = x
//   show(donut1)
// }

// const timeDriver = Animation.timeDriver({
//   durationMilliseconds: 3000, // duration of drop from top to bottom
//   loopCount: Infinity,
//   mirror: false
// })
