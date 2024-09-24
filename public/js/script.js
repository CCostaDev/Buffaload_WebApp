const stopDuration = 1.5 * 60 * 60 * 1000; // 1 hour 30 minutes in milliseconds
const stopGracePeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
const refreshInterval = 2 * 60 * 1000; // 2 minutes in milliseconds

let vehicles = [];

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
      const data = JSON.parse(cachedData).map((vehicle) => {
        vehicle.localDate = new Date(vehicle.localDate);
        return vehicle;
      });

      applyFilter();
      return data;
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
    applyFilter();
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

    const hasLocationName =
      vehicle.locationName && vehicle.locationName.trim() !== "";

    return (
      isHGV &&
      isStopped &&
      withinFifteenHours &&
      !isExcludedLocationGroup &&
      stoppedLongEnough &&
      hasLocationName
    );
  });
}

// FILTER TIPPERS

function filterTippers(vehicles) {
  const now = Date.now();

  return vehicles.filter((vehicle) => {
    const isTippers = vehicle.assetGroupName === "Ely Tipper Operation";
    const lastUpdate = new Date(vehicle.localDate).getTime();
    const stoppedTime = now - lastUpdate;

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
      const stoppedLongEnough = now - lastUpdate > stopGracePeriod;
      const withinFifteenHours = lastUpdate >= fifteenHoursAgo;

      // Check if vehicle's location group is in the included list or if location name is missing
      const hasLocationName =
        vehicle.locationName && vehicle.locationName.trim() !== "";
      const isIncludedLocationGroup =
        vehicle.locationGroupName &&
        includedLocationGroups.includes(vehicle.locationGroupName);

      const isNotTipper = vehicle.assetGroupName !== "Ely Tipper Operation";

      const hasValidDriverName =
        vehicle.driverName && vehicle.driverName.trim() !== "";

      const shouldIncludeBasedOnEvent =
        isIncludedLocationGroup ||
        vehicle.eventType === "stopped" ||
        vehicle.eventType === "idling";

      return (
        isHGV &&
        (isIncludedLocationGroup ||
          (shouldIncludeBasedOnEvent &&
            stoppedLongEnough &&
            !hasLocationName)) &&
        withinFifteenHours &&
        isNotTipper &&
        hasValidDriverName
      );
    })
    .map((vehicle) => {
      const lastUpdate = new Date(vehicle.localDate).getTime();
      const timeInService = Date.now() - lastUpdate;

      const displayName = vehicle.locationName
        ? vehicle.locationName
        : vehicle.formattedAddress;

      return {
        ...vehicle,
        timeInService,
        displayName,
      };
    });
}

let nightOutVehicles = [];

// NIGHT-OUT LOGIC

function assignToNightOut(assetName) {
  const vehicleCard = document.getElementById(`vehicle-${assetName}`);
  nightOutVehicles = JSON.parse(localStorage.getItem("nightOutVehicles")) || [];

  if (vehicleCard) {
    if (vehicleCard.classList.contains("night-out")) {
      vehicleCard.classList.remove("night-out");
      // Remove the vehicle from localStorage
      nightOutVehicles = nightOutVehicles.filter((name) => name !== assetName);
    } else {
      vehicleCard.classList.add("night-out");
      // Add the vehicle to localStorage
      nightOutVehicles.push(assetName);
    }
    localStorage.setItem("nightOutVehicles", JSON.stringify(nightOutVehicles));

    applyFilter();
  }
}

// Function to remove a vehicle from "Night-out" if its eventType changes
function checkEventTypeChange(vehicle) {
  const vehicleCard = document.getElementById(`vehicle-${vehicle.assetName}`);
  let nightOutVehicles =
    JSON.parse(localStorage.getItem("nightOutVehicles")) || [];

  if (
    vehicle.eventType !== "stopped" && // If the vehicle is no longer stopped
    nightOutVehicles.includes(vehicle.assetName) // And it was marked as night-out
  ) {
    // Remove the vehicle from night-out list
    nightOutVehicles = nightOutVehicles.filter(
      (name) => name !== vehicle.assetName
    );
    localStorage.setItem("nightOutVehicles", JSON.stringify(nightOutVehicles));

    // Remove the night-out class
    if (vehicleCard) {
      vehicleCard.classList.remove("night-out");
    }
  }
}

//Update the vehicle display based on the filter
function updateVehicleDisplay(assetName, filterType) {
  const vehicleCard = document.getElementById(`vehicle-${assetName}`);
  if (vehicleCard) {
    if (filterType === "Night-Out") {
      vehicleCard.classList.add("night-out");
      vehicleCard.classList.remove("red", "amber", "breathing"); // Remove time-based classes
    } else {
      vehicleCard.classList.remove("night-out");
    }
  }
}

//Call this function whenever the eventType changes
function monitorVehicleChanges(vehicles) {
  vehicles.forEach((vehicle) => checkEventTypeChange(vehicle));
}

// FILTERS OF NIGHT-OUT/SERVICES

