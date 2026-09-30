// GANTI dengan URL Web App Apps Script setelah deployment.
const API_URL = "PASTE_URL_WEB_APP_APPS_SCRIPT_DI_SINI";

const employeeEl = document.getElementById("employee");
const identityEl = document.getElementById("identity");
const nipEl = document.getElementById("nip");
const bagianEl = document.getElementById("bagian");
const gpsStatusEl = document.getElementById("gpsStatus");
const messageEl = document.getElementById("message");
const btnMasuk = document.getElementById("btnMasuk");
const btnKeluar = document.getElementById("btnKeluar");

let employees = [];
let lastPosition = null;

document.addEventListener("DOMContentLoaded", async () => {
  employeeEl.addEventListener("change", updateIdentity);
  btnMasuk.addEventListener("click", () => doAttendance("MASUK"));
  btnKeluar.addEventListener("click", () => doAttendance("KELUAR"));
  await loadEmployees();
  checkGps();
});

async function loadEmployees(){
  if(API_URL.includes("PASTE_URL")){
    showMessage("URL Apps Script belum diisi di app.js.", "error");
    employeeEl.innerHTML = '<option value="">URL backend belum diisi</option>';
    return;
  }

  try{
    const res = await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"getEmployees"})
    });
    const data = await res.json();

    if(!data.ok) throw new Error(data.message);

    employees = data.employees || [];
    employeeEl.innerHTML = '<option value="">-- Pilih nama Anda --</option>';

    employees.forEach(e=>{
      const opt = document.createElement("option");
      opt.value = e.nip;
      opt.textContent = `${e.nama} — ${e.nip}`;
      employeeEl.appendChild(opt);
    });
  }catch(err){
    showMessage("Gagal mengambil data pegawai: "+err.message,"error");
  }
}

function updateIdentity(){
  const e = employees.find(x => x.nip === employeeEl.value);
  if(!e){
    identityEl.classList.add("hidden");
    return;
  }
  nipEl.textContent = e.nip;
  bagianEl.textContent = e.bagian || "-";
  identityEl.classList.remove("hidden");
}

function checkGps(){
  if(!navigator.geolocation){
    gpsStatusEl.textContent = "Browser ini tidak mendukung GPS/lokasi.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos=>{
      lastPosition = pos;
      gpsStatusEl.textContent =
        `Lokasi tersedia. Akurasi sekitar ${Math.round(pos.coords.accuracy)} meter.`;
    },
    err=>{
      lastPosition = null;
      if(err.code === 1){
        gpsStatusEl.textContent =
          "Akses lokasi ditolak. Silakan izinkan akses lokasi pada browser.";
      }else{
        gpsStatusEl.textContent =
          "Lokasi belum tersedia. Harap nyalakan GPS/Lokasi pada HP lalu tekan Coba Lagi.";
      }
    },
    {enableHighAccuracy:true, timeout:10000, maximumAge:0}
  );
}

function getDeviceId(){
  const key = "dinas_x_device_id";
  let id = localStorage.getItem(key);
  if(!id){
    id = "DEV-" + crypto.randomUUID();
    localStorage.setItem(key,id);
  }
  return id;
}

function getBrowserInfo(){
  return navigator.userAgent || "";
}

function getOsInfo(){
  return navigator.platform || "";
}

async function getGoogleEmail(){
  // V1: email tidak menjadi pengunci.
  // Jika nanti menggunakan Google Identity Services/OAuth,
  // email akun Google yang terautentikasi dapat dikirim di sini.
  return "";
}

async function getFreshPosition(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){
      reject(new Error("Browser tidak mendukung GPS."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      p=>resolve(p),
      e=>{
        if(e.code===1)
          reject(new Error("Akses GPS ditolak. Silakan izinkan lokasi."));
        else
          reject(new Error("GPS belum tersedia. Harap nyalakan GPS/Lokasi pada HP."));
      },
      {enableHighAccuracy:true,timeout:15000,maximumAge:0}
    );
  });
}

async function doAttendance(type){
  const nip = employeeEl.value;
  if(!nip){
    showMessage("Silakan pilih nama Anda terlebih dahulu.","warn");
    return;
  }

  setButtons(false);
  showMessage("Memeriksa lokasi GPS...","warn");

  try{
    const pos = await getFreshPosition();
    lastPosition = pos;

    const googleEmail = await getGoogleEmail();

    const payload = {
      action:"submitAttendance",
      type:type,
      nip:nip,
      latitude:pos.coords.latitude,
      longitude:pos.coords.longitude,
      accuracy:pos.coords.accuracy,
      deviceId:getDeviceId(),
      browser:getBrowserInfo(),
      os:getOsInfo(),
      googleEmail:googleEmail
    };

    const res = await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });

    const data = await res.json();

    if(data.ok){
      let extra = "";
      if(data.auditStatus === "PERLU_PEMERIKSAAN"){
        extra = "<br><b>Catatan:</b> transaksi akan diperiksa admin.";
      }
      showMessage(data.message+"<br>Waktu server: "+data.serverTime+extra,
        data.auditStatus==="PERLU_PEMERIKSAAN" ? "warn" : "ok");
    }else{
      showMessage(data.message || "Absensi ditolak.","error");
    }
  }catch(err){
    showMessage(err.message || "Terjadi kesalahan.","error");
  }finally{
    setButtons(true);
  }
}

function setButtons(enabled){
  btnMasuk.disabled = !enabled;
  btnKeluar.disabled = !enabled;
}

function showMessage(text,type){
  messageEl.innerHTML = text;
  messageEl.className = "message show "+type;
}
