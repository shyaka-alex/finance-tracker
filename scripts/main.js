// Entry point: wires every module together.
import { initNavigation } from './ui.js';

initNavigation();

document.getElementById('year').textContent = String(new Date().getFullYear());
