const stopDuration = 45 * 60 * 1000; // 45 minutes in milliseconds
const tipperStopDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
const refreshInterval = 120 * 1000; // 2 minutes in milliseconds

async function fetchVehicles() {
  const cacheKey = "vehicles";
  const cacheTimestampKey = "vehicles-timestamp";
  const cacheDuration = 120000; // 2min in milliseconds

  try {
    const now = Date.now();
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cacheTimestampKey);

    if (
      cachedData &&
      cachedTimestamp &&
      now - cachedTimestamp < cacheDuration
    ) {
      // Use cached data if it's not expired
      console.log("Using cached vehicle data");
      return JSON.parse(cachedData);
    }

    // Fetch new data from the server
    const response = await fetch("/api/vehicles"); // Update URL as needed
    if (!response.ok) {
      throw new Error(`Api responded with status ${response.status}`);
    }

    const data = await response.json();

    // Ensure data is an array
    if (!Array.isArray(data)) {
      throw new Error("Fetched data is not an array");
    }

    // Update cache
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(cacheTimestampKey, now.toString());

    console.log("Fetched new vehicle data");
    return data;
  } catch (error) {
    console.error("Error fetching vehicle data:", error);
    return [];
  }
}

// FILTER HGVs

function filterStoppedVehicles(vehicles) {
  const now = Date.now();
  const fifteenHoursAgo = now - 15 * 60 * 60 * 1000; // 15 hours in milliseconds

  // List of location groups to filter out
  const excludedLocationGroups = ["Buffaload", "Maintenance"];

  return vehicles.filter((vehicle) => {
    const isHGV = vehicle.assetType === "HGV";
    const isStopped = vehicle.eventType === "stopped";
    const lastUpdate = new Date(vehicle.date).getTime();
    const stoppedLongEnough = now - lastUpdate > stopDuration;
    const withinFifteenHours = lastUpdate >= fifteenHoursAgo;

    // Check if vehicle's location group is in the excluded list
    const isExcludedLocationGroup =
      vehicle.locationGroupName &&
      excludedLocationGroups.includes(vehicle.locationGroupName);

    return (
      isHGV &&
      isStopped &&
      withinFifteenHours &&
      !isExcludedLocationGroup &&
      stoppedLongEnough
    );
  });
}

// FILTER TIPPERS

function filterTippers(vehicles) {
  const now = Date.now();

  return vehicles.filter((vehicle) => {
    const isTippers = vehicle.assetGroupName === "Buffaload Ely Tippers";
    const isStopped = vehicle.eventType === "stopped";
    const lastUpdate = new Date(vehicle.date).getTime();
    const stoppedForLongEnough = now - lastUpdate > tipperStopDuration;

    // List of location groups to filter out
    const excludedLocationGroups = ["Buffaload", "Maintenance"];

    // Check if vehicle's location group is in the excluded list
    const isExcludedLocationGroup =
      vehicle.locationGroupName &&
      excludedLocationGroups.includes(vehicle.locationGroupName);

    return (
      isTippers && isStopped && stoppedForLongEnough && !isExcludedLocationGroup
    );
  });
}

// FILTER HGVs IN SERVICES

function filterStoppedVehiclesInServices(vehicles) {
  const now = Date.now();
  const fifteenHoursAgo = now - 15 * 60 * 60 * 1000; // 15 hours in milliseconds

  // List of location groups to filter out
  const includedLocationGroups = [
    "Gas Stations",
    "Fuel Station",
    "Parking",
    "Service",
    "Services and Truckstops",
  ];

  return vehicles.filter((vehicle) => {
    const isHGV = vehicle.assetType === "HGV";
    const isStopped = vehicle.eventType === "stopped";
    const lastUpdate = new Date(vehicle.date).getTime();
    const stoppedLongEnough = now - lastUpdate > stopDuration;
    const withinFifteenHours = lastUpdate >= fifteenHoursAgo;

    // Check if vehicle's location group is in the included list
    const isIncludedLocationGroup =
      vehicle.locationGroupName &&
      includedLocationGroups.includes(vehicle.locationGroupName);

    return (
      isHGV &&
      isStopped &&
      withinFifteenHours &&
      isIncludedLocationGroup &&
      stoppedLongEnough
    );
  });
}

