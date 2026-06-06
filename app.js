// =============================================
// HRMS Batch User Import - Application Logic
// =============================================

// API ยิงผ่าน Python proxy server (localhost:5000)
const API = {
    userGroups: '/api/GetJSonDataUserGrp',
    employees: '/api/GetJSonEmplList',
    saveUser: '/api/SaveUser',
};

// State
let employeeList = [];
let parsedRows = [];
let matchedRows = [];

// DOM Elements
const txtSessionId = document.getElementById('txtSessionId');
const ddlUserGrp = document.getElementById('ddlUserGrp');
const txtPassword = document.getElementById('txtPassword');
const togglePassword = document.getElementById('togglePassword');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFile = document.getElementById('removeFile');
const previewSection = document.getElementById('previewSection');
const previewBody = document.getElementById('previewBody');
const recordCount = document.getElementById('recordCount');
const btnSubmit = document.getElementById('btnSubmit');
const progressSection = document.getElementById('progressSection');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');
const statSuccess = document.getElementById('statSuccess');
const statFail = document.getElementById('statFail');
const statTotal = document.getElementById('statTotal');
const logEntries = document.getElementById('logEntries');
const logWrapper = document.getElementById('logWrapper');

// =============================================
// Initialize
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    setupSessionIdListener();
    setupDropzone();
    setupPasswordToggle();
    setupSubmitButton();
    setupRemoveFile();
});

// =============================================
// Session ID — เมื่อกรอกแล้วจะโหลดข้อมูลอัตโนมัติ
// =============================================
let sessionLoadTimeout = null;

function setupSessionIdListener() {
    txtSessionId.addEventListener('input', () => {
        clearTimeout(sessionLoadTimeout);
        sessionLoadTimeout = setTimeout(() => {
            const sid = txtSessionId.value.trim();
            if (sid.length > 10) {
                loadUserGroups();
                loadEmployeeList();
            }
        }, 500); // debounce 500ms
    });
}

function getSessionId() {
    return txtSessionId.value.trim();
}

// =============================================
// API Calls (ผ่าน proxy)
// =============================================
async function apiFetch(url, options = {}) {
    const sid = getSessionId();
    const headers = {
        'X-Session-Id': sid,
        ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
}

async function loadUserGroups() {
    ddlUserGrp.innerHTML = '<option value="">-- กำลังโหลด... --</option>';
    try {
        const res = await apiFetch(API.userGroups);
        const json = await res.json();
        if (json.ResponseStatus === '1' && json.ResponseData) {
            const groups = JSON.parse(json.ResponseData);
            ddlUserGrp.innerHTML = '<option value="">-- เลือกกลุ่มผู้ใช้ --</option>';
            groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.Code;
                opt.textContent = g.Name;
                ddlUserGrp.appendChild(opt);
            });
        } else {
            ddlUserGrp.innerHTML = '<option value="">-- Session หมดอายุ ลองใหม่ --</option>';
        }
    } catch (err) {
        console.error('โหลดกลุ่มผู้ใช้ล้มเหลว:', err);
        ddlUserGrp.innerHTML = '<option value="">-- โหลดล้มเหลว (เช็ค server) --</option>';
    }
}

async function loadEmployeeList() {
    try {
        const res = await apiFetch(API.employees);
        const json = await res.json();
        if (json.ResponseStatus === '1' && json.ResponseData) {
            employeeList = JSON.parse(json.ResponseData);
            console.log(`✅ โหลดรายชื่อพนักงาน ${employeeList.length} คน`);
            // Re-match if data is already loaded
            if (parsedRows.length > 0) {
                matchAndPreview();
            }
        }
    } catch (err) {
        console.error('โหลดรายชื่อพนักงานล้มเหลว:', err);
    }
}

