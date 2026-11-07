import { Route, Routes } from 'react-router-dom';
import PublicLayout from './components/public/PublicLayout.jsx';
import HomePage from './pages/public/HomePage.jsx';
import AboutPage from './pages/public/AboutPage.jsx';
import DepartmentsPage from './pages/public/DepartmentsPage.jsx';
import DepartmentPage from './pages/public/DepartmentPage.jsx';
import NewsPage from './pages/public/NewsPage.jsx';
import NewsArticlePage from './pages/public/NewsArticlePage.jsx';
import AdmissionPage from './pages/public/AdmissionPage.jsx';
import ApplyPage from './pages/public/ApplyPage.jsx';
import ContactPage from './pages/public/ContactPage.jsx';
import NotFoundPage from './pages/public/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="departments/:slug" element={<DepartmentPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="news/:slug" element={<NewsArticlePage />} />
        <Route path="admission" element={<AdmissionPage />} />
        <Route path="apply" element={<ApplyPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
