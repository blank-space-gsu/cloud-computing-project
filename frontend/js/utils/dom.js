export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.assign(element.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'htmlFor') {
      element.setAttribute('for', value);
    } else if (key === 'selected' || key === 'checked') {
      element[key] = !!value;
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }
  return element;
}

export function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
  return element;
}

export function formData(form) {
  const data = {};
  const fd = new FormData(form);
  for (const [key, value] of fd.entries()) {
    data[key] = value;
  }
  return data;
}

export function $(selector) {
  return document.querySelector(selector);
}

export function $$(selector) {
  return document.querySelectorAll(selector);
}
