// =============================================
// Login / Logout (login.js)
// =============================================

const loginScreen = document.getElementById('loginScreen');
const mainAppScreen = document.getElementById('mainAppScreen');
const loggedInSection = document.getElementById('loggedInSection');
const loggedInUser = document.getElementById('loggedInUser');
const txtUserId = document.getElementById('txtUserId');
const txtLoginPassword = document.getElementById('txtLoginPassword');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const loginStatus = document.getElementById('loginStatus');
const toggleLoginPw = document.getElementById('toggleLoginPw');
const loginEyeIcon = document.getElementById('loginEyeIcon');

function setupLogin() {
    btnLogin.addEventListener('click', doLogin);
    btnLogout.addEventListener('click', doLogout);
    txtLoginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
    txtUserId.addEventListener('keydown', (e) => { if (e.key === 'Enter') txtLoginPassword.focus(); });
    toggleLoginPw.addEventListener('click', () => {
        const isPw = txtLoginPassword.type === 'password';
        txtLoginPassword.type = isPw ? 'text' : 'password';
        loginEyeIcon.className = isPw ? 'bi bi-eye-slash' : 'bi bi-eye';
    });

    // Restore session on reload
    const savedSession = sessionStorage.getItem('hrms_session');
    if (savedSession) {
        sessionId = savedSession;
        const savedUserid = sessionStorage.getItem('hrms_userid');
        const savedTitle = sessionStorage.getItem('hrms_title');
        onLoginSuccess(savedUserid, savedTitle);
    }
}

async function doLogin() {
    const userid = txtUserId.value.trim();
    const password = txtLoginPassword.value;
    if (!userid || !password) {
        showLoginStatus('danger', '<i class="bi bi-exclamation-circle me-1"></i> กรุณากรอก Username และ Password');
        return;
    }

    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> กำลังเข้าสู่ระบบ...';
    showLoginStatus('info', '<span class="spinner-border spinner-border-sm me-1"></span> กำลังเชื่อมต่อ HRMS...');

    try {
        const res = await fetch(API.login, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ userid, password }).toString(),
        });
        const json = await res.json();

        if (json.ResponseStatus === '1' && json.session_id) {
            sessionId = json.session_id;
            onLoginSuccess(userid, json.ResponseTitle);
        } else {
            showLoginStatus('danger', `<i class="bi bi-x-circle me-1"></i> ${json.ResponseMsg || json.ResponseTitle || 'เข้าสู่ระบบล้มเหลว'}`);
        }
    } catch (err) {
        showLoginStatus('danger', `<i class="bi bi-x-circle me-1"></i> เชื่อมต่อไม่ได้: ${err.message}`);
    }

    btnLogin.disabled = false;
    btnLogin.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> เข้าสู่ระบบ';
}

function onLoginSuccess(userid, title) {
    loginScreen.classList.remove('d-flex');
    loginScreen.style.display = 'none';
    mainAppScreen.style.display = '';
    loggedInSection.style.display = '';
    loggedInSection.style.cssText = '';
    loggedInUser.textContent = `${userid} — ${title || ''}`;
    loginStatus.style.display = 'none';

    if (currentMode === 'user') loadUserGroups();
    loadEmployeeList(); // Load for all modes so we can do duplicate detection

    // Save to sessionStorage
    sessionStorage.setItem('hrms_session', sessionId);
    sessionStorage.setItem('hrms_userid', userid);
    sessionStorage.setItem('hrms_title', title || '');

    updateSubmitButton();
}

function doLogout() {
    sessionId = '';
    loginScreen.classList.add('d-flex');
    loginScreen.style.display = '';
    mainAppScreen.style.display = 'none';
    loggedInSection.style.display = 'none';
    loggedInSection.style.cssText = 'display:none!important';
    txtUserId.value = '';
    txtLoginPassword.value = '';
    loginStatus.style.display = 'none';
    ddlUserGrp.innerHTML = '<option value="">-- เข้าสู่ระบบก่อน --</option>';
    employeeList = [];
    resetFileState();
    
    // Clear sessionStorage
    sessionStorage.removeItem('hrms_session');
    sessionStorage.removeItem('hrms_userid');
    sessionStorage.removeItem('hrms_title');

    updateSubmitButton();
}

function showLoginStatus(type, html) {
    loginStatus.style.display = '';
    loginStatus.className = `mt-2 alert alert-${type} py-2 small mb-0`;
    loginStatus.innerHTML = html;
}
