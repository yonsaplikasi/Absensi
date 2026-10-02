/* =========================================================
   KONFIGURASI
   ========================================================= */

const API_URL = 'PASTE_APPS_SCRIPT_WEB_APP_EXEC_URL_DI_SINI';

const NIP_KEY = 'absensi_v3_nip';
const DEV_KEY = 'absensi_v3_device';

let pending = null;


/* =========================================================
   HELPER ELEMENT
   ========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener('DOMContentLoaded', init);

async function init() {

  const buttons = [
    'verifyBtn',
    'confirmBtn',
    'backBtn',
    'gpsBtn',
    'masukBtn',
    'keluarBtn',
    'resetBtn'
  ];

  buttons.forEach((id) => {
    $(id).addEventListener('click', () => {
      handlers[id]();
    });
  });


  // Cek sesi yang tersimpan di browser
  const nip = localStorage.getItem(NIP_KEY);
  const deviceId = localStorage.getItem(DEV_KEY);

  if (!nip || !deviceId) {
    return showVerify();
  }


  // Validasi sesi ke server
  try {

    const response = await api({
      action: 'getSession',
      nip: nip,
      deviceId: deviceId
    });

    if (response.ok) {

      showAttendance(response.employee);

    } else {

      localStorage.clear();

      showVerify();

      msg(response.message, 'error');
    }

  } catch (error) {

    showVerify();

    msg(error.message, 'error');
  }
}


/* =========================================================
   EVENT HANDLERS
   ========================================================= */

const handlers = {

  verifyBtn: verifyNip,

  confirmBtn: confirmVerification,

  backBtn: showVerify,

  gpsBtn: checkGps,

  masukBtn: () => attendance('MASUK'),

  keluarBtn: () => attendance('KELUAR'),

  resetBtn: resetSession

};


/* =========================================================
   DEVICE ID
   ========================================================= */

function device() {

  let deviceId = localStorage.getItem(DEV_KEY);

  if (!deviceId) {

    deviceId =
      'DEV-' +
      (
        crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now()
      );

    localStorage.setItem(DEV_KEY, deviceId);
  }

  return deviceId;
}


/* =========================================================
   VERIFIKASI NIP
   ========================================================= */

async function verifyNip() {

  const nip = $('nip').value.trim();

  if (!nip) {
    return msg('NIP wajib diisi.', 'error');
  }


  busy(
    'verifyBtn',
    true,
    'Memeriksa...'
  );


  try {

    const response = await api({
      action: 'verifyNip',
      nip: nip,
      deviceId: device()
    });


    if (!response.ok) {
      return msg(response.message, 'error');
    }


    // Simpan data sementara sebelum konfirmasi
    pending = response.employee;


    $('confirmData').innerHTML = rows(pending);


    $('verifyView').classList.add('hidden');

    $('confirmView').classList.remove('hidden');


  } catch (error) {

    msg(error.message, 'error');


  } finally {

    busy(
      'verifyBtn',
      false,
      'VERIFIKASI NIP'
    );
  }
}


/* =========================================================
   KONFIRMASI VERIFIKASI
   ========================================================= */

async function confirmVerification() {

  if (!pending) {
    return;
  }


  busy(
    'confirmBtn',
    true,
    'Menyimpan...'
  );


  try {

    const response = await api({
      action: 'confirmVerification',
      nip: pending.nip,
      deviceId: device()
    });


    if (!response.ok) {
      return msg(response.message, 'error');
    }


    // Simpan NIP ke browser
    localStorage.setItem(
      NIP_KEY,
      pending.nip
    );


    // Tampilkan halaman absensi
    showAttendance(
      response.employee || pending
    );


    msg(
      'Verifikasi berhasil.',
      'success'
    );


  } catch (error) {

    msg(error.message, 'error');


  } finally {

    busy(
      'confirmBtn',
      false,
      'KONFIRMASI & AKTIFKAN'
    );
  }
}


/* =========================================================
   ABSENSI MASUK / KELUAR
   ========================================================= */

async function attendance(type) {

  const nip = localStorage.getItem(NIP_KEY);

  const deviceId =
    localStorage.getItem(DEV_KEY);


  // Pastikan sesi tersedia
  if (!nip || !deviceId) {
    return showVerify();
  }


  $('gpsStatus').textContent =
    'Meminta lokasi GPS terbaru...';


  // Nonaktifkan tombol sementara
  $('masukBtn').disabled = true;

  $('keluarBtn').disabled = true;


  try {

    // Ambil lokasi terbaru
    const positionData =
      await position();


    // Kirim absensi ke server
    const response = await api({

      action: 'submitAttendance',

      type: type,

      nip: nip,

      deviceId: deviceId,

      latitude:
        positionData.coords.latitude,

      longitude:
        positionData.coords.longitude,

      accuracy:
        positionData.coords.accuracy,

      browser:
        navigator.userAgent,

      os:
        os()

    });


    msg(
      response.message +
      (
        response.serverTime
          ? ' Waktu server: ' +
            response.serverTime
          : ''
      ),
      response.ok
        ? 'success'
        : 'error'
    );


  } catch (error) {

    msg(
      error.message,
      'error'
    );


  } finally {

    // Aktifkan kembali tombol
    $('masukBtn').disabled = false;

    $('keluarBtn').disabled = false;
  }
}


/* =========================================================
   CEK GPS
   ========================================================= */

