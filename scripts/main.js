// Entry point: wires every module together.
import { initState } from './state.js';
import { initNavigation } from './ui.js';
import { initForm } from './form.js';
import { initRecords } from './records.js';
import { initDashboard } from './dashboard.js';

initState();
initNavigation();
initForm();
initRecords();
initDashboard();

document.getElementById('year').textContent = String(new Date().getFullYear());
