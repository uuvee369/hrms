# HRMS Batch Import Tool — Agent Context

> This file describes the entire project so that any AI assistant can understand and maintain it.
> All inline code comments have been removed from source files — use this document as the single source of truth.

## Overview

A browser-based tool that connects to an existing HRMS (Healthcare Risk Management System) at `https://hrms128.thai-nrls.org/HRMS11388/` via a local Python proxy server. The tool allows HR staff to:

1. **Import employees + create user accounts** from a single Excel file (unified 2-phase pipeline)
2. **Delete employees** individually from a searchable list

The frontend is a single-page HTML app using Bootstrap 5 (dark theme). The backend is a Python proxy that relays API calls to the HRMS server with proper session cookies.

---

## Project Structure

```
d:\hrms\
├── server.py      # Python proxy server (localhost:5000)
├── index.html     # Main HTML page (Bootstrap 5 dark)
├── style.css      # Custom CSS (extends Bootstrap)
├── app.js         # Core: state, DOM refs, init, tabs, API, progress, helpers
├── login.js       # Login/logout flow, session management
├── upload.js      # File drag-drop, Excel parsing (SheetJS)
├── modes.js       # Unified import mode: preview + 2-phase batch submit
├── delete.js      # Delete mode: list employees, single-delete with modal confirm
└── AGENTS.md      # This file
```

### Script Load Order (in index.html)

```
app.js → login.js → upload.js → modes.js → delete.js
```

Each file depends on globals defined in earlier scripts. `app.js` defines all shared state and DOM refs.

---

## Architecture

### Python Proxy Server (`server.py`)

The HRMS API requires ASP.NET session cookies and specific headers. Browsers can't set these directly (CORS), so a Python proxy runs on `localhost:5000`:

- **Static files**: Serves `index.html`, `*.js`, `*.css` from the same directory
- **Login** (`POST /api/login`): Creates a new ASP.NET session by visiting the HRMS login page, extracts the `ASP.NET_SessionId` cookie, authenticates with credentials, and returns the session ID to the frontend
- **API proxy** (`GET|POST /api/*`): Strips `/api/` prefix, forwards to `https://hrms128.thai-nrls.org/HRMS11388/Database/*` with the session cookie from the `X-Session-Id` header
- **SSL**: Disables certificate verification because the HRMS server uses a self-signed cert

**Requirements**: Python 3.8+ (uses only stdlib — no pip packages needed)

**Running**: `python server.py` → opens on `http://localhost:5000`

### Frontend State Machine

The app has a single global mode (`currentMode`) with two values:

| Mode | Tab Label | Behavior |
|------|-----------|----------|
| `import` | นำเข้าข้อมูลครบวงจร | Upload Excel → preview → 2-phase batch create |
| `delete` | ลบพนักงาน | Show employee list → click delete per row |

---

## API Endpoints

All API calls go through the proxy as `/api/<endpoint>`. The frontend sends `X-Session-Id` header on every request.

| Proxy Path | HRMS Endpoint | Method | Purpose |
|------------|---------------|--------|---------|
| `/api/login` | `/Account/AuthenUser` | POST | Authenticate user, get session |
| `/api/GetJSonDataUserGrp` | `/Database/GetJSonDataUserGrp` | GET | List user groups (Admin, เจ้าหน้าที่, etc.) |
| `/api/GetJSonEmplList` | `/Database/GetJSonEmplList` | GET | List all employees (Name + Code) |
| `/api/GetJSonDataUser` | `/Database/GetJSonDataUser` | GET | List all users (Name, Code, Username, UserGrp, UserGrpName) |
| `/api/SaveEmpl` | `/Database/SaveEmpl` | POST | Create one employee. Body: `txtName=<name>` |
| `/api/SaveUser` | `/Database/SaveUser` | POST | Create one user account. Body: `txtCode=&ddlUserGrp=<grpCode>&ddlEmpl=<emplCode>&txtUsername=<user>&txtPassword=<pass>` |
| `/api/DeleteEmpl` | `/Database/DeleteEmpl` | POST | Delete one employee. Body: `code=<emplCode>` |

### API Response Format

