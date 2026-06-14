// =============================================
// HRMS Batch Import - Core (app.js)
// State, DOM, Init, Tabs, Helpers, API, Progress
// =============================================

const API = {
    login: '/api/login',
    userGroups: '/api/GetJSonDataUserGrp',
    employees: '/api/GetJSonEmplList',
    saveUser: '/api/SaveUser',
    saveEmpl: '/api/SaveEmpl',
    deleteEmpl: '/api/DeleteEmpl',
    users: '/api/GetJSonDataUser',
};

// State
let currentMode = 'import';
let sessionId = '';
let cancelled = false;
let employeeList = [];
let parsedRows = [];
let matchedRows = [];
let userList = [];
let userGroupsList = [];

// DOM refs
const appContainer = document.getElementById('appContainer');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const settingsTitle = document.getElementById('settingsTitle');
const tabImport = document.getElementById('tabImport');
const tabDelete = document.getElementById('tabDelete');
const importSettingsCard = document.getElementById('importSettingsCard');
const uploadCard = document.getElementById('uploadCard');

const ddlUserGrp = document.getElementById('ddlUserGrp');
const txtPassword = document.getElementById('txtPassword');
const togglePassword = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
const dropzone = document.getElementById('dropzone');
const dropzoneHint = document.getElementById('dropzoneHint');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFile = document.getElementById('removeFile');
const previewSection = document.getElementById('previewSection');
const previewHead = document.getElementById('previewHead');
const previewBody = document.getElementById('previewBody');
const txtSearchTable = document.getElementById('txtSearchTable');
const recordCount = document.getElementById('recordCount');
const btnSubmit = document.getElementById('btnSubmit');
const btnSubmitText = document.getElementById('btnSubmitText');
const btnCancel = document.getElementById('btnCancel');
const btnShowUpload = document.getElementById('btnShowUpload');
const btnHideUpload = document.getElementById('btnHideUpload');
const uploadExplanation = document.getElementById('uploadExplanation');
const previewTitle = document.getElementById('previewTitle');
const progressSection = document.getElementById('progressSection');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');
const statSuccess = document.getElementById('statSuccess');
const statFail = document.getElementById('statFail');
const statTotal = document.getElementById('statTotal');
const logEntries = document.getElementById('logEntries');
const logWrapper = document.getElementById('logWrapper');

// =============================================
// Init
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupLogin();
    setupDropzone();
    setupPasswordToggle();
    setupSubmitButton();
    setupCancelButton();
    setupRemoveFile();
    switchMode('empl');
});

// =============================================
// Tabs
// =============================================
function setupTabs() {
    tabImport.addEventListener('click', () => switchMode('import'));
    tabDelete.addEventListener('click', () => switchMode('delete'));
}