function applyFilter() {
  const filterCheckbox = document.querySelector(".filter-checkbox");

  // Only run the filter logic if the checkbox exists
  if (!filterCheckbox) {
    console.log("No filter checkbox found on this page.");
    return; // Exit the function if there's no checkbox
  }

  const nightOutFilter = filterCheckbox.checked;

  // Get all vehicle cards
  const vehicleCards = document.querySelectorAll(".card");

  vehicleCards.forEach((card) => {
    // If the Night-Out filter is checked, show only vehicles with the "night-out" class
    if (nightOutFilter) {
      if (card.classList.contains("night-out")) {
        card.style.display = ""; // Show the card if it has the "night-out" class
      } else {
        card.style.display = "none"; // Hide the card if it doesn't have the "night-out" class
      }
    } else {
      // If the Night-Out filter is not checked, show all vehicles except "night-out"
      if (card.classList.contains("night-out")) {
        card.style.display = "none"; // Hide night-out vehicles
      } else {
        card.style.display = ""; // Show the rest
      }
    }
  });
}

function filterVehiclesByLocation(vehicles, nightOutFilter) {
  // If Night-Out filter is selected, show only Night-Out vehicles
  if (nightOutFilter) {
    return vehicles.filter((vehicle) =>
      nightOutVehicles.includes(vehicle.assetName)
    );
  }

  // Otherwise, show all vehicles except Night-Out ones
  return vehicles.filter(
    (vehicle) => !nightOutVehicles.includes(vehicle.assetName)
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  // Fetch vehicles data
  const vehicles = await fetchVehicles();

  // Restore "night-out" classes from localStorage
  nightOutVehicles = JSON.parse(localStorage.getItem("nightOutVehicles")) || [];

  vehicles.forEach((vehicle) => {
    if (nightOutVehicles.includes(vehicle.assetName)) {
      const vehicleCard = document.getElementById(
        `vehicle-${vehicle.assetName}`
      );
      if (vehicleCard) {
        vehicleCard.classList.add("night-out"); // Restore the class
      }
    }
  });

  // Display services or other initial logic
  if (document.getElementById("services-list")) {
    const stoppedServices = filterStoppedVehiclesInServices(vehicles);
    displayServices(stoppedServices);

    vehicles.forEach((vehicle) => checkEventTypeChange(vehicle));

    const filterCheckbox = document.querySelector(".filter-checkbox");
    if (filterCheckbox) {
      filterCheckbox.checked = false;
      applyFilter();

      filterCheckbox.addEventListener("change", applyFilter);
    }
  }

  // Logic for vehicle listings, depots, and maintenance
  if (document.getElementById("vehicle-list")) {
    const stoppedVehicles = filterStoppedVehicles(vehicles);
    displayVehicles(stoppedVehicles);
  }

  if (document.getElementById("depots-list")) {
    const stoppedDepots = filterStoppedVehiclesInDepots(vehicles);
    displayDepots(stoppedDepots);
  }

  if (document.getElementById("maintenance-list")) {
    const stoppedMaintenance = filterMaintenance(vehicles);
    displayMaintenance(stoppedMaintenance);
  }
});

// FILTERS OF HGVs IN DEPOTS
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
    const isStopped = vehicle.eventType === "stopped";
    const excludeGroup = vehicle.assetGroupName !== "Ely Tipper Operation";
    const isInBuffaloadGroup =
      vehicle.locationGroupName === includedLocationGroup;

    if (!isStopped || !isInBuffaloadGroup || !excludeGroup) {
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
    <div class="card-title">${vehicle.assetName}</div> 
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
    <div class="card-title">${vehicle.assetName}</div> 
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
    li.setAttribute("id", `vehicle-${vehicle.assetName}`);

    // Check if the vehicle is part of Night-Out and apply the class if necessary
    if (nightOutVehicles.includes(vehicle.assetName)) {
      li.classList.add("night-out");
    }

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
      <div class="card-title">${vehicle.assetName}</div> 
      <div class="card-content">
        Last Update: </br><b>${timeSinceUpdate}</b></br></br>
        <button class="btn2" onclick="assignToNightOut('${
          vehicle.assetName
        }')">Assign Night-Out</button>
        </br></br>Location:</br>
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
    <div class="card-title">${vehicle.assetName}</div> 
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
    <div class="card-title">${vehicle.assetName}</div> 
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

    const filterCheckbox = document.querySelector(".filter-checkbox");
    if (filterCheckbox) {
      applyFilter();

      vehicles.forEach((vehicle) => checkEventTypeChange(vehicle));
    }
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

  if (nightOutVehicles.length > 0) {
    monitorVehicleChanges(vehicles);
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
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log(
          "Service Worker registered with scope:",
          registration.scope
        );

        // Listen for updates to the Service Worker
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                console.log("New content available, reloading...");
                window.location.reload(); // Automatically reload the page
              } else {
                console.log("Content is cached for offline use.");
              }
            }
          };
        };

        // Force reload when the new service worker takes control
        let refreshing;
        navigator.serviceWorker.oncontrollerchange = () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        };
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  });
}
