// App-level notice only; browser/device permissions remain separately controlled.
(() => {
  "use strict";
  const dialog = document.getElementById("privacy-permissions-dialog");
  const key = "cyclist-go-privacy-permissions-v1";
  if (!dialog) return;
  let accepted = false;
  let deferred = false;
  try { accepted = localStorage.getItem(key) === "allowed"; } catch (_) {}
  try { deferred = sessionStorage.getItem(key) === "not-now"; } catch (_) {}
  if (accepted || deferred) return;
  const previousFocus = document.activeElement;
  const dismiss = (allow) => {
    try {
      if (allow) localStorage.setItem(key, "allowed");
      else sessionStorage.setItem(key, "not-now");
    } catch (_) { /* The notice remains usable if storage is unavailable. */ }
    dialog.close();
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  };
  document.getElementById("privacy-allow").addEventListener("click", () => dismiss(true));
  document.getElementById("privacy-not-now").addEventListener("click", () => dismiss(false));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss(false);
  });
  dialog.showModal();
})();
