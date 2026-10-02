import { useEffect, useState } from "react";
import { Dial } from "~/ui/Dial";

/**
 * Hero demo dial (FR-9). Simulated state, no login and no hub: the room warms
 * toward whatever the visitor sets, so the readout responds like the real thing.
 */
export default function DemoDial() {
  const [target, setTarget] = useState(21.5);
  const [current, setCurrent] = useState(19.4);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrent((c) => {
        const diff = target - c;
        if (Math.abs(diff) < 0.05) return target;
        return Math.round((c + Math.sign(diff) * Math.min(0.1, Math.abs(diff))) * 10) / 10;
      });
    }, 1200);
    return () => clearInterval(t);
  }, [target]);

  const heating = current < target - 0.2;
  return (
    <Dial
      label="Demo thermostat target"
      size="demo"
      value={target}
      current={current}
      caption={heating ? "Heating to" : "Holding"}
      onCommit={setTarget}
    />
  );
}
