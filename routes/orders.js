const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("Chưa cấu hình JWT_SECRET trong biến môi trường.");
}

// =====================================
// AUTHENTICATION
// =====================================

function authRequired(req, res, next) {
    const token = req.cookies && req.cookies.token;

    if (!token) {
        return res.status(401).json({
            error: "Vui lòng đăng nhập."
        });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch (error) {
        return res.status(401).json({
            error: "Phiên đăng nhập không hợp lệ."
        });
    }
}

function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            error: "Bạn không có quyền thực hiện thao tác này."
        });
    }

    return next();
}

// =====================================
// ORDER STATUS TRANSITIONS
// =====================================

const ALLOWED_TRANSITIONS = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["shipping", "cancelled"],
    shipping: ["completed", "cancelled"],
    completed: [],
    cancelled: []
};

// =====================================
// CREATE ORDER
// POST /api/orders
// =====================================

router.post("/", authRequired, async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const {
            customer_name,
            phone,
            address,
            note = "",
            items
        } = req.body || {};

        // Kiểm tra kiểu dữ liệu trước khi dùng trim().
        if (
            typeof customer_name !== "string" ||
            typeof phone !== "string" ||
            typeof address !== "string" ||
            typeof note !== "string"
        ) {
            return res.status(400).json({
                error: "Thông tin đặt hàng không hợp lệ."
            });
        }

        const customerName = customer_name.trim();
        const customerPhone = phone.trim();
        const customerAddress = address.trim();
        const orderNote = note.trim();

        if (
            !customerName ||
            !customerPhone ||
            !customerAddress ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                error: "Vui lòng nhập đầy đủ thông tin và sản phẩm đặt hàng."
            });
        }

        if (
            customerName.length > 255 ||
            customerPhone.length > 20 ||
            customerAddress.length > 500
        ) {
            return res.status(400).json({
                error: "Thông tin đặt hàng vượt quá độ dài cho phép."
            });
        }

        // Gộp các sản phẩm trùng ID.
        const quantities = new Map();

        for (const item of items) {
            if (!item || typeof item !== "object") {
                return res.status(400).json({
                    error: "Thông tin sản phẩm không hợp lệ."
                });
            }

            const productId = Number(item.product_id);
            const quantity = Number(item.quantity);

            if (
                !Number.isSafeInteger(productId) ||
                productId <= 0 ||
                !Number.isSafeInteger(quantity) ||
                quantity <= 0 ||
                quantity > 99
            ) {
                return res.status(400).json({
                    error: "Thông tin sản phẩm hoặc số lượng không hợp lệ."
                });
            }

            const newQuantity =
                (quantities.get(productId) || 0) + quantity;

            if (newQuantity > 99) {
                return res.status(400).json({
                    error: "Số lượng mỗi sản phẩm không được vượt quá 99."
                });
            }

            quantities.set(productId, newQuantity);
        }

        connection = await getPool().getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        let totalCents = 0;
        const orderItems = [];

        // Kiểm tra giá và tồn kho trực tiếp từ database.
        for (const [productId, quantity] of quantities) {
            const [products] = await connection.execute(
                `SELECT id, name, price, stock
                 FROM products
                 WHERE id = ?
                 FOR UPDATE`,
                [productId]
            );

            if (!products.length) {
                const error = new Error(
                    `Sản phẩm ID ${productId} không tồn tại.`
                );
                error.statusCode = 400;
                throw error;
            }

            const product = products[0];
            const stock = Number(product.stock || 0);
            const price = Number(product.price);

            if (!Number.isFinite(price) || price < 0) {
                const error = new Error(
                    `Giá sản phẩm "${product.name}" không hợp lệ.`
                );
                error.statusCode = 400;
                throw error;
            }

            if (!Number.isFinite(stock) || stock < quantity) {
                const error = new Error(
                    `Sản phẩm "${product.name}" chỉ còn ${stock} sản phẩm.`
                );
                error.statusCode = 400;
                throw error;
            }

            // Tính tiền theo đơn vị xu để hạn chế sai số.
            const priceCents = Math.round(price * 100);
            const subtotalCents = priceCents * quantity;

            totalCents += subtotalCents;

            orderItems.push({
                product_id: product.id,
                product_name: product.name,
                price: priceCents / 100,
                quantity,
                subtotal: subtotalCents / 100
            });
        }

        const totalAmount = totalCents / 100;

        // Tạo đơn hàng.
        const [orderResult] = await connection.execute(
            `INSERT INTO orders
             (user_id, customer_name, phone, address, note, total_amount, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [
                req.user.id,
                customerName,
                customerPhone,
                customerAddress,
                orderNote,
                totalAmount
            ]
        );

        const orderId = orderResult.insertId;

        // Lưu chi tiết đơn và trừ tồn kho.
        for (const item of orderItems) {
            await connection.execute(
                `INSERT INTO order_items
                 (order_id, product_id, product_name, price, quantity, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.product_id,
                    item.product_name,
                    item.price,
                    item.quantity,
                    item.subtotal
                ]
            );

            await connection.execute(
                `UPDATE products
                 SET stock = stock - ?
                 WHERE id = ?`,
                [item.quantity, item.product_id]
            );
        }

        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            message: "Đặt hàng thành công.",
            order_id: orderId,
            total_amount: totalAmount,
            status: "pending"
        });

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("ROLLBACK CREATE ORDER ERROR:", rollbackError);
            }
        }

        console.error("CREATE ORDER ERROR:", error);

        const statusCode = error.statusCode || 500;

        return res.status(statusCode).json({
            error: statusCode === 400
                ? error.message
                : "Không thể tạo đơn hàng. Vui lòng thử lại sau."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// =====================================
// CUSTOMER: GET MY ORDERS
// GET /api/orders/my
// =====================================

router.get("/my", authRequired, async (req, res) => {
    try {
        const pool = getPool();

        const [orders] = await pool.execute(
            `SELECT id, customer_name, phone, address,
                    note, total_amount, status, created_at
             FROM orders
             WHERE user_id = ?
             ORDER BY id DESC`,
            [req.user.id]
        );

        return res.json(orders);

    } catch (error) {
        console.error("GET MY ORDERS ERROR:", error);

        return res.status(500).json({
            error: "Không thể tải lịch sử đơn hàng."
        });
    }
});

// =====================================
// CUSTOMER: GET MY ORDER DETAIL
// GET /api/orders/my/:id
// =====================================

router.get("/my/:id", authRequired, async (req, res) => {
    try {
        const orderId = Number(req.params.id);

        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: "Mã đơn hàng không hợp lệ."
            });
        }

        const pool = getPool();

        const [orders] = await pool.execute(
            `SELECT *
             FROM orders
             WHERE id = ? AND user_id = ?`,
            [orderId, req.user.id]
        );

        if (!orders.length) {
            return res.status(404).json({
                error: "Không tìm thấy đơn hàng."
            });
        }

        const [items] = await pool.execute(
            `SELECT product_id, product_name, price, quantity, subtotal
             FROM order_items
             WHERE order_id = ?`,
            [orderId]
        );

        return res.json({
            ...orders[0],
            items
        });

    } catch (error) {
        console.error("GET MY ORDER DETAIL ERROR:", error);

        return res.status(500).json({
            error: "Không thể tải chi tiết đơn hàng."
        });
    }
});

