import { useState } from "react";
import { Slider } from "~/ui/Slider";
import { Toggle } from "~/ui/Toggle";
import { SegmentedControl } from "~/ui/SegmentedControl";
import styles from "./ContrastCompare.module.css";

/** The same live controls in the soft palette and in high-contrast mode, side by side. */
export default function ContrastCompare() {
  return (
    <div className={styles.compare}>
      <Sample mode="normal" title="Soft" />
      <Sample mode="more" title="High contrast" />
    </div>
  );
}

function Sample({ mode, title }: { mode: "normal" | "more"; title: string }) {
  const [on, setOn] = useState(true);
  const [level, setLevel] = useState(65);
  const [scene, setScene] = useState("home");
  const id = `cmp-${mode}`;
  return (
    <section className={styles.sample} data-contrast={mode} aria-labelledby={id}>
      <h3 id={id} className={styles.title}>
        {title}
      </h3>
      <Toggle label="Hallway light" aria-label={`Hallway light, ${title.toLowerCase()} example`} isOn={on} onChange={setOn} />
      <Slider
        label="Brightness"
        aria-label={`Brightness, ${title.toLowerCase()} example`}
        tone="light"
        value={level}
        onChangeEnd={setLevel}
      />
      <SegmentedControl
        label={`Mode, ${title.toLowerCase()} example`}
        hideLabel
        fill
        value={scene}
        onChange={setScene}
        options={[
          { value: "home", label: "Home" },
          { value: "away", label: "Away" },
          { value: "eco", label: "Eco" },
        ]}
      />
    </section>
  );
}
