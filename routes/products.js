
const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";

// Middleware kiểm tra quyền admin
function adminOnly(req, res, next) {
    const token = req.cookies && req.cookies.token;

    if (!token) {
        return res.status(401).json({
            error: "Chưa đăng nhập"
        });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);

        if (user.role !== "admin") {
            return res.status(403).json({
                error: "Bạn không có quyền thực hiện thao tác này"
            });
        }

        req.user = user;
        next();

    } catch (err) {
        return res.status(401).json({
            error: "Token không hợp lệ"
        });
    }
}

// CREATE PRODUCT - Chỉ admin
router.post("/", adminOnly, async (req, res) => {
    try {
        const {
            name,
            description = "",
            price = 0,
            stock = 0,
            image = ""
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: "Tên sản phẩm không được để trống"
            });
        }

        if (!Number.isFinite(Number(price)) || Number(price) < 0) {
            return res.status(400).json({
                error: "Giá sản phẩm không hợp lệ"
            });
        }

        if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
            return res.status(400).json({
                error: "Số lượng tồn kho không hợp lệ"
            });
        }

        const pool = await getPool();

        const [result] = await pool.execute(
            `INSERT INTO products
             (name, description, price, stock, image, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
                name.trim(),
                description,
                Number(price),
                Number(stock),
                image
            ]
        );

        res.status(201).json({
            message: "Thêm sản phẩm thành công",
            id: result.insertId
        });

    } catch (err) {
        console.error("POST /api/products error:", err);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// GET PRODUCT LIST - Cho phép khách xem
router.get("/", async (req, res) => {
    try {
        const {
            q,
            page = 1,
            limit = 10,
            minPrice,
            maxPrice
        } = req.query;

        let pageNum = parseInt(page, 10);
        let limitNum = parseInt(limit, 10);

        if (!Number.isInteger(pageNum) || pageNum < 1) {
            pageNum = 1;
        }

        if (!Number.isInteger(limitNum) || limitNum < 1) {
            limitNum = 10;
        }

        // Giới hạn để tránh truy vấn quá lớn.
        limitNum = Math.min(limitNum, 100);

        const offsetNum = (pageNum - 1) * limitNum;
        const pool = await getPool();

        const where = [];
        const params = [];

        if (q && q.trim()) {
            where.push("(name LIKE ? OR description LIKE ?)");
            params.push(`%${q.trim()}%`, `%${q.trim()}%`);
        }

        if (minPrice !== undefined && minPrice !== "") {
            const value = Number(minPrice);

            if (!Number.isFinite(value) || value < 0) {
                return res.status(400).json({
                    error: "Giá thấp nhất không hợp lệ"
                });
            }

            where.push("price >= ?");
            params.push(value);
        }

        if (maxPrice !== undefined && maxPrice !== "") {
            const value = Number(maxPrice);

            if (!Number.isFinite(value) || value < 0) {
                return res.status(400).json({
                    error: "Giá cao nhất không hợp lệ"
                });
            }

            where.push("price <= ?");
            params.push(value);
        }

        const whereClause = where.length
            ? "WHERE " + where.join(" AND ")
            : "";

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM products ${whereClause}`,
            params
        );

        const total = Number(countRows[0].total);

        const [rows] = await pool.execute(
            `SELECT id, name, description, price, stock, image, created_at
             FROM products ${whereClause}
             ORDER BY id ASC
             LIMIT ${limitNum} OFFSET ${offsetNum}`,
            params
        );

        res.json({
            data: rows,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        });

    } catch (err) {
        console.error("GET /api/products error:", err);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// GET PRODUCT BY ID - Cho phép xem
router.get("/:id", async (req, res) => {
    try {
        const pool = await getPool();

        const [rows] = await pool.execute(
            `SELECT id, name, description, price, stock, image, created_at
             FROM products
             WHERE id = ?`,
            [req.params.id]
        );

        if (!rows.length) {
            return res.status(404).json({
                error: "Không tìm thấy sản phẩm"
            });
        }

        res.json(rows[0]);

    } catch (err) {
        console.error("GET /api/products/:id error:", err);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// UPDATE PRODUCT - Chỉ admin
router.put("/:id", adminOnly, async (req, res) => {
    try {
        const {
            name,
            description = "",
            price,
            stock,
            image = ""
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: "Tên sản phẩm không được để trống"
            });
        }

        if (!Number.isFinite(Number(price)) || Number(price) < 0) {
            return res.status(400).json({
                error: "Giá sản phẩm không hợp lệ"
            });
        }

        if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
            return res.status(400).json({
                error: "Số lượng tồn kho không hợp lệ"
            });
        }

        const pool = await getPool();

        const [result] = await pool.execute(
            `UPDATE products
             SET name = ?, description = ?, price = ?,
                 stock = ?, image = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                name.trim(),
                description,
                Number(price),
                Number(stock),
                image,
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Không tìm thấy sản phẩm"
            });
        }

        res.json({
            message: "Cập nhật sản phẩm thành công"
        });

    } catch (err) {
        console.error("PUT /api/products/:id error:", err);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// DELETE PRODUCT - Chỉ admin
router.delete("/:id", adminOnly, async (req, res) => {
    try {
        const pool = await getPool();

        const [result] = await pool.execute(
            "DELETE FROM products WHERE id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Không tìm thấy sản phẩm"
            });
        }

        res.json({
            message: "Xóa sản phẩm thành công"
        });

    } catch (err) {
        console.error("DELETE /api/products/:id error:", err);

        res.status(500).json({
            error: "Server error"
        });
    }
});

module.exports = router;
