import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Compare from './pages/Compare'
import Course from './pages/Course'
import Coverage from './pages/Coverage'
import Dashboard from './pages/Dashboard'
import Diagnostic from './pages/Diagnostic'
import ExamGuide from './pages/ExamGuide'
import LessonPage from './pages/Lesson'
import { AnimationLibrary, Labs } from './pages/Library'
import { Analytics, Bookmarks, Search, SettingsPage } from './pages/Misc'
import Practice from './pages/Practice'
import Reviews from './pages/Reviews'
import Sprint from './pages/Sprint'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/course/:exam" element={<Course />} />
        <Route path="/lesson/:lessonId" element={<LessonPage />} />
        <Route path="/sprint" element={<Sprint />} />
        <Route path="/exam-guide" element={<ExamGuide />} />
        <Route path="/diagnostic" element={<Diagnostic />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/animations" element={<AnimationLibrary />} />
        <Route path="/labs" element={<Labs />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/coverage" element={<Coverage />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<p>Page not found.</p>} />
      </Routes>
    </Layout>
  )
}
