console.log("APP JS LOADED");

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// UPDATED: Added signOut to the local firebase imports
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  auth,
  onAuthStateChanged,
  db,
  signOut
} from "./firebase.js";

import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js";

const messaging = getMessaging();

async function initPush() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const token = await getToken(messaging, {
      vapidKey: "BI5zmQKhmBPuqufv2MoICc_wBfJmqSiAI9fyv1vlzmFFR5R__Cxu7WE2ywRQTsH4kyhAWc7wQBJZh0m0aM7ZJKM"
    });

    const user = auth.currentUser;

    if (user && token) {
      await setDoc(doc(db, "users", user.uid), {
        fcmToken: token
      }, { merge: true });
    }
  } catch (e) {
    console.log("Push token omitted: ", e);
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(() => console.log('SafeWalk service worker registered'));
}

let screens = {};
let walkTimer;
let seconds = 0;
let mapInitialized = false;
let map;
let marker;
let watchId = null; 
let checkInInterval;
let checkInTimeout;
let walkHistory = JSON.parse(localStorage.getItem('walkHistory') || '[]');
let lastSnapshot = null;
let cachedRealPin = localStorage.getItem('realPIN') || "";
let cachedDecoyPin = localStorage.getItem('decoyPIN') || "";

function initScreens() {
  screens = {
    auth: document.getElementById('auth'),
    home: document.getElementById('home'),
    setContact: document.getElementById('setContact'),
    walk: document.getElementById('walk'),
    pinEntry: document.getElementById('pinEntry'),
    safe: document.getElementById('safe'),
    history: document.getElementById('history')
  };
}

function showScreen(id) {
  Object.values(screens).forEach(s => {
    if (s) s.classList.remove('active');
  });

  if (screens[id]) {
    screens[id].classList.add('active');
    
    if (id === 'walk' && mapInitialized && map) {
      setTimeout(() => map.invalidateSize(), 200);
    }
    
    if (id === 'history') {
      renderHistory();
    }
  }
}

// NEW: Logout implementation to clear active safety checks and sign out
function logout() {
  clearInterval(walkTimer);
  clearInterval(checkInInterval);
  clearTimeout(checkInTimeout);
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  
  signOut(auth)
    .then(() => {
      showScreen('auth');
    })
    .catch(err => alert(err.message));
}

function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

window.togglePassword = function() {
  const passInput = document.getElementById('password');
  if (passInput) {
    passInput.type = passInput.type === 'password' ? 'text' : 'password';
  }
};

async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!isStrongPassword(password)) {
    alert("Password must be 8+ characters, include 1 uppercase letter and 1 number.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", userCredential.user.uid), {
      email,
      createdAt: serverTimestamp()
    });

    showScreen('home');
  } catch (err) {
    alert(err.message);
  }
}

function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  signInWithEmailAndPassword(auth, email, password)
    .catch(err => alert(err.message));
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    showScreen('home');
    listenForAlerts();
    initPush();
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.realPIN) {
          cachedRealPin = data.realPIN;
          localStorage.setItem('realPIN', data.realPIN);
        }
        if (data.decoyPIN) {
          cachedDecoyPin = data.decoyPIN;
          localStorage.setItem('decoyPIN', data.decoyPIN);
        }
        if (data.trustedName) localStorage.setItem('trustedName', data.trustedName);
        if (data.trustedNumber) localStorage.setItem('trustedNumber', data.trustedNumber);
      }
    } catch (e) {
      console.log("Profile data sync omitted: ", e);
    }
  } else {
    showScreen('auth');
  }
});

function listenForAlerts() {
  const user = auth.currentUser;
  if (!user) return;

  const q = query(
    collection(db, "alerts"),
    where("toUser", "==", user.email),
    where("status", "==", "active")
  );

  onSnapshot(q, (snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      alert(
        "🚨 EMERGENCY ALERT\n" +
        "From: " + data.fromUser + "\n" +
        "Location: https://www.google.com/maps?q=" + data.location.lat + "," + data.location.lon
      );
    });
  });
}

