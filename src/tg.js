// Telegram WebApp wrapper. Every call is a safe no-op outside Telegram.
const tg = typeof window !== 'undefined' ? window.Telegram && window.Telegram.WebApp : null;
export const isTelegram = !!(tg && tg.initData !== undefined && tg.platform && tg.platform !== 'unknown');

let vibration = true;
export function setVibration(v) {
  vibration = !!v;
}

export function initTelegram() {
  if (!isTelegram) return;
  try {
    tg.ready();
    tg.expand();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    if (tg.setHeaderColor) tg.setHeaderColor('#0c0d15');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#0c0d15');
  } catch (e) {
    /* ignore */
  }
}

export function haptic(kind) {
  if (!vibration || !isTelegram || !tg.HapticFeedback) return;
  try {
    const h = tg.HapticFeedback;
    if (kind === 'collect') h.impactOccurred('light');
    else if (kind === 'damage') h.notificationOccurred('error');
    else if (kind === 'levelup') h.notificationOccurred('success');
    else if (kind === 'heavy') h.impactOccurred('heavy');
    else h.selectionChanged();
  } catch (e) {
    /* ignore */
  }
}

let backHandler = null;
export function setBack(fn) {
  if (!isTelegram || !tg.isVersionAtLeast('6.1') || !tg.BackButton) return;
  try {
    if (backHandler) tg.BackButton.offClick(backHandler);
    backHandler = fn;
    if (fn) {
      tg.BackButton.onClick(fn);
      tg.BackButton.show();
    } else tg.BackButton.hide();
  } catch (e) {
    /* ignore */
  }
}

export function cloudGet(key) {
  return new Promise((resolve) => {
    if (!isTelegram || !tg.isVersionAtLeast('6.9') || !tg.CloudStorage || !tg.CloudStorage.getItem) return resolve(null);
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, 1500);
    try {
      tg.CloudStorage.getItem(key, (err, val) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(err ? null : val || null);
      });
    } catch (e) {
      done = true;
      clearTimeout(t);
      resolve(null);
    }
  });
}

export function cloudSet(key, val) {
  if (!isTelegram || !tg.isVersionAtLeast('6.9') || !tg.CloudStorage || !tg.CloudStorage.setItem) return;
  try {
    tg.CloudStorage.setItem(key, val, () => {});
  } catch (e) {
    /* ignore */
  }
}

export function shareLink(url) {
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}
