const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { dbConnect } = require("./config/mongoose-connection");
const appRoutes = require("./routes/app");

const app = express();
const PORT = process.env.PORT || 5000;

// Load environment variables
require("dotenv").config();

// Middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(cookieParser());

// Database connection
dbConnect();

// Routes
app.use("/api", appRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


