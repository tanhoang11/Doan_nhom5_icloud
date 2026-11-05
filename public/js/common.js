const Foodie = {
    async getCurrentUser() {
        try {
            const response = await fetch("/api/auth/me", {
                method: "GET",
                credentials: "include"
            });

            if (!response.ok) return null;

            const result = await response.json();
            return result.user || result;
        } catch (error) {
            console.error("Không thể kiểm tra đăng nhập:", error);
            return null;
        }
    },

    getCart() {
        try {
            return JSON.parse(localStorage.getItem("foodie_cart") || "[]");
        } catch {
            return [];
        }
    },

    getCartCount() {
        return this.getCart().reduce(
            (total, item) => total + Number(item.quantity || 0),
            0
        );
    },

    updateCartCount() {
        const count = this.getCartCount();

        document.querySelectorAll(".cart-count").forEach(element => {
            element.textContent = count;
        });
    },

    addToCart(product) {
        const cart = this.getCart();
        const productId = String(product.id);
        const stock = Number(product.stock || 0);

        if (stock <= 0) {
            alert("Món ăn này hiện đã hết hàng.");
            return;
        }

        const existing = cart.find(
            item => String(item.id) === productId
        );

        if (existing) {
            if (Number(existing.quantity) >= stock) {
                alert(`Chỉ còn ${stock} sản phẩm trong kho.`);
                return;
            }

            existing.quantity = Number(existing.quantity) + 1;
            existing.stock = stock;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: Number(product.price),
                image: product.image || "",
                quantity: 1,
                stock: stock
            });
        }

        localStorage.setItem("foodie_cart", JSON.stringify(cart));
        this.updateCartCount();

        alert("Đã thêm " + product.name + " vào giỏ hàng!");
    },

    async renderHeader(activePage = "") {
        const header = document.getElementById("site-header");
        if (!header) return;

        const user = await this.getCurrentUser();

        let accountActions = "";
        let orderNav = "";

        if (user) {
            if (user.role !== "admin") {
                orderNav = `
                    <a href="/my-orders.html"
                       class="${activePage === "my-orders" ? "active" : ""}">
                        Đơn hàng của tôi
                    </a>
                `;
            }

            accountActions = `
                <span class="header-user">
                    ${this.escapeHTML(user.email || user.fullName || "Tài khoản")}
                </span>

                ${user.role === "admin"
                    ? '<a class="btn btn-outline" href="/admin">Quản trị</a>'
                    : ""}

                <button class="btn btn-primary" id="logout-button">
                    Đăng xuất
                </button>
            `;
        } else {
            accountActions = `
                <a class="btn btn-outline" href="/login">Đăng nhập</a>
                <a class="btn btn-primary" href="/register">Đăng ký</a>
            `;
        }

        header.innerHTML = `
            <div class="container header-inner">
                <a class="brand" href="/">
                    <span class="brand-icon">🍔</span>
                    <span>Foodie<span class="text-primary">.</span></span>
                </a>

                <button class="mobile-menu-btn"
                        id="mobile-menu-button"
                        aria-label="Mở menu">
                    ☰
                </button>

                <nav class="main-nav" id="main-nav">
                    <a href="/"
                       class="${activePage === "home" ? "active" : ""}">
                        Trang chủ
                    </a>

                    <a href="/index.html"
                       class="${activePage === "products" ? "active" : ""}">
                        Thực đơn
                    </a>

                    ${orderNav}

                    <a href="/#about">Về Foodie</a>
                    <a href="/#contact">Liên hệ</a>
                </nav>

                <div class="header-actions">
                    <a href="/cart.html" class="cart-link">
                        🛒 <span class="cart-count">0</span>
                    </a>

                    ${accountActions}
                </div>
            </div>
        `;

        this.updateCartCount();

        document.getElementById("mobile-menu-button")
            ?.addEventListener("click", () => {
                document.getElementById("main-nav")
                    ?.classList.toggle("open");
            });

        document.getElementById("logout-button")
            ?.addEventListener("click", async () => {
                try {
                    const response = await fetch("/api/auth/logout", {
                        method: "POST",
                        credentials: "include"
                    });

                    if (response.ok) {
                        window.location.href = "/";
                    } else {
                        alert("Không thể đăng xuất. Vui lòng thử lại.");
                    }
                } catch (error) {
                    alert("Lỗi kết nối máy chủ.");
                }
            });
    },

    renderFooter() {
        const footer = document.getElementById("site-footer");
        if (!footer) return;

        footer.innerHTML = `
            <div class="container">
                <div class="footer-grid">
                    <div>
                        <div class="footer-brand">🍔 Foodie.</div>

                        <p class="footer-description">
                            Foodie mang đến những món ăn ngon,
                            chất lượng và tiện lợi cho mỗi ngày của bạn.
                        </p>
                    </div>

                    <div class="footer-column">
                        <h3>Khám phá</h3>
                        <a href="/">Trang chủ</a>
                        <a href="/index.html">Thực đơn</a>
                        <a href="/#about">Về chúng tôi</a>
                    </div>

                    <div class="footer-column">
                        <h3>Hỗ trợ</h3>
                        <a href="/login">Tài khoản</a>
                        <a href="/register">Đăng ký</a>
                        <a href="/my-orders.html">Đơn hàng của tôi</a>
                        <a href="/#contact">Liên hệ</a>
                    </div>

                    <div class="footer-column">
                        <h3>Liên hệ</h3>
                        <a href="mailto:foodie@example.com">
                            foodie@example.com
                        </a>
                        <a href="/#contact">Thông tin cửa hàng</a>
                    </div>
                </div>

                <div class="footer-bottom">
                    © ${new Date().getFullYear()} Foodie.
                    All rights reserved.
                </div>
            </div>
        `;
    },

    escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }
};

window.Foodie = Foodie;

document.addEventListener("DOMContentLoaded", () => {
    Foodie.renderHeader(document.body.dataset.page || "");
    Foodie.renderFooter();
});