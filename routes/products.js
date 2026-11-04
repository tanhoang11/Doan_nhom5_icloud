const express = require("express");
const router = express.Router();
const { getPool } = require("../db");

// CREATE product
router.post("/", async(req, res) => {
    try {
        const { name, description, price = 0, stock = 0, image = "" } = req.body;
        const pool = await getPool();
        const [result] = await pool.execute(
            `INSERT INTO products 
       (name, description, price, stock, image, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`, [name, description, price, stock, image]
        );
        res.status(201).json({ message: "Created", id: result.insertId });
    } catch (err) {
        console.error("POST /api/products error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/", async(req, res) => {
    try {
        const { q, page = 1, limit = 10, minPrice, maxPrice } = req.query;
        let pageNum = parseInt(page, 10);
        let limitNum = parseInt(limit, 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
        if (isNaN(limitNum) || limitNum < 1) limitNum = 10;
        const offsetNum = (pageNum - 1) * limitNum;
        const pool = await getPool();

        let where = [];
        let params = [];

        if (q) {
            where.push("(name LIKE ? OR description LIKE ?)");
            params.push(`%${q}%`, `%${q}%`);
        }
        if (minPrice) {
            where.push("price >= ?");
            params.push(Number(minPrice));
        }
        if (maxPrice) {
            where.push("price <= ?");
            params.push(Number(maxPrice));
        }

        const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM products ${whereClause}`,
            params
        );
        const total = countRows[0].total;

        const query = `
      SELECT id, name, description, price, stock, image, created_at
      FROM products ${whereClause}
      ORDER BY id ASC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;
        const [rows] = await pool.execute(query, params);

        res.json({
            data: rows,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        });
    } catch (err) {
        console.error("GET /api/products error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/:id", async(req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute(
            `SELECT id, name, description, price, stock, image, created_at
       FROM products WHERE id = ?`, [req.params.id]
        );

        if (!rows.length) return res.status(404).json({ error: "Not found" });
        res.json(rows[0]);
    } catch (err) {
        console.error("GET /api/products/:id error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// UPDATE product
router.put("/:id", async(req, res) => {
    try {
        const { name, description, price, stock, image } = req.body;
        const pool = await getPool();
        const [result] = await pool.execute(
            `UPDATE products
       SET name=?, description=?, price=?, stock=?, image=?, updated_at=NOW()
       WHERE id=?`, [name, description, price, stock, image, req.params.id]
        );

        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Not found" });

        res.json({ message: "Updated" });
    } catch (err) {
        console.error("PUT /api/products/:id error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// DELETE product
router.delete("/:id", async(req, res) => {
    try {
        const pool = await getPool();
        const [result] = await pool.execute("DELETE FROM products WHERE id=?", [
            req.params.id,
        ]);

        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Not found" });

        res.json({ message: "Deleted" });
    } catch (err) {
        console.error("DELETE /api/products/:id error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;