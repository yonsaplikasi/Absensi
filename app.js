const API_URL = "https://script.google.com/macros/s/AKfycbxA6RXsBXFNSHNRybMeYkFzNpAx6UJ0z6kKWNNpRtTd8Xki74EelHQJx1Q-3aNcpkPQVA/exec";
const NIP_KEY = "absensi_v3_nip";
const DEV_KEY = "absensi_v3_device";
const VERIFIED_KEY = "absensi_v3_verified";
const EMPLOYEE_KEY = "absensi_v3_employee";

let pending = null;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  [
    "verifyBtn",
    "confirmBtn",
    "backBtn",
    "gpsBtn",
    "masukBtn",
    "keluarBtn",
    "resetBtn"
  ].forEach(id => {
    $(id).addEventListener("click", () => handlers[id]());
  });

  const nip = localStorage.getItem(NIP_KEY);
  const deviceId = localStorage.getItem(DEV_KEY);

  // Belum pernah verifikasi di browser/perangkat ini.
  if (!nip || !deviceId) {
    showVerify();
    return;
  }

  try {
    const result = await api({
      action: "getSession",
      nip,
      deviceId
    });

    if (result.ok) {
      saveSession(result.employee);
      showAttendance(result.employee);
      return;
    }

    // Hanya hapus sesi jika server secara tegas menyatakan sesi tidak valid.
    clearSession();
    showVerify();
    msg(result.message, "error");
  } catch (error) {
    // Jangan menghapus sesi hanya karena koneksi/API sedang bermasalah.
    const cachedEmployee = loadCachedEmployee();

    if (cachedEmployee) {
      showAttendance(cachedEmployee);

      msg(
        "Sesi tersimpan. Server belum dapat dihubungi, coba lagi jika ingin melakukan absensi.",
        "error"
      );
    } else {
      showVerify();
      msg(error.message, "error");
    }
  }
}

const handlers = {
  verifyBtn: verifyNip,
  confirmBtn: confirmVerification,
  backBtn: showVerify,
  gpsBtn: checkGps,
  masukBtn: () => attendance("MASUK"),
  keluarBtn: () => attendance("KELUAR"),
  resetBtn: resetSession
};

function device() {
  let deviceId = localStorage.getItem(DEV_KEY);

  if (!deviceId) {
    deviceId =
      "DEV-" +
      (
        crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now()
      );

    localStorage.setItem(DEV_KEY, deviceId);
  }

  return deviceId;
}

async function verifyNip() {
  const nip = $("nip").value.trim();

  if (!nip) {
    return msg("NIP wajib diisi.", "error");
  }

  busy("verifyBtn", true, "Memeriksa...");

  try {
    const result = await api({
      action: "verifyNip",
      nip,
      deviceId: device()
    });

    if (!result.ok) {
      return msg(result.message, "error");
    }

    pending = result.employee;

    $("confirmData").innerHTML = rows(pending);

    $("verifyView").classList.add("hidden");
    $("confirmView").classList.remove("hidden");
  } catch (error) {
    msg(error.message, "error");
  } finally {
    busy(
      "verifyBtn",
      false,
      "VERIFIKASI NIP"
    );
  }
}

async function confirmVerification() {
  if (!pending) {
    return;
  }

  busy(
    "confirmBtn",
    true,
    "Menyimpan..."
  );

  try {
    const result = await api({
      action: "confirmVerification",
      nip: pending.nip,
      deviceId: device()
    });

    if (!result.ok) {
      return msg(result.message, "error");
    }

    const employee = result.employee || pending;

    saveSession(employee);
    showAttendance(employee);

    msg(
      "Verifikasi berhasil.",
      "success"
    );
  } catch (error) {
    msg(error.message, "error");
  } finally {
    busy(
      "confirmBtn",
      false,
      "KONFIRMASI & AKTIFKAN"
    );
  }
}

function saveSession(employee) {
  if (!employee || !employee.nip) {
    return;
  }

  localStorage.setItem(
    NIP_KEY,
    employee.nip
  );

  localStorage.setItem(
    VERIFIED_KEY,
    "1"
  );

  localStorage.setItem(
    EMPLOYEE_KEY,
    JSON.stringify(employee)
  );
}

function loadCachedEmployee() {
  try {
    const raw = localStorage.getItem(
      EMPLOYEE_KEY
    );

    return raw
      ? JSON.parse(raw)
      : null;
  } catch (error) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(NIP_KEY);
  localStorage.removeItem(DEV_KEY);
  localStorage.removeItem(VERIFIED_KEY);
  localStorage.removeItem(EMPLOYEE_KEY);

  pending = null;
}