async function saveContact() {
  const name = document.getElementById('contactName').value.trim();
  const number = document.getElementById('contactNumber').value.trim();
  const realPin = document.getElementById('realPin').value.trim();
  const decoyPin = document.getElementById('decoyPin').value.trim();
  const trustedEmail = document.getElementById('contactEmail').value.trim();

  if (!name || !number || !realPin || !decoyPin || !trustedEmail) {
    alert("Fill in all fields");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  await setDoc(doc(db, "users", user.uid), {
    trustedName: name,
    trustedNumber: number,
    realPIN: realPin,
    decoyPIN: decoyPin,
    trustedEmail
  }, { merge: true });

  cachedRealPin = realPin;
  cachedDecoyPin = decoyPin;

  localStorage.setItem('trustedName', name);
  localStorage.setItem('trustedNumber', number);
  localStorage.setItem('realPIN', realPin);
  localStorage.setItem('decoyPIN', decoyPin);

  alert("Emergency details successfully secured.");
  showScreen('home');
}

function startWalk() {
  const name = localStorage.getItem('trustedName');
  const number = localStorage.getItem('trustedNumber');

  if (!name || !number) {
    alert("Add trusted contact first.");
    return;
  }

  showScreen('walk');

  seconds = 0;
  walkHistory.push({ start: Date.now(), route: [] });

  if (!mapInitialized) {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      map = L.map('map').setView([lat, lon], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      marker = L.marker([lat, lon]).addTo(map);
      mapInitialized = true;
      
      setTimeout(() => map.invalidateSize(), 200);
      startTrackingGPS();
    }, () => {
      map = L.map('map').setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      marker = L.marker([0, 0]).addTo(map);
      mapInitialized = true;
      setTimeout(() => map.invalidateSize(), 200);
      startTrackingGPS();
    });
  } else {
    startTrackingGPS();
  }

  clearInterval(walkTimer);
  walkTimer = setInterval(() => {
    seconds++;
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    const el = document.getElementById('timer');
    if (el) el.innerText = `${min}:${sec}`;
  }, 1000);

  startCheckIn();
  startShakeListener();
}

function startTrackingGPS() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);

  watchId = navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const loc = document.getElementById('locationText');
    if (loc) loc.innerText = `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    if (marker) marker.setLatLng([lat, lon]);
    if (map) map.flyTo([lat, lon], map.getZoom());

    if (walkHistory.length) {
      walkHistory[walkHistory.length - 1].route.push({ 
        lat: lat.toFixed(5), 
        lon: lon.toFixed(5), 
        time: Date.now() 
      });
    }
  }, (err) => console.log("Tracking Error: ", err), { enableHighAccuracy: true });
}

function promptPin() {
  showScreen('pinEntry');
}

async function sendPanic() {
  const user = auth.currentUser;
  if (!user) return;

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) return;

      const trustedEmail = userDoc.data().trustedEmail;

      await addDoc(collection(db, "alerts"), {
        fromUser: user.email,
        toUser: trustedEmail,
        location: { lat, lon },
        time: serverTimestamp(),
        status: "active"
      });

      alert("🚨 Panic Transmission complete. Distress coordinates sent to your trusted contact.");
    } catch (e) {
      console.error(e);
    }
  });
}

function handlePin() {
  const entered = document.getElementById('pinInput').value.trim();

  const real = cachedRealPin || localStorage.getItem('realPIN');
  const decoy = cachedDecoyPin || localStorage.getItem('decoyPIN');

  if (entered === real) {
    endWalk();
  } else if (entered === decoy) {
    sendPanic();
    endWalk();
  } else {
    alert("Wrong PIN");
  }
}

function endWalk() {
  clearInterval(walkTimer);
  clearInterval(checkInInterval);
  clearTimeout(checkInTimeout);
  
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (walkHistory.length) {
    let walk = walkHistory[walkHistory.length - 1];
    walk.end = Date.now();
    walk.snapshot = lastSnapshot;
    localStorage.setItem('walkHistory', JSON.stringify(walkHistory));
  }

  const pinIn = document.getElementById('pinInput');
  if (pinIn) pinIn.value = "";

  showScreen('safe');
}

function renderHistory() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  if (walkHistory.length === 0) {
    historyList.innerHTML = `<p>No walks recorded yet.</p>`;
    return;
  }

  historyList.innerHTML = walkHistory.map(walk => {
    const date = new Date(walk.start).toLocaleString();
    const duration = walk.end ? `${Math.floor((walk.end - walk.start) / 1000 / 60)}m` : 'Incomplete';
    return `
      <div style="border-bottom:1px solid #eee; padding:10px 0; font-size:14px;">
        <strong>Date:</strong> ${date}<br>
        <strong>Duration:</strong> ${duration}<br>
        <strong>Points Traced:</strong> ${walk.route ? walk.route.length : 0}
      </div>
    `;
  }).join('');
}

function startShakeListener() {
  let lastX, lastY, lastZ;
  const threshold = 15;

  window.addEventListener('devicemotion', e => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;

    if (lastX !== undefined) {
      const delta =
        Math.abs(a.x - lastX) +
        Math.abs(a.y - lastY) +
        Math.abs(a.z - lastZ);

      if (delta > threshold) sendPanic();
    }

    lastX = a.x;
    lastY = a.y;
    lastZ = a.z;
  });
}

function startCheckIn() {
  clearInterval(checkInInterval);

  checkInInterval = setInterval(() => {
    if (!confirm("Are you safe?")) {
      setTimeout(() => sendPanic(), 5000);
    }
  }, 300000);
}

// EXPORTS
window.showScreen = showScreen;
window.saveContact = saveContact;
window.startWalk = startWalk;
window.sendPanic = sendPanic;
window.promptPin = promptPin;
window.handlePin = handlePin;
window.signup = signup;
window.login = login;
window.logout = logout; // UPDATED: Registered logout globally

initScreens();
