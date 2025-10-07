import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  amount: number;
}

interface PartnerFundingSelectorProps {
  totalAvailable: number;
  onTotalChange: (total: number) => void;
  initialPartners?: Partner[];
}

// Default list of partners
const DEFAULT_PARTNERS = [
  'WHO',
  'UNICEF',
  'USAID',
  'World Bank',
  'Gates Foundation',
  'UNDP',
  'Global Fund',
  'UNAIDS',
  'UNFPA',
  'EU',
  'DFID',
  'GIZ'
];

const PartnerFundingSelector: React.FC<PartnerFundingSelectorProps> = ({ 
  totalAvailable, 
  onTotalChange,
  initialPartners = []
}) => {
  const [partners, setPartners] = useState<Partner[]>(initialPartners.length > 0 
    ? initialPartners 
    : [{ id: '1', name: '', amount: 0 }]
  );
  const [error, setError] = useState<string | null>(null);
  
  // Calculate the total funding from all partners
  const calculateTotal = () => {
    return partners.reduce((sum, partner) => sum + (Number(partner.amount) || 0), 0);
  };

  const handleAddPartner = () => {
    const newId = String(Date.now());
    setPartners([...partners, { id: newId, name: '', amount: 0 }]);
  };

  const handleRemovePartner = (id: string) => {
    const newPartners = partners.filter(partner => partner.id !== id);
    setPartners(newPartners);
    
    // Update the total after removing
    const newTotal = newPartners.reduce((sum, partner) => sum + (Number(partner.amount) || 0), 0);
    onTotalChange(newTotal);
  };

  const handlePartnerChange = (id: string, field: 'name' | 'amount', value: string | number) => {
    const updatedPartners = partners.map(partner => {
      if (partner.id === id) {
        return { 
          ...partner, 
          [field]: field === 'amount' ? Number(value) : value 
        };
      }
      return partner;
    });
    
    setPartners(updatedPartners);
    
    // Update total when amount changes
    if (field === 'amount') {
      const newTotal = updatedPartners.reduce((sum, partner) => sum + (Number(partner.amount) || 0), 0);
      onTotalChange(newTotal);
      
      // Validate the total doesn't exceed the available amount
      if (newTotal > totalAvailable) {
        setError(`Total partner funding (${newTotal}) exceeds the available amount (${totalAvailable})`);
      } else {
        setError(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Partner Funding</h3>
        <button
          type="button"
          onClick={handleAddPartner}
          className="text-xs flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Partner
        </button>
      </div>
      
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-center">
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {partners.map((partner, index) => (
        <div key={partner.id} className="flex items-center space-x-2">
          <div className="flex-grow">
            <label className="sr-only">Partner Name</label>
            <div className="relative">
              <input
                list={`partner-list-${partner.id}`}
                type="text"
                value={partner.name}
                onChange={(e) => handlePartnerChange(partner.id, 'name', e.target.value)}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Select or enter partner name"
              />
              <datalist id={`partner-list-${partner.id}`}>
                {DEFAULT_PARTNERS.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
          
          <div className="w-32">
            <label className="sr-only">Amount</label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                value={partner.amount}
                onChange={(e) => handlePartnerChange(partner.id, 'amount', e.target.value)}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00"
                min="0"
              />
            </div>
          </div>
          
          {partners.length > 1 && (
            <button
              type="button"
              onClick={() => handleRemovePartner(partner.id)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      
      <div className="pt-2 border-t border-gray-200">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Total Partner Funding:</span>
          <span className="font-bold">${calculateTotal().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default PartnerFundingSelector;