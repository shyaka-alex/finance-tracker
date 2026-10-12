// Contact form: regex-validated, then handed to the visitor's email app (there is no server).
import { validateName, validateEmail, validateMessage } from './validators.js?v=20261012d';
import { $, announce, setFieldMessage, setStatus } from './ui.js?v=20261012d';

const TO = 's.alex@spiderbit.rw';

const RULES = {
  name: validateName,
  email: (value) => validateEmail(value.trim()),
  message: validateMessage,
};

const FIELD_ORDER = ['name', 'email', 'message'];

export function initContact() {
  const form = $('#contact-form');
  if (!form) return;
  const status = $('#contact-status');
  const touched = new Set();

  const check = (name) => {
    const message = RULES[name](form.elements[name].value);
    setFieldMessage(form.elements[name], message);
    return message;
  };

  form.addEventListener('input', (event) => {
    const { name } = event.target;
    if (name in RULES && touched.has(name)) check(name);
    setStatus(status, '');
  });

  form.addEventListener('focusout', (event) => {
    const { name, value } = event.target;
    if (!(name in RULES) || (value === '' && !touched.has(name))) return;
    touched.add(name);
    check(name);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const failed = FIELD_ORDER.filter((name) => {
      touched.add(name);
      return check(name);
    });
    if (failed.length) {
      form.elements[failed[0]].focus();
      announce(`Please fix ${failed.length} ${failed.length === 1 ? 'field' : 'fields'} before sending.`, { assertive: true });
      return;
    }

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const subject = encodeURIComponent(`Spendwise feedback from ${name}`);
    const body = encodeURIComponent(`${form.elements.message.value.trim()}\n\n${name} (${email})`);
    window.location.href = `mailto:${TO}?subject=${subject}&body=${body}`;

    setStatus(status, 'Thanks! Your message is ready to send in your email app.', 'success');
    form.reset();
    touched.clear();
  });
}
