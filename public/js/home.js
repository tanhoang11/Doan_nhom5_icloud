
document.addEventListener("DOMContentLoaded", () => {
    loadFeaturedProducts();
});

async function loadFeaturedProducts() {
    const container = document.getElementById("featured-products");

    try {
        const response = await fetch("/api/products?page=1&limit=3");

        if (!response.ok) {
            throw new Error("Không thể tải danh sách sản phẩm");
        }

        const result = await response.json();
        const products = result.data || [];

        container.replaceChildren();

        if (products.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    Hiện chưa có món ăn nào.
                </div>
            `;
            return;
        }

        products.forEach(product => {
            const card = document.createElement("article");
            card.className = "home-product-card";

            const imageBox = document.createElement("div");
            imageBox.className = "home-product-image";

            if (product.image) {
                const img = document.createElement("img");
                img.src = product.image;
                img.alt = product.name || "Món ăn Foodie";
                img.loading = "lazy";

                img.onerror = () => {
                    imageBox.textContent = "🍽️";
                };

                imageBox.appendChild(img);
            } else {
                imageBox.textContent = "🍽️";
            }

            const info = document.createElement("div");
            info.className = "home-product-info";

            const name = document.createElement("h3");
            name.textContent = product.name || "Sản phẩm";

            const description = document.createElement("p");
            description.textContent = product.description || "Món ăn hấp dẫn từ Foodie.";

            const bottom = document.createElement("div");
            bottom.className = "home-product-bottom";

            const price = document.createElement("span");
            price.className = "home-product-price";
            price.textContent = formatFoodiePrice(product.price);

            const button = document.createElement("button");
            button.className = "btn btn-primary";
            button.textContent = "Thêm +";

            button.disabled = Number(product.stock) <= 0;
            if (button.disabled) {
                button.textContent = "Hết hàng";
            }

            button.addEventListener("click", () => {
                Foodie.addToCart(product);
            });

            bottom.append(price, button);
            info.append(name, description, bottom);
            card.append(imageBox, info);

            container.appendChild(card);
        });

    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <div class="empty-state">
                Không thể tải món ăn. Vui lòng thử lại sau.
            </div>
        `;
    }
}

function formatFoodiePrice(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " đ";
}
