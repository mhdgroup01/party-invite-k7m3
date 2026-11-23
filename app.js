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

const nearby = document.querySelector('#nearby');
const label = nearby.querySelector('span');
const initialLabel = label.textContent;
const panel = document.querySelector('#compass-panel');
const reading = document.querySelector('#compass-reading');
const statusLine = document.querySelector('#location-status');
const modeLine = document.querySelector('#compass-mode');
const bearingLine = document.querySelector('#bearing');
const distanceLine = document.querySelector('#distance');
const enableHeading = document.querySelector('#enable-heading');
const needle = document.querySelector('#needle');
const cardinals = document.querySelector('#cardinals');

const mapURL = new URL(document.querySelector('#directions').href);
const [eventLat, eventLon] = mapURL.searchParams.get('destination').split(',').map(Number);
const metersFormat = new Intl.NumberFormat('lo-LA', {maximumFractionDigits: 0});
const kmFormat = new Intl.NumberFormat('lo-LA', {maximumFractionDigits: 1});
const rad = Math.PI / 180;
const directions = ['ເໜືອ', 'ຕາເວັນອອກສຽງເໜືອ', 'ຕາເວັນອອກ', 'ຕາເວັນອອກສຽງໃຕ້', 'ໃຕ້', 'ຕາເວັນຕົກສຽງໃຕ້', 'ຕາເວັນຕົກ', 'ຕາເວັນຕົກສຽງເໜືອ'];
const northUp = 'ທິດເໜືອຢູ່ດ້ານເທິງຂອງໜ້າປັດ.';
const live = 'ຖືມືຖືໃຫ້ຮາບ. ປາຍເຂັມສີແດງຊີ້ໄປຫາງານ.';
const needsMotionPermission = typeof window.DeviceOrientationEvent?.requestPermission === 'function';
let tracker = null;
let trackingSession = 0;
let bearing = null;
let heading = null;
let motionDenied = false;

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

function drawCompass() {
  if (bearing === null) return;
  const screenAngle = window.screen.orientation?.angle ?? window.orientation ?? 0;
  const top = heading === null ? 0 : wrap(heading + screenAngle);
  cardinals.setAttribute('transform', 'rotate(' + wrap(-top) + ')');
  needle.setAttribute('transform', 'rotate(' + wrap(bearing - top) + ')');
  const mode = heading !== null ? live : motionDenied ? 'ໃຊ້ທິດເໜືອອ້າງອີງ. ' + northUp : northUp;
  if (modeLine.textContent !== mode) modeLine.textContent = mode;
}

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
  drawCompass();
}

function listenForHeading() {
  window.addEventListener('deviceorientationabsolute', onOrientation);
  window.addEventListener('deviceorientation', onOrientation);
  window.screen.orientation?.addEventListener('change', drawCompass);
  window.addEventListener('orientationchange', drawCompass);
}

function releaseSensors() {
  trackingSession++;
  if (tracker !== null) navigator.geolocation.clearWatch(tracker);
  tracker = null;
  window.removeEventListener('deviceorientationabsolute', onOrientation);
  window.removeEventListener('deviceorientation', onOrientation);
  window.screen.orientation?.removeEventListener('change', drawCompass);
  window.removeEventListener('orientationchange', drawCompass);
  heading = null;
  bearing = null;
}

function showStatus(message) {
  reading.hidden = true;
  bearing = null;
  if (statusLine.textContent !== message) statusLine.textContent = message;
}

function closeCompass() {
  releaseSensors();
  panel.hidden = true;
  showStatus('');
  nearby.setAttribute('aria-expanded', 'false');
  label.textContent = initialLabel;
}

function updatePosition(position) {
  const {latitude, longitude, accuracy} = position.coords;
  const target = toEvent(latitude, longitude);
  const distance = target.distance;
  if (distance + accuracy <= 100) {
    releaseSensors();
    showStatus('ຮອດບ່ອນຈັດງານແລ້ວ! ມາເປົ່າທຽນນຳກັນເລີຍ!');
    swing();
    return;
  }
  if (distance <= accuracy || (accuracy > 500 && distance <= accuracy * 2)) {
    showStatus('ຕຳແໜ່ງຍັງບໍ່ຊັດເຈນ. ລອງອອກໄປບ່ອນໂລ່ງ ຫຼື ເບິ່ງໝຸດໃນ Google Maps.');
    return;
  }
  bearing = target.bearing;
  const cardinal = directions[Math.round(bearing / 45) % directions.length];
  const distanceText = distance < 1000
    ? metersFormat.format(Math.max(10, Math.round(distance / 10) * 10)) + ' ແມັດ'
    : kmFormat.format(distance / 1000) + ' ກິໂລແມັດ';
  const bearingText = 'ທິດ' + cardinal + ' · ' + wrap(Math.round(bearing)) + '°';
  const distanceLabel = 'ໄລຍະທາງເສັ້ນຊື່ ' + distanceText;
  if (bearingLine.textContent !== bearingText) bearingLine.textContent = bearingText;
  if (distanceLine.textContent !== distanceLabel) distanceLine.textContent = distanceLabel;
  const firstReading = reading.hidden;
  statusLine.textContent = '';
  reading.hidden = false;
  drawCompass();
  if (firstReading && document.activeElement === nearby) panel.scrollIntoView({block: 'nearest'});
}

enableHeading.addEventListener('click', async () => {
  const session = trackingSession;
  enableHeading.disabled = true;
  try {
    const result = await window.DeviceOrientationEvent.requestPermission(true);
    if (session !== trackingSession) return;
    if (result === 'granted') listenForHeading();
    else motionDenied = true;
  } catch {
    if (session === trackingSession) motionDenied = true;
  } finally {
    if (session === trackingSession) {
      enableHeading.hidden = true;
      drawCompass();
    }
  }
});

nearby.hidden = false;
nearby.addEventListener('click', () => {
  if (!panel.hidden) {
    closeCompass();
    return;
  }
  panel.hidden = false;
  nearby.setAttribute('aria-expanded', 'true');
  label.textContent = 'ປິດເຂັມທິດ';
  if (!window.isSecureContext || !navigator.geolocation) {
    showStatus('ອຸປະກອນນີ້ອ່ານຕຳແໜ່ງບໍ່ໄດ້. ກົດປຸ່ມ Google Maps ເພື່ອເບິ່ງເສັ້ນທາງ.');
  } else {
    const session = ++trackingSession;
    enableHeading.hidden = !needsMotionPermission;
    enableHeading.disabled = false;
    motionDenied = false;
    showStatus('ກຳລັງຊອກຫາຕຳແໜ່ງຂອງເຈົ້າ…');
    if (!needsMotionPermission) listenForHeading();
    tracker = navigator.geolocation.watchPosition(position => {
      if (session === trackingSession) updatePosition(position);
    }, error => {
      if (session !== trackingSession) return;
      if (error.code === 1) {
        releaseSensors();
        showStatus('ກະລຸນາອະນຸຍາດໃຫ້ເວັບໃຊ້ຕຳແໜ່ງເພື່ອເປີດເຂັມທິດ ຫຼື ກົດ Google Maps ເພື່ອເບິ່ງເສັ້ນທາງ.');
      } else {
        showStatus('ກຳລັງລໍຖ້າສັນຍານຕຳແໜ່ງ. ເຈົ້າເປີດ Google Maps ເພື່ອນຳທາງໄດ້ເລີຍ.');
      }
    }, {enableHighAccuracy: true, maximumAge: 0, timeout: 15000});
  }
  panel.scrollIntoView({block: 'nearest'});
});
window.addEventListener('pagehide', closeCompass);
