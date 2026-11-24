import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Compare from './pages/Compare'
import Course from './pages/Course'
import Coverage from './pages/Coverage'
import Dashboard from './pages/Dashboard'
import Diagnostic from './pages/Diagnostic'
import ExamGuide from './pages/ExamGuide'
import ClearUp from './pages/ClearUp'
import LessonPage from './pages/Lesson'
import { AnimationLibrary, Labs } from './pages/Library'
import { Analytics, Bookmarks, Search, SettingsPage } from './pages/Misc'
import Practice from './pages/Practice'
import Reviews from './pages/Reviews'
import Sprint from './pages/Sprint'
import { PLAN_EXAMS, examEnabled } from './services/curriculum'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/course/:exam" element={<Course />} />
        <Route path="/lesson/:lessonId" element={<LessonPage />} />
        {PLAN_EXAMS.length > 0 && <Route path="/sprint" element={<Sprint />} />}
        {examEnabled('az-104') && <Route path="/exam-guide" element={<ExamGuide />} />}
        {examEnabled('az-104') && <Route path="/clear-up" element={<ClearUp />} />}
        {examEnabled('az-900') && <Route path="/diagnostic" element={<Diagnostic />} />}
        <Route path="/practice" element={<Practice />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/animations" element={<AnimationLibrary />} />
        <Route path="/labs" element={<Labs />} />
        {examEnabled('aws-clf-c02') && <Route path="/compare" element={<Compare />} />}
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
