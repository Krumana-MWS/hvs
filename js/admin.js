/**
 * Student Home Location System - Teacher Dashboard Script
 */

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxbshPInqhmucDvIBZWD039cqbIubRobOMS7uSygXK8TTlN1n4khH2E-gJgKzg3op1R/exec";

// Global Application States
let adminMap;
let adminMarkersLayer = L.layerGroup();
let allStudentsData = [];
let currentPage = 1;
const rowsPerPage = 10;
let filteredStudentsList = [];
const defaultThaiCenter = [13.7563, 100.5018]; // พิกัดกรุงเทพฯ เริ่มต้น

document.addEventListener("DOMContentLoaded", () => {
  initUIControllers();
  // สั่งโหลดแดชบอร์ดอัตโนมัติ (หากมีเซสชันค้างอยู่จะผ่านเข้าหน้าแอดมินทันที)
  loadTeacherDashboard();
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

  // Register filter query dynamic update trigger for Teacher Data Table
  document.getElementById("tableSearchInput").addEventListener("input", applyTableFilters);
  document.getElementById("filterClass").addEventListener("change", applyTableFilters);
  document.getElementById("filterRoom").addEventListener("change", applyTableFilters);
  document.getElementById("filterStatus").addEventListener("change", applyTableFilters);
  document.getElementById("filterDeleteStatus").addEventListener("change", applyTableFilters);

  // Admin Login Form Hook
  const adminForm = document.getElementById("adminLoginForm");
  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!adminForm.checkValidity()) {
      e.stopPropagation();
      adminForm.classList.add('was-validated');
      showToast("กรุณากรอกข้อมูลชื่อผู้ใช้และรหัสผ่านเพื่อเข้าสู่ระบบ", "bg-danger");
      return;
    }
    const usernameInput = document.getElementById("adminUsername").value.trim();
    const passwordInput = document.getElementById("adminPassword").value.trim();
    await handleLogin(usernameInput, passwordInput);
  });

  // Add Admin Form Hook
  const addAdminForm = document.getElementById("addAdminForm");
  addAdminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!addAdminForm.checkValidity()) {
      e.stopPropagation();
      addAdminForm.classList.add('was-validated');
      showToast("กรุณากรอกข้อมูลคุณครูใหม่ให้ครบถ้วน", "bg-danger");
      return;
    }
    await handleAddAdmin();
  });

  // Edit Student Form Hook
  const editStudentForm = document.getElementById("editStudentForm");
  editStudentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editStudentForm.checkValidity()) {
      e.stopPropagation();
      editStudentForm.classList.add('was-validated');
      showToast("กรุณากรอกประวัตินักเรียนให้ครบถ้วนสมบูรณ์", "bg-danger");
      return;
    }
    await saveStudentEdits();
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
 * TEACHER ADMINISTRATIVE DASHBOARD WORKFLOW
 * -----------------------------------------------
 */

