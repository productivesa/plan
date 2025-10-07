import React, { useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { auth } from '../lib/api';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useLanguage } from '../lib/i18n/LanguageContext';

const AuthLayout: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

   useEffect(() => {
    // Check if user is already authenticated using getCurrentUser
    const checkAuth = async () => {
      console.log('AuthLayout: Checking authentication...');
      try {
        // First check if already authenticated via cookie
        if (auth.isAuthenticated()) {
          console.log('AuthLayout: User is already authenticated via cookie');
          navigate('/dashboard');
          return;
        }
        
        try {
          // Get CSRF token if needed
          console.log('AuthLayout: Getting CSRF token...');
          await axios.get('/api/auth/csrf/', { 
            withCredentials: true,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          
          const token = Cookies.get('csrftoken');
          if (token) {
            console.log('AuthLayout: Got CSRF token:', token.substring(0, 5) + '...');
          } else {
            console.log('AuthLayout: Failed to get CSRF token');
          }
          
          // Then check authentication
          console.log('AuthLayout: Checking auth status with server...');
          const authData = await auth.getCurrentUser(); 
          console.log('AuthLayout: Auth status:', authData);
          
          if (authData.isAuthenticated) {
            console.log('AuthLayout: User is authenticated, redirecting to dashboard');
            navigate('/dashboard');
          }
        } catch (innerError) {
          console.error('CSRF or auth verification failed:', innerError);
          // Stay on login page
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Stay on login page if authentication check fails
      }
    };
    
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {t('app.title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('app.subtitle')}
        </p>
      </div>
      <Outlet />
    </div>
  );
};

export default AuthLayout;