All HRMS APIs return JSON:
```json
{
  "ResponseStatus": "1",        // "1" = success, "0" = failure
  "ResponseMsg": "...",          // Error message (nullable)
  "ResponseTitle": "...",        // Title (nullable)
  "ResponseData": "[{...}]",    // JSON string of array (needs JSON.parse)
  "TotalRecords": 0,
  "FilteredRecords": 0
}
```

**Important**: `ResponseData` is a **JSON string inside JSON** — it must be parsed with `JSON.parse(json.ResponseData)`.

### Data Shapes

**Employee** (from `GetJSonEmplList`):
```json
{ "Name": "Somchai Jaidee", "Code": "00001" }
```

**User** (from `GetJSonDataUser`):
```json
{
  "Code": "00041",
  "Name": "Somchai Jaidee",
  "UserGrp": "00001",
  "Username": "somchai.j",
  "UserGrpName": "Admin"
}
```
Note: `UserGrp` can contain comma-separated codes (e.g., `"00002,00004,00005"`). `UserGrpName` may sometimes be missing or only contain codes — always map through `userGroupsList` for display.

**User Group** (from `GetJSonDataUserGrp`):
```json
{ "Name": "Admin", "Code": "00001" }
```

---

## Global State (`app.js`)

| Variable | Type | Description |
|----------|------|-------------|
| `currentMode` | `string` | `'import'` or `'delete'` |
| `sessionId` | `string` | ASP.NET session cookie value |
| `cancelled` | `boolean` | User clicked cancel during batch |
| `employeeList` | `array` | All employees from `GetJSonEmplList` |
| `userList` | `array` | All users from `GetJSonDataUser` |
| `userGroupsList` | `array` | All user groups from `GetJSonDataUserGrp` |
| `parsedRows` | `array` | Rows parsed from uploaded Excel |
| `matchedRows` | `array` | Rows after matching/analysis (ready for submit) |

---

## File-by-File Details

### `app.js` — Core Module

- Defines all `API` endpoint paths, global state variables, and DOM element references
- `DOMContentLoaded` calls all setup functions in order
- `switchMode(mode)` toggles between `import` and `delete` — updates UI text, visibility, loads data
- `loadExistingEmployeesList()` renders the employee table enriched with Username and UserGrpName from `userList`. Maps `UserGrp` codes to names using `userGroupsList` to avoid showing raw code numbers
- `loadEmployeeList()` fetches employees, users, and user groups in parallel using `Promise.all` to prevent race conditions
- `loadUserGroups()` populates the user group dropdown and stores results in `userGroupsList`
- `apiFetch(url, options)` wraps `fetch()` and injects `X-Session-Id` header
- `matchAndPreview()` dispatches to `matchAndPreviewImport()` based on current mode
- Progress helpers: `setStatus()`, `showProgress()`, `updateProgress()`, `finishBatch()`
- Utility: `formatFileSize()`, `esc()` (HTML escape), `sleep()`, `addLog()`

### `login.js` — Authentication

- `setupLogin()` attaches event listeners and restores session from `sessionStorage`
- `doLogin()` POSTs credentials to `/api/login`, receives `session_id` in response
- `onLoginSuccess()` hides login screen (removes `d-flex` class to avoid Bootstrap `!important` conflict), shows main app, loads data
- `doLogout()` clears session, resets UI, clears `sessionStorage`
- Session persistence: stores `hrms_session`, `hrms_userid`, `hrms_title` in `sessionStorage`

**Bootstrap visibility gotcha**: `loginScreen` uses `d-flex` class. Hiding it requires removing the class first (`classList.remove('d-flex')`) because Bootstrap's `.d-flex` has `display: flex !important` which overrides `style.display = 'none'`.

### `upload.js` — Excel File Handling

- `setupDropzone()` handles click, drag-over, drag-leave, drop events
- `handleFile(file)` validates extension (.xlsx, .xls, .csv), reads with `FileReader`, parses with SheetJS (`XLSX.read`)
- Column detection: normalizes all column names to lowercase, searches for known names:
  - Name column (required): `name`, `ชื่อพนักงาน`, `ชื่อ`, `employee name`
  - Username column (optional): `username`, `ชื่อผู้ใช้`, `user`
- Outputs `parsedRows` with `_importName` and `_importUsername` fields
- `findColumn(columns, possibleNames)` does case-insensitive matching

