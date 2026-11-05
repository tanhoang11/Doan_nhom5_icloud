
document.addEventListener("DOMContentLoaded", () => {
    renderCart();

    document.getElementById("checkout-form")
        .addEventListener("submit", submitOrder);
});

function getCart() {
    return Foodie.getCart();
}

function saveCart(cart) {
    localStorage.setItem("foodie_cart", JSON.stringify(cart));
    Foodie.updateCartCount();
}

function formatPrice(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " đ";
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
}

function renderCart() {
    const container = document.getElementById("cart-items");
    const cart = getCart();

    container.replaceChildren();

    if (cart.length === 0) {
        const empty = createElement(
            "div",
            "cart-empty",
            "Giỏ hàng của bạn đang trống."
        );

        const link = createElement("a", "", "Khám phá thực đơn");
        link.href = "/index.html";

        empty.appendChild(link);
        container.appendChild(empty);

        document.getElementById("checkout-section").style.display = "none";

        updateSummary([]);
        return;
    }

    document.getElementById("checkout-section").style.display = "block";

    cart.forEach(item => {
        const card = createElement("article", "cart-item");

        const image = document.createElement("img");
        image.className = "cart-item-image";
        image.alt = item.name || "Món ăn Foodie";
        image.loading = "lazy";

        if (item.image) {
            image.src = item.image;
            image.onerror = () => {
                image.removeAttribute("src");
                image.alt = "🍽️";
            };
        } else {
            image.alt = "🍽️";
        }

        const info = createElement("div", "cart-item-info");

        const name = createElement("h3", "", item.name || "Món ăn");
        const price = createElement(
            "div",
            "cart-item-price",
            formatPrice(item.price)
        );

        const stock = createElement(
            "span",
            "cart-item-stock",
            `Tồn kho hiển thị: ${Number(item.stock || 0)}`
        );

        const quantityControl = createElement("div", "quantity-control");

        const decrease = createElement("button", "", "−");
        decrease.type = "button";
        decrease.setAttribute("aria-label", "Giảm số lượng");
        decrease.disabled = Number(item.quantity) <= 1;

        decrease.addEventListener("click", () => {
            changeQuantity(item.id, -1);
        });

        const quantity = createElement(
            "span",
            "",
            String(item.quantity)
        );

        const increase = createElement("button", "", "+");
        increase.type = "button";
        increase.setAttribute("aria-label", "Tăng số lượng");
        increase.disabled =
            Number(item.quantity) >= Number(item.stock || 0);

        increase.addEventListener("click", () => {
            changeQuantity(item.id, 1);
        });

        quantityControl.append(decrease, quantity, increase);

        info.append(name, price, stock, quantityControl);

        const actions = createElement("div", "cart-item-actions");

        const subtotal = createElement(
            "strong",
            "cart-item-subtotal",
            formatPrice(Number(item.price) * Number(item.quantity))
        );

        const remove = createElement(
            "button",
            "remove-item",
            "Xóa món"
        );

        remove.type = "button";

        remove.addEventListener("click", () => {
            removeItem(item.id);
        });

        actions.append(subtotal, remove);
        card.append(image, info, actions);

        container.appendChild(card);
    });

    updateSummary(cart);
}

function changeQuantity(productId, amount) {
    const cart = getCart();

    const item = cart.find(
        product => String(product.id) === String(productId)
    );

    if (!item) return;

    const newQuantity = Number(item.quantity) + amount;
    const stock = Number(item.stock || 0);

    if (newQuantity < 1) return;

    if (newQuantity > stock) {
        alert(`Món này chỉ còn ${stock} sản phẩm.`);
        return;
    }

    item.quantity = newQuantity;

    saveCart(cart);
    renderCart();
}

function removeItem(productId) {
    const confirmed = confirm("Bạn có chắc muốn xóa món này khỏi giỏ hàng?");

    if (!confirmed) return;

    const cart = getCart().filter(
        item => String(item.id) !== String(productId)
    );

    saveCart(cart);
    renderCart();
}

function updateSummary(cart) {
    const count = cart.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
    );

    const subtotal = cart.reduce(
        (total, item) =>
            total + Number(item.price || 0) * Number(item.quantity || 0),
        0
    );

    document.getElementById("summary-count").textContent = count;
    document.getElementById("summary-subtotal").textContent =
        formatPrice(subtotal);
    document.getElementById("summary-total").textContent =
        formatPrice(subtotal);
}

async function submitOrder(event) {
    event.preventDefault();

    const cart = getCart();
    const message = document.getElementById("checkout-message");
    const button = document.getElementById("checkout-button");

    message.textContent = "";
    message.className = "checkout-message";

    if (cart.length === 0) {
        message.textContent = "Giỏ hàng đang trống.";
        message.classList.add("error");
        return;
    }

    const customerName =
        document.getElementById("customer-name").value.trim();

    const phone =
        document.getElementById("customer-phone").value.trim();

    const address =
        document.getElementById("customer-address").value.trim();

    const note =
        document.getElementById("order-note").value.trim();

    if (!customerName || !phone || !address) {
        message.textContent = "Vui lòng nhập đầy đủ thông tin giao hàng.";
        message.classList.add("error");
        return;
    }

    const orderData = {
        customer_name: customerName,
        phone: phone,
        address: address,
        note: note,
        items: cart.map(item => ({
            product_id: item.id,
            quantity: Number(item.quantity)
        }))
    };

    button.disabled = true;
    button.textContent = "Đang xử lý đơn hàng...";

    try {
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(orderData)
        });

        const result = await response.json().catch(() => ({}));

        if (response.status === 401) {
            message.textContent =
                "Bạn cần đăng nhập trước khi đặt hàng. Đang chuyển đến trang đăng nhập...";
            message.classList.add("error");

            setTimeout(() => {
                window.location.href = "/login";
            }, 1200);

            return;
        }

        if (!response.ok) {
            throw new Error(
                result.error || result.message || "Không thể đặt hàng."
            );
        }

        localStorage.removeItem("foodie_cart");
        Foodie.updateCartCount();

        const orderId = result.orderId || result.id;

        message.textContent = orderId
            ? `Đặt hàng thành công! Mã đơn hàng: #${orderId}`
            : "Đặt hàng thành công! Foodie sẽ sớm liên hệ với bạn.";

        message.classList.add("success");

        renderCart();

        document.getElementById("checkout-form").reset();

        document.getElementById("checkout-section").style.display = "none";

    } catch (error) {
        console.error("Lỗi đặt hàng:", error);

        message.textContent = error.message ||
            "Có lỗi xảy ra khi đặt hàng. Vui lòng thử lại.";

        message.classList.add("error");

    } finally {
        button.disabled = false;
        button.textContent = "Đặt hàng ngay";
    }
}
