// Let's call the head and torso tier 1 parts, and the limbs tier 2.
//
// Rules:
// -> HP change in any part will affect the total only if the HP of that part is above 0.
// -> If any tier 2 part is less than 0, add its negative value to the torso.
// -> If either tier 1 part is less than 0, add its negative value to the other tier 1 part.

const hitPointsHandler = {
  hpTotal: document.querySelector('[data-hp="total"]'),
  hpTier1: document.querySelectorAll('[data-tier="1"]'),
  hpTier2: document.querySelectorAll('[data-tier="2"]'),
  resetBtn: document.querySelector('[data-hp="reset"]'),
  
  deathConditions: {
    total: x => x <= 0,
    // head: x => x < -30,
    // torso: x => x < -30
  },

  initialHitPoints: {
    "head": {
      "value": 20,
      "severed": false
    },
    "torso": {
      "value": 30,
      "severed": false
    },
    "arm-left": {
      "value": 10,
      "severed": false
    },
    "arm-right": {
      "value": 10,
      "severed": false
    },
    "leg-left": {
      "value": 15,
      "severed": false
    },
    "leg-right": {
      "value": 15,
      "severed": false
    }
  },
  hitPoints: {},
  
  initialize() {
    // Set up values and render them:
    this.reset() 
    
    // Bind these event handlers to the right scope:
    let handleInputChange = this.handleInputChange.bind(this)
    let reset = this.reset.bind(this)
    
    // Set up event listeners:
    document.addEventListener('change', handleInputChange)
    this.resetBtn.addEventListener('click', reset)
  },

  reset() {
    let that = this
    
    // Overwrite the current hitPoints object with initial values:
    that.hitPoints = JSON.parse(JSON.stringify(that.initialHitPoints))
    // And then render it:
    this.renderValues(that.hitPoints)
    // Make sure everything is rendered as reattached, too:
    Object.keys(that.hitPoints).map((part) => {
      if (document.querySelector(`[data-sever="${part}"]`))
        document.querySelector(`[data-sever="${part}"]`).checked = false
      that.handleDismemberment(that.hitPoints, part)
    })
  },
  
  handleInputChange(event) {
    if (!event.target.getAttribute('data-hp') && !event.target.getAttribute('data-sever')) return
    
    if (event.target.getAttribute('data-hp')) {
      let changedPart = event.target.getAttribute('data-hp')
      let tier = event.target.getAttribute('data-tier')
      let partStartingValue = this.hitPoints[changedPart]['value']
      
      // Update the hit points for the body part in question:
      this.hitPoints[changedPart]['value'] = parseInt(event.target.value)
      
      // Hand off the update to calculate what else it affects:
      this.calculateValues(
        this.hitPoints,
        changedPart,
        tier,
        partStartingValue
      )
    }
    
    if (event.target.getAttribute('data-sever')) {
      let affectedPart = event.target.getAttribute('data-sever')
      this.hitPoints[affectedPart]['severed'] = event.target.checked
      this.handleDismemberment(this.hitPoints, affectedPart)
    }
    
  },
  
  handleCascade(hitPoints, cascadeTarget, prevValue, updatedValue) {
    let increment = prevValue - updatedValue
    let targetValue = hitPoints[cascadeTarget]['value']
    let isOverMaximum = (x, target) => x > this.initialHitPoints[target]['value']

    console.log(`handleCascade for ${cascadeTarget}: ${prevValue} is changing to ${updatedValue}`)
    
    // Handle a decrease:
    if (increment > 0 && updatedValue < 0) {
      if (prevValue >= 0) {
        hitPoints[cascadeTarget]['value'] += updatedValue
      } else {
        hitPoints[cascadeTarget]['value'] -= increment
      }
    }

    // Handle an increase:
    if (increment < 0 && prevValue < 0) {
      if (updatedValue >= 0) {
        hitPoints[cascadeTarget]['value'] = isOverMaximum(targetValue - prevValue, cascadeTarget)
          ? this.initialHitPoints[cascadeTarget]['value']
          : targetValue - prevValue
      } else {
        hitPoints[cascadeTarget]['value'] = isOverMaximum(targetValue - increment, cascadeTarget)
          ? this.initialHitPoints[cascadeTarget]['value']
          : targetValue - increment
      }
    }
  },
  
  calculateValues(hitPoints, changedPart, tier, prevValue) {
    let updatedValue = hitPoints[changedPart]['value']
    
    // Determine if the torso is getting impacted by limb damage
    if (parseInt(tier) === 2) {
      let torsoPrevValue = hitPoints['torso']['value']
      this.handleCascade(hitPoints, 'torso', prevValue, updatedValue)
      
      // Determine if this will also affect the head
      this.handleCascade(hitPoints, 'head', torsoPrevValue, hitPoints['torso']['value'])
    }
    
    // Determine if the head or torso is affecting the other
    if (parseInt(tier) === 1) {
      let cascadeTarget = changedPart === 'head' ? 'torso' : 'head'
      this.handleCascade(hitPoints, cascadeTarget, prevValue, updatedValue)
    }
    
    this.renderValues(hitPoints)
  },
  
  renderValues(hitPoints) {
    // Render each body part's hit points according to the values in the hitPoints object:
    for (let part in hitPoints) {
      if (hitPoints.hasOwnProperty(part)) {
        document.querySelector(`[data-hp=${part}]`).value = hitPoints[part]['value']
      }
    }
    // And finally update the hit point total:
    this.updateTotal(hitPoints)
  },
  
  updateTotal(hitPoints) {
    let pointsSum = Object.values(hitPoints).reduce(
      (acc, part) => {
        // HP change in any part will affect the total 
        // only if the HP of that part is above 0, and
        // if that part is not dismembered.
        return (part['value'] > 0 && !part['severed']) 
          ? acc + part['value']
          : acc
      },
      0
    )
    // Render the updated total:
    this.hpTotal.value = pointsSum
    // And now check to see if you are still alive:
    this.handleAliveness(hitPoints, pointsSum)
  },
  
  handleDismemberment(hitPoints, affectedPart) {
    let isSevered = hitPoints[affectedPart]['severed']
    let affectedPartValue = hitPoints[affectedPart]['value']
    console.log('heard handleDismemberment for', affectedPart, isSevered)
    console.log('how many hp does ', affectedPart, 'have remaining?', affectedPartValue)

    this.calculateValues(
      hitPoints,
      affectedPart,
      2,
      0
    )

    isSevered
      ? document.querySelector(`[data-hp="${affectedPart}"]`).setAttribute('disabled', true)
      : document.querySelector(`[data-hp="${affectedPart}"]`).removeAttribute('disabled')
  },
  
  handleAliveness(hitPoints, total) {
    if (this.deathConditions['total'](total)) {
      document.querySelector('[data-alive]').setAttribute('data-alive', false)
      document.querySelector('[data-hp="total"]').classList.add('is-dead')
      // You're dead, get out
      return
    }
    
    // Do any of the values in the current hitPoints object match any deathConditions?
    for (let part in this.deathConditions) {
      // Only check the parts in hitPoints that are mentioned in deathConditions:
      if (hitPoints.hasOwnProperty(part)) {
        if (this.deathConditions[part](hitPoints[part])) {
          document.querySelector('[data-alive]').setAttribute('data-alive', false)
          document.querySelector(`[data-hp="${part}"]`).classList.add('is-dead')
          // You're dead, get out
          return
        }
      }
    }
    
    // Made it this far? Guess you're still alive, good job!
    document.querySelector('[data-alive]').setAttribute('data-alive', true)
    ;[...document.querySelectorAll('[data-hp]')].map((element) => {
      element.classList.remove('is-dead')
    })
  }
}


hitPointsHandler.initialize()
