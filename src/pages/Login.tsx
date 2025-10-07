import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Home, AlertCircle, Activity } from 'lucide-react';
import { auth } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface LoginForm {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isInitialCheck, setIsInitialCheck] = useState(true);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>();

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
       try {
         // First check if we're already authenticated
         if (auth.isAuthenticated()) {
           navigate('/dashboard');
           return;
         }
         
         try {
           // Get fresh CSRF token
           await axios.get('/api/auth/csrf/', { withCredentials: true });
           
           // Then check authentication status
           const authData = await auth.getCurrentUser();
           if (authData.isAuthenticated) {
             navigate('/dashboard');
           }
         } catch (error) {
           console.error('Auth check error:', error);
         }
       } catch (error) {
         console.error('Auth verification failed:', error);
       } finally {
         setIsInitialCheck(false);
        }
    };
     
    checkAuth();
  }, [navigate]);

  // Don't render form while checking initial auth status
  if (isInitialCheck) {
    return null;
  }

  const onSubmit = async (data: LoginForm) => {
    try {
      setLoginError(null);

      // Get fresh CSRF token before login
      try {
        await axios.get('/api/auth/csrf/', { withCredentials: true });
      } catch (csrfError) {
        console.error('Failed to get CSRF token:', csrfError);
      }

      const response = await auth.login(data.username, data.password);
      
      if (response.success) {
        // Successful login, redirect to dashboard
        window.location.href = '/dashboard'; // Hard redirect to ensure page reload
      } else {
        // Login failed with a specific error message
        setLoginError(response.error || t('auth.loginFailed'));
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || t('auth.loginFailed'));
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-cover bg-center" 
         style={{ 
           backgroundImage: 'url("https://images.unsplash.com/photo-1631557379425-2c5f04d6ede9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2071&q=80")',
         }}>
      <div className="absolute inset-0 bg-gradient-to-b from-green-900/80 to-blue-900/90"></div>
      
      <div className="absolute top-4 left-4 z-10">
        <Link to="/" className="flex items-center gap-2 px-4 py-2 text-white hover:text-gray-200 bg-white/10 backdrop-blur rounded-lg hover:bg-white/20 transition-colors">
          <Home className="h-5 w-5" />
          <span>{t('common.home')}</span>
        </Link>
      </div>
      
      <div className="flex-grow flex items-center justify-center relative z-10 py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center mb-8">
            <div className="bg-white/90 p-4 rounded-full inline-block shadow-lg mb-6">
              <img
                src="/assets/moh.png"
                alt="Ministry of Health"
                className="mx-auto h-20 w-auto"
              />
            </div>
            <h2 className="text-3xl font-bold text-white">{t('auth.login')}</h2>
            <p className="mt-2 text-white/80">{t('app.subtitle')}</p>
          </div>
          
          <form className="bg-white/95 backdrop-blur p-8 rounded-lg shadow-xl border border-white/20" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  {t('auth.username')}
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    type="text"
                    required
                    autoComplete="username"
                    {...register('username', { required: t('auth.usernameRequired') })}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder={t('auth.username')}
                  />
                  {errors.username && (
                    <p className="mt-2 text-sm text-red-600">{errors.username.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('auth.password')}
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    {...register('password', { required: t('auth.passwordRequired') })}
                    placeholder={t('auth.password')}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{loginError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? t('auth.signingIn') : t('auth.login')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;