async function checkGps() {

  busy(
    'gpsBtn',
    true,
    'Mencari lokasi...'
  );


  try {

    const positionData =
      await position();


    const accuracy =
      Math.round(
        positionData.coords.accuracy
      );


    $('gpsStatus').textContent =
      'GPS aktif. Akurasi ±' +
      accuracy +
      ' meter.';


    msg(
      'Lokasi GPS berhasil diperoleh.',
      'success'
    );


  } catch (error) {

    $('gpsStatus').textContent =
      'GPS belum berhasil diperoleh.';


    msg(
      error.message,
      'error'
    );


  } finally {

    busy(
      'gpsBtn',
      false,
      'CEK / AKTIFKAN GPS'
    );
  }
}


/* =========================================================
   GEOLOCATION
   ========================================================= */

function position() {

  return new Promise((resolve, reject) => {

    // Browser tidak mendukung GPS
    if (!navigator.geolocation) {

      return reject(
        Error(
          'Browser tidak mendukung GPS/lokasi.'
        )
      );
    }


    navigator.geolocation.getCurrentPosition(

      resolve,

      (error) => {

        let message;


        if (error.code === 1) {

          message =
            'Izin lokasi ditolak. ' +
            'Aktifkan izin lokasi.';

        } else if (error.code === 2) {

          message =
            'Lokasi tidak tersedia. ' +
            'Aktifkan GPS/Lokasi.';

        } else {

          message =
            'Permintaan lokasi gagal/timeout.';
        }


        reject(
          Error(message)
        );
      },

      {
        enableHighAccuracy: true,

        timeout: 15000,

        maximumAge: 0
      }
    );
  });
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function api(payload) {

  // Pastikan URL API sudah diisi
  if (
    API_URL.includes(
      'PASTE_APPS_SCRIPT'
    )
  ) {

    throw Error(
      'API_URL belum diisi dengan URL Apps Script /exec.'
    );
  }


  const response = await fetch(
    API_URL,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'text/plain;charset=utf-8'
      },

      body: JSON.stringify(payload)
    }
  );


  const text =
    await response.text();


  // Coba membaca response sebagai JSON
  try {

    return JSON.parse(text);

  } catch (error) {

    // Apps Script kemungkinan mengembalikan HTML
    if (
      text
        .trim()
        .startsWith('<')
    ) {

      throw Error(
        'Server mengembalikan HTML, bukan JSON. ' +
        'Periksa URL /exec dan deployment Web App.'
      );
    }


    throw Error(
      'Respons server bukan JSON: ' +
      text.slice(0, 120)
    );
  }
}


/* =========================================================
   TAMPILAN — VERIFIKASI
   ========================================================= */

function showVerify() {

  $('verifyView')
    .classList
    .remove('hidden');


  $('confirmView')
    .classList
    .add('hidden');


  $('attendanceView')
    .classList
    .add('hidden');
}


/* =========================================================
   TAMPILAN — ABSENSI
   ========================================================= */

function showAttendance(employee) {

  $('verifyView')
    .classList
    .add('hidden');


  $('confirmView')
    .classList
    .add('hidden');


  $('attendanceView')
    .classList
    .remove('hidden');


  $('greeting').textContent =
    'Halo, ' +
    employee.nama;


  $('sessionData').innerHTML =
    rows(employee);
}


/* =========================================================
   DATA PEGAWAI
   ========================================================= */

function rows(employee) {

  return `
    <div class="row">
      <span>NIP</span>
      <strong>
        ${esc(employee.nip)}
      </strong>
    </div>

    <div class="row">
      <span>Nama</span>
      <strong>
        ${esc(employee.nama)}
      </strong>
    </div>

    <div class="row">
      <span>Bagian</span>
      <strong>
        ${esc(employee.bagian)}
      </strong>
    </div>

    <div class="row">
      <span>Jabatan</span>
      <strong>
        ${esc(employee.jabatan)}
      </strong>
    </div>
  `;
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function esc(value) {

  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,
    (character) => {

      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];

    }
  );
}


/* =========================================================
   BUTTON STATE
   ========================================================= */

function busy(
  id,
  isBusy,
  text
) {

  $(id).disabled = isBusy;

  $(id).textContent = text;
}


/* =========================================================
   MESSAGE
   ========================================================= */

function msg(
  text,
  type
) {

  $('message').textContent =
    text || '';


  $('message').className =
    'message ' +
    (type || '');
}


/* =========================================================
   DETEKSI OPERATING SYSTEM
   ========================================================= */

function os() {

  const userAgent =
    navigator.userAgent;


  if (/Android/i.test(userAgent)) {

    return 'Android';
  }


  if (
    /iPhone|iPad|iPod/i
      .test(userAgent)
  ) {

    return 'iOS';
  }


  if (/Windows/i.test(userAgent)) {

    return 'Windows';
  }


  if (/Mac OS X/i.test(userAgent)) {

    return 'macOS';
  }


  return 'Unknown';
}


/* =========================================================
   RESET SESSION
   ========================================================= */

function resetSession() {

  if (
    confirm(
      'Hapus sesi browser ini?'
    )
  ) {

    localStorage.removeItem(
      NIP_KEY
    );

    localStorage.removeItem(
      DEV_KEY
    );


    showVerify();


    msg(
      'Sesi dihapus.',
      'success'
    );
  }
}
