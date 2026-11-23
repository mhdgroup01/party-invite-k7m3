'use strict';

const hero = document.querySelector('.hero');
const replay = document.querySelector('#replay-button');
function swing() {
  hero.classList.remove('swing');
  void hero.offsetWidth;
  hero.classList.add('swing');
}
replay.hidden = false;
replay.addEventListener('click', swing);
swing();

const stage = document.querySelector('#arrow-stage');
const arrow = document.querySelector('#route-arrow');
const reading = document.querySelector('#route-reading');
const statusLine = document.querySelector('#location-status');
const modeLine = document.querySelector('#route-mode');
const enableHeading = document.querySelector('#enable-heading');
const bearingLine = document.querySelector('#bearing');
const distanceLine = document.querySelector('#distance');

const mapURL = new URL(document.querySelector('#directions').href);
const [eventLat, eventLon] = mapURL.searchParams.get('destination').split(',').map(Number);
const metersFormat = new Intl.NumberFormat('lo-LA', {maximumFractionDigits: 0});
const kmFormat = new Intl.NumberFormat('lo-LA', {maximumFractionDigits: 1});
const rad = Math.PI / 180;
const directions = ['ເໜືອ', 'ຕາເວັນອອກສຽງເໜືອ', 'ຕາເວັນອອກ', 'ຕາເວັນອອກສຽງໃຕ້', 'ໃຕ້', 'ຕາເວັນຕົກສຽງໃຕ້', 'ຕາເວັນຕົກ', 'ຕາເວັນຕົກສຽງເໜືອ'];
const northUp = 'ດ້ານເທິງຂອງຈໍແມ່ນທິດເໜືອ.';
const phoneUp = 'ຖືມືຖືໃຫ້ຮາບ. ລູກສອນຈະໝຸນຕາມມືຖື.';
const courseUp = 'ດ້ານເທິງຂອງຈໍແມ່ນທິດທີ່ເຈົ້າກຳລັງເຄື່ອນທີ່.';
const waiting = 'ກຳລັງຊອກຫາຕຳແໜ່ງຂອງເຈົ້າ…';
let tracker = null;
let trackingSession = 0;
let bearing = null;
let heading = null;
let course = null;
let motionPermission = 'prompt';
const canAskForHeading = (navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches)
  && typeof window.DeviceOrientationEvent?.requestPermission === 'function';

function wrap(degrees) {
  return (degrees % 360 + 360) % 360;
}

function toEvent(latitude, longitude) {
  const lat = latitude * rad;
  const targetLat = eventLat * rad;
  const deltaLon = (eventLon - longitude) * rad;
  const a = Math.sin((targetLat - lat) / 2) ** 2
    + Math.cos(lat) * Math.cos(targetLat) * Math.sin(deltaLon / 2) ** 2;
  const y = Math.sin(deltaLon) * Math.cos(targetLat);
  const x = Math.cos(lat) * Math.sin(targetLat) - Math.sin(lat) * Math.cos(targetLat) * Math.cos(deltaLon);
  return {
    distance: 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, a))),
    bearing: wrap(Math.atan2(y, x) / rad)
  };
}

function drawArrow() {
  if (bearing === null) return;
  const screenAngle = window.screen.orientation?.angle ?? window.orientation ?? 0;
  const reference = heading === null ? (course ?? 0) : heading + screenAngle;
  arrow.setAttribute('transform', 'rotate(' + wrap(bearing - reference) + ')');
  let mode = heading !== null ? phoneUp : course !== null ? courseUp : northUp;
  if (heading === null && motionPermission === 'denied') {
    mode = 'ຍັງບໍ່ໄດ້ອະນຸຍາດໃຫ້ໃຊ້ທິດຂອງມືຖື. ' + mode;
  } else if (heading === null && motionPermission === 'granted') {
    mode = 'ຖືມືຖືໃຫ້ຮາບເພື່ອລໍຖ້າສັນຍານທິດ. ' + mode;
  } else if (heading === null && motionPermission === 'retry') {
    mode = 'ຍັງເປີດການໝຸນຕາມມືຖືບໍ່ໄດ້. ລອງກົດອີກຄັ້ງ. ' + mode;
  }
  if (modeLine.textContent !== mode) modeLine.textContent = mode;
  enableHeading.disabled = motionPermission === 'requesting';
  enableHeading.hidden = !canAskForHeading || heading !== null
    || motionPermission === 'granted' || motionPermission === 'denied';
}

enableHeading.addEventListener('click', async () => {
  const session = trackingSession;
  enableHeading.disabled = true;
  motionPermission = 'requesting';
  try {
    const result = await window.DeviceOrientationEvent.requestPermission(true);
    if (session !== trackingSession) return;
    motionPermission = result === 'granted' ? 'granted' : 'denied';
  } catch {
    if (session !== trackingSession) return;
    motionPermission = 'retry';
  }
  drawArrow();
});