function initAdminMap() {
  adminMap = L.map('adminMap').setView(defaultThaiCenter, 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(adminMap);
  adminMarkersLayer.addTo(adminMap);
}

/**
 * Core Orchestrator to update Teacher View Metrics and Tables
 */
async function loadTeacherDashboard() {
  const adminUser = sessionStorage.getItem("adminUser");
  const adminPass = sessionStorage.getItem("adminPass");
  const adminName = sessionStorage.getItem("adminName");

  const loginView = document.getElementById("teacherLoginView");
  const dashboardView = document.getElementById("teacherDashboardView");
  const sessionInfo = document.getElementById("adminSessionInfo");
  const sessionName = document.getElementById("adminSessionName");

  // ถ้ายังไม่ล็อกอิน ให้แสดงฟอร์มล็อกอิน และซ่อนแดชบอร์ด
  if (!adminUser || !adminPass) {
    loginView.classList.remove("d-none");
    dashboardView.classList.add("d-none");
    sessionInfo.classList.add("d-none");
    return;
  }

  // แสดงแดชบอร์ด ซ่อนฟอร์มล็อกอิน และเปิดแถบเซสชันใน Navbar
  loginView.classList.add("d-none");
  dashboardView.classList.remove("d-none");
  sessionInfo.classList.remove("d-none");
  sessionName.innerText = adminName || adminUser;

  // จัดการความเข้ากันได้ของแผนที่ Leaflet ในหน้าบอร์ดใหม่
  if (!adminMap) {
    initAdminMap();
  } else {
    setTimeout(() => {
      adminMap.invalidateSize();
    }, 100);
  }

  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "getStudents",
        username: adminUser,
        password: adminPass
      })
    });
    const result = await response.json();

    if (result.status === "success") {
      if (!result.data) {
        showToast("ระบบหลังบ้าน (Google Apps Script) ยังไม่ถูกอัปเดต! กรุณาคัดลอกโค้ดจากไฟล์ code.gs ไปวางและทำตามคู่มือ Redeploy ใน Apps Script", "bg-warning");
        handleLogout();
        return;
      }
      allStudentsData = result.data;
      renderAnalyticsCards(allStudentsData);
      populateClassFilterOptions(allStudentsData);
      populateRoomFilterOptions(allStudentsData);
      applyTableFilters(); // คำนวณแสดงหมุดแผนที่และอัปเดตตารางคุณครู
    } else {
      showToast("เกิดข้อผิดพลาด: " + result.message, "bg-danger");
      handleLogout(); // บัญชีขัดข้อง ให้ครูออกจากระบบชั่วคราว
    }
  } catch (error) {
    console.error(error);
    showToast("ระบบเครือข่ายเชื่อมต่อ API ล้มเหลว", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}

function renderAnalyticsCards(data) {
  // กรองเฉพาะนักเรียนปกติ (ไม่ได้ถูกลบชั่วคราว) เพื่อใช้คิดคำนวณเป็นตัวเลขวิเคราะห์ข้อมูลบนแดชบอร์ด
  const activeData = data.filter(s => String(s.deleteStatus).trim().toLowerCase() !== "deleted");
  const registeredCount = activeData.length;
  const visitedCount = activeData.filter(s => s.visitStatus === "เยี่ยมเรียบร้อยแล้ว").length;
  const pendingCount = registeredCount - visitedCount;

  document.getElementById("countRegistered").innerText = registeredCount;
  document.getElementById("countPending").innerText = pendingCount;
  document.getElementById("countVisited").innerText = visitedCount;
}

function populateClassFilterOptions(data) {
  const filterSelect = document.getElementById("filterClass");
  const existingValue = filterSelect.value;

  // Extract distinct 'class' data attributes
  const classes = [...new Set(data.map(item => item.class))].sort();

  filterSelect.innerHTML = '<option value="">-- ระดับชั้นทั้งหมด --</option>';
  classes.forEach(c => {
    if (c) {
      const option = document.createElement("option");
      option.value = c;
      option.innerText = `ชั้น ม.${c}`;
      filterSelect.appendChild(option);
    }
  });

  filterSelect.value = existingValue;
}

function populateRoomFilterOptions(data) {
  const filterSelect = document.getElementById("filterRoom");
  const existingValue = filterSelect.value;

  // Extract distinct 'room' data attributes
  const rooms = [...new Set(data.map(item => item.room))].sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true}));

  filterSelect.innerHTML = '<option value="">-- ห้องเรียนทั้งหมด --</option>';
  rooms.forEach(r => {
    if (r) {
      const option = document.createElement("option");
      option.value = r;
      option.innerText = `ห้อง ${r}`;
      filterSelect.appendChild(option);
    }
  });

  filterSelect.value = existingValue;
}

/**
 * Core Filter calculation logic engine mapping directly into current working UI state context
 */