// =============================================
// Password Toggle
// =============================================
function setupPasswordToggle() {
    togglePassword.addEventListener('click', () => {
        const type = txtPassword.type === 'password' ? 'text' : 'password';
        txtPassword.type = type;
        const eyeIcon = document.getElementById('eyeIcon');
        if (type === 'text') {
            eyeIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            `;
        } else {
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            `;
        }
    });
}

// =============================================
// Dropzone & File Upload
// =============================================
function setupDropzone() {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
}

function setupRemoveFile() {
    removeFile.addEventListener('click', () => {
        fileInput.value = '';
        fileInfo.style.display = 'none';
        dropzone.style.display = '';
        previewSection.style.display = 'none';
        parsedRows = [];
        matchedRows = [];
        btnSubmit.disabled = true;
    });
}

function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
        alert('กรุณาเลือกไฟล์ Excel (.xlsx, .xls) หรือ CSV เท่านั้น');
        return;
    }

    // Show file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'flex';
    dropzone.style.display = 'none';

    // Read file
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (jsonData.length === 0) {
                alert('ไฟล์ Excel ไม่มีข้อมูล');
                return;
            }

            // Normalize column names (case-insensitive)
            parsedRows = jsonData.map(row => {
                const normalized = {};
                Object.keys(row).forEach(key => {
                    normalized[key.toLowerCase().trim()] = String(row[key]).trim();
                });
                return normalized;
            });

            // Check required columns
            const firstRow = parsedRows[0];
            if (!('name' in firstRow) || !('username' in firstRow)) {
                const cols = Object.keys(firstRow).join(', ');
                alert(`ไม่พบคอลัมน์ "name" หรือ "username"\nคอลัมน์ที่พบ: ${cols}`);
                return;
            }

            matchAndPreview();
        } catch (err) {
            console.error('Error parsing file:', err);
            alert('ไม่สามารถอ่านไฟล์ได้: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// =============================================
// Matching & Preview
// =============================================
function matchAndPreview() {
    matchedRows = parsedRows.map(row => {
        const name = row.name;
        const username = row.username;
        // Try to find matching employee (exact match after trim)
        const match = employeeList.find(emp =>
            emp.Name.trim() === name.trim()
        );
        return {
            name,
            username,
            emplCode: match ? match.Code : null,
            matched: !!match,
            status: 'pending',
        };
    });

    renderPreview();
}

function renderPreview() {
    previewBody.innerHTML = '';
    const totalMatched = matchedRows.filter(r => r.matched).length;

    matchedRows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.id = `row-${idx}`;
        tr.innerHTML = `
            <td class="col-num">${idx + 1}</td>
            <td class="col-name">${escapeHtml(row.name)}</td>
            <td class="col-username" style="font-family: Consolas, Monaco, monospace;">${escapeHtml(row.username)}</td>
            <td class="col-match">
                ${row.matched
                    ? `<span class="empl-code">${row.emplCode}</span>`
                    : `<span style="color: var(--accent-danger); font-size: 0.82rem;">ไม่พบ</span>`
                }
            </td>
            <td class="col-status" id="status-${idx}">
                ${row.matched
                    ? '<span class="badge badge-matched">✓ จับคู่แล้ว</span>'
                    : '<span class="badge badge-unmatched">✗ ไม่ตรง</span>'
                }
            </td>
        `;
        previewBody.appendChild(tr);
    });

    recordCount.textContent = `${totalMatched}/${matchedRows.length} จับคู่สำเร็จ`;
    previewSection.style.display = '';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    updateSubmitButton();
}

// =============================================
// Submit
// =============================================
function setupSubmitButton() {
    btnSubmit.addEventListener('click', () => {
        if (!validateBeforeSubmit()) return;
        const count = matchedRows.filter(r => r.matched).length;
        if (!confirm(`ยืนยันเพิ่มผู้ใช้ ${count} คน?`)) return;
        startBatchSubmit();
    });
}

