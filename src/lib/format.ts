export function blindsText(v: number): string {
  return v === 0 ? "Closed" : v === 100 ? "Open" : `${v}% open`;
}

export function blindsSpoken(v: number): string {
  return v === 0 ? "closed" : v === 100 ? "fully open" : `${v} percent open`;
}
