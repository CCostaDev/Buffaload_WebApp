const stopDuration = 45 * 60 * 1000; // 45 minutes in milliseconds
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
      throw new Error(`API responded with status ${response.status}`);
    }

    let data = await response.json();

    // Filter out vehicles without a date field
    data = data.filter((vehicle) => vehicle.date);

    // Convert all vehicle dates from UTC to local time
    data = data.map((vehicle) => {
      let vehicleDate = new Date(vehicle.date);
      vehicleDate.setHours(vehicleDate.getHours() + 1); // Add 1 hour
      vehicle.localDate = vehicleDate;
      return vehicle;
    });

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
    const lastUpdate = new Date(vehicle.localDate).getTime();
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
    const lastUpdate = new Date(vehicle.localDate).getTime();
    const stoppedTime = now - lastUpdate;

    // List of location groups to filter out
    // const excludedLocationGroups = ["Buffaload", "Maintenance"];

    // Check if vehicle's location group is in the excluded list
    // const isExcludedLocationGroup =
    //   vehicle.locationGroupName &&
    //   excludedLocationGroups.includes(vehicle.locationGroupName);

    return isTippers && stoppedTime;
  });
}

// FILTER HGVs IN SERVICES

function filterStoppedVehiclesInServices(vehicles) {
  const now = Date.now();
  const fifteenHoursAgo = now - 15 * 60 * 60 * 1000; // 15 hours in milliseconds

  // List of location groups to filter out
  const includedLocationGroups = ["Gas Stations", "Services and Truckstops"];

  return vehicles
    .filter((vehicle) => {
      const isHGV = vehicle.assetType === "HGV";
      const lastUpdate = new Date(vehicle.localDate).getTime();
      const withinFifteenHours = lastUpdate >= fifteenHoursAgo;

      // Check if vehicle's location group is in the included list
      const isIncludedLocationGroup =
        vehicle.locationGroupName &&
        includedLocationGroups.includes(vehicle.locationGroupName);

      return isHGV && withinFifteenHours && isIncludedLocationGroup;
    })
    .map((vehicle) => {
      const lastUpdate = new Date(vehicle.localDate).getTime();
      const timeInService = now - lastUpdate;

      return {
        ...vehicle,
        timeInService,
      };
    });
}

// FILTERS OF HGVs IN DEPOTS

// global variables
let vehicles = [];
// added filteredDepots variable for performance in case the vehicle list gets bigger
let filteredDepots = [];
let checkboxes = [];

function applyFilters() {
  console.log("Applying filters");
  console.log("Vehicles:", filteredDepots); // Debug log

  if (!Array.isArray(filteredDepots)) {
    console.error("Vehicle data is not an array");
    return;
  }

  const selectedFilters = Array.from(checkboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  const furtherFilteredDepots = filterStoppedVehiclesInDepots(
    filteredDepots,
    selectedFilters
  );
  displayDepots(furtherFilteredDepots);
}

document.addEventListener("DOMContentLoaded", async () => {
  const depotPageElement = document.getElementById("depots-list");

  if (depotPageElement) {
    checkboxes = document.querySelectorAll(".filter-checkbox"); // Assign checkboxes here

    try {
      // Fetch vehicles data
      vehicles = await fetchVehicles(); // Assign the fetched vehicles to the global vehicles variable

      if (!Array.isArray(vehicles)) {
        throw new Error("Vehicles data is not an array");
      }

      filteredDepots = filterStoppedVehiclesInDepots(vehicles);

      // Initially apply the filters to show the vehicles
      applyFilters();
    } catch (error) {
      console.error(
        "Error during fetching or processing vehicles:",
        error.message
      );
    }

    // Add event listener to checkboxes to apply filters on change
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", applyFilters);
    });
  }
});

// FILTER HGV IN DEPOTS

function filterStoppedVehiclesInDepots(vehicles, selectedFilters = []) {
  const includedLocationGroup = "Buffaload";

  return vehicles.filter((vehicle) => {
    const isHGV = vehicle.assetType === "HGV";
    const isStopped = vehicle.eventType === "stopped";
    const excludeGroup = vehicle.assetGroupName === "Buffaload Ely Tippers";
    const isInBuffaloadGroup =
      vehicle.locationGroupName === includedLocationGroup;

    if (!isHGV || !isStopped || !isInBuffaloadGroup || excludeGroup) {
      return false;
    }

    const isIncludedLocationName =
      selectedFilters.length === 0 ||
      selectedFilters.includes(vehicle.locationName);

    return isIncludedLocationName;
  });
}

// FILTER MAINTENANCE VEHICLES

function filterMaintenance(vehicles) {
  const now = Date.now();

  // List of location groups to filter
  const includedLocationGroups = ["Maintenance"];

  return vehicles
    .filter((vehicle) => {
      const isHGV = vehicle.assetType === "HGV";
      const lastUpdate = new Date(vehicle.localDate).getTime();

      // Check if vehicle's location group is in the included list
      const isIncludedLocationGroup =
        vehicle.locationGroupName &&
        includedLocationGroups.includes(vehicle.locationGroupName);

      return isHGV && isIncludedLocationGroup;
    })
    .map((vehicle) => {
      const lastUpdate = new Date(vehicle.localDate).getTime();
      const timeInMaintenance = now - lastUpdate;

      return {
        ...vehicle,
        timeInMaintenance,
      };
    });
}

// Utility function to generate Google Maps URL

