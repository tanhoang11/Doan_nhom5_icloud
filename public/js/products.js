
let currentPage = 1;
const pageLimit = 9;

document.addEventListener("DOMContentLoaded", () => {
    loadProducts();

    document.getElementById("filter-button")
        .addEventListener("click", () => {
            currentPage = 1;
            loadProducts();
        });

    document.getElementById("search-input")
        .addEventListener("keydown", event => {
            if (event.key === "Enter") {
                currentPage = 1;
                loadProducts();
            }
        });
});

async function loadProducts() {
    const container = document.getElementById("product-list");
    const pagination = document.getElementById("pagination");

    container.innerHTML = `
        <div class="empty-state">Đang tải thực đơn...</div>
    `;

    pagination.replaceChildren();

    const search = document.getElementById("search-input").value.trim();
    const minPrice = document.getElementById("min-price").value;
    const maxPrice = document.getElementById("max-price").value;

    if (minPrice && Number(minPrice) < 0 ||
        maxPrice && Number(maxPrice) < 0) {
        alert("Giá không được nhỏ hơn 0.");
        return;
    }

    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
        alert("Giá thấp nhất không được lớn hơn giá cao nhất.");
        return;
    }

    const params = new URLSearchParams({
        q: search,
        page: currentPage,
        limit: pageLimit
    });

    if (minPrice !== "") params.set("minPrice", minPrice);
    if (maxPrice !== "") params.set("maxPrice", maxPrice);

    try {
        const response = await fetch("/api/products?" + params.toString());

        if (!response.ok) {
            throw new Error("Lỗi tải dữ liệu sản phẩm");
        }

        const result = await response.json();

        renderProducts(result.data || []);
        renderPagination(result.totalPages || 1);

        document.getElementById("result-count").textContent =
            `Tìm thấy ${result.total || 0} sản phẩm`;

    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <div class="empty-state">
                Không thể tải thực đơn. Vui lòng thử lại.
            </div>
        `;
    }
}

function renderProducts(products) {
    const container = document.getElementById("product-list");
    container.replaceChildren();

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                Không tìm thấy món ăn phù hợp.
            </div>
        `;
        return;
    }

    products.forEach(product => {
        const card = document.createElement("article");
        card.className = "product-card";

        const imageBox = document.createElement("div");
        imageBox.className = "product-image";

        if (product.image) {
            const image = document.createElement("img");
            image.src = product.image;
            image.alt = product.name || "Món ăn Foodie";
            image.loading = "lazy";

            image.onerror = () => {
                imageBox.textContent = "🍽️";
            };

            imageBox.appendChild(image);
        } else {
            imageBox.textContent = "🍽️";
        }

        const stock = Number(product.stock || 0);
        const stockLabel = document.createElement("span");

        stockLabel.className = stock > 0
            ? "product-stock"
            : "product-stock out";

        stockLabel.textContent = stock > 0
            ? `Còn ${stock}`
            : "Hết hàng";

        imageBox.appendChild(stockLabel);

        const info = document.createElement("div");
        info.className = "product-info";

        const name = document.createElement("h3");
        name.textContent = product.name || "Sản phẩm";

        const description = document.createElement("p");
        description.className = "product-description";
        description.textContent =
            product.description || "Món ăn hấp dẫn từ Foodie.";

        const bottom = document.createElement("div");
        bottom.className = "product-bottom";

        const price = document.createElement("span");
        price.className = "product-price";
        price.textContent = formatPrice(product.price);

        const addButton = document.createElement("button");
        addButton.className = "btn btn-primary";
        addButton.textContent = "Thêm vào giỏ";
        addButton.disabled = stock <= 0;

        if (stock <= 0) {
            addButton.textContent = "Hết hàng";
        }

        addButton.addEventListener("click", () => {
            Foodie.addToCart(product);
        });

        bottom.append(price, addButton);
        info.append(name, description, bottom);
        card.append(imageBox, info);

        container.appendChild(card);
    });
}

function renderPagination(totalPages) {
    const container = document.getElementById("pagination");
    container.replaceChildren();

    if (totalPages <= 1) return;

    const previous = document.createElement("button");
    previous.textContent = "‹";
    previous.disabled = currentPage <= 1;

    previous.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            loadProducts();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });

    container.appendChild(previous);

    for (let page = 1; page <= totalPages; page++) {
        const button = document.createElement("button");
        button.textContent = page;

        if (page === currentPage) {
            button.classList.add("active");
        }

        button.addEventListener("click", () => {
            currentPage = page;
            loadProducts();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });

        container.appendChild(button);
    }

    const next = document.createElement("button");
    next.textContent = "›";
    next.disabled = currentPage >= totalPages;

    next.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadProducts();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });

    container.appendChild(next);
}

function formatPrice(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " đ";
}
