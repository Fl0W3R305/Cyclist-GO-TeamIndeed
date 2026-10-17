// App-level notice only; browser/device permissions remain separately controlled.
(() => {
  "use strict";
  const dialog = document.getElementById("privacy-permissions-dialog");
  if (!dialog) return;
  // Show the notice on every fresh page load for demonstrations.
  const previousFocus = document.activeElement;
  const dismiss = () => {
    dialog.close();
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  };
  document.getElementById("privacy-allow").addEventListener("click", () => dismiss());
  document.getElementById("privacy-not-now").addEventListener("click", () => dismiss());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  dialog.showModal();
})();
