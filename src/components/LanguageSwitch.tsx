import React from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Languages } from 'lucide-react';

const LanguageSwitch: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
      className="flex items-center gap-2 px-3 py-2 text-blue-100 hover:text-white rounded-md"
    >
      <Languages className="h-5 w-5" />
      <span>{language === 'en' ? 'አማርኛ' : 'English'}</span>
    </button>
  );
};

export default LanguageSwitch;