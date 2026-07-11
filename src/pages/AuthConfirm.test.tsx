// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, useNavigate, useSearchParams } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AuthConfirm from "./AuthConfirm";
import { supabase } from "../lib/supabaseClient";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
    useSearchParams: vi.fn(),
  };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
      verifyOtp: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

describe("AuthConfirm", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("should show error if token_hash is missing", async () => {
    (useSearchParams as any).mockReturnValue([new URLSearchParams()]);

    render(
      <MemoryRouter>
        <AuthConfirm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Link de convite inválido ou ausente.")).toBeDefined();
    });
  });

  it("should clear session and verify otp", async () => {
    (useSearchParams as any).mockReturnValue([
      new URLSearchParams("?token_hash=abc123&type=invite"),
    ]);

    (supabase.auth.signOut as any).mockResolvedValue({});
    (supabase.auth.verifyOtp as any).mockResolvedValue({ error: null });
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    render(
      <MemoryRouter>
        <AuthConfirm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: "abc123",
        type: "invite",
      });
      expect(sessionStorage.getItem("invite_context")).toBeTruthy();
      expect(mockNavigate).toHaveBeenCalledWith("/set-password", { replace: true });
    });
  });

  it("should handle verifyOtp error", async () => {
    (useSearchParams as any).mockReturnValue([
      new URLSearchParams("?token_hash=abc123&type=invite"),
    ]);

    (supabase.auth.signOut as any).mockResolvedValue({});
    (supabase.auth.verifyOtp as any).mockResolvedValue({
      error: { message: "Token expired" },
    });

    render(
      <MemoryRouter>
        <AuthConfirm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Convite inválido, expirado ou já utilizado.")).toBeDefined();
    });
  });
});
