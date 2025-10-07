import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Building2, LogOut, LayoutDashboard, FileSpreadsheet, Activity, ClipboardCheck, UserCircle, BarChart3 } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { auth } from '../lib/api';
import LanguageSwitch from './LanguageSwitch';
import { AuthState, isAdmin, isPlanner, isEvaluator } from '../types/user';

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authData = await auth.getCurrentUser();
        setAuthState(authData);
        
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }
        
        // CRITICAL: Check user roles and redirect evaluator-only users immediately
        if (authData.userOrganizations && authData.userOrganizations.length > 0 && !hasRedirected) {
          const roles = authData.userOrganizations.map(org => org.role);
          const isOnlyEvaluator = roles.includes('EVALUATOR') && 
                                !roles.includes('ADMIN') && 
                                !roles.includes('PLANNER');
          
          // If user is only evaluator and not already on evaluator/profile page, redirect immediately
          if (isOnlyEvaluator && !location.pathname.startsWith('/evaluator') && location.pathname !== '/profile') {
            console.log('Redirecting evaluator-only user to evaluator dashboard');
            setHasRedirected(true);
            navigate('/evaluator', { replace: true });
            return;
          }
          
          // If user has multiple roles and is on login/home/dashboard page, go to dashboard
          if (!isOnlyEvaluator && (location.pathname === '/login' || location.pathname === '/' || location.pathname === '/dashboard')) {
            console.log('Redirecting multi-role user to dashboard');
            setHasRedirected(true);
            navigate('/dashboard', { replace: true });
            return;
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({ isAuthenticated: false });
        navigate('/login');
      }
    };
    
    checkAuth();
  }, [navigate, location.pathname, hasRedirected]);

  // Helper function to check if user has only evaluator role
  const isEvaluatorOnly = () => {
    if (!authState?.userOrganizations) return false;
    const roles = authState.userOrganizations.map(org => org.role);
    return roles.includes('EVALUATOR') && 
           !roles.includes('ADMIN') && 
           !roles.includes('PLANNER');
  };

  // Helper function to check if user has multiple roles
  const hasMultipleRoles = () => {
    if (!authState?.userOrganizations) return false;
    const roles = [...new Set(authState.userOrganizations.map(org => org.role))];
    return roles.length > 1;
  };

  // Show loading state while checking authentication
  if (authState === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (authState.isAuthenticated === false) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      console.log('Initiating logout process...');
      await auth.logout();
      console.log('Logout successful');
      // Redirect is handled in auth.logout
    } catch (error) {
      console.error('Logout failed:', error);
      // Even on error, we'll redirect in the auth.logout function
      console.log('Redirecting after logout error');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="bg-gradient-to-r from-green-700 to-blue-700 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center transition-transform hover:scale-105">
                <img 
                  src="/assets/moh.png"
                  alt="Ministry of Health"
                  className="h-8 w-8 rounded-full object-cover mr-2"
                />
                <Activity className="h-8 w-8 text-white drop-shadow-sm" />
                <span className="ml-2 text-xl font-semibold text-white tracking-wide drop-shadow-sm">MoH CPR</span>
              </Link>
              
              <div className="ml-10 flex items-center space-x-4">
                {/* Only show dashboard link if user is not evaluator-only */}
                {!isEvaluatorOnly() && !location.pathname.startsWith('/evaluator') && (
                  <Link
                    to="/dashboard"
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/dashboard')
                        ? 'text-white bg-green-800 shadow-inner'
                        : 'text-green-100 hover:text-white hover:bg-green-600 transition-colors'
                    }`}
                  >
                    <LayoutDashboard className="h-5 w-5 mr-2" />
                    {t('nav.dashboard')}
                  </Link>
                )}
                
                {/* Only show planning link to planners who are not evaluator-only and not on evaluator page */}
                {isPlanner(authState.userOrganizations) && !isEvaluatorOnly() && !location.pathname.startsWith('/evaluator') && (
                  <Link
                    to="/planning"
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/planning')
                        ? 'text-white bg-green-800 shadow-inner'
                        : 'text-green-100 hover:text-white hover:bg-green-600 transition-colors'
                    }`}
                  >
                    <FileSpreadsheet className="h-5 w-5 mr-2" />
                    {t('nav.planning')}
                  </Link>
                )}
                
                {/* Evaluator Dashboard link */}
                {isEvaluator(authState.userOrganizations) && (
                  <Link
                    to="/evaluator"
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      location.pathname.startsWith('/evaluator')
                        ? 'text-white bg-green-800 shadow-inner'
                        : 'text-green-100 hover:text-white hover:bg-green-600 transition-colors'
                    }`}
                  >
                    <ClipboardCheck className="h-5 w-5 mr-2" />
                    {isEvaluatorOnly() ? 'Evaluator Dashboard' : t('nav.evaluator')}
                  </Link>
                )}

                {/* Admin Dashboard link - only for admins who are not evaluator-only and not on evaluator page */}
                {isAdmin(authState.userOrganizations) && !isEvaluatorOnly() && !location.pathname.startsWith('/evaluator') && (
                  <Link
                    to="/admin"
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      isActive('/admin')
                        ? 'text-white bg-green-800 shadow-inner'
                        : 'text-green-100 hover:text-white hover:bg-green-600 transition-colors'
                    }`}
                  >
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Admin Analytics
                  </Link>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {authState.user && (
                <Link to="/profile" className="text-blue-100 px-3 py-2 bg-blue-800/30 rounded-md hover:bg-blue-700/40 transition-colors flex items-center">
                  <UserCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">
                    {authState.user.first_name || authState.user.username}
                  </span>
                  {authState.userOrganizations && authState.userOrganizations.length > 0 && (
                    <span className="ml-2 text-xs bg-blue-800 px-2 py-1 rounded-full shadow-sm">
                      {authState.userOrganizations[0].role}
                    </span>
                  )}
                </Link>
              )}
              <LanguageSwitch />
              <a
                href="/admin/"
                target="_blank"
                className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-blue-600"
              >
                {t('nav.adminPanel')}
              </a>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors hover:bg-blue-600"
              >
                <LogOut className="h-5 w-5 mr-2" />
                <span>{isLoggingOut ? t('common.loading') : t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl w-full mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0">
            <div className="text-sm text-gray-600 mb-2 md:mb-0 flex items-center">
              <img 
                src="/assets/moh.png"
                alt="Ministry of Health"
                className="h-6 w-6 rounded-full object-cover mr-2"
              />
              <Activity className="h-5 w-5 text-blue-600 mr-2" />
              &copy; {currentYear} Ministry of Health, Ethiopia. All rights reserved.
            </div>
            <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-md shadow-sm">
              Developed by Ministry of Health, Information Communication Technology EO
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
