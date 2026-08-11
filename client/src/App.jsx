import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import SkillList from './pages/SkillList';
import SkillForm from './pages/SkillForm';
import SkillDetail from './pages/SkillDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <nav className="navbar">
          <span className="navbar-brand">
            Aggr<span>oso</span>
          </span>
          <div className="navbar-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              Skills
            </NavLink>
            <NavLink
              to="/skills/new"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              + New Skill
            </NavLink>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<SkillList />} />
            <Route path="/skills/new" element={<SkillForm />} />
            <Route path="/skills/:id/edit" element={<SkillForm />} />
            <Route path="/skills/:id" element={<SkillDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
