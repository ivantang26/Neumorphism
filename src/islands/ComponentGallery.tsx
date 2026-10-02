import { useState } from "react";
import { GearIcon as Gear, PlusIcon as Plus } from "@phosphor-icons/react/ssr";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Dial } from "~/ui/Dial";
import { SegmentedControl } from "~/ui/SegmentedControl";
import { Slider } from "~/ui/Slider";
import { Toggle } from "~/ui/Toggle";
import { ToastProvider, useToast } from "~/ui/Toast";
import styles from "./ComponentGallery.module.css";

/** The soft UI component set (PRD §1 goals), live, with the contrast strategy for each. */
export default function ComponentGallery() {
  return (
    <ToastProvider>
      <Gallery />
    </ToastProvider>
  );
}

function Gallery() {
  const [temp, setTemp] = useState(21);
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [level, setLevel] = useState(40);
  const [mode, setMode] = useState("home");
  const toast = useToast();

  return (
    <div className={styles.grid}>
      <Spec title="Dial" note="Ring in --edge-strong (3.5:1); target arc outlined in --warm-ink (4.2:1). role=slider with aria-valuetext.">
        <Dial label="Example target temperature" size="room" value={temp} current={19.5} onCommit={setTemp} caption="Heating to" />
      </Spec>
      <Spec title="Toggle" note="State shown by colour, thumb position and the words On/Off. Active track bounded by --on-ink (4.4:1).">
        <Toggle label="Heating" isOn={on} onChange={setOn} />
        <Toggle label="Lights" isOn={off} onChange={setOff} />
        <Toggle label="Disabled" isOn={false} onChange={() => {}} isDisabled />
      </Spec>
      <Spec title="Slider" note="Inset rail with an --edge-strong ring; the thumb is a full touch target. React Aria slider.">
        <Slider label="Brightness" tone="light" value={level} onChangeEnd={setLevel} />
        <Slider label="Blinds" tone="cool" value={70} onChangeEnd={() => {}} isDisabled />
      </Spec>
      <Spec title="Segmented control" note="Radio group. The chosen option is pressed in, ticked and ink-coloured, so it never relies on shadow alone.">
        <SegmentedControl
          label="Mode"
          fill
          value={mode}
          onChange={setMode}
          options={[
            { value: "home", label: "Home" },
            { value: "away", label: "Away" },
            { value: "night", label: "Night" },
          ]}
        />
      </Spec>
      <Spec title="Button" note="Raised by default, pressed over 120ms. Text label always; primary uses --warm with --text (4.9:1).">
        <div className={styles.row}>
          <Button icon={<Plus weight="bold" />} onPress={() => toast("Raised button pressed.")}>
            Add block
          </Button>
          <Button variant="primary" onPress={() => toast("Primary button pressed.")}>
            Pre-order
          </Button>
          <Button icon={<Gear weight="bold" />} isDisabled>
            Disabled
          </Button>
        </div>
      </Spec>
      <Spec title="Card" note="Raised or inset surface. Its --edge hairline is decorative; controls inside carry their own rings.">
        <div className={styles.row}>
          <Card padding="sm" className={styles.demoCard}>
            Raised
          </Card>
          <Card padding="sm" inset className={styles.demoCard}>
            Inset
          </Card>
        </div>
      </Spec>
    </div>
  );
}

function Spec({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  const id = `spec-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section className={styles.spec} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      <div className={styles.stage}>{children}</div>
      <p className={styles.note}>{note}</p>
    </section>
  );
}