function switchMode(mode) {
    currentMode = mode;
    tabImport.classList.toggle('active', mode === 'import');
    tabDelete.classList.toggle('active', mode === 'delete');

    importSettingsCard.style.display = mode === 'import' ? '' : 'none';
    uploadCard.style.display = mode === 'delete' ? 'none' : '';

    resetFileState();

    if (mode === 'import') {
        document.getElementById('btnSubmit').parentElement.style.display = 'none'; // ซ่อนจนกว่าจะมีการนำเข้า
        pageTitle.textContent = 'HRMS - นำเข้าข้อมูลครบวงจร';
        pageSubtitle.textContent = 'เพิ่มพนักงานและสร้างบัญชีผู้ใช้งานได้ในครั้งเดียวจากไฟล์ Excel';
        settingsTitle.textContent = 'ตั้งค่ารหัสผ่านสำหรับพนักงานใหม่ (เผื่อไว้ถ้าไฟล์มี Username)';
        document.getElementById('importSettingsCard').style.display = '';
        dropzoneHint.innerHTML = 'รองรับ .xlsx, .xls, .csv — คอลัมน์: <strong>name</strong> (บังคับ), <strong>username</strong> (ทางเลือก)';
        uploadExplanation.innerHTML = `กรุณาเตรียมไฟล์ Excel ให้มีคอลัมน์ "name" เป็นอย่างน้อย<br>
            <ul class="text-start mt-2 mb-0 small">
                <li><i class="bi bi-person-plus text-success"></i> <strong>พนักงานใหม่:</strong> สร้างรายชื่อให้ + สร้าง Username ให้อัตโนมัติ (ถ้าใส่มา)</li>
                <li><i class="bi bi-person-check text-primary"></i> <strong>พนักงานเก่า:</strong> ข้ามการสร้างชื่อซ้ำ + สร้าง Username ให้แทน (ถ้าใส่มา)</li>
                <li><i class="bi bi-info-circle text-warning"></i> ถ้าคอลัมน์ Username ว่างไว้ ระบบจะสร้างแค่ชื่อพนักงานให้เท่านั้น</li>
            </ul>`;
        btnSubmitText.textContent = 'เริ่มนำเข้าข้อมูลทั้งหมด';
        btnSubmit.className = 'btn btn-primary';
        previewTitle.textContent = 'รายชื่อพนักงานในระบบ';
        btnShowUpload.style.display = '';
        if (sessionId) {
            loadUserGroups();
            if (employeeList.length === 0) loadEmployeeList();
            else loadExistingEmployeesList();
        }
    } else if (mode === 'delete') {
        pageTitle.textContent = 'HRMS - ลบพนักงาน';
        pageSubtitle.textContent = 'เลือกพนักงานจากระบบเพื่อลบทีละคน';
        settingsTitle.textContent = 'ตั้งค่า';
        document.getElementById('btnSubmit').parentElement.style.display = 'none'; // ซ่อนปุ่ม submit ใหญ่
        previewTitle.textContent = 'รายชื่อพนักงานในระบบ';
        btnShowUpload.style.display = 'none';
        if (sessionId) {
            if (employeeList.length === 0) loadEmployeeList();
            else loadDeleteList();
        }
    }

    updateSubmitButton();
}

function resetFileState() {
    fileInput.value = '';
    fileInfo.classList.add('d-none');
    fileInfo.style.display = '';
    dropzone.style.display = '';
    previewSection.style.display = 'none';
    progressSection.style.display = 'none';
    if (txtSearchTable) txtSearchTable.value = ''; // Reset search
    parsedRows = [];
    matchedRows = [];
    btnSubmit.disabled = true;
}

