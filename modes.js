function matchAndPreviewImport() {
    matchedRows = parsedRows.map(row => {
        const match = employeeList.find(e => e.Name.trim() === row._importName.trim());
        return {
            name: row._importName,
            username: row._importUsername,
            isDuplicate: !!match,
            oldCode: match ? match.Code : null,
            status: 'pending'
        };
    });

    previewHead.innerHTML = `
        <th class="text-center" style="width:50px;">#</th>
        <th>ชื่อพนักงาน (จาก Excel)</th>
        <th>Username (จาก Excel)</th>
        <th>วิเคราะห์ข้อมูล</th>
        <th style="width:120px;">สถานะ</th>
    `;

    previewBody.innerHTML = '';

    let newEmplCount = 0;
    let oldEmplCount = 0;
    let userCount = 0;

    matchedRows.forEach((row, i) => {
        if (row.isDuplicate) oldEmplCount++; else newEmplCount++;
        if (row.username) userCount++;

        const tr = document.createElement('tr');
        tr.id = `row-${i}`;

        let analysisBadge = '';
        if (row.isDuplicate && row.username) {
            analysisBadge = '<span class="badge bg-primary"><i class="bi bi-person-check me-1"></i> คนเก่า + สร้าง User</span>';
        } else if (row.isDuplicate && !row.username) {
            analysisBadge = '<span class="badge bg-secondary"><i class="bi bi-dash-circle me-1"></i> คนเก่า (ข้าม)</span>';
        } else if (!row.isDuplicate && row.username) {
            analysisBadge = '<span class="badge bg-success"><i class="bi bi-person-plus-fill me-1"></i> คนใหม่ + สร้าง User</span>';
        } else {
            analysisBadge = '<span class="badge bg-info text-dark"><i class="bi bi-person-plus me-1"></i> คนใหม่ (ไม่มี User)</span>';
        }

        tr.innerHTML = `
            <td class="text-center text-muted">${i + 1}</td>
            <td class="fw-medium">${esc(row.name)}</td>
            <td class="font-monospace text-muted">${row.username ? esc(row.username) : '-'}</td>
            <td>${analysisBadge}</td>
            <td id="status-${i}"><span class="badge badge-pending-custom">⏳ รอส่ง</span></td>
        `;
        previewBody.appendChild(tr);
    });

    recordCount.innerHTML = `พบข้อมูล ${matchedRows.length} รายการ <span class="ms-2 small text-secondary">(พนักงานใหม่ <b class="text-success">${newEmplCount}</b>, คนเก่า <b class="text-primary">${oldEmplCount}</b>, สร้าง User <b class="text-warning">${userCount}</b>)</span>`;
    previewSection.style.display = '';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateSubmitButton();
}

async function batchSubmitImport() {
    const totalEmplToCreate = matchedRows.filter(r => !r.isDuplicate).length;
    const totalUsersToCreate = matchedRows.filter(r => r.username).length;

    if (totalEmplToCreate === 0 && totalUsersToCreate === 0) {
        addLog('warning', `ไม่มีข้อมูลที่ต้องนำเข้า`);
        finishBatch(0, 0);
        return;
    }

    let ok = 0, fail = 0;
    cancelled = false;
    showProgress(matchedRows.length);

    if (totalEmplToCreate > 0) {
        addLog('info', `[Phase 1] สร้างพนักงานใหม่ ${totalEmplToCreate} คน...`);
        for (let i = 0; i < matchedRows.length; i++) {
            if (cancelled) break;
            const row = matchedRows[i];

            if (row.isDuplicate) continue;

            setStatus(i, 'sending');
            try {
                const res = await apiFetch(API.saveEmpl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ txtName: row.name }).toString(),
                });
                const json = await res.json();
                if (json.ResponseStatus === '1') {
                    if (!row.username) { ok++; setStatus(i, 'success'); }
                    else setStatus(i, 'sending');
                    addLog('success', `[พนักงาน] ${row.name} — สำเร็จ`);
                } else {
                    fail++; setStatus(i, 'fail'); addLog('fail', `[พนักงาน] ${row.name} — ${json.ResponseMsg || 'ล้มเหลว'}`);
                    row.failedPhase1 = true;
                }
            } catch (err) {
                fail++; setStatus(i, 'fail'); addLog('fail', `[พนักงาน] ${row.name} — ${err.message}`);
                row.failedPhase1 = true;
            }
            updateProgress(ok, fail, matchedRows.length);
            if (i < matchedRows.length - 1) await sleep(1000);
        }
    }

    if (!cancelled && totalEmplToCreate > 0 && totalUsersToCreate > 0) {
        addLog('info', `กำลังรีเฟรชฐานข้อมูลพนักงานเพื่อดึงรหัสพนักงานใหม่...`);
        await loadEmployeeList();
    }

    if (!cancelled && totalUsersToCreate > 0) {
        addLog('info', `[Phase 2] สร้างบัญชีผู้ใช้งาน ${totalUsersToCreate} บัญชี...`);
        for (let i = 0; i < matchedRows.length; i++) {
            if (cancelled) break;
            const row = matchedRows[i];

            if (!row.username || row.failedPhase1) continue;

            let emplCode = row.oldCode;
            if (!emplCode) {
                const match = employeeList.find(e => e.Name.trim() === row.name.trim());
                if (match) emplCode = match.Code;
            }

            if (!emplCode) {
                fail++; setStatus(i, 'fail'); addLog('fail', `[ผู้ใช้] ${row.username} — ไม่พบรหัสพนักงานในระบบ (สร้างผู้ใช้ไม่ได้)`);
                updateProgress(ok, fail, matchedRows.length);
                continue;
            }

            setStatus(i, 'sending');
            try {
                const res = await apiFetch(API.saveUser, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        txtCode: '', ddlUserGrp: ddlUserGrp.value,
                        ddlEmpl: emplCode, txtUsername: row.username,
                        txtPassword: txtPassword.value.trim(),
                    }).toString(),
                });
                const json = await res.json();
                if (json.ResponseStatus === '1') {
                    ok++; setStatus(i, 'success'); addLog('success', `[ผู้ใช้] ${row.username} — สำเร็จ`);
                } else {
                    fail++; setStatus(i, 'fail'); addLog('fail', `[ผู้ใช้] ${row.username} — ${json.ResponseMsg || 'ล้มเหลว'}`);
                }
            } catch (err) {
                fail++; setStatus(i, 'fail'); addLog('fail', `[ผู้ใช้] ${row.username} — ${err.message}`);
            }
            updateProgress(ok, fail, matchedRows.length);
            if (i < matchedRows.length - 1) await sleep(1000);
        }
    }

    if (!cancelled) {
        for (let i = 0; i < matchedRows.length; i++) {
            const row = matchedRows[i];
            if (row.isDuplicate && !row.username) {
                document.getElementById(`status-${i}`).innerHTML = '<span class="badge bg-secondary">ข้าม</span>';
                ok++;
            }
        }
        updateProgress(ok, fail, matchedRows.length);
    }

    finishBatch(ok, fail);
}
