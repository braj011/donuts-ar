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

let hide = false
let x = 0

const face = FaceTracking.face(0)

const mouth = face.mouth
const mouthCenter = mouth.center

const donut1 = root.find('Donut_01')
const donut1Transform = donut1.transform
const donut1Pos = donut1Transform.position
const collisionDistance = 0.25

const timeDriverParameters = {
  durationMilliseconds: 5000,
  loopCount: Infinity,
  mirror: false
}

const timeDriver = Animation.timeDriver(timeDriverParameters)

// may need to use the RotationSampler...? - https://sparkar.facebook.com/ar-studio/learn/documentation/reference/classes/animationmodule.rotationsampler
// No Docs for it

const ifCollision = (a, b, coll) => {
  return a.x.sub(b.x).lt(coll) && a.y.sub(b.y).lt(coll)
}

mouth.openness.monitor().subscribe(e => {
  if (e.newValue > 0.5) {
    hide = ifCollision(mouthCenter, donut1Pos, collisionDistance)
    donut1.hidden = hide
  }
})

const changeXValue = () => {
  x = Math.random() * 0.3 - 0.15
  return x
}

const update = () => {
  x = changeXValue()
  donut1Transform.x = x
  hide = false
  donut1.hidden = hide
}

const donutYSampler = Animation.samplers.linear(0.5, -0.5)
const rotateDonutXSampler = Animation.samplers.linear(0, 10)

const donutDropAnimation = Animation.animate(timeDriver, donutYSampler)
const donutRotateAnimation = Animation.animate(timeDriver, rotateDonutXSampler)

donut1Transform.y = donutDropAnimation
donut1Transform.rotationX = donutRotateAnimation
donut1Transform.x = x

timeDriver.start()
timeDriver.onAfterIteration().subscribe(update)
