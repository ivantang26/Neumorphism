// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { useState } from "react";
import { Dial } from "~/ui/Dial";
import { Toggle } from "~/ui/Toggle";
import { Slider } from "~/ui/Slider";
import { SegmentedControl } from "~/ui/SegmentedControl";
import { Button } from "~/ui/Button";

// jsdom lacks these; the components only use them for motion and media queries.
globalThis.matchMedia ??= ((q: string) => ({
  matches: false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
})) as never;

afterEach(cleanup);

async function noViolations(container: HTMLElement) {
  // Colour contrast needs real layout; tokens are checked in contrast.test.ts instead.
  const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`)).toEqual([]);
}

function ControlledDial({ onCommit }: { onCommit: (v: number) => void }) {
  const [v, setV] = useState(21);
  return (
    <Dial
      label="Whole-home heating target"
      value={v}
      onCommit={(x) => {
        setV(x);
        onCommit(x);
      }}
    />
  );
}

describe("Dial (FR-1)", () => {
  it("is announced as a slider with value, range and spoken text", () => {
    render(<Dial label="Whole-home heating target" value={21.5} onCommit={() => {}} />);
    const s = screen.getByRole("slider", { name: "Whole-home heating target" });
    expect(s.getAttribute("aria-valuemin")).toBe("5");
    expect(s.getAttribute("aria-valuemax")).toBe("30");
    expect(s.getAttribute("aria-valuenow")).toBe("21.5");
    expect(s.getAttribute("aria-valuetext")).toBe("21.5 degrees");
  });

  it("arrow keys change the target by 0.5°C and commit after a pause", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<ControlledDial onCommit={onCommit} />);
    const s = screen.getByRole("slider");
    fireEvent.keyDown(s, { key: "ArrowUp" });
    fireEvent.keyDown(s, { key: "ArrowUp" });
    expect(s.getAttribute("aria-valuenow")).toBe("22");
    expect(onCommit).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(500));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(22);
    fireEvent.keyDown(s, { key: "End" });
    act(() => void vi.advanceTimersByTime(500));
    expect(onCommit).toHaveBeenLastCalledWith(30);
    vi.useRealTimers();
  });

  it("has labelled Cooler and Warmer buttons as a non-drag alternative", () => {
    render(<Dial label="Target" value={21} onCommit={() => {}} />);
    expect(screen.getByRole("button", { name: "Cooler" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Warmer" })).toBeTruthy();
  });

  it("disables everything when offline", () => {
    render(<Dial label="Target" value={21} onCommit={() => {}} isDisabled />);
    expect(screen.getByRole("slider").getAttribute("aria-disabled")).toBe("true");
    expect((screen.getByRole("button", { name: "Warmer" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("has no axe violations", async () => {
    const { container } = render(<Dial label="Target" value={21} current={19.5} onCommit={() => {}} />);
    await noViolations(container);
  });
});

describe("Toggle (FR-2)", () => {
  it("is a switch and shows On/Off in words", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Toggle label="Heating" aria-label="Kitchen heating" isOn={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Kitchen heating" });
    expect((sw as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Off")).toBeTruthy();
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<Toggle label="Heating" aria-label="Kitchen heating" isOn onChange={onChange} />);
    expect(screen.getByText("On")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Toggle label="Lights" isOn onChange={() => {}} />);
    await noViolations(container);
  });
});

describe("Slider, segmented control and button", () => {
  it("slider exposes a labelled range input with a spoken value", async () => {
    const { container } = render(
      <Slider label="Position" aria-label="Kitchen blinds" value={70} onChangeEnd={() => {}} valueText={(v) => `${v} percent open`} />,
    );
    const input = screen.getByRole("slider", { name: /Kitchen blinds/ });
    expect(input.getAttribute("aria-valuetext")).toBe("70 percent open");
    await noViolations(container);
  });

  it("segmented control is a radio group with the current mode checked (FR-4)", async () => {
    const { container } = render(
      <SegmentedControl
        label="Mode"
        value="away"
        onChange={() => {}}
        options={[
          { value: "home", label: "Home" },
          { value: "away", label: "Away" },
        ]}
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Mode" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Away" }) as HTMLInputElement).checked).toBe(true);
    await noViolations(container);
  });

  it("button has a text label and reports pressed state", async () => {
    const { container } = render(
      <Button isSelected onPress={() => {}}>
        Movie
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Movie" }).getAttribute("aria-pressed")).toBe("true");
    await noViolations(container);
  });
});

describe("Kiosk mode (FR-6)", () => {
  it("dims after 2 minutes idle and the waking tap changes nothing else", async () => {
    vi.useFakeTimers();
    const { Kiosk, DIM_AFTER } = await import("~/app/Kiosk");
    render(<Kiosk home={null} />);
    expect(screen.queryByRole("button", { name: /Tap to wake/ })).toBeNull();
    act(() => void vi.advanceTimersByTime(DIM_AFTER - 1000));
    expect(screen.queryByRole("button", { name: /Tap to wake/ })).toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    const overlay = screen.getByRole("button", { name: /Tap to wake/ });
    const behind = vi.fn();
    document.body.addEventListener("click", behind);
    fireEvent.click(overlay);
    expect(behind).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Tap to wake/ })).toBeNull();
    vi.useRealTimers();
  });
});