function onOrientation(event) {
  if (Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0
      && !(event.webkitCompassAccuracy < 0)) {
    heading = event.webkitCompassHeading;
  } else if (event.absolute === true || event.type === 'deviceorientationabsolute') {
    heading = Number.isFinite(event.alpha) ? wrap(-event.alpha) : null;
  } else if (typeof event.webkitCompassHeading === 'number') {
    heading = null;
  } else {
    // ค่า alpha แบบสัมพัทธ์ไม่มีทิศเหนือเป็นจุดอ้างอิง
    return;
  }
  drawArrow();
}

function listenForHeading() {
  window.addEventListener('deviceorientationabsolute', onOrientation);
  window.addEventListener('deviceorientation', onOrientation);
  window.screen.orientation?.addEventListener('change', drawArrow);
  window.addEventListener('orientationchange', drawArrow);
}

function releaseSensors() {
  trackingSession++;
  if (tracker !== null) navigator.geolocation.clearWatch(tracker);
  tracker = null;
  window.removeEventListener('deviceorientationabsolute', onOrientation);
  window.removeEventListener('deviceorientation', onOrientation);
  window.screen.orientation?.removeEventListener('change', drawArrow);
  window.removeEventListener('orientationchange', drawArrow);
  heading = null;
  course = null;
  bearing = null;
  motionPermission = 'prompt';
}

function showStatus(message, state = 'waiting') {
  reading.hidden = true;
  modeLine.hidden = true;
  enableHeading.hidden = true;
  bearing = null;
  course = null;
  stage.dataset.state = state;
  arrow.setAttribute('transform', 'rotate(32)');
  if (statusLine.textContent !== message) statusLine.textContent = message;
}

function updatePosition(position) {
  const {latitude, longitude, accuracy} = position.coords;
  const target = toEvent(latitude, longitude);
  const distance = target.distance;
  if (distance + accuracy <= 100) {
    releaseSensors();
    showStatus('ຮອດບ່ອນຈັດງານແລ້ວ! ມາເປົ່າທຽນນຳກັນເລີຍ!', 'arrived');
    swing();
    return;
  }
  if (distance <= accuracy || (accuracy > 500 && distance <= accuracy * 2)) {
    showStatus('ຕຳແໜ່ງຍັງບໍ່ຊັດເຈນ. ລອງອອກໄປບ່ອນໂລ່ງ ຫຼື ເບິ່ງໝຸດໃນ Google Maps.');
    return;
  }
  const {heading: travelHeading, speed} = position.coords;
  course = Number.isFinite(travelHeading) && travelHeading >= 0 && travelHeading < 360 && speed !== 0
    ? travelHeading : null;
  bearing = target.bearing;
  const cardinal = directions[Math.round(bearing / 45) % directions.length];
  const distanceText = distance < 1000
    ? metersFormat.format(Math.max(10, Math.round(distance / 10) * 10)) + ' ແມັດ'
    : kmFormat.format(distance / 1000) + ' ກິໂລແມັດ';
  const bearingText = 'ທິດ' + cardinal + ' · ' + wrap(Math.round(bearing)) + '°';
  const distanceLabel = 'ໄລຍະທາງເສັ້ນຊື່ ' + distanceText;
  if (bearingLine.textContent !== bearingText) bearingLine.textContent = bearingText;
  if (distanceLine.textContent !== distanceLabel) distanceLine.textContent = distanceLabel;
  statusLine.textContent = '';
  reading.hidden = false;
  modeLine.hidden = false;
  stage.dataset.state = 'active';
  drawArrow();
}

function startNavigation() {
  if (!window.isSecureContext || !navigator.geolocation) {
    showStatus('ອຸປະກອນນີ້ອ່ານຕຳແໜ່ງບໍ່ໄດ້. ເປີດ Google Maps ເພື່ອເບິ່ງເສັ້ນທາງ.');
    return;
  }
  const session = ++trackingSession;
  showStatus(waiting);
  listenForHeading();
  tracker = navigator.geolocation.watchPosition(position => {
    if (session === trackingSession) updatePosition(position);
  }, error => {
    if (session !== trackingSession) return;
    if (error.code === 1) {
      releaseSensors();
      showStatus('ເວັບໃຊ້ຕຳແໜ່ງບໍ່ໄດ້. ເປີດ Google Maps ເພື່ອໄປງານໄດ້ເລີຍ.');
    } else {
      showStatus('ກຳລັງລໍຖ້າສັນຍານຕຳແໜ່ງ. ເຈົ້າເປີດ Google Maps ເພື່ອນຳທາງໄດ້ເລີຍ.');
    }
  }, {enableHighAccuracy: true, maximumAge: 0, timeout: 15000});
}

window.addEventListener('pagehide', releaseSensors);
window.addEventListener('pageshow', event => {
  if (event.persisted) startNavigation();
});
startNavigation();