// FILTER HGVs IN DEPOTS

function filterStoppedVehiclesInDepots(vehicles) {
  const now = Date.now();
  //const fifteenHoursAgo = now - 15 * 60 * 60 * 1000; // 15 hours in milliseconds

  // List of location groups to filter out
  const includedLocationGroups = ["Buffaload"];

  return vehicles.filter((vehicle) => {
    const isHGV = vehicle.assetType === "HGV";
    const isStopped = vehicle.eventType === "stopped";
    const lastUpdate = new Date(vehicle.date).getTime();
    //const stoppedLongEnough = now - lastUpdate > stopDuration;
    //const withinFifteenHours = lastUpdate >= fifteenHoursAgo;

    const isIncludedLocationGroup =
      vehicle.locationGroupName &&
      includedLocationGroups.includes(vehicle.locationGroupName);

    return (
      isHGV &&
      isStopped &&
      //withinFifteenHours &&
      isIncludedLocationGroup
      //stoppedLongEnough
    );
  });
}

// DISPLAY HGVs

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
    const timeDifference = now - lastUpdate;

    // Convert time difference to minutes, hours and days
    const minutes = Math.floor(timeDifference / (1000 * 60)) % 60;
    const hours = Math.floor(timeDifference / (1000 * 60 * 60)) % 24;
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

    let timeSinceUpdate = "";
    if (days > 0) {
      timeSinceUpdate = `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      timeSinceUpdate = `${hours}h ${minutes}m`;
    } else {
      timeSinceUpdate = `${minutes}m`;
    }

    const li = document.createElement("li");
    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">Last Update: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      vehicle.formattedAddress
    )}" target="_blank">${
      vehicle.locationName || vehicle.formattedAddress
    }</a></div>`;
    vehicleList.appendChild(li);
  });
}

// DISPLAY TIPPERS

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
    const timeDifference = now - lastUpdate;

    // Convert time difference to minutes, hours and days
    const minutes = Math.floor(timeDifference / (1000 * 60)) % 60;
    const hours = Math.floor(timeDifference / (1000 * 60 * 60)) % 24;
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

    let timeSinceUpdate = "";
    if (days > 0) {
      timeSinceUpdate = `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      timeSinceUpdate = `${hours}h ${minutes}m`;
    } else {
      timeSinceUpdate = `${minutes}m`;
    }

    const li = document.createElement("li");
    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">Last Update: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      vehicle.formattedAddress
    )}" target="_blank">${
      vehicle.locationName || vehicle.formattedAddress
    }</a></div>`;
    tippersList.appendChild(li);
  });
}

// DISPLAY SERVICES