function generateMapsUrl(vehicle) {
  const latitude = vehicle.latitude;
  const longitude = vehicle.longitude;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
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
    const lastUpdate = new Date(vehicle.localDate).getTime();
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

    const mapsUrl = generateMapsUrl(vehicle);

    const li = document.createElement("li");
    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">Last Update: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="${mapsUrl}" target="_blank">${
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
    noVehiclesMessage.textContent = "No Tippers available.";
    tippersList.appendChild(noVehiclesMessage);
    return;
  }

  vehicles.forEach((vehicle) => {
    const now = Date.now();
    const lastUpdate = new Date(vehicle.localDate).getTime();
    const timeDifference = now - lastUpdate;

    // Convert time difference to minutes
    const minutes = Math.floor(timeDifference / (1000 * 60));

    let timeSinceUpdate = "";
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      timeSinceUpdate = `${hours}h ${remainingMinutes}m`;
    } else {
      timeSinceUpdate = `${minutes}m`;
    }

    const li = document.createElement("li");
    li.classList.add("card");

    // Classes based on event type and time difference
    if (vehicle.eventType === "driving") {
      li.classList.add("pastel-green");
    } else if (
      (vehicle.eventType === "stopped" || vehicle.eventType === "idling") &&
      minutes <= 15
    ) {
      li.classList.add("yellow");
    } else if (
      (vehicle.eventType === "stopped" || vehicle.eventType === "idling") &&
      minutes > 15
    ) {
      li.classList.add("red");
    }

    const mapsUrl = generateMapsUrl(vehicle);

    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">${
      vehicle.eventType
    }: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="${mapsUrl}" target="_blank">${
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
    const lastUpdate = new Date(vehicle.localDate).getTime();
    const timeDifference = now - lastUpdate;

    // Convert time difference to minutes
    const minutes = Math.floor(timeDifference / (1000 * 60));

    let timeSinceUpdate = "";
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      timeSinceUpdate = `${hours}h ${remainingMinutes}m`;
    } else {
      timeSinceUpdate = `${minutes}m`;
    }

    const li = document.createElement("li");
    li.classList.add("card");

    // Classes based on time difference
    if (minutes >= 120) {
      li.classList.add("red", "breathing");
    } else if (minutes >= 45) {
      li.classList.add("red");
    } else if (minutes >= 15) {
      li.classList.add("amber");
    }

    const mapsUrl = generateMapsUrl(vehicle);

    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">Last Update: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="${mapsUrl}" target="_blank">${
      vehicle.locationName || vehicle.formattedAddress
    }</a></div>`;
    servicesList.appendChild(li);
  });
}

// DISPLAY DEPOTS

function displayDepots(vehicles) {
  const depotsList = document.getElementById("depots-list");
  depotsList.innerHTML = "";

  if (vehicles.length === 0) {
    const noVehiclesMessage = document.createElement("li");
    noVehiclesMessage.textContent = "No vehicles currently stopped at depots.";
    depotsList.appendChild(noVehiclesMessage);
    return;
  }

  vehicles.forEach((vehicle) => {
    const now = Date.now();
    const lastUpdate = new Date(vehicle.localDate).getTime();
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

    const mapsUrl = generateMapsUrl(vehicle);

    const li = document.createElement("li");
    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">Last Update: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="${mapsUrl}" target="_blank">${
      vehicle.locationName || vehicle.formattedAddress
    }</a></div>`;
    depotsList.appendChild(li);
  });
}

// DISPLAY MAINTENANCE

function displayMaintenance(vehicles) {
  const maintenanceList = document.getElementById("maintenance-list");
  maintenanceList.innerHTML = "";

  if (vehicles.length === 0) {
    const noVehiclesMessage = document.createElement("li");
    noVehiclesMessage.textContent = "No vehicles in maintenance.";
    depotsList.appendChild(noVehiclesMessage);
    return;
  }

  vehicles.forEach((vehicle) => {
    const now = Date.now();
    const lastUpdate = new Date(vehicle.localDate).getTime();
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

    const mapsUrl = generateMapsUrl(vehicle);

    const li = document.createElement("li");
    li.innerHTML = `
    <div class="card-title">${vehicle.assetRegistration}</div> 
    <div class="card-content">Last Update: </br><b>${timeSinceUpdate}</b></br>
    </br>Location:</br>
    <a href="${mapsUrl}" target="_blank">${
      vehicle.locationName || vehicle.formattedAddress
    }</a></div>`;
    maintenanceList.appendChild(li);
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
  } else if (document.getElementById("maintenance-list")) {
    // Logic for Maintenance page
    const stoppedMaintenance = filterMaintenance(vehicles);
    console.log("Stopped in Maintenance:", stoppedMaintenance);
    displayMaintenance(stoppedMaintenance);
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

  if (document.getElementById("maintenance-list")) {
    const stoppedMaintenance = filterMaintenance(vehicles);
    console.log("Stopped Maintenance:", stoppedMaintenance);
    displayMaintenance(stoppedMaintenance);
  }
}, refreshInterval);

// HTML button function
function toggleMenu() {
  const menu = document.querySelector(".menu-links");
  const icon = document.querySelector(".hamburger-icon");
  menu.classList.toggle("open");
  icon.classList.toggle("open");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").then(
      (registration) => {
        console.log(
          "Service Worker registered with scope:",
          registration.scope
        );
      },
      (err) => {
        console.log("Service Worker registration failed:", err);
      }
    );
  });
}
