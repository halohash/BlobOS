window.holoDialog = function({
  title = '',
  message = '',
  positiveText = 'OK',
  negativeText = '',
  neutralText = '',
  cancelable = true
} = {}) {
  if (!document.getElementById('dialogcss')) {
    const style = document.createElement('link');
    style.id = 'dialogcss';
    style.rel = "stylesheet";
    style.href = "/blobos-dialog.css"
    document.head.appendChild(style);
  }

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'holo-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'holo-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    if (title) {
      const titleEl = document.createElement('h2');
      titleEl.className = 'holo-title';
      titleEl.textContent = title;
      dialog.appendChild(titleEl);
    }

    if (message) {
      const bodyEl = document.createElement('div');
      bodyEl.className = 'holo-body';
      bodyEl.textContent = message;
      dialog.appendChild(bodyEl);
    }

    const actions = document.createElement('div');
    actions.className = 'holo-actions';

    const close = (result) => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && cancelable) close('cancel');
    };

    const buttons = [
      { text: negativeText, value: 'negative' },
      { text: neutralText, value: 'neutral' },
      { text: positiveText, value: 'positive' }
    ].filter((b) => b.text);

    buttons.forEach((btnConfig) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'holo-btn';
      btn.textContent = btnConfig.text;
      btn.addEventListener('click', () => close(btnConfig.value));
      actions.appendChild(btn);
    });

    dialog.appendChild(actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    if (cancelable) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close('cancel');
      });
    }

    document.addEventListener('keydown', onKeyDown);

    const renderedBtns = actions.querySelectorAll('button');
    if (renderedBtns.length) renderedBtns[renderedBtns.length - 1].focus();
  });
}
