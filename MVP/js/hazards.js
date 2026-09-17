let hazards = [
    "Confirmed: Pothole - Milton Road",
    "Confirmed: Roadworks - Bicentennial Bikeway",
    "Confirmed: Flooding - Riverside path"
];

// Displays every hazard inside the HTML list
function showHazards() {
    let hazardList = document.getElementById("hazardList");

    hazardList.innerHTML = "";

    for (let hazard of hazards) {
        hazardList.innerHTML += "<li>" + hazard + "</li>";
    }
}

// Lets the cyclist report a new hazard
function reportHazard() {
    let type = prompt("What type of hazard is it?");
    let location = prompt("Where is the hazard?");

    if (type && location) {
        hazards.push("Potential: " + type + " - " + location);

        showHazards();

        alert("Hazard reported!");
    }
}

// Displays the hazards when the page opens
document.addEventListener("DOMContentLoaded", showHazards);