// =============================================
// Password Toggle
// =============================================
function setupPasswordToggle() {
    togglePassword.addEventListener('click', () => {
        const isPassword = txtPassword.type === 'password';
        txtPassword.type = isPassword ? 'text' : 'password';
        eyeIcon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
    });

    // Search filter for table
    if (txtSearchTable) {
        txtSearchTable.addEventListener('input', (e) => {
            const filter = e.target.value.toLowerCase();
            const rows = previewBody.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(filter) ? '' : 'none';
            });
        });
    }

    if (btnShowUpload) {
        btnShowUpload.addEventListener('click', () => {
            uploadCard.style.display = '';
            uploadCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    if (btnHideUpload) {
        btnHideUpload.addEventListener('click', () => {
            uploadCard.style.display = 'none';
        });
    }
}

// โชว์ตารางรายชื่อพนักงานปกติ (ไม่ลบ ไม่นำเข้า)
function loadExistingEmployeesList() {
    if (parsedRows.length > 0) {
        // ถ้ามีการอัพโหลดไฟล์แล้ว ให้ข้ามไปโชว์พรีวิวแทน
        if (typeof matchAndPreview === 'function') matchAndPreview();
        return;
    }

    if (employeeList.length === 0) {
        previewSection.style.display = 'none';
        return;
    }

    previewHead.innerHTML = `
        <th class="text-center" style="width:50px;">#</th>
        <th>รหัสพนักงาน</th>
        <th>ชื่อพนักงาน</th>
        <th>Username</th>
        <th>กลุ่มผู้ใช้งาน</th>
    `;

    previewBody.innerHTML = '';
    employeeList.forEach((emp, i) => {
        // หาข้อมูล user ที่ตรงกับชื่อพนักงาน
        const user = userList.find(u => u.Name.trim() === emp.Name.trim());
        
        let displayGrpName = '-';
        if (user) {
            // Force re-mapping from userGroupsList because sometimes the API returns UserGrpName missing or incorrect
            if (user.UserGrp && userGroupsList.length > 0) {
                const grpCodes = user.UserGrp.split(',');
                const grpNames = grpCodes.map(code => {
                    const match = userGroupsList.find(g => g.Code === code.trim());
                    return match ? match.Name : code;
                });
                displayGrpName = grpNames.join(', ');
            } else if (user.UserGrpName) {
                displayGrpName = user.UserGrpName;
            } else {
                displayGrpName = user.UserGrp || '-';
            }
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center text-muted">${i + 1}</td>
            <td class="font-monospace empl-code">${emp.Code}</td>
            <td>${esc(emp.Name)}</td>
            <td class="font-monospace text-muted">${user && user.Username ? esc(user.Username) : '-'}</td>
            <td>${displayGrpName !== '-' ? `<span class="badge bg-secondary">${esc(displayGrpName)}</span>` : '-'}</td>
        `;
        previewBody.appendChild(tr);
    });
    
    recordCount.textContent = `พนักงานในระบบ ${employeeList.length} คน`;
    previewSection.style.display = '';
}

// =============================================
// Submit
// =============================================
function setupSubmitButton() {
    btnSubmit.addEventListener('click', (e) => {
        e.preventDefault();

        let confirmText = '';
        let confirmAction = null;

        if (currentMode === 'import') {
            const willCreateUsers = matchedRows.some(r => r.username);
            if (willCreateUsers) {
                if (!ddlUserGrp.value) { alert('มีรายชื่อที่ระบุ Username กรุณาเลือกกลุ่มผู้ใช้'); return; }
                if (!txtPassword.value.trim()) { alert('มีรายชื่อที่ระบุ Username กรุณากำหนดรหัสผ่านส่วนกลาง'); return; }
            }
            confirmText = `ยืนยันนำเข้าข้อมูลพนักงาน ${matchedRows.length} คน?`;
            confirmAction = batchSubmitImport;
        }

        if (confirmText && confirmAction) {
            document.getElementById('submitModalText').textContent = confirmText;
            const modalEl = document.getElementById('submitConfirmModal');
            const modal = new bootstrap.Modal(modalEl);
            
            const btnConfirm = document.getElementById('btnConfirmSubmit');
            const newBtnConfirm = btnConfirm.cloneNode(true);
            btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
            
            newBtnConfirm.addEventListener('click', () => {
                newBtnConfirm.blur();
                modal.hide();
                confirmAction();
            });
            
            modal.show();
        }
    });
}

function updateSubmitButton() {
    const loggedIn = !!sessionId;
    if (currentMode === 'empl') {
        btnSubmit.disabled = !(loggedIn && matchedRows.length > 0);
    } else if (currentMode === 'user') {
        btnSubmit.disabled = !(loggedIn && matchedRows.some(r => r.matched) && txtPassword.value.trim() && ddlUserGrp.value);
    }
}

txtPassword.addEventListener('input', updateSubmitButton);
ddlUserGrp.addEventListener('change', updateSubmitButton);

// =============================================
// Cancel
// =============================================
function setupCancelButton() {
    btnCancel.addEventListener('click', () => {
        cancelled = true;
        btnCancel.disabled = true;
        btnCancel.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> กำลังหยุด...';
    });
}

// =============================================
// API
// =============================================
async function apiFetch(url, options = {}) {
    const headers = { 'X-Session-Id': sessionId, ...(options.headers || {}) };
    return fetch(url, { ...options, headers });
}

async function loadUserGroups() {
    ddlUserGrp.innerHTML = '<option value="">-- กำลังโหลด... --</option>';
    try {
        const res = await apiFetch(API.userGroups);
        const json = await res.json();
        if (json.ResponseStatus === '1' && json.ResponseData) {
            userGroupsList = JSON.parse(json.ResponseData);
            ddlUserGrp.innerHTML = '<option value="">-- เลือกกลุ่มผู้ใช้ --</option>';
            userGroupsList.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.Code;
                opt.textContent = g.Name;
                ddlUserGrp.appendChild(opt);
            });
        } else {
            ddlUserGrp.innerHTML = '<option value="">-- Session หมดอายุ --</option>';
        }
    } catch (err) {
        ddlUserGrp.innerHTML = '<option value="">-- โหลดล้มเหลว --</option>';
    }
}

async function loadEmployeeList() {
    try {
        const [resEmpl, resUser, resGroup] = await Promise.all([
            apiFetch(API.employees),
            apiFetch(API.users).catch(() => null), // Optional
            apiFetch(API.userGroups).catch(() => null) // Optional
        ]);
        
        const jsonEmpl = await resEmpl.json();
        if (jsonEmpl.ResponseStatus === '1' && jsonEmpl.ResponseData) {
            employeeList = JSON.parse(jsonEmpl.ResponseData);
        }
        
        if (resUser) {
            const jsonUser = await resUser.json();
            if (jsonUser.ResponseStatus === '1' && jsonUser.ResponseData) {
                userList = JSON.parse(jsonUser.ResponseData);
            }
        }
        
        if (resGroup) {
            const jsonGroup = await resGroup.json();
            if (jsonGroup.ResponseStatus === '1' && jsonGroup.ResponseData) {
                userGroupsList = JSON.parse(jsonGroup.ResponseData);
                // Update dropdown if needed (if user hasn't called loadUserGroups separately)
                if (ddlUserGrp && ddlUserGrp.options.length <= 1) {
                    ddlUserGrp.innerHTML = '<option value="">-- เลือกกลุ่มผู้ใช้ --</option>';
                    userGroupsList.forEach(g => {
                        const opt = document.createElement('option');
                        opt.value = g.Code;
                        opt.textContent = g.Name;
                        ddlUserGrp.appendChild(opt);
                    });
                }
            }
        }

        if (employeeList.length > 0) {
            if (currentMode === 'delete') {
                if (typeof loadDeleteList === 'function') loadDeleteList();
            } else {
                loadExistingEmployeesList();
            }
        }
    } catch (err) {
        console.error('Load employee/user list failed:', err);
    }
}

// =============================================
// Preview dispatcher
// =============================================
function matchAndPreview() {
    if (currentMode === 'import') matchAndPreviewImport();
}

// =============================================
// Progress helpers
// =============================================
function setStatus(i, status) {
    const el = document.getElementById(`status-${i}`);
    if (!el) return;
    const map = {
        sending: '<span class="badge badge-sending">⟳ กำลังส่ง...</span>',
        success: '<span class="badge badge-success-custom">✓ สำเร็จ</span>',
        fail: '<span class="badge badge-fail-custom">✗ ล้มเหลว</span>',
    };
    el.innerHTML = map[status] || '';
}

function showProgress(total) {
    progressSection.style.display = '';
    progressSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    btnSubmit.disabled = true;
    btnCancel.style.display = '';
    btnCancel.disabled = false;
    btnCancel.innerHTML = '<i class="bi bi-x-circle me-1"></i> ยกเลิก';
    statTotal.textContent = total;
    statSuccess.textContent = '0';
    statFail.textContent = '0';
    progressBarFill.style.width = '0%';
    progressText.textContent = '0%';
    logEntries.innerHTML = '';
}

function updateProgress(ok, fail, total) {
    const pct = Math.round(((ok + fail) / total) * 100);
    progressBarFill.style.width = pct + '%';
    progressText.textContent = pct + '%';
    statSuccess.textContent = ok;
    statFail.textContent = fail;
}

function finishBatch(ok, fail) {
    if (!cancelled) addLog('info', `เสร็จสิ้น! สำเร็จ ${ok} / ล้มเหลว ${fail}`);
    btnSubmitText.textContent = cancelled ? 'ยกเลิกแล้ว' : 'เสร็จสิ้น';
    btnCancel.style.display = 'none';
    progressBarFill.classList.remove('progress-bar-animated');
}

// =============================================
// Helpers
// =============================================
function formatFileSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
}

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addLog(type, msg) {
    const d = document.createElement('div');
    d.className = `log-entry log-${type}`;
    d.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : type === 'fail' ? 'x-circle' : 'info-circle'} me-1"></i>${esc(msg)}`;
    logEntries.appendChild(d);
    logWrapper.scrollTop = logWrapper.scrollHeight;
}
