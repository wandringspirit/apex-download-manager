# Verification & Automated Test Suite

Apex Download Manager features an automated test suite executed with the native Node.js test runner (`node --test`). It verifies data integrity, range concurrency, error tolerance, rate limit backoff, and extension bridge compatibility.

---

## 1. Running the Test Suite

Execute the entire test suite from the project root:
```powershell
npm test
```

### Test Execution Summary:
- **Test Suites**: 3
- **Total Test Cases**: 13
- **Execution Time**: ~2.5 seconds
- **External Dependencies**: Zero (uses native Node.js HTTP/FS/crypto APIs)

---

## 2. Test Suite Breakdown

### Suite 1: `DownloadEngine` Concurrency & Integrity (`tests/downloadEngine.test.js`)

| Test ID | Test Description | Assertion Criteria |
| :--- | :--- | :--- |
| **TC-01** | Guaranteed Percentage Clamping | Verifies that progress percent never exceeds `100.0%`, even with out-of-order chunk buffers. |
| **TC-02** | Segment Bounded Progress Calculation | Tests that segment byte offsets never write past assigned upper range limits. |
| **TC-03** | Incomplete File Isolation (`.adm_download`) | Verifies partial downloads are safely written to isolated temporary files with `.adm_download` extensions. |
| **TC-04** | Atomic File Finalization on Completion | Verifies that upon completion, the engine atomically renames `.adm_download` to the target file. |
| **TC-05** | External File Movement / Deletion Detection | Tests engine error handling when a file is externally locked or deleted during an active download. |
| **TC-06** | Dynamic Concurrency Scaling (Bisecting Algorithm) | Tests dynamic socket allocation from 4 to 16 threads while verifying zero data corruption. |
| **TC-13** | Adaptive 429 Rate-Limit Step-Down Engine | Emulates an HTTP 429 Too Many Requests response and verifies automatic concurrency throttle (e.g. 64 → 48 → 32). |

---

### Suite 2: `TaskManager` Lifecycle & Residual Cleanup (`tests/taskManager.test.js`)

| Test ID | Test Description | Assertion Criteria |
| :--- | :--- | :--- |
| **TC-07** | Task Registration and State Persistence | Verifies registration, JSON serialization, and disk persistence to `.adm_tasks.json`. |
| **TC-08** | Complete Purge of Residual Files on Delete | Verifies that calling `deleteTask(id, true)` removes `.adm_download`, `.adm_meta`, and target file. |
| **TC-09** | Residual Meta Purged Even When `deleteFile: false` | Verifies metadata `.adm_meta` is cleaned up when user keeps the downloaded file. |
| **TC-10** | Concurrency API Dispatch | Verifies thread adjustment requests correctly propagate to active download workers. |

---

### Suite 3: `VideoGrabber` & Extension Bridge (`tests/videoGrabber.test.js`)

| Test ID | Test Description | Assertion Criteria |
| :--- | :--- | :--- |
| **TC-11** | Bridge Server Accepts Video Grabber POST Payloads | Tests `POST /api/download` from the browser extension and validates JSON payload ingestion. |
| **TC-12** | URL Sanitization & Auto-Category Detection | Tests classification logic mapping URLs to categories (`Video`, `Compressed`, `Programs`, `Documents`). |

---

## 3. Writing Additional Tests

New tests should be placed in `tests/*.test.js` using Node's native `test` and `assert` modules:

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Custom Feature Suite', () => {
  test('TC-X: Feature Verification', async () => {
    assert.equal(1 + 1, 2);
  });
});
```
