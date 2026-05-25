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

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  auth,
  onAuthStateChanged,
  db
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
    console.log(e);
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
let checkInInterval;
let checkInTimeout;
let walkHistory = JSON.parse(localStorage.getItem('walkHistory') || '[]');
let lastSnapshot = null;

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

  if (screens[id]) screens[id].classList.add('active');
}

function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const trustedEmail = document.getElementById('trustedEmail').value.trim();

  if (!isStrongPassword(password)) {
    alert("Password must be 8+ characters, include 1 uppercase letter and 1 number.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", userCredential.user.uid), {
      email,
      trustedEmail,
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

onAuthStateChanged(auth, (user) => {
  if (user) {
    showScreen('home');
    listenForAlerts();
    initPush();
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
        "Location: https://maps.google.com/?q=" +
        data.location.lat + "," + data.location.lon
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

  if (!/^\d{5}$/.test(realPin) || !/^\d{5}$/.test(decoyPin)) {
    alert("PIN must be 5 digits");
    return;
  }

  const user = auth.currentUser;

  await setDoc(doc(db, "users", user.uid), {
    trustedName: name,
    trustedNumber: number,
    realPIN: realPin,
    decoyPIN: decoyPin,
    trustedEmail
  }, { merge: true });

  localStorage.setItem('trustedName', name);
  localStorage.setItem('trustedNumber', number);
  localStorage.setItem('realPIN', realPin);
  localStorage.setItem('decoyPIN', decoyPin);

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

  updateLocation();

  if (!mapInitialized) {
    initMap();
    mapInitialized = true;
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

function updateLocation() {
  navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude.toFixed(5);
    const lon = pos.coords.longitude.toFixed(5);

    const loc = document.getElementById('locationText');
    if (loc) loc.innerText = `📍 ${lat}, ${lon}`;

    if (walkHistory.length) {
      walkHistory[walkHistory.length - 1].route.push({ lat, lon, time: Date.now() });
    }
  });
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

    alert("Emergency sent");
  });
}

function handlePin() {
  const entered = document.getElementById('pinInput').value.trim();

  const real = localStorage.getItem('realPIN');
  const decoy = localStorage.getItem('decoyPIN');

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

  if (walkHistory.length) {
    let walk = walkHistory[walkHistory.length - 1];
    walk.end = Date.now();
    walk.snapshot = lastSnapshot;
    localStorage.setItem('walkHistory', JSON.stringify(walkHistory));
  }

  showScreen('safe');
}

function initMap() {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    map = L.map('map').setView([lat, lon], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    marker = L.marker([lat, lon]).addTo(map);

    navigator.geolocation.watchPosition(updatePositionSmooth);
  });
}

function updatePositionSmooth(pos) {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;

  if (marker) marker.setLatLng([lat, lon]);
  if (map) map.flyTo([lat, lon], map.getZoom());

  const loc = document.getElementById('locationText');
  if (loc) loc.innerText = `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
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

window.showScreen = showScreen;
window.saveContact = saveContact;
window.startWalk = startWalk;
window.sendPanic = sendPanic;
window.promptPin = promptPin;
window.handlePin = handlePin;
window.signup = signup;
window.login = login;

initScreens();
