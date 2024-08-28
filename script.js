const stopDuration = 45 * 60 * 1000; // 45 minutes in milliseconds
const tipperStopDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
const refreshInterval = 30 * 1000; // 30 seconds in milliseconds

async function fetchVehicles() {
  try {
    const response = await fetch("http://localhost:3000/api/vehicles"); // Request to node.js server
    const data = await response.json();
    console.log("Vehicle data:", data);
    return data;
  } catch (error) {
    console.error("Error fetching vehicle data:", error);
    return [];
  }
}

// HGVs

function filterStoppedVehicles(vehicles) {
  const now = Date.now();
  const fifteenHoursAgo = now - 15 * 60 * 60 * 1000; // 15 hours in milliseconds

  return vehicles.filter((vehicle) => {
    const isHGV = vehicle.assetType === "HGV";
    const isStopped = vehicle.eventType === "stopped";
    const lastUpdate = new Date(vehicle.date).getTime();
    const stoppedLongEnough = now - lastUpdate > stopDuration;
    const withinFifteenHours = lastUpdate >= fifteenHoursAgo;
    //const notEndOfJourney = vehicle.status !== "endOfJourney"; //endOfJourney is displayed whenever a vehicle is stopped and not at the end of the journey - to look into

    // Only include vehicles not at "Grove Lane" and "BUFFALOAD ELLINGTON"
    const locationNotBuffaload =
      vehicle.formattedAddress &&
      !vehicle.formattedAddress.includes("Grove Lane");
    const locationNotEllington = vehicle.locationName !== "BUFFALOAD ELLINGTON";

    return (
      isHGV &&
      isStopped &&
      withinFifteenHours &&
      //notEndOfJourney &&
      locationNotBuffaload &&
      locationNotEllington &&
      stoppedLongEnough
    );
  });
}

function filterTippers(vehicles) {
  const now = Date.now();

  return vehicles.filter((vehicle) => {
    const isTippers = vehicle.assetGroupName === "Buffaload Ely Tippers";
    const isStopped = vehicle.eventType === "stopped";
    const lastUpdate = new Date(vehicle.date).getTime();
    const stoppedForLongEnough = now - lastUpdate > tipperStopDuration;

    // Exclude specific location
    const locationNotBuffaload =
      vehicle.formattedAddress &&
      !vehicle.formattedAddress.includes("Grove Lane");
    const locationNotEllington = vehicle.locationName !== "BUFFALOAD ELLINGTON";

    return (
      isTippers &&
      isStopped &&
      stoppedForLongEnough &&
      locationNotBuffaload &&
      locationNotEllington
    );
  });
}

function displayVehicles(vehicles) {
  const vehicleList = document.getElementById("vehicle-list");
  vehicleList.innerHTML = "";

  if (vehicles.length === 0) {
    const noVehiclesMessage = document.createElement("li");
    noVehiclesMessage.textContent = "No Vehicles currently stopped.";
    vehicleList.appendChild(noVehiclesMessage);
    return;
  }

  vehicles.forEach((vehicle) => {
    const now = Date.now();
    const lastUpdate = new Date(vehicle.date).getTime();
    const diffInMinutes = Math.floor((now - lastUpdate) / (1000 * 60));

    const li = document.createElement("li");
    li.textContent = `Registration: ${vehicle.assetRegistration}, Last Update: ${diffInMinutes} Min ago, Location: ${vehicle.formattedAddress}`;
    vehicleList.appendChild(li);
  });
}

function displayTippers(vehicles) {
  const tippersList = document.getElementById("tippers-list");

  if (!tippersList) {
    console.error("Element with id 'tippers-list' not found.");
    return;
  }

  tippersList.innerHTML = "";

  if (vehicles.length === 0) {
    const noVehiclesMessage = document.createElement("li");
    noVehiclesMessage.textContent = "No Tippers currently stopped.";
    tippersList.appendChild(noVehiclesMessage);
    return;
  }

  vehicles.forEach((vehicle) => {
    const now = Date.now();
    const lastUpdate = new Date(vehicle.date).getTime();
    const diffInMinutes = Math.floor((now - lastUpdate) / (1000 * 60));

    const li = document.createElement("li");
    li.textContent = `Registration: ${vehicle.assetRegistration}, Last Update: ${diffInMinutes} Min ago, Location: ${vehicle.formattedAddress}`;
    tippersList.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const vehicles = await fetchVehicles();

  if (document.getElementById("vehicle-list")) {
    // Code specific to HGVs page
    const stoppedVehicles = filterStoppedVehicles(vehicles);
    console.log("Stopped Vehicles:", stoppedVehicles);
    displayVehicles(stoppedVehicles);
  }

  if (document.getElementById("tippers-list")) {
    // Code specific to Tippers page
    const stoppedTippers = filterTippers(vehicles);
    console.log("Stopped Tippers:", stoppedTippers);
    displayTippers(stoppedTippers);
  }
});

// Set up auto-refresh every 30 seconds
setInterval(async () => {
  if (document.getElementById("vehicle-list")) {
    const vehicles = await fetchVehicles();
    const stoppedVehicles = filterStoppedVehicles(vehicles);
    console.log("Stopped Vehicles:", stoppedVehicles);
    displayVehicles(stoppedVehicles);
  }

  if (document.getElementById("tippers-list")) {
    const vehicles = await fetchVehicles();
    const stoppedTippers = filterTippers(vehicles);
    console.log("Stopped Tippers:", stoppedTippers);
    displayTippers(stoppedTippers);
  }
}, refreshInterval);

// HTML button function
function toggleMenu() {
  const menu = document.querySelector(".menu-links");
  const icon = document.querySelector(".hamburger-icon");
  menu.classList.toggle("open");
  icon.classList.toggle("open");
}
