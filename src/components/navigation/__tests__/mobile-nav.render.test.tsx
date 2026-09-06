import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MobileNav } from "../MobileNav";

let mockPathname = "/learn/system-design-fundamentals/scaling/client-server";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, className, ...rest }: any) => (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

describe("MobileNav (rendering in jsdom)", () => {
  let mediaQueryListeners: ((e: any) => void)[] = [];
  let matchesDesktop = false;

  beforeEach(() => {
    mockPathname = "/learn/system-design-fundamentals/scaling/client-server";
    mediaQueryListeners = [];
    matchesDesktop = false;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return matchesDesktop;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, cb: (e: any) => void) => {
        mediaQueryListeners.push(cb);
      }),
      removeEventListener: vi.fn((_event: string, cb: (e: any) => void) => {
        mediaQueryListeners = mediaQueryListeners.filter((l) => l !== cb);
      }),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
    document.body.innerHTML = "";
  });

  it("renders trigger button and starts closed", () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /navigation menu/i });
    expect(trigger).toBeDefined();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("mobile-nav-drawer")).toBeNull();
  });

  it("opens drawer upon click, locks body scroll, and sets focus on first focusable item", () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /navigation menu/i });

    act(() => {
      fireEvent.click(trigger);
    });

    const drawer = document.getElementById("mobile-nav-drawer");
    expect(drawer).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");

    // Drawer contains focusable items
    const focusables = drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusables && focusables.length > 0).toBe(true);
    expect(document.activeElement).toBe(focusables![0]);
  });

  it("closes on Escape, restores scroll lock and returns focus to trigger", async () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /navigation menu/i });

    act(() => {
      fireEvent.click(trigger);
    });
    expect(document.getElementById("mobile-nav-drawer")).not.toBeNull();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);

    await waitFor(() => {
      expect(document.getElementById("mobile-nav-drawer")).toBeNull();
    });
  });

  it("traps focus: wraps Tab from last to first, and Shift+Tab from first to last", () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /navigation menu/i });

    act(() => {
      fireEvent.click(trigger);
    });

    const drawer = document.getElementById("mobile-nav-drawer")!;
    const focusables = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // On last item, pressing Tab wraps to first
    last.focus();
    expect(document.activeElement).toBe(last);
    act(() => {
      fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    });
    expect(document.activeElement).toBe(first);

    // On first item, pressing Shift+Tab wraps to last
    first.focus();
    expect(document.activeElement).toBe(first);
    act(() => {
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    });
    expect(document.activeElement).toBe(last);
  });

  it("pulls focus back into panel if focus escapes outside panel", () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /navigation menu/i });

    act(() => {
      fireEvent.click(trigger);
    });

    const drawer = document.getElementById("mobile-nav-drawer")!;
    const focusables = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Create an outside focusable element to simulate focus escaping
    const outside = document.createElement("button");
    outside.tabIndex = 0;
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    // Pressing Tab pulls focus to first item
    act(() => {
      fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    });
    expect(document.activeElement).toBe(first);

    // Focus escapes again; Shift+Tab pulls focus to last item
    outside.focus();
    expect(document.activeElement).toBe(outside);
    act(() => {
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    });
    expect(document.activeElement).toBe(last);

    outside.remove();
  });

  it("closes when breakpoint matches desktop to prevent scroll lock outliving UI", async () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /navigation menu/i });

    act(() => {
      fireEvent.click(trigger);
    });
    expect(document.getElementById("mobile-nav-drawer")).not.toBeNull();

    // Trigger desktop media query match
    matchesDesktop = true;
    act(() => {
      for (const listener of mediaQueryListeners) {
        listener({ matches: true });
      }
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");

    await waitFor(() => {
      expect(document.getElementById("mobile-nav-drawer")).toBeNull();
    });
  });

  it("dismisses drawer upon route change", async () => {
    const { rerender } = render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: /navigation menu/i });

    act(() => {
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    mockPathname = "/learn/system-design-fundamentals/data/caching";
    rerender(<MobileNav />);

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => {
      expect(document.getElementById("mobile-nav-drawer")).toBeNull();
    });
  });
});
