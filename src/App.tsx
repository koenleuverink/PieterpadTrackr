import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, Camera, CheckCircle2, Flag, Home as HomeIcon, MapPin, NotebookPen, Plus, Route as RouteIcon } from 'lucide-react'
import { FeedbackProvider } from './components/Feedback'
import { Loading, Sheet } from './components/ui'
import { UpdatePrompt } from './components/UpdatePrompt'
import Home from './pages/Home'
import Stages from './pages/Stages'

const StageDetail = lazy(() => import('./pages/StageDetail'))
const StageComplete = lazy(() => import('./pages/StageComplete'))
const Diary = lazy(() => import('./pages/Diary'))
const DiaryEdit = lazy(() => import('./pages/DiaryEdit'))
const Places = lazy(() => import('./pages/Places'))
const PlaceEdit = lazy(() => import('./pages/PlaceEdit'))
const Stats = lazy(() => import('./pages/Stats'))
const Settings = lazy(() => import('./pages/Settings'))
const RouteImport = lazy(() => import('./pages/RouteImport'))
const RouteDetail = lazy(() => import('./pages/RouteDetail'))
const RouteEdit = lazy(() => import('./pages/RouteEdit'))
const PhotoAdd = lazy(() => import('./pages/PhotoAdd'))

const tabs = [
  { to: '/', label: 'Overzicht', icon: HomeIcon, end: true },
  { to: '/etappes', label: 'Etappes', icon: Flag },
  { to: '/dagboek', label: 'Dagboek', icon: BookOpen },
  { to: '/plekken', label: 'Plekken', icon: MapPin },
  { to: '/statistieken', label: 'Statistieken', icon: BarChart3 },
]

function TabBar() {
  return (
    <nav aria-label="Hoofdmenu" className="safe-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface/95 backdrop-blur">
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold ${isActive ? 'text-red' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-6" strokeWidth={isActive ? 2.6 : 2} aria-hidden />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function QuickAdd() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  // Op formulierpagina's niet tonen: daar zit de opslaan-knop onder de duim.
  const hidden = /\/(nieuw|bewerken|afronden|importeren)/.test(location.pathname) || location.pathname.startsWith('/instellingen')
  const stageMatch = location.pathname.match(/^\/etappes\/(etappe-\d+)/)
  const ctx = stageMatch ? `?etappe=${stageMatch[1]}` : ''
  const actions = [
    { label: 'Etappe afronden', desc: 'Markeer een etappe als gelopen', icon: CheckCircle2, to: `/etappes/afronden${ctx}` },
    { label: 'Foto toevoegen', desc: 'Camera of fotobibliotheek', icon: Camera, to: `/fotos/nieuw${ctx}` },
    { label: 'Dagboekentry', desc: 'Schrijf over je wandeling', icon: NotebookPen, to: `/dagboek/nieuw${ctx}` },
    { label: 'Plek toevoegen', desc: 'Restaurant, café of overnachting', icon: MapPin, to: `/plekken/nieuw${ctx}` },
    { label: 'Route importeren', desc: 'GPX, TCX of FIT, of handmatig', icon: RouteIcon, to: `/routes/importeren${ctx}` },
  ]
  if (hidden) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Toevoegen"
        aria-haspopup="dialog"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[1100] flex size-16 items-center justify-center rounded-full bg-red text-on-red shadow-lg shadow-black/25 transition active:scale-95"
      >
        <Plus className="size-9" strokeWidth={2.6} aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Toevoegen">
        <ul className="space-y-2">
          {actions.map(({ label, desc, icon: Icon, to }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate(to)
                }}
                className="flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 border-line bg-surface px-4 text-left hover:border-muted"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-red-soft text-red">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span>
                  <span className="block font-bold">{label}</span>
                  <span className="block text-sm text-muted">{desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <a href="#inhoud" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[5000] focus:rounded-lg focus:bg-surface focus:p-3">
          Naar inhoud
        </a>
        <div id="inhoud">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/etappes" element={<Stages />} />
              <Route path="/etappes/afronden" element={<StageComplete />} />
              <Route path="/etappes/:id" element={<StageDetail />} />
              <Route path="/dagboek" element={<Diary />} />
              <Route path="/dagboek/nieuw" element={<DiaryEdit />} />
              <Route path="/dagboek/:id/bewerken" element={<DiaryEdit />} />
              <Route path="/plekken" element={<Places />} />
              <Route path="/plekken/nieuw" element={<PlaceEdit />} />
              <Route path="/plekken/:id/bewerken" element={<PlaceEdit />} />
              <Route path="/statistieken" element={<Stats />} />
              <Route path="/instellingen" element={<Settings />} />
              <Route path="/routes/importeren" element={<RouteImport />} />
              <Route path="/routes/nieuw" element={<RouteEdit />} />
              <Route path="/routes/:id" element={<RouteDetail />} />
              <Route path="/routes/:id/bewerken" element={<RouteEdit />} />
              <Route path="/fotos/nieuw" element={<PhotoAdd />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </div>
        <QuickAdd />
        <TabBar />
        <UpdatePrompt />
      </FeedbackProvider>
    </BrowserRouter>
  )
}
