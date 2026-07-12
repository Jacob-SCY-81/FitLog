import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import ExerciseList from './pages/ExerciseList.jsx';
import WorkoutHistory from './pages/WorkoutHistory.jsx';
import WorkoutRecorder from './pages/WorkoutRecorder.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import BottomNav from './components/BottomNav.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import { useAuthStore } from './stores/authStore.js';

// 懒加载重型或非首屏页面
const ExerciseDetail = React.lazy(() => import('./pages/ExerciseDetail.jsx'));
const WorkoutDetail = React.lazy(() => import('./pages/WorkoutDetail.jsx'));
const Stats = React.lazy(() => import('./pages/Stats.jsx'));
const CalendarView = React.lazy(() => import('./pages/CalendarView.jsx'));
const Templates = React.lazy(() => import('./pages/Templates.jsx'));
const Profile = React.lazy(() => import('./pages/Profile.jsx'));
const Measurements = React.lazy(() => import('./pages/Measurements.jsx'));

export default function App() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  return (
    <div className="min-h-dvh bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto lg:flex lg:pl-56">
        <div className="flex-1 min-w-0">
          <Suspense fallback={
            <div className="min-h-dvh flex items-center justify-center">
              <LoadingSpinner />
            </div>
          }>
            <Routes>
              <Route path="/login" element={
                isAuthenticated ? <Navigate to="/" replace /> : <Login />
              } />
              <Route path="/" element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } />
              <Route path="/exercises" element={
                <ProtectedRoute>
                  <ExerciseList />
                </ProtectedRoute>
              } />
              <Route path="/exercises/:id" element={
                <ProtectedRoute>
                  <ExerciseDetail />
                </ProtectedRoute>
              } />
              <Route path="/workouts" element={
                <ProtectedRoute>
                  <WorkoutHistory />
                </ProtectedRoute>
              } />
              <Route path="/workouts/new" element={
                <ProtectedRoute>
                  <WorkoutRecorder />
                </ProtectedRoute>
              } />
              <Route path="/workouts/:id" element={
                <ProtectedRoute>
                  <WorkoutDetail />
                </ProtectedRoute>
              } />
              <Route path="/stats" element={
                <ProtectedRoute>
                  <Stats />
                </ProtectedRoute>
              } />
              <Route path="/calendar" element={
                <ProtectedRoute>
                  <CalendarView />
                </ProtectedRoute>
              } />
              <Route path="/templates" element={
                <ProtectedRoute>
                  <Templates />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/measurements" element={
                <ProtectedRoute>
                  <Measurements />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