function applyTableFilters() {
  const searchQuery = document.getElementById("tableSearchInput").value.toLowerCase().trim();
  const selectedClass = document.getElementById("filterClass").value;
  const selectedRoom = document.getElementById("filterRoom").value;
  const selectedStatus = document.getElementById("filterStatus").value;
  const selectedDeleteStatus = document.getElementById("filterDeleteStatus").value; // "active" หรือ "deleted"

  filteredStudentsList = allStudentsData.filter(student => {
    const matchesSearch =
      String(student.studentId).toLowerCase().includes(searchQuery) ||
      String(student.fullName).toLowerCase().includes(searchQuery) ||
      String(student.parentPhone).toLowerCase().includes(searchQuery);

    const matchesClass = selectedClass === "" || String(student.class) === selectedClass;
    const matchesRoom = selectedRoom === "" || String(student.room) === selectedRoom;
    const matchesStatus = selectedStatus === "" || String(student.visitStatus) === selectedStatus;

    // ตรวจสอบคัดกรองตามสถานะ Soft Delete
    const isDeleted = String(student.deleteStatus).trim().toLowerCase() === "deleted";
    const matchesDeleteStatus = (selectedDeleteStatus === "deleted") ? isDeleted : !isDeleted;

    return matchesSearch && matchesClass && matchesRoom && matchesStatus && matchesDeleteStatus;
  });

  currentPage = 1; // รีเซ็ตกลับไปหน้าแรกทุกครั้งที่มีการเปลี่ยนเงื่อนไขค้นหา
  renderStudentTable(filteredStudentsList);
  plotAdminMapMarkers(filteredStudentsList);
}

