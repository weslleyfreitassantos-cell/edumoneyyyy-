// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AuthConfirm from "./AuthConfirm";
import { supabase } from "../lib/supabaseClient";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
      setSession: vi.fn(),
      verifyOtp: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

describe("AuthConfirm", () => {
  const mockNavigate = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
    sessionStorage.clear();

    delete window.location;
    // @ts-expect-error Override for tests
    window.location = { ...originalLocation, hash: '', pathname: '/auth/confirm', search: '' };

    // Mock replaceState
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    cleanup();
    // @ts-expect-error Restore original
    window.location = originalLocation;
  });

  it("should show error if tokens are missing", async () => {
    window.location.hash = "";

    render(
      <MemoryRouter>
        <AuthConfirm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Link de convite inválido ou ausente.")).toBeDefined();
    });
  });

  it("should show error if type is not invite", async () => {
    window.location.hash = "#access_token=123&refresh_token=456&type=recovery";

    render(
      <MemoryRouter>
        <AuthConfirm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Tipo de confirmação inválido.")).toBeDefined();
      expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/auth/confirm");
    });
  });

  it("should clear session and set new session with valid tokens", async () => {
    window.location.hash = "#access_token=acc123&refresh_token=ref456&type=invite";

    (supabase.auth.signOut as any).mockResolvedValue({});
    (supabase.auth.setSession as any).mockResolvedValue({ error: null });
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
      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: "acc123",
        refresh_token: "ref456",
      });
      expect(sessionStorage.getItem("invite_context")).toBeTruthy();
      expect(mockNavigate).toHaveBeenCalledWith("/set-password", { replace: true });
      expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/auth/confirm");
    });
  });

  it("should verify token_hash invite links", async () => {
    window.location.search = "?token_hash=hash123&type=invite";

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
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: "hash123",
        type: "invite",
      });
      expect(supabase.auth.setSession).not.toHaveBeenCalled();
      expect(sessionStorage.getItem("invite_context")).toBeTruthy();
      expect(mockNavigate).toHaveBeenCalledWith("/set-password", { replace: true });
      expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/auth/confirm");
    });
  });

  it("should handle token_hash verification error", async () => {
    window.location.search = "?token_hash=hash123&type=invite";

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
      expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/auth/confirm");
    });
  });

  it("should handle setSession error", async () => {
    window.location.hash = "#access_token=acc123&refresh_token=ref456&type=invite";

    (supabase.auth.signOut as any).mockResolvedValue({});
    (supabase.auth.setSession as any).mockResolvedValue({
      error: { message: "Token expired" },
    });

    render(
      <MemoryRouter>
        <AuthConfirm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Convite inválido, expirado ou já utilizado.")).toBeDefined();
      expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/auth/confirm");
    });
  });
});
