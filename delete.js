function loadDeleteList() {
    if (employeeList.length === 0) {
        previewSection.style.display = 'none';
        return;
    }

    previewHead.innerHTML = `
        <th class="text-center" style="width:50px;">#</th>
        <th>รหัสพนักงาน</th>
        <th>ชื่อพนักงาน</th>
        <th>Username</th>
        <th>กลุ่มผู้ใช้</th>
        <th style="width:120px;" class="text-center">จัดการ</th>
    `;

    previewBody.innerHTML = '';
    employeeList.forEach((emp, i) => {
        const user = userList.find(u => u.Name.trim() === emp.Name.trim());

        let displayGrpName = '-';
        if (user) {
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
        tr.id = `row-${i}`;
        tr.innerHTML = `
            <td class="text-center text-muted">${i + 1}</td>
            <td class="font-monospace empl-code">${emp.Code}</td>
            <td>${esc(emp.Name)}</td>
            <td class="font-monospace text-muted">${user && user.Username ? esc(user.Username) : '-'}</td>
            <td>${displayGrpName !== '-' ? `<span class="badge bg-secondary">${esc(displayGrpName)}</span>` : '-'}</td>
            <td id="status-${i}" class="text-center">
                <button class="btn btn-sm btn-outline-danger btn-delete-single"
                    data-index="${i}" data-code="${emp.Code}" data-name="${esc(emp.Name)}">
                    <i class="bi bi-trash"></i> ลบ
                </button>
            </td>
        `;
        previewBody.appendChild(tr);
    });

    recordCount.textContent = `พบ ${employeeList.length} คนในระบบ`;
    previewSection.style.display = '';

    document.querySelectorAll('.btn-delete-single').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const index = btn.getAttribute('data-index');
            const code = btn.getAttribute('data-code');
            const name = btn.getAttribute('data-name');

            document.getElementById('deleteModalName').textContent = name;
            document.getElementById('deleteModalCode').textContent = `รหัส: ${code}`;

            const modalEl = document.getElementById('deleteConfirmModal');
            const modal = new bootstrap.Modal(modalEl);

            const btnConfirm = document.getElementById('btnConfirmDelete');
            const newBtnConfirm = btnConfirm.cloneNode(true);
            btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);

            newBtnConfirm.addEventListener('click', async () => {
                newBtnConfirm.blur();
                modal.hide();

                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

                try {
                    const res = await apiFetch(API.deleteEmpl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ code: code }).toString(),
                    });
                    const json = await res.json();

                    if (json.ResponseStatus === '1') {
                        addLog('success', `${name} (${code}) — ลบสำเร็จ`);
                        document.getElementById(`status-${index}`).innerHTML = '<span class="badge badge-success-custom">✓ ลบแล้ว</span>';
                        employeeList = employeeList.filter(e => e.Code !== code);
                        recordCount.textContent = `พบ ${employeeList.length} คนในระบบ`;
                    } else {
                        addLog('fail', `${name} (${code}) — ${json.ResponseMsg || 'ลบล้มเหลว'}`);
                        btn.disabled = false;
                        btn.innerHTML = '<i class="bi bi-trash"></i> ลบ';
                    }
                } catch (err) {
                    addLog('fail', `${name} (${code}) — ${err.message}`);
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-trash"></i> ลบ';
                }
            });

            modal.show();
        });
    });
}
