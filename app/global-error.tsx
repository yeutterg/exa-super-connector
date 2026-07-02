"use client";

// Last-resort boundary (covers crashes in the root layout itself). Must
// render its own <html>/<body> per Next.js contract; plain inline styles
// because global CSS may not have loaded.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600 }}>Something went sideways</p>
        <p style={{ fontSize: 12, color: "#666" }}>
          Your sessions are safe — they live in this browser.
        </p>
        <button
          onClick={reset}
          style={{
            fontSize: 13,
            padding: "6px 14px",
            border: "1px solid #ccc",
            borderRadius: 6,
            cursor: "pointer",
            background: "transparent",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
