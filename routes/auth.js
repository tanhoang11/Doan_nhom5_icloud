const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";

// REGISTER
router.post("/register", async(req, res) => {
    try {
        const { email, password, role = "user" } = req.body;
        const pool = await getPool();
        const [exists] = await pool.execute("SELECT id FROM users WHERE email=?", [email]);
        if (exists.length) return res.status(400).json({ error: "Email đã tồn tại" });

        const hashed = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            "INSERT INTO users (email,password,role,created_at) VALUES (?,?,?,NOW())", [email, hashed, role]
        );

        res.status(201).json({ message: "Đăng ký thành công", id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// LOGIN
router.post("/login", async(req, res) => {
    try {
        const { email, password } = req.body;
        const pool = await getPool();
        const [rows] = await pool.execute("SELECT * FROM users WHERE email=?", [email]);
        if (!rows.length) {
            console.log("Không tìm thấy email:", email);
            return res.status(400).json({ error: "Email hoặc mật khẩu không đúng" });
        }

        const user = rows[0];


        console.log("Email nhập:", email);
        console.log("Password nhập:", password);
        console.log("Hash password trong DB:", user.password);

        const match = await bcrypt.compare(password, user.password);

        console.log("Kết quả so sánh mật khẩu:", match);

        if (!match) return res.status(400).json({ error: "Email hoặc mật khẩu không đúng" });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
        res.cookie("token", token, { httpOnly: true });
        res.json({ message: "Đăng nhập thành công", role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});


// LOGOUT
router.post("/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Đã đăng xuất" });
});

// ME
router.get("/me", (req, res) => {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: "Chưa đăng nhập" });
    try {
        const user = jwt.verify(token, JWT_SECRET);
        res.json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
        res.status(401).json({ error: "Token không hợp lệ" });
    }
});

module.exports = router;