function renderStudentTable(data) {
  const tbody = document.getElementById("studentTableBody");
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา</td></tr>`;
    renderPaginationControls(0);
    return;
  }

  // คำนวณหาจำนวนครั้งที่แต่ละรหัสนักเรียนซ้ำกันในข้อมูลทั้งหมด (ไม่ใช่เฉพาะหน้าปัจจุบัน)
  const studentIdCounts = {};
  allStudentsData.forEach(s => {
    const id = String(s.studentId).trim();
    if (id) {
      studentIdCounts[id] = (studentIdCounts[id] || 0) + 1;
    }
  });

  // คำนวณขอบเขตข้อมูลสำหรับหน้าปัจจุบัน (Pagination Slice)
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  paginatedData.forEach(student => {
    const tr = document.createElement("tr");

    // Status color badge logic switcher
    const statusBadgeClass = student.visitStatus === "เยี่ยมเรียบร้อยแล้ว" ? "bg-success" : "bg-warning text-dark";

    // จัดการเบอร์โทรศัพท์ผู้ปกครองให้แสดงเลข 0 นำหน้าเสมอ (ช่วยซ่อมแซมเคสเบอร์ที่โดนกูเกิลชีตตัดเลข 0)
    const rawPhone = String(student.parentPhone || "").trim();
    const formattedPhone = (rawPhone.length > 0 && !rawPhone.startsWith("0")) ? "0" + rawPhone : rawPhone;

    // External Routing Navigation Link directly hooking standard universal Google Map deep-links
    const googleMapNavUrl = `https://www.google.com/maps/search/?api=1&query=${student.latitude},${student.longitude}`;

    // เช็ครหัสนักเรียนซ้ำ
    const isDuplicate = studentIdCounts[String(student.studentId).trim()] > 1;
    const duplicateBadge = isDuplicate ? `<span class="badge bg-danger text-white ms-1" style="font-size: 0.7rem;" title="พบรหัสนักเรียนนี้ซ้ำกันในระบบฐานข้อมูล Google Sheets"><i class="bi bi-exclamation-triangle-fill me-1"></i>ซ้ำ</span>` : "";

    const isViewingDeleted = document.getElementById("filterDeleteStatus").value === "deleted";
    let actionButtons = "";
    
    if (isViewingDeleted) {
      actionButtons = `
        <a href="${googleMapNavUrl}" target="_blank" class="btn btn-primary" title="เปิดแผนที่นำทางผ่าน Google Maps"><i class="bi bi-compass-fill me-1"></i>นำทาง</a>
        <button class="btn btn-success fw-bold" onclick="restoreStudent('${student.studentId}', '${student.fullName}')" title="กู้คืนรายชื่อนักเรียนกลับมา"><i class="bi bi-arrow-counterclockwise me-1"></i>กู้คืน</button>
      `;
    } else {
      actionButtons = `
        <a href="${googleMapNavUrl}" target="_blank" class="btn btn-primary" title="เปิดแผนที่นำทางผ่าน Google Maps"><i class="bi bi-compass-fill me-1"></i>นำทาง</a>
        <button class="btn btn-warning text-dark fw-bold" onclick="openEditStudentModal('${student.studentId}')" title="แก้ไขประวัติข้อมูลนักเรียน"><i class="bi bi-pencil-square-fill me-1"></i>แก้ไข</button>
        <button class="btn btn-dark" onclick="toggleVisitStatus('${student.studentId}', '${student.visitStatus}')" title="สลับเปลี่ยนสถานะงานเยี่ยมบ้าน"><i class="bi bi-arrow-left-right me-1"></i>ปรับสถานะ</button>
        <button class="btn btn-danger fw-bold" onclick="deleteStudent('${student.studentId}', '${student.fullName}')" title="ลบข้อมูลนักเรียน (ย้ายไปถังขยะ)"><i class="bi bi-trash-fill me-1"></i>ลบ</button>
      `;
    }

    tr.innerHTML = `
      <td>
        <span class="badge bg-secondary font-monospace">${student.studentId}</span>
        ${duplicateBadge}
      </td>
      <td class="fw-bold">${student.fullName}</td>
      <td>ม.${student.class}/${student.room} (เลขที่ ${student.number})</td>
      <td><a href="tel:${formattedPhone}" class="text-decoration-none"><i class="bi bi-telephone-outbound-fill me-1"></i>${formattedPhone}</a></td>
      <td><small class="text-muted text-truncate d-inline-block" style="max-width: 180px;" title="${student.address}">${student.address}</small></td>
      <td><span class="badge ${statusBadgeClass}">${student.visitStatus || 'ยังไม่ได้เยี่ยม'}</span></td>
      <td class="text-center">
        <div class="btn-group btn-group-sm">
          ${actionButtons}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // อัปเดตลิงก์แสดงหน้าในแถบแบ่งหน้าควบคุม
  renderPaginationControls(data.length);
}

function renderPaginationControls(totalItems) {
  const paginationUl = document.getElementById("tablePagination");
  const paginationInfo = document.getElementById("paginationInfo");
  paginationUl.innerHTML = "";

  const totalPages = Math.ceil(totalItems / rowsPerPage);

  if (totalItems === 0) {
    paginationInfo.innerText = "แสดงข้อมูล 0 ถึง 0 จากทั้งหมด 0 รายการ";
    return;
  }

  const startIndex = (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, totalItems);
  paginationInfo.innerText = `แสดงข้อมูล ${startIndex} ถึง ${endIndex} จากทั้งหมด ${totalItems} รายการ`;

  if (totalPages <= 1) return; // ไม่จำเป็นต้องแสดงปุ่มควบคุมหากมีหน้าเดียว

  // ปุ่มย้อนกลับ (Previous Page Button)
  const prevLi = document.createElement("li");
  prevLi.className = `page-item ${currentPage === 1 ? "disabled" : ""}`;
  prevLi.innerHTML = `<a class="page-link shadow-none" href="#" onclick="changePage(${currentPage - 1}); return false;"><i class="bi bi-chevron-left"></i></a>`;
  paginationUl.appendChild(prevLi);

  // ปุ่มตัวเลขนำหน้าหน้า (Numbered Page Buttons)
  for (let i = 1; i <= totalPages; i++) {
    const pageLi = document.createElement("li");
    pageLi.className = `page-item ${currentPage === i ? "active" : ""}`;
    pageLi.innerHTML = `<a class="page-link shadow-none" href="#" onclick="changePage(${i}); return false;">${i}</a>`;
    paginationUl.appendChild(pageLi);
  }

  // ปุ่มหน้าถัดไป (Next Page Button)
  const nextLi = document.createElement("li");
  nextLi.className = `page-item ${currentPage === totalPages ? "disabled" : ""}`;
  nextLi.innerHTML = `<a class="page-link shadow-none" href="#" onclick="changePage(${currentPage + 1}); return false;"><i class="bi bi-chevron-right"></i></a>`;
  paginationUl.appendChild(nextLi);
}

function changePage(page) {
  currentPage = page;
  renderStudentTable(filteredStudentsList);
}

/**
 * Cluster layout dynamic plot execution pipeline engine mapping active data markers array
 */
function plotAdminMapMarkers(data) {
  if (!adminMap) return;
  adminMarkersLayer.clearLayers();

  const boundCoordinates = [];

  data.forEach(student => {
    if (!student.latitude || !student.longitude) return;

    const lat = parseFloat(student.latitude);
    const lng = parseFloat(student.longitude);
    boundCoordinates.push([lat, lng]);

    const navUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const statusColor = student.visitStatus === "เยี่ยมเรียบร้อยแล้ว" ? "green" : "orange";

    // Generate simple dynamic SVG markers configurations targeting current student tracking profile status
    const customIcon = L.divIcon({
      html: `<i class="bi bi-geo-alt-fill fs-3 text-${statusColor === 'green' ? 'success' : 'warning'}"></i>`,
      className: 'custom-map-pin-style',
      iconAnchor: [12, 24]
    });

    const popupHtml = `
      <div class="p-1">
        <h6 class="fw-bold mb-1">${student.fullName} (ม.${student.class}/${student.room})</h6>
        <p class="small text-muted mb-2">${student.address}</p>
        <div class="d-grid">
          <a href="${navUrl}" target="_blank" class="btn btn-sm btn-primary text-white text-center fw-bold"><i class="bi bi-geo-alt"></i> เปิดนำทางใน Google Maps</a>
        </div>
      </div>
    `;

    const marker = L.marker([lat, lng], { icon: customIcon }).bindPopup(popupHtml);
    adminMarkersLayer.addLayer(marker);
  });

  // Smart Autofit view boundaries bounding maps canvas perspective layout window context dynamically
  if (boundCoordinates.length > 0 && adminMap) {
    adminMap.fitBounds(boundCoordinates, { padding: [40, 40], maxZoom: 15 });
  }
}

/**
 * Fast Administrative micro action API mutation query wrapper to shift tracking state values
 */
async function toggleVisitStatus(studentId, currentStatus) {
  const nextStatus = currentStatus === "เยี่ยมเรียบร้อยแล้ว" ? "ยังไม่ได้เยี่ยม" : "เยี่ยมเรียบร้อยแล้ว";

  if (!confirm(`ต้องการเปลี่ยนสถานะของนักเรียนรหัส ${studentId} เป็น [${nextStatus}] ใช่หรือไม่?`)) return;

  const adminUser = sessionStorage.getItem("adminUser");
  const adminPass = sessionStorage.getItem("adminPass");

  if (!adminUser || !adminPass) {
    showToast("คุณไม่มีสิทธิ์เข้าถึงแก้ไขข้อมูล กรุณาเข้าสู่ระบบคุณครูก่อน", "bg-danger");
    loadTeacherDashboard();
    return;
  }

  const payload = {
    action: "updateStatus",
    studentId: studentId,
    visitStatus: nextStatus,
    username: adminUser,
    password: adminPass
  };

  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.status === "success") {
      showToast(result.message, "bg-success");
      await loadTeacherDashboard(); // รีเฟรชฐานข้อมูลตัววัดและแผนที่แอดมินทันที
    } else {
      showToast("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: " + result.message, "bg-danger");
    }
  } catch (error) {
    console.error(error);
    showToast("เครือข่ายขัดข้อง ไม่สามารถบันทึกการเปลี่ยนสถานะได้", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}

/**
 * SheetJS Data Core Interface Execution Layer exporting Active Excel Datasets
 */
function exportToExcel() {
  if (allStudentsData.length === 0) {
    showToast("ไม่มีข้อมูลในตารางที่จะส่งออก", "bg-warning");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(allStudentsData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ข้อมูลการเยี่ยมบ้าน");

  // Save dynamic memory stream buffer initializing targeted platform native device system file downloads
  XLSX.writeFile(workbook, `รายงานการเยี่ยมบ้านนักเรียน_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * ===============================================
 * ADMINISTRATIVE AUTHENTICATION CONTROL ENGINE
 * ===============================================
 */

async function handleLogin(username, password) {
  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "login",
        username: username,
        password: password
      })
    });
    const result = await response.json();

    if (result.status === "success") {
      if (!result.admin) {
        showToast("ระบบหลังบ้าน (Google Apps Script) ยังไม่ถูกอัปเดต! กรุณาคัดลอกโค้ดจากไฟล์ code.gs ไปวางและทำตามคู่มือ Redeploy ใน Apps Script", "bg-warning");
        return;
      }
      sessionStorage.setItem("adminUser", username);
      sessionStorage.setItem("adminPass", password);
      sessionStorage.setItem("adminName", result.admin.fullName);

      showToast(result.message, "bg-success");

      // ล้างข้อมูลหน้าฟอร์มล็อกอิน
      document.getElementById("adminLoginForm").reset();
      document.getElementById("adminLoginForm").classList.remove('was-validated');

      // ดึงข้อมูลแดชบอร์ด
      await loadTeacherDashboard();
    } else {
      showToast(result.message, "bg-danger");
    }
  } catch (error) {
    console.error(error);
    showToast("ไม่สามารถเข้าถึงฐานข้อมูลเซิร์ฟเวอร์ระบบล็อกอินได้", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}

function handleLogout() {
  sessionStorage.removeItem("adminUser");
  sessionStorage.removeItem("adminPass");
  sessionStorage.removeItem("adminName");

  showToast("ออกจากระบบแอดมินคุณครูเรียบร้อยแล้ว", "bg-secondary");

  // โหลดและปรับสลับโครงสร้างหน้าจอกลับไปที่ Login View
  loadTeacherDashboard();
}

/**
 * ===============================================
 * CO-ADMIN/TEACHER ACCOUNT MANAGEMENT OPERATIONS
 * ===============================================
 */

async function loadAdminsList() {
  const adminUser = sessionStorage.getItem("adminUser");
  const adminPass = sessionStorage.getItem("adminPass");
  const tbody = document.getElementById("adminsTableBody");
  
  if (!adminUser || !adminPass) return;
  
  tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">กำลังโหลดบัญชี...</td></tr>`;
  
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "getAdmins",
        username: adminUser,
        password: adminPass
      })
    });
    const result = await response.json();
    
    if (result.status === "success") {
      tbody.innerHTML = "";
      result.data.forEach(adm => {
        const tr = document.createElement("tr");
        
        // ปุ่มลบแอดมิน (ป้องกันการลบบัญชีหลัก admin หรือลบตนเอง)
        const isSelf = String(adm.username).toLowerCase() === String(adminUser).toLowerCase();
        const isMainAdmin = String(adm.username).toLowerCase() === "admin";
        let deleteBtn = "";
        
        if (isSelf || isMainAdmin) {
          deleteBtn = `<button class="btn btn-xs btn-outline-secondary border-0" disabled title="${isSelf ? 'ไม่สามารถลบตัวเองได้' : 'ไม่สามารถลบแอดมินหลักได้'}"><i class="bi bi-trash-fill text-muted"></i></button>`;
        } else {
          deleteBtn = `<button class="btn btn-xs btn-outline-danger border-0" onclick="handleDeleteAdmin('${adm.username}', '${adm.fullName}')" title="ลบบัญชีคุณครูคนนี้"><i class="bi bi-trash-fill text-danger"></i></button>`;
        }
        
        tr.innerHTML = `
          <td><span class="badge bg-secondary font-monospace">${adm.username}</span></td>
          <td class="fw-bold">${adm.fullName}</td>
          <td><small class="text-muted">${adm.lastLogin || 'ไม่เคยเข้าใช้งาน'}</small></td>
          <td class="text-center">${deleteBtn}</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">ข้อผิดพลาด: ${result.message}</td></tr>`;
    }
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">ระบบเครือข่ายขัดข้อง</td></tr>`;
  }
}

