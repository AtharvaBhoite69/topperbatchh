import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

import ProtectedRoute from './components/shared/ProtectedRoute';
import AdminRoute from './components/shared/AdminRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import ScreenshotProtector from './components/shared/ScreenshotProtector';

// Public & Auth Pages
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Student Pages
import Dashboard from './pages/dashboard/Dashboard';
import QuestionBank from './pages/documents/QuestionBank';
import PDFViewer from './pages/documents/PDFViewer';
import AIChatbot from './pages/chatbot/AIChatbot';
import DailyChallenge from './pages/quiz/DailyChallenge';
import TakeQuiz from './pages/quiz/TakeQuiz';
import QuizResults from './pages/quiz/QuizResults';
import Leaderboard from './pages/quiz/Leaderboard';
import Community from './pages/community/Community';
import Profile from './pages/profile/Profile';
import ViewProfile from './pages/profile/ViewProfile';
import Notifications from './pages/notifications/Notifications';
import SearchResults from './pages/search/SearchResults';
import MockTests from './pages/MockTests';
import StudyGroups from './pages/StudyGroups';
import ExamPlanner from './pages/ExamPlanner';
import NotFound from './pages/NotFound';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageRegistrations from './pages/admin/ManageRegistrations';
import ManageStudents from './pages/admin/ManageStudents';
import StudentDetails from './pages/admin/StudentDetails';
import ManageDocuments from './pages/admin/ManageDocuments';
import UploadDocument from './pages/admin/UploadDocument';
import ManageQuestions from './pages/admin/ManageQuestions';
import ManageChallenges from './pages/admin/ManageChallenges';
import CommunityModeration from './pages/admin/CommunityModeration';
import ManageAnnouncements from './pages/admin/ManageAnnouncements';
import AuditLogs from './pages/admin/AuditLogs';
import PlatformSettings from './pages/admin/PlatformSettings';
import SessionManagement from './pages/admin/SessionManagement';
import MCQGenerator from './pages/admin/MCQGenerator';

export const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#F5E9D1',
                color: '#171510',
                border: '3px solid #171510',
                boxShadow: '4px 4px 0px #171510',
                borderRadius: '6px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '13px',
              },
            }}
          />

          <ScreenshotProtector>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Protected Student Routes wrapped in Dashboard Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/question-bank" element={<QuestionBank />} />
              <Route path="/document/:id" element={<PDFViewer />} />
              <Route path="/documents/:id" element={<PDFViewer />} />
              <Route path="/ai-chat" element={<AIChatbot />} />
              <Route path="/ai-chat/:conversationId" element={<AIChatbot />} />
              <Route path="/daily-challenge" element={<DailyChallenge />} />
              <Route path="/quiz/:id" element={<TakeQuiz />} />
              <Route path="/quiz/:id/results" element={<QuizResults />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/community" element={<Community />} />
              <Route path="/community/:channelId" element={<Community />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:id" element={<ViewProfile />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/mock-tests" element={<MockTests />} />
              <Route path="/study-groups" element={<StudyGroups />} />
              <Route path="/exam-planner" element={<ExamPlanner />} />

              {/* Protected Administrator Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/registrations"
                element={
                  <AdminRoute>
                    <ManageRegistrations />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/dept-requests"
                element={
                  <AdminRoute>
                    <ManageStudents initialTab="requests" />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <AdminRoute>
                    <ManageStudents />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/students/:id"
                element={
                  <AdminRoute>
                    <StudentDetails />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/documents"
                element={
                  <AdminRoute>
                    <ManageDocuments />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/upload"
                element={
                  <AdminRoute>
                    <UploadDocument />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/questions"
                element={
                  <AdminRoute>
                    <ManageQuestions />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/mcq-generator"
                element={
                  <AdminRoute>
                    <MCQGenerator />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/challenges"
                element={
                  <AdminRoute>
                    <ManageChallenges />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/community"
                element={
                  <AdminRoute>
                    <CommunityModeration />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/announcements"
                element={
                  <AdminRoute>
                    <ManageAnnouncements />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/audit-logs"
                element={
                  <AdminRoute>
                    <AuditLogs />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <AdminRoute>
                    <PlatformSettings />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/sessions"
                element={
                  <AdminRoute>
                    <SessionManagement />
                  </AdminRoute>
                }
              />
            </Route>

            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ScreenshotProtector>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;

