import { useEffect, useState } from "react";
import { contrastActive, readPrefs, watchSystemContrast, writePrefs } from "~/lib/prefs";
import { Toggle } from "~/ui/Toggle";

/**
 * High-contrast switch for the landing pages. It writes the same preference as
 * the app's Settings, so turning it on here carries into the dashboard.
 */
export default function ContrastSwitch() {
  const [on, setOn] = useState(() => contrastActive(readPrefs().contrast));
  useEffect(() => watchSystemContrast(), []);
  return (
    <Toggle
      label="High contrast"
      isOn={on}
      onChange={(v) => {
        setOn(v);
        writePrefs({ contrast: v ? "on" : "off" });
      }}
    />
  );
}
