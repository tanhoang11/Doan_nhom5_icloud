const API = {
  me: "/api/auth/me",
  logout: "/api/auth/logout",
  products: "/api/products",
  users: "/api/users",
  orders: "/api/orders",
};

let currentAdmin = null;
let productPage = 1;
const productLimit = 10;
let productTotalPages = 1;

let allOrders = [];
let currentOrderId = null;

const ORDER_STATUSES = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  shipping: "Đang giao hàng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

document.addEventListener("DOMContentLoaded", async () => {
  bindAdminEvents();

  const authorized = await checkAdmin();

  if (!authorized) return;

  await loadDashboard();
  await loadProducts();
  await loadUsers();
});

// -------------------------------
// API HELPER
// -------------------------------

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : {};

  if (!response.ok) {
    throw new Error(data.error || "Có lỗi xảy ra khi xử lý yêu cầu.");
  }

  return data;
}

// -------------------------------
// AUTHENTICATION
// -------------------------------

async function checkAdmin() {
  try {
    const user = await apiRequest(API.me);

    if (user.role !== "admin") {
      alert("Bạn không có quyền truy cập trang quản trị.");
      window.location.replace("/");
      return false;
    }

    currentAdmin = user;

    document.getElementById("admin-email").textContent = user.email;
    document.getElementById("admin-avatar").textContent = (user.email || "A")
      .charAt(0)
      .toUpperCase();

    return true;
  } catch (error) {
    console.error("Admin authentication:", error);

    alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
    window.location.replace("/login");

    return false;
  }
}

async function logoutAdmin() {
  try {
    await apiRequest(API.logout, {
      method: "POST",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  window.location.replace("/login");
}

// -------------------------------
// EVENTS
// -------------------------------

function bindAdminEvents() {
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      showSection(button.dataset.section);
    });
  });

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      showSection(button.dataset.go);
    });
  });

  document
    .getElementById("sidebar-logout")
    .addEventListener("click", logoutAdmin);

  document
    .getElementById("add-product-button")
    .addEventListener("click", openAddProductModal);

  document
    .getElementById("close-product-modal")
    .addEventListener("click", closeProductModal);

  document
    .getElementById("cancel-product")
    .addEventListener("click", closeProductModal);

  document
    .getElementById("close-user-modal")
    .addEventListener("click", closeUserModal);

  document
    .getElementById("cancel-user")
    .addEventListener("click", closeUserModal);

  document
    .getElementById("product-form")
    .addEventListener("submit", saveProduct);

  document.getElementById("user-form").addEventListener("submit", saveUser);

  document
    .getElementById("product-filter-button")
    .addEventListener("click", () => {
      productPage = 1;
      loadProducts();
    });

  document
    .getElementById("product-search")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        productPage = 1;
        loadProducts();
      }
    });
  // ORDER EVENTS

  document
    .getElementById("refresh-orders-button")
    .addEventListener("click", loadOrders);

  document
    .getElementById("filter-orders-button")
    .addEventListener("click", renderOrderTable);

  document
    .getElementById("order-status-filter")
    .addEventListener("change", renderOrderTable);

  document
    .getElementById("order-search")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        renderOrderTable();
      }
    });

  document
    .getElementById("close-order-modal")
    .addEventListener("click", closeOrderModal);

  document
    .getElementById("update-order-status-button")
    .addEventListener("click", updateOrderStatus);

  document.getElementById("order-modal").addEventListener("click", (event) => {
    if (event.target.id === "order-modal") {
      closeOrderModal();
    }
  });
}

// -------------------------------
// SECTION NAVIGATION
// -------------------------------

