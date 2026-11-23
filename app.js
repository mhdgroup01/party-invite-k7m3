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
const statusLine = document.querySelector('#location-status');
const initialLabel = label.textContent;
const mapURL = new URL(document.querySelector('#directions').href);
const [eventLat, eventLon] = mapURL.searchParams.get('destination').split(',').map(Number);
const metersFormat = new Intl.NumberFormat('lo-LA', {maximumFractionDigits: 0});
const kmFormat = new Intl.NumberFormat('lo-LA', {maximumFractionDigits: 1});
let tracker = null;
let trackingSession = 0;

function metersToEvent(latitude, longitude) {
  const rad = Math.PI / 180;
  const a = Math.sin((eventLat - latitude) * rad / 2) ** 2
    + Math.cos(latitude * rad) * Math.cos(eventLat * rad)
    * Math.sin((eventLon - longitude) * rad / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function announce(message) {
  statusLine.hidden = !message;
  if (statusLine.textContent !== message) statusLine.textContent = message;
}

function stopTracking(message = '') {
  trackingSession++;
  if (tracker !== null) navigator.geolocation.clearWatch(tracker);
  tracker = null;
  label.textContent = initialLabel;
  nearby.setAttribute('aria-pressed', 'false');
  announce(message);
}

nearby.hidden = false;
nearby.setAttribute('aria-pressed', 'false');
nearby.addEventListener('click', () => {
  if (tracker !== null) {
    stopTracking();
    return;
  }
  if (!window.isSecureContext || !navigator.geolocation) {
    announce('ອຸປະກອນນີ້ອ່ານຕຳແໜ່ງບໍ່ໄດ້. ກົດປຸ່ມ Google Maps ເພື່ອເບິ່ງເສັ້ນທາງໄດ້ເລີຍ.');
    return;
  }
  const session = ++trackingSession;
  label.textContent = 'ຢຸດເບິ່ງໄລຍະຫ່າງ';
  nearby.setAttribute('aria-pressed', 'true');
  announce('ກຳລັງຊອກຫາຕຳແໜ່ງຂອງເຈົ້າ…');
  tracker = navigator.geolocation.watchPosition(position => {
    if (session !== trackingSession) return;
    const {latitude, longitude, accuracy} = position.coords;
    const distance = metersToEvent(latitude, longitude);
    if (distance + accuracy <= 100) {
      stopTracking('ຮອດບ່ອນຈັດງານແລ້ວ! ມາເປົ່າທຽນນຳກັນເລີຍ!');
      swing();
      return;
    }
    if (accuracy > 500 && distance <= accuracy * 2) {
      announce('ຕຳແໜ່ງຍັງບໍ່ຊັດເຈນ. ເປີດ Google Maps ເພື່ອເບິ່ງໝຸດງານໄດ້.');
      return;
    }
    const display = distance < 1000
      ? metersFormat.format(Math.max(10, Math.round(distance / 10) * 10)) + ' ແມັດ'
      : kmFormat.format(distance / 1000) + ' ກິໂລແມັດ';
    announce('ໄລຍະຫ່າງເປັນເສັ້ນຊື່ຈາກເຈົ້າເຖິງບ່ອນຈັດງານ ປະມານ ' + display);
  }, error => {
    if (session !== trackingSession) return;
    if (error.code === 1) {
      stopTracking('ເຈົ້າເປີດ Google Maps ເພື່ອນຳທາງໄດ້ເລີຍ ຫຼື ອະນຸຍາດໃຫ້ເວັບໃຊ້ຕຳແໜ່ງເພື່ອເບິ່ງໄລຍະຫ່າງ.');
    } else {
      announce('ກຳລັງລໍຖ້າສັນຍານຕຳແໜ່ງ. ເຈົ້າເປີດ Google Maps ເພື່ອນຳທາງໄດ້ເລີຍ.');
    }
  }, {enableHighAccuracy: true, maximumAge: 0, timeout: 15000});
});
window.addEventListener('pagehide', () => stopTracking());
