import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

// Enable CORS
app.use(cors());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

const apiURL = `https://api.masternautconnect.com/connect-webservices/services/public/v1/customer/${process.env.API_CUSTOMER_ID}/tracking/live`;
const username = process.env.API_USERNAME;
const password = process.env.API_PASSWORD;

// Basic auth credentials
const credentials = Buffer.from(`${username}:${password}`).toString("base64");

// Function to fetch vehicle data from the API
async function fetchVehicleData() {
  const response = await fetch(apiURL, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API responded with status ${response.status}`);
  }

  return await response.json();
}

// API endpoint to get vehicle data
app.get("/api/vehicles", async (req, res) => {
  try {
    const data = await fetchVehicleData();
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate");
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching vehicle data:", error);
    const statusCode = error.response ? error.response.status : 500;
    res.status(statusCode).json({ message: "Failed to fetch vehicle data" });
  }
});

// Handle requests to the root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Redirect requests for favicon.ico to the external URL
app.get("/favicon.ico", (req, res) => {
  res.redirect(
    "https://buffaload.co.uk/wp-content/uploads/2021/10/Buffaload_Favicon.svg"
  );
});

// Redirect requests for favicon.png to the external URL
app.get("/favicon.png", (req, res) => {
  res.redirect(
    "https://buffaload.co.uk/wp-content/uploads/2021/10/Buffaload_Favicon.svg"
  );
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Export the app as the default export
export default app;
