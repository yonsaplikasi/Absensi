// ============================================================
// ABSENSI DINAS X - FRONTEND V2
// ============================================================

// URL Web App Google Apps Script
const API_URL = "PASTE_URL_WEB_APP_APPS_SCRIPT_DI_SINI";

// Helper mengambil elemen HTML berdasarkan ID
const $ = (id) => document.getElementById(id);

// Menyimpan data sesi pegawai yang sedang login
let session = null;


// ============================================================
// API
// ============================================================

async function api(payload) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
    });

    return await response.json();
}


// ============================================================
// PESAN / NOTIFIKASI
// ============================================================

function msg(text, success = false) {
    const element = $("message");

    element.textContent = text;
    element.className = "message show";
    element.style.background = success
        ? "#eef7ee"
        : "#fff0f0";
}


// ============================================================
// IDENTITAS PERANGKAT
// ============================================================

function device() {
    let deviceId = localStorage.getItem("dinas_x_device_id");

    if (!deviceId) {
        deviceId = crypto.randomUUID
            ? crypto.randomUUID()
            : "dev-" + Date.now();

        localStorage.setItem(
            "dinas_x_device_id",
            deviceId
        );
    }

    return deviceId;
}


// ============================================================
// GPS / GEOLOCATION
// ============================================================

function pos() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });
}


// ============================================================
// LOGIN
// ============================================================

async function login() {
    const nip = $("nip").value.trim();
    const pin = $("pin").value.trim();

    // Validasi input
    if (!nip || !pin) {
        return msg("NIP dan PIN wajib diisi.");
    }

    $("loginBtn").disabled = true;

    try {
        // Kirim data login ke Apps Script
        const result = await api({
            action: "login",
            nip: nip,
            pin: pin
        });

        // Jika login gagal
        if (!result.ok) {
            throw new Error(result.message);
        }

        // Simpan sesi
        session = {
            nip: nip,
            pin: pin,
            employee: result.employee
        };

        // Tampilkan data pegawai
        $("nama").textContent = result.employee.nama;
        $("nipView").textContent = result.employee.nip;
        $("bagian").textContent = result.employee.bagian;

        // Ganti tampilan login ke tampilan pegawai
        $("loginBox").classList.add("hidden");
        $("employeeBox").classList.remove("hidden");

        msg("Login berhasil.", true);

        // Cek GPS
        gps();

    } catch (error) {
        msg(error.message);

    } finally {
        $("loginBtn").disabled = false;
    }
}


// ============================================================
// CEK GPS
// ============================================================

async function gps() {
    try {
        const position = await pos();

        const accuracy = Math.round(
            position.coords.accuracy
        );

        $("gpsStatus").textContent =
            "GPS aktif. Akurasi sekitar " +
            accuracy +
            " meter.";

    } catch (error) {
        $("gpsStatus").textContent =
            "GPS belum tersedia. Nyalakan Lokasi/GPS pada HP.";
    }
}


// ============================================================
// ABSENSI MASUK / KELUAR
// ============================================================

async function attendance(type) {

    // Pastikan pegawai sudah login
    if (!session) {
        return msg("Silakan login.");
    }

    // Nonaktifkan tombol sementara
    $("masukBtn").disabled = true;
    $("keluarBtn").disabled = true;

    try {
        // Ambil lokasi GPS
        const position = await pos();

        // Kirim data absensi ke Apps Script
        const result = await api({
            action: "submitAttendance",

            type: type,

            nip: session.nip,
            pin: session.pin,

            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,

            deviceId: device(),

            browser: navigator.userAgent,
            os: navigator.platform,

            googleEmail: ""
        });

        // Jika absensi gagal
        if (!result.ok) {
            throw new Error(result.message);
        }

        // Pesan hasil absensi
        let message =
            result.message +
            " Waktu server: " +
            result.serverTime;

        // Jika sistem memberikan status pemeriksaan
        if (
            result.auditStatus ===
            "PERLU_PEMERIKSAAN"
        ) {
            message +=
                " | " +
                result.auditCatatan;
        }

        msg(message, true);

    } catch (error) {
        msg(error.message);

    } finally {
        // Aktifkan kembali tombol
        $("masukBtn").disabled = false;
        $("keluarBtn").disabled = false;
    }
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {
    // Hapus sesi
    session = null;

    // Kosongkan PIN
    $("pin").value = "";

    // Kembali ke tampilan login
    $("employeeBox").classList.add("hidden");
    $("loginBox").classList.remove("hidden");

    msg("Anda telah keluar.", true);
}


// ============================================================
// EVENT BUTTON
// ============================================================

$("loginBtn").onclick = login;

$("masukBtn").onclick = () => {
    attendance("MASUK");
};

$("keluarBtn").onclick = () => {
    attendance("KELUAR");
};

$("logoutBtn").onclick = logout;
