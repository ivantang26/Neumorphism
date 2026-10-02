import { BathtubIcon as Bathtub, BedIcon as Bed, CookingPotIcon as CookingPot, CouchIcon as Couch, DeskIcon as Desk } from "@phosphor-icons/react/ssr";
import type { RoomId } from "~/lib/home";

export function RoomIcon({ id }: { id: RoomId }) {
  const props = { weight: "bold" as const };
  switch (id) {
    case "living":
      return <Couch {...props} />;
    case "kitchen":
      return <CookingPot {...props} />;
    case "bedroom":
      return <Bed {...props} />;
    case "office":
      return <Desk {...props} />;
    case "bathroom":
      return <Bathtub {...props} />;
  }
}