### `modes.js` — Unified Import Mode

**`matchAndPreviewImport()`**:
- Matches each parsed row against `employeeList` by exact name comparison
- Creates `matchedRows` with: `name`, `username`, `isDuplicate`, `oldCode`, `status`
- Renders preview table with analysis badges:
  - 🟢 New employee + create user (not duplicate, has username)
  - 🟡 New employee, no user (not duplicate, no username)
  - 🔵 Existing employee + create user (duplicate, has username)
  - ⚫ Existing employee, skip (duplicate, no username)

**`batchSubmitImport()`** — 2-Phase Pipeline:

1. **Phase 1** — Create new employees: Iterates `matchedRows`, skips duplicates (`isDuplicate`), POSTs `SaveEmpl` for each new name. Marks `failedPhase1 = true` on errors to prevent Phase 2 from running for that row. 1-second delay between requests.

2. **Refresh** — If Phase 1 created employees AND there are users to create, calls `loadEmployeeList()` to fetch the newly generated employee codes from the server.

3. **Phase 2** — Create user accounts: For each row with a username (and not `failedPhase1`), looks up the employee code from `employeeList` (either `oldCode` for existing employees or freshly fetched code for new ones). POSTs `SaveUser` with employee code, user group, username, and password.

4. **Cleanup** — Marks skipped rows (duplicate + no username) as "ข้าม" (skipped).

### `delete.js` — Delete Mode

- `loadDeleteList()` renders all employees in a table with per-row delete buttons
- Each row shows: Code, Name, Username, UserGrpName (enriched from `userList` + `userGroupsList`)
- Click delete → Bootstrap modal confirmation → POST `DeleteEmpl` with employee code
- On success, removes employee from `employeeList` and updates count
- Uses `cloneNode(true)` + `replaceChild` to prevent duplicate event listeners on the modal confirm button

### `style.css` — Custom Styles

- Font: Noto Sans Thai
- Logo gradient: purple (#6c5ce7 → #a29bfe)
- Tab active colors: green (empl), purple (user), red (delete), green (import)
- Dropzone: dashed border, hover/drag-over highlight
- Custom badges: matched, unmatched, success, fail, sending (with pulse animation), pending
- Employee code: monospace with blue background chip
- Log entries: colored by type (success=green, fail=red, info=blue)

### `index.html` — Page Structure

- Full-page dark Bootstrap 5 layout
- CDN: Bootstrap 5.3.3, Bootstrap Icons 1.11.3, SheetJS 0.20.3
- Sections: Login screen → Main app (header, login status, tabs, settings card, upload card, preview table, progress)
- Two Bootstrap modals: submit confirmation, delete confirmation
- All interactive elements have unique IDs matching the DOM refs in `app.js`

---

## User Group Code Mapping

The HRMS API sometimes returns `UserGrp` as raw codes without `UserGrpName`. The app handles this by:

1. Fetching `GetJSonDataUserGrp` into `userGroupsList` (alongside employee/user data using `Promise.all`)
2. When displaying, splitting `UserGrp` by comma, mapping each code through `userGroupsList.find(g => g.Code === code.trim())`
3. Falling back to `UserGrpName` if `userGroupsList` is empty
4. Falling back to raw code if nothing matches

This logic exists in both `app.js` (`loadExistingEmployeesList`) and `delete.js` (`loadDeleteList`).

---

## Known Issues & Gotchas

1. **Bootstrap `d-flex` !important**: The login screen uses `d-flex` class. Must remove class before hiding with `style.display = 'none'`.
2. **Race condition on data loading**: Employee list, user list, and user groups must all be loaded before rendering tables. Solved with `Promise.all` in `loadEmployeeList()`.
3. **1-second delay between API calls**: Intentional to avoid overwhelming the HRMS server. Configured in `batchSubmitImport()`.
4. **Name matching is exact**: Employee names must match exactly (after trim) between Excel and HRMS. No fuzzy matching.
5. **SSL cert verification disabled**: The HRMS server uses a certificate that Python can't verify. `server.py` disables SSL verification.
6. **Proxy Referer header**: `SaveEmpl` and `DeleteEmpl` use EmplList referer, all other POST requests use UserList referer. The HRMS server checks this.