function updateSubmitButton() {
    const hasMatched = matchedRows.some(r => r.matched);
    const hasPassword = txtPassword.value.trim().length > 0;
    const hasGroup = ddlUserGrp.value !== '';
    const hasSession = getSessionId().length > 10;
    btnSubmit.disabled = !(hasMatched && hasPassword && hasGroup && hasSession);
}

// Listen to changes for enabling submit
txtPassword.addEventListener('input', updateSubmitButton);
ddlUserGrp.addEventListener('change', updateSubmitButton);
txtSessionId.addEventListener('input', updateSubmitButton);

function validateBeforeSubmit() {
    if (!getSessionId()) {
        alert('กรุณากรอก Session ID');
        txtSessionId.focus();
        return false;
    }
    if (!ddlUserGrp.value) {
        alert('กรุณาเลือกกลุ่มผู้ใช้');
        ddlUserGrp.focus();
        return false;
    }
    if (!txtPassword.value.trim()) {
        alert('กรุณากำหนดรหัสผ่าน');
        txtPassword.focus();
        return false;
    }
    return true;
}

async function startBatchSubmit() {
    const rowsToSubmit = matchedRows.filter(r => r.matched);
    const total = rowsToSubmit.length;
    let successCount = 0;
    let failCount = 0;

    // Show progress
    progressSection.style.display = '';
    progressSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        กำลังดำเนินการ...
    `;

    statTotal.textContent = total;
    statSuccess.textContent = '0';
    statFail.textContent = '0';
    logEntries.innerHTML = '';

    addLog('info', `เริ่มเพิ่มผู้ใช้ ${total} คน...`);

    for (let i = 0; i < matchedRows.length; i++) {
        const row = matchedRows[i];
        if (!row.matched) continue;

        const statusEl = document.getElementById(`status-${i}`);
        statusEl.innerHTML = '<span class="badge badge-sending">⟳ กำลังส่ง...</span>';

        try {
            const payload = new URLSearchParams({
                txtCode: '',
                ddlUserGrp: ddlUserGrp.value,
                ddlEmpl: row.emplCode,
                txtUsername: row.username,
                txtPassword: txtPassword.value.trim(),
            });

            const res = await apiFetch(API.saveUser, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: payload.toString(),
            });

            const json = await res.json();

            if (json.ResponseStatus === '1') {
                successCount++;
                row.status = 'success';
                statusEl.innerHTML = '<span class="badge badge-success">✓ สำเร็จ</span>';
                addLog('success', `${row.name} (${row.username}) — เพิ่มสำเร็จ`);
            } else {
                failCount++;
                row.status = 'fail';
                const msg = json.ResponseMsg || 'ไม่ทราบสาเหตุ';
                statusEl.innerHTML = `<span class="badge badge-fail" title="${escapeHtml(msg)}">✗ ล้มเหลว</span>`;
                addLog('fail', `${row.name} (${row.username}) — ${msg}`);
            }
        } catch (err) {
            failCount++;
            row.status = 'fail';
            statusEl.innerHTML = '<span class="badge badge-fail">✗ Error</span>';
            addLog('fail', `${row.name} (${row.username}) — ${err.message}`);
        }

        // Update progress
        const done = successCount + failCount;
        const pct = Math.round((done / total) * 100);
        progressBarFill.style.width = pct + '%';
        progressText.textContent = pct + '%';
        statSuccess.textContent = successCount;
        statFail.textContent = failCount;

        // Small delay to avoid hammering the server
        if (i < matchedRows.length - 1) {
            await sleep(300);
        }
    }

    addLog('info', `🎉 เสร็จสิ้น! สำเร็จ ${successCount} / ล้มเหลว ${failCount}`);
    btnSubmit.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        เสร็จสิ้น
    `;
}

// =============================================
// Helpers
// =============================================
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function addLog(type, message) {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-dot"></span><span>${escapeHtml(message)}</span>`;
    logEntries.appendChild(entry);
    logWrapper.scrollTop = logWrapper.scrollHeight;
}
