import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { PlaceType, TrackPoint } from '../db/types'

export interface MapLine {
  id: string
  points: [number, number][] | TrackPoint[]
  kind: 'walked' | 'planned' | 'route' | 'highlight'
  label?: string
  onClick?: () => void
}

export interface MapMarker {
  id: string
  lat: number
  lon: number
  type: PlaceType | 'photo' | 'start' | 'end'
  label: string
  onClick?: () => void
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const styleFor = (kind: MapLine['kind']): L.PolylineOptions => {
  switch (kind) {
    case 'walked':
      return { color: css('--c-red-brand') || '#ec211d', weight: 6, opacity: 0.95 }
    case 'route':
      return { color: css('--c-red-brand') || '#ec211d', weight: 4, opacity: 0.9, dashArray: '1 7', lineCap: 'round' }
    case 'highlight':
      return { color: css('--c-ink') || '#292c3d', weight: 6, opacity: 0.9 }
    default:
      return { color: css('--c-route-planned') || '#8a8d99', weight: 4, opacity: 0.8, dashArray: '6 6' }
  }
}

const markerEmoji: Record<MapMarker['type'], string> = {
  restaurant: '🍽',
  cafe: '☕',
  overnachting: '🛏',
  photo: '📷',
  start: 'A',
  end: 'B',
}

function icon(type: MapMarker['type']) {
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div style="width:34px;height:34px;border-radius:999px;background:var(--c-surface);border:3px solid var(--c-red);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--c-ink);box-shadow:0 1px 4px rgba(0,0,0,.35)">${markerEmoji[type]}</div>`,
  })
}

const NL_BOUNDS: L.LatLngBoundsExpression = [
  [50.75, 5.6],
  [53.45, 6.95],
]

export function MapView({
  lines = [],
  markers = [],
  fit,
  className = 'h-72',
  label = 'Kaart',
  interactive = true,
  onMapClick,
}: {
  lines?: MapLine[]
  markers?: MapMarker[]
  /** 'all' = alles in beeld, 'nl' = heel het Pieterpad, of een id van een lijn */
  fit?: 'all' | 'nl' | string
  className?: string
  label?: string
  interactive?: boolean
  onMapClick?: (lat: number, lon: number) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const clickRef = useRef(onMapClick)
  clickRef.current = onMapClick

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, {
      zoomControl: interactive,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: false,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    })
    m.fitBounds(NL_BOUNDS)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => clickRef.current?.(e.latlng.lat, e.latlng.lng))
    map.current = m
    // Leaflet meet de grootte bij het aanmaken; na layout opnieuw meten.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
  }, [interactive])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const all: L.LatLng[] = []
    let target: L.LatLngBounds | undefined
    // Gepland eerst, zodat gelopen delen erbovenop liggen.
    const order = { planned: 0, walked: 1, route: 2, highlight: 3 }
    for (const line of [...lines].sort((a, b) => order[a.kind] - order[b.kind])) {
      if (line.points.length < 2) continue
      const latlngs = line.points.map((p) => L.latLng(p[0], p[1]))
      const pl = L.polyline(latlngs, styleFor(line.kind)).addTo(g)
      if (line.label) pl.bindTooltip(line.label, { sticky: true })
      if (line.onClick) pl.on('click', line.onClick)
      all.push(...latlngs)
      if (fit === line.id) target = pl.getBounds()
    }
    for (const mk of markers) {
      const marker = L.marker([mk.lat, mk.lon], { icon: icon(mk.type), title: mk.label, alt: mk.label }).addTo(g)
      marker.bindTooltip(mk.label)
      if (mk.onClick) marker.on('click', mk.onClick)
      all.push(L.latLng(mk.lat, mk.lon))
    }
    if (target) m.fitBounds(target, { padding: [24, 24] })
    else if (fit === 'nl' || (!fit && !all.length)) m.fitBounds(NL_BOUNDS)
    else if (all.length) m.fitBounds(L.latLngBounds(all), { padding: [24, 24], maxZoom: 15 })
  }, [lines, markers, fit])

  return <div ref={el} role="region" aria-label={label} className={`z-0 overflow-hidden rounded-2xl border border-line ${className}`} />
}
