export function makeSelectOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

export function renderElementList(container, elements, getElementValue) {
  if (elements.length === 0) {
    container.replaceChildren(makeEmptyElementListMessage());
    return;
  }

  const rows = elements.map((element) => {
    return makeElementListRow(element, getElementValue(element));
  });

  container.replaceChildren(...rows);
}

function makeEmptyElementListMessage() {
  const message = document.createElement('p');
  message.className = 'empty-list';
  message.textContent = 'No elements added yet';
  return message;
}

function makeElementListRow(element, elementValue) {
  const row = document.createElement('div');
  row.className = 'element-row';
  row.dataset.elementRow = elementValue;
  row.append(
    makeElementListInfo(element),
    makeElementIconButton('edit', elementValue, 'Edit element'),
    makeElementIconButton('delete', elementValue, 'Delete element'),
  );
  return row;
}

function makeElementListInfo(element) {
  const info = document.createElement('div');
  const type = document.createElement('span');
  const name = document.createElement('strong');

  type.textContent = element.kind;
  name.textContent = element.name;
  info.className = 'element-row-info';
  type.className = 'element-row-type';
  info.append(name, type);
  return info;
}

function makeElementIconButton(action, elementValue, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button ${action}-button`;
  button.dataset[`element${capitalizeAction(action)}`] = elementValue;
  button.setAttribute('aria-label', label);
  button.innerHTML = getElementButtonIcon(action);
  return button;
}

function getElementButtonIcon(action) {
  if (action === 'edit') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5 V20 h3.5 L18 9.5 14.5 6 4 16.5 Z"></path><path d="M13.5 7 L17 10.5"></path></svg>';
  }

  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7 h12"></path><path d="M9 7 V5 h6 v2"></path><path d="M8 10 l1 9 h6 l1 -9"></path></svg>';
}

function capitalizeAction(action) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}
