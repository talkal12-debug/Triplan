/**
 * IATA metropolitan code for multi-airport cities (LON, PAR, ROM, TYO, NYC ...). Trip.com keys its
 * flight search by these; for every other airport the airport code doubles as the city code.
 */
const metro: Record<string, string> = {
  LHR: "LON", LGW: "LON", STN: "LON", LTN: "LON", LCY: "LON",
  CDG: "PAR", ORY: "PAR",
  FCO: "ROM", CIA: "ROM",
  MXP: "MIL", LIN: "MIL", BGY: "MIL",
  HND: "TYO", NRT: "TYO",
  KIX: "OSA", ITM: "OSA",
  JFK: "NYC", EWR: "NYC", LGA: "NYC",
  ORD: "CHI", MDW: "CHI",
  IAD: "WAS", DCA: "WAS",
  SVO: "MOW", DME: "MOW", VKO: "MOW",
  ARN: "STO", BMA: "STO",
  GRU: "SAO", CGH: "SAO",
  EZE: "BUE", AEP: "BUE",
  GIG: "RIO", SDU: "RIO",
  SAW: "IST",
  DMK: "BKK",
  GMP: "SEL", ICN: "SEL",
  PVG: "SHA",
  PKX: "BJS", PEK: "BJS",
  TSA: "TPE",
  DWC: "DXB",
};
export function metroCode(iata: string): string {
  return metro[iata.toUpperCase()] ?? iata.toUpperCase();
}

/** The main hub of each multi-airport city: the nearest airport to a centre is often the small one (Ciampino, Linate). */
const hub: Record<string, string> = { LON: "LHR", PAR: "CDG", ROM: "FCO", MIL: "MXP", TYO: "HND", OSA: "KIX", NYC: "JFK", CHI: "ORD", WAS: "IAD", MOW: "SVO", STO: "ARN", SAO: "GRU", BUE: "EZE", RIO: "GIG", SEL: "ICN", SHA: "PVG", BJS: "PEK" };
export function hubFor(iata: string): string | null {
  return hub[metroCode(iata)] ?? null;
}
