export default function renderVerificationPage(
  status: "success" | "error",
  message: string
): string {
  const isSuccess = status === "success";

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Email Verification</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        color: #e5e7eb;
      }
      .card {
        background: #020617;
        border-radius: 18px;
        padding: 32px 28px;
        max-width: 420px;
        width: 100%;
        box-shadow:
          0 20px 40px rgba(15, 23, 42, 0.7),
          0 0 0 1px rgba(148, 163, 184, 0.15);
        text-align: center;
      }
      .badge {
        width: 64px;
        height: 64px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        font-size: 32px;
        background: ${
          isSuccess ? "rgba(34, 197, 94, 0.15)" : "rgba(248, 113, 113, 0.15)"
        };
        color: ${isSuccess ? "#4ade80" : "#fca5a5"};
      }
      h1 {
        font-size: 1.6rem;
        font-weight: 650;
        margin-bottom: 10px;
      }
      p {
        font-size: 0.95rem;
        color: #cbd5f5;
        margin-bottom: 24px;
        line-height: 1.5;
      }
      .status-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        padding: 4px 10px;
        border-radius: 999px;
        margin-bottom: 10px;
        background: ${
          isSuccess ? "rgba(34, 197, 94, 0.1)" : "rgba(248, 113, 113, 0.1)"
        };
        color: ${isSuccess ? "#22c55e" : "#f97373"};
        border: 1px solid ${
          isSuccess ? "rgba(34, 197, 94, 0.35)" : "rgba(248, 113, 113, 0.35)"
        };
      }
      .button-row {
        display: flex;
        justify-content: center;
        gap: 12px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 18px;
        border-radius: 999px;
        font-size: 0.95rem;
        font-weight: 500;
        border: none;
        cursor: pointer;
        text-decoration: none;
        transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
      }
      .btn-primary {
        background: #6366f1;
        color: white;
        box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4);
      }
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 30px rgba(79, 70, 229, 0.5);
        background: #4f46e5;
      }
      .btn-secondary {
        background: transparent;
        color: #e5e7eb;
        border: 1px solid rgba(148, 163, 184, 0.5);
      }
      .btn-secondary:hover {
        background: rgba(15, 23, 42, 0.8);
      }
      .subtle {
        font-size: 0.8rem;
        color: #9ca3af;
        margin-top: 14px;
      }
      @media (max-width: 480px) {
        .card {
          margin: 16px;
          padding: 24px 18px;
        }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge">
        ${isSuccess ? "✓" : "!"}
      </div>

      <div class="status-label">
        <span style="font-size: 0.9rem;">${
          isSuccess ? "Verified" : "Verification Failed"
        }</span>
      </div>

      <h1>${isSuccess ? "Email verified 🎉" : "Email verification issue"}</h1>

      <p>${message}</p>

      <div class="button-row">
        <a href="${process.env.FRONTEND}/login" class="btn btn-primary">
          Go to Home
        </a>
      </div>

      <p class="subtle">
        If this wasn’t you, you can safely ignore this page.
      </p>
    </main>
  </body>
  </html>
  `;
}
