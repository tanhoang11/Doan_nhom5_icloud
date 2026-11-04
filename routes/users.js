const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";

// Middleware kiểm tra admin
function adminOnly(req, res, next) {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: "Chưa đăng nhập" });
    try {
        const user = jwt.verify(token, JWT_SECRET);
        if (user.role !== "admin") return res.status(403).json({ error: "Chỉ admin" });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Token không hợp lệ" });
    }
}

// GET danh sách user (bạn đã có)
router.get("/", adminOnly, async(req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute("SELECT id,email,role FROM users ORDER BY id ASC");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// GET user theo id
router.get("/:id", adminOnly, async(req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute("SELECT id, email, role FROM users WHERE id=?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "User không tồn tại" });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// PUT cập nhật user
router.put("/:id", adminOnly, async(req, res) => {
    try {
        const { email, role } = req.body;
        if (!email || !role) return res.status(400).json({ error: "Thiếu dữ liệu" });

        const pool = await getPool();

        // Kiểm tra email đã dùng cho user khác chưa
        const [exists] = await pool.execute(
            "SELECT id FROM users WHERE email=? AND id<>?", [email, req.params.id]
        );
        if (exists.length) return res.status(400).json({ error: "Email đã được sử dụng" });

        const [result] = await pool.execute(
            "UPDATE users SET email=?, role=? WHERE id=?", [email, role, req.params.id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: "User không tồn tại" });

        res.json({ message: "Cập nhật thành công" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// DELETE user
router.delete("/:id", adminOnly, async(req, res) => {
    try {
        const userIdToDelete = req.params.id;
        const currentUserId = req.user.id;

        if (userIdToDelete === String(currentUserId)) {
            return res.status(400).json({ error: "Không thể xóa tài khoản admin đang đăng nhập" });
        }

        const pool = await getPool();

        // Kiểm tra user tồn tại
        const [rows] = await pool.execute("SELECT role FROM users WHERE id=?", [userIdToDelete]);
        if (!rows.length) return res.status(404).json({ error: "User không tồn tại" });

        await pool.execute("DELETE FROM users WHERE id=?", [userIdToDelete]);
        res.json({ message: "Xóa user thành công" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;