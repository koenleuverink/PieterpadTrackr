import lines from './stageLines.json'

export type Province = 'Groningen' | 'Drenthe' | 'Overijssel' | 'Gelderland' | 'Noord-Brabant' | 'Limburg'

export interface OfficialStage {
  number: number
  from: string
  to: string
  /** Afstand volgens de etappetabel op pieterpad.nl (gecontroleerd november 2026). */
  distanceKm: number
  /** Benaderde verdeling van de etappe over provincies (aandelen tellen op tot 1). */
  provinces: Partial<Record<Province, number>>
  /** Vereenvoudigde lijn van de officiële route ([lat, lon]). */
  line: [number, number][]
}

type Row = [number, string, string, number, OfficialStage['provinces']]

// Bron: https://www.pieterpad.nl/etappes (tabel "Pieterpad Noord" en "Pieterpad Zuid").
const rows: Row[] = [
  [1, 'Pieterburen', 'Winsum', 12, { Groningen: 1 }],
  [2, 'Winsum', 'Groningen', 22, { Groningen: 1 }],
  [3, 'Groningen', 'Zuidlaren', 21, { Groningen: 0.6, Drenthe: 0.4 }],
  [4, 'Zuidlaren', 'Rolde', 17, { Drenthe: 1 }],
  [5, 'Rolde', 'Schoonloo', 18, { Drenthe: 1 }],
  [6, 'Schoonloo', 'Sleen', 23, { Drenthe: 1 }],
  [7, 'Sleen', 'Coevorden', 21, { Drenthe: 1 }],
  [8, 'Coevorden', 'Hardenberg', 19, { Drenthe: 0.2, Overijssel: 0.8 }],
  [9, 'Hardenberg', 'Ommen', 22, { Overijssel: 1 }],
  [10, 'Ommen', 'Hellendoorn', 20, { Overijssel: 1 }],
  [11, 'Hellendoorn', 'Holten', 16, { Overijssel: 1 }],
  [12, 'Holten', 'Laren', 15, { Overijssel: 0.6, Gelderland: 0.4 }],
  [13, 'Laren', 'Vorden', 14, { Gelderland: 1 }],
  [14, 'Vorden', 'Zelhem', 17, { Gelderland: 1 }],
  [15, 'Zelhem', 'Braamt', 17, { Gelderland: 1 }],
  [16, 'Braamt', 'Millingen aan de Rijn', 25, { Gelderland: 1 }],
  [17, 'Millingen aan de Rijn', 'Groesbeek', 20, { Gelderland: 1 }],
  [18, 'Groesbeek', 'Gennep', 15, { Gelderland: 0.5, Limburg: 0.5 }],
  [19, 'Gennep', 'Vierlingsbeek', 19, { Limburg: 0.8, 'Noord-Brabant': 0.2 }],
  [20, 'Vierlingsbeek', 'Swolgen', 24, { 'Noord-Brabant': 0.3, Limburg: 0.7 }],
  [21, 'Swolgen', 'Venlo', 21, { Limburg: 1 }],
  [22, 'Venlo', 'Swalmen', 23, { Limburg: 1 }],
  [23, 'Swalmen', 'Montfort', 22, { Limburg: 1 }],
  [24, 'Montfort', 'Sittard', 24, { Limburg: 1 }],
  [25, 'Sittard', 'Strabeek', 22, { Limburg: 1 }],
  [26, 'Strabeek', 'Sint-Pietersberg', 17, { Limburg: 1 }],
]

const lineData = lines as unknown as Record<string, { line: [number, number][] }>

export const OFFICIAL_STAGES: OfficialStage[] = rows.map(([number, from, to, distanceKm, provinces]) => ({
  number,
  from,
  to,
  distanceKm,
  provinces,
  line: lineData[String(number)]?.line ?? [],
}))

export const TOTAL_KM = OFFICIAL_STAGES.reduce((s, e) => s + e.distanceKm, 0)

export const PROVINCES: Province[] = ['Groningen', 'Drenthe', 'Overijssel', 'Gelderland', 'Noord-Brabant', 'Limburg']

export function officialStage(number: number): OfficialStage | undefined {
  return OFFICIAL_STAGES.find((s) => s.number === number)
}

export function stageId(number: number) {
  return `etappe-${String(number).padStart(2, '0')}`
}
