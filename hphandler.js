// I'm probably making this overly complicated, but let's call the head and torso tier 1 parts, and the limbs tier 2.
//
// Rules:
// -> HP change in any part will affect the total only if the HP of that part is above 0.
// -> If any tier 2 part is less than 0, add its negative value to the torso.
// -> If either tier 1 part is less than 0, add its negative value to the other tier 1 part.
// -> If a limb is dismembered while its HP is above 0, its value is subtracted from the total.

const hitPointsHandler = {
  hpTotal: document.querySelector('[data-hp-id="total"]'),
  hpTier1: document.querySelectorAll('[data-tier="1"]'),
  hpTier2: document.querySelectorAll('[data-tier="2"]'),
  resetBtn: document.querySelector('[data-hp-id="reset"]'),

  deathConditions: {
    total: x => x <= 0,
  },

  strIsTrue(string) {
    return string.toLowerCase() == 'true'
  },

  initialize() {
    // Create the hitPoints object:
    this.hitPoints = Object.create({})

    // Set up values and render them:
    this.reset() 

    // Bind these event handlers to the right scope:
    let handleInputChange = this.handleInputChange.bind(this)
    let reset = this.reset.bind(this)

    // Set up event listeners:
    document.addEventListener('change', handleInputChange)
    this.resetBtn.addEventListener('click', reset)

    // Click on an svg part to bring focus to its corresponding field:
    document.addEventListener('click', function(e) {
      if (!e.target.hasAttribute('data-svg-id')) return
      let hpId = e.target.getAttribute('data-svg-id')
      document.querySelector(`[data-hp-id="${hpId}"]`).focus()
    })
  },

  reset() {
    let self = this

    // Overwrite the current hitPoints object with initial values:
    fetch('initialHitPoints.json')
      .then(response => response.text())
      .then(data => {
        let hp = JSON.parse(data)
        self.hitPoints = hp

        // And then render it:
        self.renderValues(self.hitPoints)

        // Set upper bounds:
        self.setInputMaximums(self.hitPoints)

        // And render default state of limb attachment:
        Object.keys(self.hitPoints).map((part) => {
          if (document.querySelector(`[data-sever="${part}"]`)) {
            let limbToggle = document.querySelector(`[data-sever="${part}"]`)
            // limbToggle.checked = self.strIsTrue(limbToggle.getAttribute('data-sever-init'))
            limbToggle.checked = self.hitPoints[part]['severed']
          }
          self.handleDismemberment(self.hitPoints, part)
        })
      })

  },

  setInputMaximums(hitPoints) {
    for (let part in hitPoints) {
      if (hitPoints.hasOwnProperty(part)) {
        document.querySelector(`[data-hp-id=${part}]`).setAttribute('max', hitPoints[part]['value']) 
      }
    }
  },

  handleInputChange(event) {
    if (!event.target.getAttribute('data-hp-id') && !event.target.getAttribute('data-sever')) return

    if (event.target.getAttribute('data-hp-id')) {
      let changedPart = event.target.getAttribute('data-hp-id')
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

  handleCascade(
    hitPoints,
    cascadeTarget,
    prevValue,
    updatedValue
  ) {
    let increment = prevValue - updatedValue
    let targetValue = hitPoints[cascadeTarget]['value']
    let isOverMaximum = (x, target) => x > this.initialHitPoints[target]['value']

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

  calculateValues(
    hitPoints,
    changedPart,
    tier,
    prevValue,
    eventType = 'damage'
  ) {
    let updatedValue = hitPoints[changedPart]['value']

    // Determine if the torso is getting impacted by limb damage,
    // which only applies if said limb is still attached
    if (parseInt(tier) === 2 && eventType !== 'dismemberment') {
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
        document.querySelector(`[data-hp-id=${part}]`).value = hitPoints[part]['value']
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

  handleDismemberment(
    hitPoints,
    affectedPart
  ) {
    let isSevered = hitPoints[affectedPart]['severed']
    let affectedPartValue = hitPoints[affectedPart]['value']

    this.calculateValues(
      hitPoints,
      affectedPart,
      2,
      0,
      'dismemberment'
    )

    if (isSevered) {
      document.querySelector(`[data-hp-id="${affectedPart}"]`).setAttribute('disabled', true)
      document.querySelector(`[data-svg-id="${affectedPart}"]`).classList.add('is-severed')
    } else {
      document.querySelector(`[data-hp-id="${affectedPart}"]`).removeAttribute('disabled')
      document.querySelector(`[data-svg-id="${affectedPart}"]`).classList.remove('is-severed')
    }
  },

  handleAliveness(
    hitPoints,
    total
  ) {
    if (this.deathConditions['total'](total)) {
      // You're dead
      document.querySelector('[data-alive]').setAttribute('data-alive', false)
      document.querySelector('[data-hp-id="total"]').classList.add('is-dead')
      return
    }

    // Do any of the values in the current hitPoints object match any deathConditions?
    for (let part in this.deathConditions) {
      // Only check the parts in hitPoints that are mentioned in deathConditions:
      if (hitPoints.hasOwnProperty(part)) {
        if (this.deathConditions[part](hitPoints[part])) {
          // You're dead
          document.querySelector('[data-alive]').setAttribute('data-alive', false)
          document.querySelector(`[data-hp-id="${part}"]`).classList.add('is-dead')
          return
        }
      }
    }

    // Made it this far? Guess you're still alive, good job!
    document.querySelector('[data-alive]').setAttribute('data-alive', true)
    Array.from(document.querySelectorAll('[data-hp-id]')).map((element) => {
      element.classList.remove('is-dead')
    })
  }
}


hitPointsHandler.initialize()
