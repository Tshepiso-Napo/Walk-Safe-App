const screens = {
  home: document.getElementById('home'),
  setContact: document.getElementById('setContact'),
  walk: document.getElementById('walk'),
  pinEntry: document.getElementById('pinEntry'),
  safe: document.getElementById('safe')
}

let walkTimer, seconds = 0

function showScreen(id) {
  Object.values(screens).forEach(s => s.classList.remove('active'))
  screens[id].classList.add('active')
}

function saveContact() {
  const name = document.getElementById('contactName').value.trim()
  const number = document.getElementById('contactNumber').value.trim()
  const realPin = document.getElementById('realPin').value.trim()
  const decoyPin = document.getElementById('decoyPin').value.trim()

  if (!name || !number || !realPin || !decoyPin) {
    alert("Fill in all fields.")
    return
  }

  localStorage.setItem('trustedName', name)
  localStorage.setItem('trustedNumber', number)
  localStorage.setItem('realPIN', realPin)
  localStorage.setItem('decoyPIN', decoyPin)

  alert("Contact & PINs saved.")
  showScreen('home')
}

function startWalk() {
  const name = localStorage.getItem('trustedName')
  const number = localStorage.getItem('trustedNumber')

  if (!name || !number) {
    alert("Add a trusted contact first.")
    return
  }

  showScreen('walk')
  seconds = 0
  updateLocation()

  walkTimer = setInterval(() => {
    seconds++
    const min = String(Math.floor(seconds / 60)).padStart(2, '0')
    const sec = String(seconds % 60).padStart(2, '0')
    document.getElementById('timer').innerText = `${min}:${sec}`
  }, 1000)
}

function updateLocation() {
  navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude.toFixed(5)
    const lon = pos.coords.longitude.toFixed(5)
    document.getElementById('locationText').innerText = `📍 ${lat}, ${lon}`
  }, () => {
    document.getElementById('locationText').innerText = `Location unavailable`
  })
}

function sendPanic() {
  const number = localStorage.getItem('trustedNumber')

  if (!number) {
    alert("No contact found.")
    return
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude
    const lon = pos.coords.longitude
    const msg = `⚠️ I’m in danger. My live location: https://maps.google.com/?q=${lat},${lon}`
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank')
  }, () => {
    alert("Could not get location.")
  })
}

function promptPin() {
  showScreen('pinEntry')
}

function handlePin() {
  const entered = document.getElementById('pinInput').value.trim()
  const real = localStorage.getItem('realPIN')
  const decoy = localStorage.getItem('decoyPIN')

  if (entered === real) {
    clearInterval(walkTimer)
    showScreen('safe')
  } else if (entered === decoy) {
    sendPanic()
    showScreen('safe')
  } else {
    alert("Wrong PIN.")
  }
}
