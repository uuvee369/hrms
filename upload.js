// =============================================
// File Upload / Dropzone (upload.js)
// =============================================

function setupDropzone() {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
}

function setupRemoveFile() {
    removeFile.addEventListener('click', () => {
        fileInput.value = '';
        fileInfo.classList.add('d-none');
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

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('d-none');
    fileInfo.style.display = '';
    dropzone.style.display = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (jsonData.length === 0) { alert('ไฟล์ Excel ไม่มีข้อมูล'); return; }

            parsedRows = jsonData.map(row => {
                const n = {};
                Object.keys(row).forEach(k => { n[k.toLowerCase().trim()] = String(row[k]).trim(); });
                return n;
            });

            const firstRow = parsedRows[0];
            const cols = Object.keys(firstRow);

            if (currentMode === 'empl') {
                const nameCol = findColumn(cols, ['ชื่อพนักงาน', 'name', 'ชื่อ']);
                if (!nameCol) { alert(`ไม่พบคอลัมน์ "ชื่อพนักงาน"\nคอลัมน์ที่พบ: ${cols.join(', ')}`); return; }
                parsedRows = parsedRows.map(r => ({ ...r, _emplName: r[nameCol] || '' }));
            } else if (currentMode === 'user') {
                if (!('name' in firstRow) || !('username' in firstRow)) {
                    alert(`ไม่พบคอลัมน์ "name" หรือ "username"\nคอลัมน์ที่พบ: ${cols.join(', ')}`);
                    return;
                }
            }
            matchAndPreview();
        } catch (err) {
            alert('ไม่สามารถอ่านไฟล์ได้: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function findColumn(columns, possibleNames) {
    for (const col of columns) {
        for (const name of possibleNames) {
            if (col.toLowerCase().trim() === name.toLowerCase().trim()) return col;
        }
    }
    return null;
}
