
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

const app = express();

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());


// --- Routers ---
const productsRouter = require("./routes/products");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const ordersRouter = require("./routes/orders");

app.use("/api/products", productsRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/orders", ordersRouter);

// --- API Health Check ---
app.get("/api/health", (req, res) => {
    res.json({ message: "Server running" });
});

// --- Static Pages ---
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "public/register.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public/admin.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/home.html"));
});

// --- Static Files ---
app.use(express.static(path.join(__dirname, "public")));


app.use((req, res) => {
    // API không tồn tại
    if (req.path.startsWith("/api")) {
        return res.status(404).json({
            success: false,
            message: "API không tồn tại!"
        });
    }

    // Trang frontend mặc định
    res.sendFile(
        path.join(__dirname, "public/index.html"),
        (err) => {
            if (err) {
                res.status(404).send("Page not found");
            }
        }
    ); 
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
