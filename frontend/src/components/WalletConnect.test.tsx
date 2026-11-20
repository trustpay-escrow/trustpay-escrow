import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WalletConnect from "./WalletConnect";

const mocks = vi.hoisted(() => ({
  wallet: { address: "G" + "A".repeat(55), activeRole: "client", walletName: "Freighter", setWalletInfo: vi.fn(), disconnect: vi.fn() },
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/store/walletStore", () => ({ useWalletStore: () => mocks.wallet }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
// Isolate address-copy behavior from the upstream faucet and balance requests.
vi.mock("@/components/TestnetFaucetModal", () => ({ TestnetFaucetModal: () => null }));
vi.mock("@/lib/friendbot", () => ({ isTestnetNetwork: () => false, fetchAccountBalances: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, info: vi.fn() } }));
vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(), requestAccess: vi.fn(), getNetworkDetails: vi.fn(), setAllowed: vi.fn(), signTransaction: vi.fn(),
}));

const address = "G" + "A".repeat(55);
// JSDOM does not track the browser's keyboard/pointer focus modality.
const mockFocusVisible = (button: HTMLElement, visible: boolean) => {
  const matches = Element.prototype.matches;
  vi.spyOn(button, "matches").mockImplementation((selector) =>
    selector === ":focus-visible" ? visible : matches.call(button, selector)
  );
};
const renderWallet = () => {
  const view = render(<WalletConnect />);
  return { ...view, button: screen.getByRole("button", { name: "Copy full Stellar address" }) };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.wallet.address = address;
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("WalletConnect address copy tooltip", () => {
  it("shows on hover and dismisses on mouseleave", () => {
    const { button } = renderWallet();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to copy full Stellar address");
    expect(button).toHaveAccessibleDescription("Click to copy full Stellar address");
    fireEvent.mouseLeave(button.parentElement!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("stays open when moving onto the tooltip content", () => {
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button, { relatedTarget: screen.getByRole("tooltip") });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("dismisses a hover-only tooltip with Escape without moving focus", () => {
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(button).not.toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).not.toHaveFocus();
    fireEvent.mouseLeave(button.parentElement!);
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("supports keyboard focus, retains the hint on mouseleave, and dismisses on Escape", () => {
    const { button } = renderWallet();
    mockFocusVisible(button, true);
    act(() => button.focus());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(button.parentElement!);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    act(() => button.blur());
    mockFocusVisible(button, true);
    act(() => button.focus());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    act(() => button.blur());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("copies the full address and only confirms after the clipboard promise succeeds", async () => {
    let resolveCopy!: () => void;
    vi.mocked(navigator.clipboard.writeText).mockReturnValue(new Promise<void>((resolve) => { resolveCopy = resolve; }));
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    fireEvent.click(button);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address);
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("Copied!");
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => resolveCopy());
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^Copied!$/);
    expect(button).toHaveTextContent("Copied! ✓");
    expect(screen.getByRole("status")).toHaveTextContent("Stellar address copied");
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it("reports clipboard rejection without claiming success", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    await act(async () => { fireEvent.click(button); });
    expect(mocks.error).toHaveBeenCalledWith("Unable to copy address. Please try again.");
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to copy full Stellar address");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("handles an unavailable clipboard API without throwing", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const { button } = renderWallet();
    await act(async () => { fireEvent.click(button); });
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("restarts the confirmation timeout on another successful copy", async () => {
    vi.useFakeTimers();
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    await act(async () => { fireEvent.click(button); });
    act(() => vi.advanceTimersByTime(1500));
    await act(async () => { fireEvent.click(button); });
    act(() => vi.advanceTimersByTime(1500));
    expect(button).toHaveTextContent("Copied! ✓");
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^Copied!$/);
    act(() => vi.advanceTimersByTime(500));
    expect(button).not.toHaveTextContent("Copied!");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows Copied in the tooltip, then dismisses automatically without losing keyboard focus", async () => {
    vi.useFakeTimers();
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    mockFocusVisible(button, true);
    act(() => button.focus());
    await act(async () => { fireEvent.click(button); });

    expect(button).toHaveFocus();
    expect(button).toHaveTextContent("Copied! ✓");
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^Copied!$/);
    expect(button).toHaveAccessibleDescription("Copied!");

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).not.toHaveTextContent("Copied!");

    fireEvent.mouseLeave(button.parentElement!);
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to copy full Stellar address");

    fireEvent.keyDown(button, { key: "Escape" });
    act(() => button.blur());
    act(() => button.focus());
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to copy full Stellar address");
  });

  it("dismisses a re-hovered hint on mouseleave after pointer-focused copying", async () => {
    const { button } = renderWallet();
    mockFocusVisible(button, false);
    fireEvent.mouseEnter(button);
    act(() => button.focus());
    await act(async () => { fireEvent.click(button); });
    fireEvent.mouseLeave(button.parentElement!);
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to copy full Stellar address");
    expect(button).not.toHaveTextContent("Copied!");

    fireEvent.mouseLeave(button.parentElement!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("does not let an old timeout hide the fresh hint after leaving copy feedback", async () => {
    vi.useFakeTimers();
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    await act(async () => { fireEvent.click(button); });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.mouseLeave(button.parentElement!);
    expect(button).not.toHaveTextContent("Copied!");
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to copy full Stellar address");
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to copy full Stellar address");
  });

  it("does not resurrect feedback when clipboard resolves after mouseleave and re-entry", async () => {
    let resolveCopy!: () => void;
    vi.mocked(navigator.clipboard.writeText).mockReturnValue(new Promise<void>((resolve) => { resolveCopy = resolve; }));
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    fireEvent.click(button);
    fireEvent.mouseLeave(button.parentElement!);
    fireEvent.mouseEnter(button);
    await act(async () => resolveCopy());
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click to copy full Stellar address");
    expect(button).not.toHaveTextContent("Copied!");
  });

  it("keeps only the latest confirmation timeout when clipboard writes overlap", async () => {
    vi.useFakeTimers();
    const resolvers: (() => void)[] = [];
    vi.mocked(navigator.clipboard.writeText).mockImplementation(() =>
      new Promise<void>((resolve) => resolvers.push(resolve))
    );
    const { button } = renderWallet();
    fireEvent.mouseEnter(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => resolvers[0]());
    act(() => vi.advanceTimersByTime(1500));
    await act(async () => resolvers[1]());
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^Copied!$/);
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("switches from keyboard to pointer without retaining a keyboard-only tooltip", async () => {
    const { button } = renderWallet();
    mockFocusVisible(button, true);
    act(() => button.focus());
    fireEvent.mouseEnter(button);
    fireEvent.pointerDown(button);
    await act(async () => { fireEvent.click(button); });
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^Copied!$/);
    fireEvent.mouseLeave(button.parentElement!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("clears feedback and copies the new address after a wallet switch", async () => {
    const { button, rerender } = renderWallet();
    await act(async () => { fireEvent.click(button); });
    mocks.wallet.address = "G" + "B".repeat(55);
    rerender(<WalletConnect />);
    expect(button).not.toHaveTextContent("Copied!");
    await act(async () => { fireEvent.click(button); });
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(mocks.wallet.address);
  });

  it("cleans up the confirmation timer on unmount", async () => {
    vi.useFakeTimers();
    const { button, unmount } = renderWallet();
    await act(async () => { fireEvent.click(button); });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
