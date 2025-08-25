if('serviceWorker' in navigator){navigator.serviceWorker.register('service-worker.js').then(()=>console.log('SafeWalk service worker registered'));}

const screens={
home:document.getElementById('home'),
setContact:document.getElementById('setContact'),
walk:document.getElementById('walk'),
pinEntry:document.getElementById('pinEntry'),
safe:document.getElementById('safe'),
history:document.getElementById('history')
}

let previousScreen='home';
let walkTimer,seconds=0;
let mapInitialized=false;
let map,marker;
let checkInInterval,checkInTimeout;
let walkHistory=JSON.parse(localStorage.getItem('walkHistory')||'[]');
let lastSnapshot=null;

function showScreen(id){Object.values(screens).forEach(s=>s.classList.remove('active'));screens[id].classList.add('active');previousScreen=id;}
function goBack(){showScreen('home');}

function saveContact(){
const name=document.getElementById('contactName').value.trim();
const number=document.getElementById('contactNumber').value.trim();
const realPin=document.getElementById('realPin').value.trim();
const decoyPin=document.getElementById('decoyPin').value.trim();
if(!name||!number||!realPin||!decoyPin){alert("Fill in all fields.");return;}
if(!/^\d{5}$/.test(realPin)||!/^\d{5}$/.test(decoyPin)){alert("Both PINs must be exactly 5 digits.");return;}
localStorage.setItem('trustedName',name);
localStorage.setItem('trustedNumber',number);
localStorage.setItem('realPIN',realPin);
localStorage.setItem('decoyPIN',decoyPin);
alert("Contact & PINs saved.");showScreen('home');
}

function startWalk(){
const name=localStorage.getItem('trustedName');
const number=localStorage.getItem('trustedNumber');
if(!name||!number){alert("Add a trusted contact first.");return;}
showScreen('walk');seconds=0;
walkHistory.push({start:Date.now(),route:[]});
updateLocation();
if(!mapInitialized){initMap();mapInitialized=true;}
walkTimer=setInterval(()=>{seconds++;const min=String(Math.floor(seconds/60)).padStart(2,'0');const sec=String(seconds%60).padStart(2,'0');document.getElementById('timer').innerText=`${min}:${sec}`;},1000);
startCheckIn();startShakeListener();
}

function updateLocation(){navigator.geolocation.watchPosition(pos=>{const lat=pos.coords.latitude.toFixed(5);const lon=pos.coords.longitude.toFixed(5);document.getElementById('locationText').innerText=`📍 ${lat}, ${lon}`;if(walkHistory.length)walkHistory[walkHistory.length-1].route.push({lat,lon,time:Date.now()});},()=>{document.getElementById('locationText').innerText=`Location unavailable`;},{enableHighAccuracy:true,maximumAge:1000,timeout:5000});}

function sendPanic(){const number=localStorage.getItem('trustedNumber');if(!number){alert("No contact found.");return;}takePhoto();navigator.geolocation.getCurrentPosition(pos=>{const lat=pos.coords.latitude;const lon=pos.coords.longitude;const msg=`⚠️ I’m in danger. My live location: https://maps.google.com/?q=${lat},${lon}`;window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`,'_blank');},()=>{alert("Could not get location.");},{enableHighAccuracy:true,timeout:5000});}

function promptPin(){showScreen('pinEntry');}

function handlePin(){const entered=document.getElementById('pinInput').value.trim();if(entered.length!==5||!/^\d{5}$/.test(entered)){alert("PIN must be exactly 5 digits.");return;}const real=localStorage.getItem('realPIN');const decoy=localStorage.getItem('decoyPIN');if(entered===real){endWalk();}else if(entered===decoy){sendPanic();endWalk();}else{alert("Wrong PIN.");}}

function endWalk(){clearInterval(walkTimer);clearInterval(checkInInterval);clearTimeout(checkInTimeout);if(walkHistory.length){let walk=walkHistory[walkHistory.length-1];walk.end=Date.now();walk.snapshot=lastSnapshot;localStorage.setItem('walkHistory',JSON.stringify(walkHistory));}showScreen('safe');}

function initMap(){navigator.geolocation.getCurrentPosition(pos=>{const lat=pos.coords.latitude;const lon=pos.coords.longitude;map=L.map('map',{zoomControl:true,dragging:true}).setView([lat,lon],16);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(map);marker=L.marker([lat,lon]).addTo(map);navigator.geolocation.watchPosition(updatePositionSmooth,err=>{}, {enableHighAccuracy:true,maximumAge:1000,timeout:5000});},err=>{alert("Could not get your location. Make sure location is enabled.");map=L.map('map',{zoomControl:true,dragging:true}).setView([-26.2041,28.0473],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(map);marker=L.marker([-26.2041,28.0473]).addTo(map);},{enableHighAccuracy:true,timeout:10000});}

function updatePositionSmooth(pos){const lat=pos.coords.latitude;const lon=pos.coords.longitude;marker.setLatLng([lat,lon]);map.flyTo([lat,lon],map.getZoom(),{animate:true,duration:1});document.getElementById('locationText').innerText=`📍 ${lat.toFixed(5)}, ${lon.toFixed(5)}`;if(walkHistory.length)walkHistory[walkHistory.length-1].route.push({lat,lon,time:Date.now()});}

function startShakeListener(){let lastX=null,lastY=null,lastZ=null,threshold=15;window.addEventListener('devicemotion',function(e){const a=e.accelerationIncludingGravity;if(lastX!==null){let delta=Math.abs(a.x-lastX)+Math.abs(a.y-lastY)+Math.abs(a.z-lastZ);if(delta>threshold)sendPanic();}lastX=a.x;lastY=a.y;lastZ=a.z;});}

function startCheckIn(){checkInInterval=setInterval(()=>{if(confirm("Are you safe?"))return;checkInTimeout=setTimeout(()=>{sendPanic();},5000);},300000);}

function takePhoto(){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return;navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}}).then(stream=>{let video=document.createElement('video');video.srcObject=stream;video.play();setTimeout(()=>{let canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);lastSnapshot=canvas.toDataURL('image/png');stream.getTracks().forEach(t=>t.stop());},1000);}).catch(()=>{});}

function showWalkHistory(){const container=document.getElementById('historyList');container.innerHTML='';walkHistory.forEach((walk,i)=>{let div=document.createElement('div');div.style.marginBottom='20px';let start=new Date(walk.start).toLocaleString();let duration=walk.end?Math.floor((walk.end-walk.start)/1000):0;let minutes=String(Math.floor(duration/60)).padStart(2,'0');let seconds=String(duration%60).padStart(2,'0');div.innerHTML=`<strong>Walk ${i+1}</strong><br>Start: ${start}<br>Duration: ${minutes}:${seconds}`;if(walk.snapshot){let img=document.createElement('img');img.src=walk.snapshot;img.style.width='100%';img.style.borderRadius='14px';img.style.marginTop='8px';div.appendChild(img);}container.appendChild(div);});}

document.querySelector('[onclick="showScreen(\'history\')"]').addEventListener('click',()=>{showScreen('history');showWalkHistory();});
