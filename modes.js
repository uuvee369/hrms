// =============================================
// Modes (modes.js)
// เพิ่มพนักงาน (SaveEmpl) & เพิ่มผู้ใช้ (SaveUser)
// =============================================

function matchAndPreviewEmpl() {
    matchedRows = parsedRows.map(row => {
        const isDuplicate = employeeList.some(e => e.Name.trim() === row._emplName.trim());
        return { 
            name: row._emplName, 
            isDuplicate: isDuplicate, 
            matched: true, 
            status: 'pending' 
        };
    });

    previewHead.innerHTML = `
        <th class="text-center" style="width:50px;">#</th>
        <th>ชื่อพนักงาน (จาก Excel)</th>
        <th>วิเคราะห์ข้อมูล</th>
        <th style="width:120px;">สถานะ</th>
    `;

    previewBody.innerHTML = '';
    
    let newCount = 0;
    let dupCount = 0;

    matchedRows.forEach((row, i) => {
        if (row.isDuplicate) dupCount++; else newCount++;
        
        const tr = document.createElement('tr');
        tr.id = `row-${i}`;
        
        let analysisBadge = row.isDuplicate 
            ? '<span class="badge bg-warning text-dark border border-warning"><i class="bi bi-exclamation-triangle me-1"></i> มีในระบบแล้ว</span>'
            : '<span class="badge bg-success border border-success"><i class="bi bi-stars me-1"></i> พนักงานใหม่</span>';

        tr.innerHTML = `
            <td class="text-center text-muted">${i + 1}</td>
            <td class="fw-medium">${esc(row.name)}</td>
            <td>${analysisBadge}</td>
            <td id="status-${i}"><span class="badge badge-pending-custom">⏳ รอส่ง</span></td>
        `;
        previewBody.appendChild(tr);
    });

    recordCount.innerHTML = `พบข้อมูลทั้งหมด ${matchedRows.length} รายการ <span class="ms-2 small text-secondary">(พนักงานใหม่ <b class="text-success">${newCount}</b>, ซ้ำ <b class="text-warning">${dupCount}</b>)</span>`;
    previewSection.style.display = '';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateSubmitButton();
}

function matchAndPreviewUser() {
    matchedRows = parsedRows.map(row => {
        const match = employeeList.find(e => e.Name.trim() === row.name.trim());
        return { name: row.name, username: row.username, emplCode: match ? match.Code : null, matched: !!match, status: 'pending' };
    });

    previewHead.innerHTML = `
        <th class="text-center" style="width:50px;">#</th>
        <th>ชื่อ (จาก Excel)</th>
        <th>Username</th>
        <th>รหัสพนักงาน</th>
        <th style="width:120px;">สถานะ</th>
    `;

    previewBody.innerHTML = '';
    const totalMatched = matchedRows.filter(r => r.matched).length;

    matchedRows.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.id = `row-${i}`;
        tr.innerHTML = `
            <td class="text-center text-muted">${i + 1}</td>
            <td>${esc(row.name)}</td>
            <td class="font-monospace">${esc(row.username)}</td>
            <td>${row.matched ? `<span class="empl-code">${row.emplCode}</span>` : '<span class="text-danger small">ไม่พบ</span>'}</td>
            <td id="status-${i}">${row.matched ? '<span class="badge badge-matched">✓ จับคู่แล้ว</span>' : '<span class="badge badge-unmatched">✗ ไม่ตรง</span>'}</td>
        `;
        previewBody.appendChild(tr);
    });

    recordCount.textContent = `${totalMatched}/${matchedRows.length} จับคู่สำเร็จ`;
    previewSection.style.display = '';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateSubmitButton();
}

async function batchSubmitEmpl() {
    const total = matchedRows.filter(r => !r.isDuplicate).length;
    let ok = 0, fail = 0;
    cancelled = false;
    showProgress(total);
    
    if (total === 0) {
        addLog('warning', `ไม่มีพนักงานใหม่ที่ต้องเพิ่ม (ซ้ำทั้งหมด)`);
        finishBatch(0, 0);
        return;
    }

    addLog('info', `เริ่มเพิ่มพนักงานใหม่ ${total} คน (ข้ามคนซ้ำ)...`);

    for (let i = 0; i < matchedRows.length; i++) {
        if (cancelled) { addLog('info', `ยกเลิกแล้ว (ส่งไป ${ok + fail}/${total})`); break; }
        const row = matchedRows[i];
        
        if (row.isDuplicate) {
            document.getElementById(`status-${i}`).innerHTML = '<span class="badge bg-secondary">ข้าม (ซ้ำ)</span>';
            continue;
        }

        setStatus(i, 'sending');
        try {
            const res = await apiFetch(API.saveEmpl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ txtName: row.name }).toString(),
            });
            const json = await res.json();
            if (json.ResponseStatus === '1') {
                ok++; setStatus(i, 'success'); addLog('success', `${row.name} — สำเร็จ`);
            } else {
                fail++; setStatus(i, 'fail'); addLog('fail', `${row.name} — ${json.ResponseMsg || 'ล้มเหลว'}`);
            }
        } catch (err) {
            fail++; setStatus(i, 'fail'); addLog('fail', `${row.name} — ${err.message}`);
        }
        updateProgress(ok, fail, total);
        if (i < matchedRows.length - 1) await sleep(1000); // หน่วงเวลา 1 วินาที เพื่อสงสารเซิร์ฟเวอร์
    }
    finishBatch(ok, fail);
}

async function batchSubmitUser() {
    const total = matchedRows.filter(r => r.matched).length;
    let ok = 0, fail = 0;
    cancelled = false;
    showProgress(total);
    addLog('info', `เริ่มเพิ่มผู้ใช้ ${total} คน...`);

    for (let i = 0; i < matchedRows.length; i++) {
        if (cancelled) { addLog('info', `ยกเลิกแล้ว (ส่งไป ${ok + fail}/${total})`); break; }
        const row = matchedRows[i];
        if (!row.matched) continue;
        setStatus(i, 'sending');
        try {
            const res = await apiFetch(API.saveUser, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    txtCode: '', ddlUserGrp: ddlUserGrp.value,
                    ddlEmpl: row.emplCode, txtUsername: row.username,
                    txtPassword: txtPassword.value.trim(),
                }).toString(),
            });
            const json = await res.json();
            if (json.ResponseStatus === '1') {
                ok++; setStatus(i, 'success'); addLog('success', `${row.name} (${row.username}) — สำเร็จ`);
            } else {
                fail++; setStatus(i, 'fail'); addLog('fail', `${row.name} (${row.username}) — ${json.ResponseMsg || 'ล้มเหลว'}`);
            }
        } catch (err) {
            fail++; setStatus(i, 'fail'); addLog('fail', `${row.name} (${row.username}) — ${err.message}`);
        }
        updateProgress(ok, fail, total);
        if (i < matchedRows.length - 1) await sleep(1000); // หน่วงเวลา 1 วินาที
    }
    finishBatch(ok, fail);
}