function showSection(section) {
    const selected = document.getElementById(`section-${section}`);

    if (!selected) {
        console.error(`Không tìm thấy section-${section}`);
        return;
    }

    // Ẩn tất cả các section
    document.querySelectorAll(".admin-main > .admin-section")
        .forEach(item => {
            item.classList.remove("active");
        });

    // Hiển thị section được chọn
    selected.classList.add("active");

    // Cập nhật sidebar
    document.querySelectorAll("[data-section]").forEach(item => {
        item.classList.toggle(
            "active",
            item.dataset.section === section
        );
    });

    // Cập nhật tiêu đề
    const titles = {
        dashboard: "Tổng quan",
        products: "Quản lý sản phẩm",
        users: "Quản lý người dùng",
        orders: "Quản lý đơn hàng"
    };

    document.getElementById("page-title").textContent =
        titles[section] || "Foodie Admin";

    // Tải dữ liệu tương ứng
    switch (section) {
        case "dashboard":
            loadDashboard();
            break;

        case "products":
            loadProducts();
            break;

        case "users":
            loadUsers();
            break;

        case "orders":
            loadOrders();
            break;
    }
}

// -------------------------------
// NOTIFICATION
// -------------------------------

function showNotice(message, type = "success") {
  const element = document.getElementById("admin-notice");

  element.textContent = message;
  element.className = `admin-notice show ${type}`;

  window.clearTimeout(showNotice.timeout);

  showNotice.timeout = window.setTimeout(() => {
    element.className = "admin-notice";
  }, 3500);
}

// -------------------------------
// FORMAT
// -------------------------------

function formatPrice(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " đ";
}

function createCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text ?? "";
  return cell;
}

// -------------------------------
// DASHBOARD
// -------------------------------

async function getAllProducts() {
  const allProducts = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await apiRequest(`${API.products}?page=${page}&limit=100`);

    allProducts.push(...(result.data || []));
    totalPages = result.totalPages || 1;
    page++;
  } while (page <= totalPages);

  return allProducts;
}

async function loadDashboard() {
  try {
    const [products, users] = await Promise.all([
      getAllProducts(),
      apiRequest(API.users),
    ]);

    document.getElementById("stat-products").textContent = products.length;

    document.getElementById("stat-users").textContent = users.length;

    document.getElementById("stat-out-stock").textContent = products.filter(
      (product) => Number(product.stock || 0) <= 0,
    ).length;

    const latest = [...products]
      .sort((a, b) => Number(b.id) - Number(a.id))
      .slice(0, 5);

    renderDashboardProducts(latest);
  } catch (error) {
    console.error("Dashboard error:", error);
    showNotice(error.message, "error");
  }
}

function renderDashboardProducts(products) {
  const body = document.getElementById("dashboard-products");
  body.replaceChildren();

  if (!products.length) {
    const row = document.createElement("tr");
    const cell = createCell("Chưa có sản phẩm nào.");
    cell.colSpan = 3;
    cell.className = "admin-empty";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  products.forEach((product) => {
    const row = document.createElement("tr");

    row.appendChild(createCell(product.name));
    row.appendChild(createCell(formatPrice(product.price)));
    row.appendChild(createCell(product.stock ?? 0));

    body.appendChild(row);
  });
}

// -------------------------------
// PRODUCTS
// -------------------------------

async function loadProducts() {
  const body = document.getElementById("product-table-body");

  body.replaceChildren();

  const loadingRow = document.createElement("tr");
  const loadingCell = createCell("Đang tải sản phẩm...");
  loadingCell.colSpan = 4;
  loadingCell.className = "admin-empty";
  loadingRow.appendChild(loadingCell);
  body.appendChild(loadingRow);

  const search = document.getElementById("product-search").value.trim();
  const minPrice = document.getElementById("product-min-price").value;
  const maxPrice = document.getElementById("product-max-price").value;

  if (
    (minPrice !== "" && Number(minPrice) < 0) ||
    (maxPrice !== "" && Number(maxPrice) < 0) ||
    (minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice))
  ) {
    showNotice("Khoảng giá không hợp lệ.", "error");
    body.replaceChildren();
    return;
  }

  const params = new URLSearchParams({
    q: search,
    page: productPage,
    limit: productLimit,
  });

  if (minPrice !== "") params.set("minPrice", minPrice);
  if (maxPrice !== "") params.set("maxPrice", maxPrice);

  try {
    const result = await apiRequest(`${API.products}?${params.toString()}`);

    productTotalPages = result.totalPages || 1;

    renderProductTable(result.data || []);
    renderProductPagination();
  } catch (error) {
    console.error(error);
    body.replaceChildren();

    const row = document.createElement("tr");
    const cell = createCell(error.message);
    cell.colSpan = 4;
    cell.className = "admin-empty";

    row.appendChild(cell);
    body.appendChild(row);
  }
}

