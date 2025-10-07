import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Target, List, FileText, Activity, Heart, Calendar } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { auth } from '../lib/api';
import LanguageSwitch from '../components/LanguageSwitch';

const Landing: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if we're already authenticated via cookie
        if (auth.isAuthenticated()) {
          navigate('/dashboard');
          return;
        }
        
        try {
          // Double-check with the server
          const authData = await auth.getCurrentUser();
          if (authData.isAuthenticated) {
            navigate('/dashboard');
          }
        } catch (error) {
          // Silently fail, stay on landing page
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };
    
    checkAuth();
  }, [navigate]);

  const features = [
    {
      name: t('landing.features.orgStructure.title'),
      description: t('landing.features.orgStructure.description'),
      icon: Users,
    },
    {
      name: t('landing.features.strategicPlanning.title'),
      description: t('landing.features.strategicPlanning.description'),
      icon: Target,
    },
    {
      name: t('landing.features.teamManagement.title'),
      description: t('landing.features.teamManagement.description'),
      icon: FileText,
    },
    {
      name: t('landing.features.metadataManagement.title'),
      description: t('landing.features.metadataManagement.description'),
      icon: List,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="relative bg-gradient-to-r from-green-700 to-blue-700 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80" 
            alt="Healthcare background" 
            className="w-full h-full object-cover opacity-15"
          />
        </div>
        <div className="absolute top-4 right-4">
          <LanguageSwitch />
        </div>
        <div className="relative max-w-7xl mx-auto py-32 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <img 
                src="/assets/moh.png" 
                alt="Ministry of Health Ethiopia"
                className="h-28 w-auto rounded-full bg-white/50 p-2 shadow-lg"
              />
            </div>
            <h1 className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl drop-shadow-md">
              {t('landing.title')}
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-white sm:text-lg md:mt-5 md:text-xl md:max-w-3xl drop-shadow-md">
              {t('landing.subtitle')}
            </p>
            <div className="mt-10 flex justify-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 border border-transparent text-base font-medium rounded-lg text-green-700 bg-white hover:bg-gray-100 shadow-lg transition-all md:py-4 md:text-lg md:px-10 hover:scale-105"
              >
                {t('landing.getStarted')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl mb-4">
              {t('landing.everythingYouNeed')}
            </h2>
            <p className="max-w-2xl mx-auto text-gray-500">
              Our comprehensive platform integrates planning, monitoring and evaluation in one seamless experience
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => {
                const iconColors = [
                  "bg-green-600",
                  "bg-blue-600", 
                  "bg-indigo-600", 
                  "bg-purple-600"
                ];
                return (
                  <div key={feature.name} className="pt-6">
                    <div className="flow-root bg-white rounded-xl px-6 pb-8 shadow-md hover:shadow-lg transition-shadow">
                      <div className="-mt-6">
                        <div>
                          <span className={`inline-flex items-center justify-center p-3 ${iconColors[index]} rounded-md shadow-lg`}>
                            <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                          </span>
                        </div>
                        <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                          {feature.name}
                        </h3>
                        <p className="mt-5 text-base text-gray-500">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      <div className="py-12 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-wrap justify-center items-center gap-8 mt-8">
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md">
              <Heart className="h-10 w-10 text-red-500 mb-2" />
              <h3 className="text-lg font-medium">Improved Health Outcomes</h3>
            </div>
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md">
              <Activity className="h-10 w-10 text-green-500 mb-2" />
              <h3 className="text-lg font-medium">Effective Program Management</h3>
            </div>
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md">
              <Calendar className="h-10 w-10 text-blue-500 mb-2" />
              <h3 className="text-lg font-medium">Strategic Planning & Reporting</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;