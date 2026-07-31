// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SetPassword from "./SetPassword";
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
      getUser: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("../contexts/ThemeContext", () => ({
  useThemePreference: () => ({ theme: "light" }),
}));

vi.mock("../hooks/useBranding", () => ({
  useResolvedBranding: () => ({
    data: {
      displayName: "EduManager Pro",
      logoUrl: null,
      faviconUrl: null,
      primaryColor: "#1e3a8a",
      secondaryColor: "#6ffbbe",
    },
    isLoading: false,
  }),
}));

describe("SetPassword", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("should block access if context is missing", async () => {
    render(
      <MemoryRouter>
        <SetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Convite inválido/i)).toBeDefined();
    });
  });

  it("should block access if context is corrupted/expired", async () => {
    sessionStorage.setItem(
      "invite_context",
      JSON.stringify({
        userId: "user-123",
        email: "test@example.com",
        verifiedAt: Date.now() - 11 * 60 * 1000, // 11 mins ago
        purpose: "invite",
      })
    );

    render(
      <MemoryRouter>
        <SetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Convite inválido/i)).toBeDefined();
    });
  });

  it("should block access if session identity does not match context", async () => {
    sessionStorage.setItem(
      "invite_context",
      JSON.stringify({
        userId: "user-123",
        email: "test@example.com",
        verifiedAt: Date.now(),
        purpose: "invite",
      })
    );

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "different-user", email: "hacker@example.com" } },
      error: null,
    });

    render(
      <MemoryRouter>
        <SetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Convite inválido/i)).toBeDefined();
    });
  });

  it("should render form and submit successfully", async () => {
    sessionStorage.setItem(
      "invite_context",
      JSON.stringify({
        userId: "user-123",
        email: "test@example.com",
        verifiedAt: Date.now(),
        purpose: "invite",
      })
    );

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    (supabase.auth.updateUser as any).mockResolvedValue({ error: null });
    (supabase.auth.signOut as any).mockResolvedValue({});

    render(
      <MemoryRouter>
        <SetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Defina sua senha/i)).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/Nova senha/i), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Confirme a senha/i), {
      target: { value: "StrongPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Definir senha e acessar/i }));

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: "StrongPass123!",
      });
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(screen.getByText("Sucesso")).toBeDefined();
      expect(sessionStorage.getItem("invite_context")).toBeNull();
    });
  });

  it("should explain when password is missing uppercase letter", async () => {
    sessionStorage.setItem(
      "invite_context",
      JSON.stringify({
        userId: "user-123",
        email: "test@example.com",
        verifiedAt: Date.now(),
        purpose: "invite",
      })
    );

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    render(
      <MemoryRouter>
        <SetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Defina sua senha/i)).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/Nova senha/i), {
      target: { value: "12345678p@" },
    });
    fireEvent.change(screen.getByLabelText(/Confirme a senha/i), {
      target: { value: "12345678p@" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Definir senha e acessar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/pelo menos uma letra maiuscula/i)
      ).toBeDefined();
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("should not expose internal update errors", async () => {
    sessionStorage.setItem(
      "invite_context",
      JSON.stringify({
        userId: "user-123",
        email: "test@example.com",
        verifiedAt: Date.now(),
        purpose: "invite",
      })
    );

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    (supabase.auth.updateUser as any).mockResolvedValue({
      error: { message: "postgres policy leaked detail" },
    });

    render(
      <MemoryRouter>
        <SetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Defina sua senha/i)).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/Nova senha/i), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Confirme a senha/i), {
      target: { value: "StrongPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Definir senha e acessar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(
        /Nao foi possivel definir a senha/i
      );
      expect(screen.queryByText(/postgres policy/i)).toBeNull();
    });
  });
});
