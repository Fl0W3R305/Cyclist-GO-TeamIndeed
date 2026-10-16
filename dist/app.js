/* Person 1 — application startup and shared dialog/toast interactions.
   Load order is defined in index.html; no build tool is needed. */
"use strict";
document.addEventListener("click", (e) => {
  const close = e.target.closest("[data-close]");
  if (close) $(close.dataset.close).close();
});
$("dismiss-toast").addEventListener("click", () => {
  $("toast").hidden = true;
  state.undo = null;
});
$("about-button").addEventListener("click", () => {
  $("about-dialog").showModal();
  pause();
});
setupPlanner();
setupHazards();
setupRide();
Preferences.setup();
setupMap();
// Preserve the previous optional WebMCP comparison integration.
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "compare_demo_routes",
        description:
          "Compare saved OSM cycling routes with BCC indicators. Does not start a ride.",
        inputSchema: {
          type: "object",
          properties: {
            destination: {
              type: "string",
              enum: ["cityhall", "uq", "southbank"],
            },
            preference: { type: "string", enum: ["safe", "fast", "scenic"] },
          },
          required: ["destination", "preference"],
          additionalProperties: false,
        },
        execute(input) {
          if (state.view === "ride")
            throw new Error("End the current ride first.");
          if (
            !D.destinations.some((d) => d.id === input.destination) ||
            !["safe", "fast", "scenic"].includes(input.preference)
          )
            throw new Error("Unsupported option");
          chooseDestination(input.destination);
          plan();
          selectRoute(input.preference);
          return {
            selected: state.selected,
            source: "OSM/BRouter routes + BCC indicators",
            matched: state.routes.filter(Preferences.accepts).map((r) => r.id),
          };
        },
      }),
    ).catch(() => {});
  } catch {}
}

$("start-offset").textContent = `Starts on the mapped public path ${BCC_DATA.meta.startOffset} m from the shopping-centre reference point.`;