async function handleAddAdmin() {
  const adminUser = sessionStorage.getItem("adminUser");
  const adminPass = sessionStorage.getItem("adminPass");
  const form = document.getElementById("addAdminForm");
  
  if (!adminUser || !adminPass) return;
  
  const payload = {
    action: "addAdmin",
    username: adminUser,
    password: adminPass,
    newUsername: document.getElementById("newUsername").value.trim(),
    newPassword: document.getElementById("newPassword").value.trim(),
    newFullName: document.getElementById("newFullName").value.trim()
  };
  
  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    
    if (result.status === "success") {
      showToast(result.message, "bg-success");
      form.reset();
      form.classList.remove('was-validated');
      await loadAdminsList(); // รีเฟรชตารางบัญชีครูทันที
    } else {
      showToast("ไม่สามารถสร้างบัญชีได้: " + result.message, "bg-danger");
    }
  } catch (error) {
    console.error(error);
    showToast("เครือข่ายขัดข้อง ไม่สามารถส่งข้อมูลได้", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}

/**
 * ===============================================
 * STUDENT RECORD EDITOR OPERATIONS (MODAL & POST)
 * ===============================================
 */

function openEditStudentModal(studentId) {
  // ค้นหารายละเอียดเดิมของนักเรียนในแอปพลิเคชันสเตต
  const student = allStudentsData.find(s => String(s.studentId) === String(studentId));
  
  if (!student) {
    showToast("ไม่พบประวัตินักเรียนรหัสนี้ในระบบสเตต", "bg-danger");
    return;
  }
  
  // ซ่อมแซมและแปลงเบอร์โทรศัพท์สำหรับแสดงในช่องแก้ไข
  const rawPhone = String(student.parentPhone || "").trim();
  const formattedPhone = (rawPhone.length > 0 && !rawPhone.startsWith("0")) ? "0" + rawPhone : rawPhone;
  
  // สลักข้อมูลเดิมทั้งหมดลงบนกล่อง Input ภายในฟอร์มแก้ไข
  document.getElementById("editStudentId").value = student.studentId;
  document.getElementById("editFullName").value = student.fullName;
  document.getElementById("editClass").value = student.class;
  document.getElementById("editRoom").value = student.room;
  document.getElementById("editNumber").value = student.number;
  document.getElementById("editParentPhone").value = formattedPhone;
  document.getElementById("editAddress").value = student.address;
  document.getElementById("editLatitude").value = student.latitude;
  document.getElementById("editLongitude").value = student.longitude;
  document.getElementById("editVisitStatus").value = student.visitStatus || "ยังไม่ได้เยี่ยม";
  
  // เรียกเปิดใช้งานหน้าต่าง Modal ด้วย API ของ Bootstrap 5
  const editModal = new bootstrap.Modal(document.getElementById('editStudentModal'));
  editModal.show();
}

async function saveStudentEdits() {
  const adminUser = sessionStorage.getItem("adminUser");
  const adminPass = sessionStorage.getItem("adminPass");
  const form = document.getElementById("editStudentForm");
  const studentId = document.getElementById("editStudentId").value;
  
  if (!adminUser || !adminPass) return;
  
  const payload = {
    action: "editStudent",
    username: adminUser,
    password: adminPass,
    studentId: studentId,
    updatedData: {
      fullName: document.getElementById("editFullName").value.trim(),
      class: document.getElementById("editClass").value.trim(),
      room: document.getElementById("editRoom").value.trim(),
      number: document.getElementById("editNumber").value.trim(),
      parentPhone: document.getElementById("editParentPhone").value.trim(),
      address: document.getElementById("editAddress").value.trim(),
      latitude: document.getElementById("editLatitude").value,
      longitude: document.getElementById("editLongitude").value,
      visitStatus: document.getElementById("editVisitStatus").value
    }
  };
  
  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    
    if (result.status === "success") {
      showToast(result.message, "bg-success");
      
      // สั่งปิดกล่อง Modal โดยเรียกใช้งาน Modal Instance ที่มีอยู่
      const editModalEl = document.getElementById('editStudentModal');
      const modalInstance = bootstrap.Modal.getInstance(editModalEl);
      if (modalInstance) modalInstance.hide();
      
      // ทำการโหลดแดชบอร์ดใหม่เพื่อซิงค์ข้อมูลลงตารางและหมุดแผนที่ให้ตรงกันทันที
      await loadTeacherDashboard();
    } else {
      showToast("แก้ไขล้มเหลว: " + result.message, "bg-danger");
    }
  } catch (error) {
    console.error(error);
    showToast("ระบบขัดข้องในการสื่อสารพอร์ตข้อมูล", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}

/**
 * ===============================================
 * SOFT-DELETE & RESTORE STUDENT ACTIONS (API CALL)
 * ===============================================
 */

async function deleteStudent(studentId, fullName) {
  if (!confirm(`⚠️ ยืนยันการลบข้อมูลของ "${fullName}" (รหัสนักเรียน ${studentId}) ชั่วคราว?\n\n*หมายเหตุ: ข้อมูลจริงในตารางชีตจะยังคงอยู่ และคุณครูสามารถดึงกลับคืนมาได้จากเมนู "แสดงถังขยะ (ลบแล้ว)"*`)) return;

  const adminUser = sessionStorage.getItem("adminUser");
  const adminPass = sessionStorage.getItem("adminPass");

  if (!adminUser || !adminPass) {
    showToast("คุณไม่มีสิทธิ์ลบข้อมูล กรุณาเข้าสู่ระบบคุณครูก่อน", "bg-danger");
    loadTeacherDashboard();
    return;
  }

  const payload = {
    action: "deleteStudent",
    studentId: studentId,
    username: adminUser,
    password: adminPass
  };

  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.status === "success") {
      showToast(result.message, "bg-success");
      await loadTeacherDashboard(); // รีเฟรชฐานข้อมูลตัววัดและตารางทันที
    } else {
      showToast("เกิดข้อผิดพลาดในการลบ: " + result.message, "bg-danger");
    }
  } catch (error) {
    console.error(error);
    showToast("เครือข่ายขัดข้อง ไม่สามารถดำเนินการลบได้", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}

async function restoreStudent(studentId, fullName) {
  if (!confirm(`🔄 ต้องการกู้คืนข้อมูลพิกัดของ "${fullName}" (รหัสนักเรียน ${studentId}) กลับมาเป็นข้อมูลปกติใช่หรือไม่?`)) return;

  const adminUser = sessionStorage.getItem("adminUser");
  const adminPass = sessionStorage.getItem("adminPass");

  if (!adminUser || !adminPass) {
    showToast("คุณไม่มีสิทธิ์ทำรายการ กรุณาเข้าสู่ระบบคุณครูก่อน", "bg-danger");
    loadTeacherDashboard();
    return;
  }

  const payload = {
    action: "restoreStudent",
    studentId: studentId,
    username: adminUser,
    password: adminPass
  };

  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.status === "success") {
      showToast(result.message, "bg-success");
      await loadTeacherDashboard(); // รีเฟรชแดชบอร์ดทันที
    } else {
      showToast("เกิดข้อผิดพลาดในการกู้คืน: " + result.message, "bg-danger");
    }
  } catch (error) {
    console.error(error);
    showToast("เครือข่ายขัดข้อง ไม่สามารถกู้คืนข้อมูลได้", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}

async function handleDeleteAdmin(targetUsername, fullName) {
  if (!confirm(`❌ ต้องการลบสิทธิ์บัญชีคุณครู "${fullName}" (${targetUsername}) ออกจากระบบจริงหรือไม่?\n\n*หมายเหตุ: บัญชีครูท่านนี้จะไม่สามารถใช้เข้าสู่ระบบบอร์ดครูได้อีกต่อไป*`)) return;

  const adminUser = sessionStorage.getItem("adminUser");
  const adminPass = sessionStorage.getItem("adminPass");

  if (!adminUser || !adminPass) return;

  const payload = {
    action: "deleteAdmin",
    targetUsername: targetUsername,
    username: adminUser,
    password: adminPass
  };

  toggleLoader(true);
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.status === "success") {
      showToast(result.message, "bg-success");
      await loadAdminsList(); // รีเฟรชรายชื่อคุณครูที่มีสิทธิ์ทันที
    } else {
      showToast("ไม่สามารถลบบัญชีครูได้: " + result.message, "bg-danger");
    }
  } catch (error) {
    console.error(error);
    showToast("เครือข่ายขัดข้อง ไม่สามารถลบบัญชีครูได้", "bg-danger");
  } finally {
    toggleLoader(false);
  }
}
