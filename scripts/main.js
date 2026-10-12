// Entry point: wires every module together.
import { initState, subscribe } from './state.js';
import { initNavigation, announce } from './ui.js';
import { initSettings } from './settings.js';
import { initForm } from './form.js';
import { initRecords } from './records.js';
import { initDashboard } from './dashboard.js?v=20261012b';
import { initContact } from './contact.js';

const startup = initState();

initNavigation();
initSettings();
initForm();
initRecords();
initDashboard();
initContact();

subscribe((type) => {
  if (type === 'storage-error') {
    announce('Could not save to this browser’s storage. Export your data to keep a copy.', { assertive: true });
  }
});

if (startup.recordsCorrupt) {
  announce('Saved transactions could not be read and were reset. Import a backup from Settings.', { assertive: true });
} else if (startup.skipped > 0) {
  announce(`${startup.skipped} damaged saved ${startup.skipped === 1 ? 'transaction was' : 'transactions were'} skipped.`, { assertive: true });
}
if (startup.settingsReset) {
  announce('Saved settings could not be read, so defaults were restored.');
}

document.getElementById('year').textContent = String(new Date().getFullYear());
