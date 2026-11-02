/* Connects the screen to the logic: window.pharmacy.api(...) */
(function () {
  'use strict';
  const ready = window.Store.init();
  window.pharmacy = {
    api: async function (req) {
      try {
        await ready;
      } catch (e) {
        return { ok: false, error: 'Could not open the data on this phone: ' + (e && e.message ? e.message : e) };
      }
      const result = window.PharmacyApi.handle(req);
      try {
        await window.Store.flush();
      } catch (e) {
        window.dispatchEvent(new CustomEvent('save-error', { detail: e.message }));
      }
      return result;
    }
  };
})();