// =====================================
// ADMIN: GET ALL ORDERS
// GET /api/orders
// =====================================

router.get("/", authRequired, adminOnly, async (req, res) => {
    try {
        const pool = getPool();

        const [orders] = await pool.execute(
            `SELECT o.*, u.email
             FROM orders o
             JOIN users u ON o.user_id = u.id
             ORDER BY o.id DESC`
        );

        return res.json(orders);

    } catch (error) {
        console.error("GET ALL ORDERS ERROR:", error);

        return res.status(500).json({
            error: "Không thể tải danh sách đơn hàng."
        });
    }
});

// =====================================
// ADMIN: GET ORDER DETAIL
// GET /api/orders/:id
// =====================================

router.get("/:id", authRequired, adminOnly, async (req, res) => {
    try {
        const orderId = Number(req.params.id);

        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: "Mã đơn hàng không hợp lệ."
            });
        }

        const pool = getPool();

        const [orders] = await pool.execute(
            `SELECT o.*, u.email
             FROM orders o
             JOIN users u ON o.user_id = u.id
             WHERE o.id = ?`,
            [orderId]
        );

        if (!orders.length) {
            return res.status(404).json({
                error: "Không tìm thấy đơn hàng."
            });
        }

        const [items] = await pool.execute(
            `SELECT product_id, product_name, price, quantity, subtotal
             FROM order_items
             WHERE order_id = ?`,
            [orderId]
        );

        return res.json({
            ...orders[0],
            items
        });

    } catch (error) {
        console.error("GET ORDER DETAIL ERROR:", error);

        return res.status(500).json({
            error: "Không thể tải chi tiết đơn hàng."
        });
    }
});

// =====================================
// ADMIN: UPDATE ORDER STATUS
// PUT /api/orders/:id/status
// =====================================

router.put("/:id/status", authRequired, adminOnly, async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const orderId = Number(req.params.id);
        const { status } = req.body || {};

        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: "Mã đơn hàng không hợp lệ."
            });
        }

        if (
            typeof status !== "string" ||
            !Object.prototype.hasOwnProperty.call(
                ALLOWED_TRANSITIONS,
                status
            )
        ) {
            return res.status(400).json({
                error: "Trạng thái đơn hàng không hợp lệ."
            });
        }

        connection = await getPool().getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        // Khóa đơn hàng để tránh cập nhật đồng thời.
        const [orders] = await connection.execute(
            `SELECT id, status
             FROM orders
             WHERE id = ?
             FOR UPDATE`,
            [orderId]
        );

        if (!orders.length) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                error: "Không tìm thấy đơn hàng."
            });
        }

        const oldStatus = orders[0].status;

        // Kiểm tra quy trình chuyển trạng thái.
        if (!ALLOWED_TRANSITIONS[oldStatus]?.includes(status)) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                error: `Không thể chuyển từ "${oldStatus}" sang "${status}".`
            });
        }

        let stockRestored = false;

        // Nếu hủy đơn, hoàn lại tồn kho.
        if (status === "cancelled") {
            const [items] = await connection.execute(
                `SELECT product_id, quantity
                 FROM order_items
                 WHERE order_id = ?`,
                [orderId]
            );

            for (const item of items) {
                await connection.execute(
                    `UPDATE products
                     SET stock = stock + ?
                     WHERE id = ?`,
                    [item.quantity, item.product_id]
                );
            }

            stockRestored = true;
        }

        // Cập nhật trạng thái đơn hàng.
        await connection.execute(
            `UPDATE orders
             SET status = ?
             WHERE id = ?`,
            [status, orderId]
        );

        await connection.commit();
        transactionStarted = false;

        return res.json({
            message: status === "cancelled"
                ? "Hủy đơn hàng thành công. Tồn kho đã được hoàn lại."
                : "Cập nhật trạng thái đơn hàng thành công.",
            order_id: orderId,
            old_status: oldStatus,
            status,
            stock_restored: stockRestored
        });

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("ROLLBACK UPDATE ORDER ERROR:", rollbackError);
            }
        }

        console.error("UPDATE ORDER STATUS ERROR:", error);

        return res.status(500).json({
            error: "Không thể cập nhật trạng thái đơn hàng."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;