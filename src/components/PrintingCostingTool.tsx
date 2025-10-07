import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Calculator, DollarSign, Info, AlertCircle } from 'lucide-react';
import type { PrintingCost } from '../types/costing';
import { DOCUMENT_TYPES } from '../types/costing';

interface PrintingCostingToolProps {
  onCalculate: (costs: PrintingCost) => void;
  onCancel: () => void;
  initialData?: PrintingCost;
}

const PrintingCostingTool: React.FC<PrintingCostingToolProps> = ({ 
  onCalculate, 
  onCancel,
  initialData 
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { register, watch, setValue, handleSubmit, formState: { errors } } = useForm<PrintingCost>({
    defaultValues: initialData || {
      description: '',
      documentType: 'Manual',
      numberOfPages: 1,
      numberOfCopies: 1,
      otherCosts: 0
    }
  });

  const watchDocumentType = watch('documentType');
  const watchNumberOfPages = watch('numberOfPages');
  const watchNumberOfCopies = watch('numberOfCopies');
  const watchOtherCosts = watch('otherCosts');

  useEffect(() => {
    const calculateTotalBudget = () => {
      // Get cost per page based on document type
      const documentConfig = DOCUMENT_TYPES.find(doc => doc.value === watchDocumentType);
      const costPerPage = documentConfig?.costPerPage || 0;
      
      // Calculate printing cost
      const printingCost = costPerPage * (Number(watchNumberOfPages) || 0) * (Number(watchNumberOfCopies) || 0);
      
      // Add other costs
      const otherCostsTotal = Number(watchOtherCosts) || 0;
      
      // Calculate total
      const total = printingCost + otherCostsTotal;
      
      setValue('totalBudget', total);
      return total;
    };

    calculateTotalBudget();
  }, [watchDocumentType, watchNumberOfPages, watchNumberOfCopies, watchOtherCosts, setValue]);

  const handleFormSubmit = async (data: PrintingCost) => {
    try {
      setIsCalculating(true);
      setError(null);
      
      const totalBudget = watch('totalBudget');
      
      if (!totalBudget || totalBudget <= 0) {
        setError('Total budget must be greater than 0');
        setIsCalculating(false);
        return;
      }
      
      const printingCosts: PrintingCost = {
        ...data,
        totalBudget: totalBudget || 0,
        // Ensure numeric values
        numberOfPages: Number(data.numberOfPages),
        numberOfCopies: Number(data.numberOfCopies),
        otherCosts: Number(data.otherCosts || 0)
      };
      
      console.log("Submitting printing costs:", printingCosts);
      
      try {
        // Call the onCalculate function from props
        await onCalculate(printingCosts);
        console.log("Printing calculation successfully passed to parent");
      } catch (err) {
        console.error("Error in onCalculate callback:", err);
        setError(`Failed to process: ${err instanceof Error ? err.message : String(err)}`);
        setIsCalculating(false);
      }
    } catch (error: any) {
      console.error('Failed to process printing costs:', error);
      setError(error.message || 'Failed to process printing costs. Please try again.');
      setIsCalculating(false);
    }
  };

  return (
    // <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[75vh] overflow-y-auto p-2 pb-20">
      <div className="flex items-center justify-between">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex-1">
          <h3 className="text-lg font-medium text-blue-800 mb-2 flex items-center">
            <Calculator className="h-5 w-5 mr-2" />
            Printing Cost Calculator
          </h3>
          <p className="text-sm text-blue-600">
            Fill in the printing details below to calculate the total budget.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="ml-4 p-2 text-gray-400 hover:text-gray-500"
        >
          <span className="sr-only">Cancel</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description of Printing Activity
        </label>
        <textarea
          {...register('description', { required: 'Description is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Describe what will be printed..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Document Type
        </label>
        <select
          {...register('documentType', { required: 'Document type is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {DOCUMENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label} (ETB {type.costPerPage}/page)
            </option>
          ))}
        </select>
        {errors.documentType && (
          <p className="mt-1 text-sm text-red-600">{errors.documentType.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Pages
          </label>
          <input
            type="number"
            min="1"
            {...register('numberOfPages', {
              required: 'Number of pages is required',
              min: { value: 1, message: 'Minimum 1 page required' },
              valueAsNumber: true
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.numberOfPages && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfPages.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Copies
          </label>
          <input
            type="number"
            min="1"
            {...register('numberOfCopies', {
              required: 'Number of copies is required',
              min: { value: 1, message: 'Minimum 1 copy required' },
              valueAsNumber: true
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.numberOfCopies && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfCopies.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Other Costs (ETB)
        </label>
        <input
          type="number"
          min="0"
          {...register('otherCosts', {
            min: { value: 0, message: 'Cannot be negative' },
            valueAsNumber: true
          })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="0"
        />
        {errors.otherCosts && (
          <p className="mt-1 text-sm text-red-600">{errors.otherCosts.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Justification for Additional Costs
        </label>
        <textarea
          {...register('justification')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Explain any additional costs..."
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-lg font-medium text-gray-900">Total Printing Budget</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-2xl font-bold text-green-600">
              ETB {watch('totalBudget')?.toLocaleString() || '0'}
            </span>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isCalculating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCalculating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {isCalculating ? (
                  <>
                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Continue to Budget Form'
                )}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500 flex items-center">
          <Info className="h-4 w-4 mr-1" />
          This total is calculated based on the document type, number of pages, copies, and standard rates
        </p>
      </div>
    </form>
  );
};

export default PrintingCostingTool;