function displayServices(vehicles) {
  const servicesList = document.getElementById("services-list");

  if (!servicesList) {
    console.error("Element with id 'services-list' not found.");
    return;
  }

  servicesList.innerHTML = "";

  if (vehicles.length === 0) {
    const noVehiclesMessage = document.createElement("li");
    noVehiclesMessage.textContent =
      "No vehicles currently stopped at services.";
    servicesList.appendChild(noVehiclesMessage);
    return;
  }

  vehicles.forEach((vehicle) => {
    const now = Date.now();
    const lastUpdate = new Date(vehicle.date).getTime();
    const timeDifference = now - lastUpdate;

    // Convert time difference to minutes, hours and days
    const minutes = Math.floor(timeDifference / (1000 * 60)) % 60;
    const hours = Math.floor(timeDifference / (1000 * 60 * 60)) % 24;
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

    let timeSinceUpdate = "";
    if (days > 0) {
      timeSinceUpdate = `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      timeSinceUpdate = `${hours}h ${minutes}m`;
    } else {
      timeSinceUpdate = `${minutes}m`;
    }

    const li = document.createElement("li");
    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">Last Update: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      vehicle.formattedAddress
    )}" target="_blank">${
      vehicle.locationName || vehicle.formattedAddress
    }</a></div>`;
    servicesList.appendChild(li);
  });
}

// DISPLAY DEPOTS

function displayDepots(vehicles) {
  const depotsList = document.getElementById("depots-list");

  if (!depotsList) {
    console.error("Element with id 'depots-list' not found.");
    return;
  }

  depotsList.innerHTML = "";

  if (vehicles.length === 0) {
    const noVehiclesMessage = document.createElement("li");
    noVehiclesMessage.textContent = "No vehicles currently stopped at depots.";
    depotsList.appendChild(noVehiclesMessage);
    return;
  }

  vehicles.forEach((vehicle) => {
    const now = Date.now();
    const lastUpdate = new Date(vehicle.date).getTime();
    const timeDifference = now - lastUpdate;

    // Convert time difference to minutes, hours and days
    const minutes = Math.floor(timeDifference / (1000 * 60)) % 60;
    const hours = Math.floor(timeDifference / (1000 * 60 * 60)) % 24;
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

    let timeSinceUpdate = "";
    if (days > 0) {
      timeSinceUpdate = `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      timeSinceUpdate = `${hours}h ${minutes}m`;
    } else {
      timeSinceUpdate = `${minutes}m`;
    }

    const li = document.createElement("li");
    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">Last Update: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      vehicle.formattedAddress
    )}" target="_blank">${
      vehicle.locationName || vehicle.formattedAddress
    }</a></div>`;
    depotsList.appendChild(li);
  });
}

// EVENT LISTENER

document.addEventListener("DOMContentLoaded", async () => {
  const vehicles = await fetchVehicles();

  if (document.getElementById("vehicle-list")) {
    // Logic for HGVs page
    const stoppedVehicles = filterStoppedVehicles(vehicles);
    console.log("Stopped Vehicles:", stoppedVehicles);
    displayVehicles(stoppedVehicles);
  } else if (document.getElementById("tippers-list")) {
    // Logic for Tippers page
    const stoppedTippers = filterTippers(vehicles);
    console.log("Stopped Tippers:", stoppedTippers);
    displayTippers(stoppedTippers);
  } else if (document.getElementById("services-list")) {
    // Logic for Services page
    const stoppedServices = filterStoppedVehiclesInServices(vehicles);
    console.log("Stopped in Services:", stoppedServices);
    displayServices(stoppedServices);
  } else if (document.getElementById("depots-list")) {
    // Logic for Depots page
    const stoppedDepots = filterStoppedVehiclesInDepots(vehicles);
    console.log("Stopped in Depots:", stoppedDepots);
    displayDepots(stoppedDepots);
  }
});

// Set up auto-refresh every 2 minutes (matches cache duration)
setInterval(async () => {
  const vehicles = await fetchVehicles();

  if (document.getElementById("vehicle-list")) {
    const stoppedVehicles = filterStoppedVehicles(vehicles);
    console.log("Stopped Vehicles:", stoppedVehicles);
    displayVehicles(stoppedVehicles);
  }

  if (document.getElementById("tippers-list")) {
    const stoppedTippers = filterTippers(vehicles);
    console.log("Stopped Tippers:", stoppedTippers);
    displayTippers(stoppedTippers);
  }

  if (document.getElementById("services-list")) {
    const stoppedServices = filterStoppedVehiclesInServices(vehicles);
    console.log("Stopped in Services:", stoppedServices);
    displayServices(stoppedServices);
  }

  if (document.getElementById("depots-list")) {
    const stoppedDepots = filterStoppedVehiclesInDepots(vehicles);
    console.log("Stopped in Depots:", stoppedDepots);
    displayDepots(stoppedDepots);
  }
}, refreshInterval);

// HTML button function
function toggleMenu() {
  const menu = document.querySelector(".menu-links");
  const icon = document.querySelector(".hamburger-icon");
  menu.classList.toggle("open");
  icon.classList.toggle("open");
}