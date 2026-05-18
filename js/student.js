/**
 * Student Home Location System - Student Portal Script
 */

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxbshPInqhmucDvIBZWD039cqbIubRobOMS7uSygXK8TTlN1n4khH2E-gJgKzg3op1R/exec";

// Global Application States
let studentMap;
let studentMarker;
const defaultThaiCenter = [13.7563, 100.5018]; // พิกัดกรุงเทพฯ เริ่มต้น

document.addEventListener("DOMContentLoaded", () => {
  initUIControllers();
  initStudentMap();
});

/**
 * Initialize UI Elements & Event Listeners
 */
function initUIControllers() {
  // Dark Mode Toggle Logic
  const htmlEl = document.documentElement;
  const btnDark = document.getElementById("darkModeToggle");
  btnDark.addEventListener("click", () => {
    if (htmlEl.getAttribute("data-bs-theme") === "light") {
      htmlEl.setAttribute("data-bs-theme", "dark");
      btnDark.innerHTML = `<i class="bi bi-sun-fill"></i> โหมดสว่าง`;
    } else {
      htmlEl.setAttribute("data-bs-theme", "light");
      btnDark.innerHTML = `<i class="bi bi-moon-stars-fill"></i> โหมดมืด`;
    }
  });

  // Event listener to check for duplicate student ID in real-time
  document.getElementById("studentId").addEventListener("change", handleStudentIdCheck);

  // Student Input Form Submission Hook
  const form = document.getElementById("studentForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      e.stopPropagation();
      form.classList.add('was-validated');
      showToast("กรุณากรอกข้อมูลส่วนตัวและระบุตำแหน่งบนแผนที่ให้ครบถ้วน", "bg-danger");
      return;
    }
    await submitStudentData();
  });

  // Reset form button helper
  document.getElementById("btnResetForm").addEventListener("click", () => {
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById("studentIdWarning").classList.add("d-none");
    if (studentMarker) {
      studentMarker.setLatLng(defaultThaiCenter);
      studentMap.setView(defaultThaiCenter, 6);
    }
    showToast("เคลียร์ข้อมูลในฟอร์มเรียบร้อย", "bg-secondary");
  });

  // GPS location tracker anchor
  document.getElementById("btnCurrentLocation").addEventListener("click", trackGPSLocation);

  // Search Map Engine hook
  document.getElementById("btnMapSearch").addEventListener("click", executeMapSearch);
  document.getElementById("mapSearchInput").addEventListener("keypress", (e) => {
    if (e.key === 'Enter') executeMapSearch();
  });
}

/**
 * Toast notification component operational controller
 */
