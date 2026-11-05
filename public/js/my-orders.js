const API_ORDERS = "/api/orders";

const ordersList = document.getElementById("orders-list");
const ordersMessage = document.getElementById("orders-message");
const orderDetail = document.getElementById("order-detail");
const detailOrderCode = document.getElementById("detail-order-code");
const orderDetailContent = document.getElementById("order-detail-content");

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("close-detail")
        ?.addEventListener("click", closeOrderDetail);

    await loadMyOrders();
});

// Gọi API
async function apiRequest(url) {
    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        }
    });

    let result = {};

    try {
        result = await response.json();
    } catch {
        result = {};
    }

    if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Bạn cần đăng nhập để xem đơn hàng.");
    }

    if (!response.ok) {
        throw new Error(
            result.error || result.message || "Không thể tải dữ liệu."
        );
    }

    return result;
}

// Định dạng tiền Việt Nam
function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " đ";
}

// Định dạng ngày tháng
function formatDate(value) {
    if (!value) return "Không xác định";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Không xác định";
    }

    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Trạng thái đơn hàng
function getStatusInfo(status) {
    const statuses = {
        pending: {
            label: "Chờ xác nhận",
            className: "status-pending"
        },
        confirmed: {
            label: "Đã xác nhận",
            className: "status-confirmed"
        },
        preparing: {
            label: "Đang chuẩn bị",
            className: "status-preparing"
        },
        shipping: {
            label: "Đang giao hàng",
            className: "status-shipping"
        },
        completed: {
            label: "Đã hoàn thành",
            className: "status-completed"
        },
        cancelled: {
            label: "Đã hủy",
            className: "status-cancelled"
        }
    };

    return statuses[status] || {
        label: status || "Không xác định",
        className: "status-pending"
    };
}

// Tải danh sách đơn hàng
async function loadMyOrders() {
    ordersMessage.style.display = "block";
    ordersMessage.classList.remove("orders-error");
    ordersMessage.textContent = "Đang tải danh sách đơn hàng...";

    ordersList.innerHTML = "";
    closeOrderDetail();

    try {
        const result = await apiRequest(`${API_ORDERS}/my`);

        // Backend hiện tại trả về một mảng đơn hàng trực tiếp.
        const orders = Array.isArray(result)
            ? result
            : (result.orders || result.data || []);

        ordersMessage.style.display = "none";

        if (!orders.length) {
            ordersList.innerHTML = `
                <div class="orders-empty">
                    <div class="empty-icon">🛒</div>
                    <h3>Bạn chưa có đơn hàng nào</h3>
                    <p>
                        Hãy khám phá thực đơn và đặt món ăn yêu thích
                        tại Foodie nhé!
                    </p>
                    <a href="/index.html" class="btn btn-primary">
                        Khám phá thực đơn
                    </a>
                </div>
            `;
            return;
        }

        renderOrders(orders);

    } catch (error) {
        console.error("Lỗi tải đơn hàng:", error);

        ordersMessage.style.display = "block";
        ordersMessage.classList.add("orders-error");
        ordersMessage.textContent = error.message;
    }
}

// Hiển thị danh sách
function renderOrders(orders) {
    ordersList.innerHTML = orders.map(order => {
        const status = getStatusInfo(order.status);

        return `
            <article class="order-card">
                <div class="order-card-header">
                    <div>
                        <div class="order-code">
                            Đơn hàng #${escapeHTML(order.id)}
                        </div>

                        <div class="order-date">
                            Ngày đặt: ${escapeHTML(formatDate(order.created_at))}
                        </div>
                    </div>

                    <span class="order-status ${status.className}">
                        ${status.label}
                    </span>
                </div>

                <div class="order-card-body">
                    <div class="order-info">
                        <span>
                            👤 Người nhận:
                            ${escapeHTML(order.customer_name)}
                        </span>

                        <span>
                            📞 Số điện thoại:
                            ${escapeHTML(order.phone)}
                        </span>
                    </div>

                    <div class="order-total">
                        ${formatMoney(order.total_amount)}
                    </div>
                </div>

                <div class="order-card-footer">
                    <button
                        class="order-detail-btn"
                        data-order-id="${escapeHTML(order.id)}">
                        Xem chi tiết →
                    </button>
                </div>
            </article>
        `;
    }).join("");

    ordersList.querySelectorAll(".order-detail-btn")
        .forEach(button => {
            button.addEventListener("click", () => {
                openOrderDetail(button.dataset.orderId);
            });
        });
}

// Xem chi tiết đơn hàng
async function openOrderDetail(orderId) {
    orderDetail.classList.remove("hidden");

    detailOrderCode.textContent = `Đơn hàng #${orderId}`;
    orderDetailContent.innerHTML = `
        <p>Đang tải chi tiết đơn hàng...</p>
    `;

    orderDetail.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {
        const result = await apiRequest(
            `${API_ORDERS}/my/${encodeURIComponent(orderId)}`
        );

        const order = result.order || result;
        const items = result.items || order.items || [];

        if (!order || !order.id) {
            throw new Error("Không tìm thấy đơn hàng.");
        }

        renderOrderDetail(order, items);

    } catch (error) {
        console.error("Lỗi tải chi tiết đơn hàng:", error);

        orderDetailContent.innerHTML = `
            <p class="orders-error">
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}

// Hiển thị chi tiết đơn hàng
function renderOrderDetail(order, items) {
    const status = getStatusInfo(order.status);

    const itemHTML = items.length
        ? items.map(item => {
            const quantity = Number(item.quantity || 0);
            const price = Number(item.price || 0);
            const subtotal = Number(
                item.subtotal || price * quantity
            );

            return `
                <div class="detail-item">
                    <div>
                        <div class="detail-item-name">
                            ${escapeHTML(item.product_name || item.name || "Món ăn")}
                        </div>

                        <div class="detail-item-quantity">
                            ${formatMoney(price)} × ${quantity}
                        </div>
                    </div>

                    <div class="detail-item-price">
                        ${formatMoney(subtotal)}
                    </div>
                </div>
            `;
        }).join("")
        : `<p>Không có thông tin món ăn.</p>`;

    detailOrderCode.textContent = `Đơn hàng #${order.id}`;

    orderDetailContent.innerHTML = `
        <div class="detail-information">
            <div>
                <strong>Người nhận</strong>
                <span>${escapeHTML(order.customer_name)}</span>
            </div>

            <div>
                <strong>Số điện thoại</strong>
                <span>${escapeHTML(order.phone)}</span>
            </div>

            <div>
                <strong>Địa chỉ nhận hàng</strong>
                <span>${escapeHTML(order.address)}</span>
            </div>

            <div>
                <strong>Ngày đặt hàng</strong>
                <span>${escapeHTML(formatDate(order.created_at))}</span>
            </div>

            <div>
                <strong>Trạng thái</strong>
                <span class="order-status ${status.className}">
                    ${status.label}
                </span>
            </div>

            <div>
                <strong>Ghi chú</strong>
                <span>${escapeHTML(order.note || "Không có")}</span>
            </div>
        </div>

        <h3 class="detail-items-title">Danh sách món ăn</h3>

        ${itemHTML}

        <div class="detail-total">
            <span>Tổng thanh toán</span>
            <span>${formatMoney(order.total_amount)}</span>
        </div>
    `;
}

// Đóng phần chi tiết
function closeOrderDetail() {
    if (!orderDetail) return;

    orderDetail.classList.add("hidden");
    orderDetailContent.innerHTML = "";
}

// Escape HTML để tránh chèn mã HTML không an toàn
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}