function renderProductTable(products) {
  const body = document.getElementById("product-table-body");
  body.replaceChildren();

  if (!products.length) {
    const row = document.createElement("tr");
    const cell = createCell("Không tìm thấy sản phẩm.");
    cell.colSpan = 4;
    cell.className = "admin-empty";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  products.forEach((product) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const productInfo = document.createElement("div");
    productInfo.className = "admin-product";

    const imageBox = document.createElement("div");
    imageBox.className = "admin-product-image";

    if (product.image) {
      const img = document.createElement("img");
      img.src = product.image;
      img.alt = product.name || "Sản phẩm";
      img.loading = "lazy";

      img.onerror = () => {
        imageBox.textContent = "🍽️";
      };

      imageBox.appendChild(img);
    } else {
      imageBox.textContent = "🍽️";
    }

    const name = document.createElement("span");
    name.className = "admin-product-name";
    name.textContent = product.name || "Sản phẩm";

    productInfo.append(imageBox, name);
    nameCell.appendChild(productInfo);

    const priceCell = createCell(formatPrice(product.price));

    const stockCell = document.createElement("td");
    const stockBadge = document.createElement("span");
    const stock = Number(product.stock || 0);

    stockBadge.className = stock > 0 ? "admin-badge" : "admin-badge out-stock";

    stockBadge.textContent = stock > 0 ? `${stock} sản phẩm` : "Hết hàng";

    stockCell.appendChild(stockBadge);

    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "admin-actions";

    const editButton = document.createElement("button");
    editButton.className = "admin-btn small";
    editButton.textContent = "Sửa";
    editButton.addEventListener("click", () => {
      openEditProductModal(product.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "admin-btn danger small";
    deleteButton.textContent = "Xóa";
    deleteButton.addEventListener("click", () => {
      deleteProduct(product.id, product.name);
    });

    actions.append(editButton, deleteButton);
    actionCell.appendChild(actions);

    row.append(nameCell, priceCell, stockCell, actionCell);
    body.appendChild(row);
  });
}

function renderProductPagination() {
  const container = document.getElementById("product-pagination");
  container.replaceChildren();

  if (productTotalPages <= 1) return;

  const previous = document.createElement("button");
  previous.textContent = "‹";
  previous.disabled = productPage <= 1;

  previous.addEventListener("click", () => {
    if (productPage > 1) {
      productPage--;
      loadProducts();
    }
  });

  container.appendChild(previous);

  for (let page = 1; page <= productTotalPages; page++) {
    const button = document.createElement("button");
    button.textContent = page;

    if (page === productPage) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      productPage = page;
      loadProducts();
    });

    container.appendChild(button);
  }

  const next = document.createElement("button");
  next.textContent = "›";
  next.disabled = productPage >= productTotalPages;

  next.addEventListener("click", () => {
    if (productPage < productTotalPages) {
      productPage++;
      loadProducts();
    }
  });

  container.appendChild(next);
}

// -------------------------------
// PRODUCT MODAL
// -------------------------------

function openAddProductModal() {
  document.getElementById("product-form").reset();
  document.getElementById("product-id").value = "";

  document.getElementById("product-modal-title").textContent =
    "Thêm sản phẩm mới";

  document.getElementById("save-product").textContent = "Thêm sản phẩm";

  document.getElementById("product-modal").classList.add("show");
}

async function openEditProductModal(id) {
  try {
    const product = await apiRequest(`${API.products}/${id}`);

    document.getElementById("product-id").value = product.id;
    document.getElementById("product-name").value = product.name || "";
    document.getElementById("product-description").value =
      product.description || "";
    document.getElementById("product-price").value = product.price ?? 0;
    document.getElementById("product-stock").value = product.stock ?? 0;
    document.getElementById("product-image").value = product.image || "";

    document.getElementById("product-modal-title").textContent =
      "Cập nhật sản phẩm";

    document.getElementById("save-product").textContent = "Lưu thay đổi";

    document.getElementById("product-modal").classList.add("show");
  } catch (error) {
    showNotice(error.message, "error");
  }
}

function closeProductModal() {
  document.getElementById("product-modal").classList.remove("show");
}

async function saveProduct(event) {
  event.preventDefault();

  const id = document.getElementById("product-id").value;

  const product = {
    name: document.getElementById("product-name").value.trim(),
    description: document.getElementById("product-description").value.trim(),
    price: Number(document.getElementById("product-price").value),
    stock: Number(document.getElementById("product-stock").value),
    image: document.getElementById("product-image").value.trim(),
  };

  if (!product.name) {
    showNotice("Vui lòng nhập tên sản phẩm.", "error");
    return;
  }

  if (!Number.isFinite(product.price) || product.price < 0) {
    showNotice("Giá sản phẩm không hợp lệ.", "error");
    return;
  }

  if (!Number.isInteger(product.stock) || product.stock < 0) {
    showNotice("Số lượng tồn kho không hợp lệ.", "error");
    return;
  }

  const button = document.getElementById("save-product");
  button.disabled = true;

  try {
    if (id) {
      await apiRequest(`${API.products}/${id}`, {
        method: "PUT",
        body: JSON.stringify(product),
      });

      showNotice("Cập nhật sản phẩm thành công.");
    } else {
      await apiRequest(API.products, {
        method: "POST",
        body: JSON.stringify(product),
      });

      showNotice("Thêm sản phẩm thành công.");
    }

    closeProductModal();
    productPage = 1;

    await loadProducts();
    await loadDashboard();
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function deleteProduct(id, name) {
  const confirmed = confirm(
    `Bạn có chắc chắn muốn xóa sản phẩm "${name}" không?`,
  );

  if (!confirmed) return;

  try {
    await apiRequest(`${API.products}/${id}`, {
      method: "DELETE",
    });

    showNotice("Xóa sản phẩm thành công.");

    await loadProducts();
    await loadDashboard();
  } catch (error) {
    showNotice(error.message, "error");
  }
}

// -------------------------------
// USERS
// -------------------------------

async function loadUsers() {
  const body = document.getElementById("user-table-body");

  body.replaceChildren();

  try {
    const users = await apiRequest(API.users);

    users.forEach((user) => {
      const row = document.createElement("tr");

      const idCell = createCell(user.id);
      const emailCell = createCell(user.email);

      const roleCell = document.createElement("td");
      const roleBadge = document.createElement("span");

      roleBadge.className =
        user.role === "admin" ? "admin-badge admin-role" : "admin-badge";

      roleBadge.textContent = user.role;
      roleCell.appendChild(roleBadge);

      const actionCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "admin-actions";

      const editButton = document.createElement("button");
      editButton.className = "admin-btn small";
      editButton.textContent = "Sửa";
      editButton.addEventListener("click", () => {
        openEditUserModal(user);
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "admin-btn danger small";
      deleteButton.textContent = "Xóa";

      if (Number(user.id) === Number(currentAdmin.id)) {
        deleteButton.disabled = true;
        deleteButton.title = "Không thể xóa tài khoản đang đăng nhập";
      } else {
        deleteButton.addEventListener("click", () => {
          deleteUser(user.id, user.email);
        });
      }

      actions.append(editButton, deleteButton);
      actionCell.appendChild(actions);

      row.append(idCell, emailCell, roleCell, actionCell);
      body.appendChild(row);
    });

    if (!users.length) {
      const row = document.createElement("tr");
      const cell = createCell("Chưa có người dùng.");
      cell.colSpan = 4;
      cell.className = "admin-empty";
      row.appendChild(cell);
      body.appendChild(row);
    }
  } catch (error) {
    console.error(error);

    const row = document.createElement("tr");
    const cell = createCell(error.message);
    cell.colSpan = 4;
    cell.className = "admin-empty";

    row.appendChild(cell);
    body.appendChild(row);
  }
}

function openEditUserModal(user) {
  document.getElementById("user-id").value = user.id;
  document.getElementById("user-email").value = user.email;
  document.getElementById("user-role").value = user.role;

  document.getElementById("user-modal").classList.add("show");
}

function closeUserModal() {
  document.getElementById("user-modal").classList.remove("show");
}

async function saveUser(event) {
  event.preventDefault();

  const id = document.getElementById("user-id").value;
  const email = document.getElementById("user-email").value.trim();
  const role = document.getElementById("user-role").value;

  if (!email) {
    showNotice("Vui lòng nhập email.", "error");
    return;
  }

  if (Number(id) === Number(currentAdmin.id) && role !== "admin") {
    showNotice(
      "Không thể tự hạ quyền tài khoản admin đang đăng nhập.",
      "error",
    );
    return;
  }

  try {
    await apiRequest(`${API.users}/${id}`, {
      method: "PUT",
      body: JSON.stringify({ email, role }),
    });

    closeUserModal();
    showNotice("Cập nhật người dùng thành công.");

    await loadUsers();
  } catch (error) {
    showNotice(error.message, "error");
  }
}

async function deleteUser(id, email) {
  const confirmed = confirm(
    `Bạn có chắc chắn muốn xóa tài khoản ${email} không?`,
  );

  if (!confirmed) return;

  try {
    await apiRequest(`${API.users}/${id}`, {
      method: "DELETE",
    });

    showNotice("Xóa người dùng thành công.");

    await loadUsers();
    await loadDashboard();
  } catch (error) {
    showNotice(error.message, "error");
  }
}

// ============================================
// ORDER MANAGEMENT
// ============================================

// Lấy danh sách đơn hàng từ backend
async function loadOrders() {
    const body = document.getElementById("order-table-body");

    body.replaceChildren();

    const loadingRow = document.createElement("tr");
    const loadingCell = createCell("Đang tải đơn hàng...");
    loadingCell.colSpan = 7;
    loadingCell.className = "admin-empty";
    loadingRow.appendChild(loadingCell);
    body.appendChild(loadingRow);

    try {
        const result = await apiRequest(API.orders);

        // Hỗ trợ một số dạng dữ liệu trả về phổ biến
        allOrders = Array.isArray(result)
            ? result
            : Array.isArray(result.orders)
                ? result.orders
                : Array.isArray(result.data)
                    ? result.data
                    : [];

        renderOrderTable();

    } catch (error) {
        console.error("Load orders:", error);

        body.replaceChildren();

        const row = document.createElement("tr");
        const cell = createCell(error.message);
        cell.colSpan = 7;
        cell.className = "admin-empty";

        row.appendChild(cell);
        body.appendChild(row);

        showNotice(error.message, "error");
    }
}

// Ngày giờ
function formatOrderDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("vi-VN");
}

// Trạng thái đơn hàng
function getOrderStatusLabel(status) {
    return ORDER_STATUSES[status] || status || "Không xác định";
}

// Tạo badge trạng thái
function createOrderStatusBadge(status) {
    const badge = document.createElement("span");

    badge.className =
        `order-status-badge order-status-${status}`;

    badge.textContent = getOrderStatusLabel(status);

    return badge;
}

// Lọc và hiển thị danh sách đơn
function renderOrderTable() {
    const body = document.getElementById("order-table-body");
    const search = document.getElementById("order-search")
        .value.trim().toLowerCase();

    const selectedStatus =
        document.getElementById("order-status-filter").value;

    body.replaceChildren();

    const filteredOrders = allOrders.filter(order => {
        const matchesStatus =
            !selectedStatus || order.status === selectedStatus;

        const searchable = [
            order.id,
            order.customer_name,
            order.phone,
            order.address
        ].join(" ").toLowerCase();

        const matchesSearch =
            !search || searchable.includes(search);

        return matchesStatus && matchesSearch;
    });

    document.getElementById("order-result-count").textContent =
        `Hiển thị ${filteredOrders.length} / ${allOrders.length} đơn hàng`;

    if (!filteredOrders.length) {
        const row = document.createElement("tr");
        const cell = createCell("Không tìm thấy đơn hàng.");
        cell.colSpan = 7;
        cell.className = "admin-empty";

        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    // Đơn mới nhất hiển thị trước
    filteredOrders.sort((a, b) => Number(b.id) - Number(a.id));

    filteredOrders.forEach(order => {
        const row = document.createElement("tr");

        row.appendChild(createCell(`#${order.id}`));
        row.appendChild(createCell(order.customer_name || "-"));
        row.appendChild(createCell(order.phone || "-"));
        row.appendChild(createCell(formatOrderDate(order.created_at)));
        row.appendChild(createCell(formatPrice(order.total_amount)));

        const statusCell = document.createElement("td");
        statusCell.appendChild(createOrderStatusBadge(order.status));

        const actionCell = document.createElement("td");

        const detailButton = document.createElement("button");
        detailButton.type = "button";
        detailButton.className = "order-action-button";
        detailButton.textContent = "Chi tiết";

        detailButton.addEventListener("click", () => {
            openOrderDetail(order.id);
        });

        actionCell.appendChild(detailButton);

        row.append(
            statusCell,
            actionCell
        );

        body.appendChild(row);
    });
}

// Mở chi tiết đơn hàng
async function openOrderDetail(id) {
    try {
        const result = await apiRequest(`${API.orders}/${id}`);

        // Hỗ trợ backend trả về {order, items},
        // hoặc {id, ..., items}
        const order = result.order || result;
        const items = result.items || order.items || [];

        if (!order || !order.id) {
            throw new Error("Dữ liệu đơn hàng không hợp lệ.");
        }

        currentOrderId = order.id;

        document.getElementById("order-modal-code").textContent =
            `Mã đơn hàng: #${order.id}`;

        document.getElementById("detail-customer-name").textContent =
            order.customer_name || "-";

        document.getElementById("detail-customer-email").textContent =
            order.email || order.customer_email || "-";

        document.getElementById("detail-customer-phone").textContent =
            order.phone || "-";

        document.getElementById("detail-customer-address").textContent =
            order.address || "-";

        document.getElementById("detail-order-note").textContent =
            order.note || "Không có ghi chú.";

        document.getElementById("detail-order-total").textContent =
            formatPrice(order.total_amount);

        renderOrderItems(items);

        const statusSelect =
    document.getElementById("order-new-status");

const nextStatuses = getAllowedNextStatuses(order.status);

statusSelect.replaceChildren();

const currentOption = document.createElement("option");
currentOption.value = order.status;
currentOption.textContent =
    `${getOrderStatusLabel(order.status)} (Hiện tại)`;

statusSelect.appendChild(currentOption);

nextStatuses.forEach(status => {
    const option = document.createElement("option");

    option.value = status;
    option.textContent = getOrderStatusLabel(status);

    statusSelect.appendChild(option);
});

const terminal = nextStatuses.length === 0;

statusSelect.disabled = terminal;

document.getElementById("update-order-status-button").disabled =
    terminal;

document.getElementById("order-status-message").textContent =
    terminal
        ? "Đơn hàng đã kết thúc, không thể thay đổi trạng thái."
        : "Chọn trạng thái tiếp theo để cập nhật đơn hàng.";

        document.getElementById("order-modal").classList.add("show");

    } catch (error) {
        console.error("Order detail:", error);
        showNotice(error.message, "error");
    }
}

// Hiển thị danh sách món trong đơn
function renderOrderItems(items) {
    const body = document.getElementById("order-item-table-body");

    body.replaceChildren();

    if (!Array.isArray(items) || !items.length) {
        const row = document.createElement("tr");
        const cell = createCell("Không có thông tin món ăn.");
        cell.colSpan = 4;
        cell.className = "admin-empty";

        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    items.forEach(item => {
        const row = document.createElement("tr");

        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const subtotal = Number(
            item.subtotal ?? price * quantity
        );

        row.appendChild(
            createCell(item.product_name || item.name || "Món ăn")
        );

        row.appendChild(createCell(formatPrice(price)));
        row.appendChild(createCell(quantity));
        row.appendChild(createCell(formatPrice(subtotal)));

        body.appendChild(row);
    });
}

// Đóng popup
function closeOrderModal() {
    document.getElementById("order-modal").classList.remove("show");
    currentOrderId = null;
}

// Cập nhật trạng thái đơn hàng
// Cập nhật trạng thái đơn hàng
async function updateOrderStatus() {
    if (!currentOrderId) return;

    const statusSelect = document.getElementById("order-new-status");
    const newStatus = statusSelect.value;

    const currentOrder = allOrders.find(
        order => Number(order.id) === Number(currentOrderId)
    );

    if (!currentOrder) {
        showNotice("Không tìm thấy đơn hàng.", "error");
        return;
    }

    const allowedStatuses = getAllowedNextStatuses(currentOrder.status);

    if (!allowedStatuses.includes(newStatus)) {
        showNotice("Không thể chuyển sang trạng thái này.", "error");
        return;
    }

    const statusLabel = getOrderStatusLabel(newStatus);

    const confirmed = confirm(
        newStatus === "cancelled"
            ? `Bạn có chắc muốn hủy đơn hàng #${currentOrderId}?\nTồn kho của các món trong đơn sẽ được hoàn lại.`
            : `Xác nhận chuyển đơn hàng #${currentOrderId} sang "${statusLabel}"?`
    );

    if (!confirmed) return;

    const button = document.getElementById("update-order-status-button");
    const message = document.getElementById("order-status-message");

    button.disabled = true;
    button.textContent = "Đang cập nhật...";

    try {
        const updatedOrderId = currentOrderId;

        await apiRequest(`${API.orders}/${updatedOrderId}/status`, {
            method: "PUT",
            body: JSON.stringify({
                status: newStatus
            })
        });

        message.textContent = `Đã cập nhật trạng thái: ${statusLabel}`;
        message.style.color = "#198754";

        showNotice(
            newStatus === "cancelled"
                ? "Hủy đơn hàng thành công. Tồn kho đã được hoàn lại."
                : "Cập nhật trạng thái đơn hàng thành công."
        );

        await loadOrders();

        if (newStatus === "completed" || newStatus === "cancelled") {
            closeOrderModal();
        } else {
            await openOrderDetail(updatedOrderId);
        }

        await loadDashboard();

    } catch (error) {
        console.error("Update order status:", error);

        message.textContent = error.message;
        message.style.color = "#dc3545";

        showNotice(error.message, "error");

    } finally {
        button.textContent = "Cập nhật";

        if (currentOrderId) {
            const latestOrder = allOrders.find(
                order => Number(order.id) === Number(currentOrderId)
            );

            button.disabled = !latestOrder ||
                getAllowedNextStatuses(latestOrder.status).length === 0;
        }
    }
}

// Các trạng thái tiếp theo được phép
function getAllowedNextStatuses(currentStatus) {
    const transitions = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["preparing", "cancelled"],
        preparing: ["shipping", "cancelled"],
        shipping: ["completed", "cancelled"],
        completed: [],
        cancelled: []
    };

    return transitions[currentStatus] || [];
}