async function attendance(type) {
  const nip = localStorage.getItem(NIP_KEY);
  const deviceId = localStorage.getItem(DEV_KEY);

  if (!nip || !deviceId) {
    return showVerify();
  }

  $("gpsStatus").textContent =
    "Meminta lokasi GPS terbaru...";

  $("masukBtn").disabled = true;
  $("keluarBtn").disabled = true;

  try {
    const positionData = await position();

    const result = await api({
      action: "submitAttendance",
      type,
      nip,
      deviceId,
      latitude: positionData.coords.latitude,
      longitude: positionData.coords.longitude,
      accuracy: positionData.coords.accuracy,
      browser: navigator.userAgent,
      os: os()
    });

    msg(
      result.message +
        (
          result.serverTime
            ? " Waktu server: " + result.serverTime
            : ""
        ),
      result.ok
        ? "success"
        : "error"
    );
  } catch (error) {
    msg(
      error.message,
      "error"
    );
  } finally {
    $("masukBtn").disabled = false;
    $("keluarBtn").disabled = false;
  }
}

async function checkGps() {
  busy(
    "gpsBtn",
    true,
    "Mencari lokasi..."
  );

  try {
    const positionData = await position();

    $("gpsStatus").textContent =
      "GPS aktif. Akurasi ±" +
      Math.round(
        positionData.coords.accuracy
      ) +
      " meter.";

    msg(
      "Lokasi GPS berhasil diperoleh.",
      "success"
    );
  } catch (error) {
    $("gpsStatus").textContent =
      "GPS belum berhasil diperoleh.";

    msg(
      error.message,
      "error"
    );
  } finally {
    busy(
      "gpsBtn",
      false,
      "CEK / AKTIFKAN GPS"
    );
  }
}

function position() {
  return new Promise(
    (resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(
          Error(
            "Browser tidak mendukung GPS/lokasi."
          )
        );
      }

      navigator.geolocation.getCurrentPosition(
        resolve,

        error => {
          reject(
            Error(
              error.code === 1
                ? "Izin lokasi ditolak. Aktifkan izin lokasi."
                : error.code === 2
                  ? "Lokasi tidak tersedia. Aktifkan GPS/Lokasi."
                  : "Permintaan lokasi gagal/timeout."
            )
          );
        },

        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    }
  );
}

async function api(payload) {
  if (
    API_URL.includes(
      "PASTE_APPS_SCRIPT"
    )
  ) {
    throw Error(
      "API_URL belum diisi dengan URL Apps Script /exec."
    );
  }

  const response = await fetch(
    API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "text/plain;charset=utf-8"
      },

      body: JSON.stringify(payload)
    }
  );

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    throw Error(
      text.trim().startsWith("<")
        ? "Server mengembalikan HTML, bukan JSON. Periksa URL /exec dan deployment Web App."
        : "Respons server bukan JSON: " +
          text.slice(0, 120)
    );
  }
}

function showVerify() {
  $("verifyView").classList.remove(
    "hidden"
  );

  $("confirmView").classList.add(
    "hidden"
  );

  $("attendanceView").classList.add(
    "hidden"
  );
}

function showAttendance(employee) {
  if (!employee) {
    return showVerify();
  }

  $("verifyView").classList.add(
    "hidden"
  );

  $("confirmView").classList.add(
    "hidden"
  );

  $("attendanceView").classList.remove(
    "hidden"
  );

  $("greeting").textContent =
    "Halo, " + employee.nama;

  $("sessionData").innerHTML =
    rows(employee);
}

function rows(employee) {
  return `
    <div class="row">
      <span>NIP</span>
      <strong>${esc(employee.nip)}</strong>
    </div>

    <div class="row">
      <span>Nama</span>
      <strong>${esc(employee.nama)}</strong>
    </div>

    <div class="row">
      <span>Bagian</span>
      <strong>${esc(employee.bagian)}</strong>
    </div>

    <div class="row">
      <span>Jabatan</span>
      <strong>${esc(employee.jabatan)}</strong>
    </div>
  `;
}

function esc(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    match => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[match])
  );
}

function busy(
  id,
  isBusy,
  text
) {
  $(id).disabled = isBusy;
  $(id).textContent = text;
}

function msg(
  text,
  type
) {
  $("message").textContent =
    text || "";

  $("message").className =
    "message " + (type || "");
}

function os() {
  const userAgent =
    navigator.userAgent;

  if (/Android/i.test(userAgent)) {
    return "Android";
  }

  if (
    /iPhone|iPad|iPod/i.test(userAgent)
  ) {
    return "iOS";
  }

  if (/Windows/i.test(userAgent)) {
    return "Windows";
  }

  if (/Mac OS X/i.test(userAgent)) {
    return "macOS";
  }

  return "Unknown";
}

function resetSession() {
  if (
    !confirm(
      "Hapus sesi browser ini?"
    )
  ) {
    return;
  }

  clearSession();
  showVerify();

  msg(
    "Sesi dihapus. Silakan verifikasi NIP kembali.",
    "success"
  );
}
