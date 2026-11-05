
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    setupPasswordToggles();

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
    }
});

function setupPasswordToggles() {
    document.querySelectorAll(".toggle-password").forEach(button => {
        button.addEventListener("click", () => {
            const inputId = button.dataset.target;
            const input = document.getElementById(inputId);

            if (!input) return;

            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            button.textContent = isPassword ? "Ẩn" : "Hiện";
        });
    });
}

function showAuthMessage(message, type = "error") {
    const element = document.getElementById("auth-message");

    if (!element) return;

    element.textContent = message;
    element.className = `auth-message show ${type}`;
}

async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        showAuthMessage("Vui lòng nhập đầy đủ email và mật khẩu.");
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAuthMessage("Email không đúng định dạng.");
        return;
    }

    button.disabled = true;
    button.textContent = "Đang đăng nhập...";

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Đăng nhập thất bại.");
        }

        showAuthMessage("Đăng nhập thành công!", "success");

        setTimeout(() => {
            if (result.role === "admin") {
                window.location.href = "/admin";
            } else {
                window.location.href = "/";
            }
        }, 500);

    } catch (error) {
        showAuthMessage(error.message || "Không thể kết nối máy chủ.");
        button.disabled = false;
        button.textContent = "Đăng nhập";
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!email || !password || !confirmPassword) {
        showAuthMessage("Vui lòng nhập đầy đủ thông tin.");
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAuthMessage("Email không đúng định dạng.");
        return;
    }

    if (password.length < 6) {
        showAuthMessage("Mật khẩu cần có ít nhất 6 ký tự.");
        return;
    }

    if (password !== confirmPassword) {
        showAuthMessage("Mật khẩu xác nhận không khớp.");
        return;
    }

    button.disabled = true;
    button.textContent = "Đang tạo tài khoản...";

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Đăng ký thất bại.");
        }

        showAuthMessage(
            "Đăng ký thành công! Đang chuyển đến đăng nhập...",
            "success"
        );

        form.reset();

        setTimeout(() => {
            window.location.href = "/login";
        }, 1200);

    } catch (error) {
        showAuthMessage(error.message || "Không thể kết nối máy chủ.");
        button.disabled = false;
        button.textContent = "Tạo tài khoản";
    }
}
