import { useState } from "react";
import { LightbulbIcon as Lightbulb, RowsIcon as Rows } from "@phosphor-icons/react/ssr";
import { Button } from "~/ui/Button";
import { Card } from "~/ui/Card";
import { Dial } from "~/ui/Dial";
import { Slider } from "~/ui/Slider";
import { Toggle } from "~/ui/Toggle";
import { blindsSpoken, blindsText } from "~/lib/format";
import styles from "./DemoPanel.module.css";

/** One room of the dashboard, running on local simulated state (FR-9). */
export default function DemoPanel() {
  const [heating, setHeating] = useState(true);
  const [target, setTarget] = useState(20.5);
  const [ceiling, setCeiling] = useState({ on: true, brightness: 70 });
  const [lamp, setLamp] = useState({ on: false, brightness: 35 });
  const [blinds, setBlinds] = useState(60);

  return (
    <div className={styles.panel}>
      <Card as="section" aria-labelledby="demo-heat" className={styles.col}>
        <div className={styles.head}>
          <h3 id="demo-heat" className={styles.title}>
            Heating
          </h3>
          <Toggle label="Radiators" aria-label="Living room heating" isOn={heating} onChange={setHeating} />
        </div>
        <Dial
          label="Living room target temperature"
          size="room"
          value={target}
          current={19.8}
          caption={heating ? "Heating to" : "Off, target"}
          tone={heating ? "warm" : "off"}
          onCommit={setTarget}
        />
      </Card>

      <Card as="section" aria-labelledby="demo-lights" className={styles.col}>
        <h3 id="demo-lights" className={styles.title}>
          Lights
        </h3>
        <div className={styles.light}>
          <Toggle label="Ceiling" aria-label="Living room ceiling" isOn={ceiling.on} onChange={(on) => setCeiling((l) => ({ ...l, on }))} />
          <Slider
            label="Brightness"
            aria-label="Ceiling brightness"
            icon={<Lightbulb weight="bold" />}
            tone="light"
            min={1}
            value={ceiling.brightness}
            onChangeEnd={(brightness) => setCeiling({ on: true, brightness })}
          />
        </div>
        <div className={styles.light}>
          <Toggle label="Floor lamp" aria-label="Living room floor lamp" isOn={lamp.on} onChange={(on) => setLamp((l) => ({ ...l, on }))} />
          <Slider
            label="Brightness"
            aria-label="Floor lamp brightness"
            icon={<Lightbulb weight="bold" />}
            tone="light"
            min={1}
            value={lamp.brightness}
            onChangeEnd={(brightness) => setLamp({ on: true, brightness })}
          />
        </div>
      </Card>

      <Card as="section" aria-labelledby="demo-blinds" className={styles.col}>
        <h3 id="demo-blinds" className={styles.title}>
          Blinds
        </h3>
        <Slider
          label="Position"
          aria-label="Living room blinds position"
          icon={<Rows weight="bold" />}
          tone="cool"
          step={5}
          value={blinds}
          formatValue={blindsText}
          valueText={blindsSpoken}
          onChangeEnd={setBlinds}
        />
        <div className={styles.row}>
          <Button isDisabled={blinds === 100} onPress={() => setBlinds(100)}>
            Open fully
          </Button>
          <Button isDisabled={blinds === 0} onPress={() => setBlinds(0)}>
            Close fully
          </Button>
        </div>
        <div className={styles.window} aria-hidden="true">
          <div className={styles.shade} style={{ height: `${100 - blinds}%` }} />
        </div>
      </Card>
    </div>
  );
}