function showToast(message, bgClass = "bg-primary") {
  const toastEl = document.getElementById("liveToast");
  const toastMsg = document.getElementById("toastMessage");
  toastEl.className = `toast align-items-center text-white border-0 ${bgClass}`;
  toastMsg.innerText = message;
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

function toggleLoader(show) {
  const loader = document.getElementById("loadingOverlay");
  if (show) loader.classList.remove("d-none");
  else loader.classList.add("d-none");
}

/**
 * -----------------------------------------------
 * STUDENT PORTAL MAP & GEOLOCATION WORKFLOW
 * -----------------------------------------------
 */

function initStudentMap() {
  studentMap = L.map('studentMap').setView(defaultThaiCenter, 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(studentMap);

  // Create standard draggable pin for home selection
  studentMarker = L.marker(defaultThaiCenter, { draggable: true }).addTo(studentMap);

  // Dynamic latlng parameter synchronization hook
  studentMarker.on('dragend', function (e) {
    const position = studentMarker.getLatLng();
    updateFormCoordinates(position.lat, position.lng);
  });

  // Click direct to map canvas selection workflow redirection
  studentMap.on('click', function (e) {
    studentMarker.setLatLng(e.latlng);
    updateFormCoordinates(e.latlng.lat, e.latlng.lng);
  });
}

function updateFormCoordinates(lat, lng) {
  document.getElementById("latitude").value = parseFloat(lat).toFixed(6);
  document.getElementById("longitude").value = parseFloat(lng).toFixed(6);
}

/**
 * Real-time active physical GPS Tracking Hardware Protocol Access
 */
function trackGPSLocation() {
  if (!navigator.geolocation) {
    showToast("เบราว์เซอร์หรืออุปกรณ์ของคุณไม่รองรับการใช้งาน GPS", "bg-danger");
    return;
  }

  toggleLoader(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const latlng = [lat, lng];

      studentMarker.setLatLng(latlng);
      studentMap.setView(latlng, 16);
      updateFormCoordinates(lat, lng);
      toggleLoader(false);
      showToast("ดึงพิกัดปัจจุบันจากระบบ GPS สำเร็จ", "bg-success");
    },
    (error) => {
      toggleLoader(false);
      showToast("ไม่สามารถเข้าถึงพิกัดปัจจุบันได้ กรุณาเปิดสิทธิ์ระบุตำแหน่งบนอุปกรณ์", "bg-warning");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/**
 * OpenStreetMap Nominatim Geocoding Lookup Architecture Integration
 */
async function executeMapSearch() {
  const query = document.getElementById("mapSearchInput").value.trim();
  if (!query) return;

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const searchResult = await response.json();

    if (searchResult && searchResult.length > 0) {
      const topResult = searchResult[0];
      const lat = parseFloat(topResult.lat);
      const lng = parseFloat(topResult.lon);

      studentMarker.setLatLng([lat, lng]);
      studentMap.setView([lat, lng], 14);
      updateFormCoordinates(lat, lng);
    } else {
      showToast("ไม่พบสถานที่ที่ค้นหา กรุณาลองระบุคำค้นหาที่กว้างขึ้น", "bg-warning");
    }
  } catch (error) {
    console.error(error);
    showToast("ระบบค้นหาสถานที่ขัดข้องชั่วคราว", "bg-danger");
  }
}

/**
 * Fetch POST pipeline forwarding logic to register student home
 */
async function submitStudentData() {
  const payload = {
    studentId: document.getElementById("studentId").value.trim(),
    fullName: document.getElementById("fullName").value.trim(),
    class: document.getElementById("class").value.trim(),
    room: document.getElementById("room").value.trim(),
    number: document.getElementById("number").value.trim(),
    parentPhone: document.getElementById("parentPhone").value.trim(),
    address: document.getElementById("address").value.trim(),
    latitude: document.getElementById("latitude").value,
    longitude: document.getElementById("longitude").value
  };

  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const resData = await response.json();

    if (resData.status === "success") {
      showToast(resData.message, "bg-success");
      document.getElementById("studentForm").reset();
      document.getElementById("studentForm").classList.remove('was-validated');
      document.getElementById("studentIdWarning").classList.add("d-none");
    } else {
      showToast("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: " + resData.message, "bg-danger");
    }
  } catch (error) {
    console.error(error);
    showToast("เซิร์ฟเวอร์ขัดข้อง ไม่สามารถบันทึกข้อมูลได้", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}

/**
 * ดึงข้อมูลรหัสประจำตัวนักเรียนไปสืบค้นว่ามีข้อมูลปักหมุดแล้วหรือไม่ในฐานข้อมูล
 */
async function handleStudentIdCheck() {
  const studentIdInput = document.getElementById("studentId");
  const warningDiv = document.getElementById("studentIdWarning");
  const val = studentIdInput.value.trim();

  if (!val) {
    warningDiv.classList.add("d-none");
    warningDiv.innerHTML = "";
    return;
  }

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "checkStudentId",
        studentId: val
      })
    });
    const resData = await response.json();

    if (resData.status === "success" && resData.exists) {
      warningDiv.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i>พบรหัสนักเรียนนี้มีพิกัดพิกัดเยี่ยมบ้านในระบบแล้ว (คุณ${resData.fullName}) การส่งฟอร์มใหม่จะเป็นการเขียนทับ/อัปเดตตำแหน่งพิกัดเดิม`;
      warningDiv.classList.remove("d-none");
    } else {
      warningDiv.classList.add("d-none");
      warningDiv.innerHTML = "";
    }
  } catch (error) {
    console.error("ระบบเช็ครหัสนักเรียนซ้ำทำงานผิดพลาด: ", error);
  }
}
