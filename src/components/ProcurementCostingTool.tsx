import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Calculator, DollarSign, Info, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { ProcurementCost } from '../types/costing';
import { procurementItems } from '../lib/api';

// Fallback data for procurement items if API fails
const DEFAULT_PROCUREMENT_ITEMS = [
  { id: 'fallback-1', name: 'Computer', category: 'COMPUTER_EQUIPMENT', unit: 'PIECE', unit_price: 30000 },
  { id: 'fallback-2', name: 'Chair', category: 'FURNITURE', unit: 'PIECE', unit_price: 3000 }
];

interface ProcurementCostingToolProps {
  onCalculate: (costs: ProcurementCost) => void;
  onCancel: () => void;
  initialData?: ProcurementCost;
}

const ProcurementCostingTool: React.FC<ProcurementCostingToolProps> = ({ 
  onCalculate, 
  onCancel,
  initialData 
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procurementItemsData, setProcurementItemsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  
  const { register, control, watch, setValue, handleSubmit, formState: { errors } } = useForm<ProcurementCost>({
    defaultValues: initialData || {
      description: '',
      items: [{ itemId: '', quantity: 1 }],
      otherCosts: 0
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const watchItems = watch('items');
  const watchOtherCosts = watch('otherCosts');

  // Watch for all form changes to trigger recalculation
  const watchedValues = watch();

  // Get API base URL
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    setApiBaseUrl(apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl);
    console.log('API Base URL for procurement tool:', apiUrl);
  }, []);

  // Fetch procurement items from the database
  useEffect(() => {
    const fetchProcurementItems = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching procurement items data...');
        setError(null);
        
        const response = await procurementItems.getAll();
        
        console.log('Procurement items response received:', response?.data ? 'yes, with data' : 'no data');
        
        if (!response?.data || !Array.isArray(response.data)) {
          console.error('Invalid procurement items data received in ProcurementCostingTool', 
            response?.data ? typeof response.data : 'no data received');
          console.log('Using fallback procurement items');
          // Use fallback data instead of throwing error
          setProcurementItemsData(DEFAULT_PROCUREMENT_ITEMS);
          setIsLoading(false);
          return;
        }
        
        const itemsData = response?.data || [];
        console.log(`Successfully loaded ${itemsData.length} procurement items`);
        setProcurementItemsData(itemsData);
        
        // Set default item if available
        if (itemsData.length > 0 && !initialData?.items?.length) {
          setValue('items', [{ itemId: itemsData[0].id, quantity: 1 }]);
        }
      } catch (error) {
        console.error('Failed to fetch procurement items data:', error, 
          error.response?.data || 'No response data');
        console.error('API URL used:', apiBaseUrl || 'Not defined');
        
        // More detailed error message
        let errorMessage = 'Failed to load procurement items from database. ';
        if (error.response) {
          errorMessage += `Server responded with status ${error.response.status}.`;
        } else if (error.request) {
          errorMessage += 'No response received from server.';
        } else {
          errorMessage += error.message || 'Unknown error occurred.';
        }
        setError(errorMessage);
        
        // Use fallback data
        setProcurementItemsData(DEFAULT_PROCUREMENT_ITEMS);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProcurementItems();
  }, [setValue, initialData]);

  // Calculate subtotal for a specific item
  const calculateItemSubtotal = (itemId: string, quantity: number) => {
    console.log('calculateItemSubtotal called with:', { itemId, quantity, dataLength: procurementItemsData.length });
    
    if (!itemId || !quantity || quantity <= 0) {
      console.log('Early return: missing itemId or invalid quantity');
      return 0;
    }
    
    const selectedItem = procurementItemsData.find(item => String(item.id) === String(itemId));
    if (!selectedItem) {
      console.log('Item not found in data:', itemId);
      return 0;
    }
    
    const unitPrice = Number(selectedItem.unit_price) || 0;
    const subtotal = quantity * unitPrice;
    
    console.log(`Item calculation: ${selectedItem.name} - ${quantity} × ${unitPrice} = ${subtotal}`);
    return subtotal;
  };

  // Calculate total budget whenever items or costs change
  useEffect(() => {
    const calculateTotalBudget = () => {
      console.log('=== Calculating Total Budget ===');
      console.log('Watch Items:', JSON.stringify(watchItems, null, 2));
      console.log('Procurement Data Length:', procurementItemsData.length);
      console.log('Other Costs:', watchOtherCosts);
      
      if (!watchItems || !Array.isArray(watchItems) || procurementItemsData.length === 0) {
        console.log('Early exit: No items or data not loaded');
        setValue('totalBudget', 0);
        return 0;
      }
      
      // Calculate items cost
      const itemsTotal = watchItems.reduce((sum, item, index) => {
        console.log(`Processing item ${index}:`, JSON.stringify(item, null, 2));
        
        if (!item.itemId || !item.quantity) {
          console.log('Skipping item: missing itemId or quantity');
          return sum;
        }
        
        const selectedItem = procurementItemsData.find(dbItem => {
          const match = String(dbItem.id) === String(item.itemId);
          console.log(`Checking item ${dbItem.id} (${dbItem.name}) against ${item.itemId}: ${match}`);
          return match;
        });
        
        if (!selectedItem) {
          console.log('Item not found in database:', item.itemId, 'Available items:', procurementItemsData.map(i => i.id));
          return sum;
        }
        
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(selectedItem.unit_price) || 0;
        const subtotal = quantity * unitPrice;
        
        console.log(`Item: ${selectedItem.name}, Qty: ${quantity}, Price: ${unitPrice}, Subtotal: ${subtotal}`);
        return sum + subtotal;
      }, 0);
      
      console.log('Total Items Cost:', itemsTotal);
      
      // Add other costs
      const otherCostsTotal = Number(watchOtherCosts) || 0;
      console.log('Other Costs Total:', otherCostsTotal);
      
      // Calculate total
      const total = itemsTotal + otherCostsTotal;
      console.log('FINAL TOTAL:', total);
      
      setValue('totalBudget', total);
      return total;
    };

    calculateTotalBudget();
  }, [watchItems, watchOtherCosts, procurementItemsData, setValue]);

  // Separate effect to trigger calculation when form changes
  useEffect(() => {
    console.log('Form values changed, triggering recalculation');
    if (procurementItemsData.length > 0) {
      const items = watchItems || [];
      const itemsTotal = items.reduce((sum, item, index) => {
        console.log(`Recalc item ${index}:`, item);
        if (!item?.itemId || !item?.quantity) return sum;
        
        const selectedItem = procurementItemsData.find(dbItem => 
          String(dbItem.id) === String(item.itemId)
        );
        
        if (!selectedItem) return sum;
        
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(selectedItem.unit_price) || 0;
        const subtotal = quantity * unitPrice;
        
        console.log(`Item calc: ${selectedItem.name} - ${quantity} × ${unitPrice} = ${subtotal}`);
        return sum + subtotal;
      }, 0);
      
      const otherCosts = Number(watchOtherCosts) || 0;
      const total = itemsTotal + otherCosts;
      
      console.log(`Setting total budget: ${itemsTotal} + ${otherCosts} = ${total}`);
      setValue('totalBudget', total);
    }
  }, [watchedValues, procurementItemsData, setValue]);

  const handleFormSubmit = async (data: ProcurementCost) => {
    try {
      setIsCalculating(true);
      setError(null);

      // Make sure we have a valid budget amount
      const calculatedBudget = watch('totalBudget') || 0;
      
      console.log('Procurement calculated budget:', calculatedBudget);
      
      if (!calculatedBudget || calculatedBudget <= 0) {
        setError('Total budget must be greater than 0');
        return;
      }
      
      // Prepare streamlined data for the budget form
      const budgetData = {
        activity: data.activity,
        budget_calculation_type: 'WITH_TOOL',
        activity_type: 'Procurement', // Explicitly set type
        estimated_cost_with_tool: calculatedBudget || 0,
        totalBudget: calculatedBudget || 0, // Add totalBudget for consistency
        estimated_cost: calculatedBudget || 0, // Add estimated_cost for consistency
        estimated_cost_without_tool: 0, // Not used since we're using the tool
        government_treasury: 0,
        sdg_funding: 0,
        partners_funding: 0,
        other_funding: 0,
        procurement_details: {
          description: data.description,
          items: data.items,
          otherCosts: Number(data.otherCosts) || 0,
          justification: data.justification
        }
      };
      
      // Pass the prepared budget data to the parent component
      onCalculate(budgetData);
    } catch (err: any) {
      console.error('Failed to process procurement costs:', err);
      setError(err.message || 'Failed to process costs. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Show loading state while fetching data
  if (isLoading) {
    return <div className="flex flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mb-4"></div>
      <p className="text-gray-700">Loading procurement items from database...</p>
    </div>;
  }

  // If no procurement items are available, show an error
  if ((!procurementItemsData || procurementItemsData.length === 0) && !isLoading) {
    return <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center text-red-500 mb-2">
        <AlertCircle className="h-6 w-6 mr-2 flex-shrink-0" />
        <h3 className="text-lg font-medium text-red-800">Procurement items not available</h3>
      </div>
      <p className="text-red-600 mb-4">Could not load procurement items from the database. The system will use default values.</p>
      <p className="text-sm text-red-600 mb-2">
        {error ? `Error details: ${error}` : "Using default procurement items instead."}
      </p>
      <button
        onClick={() => {
          // Set default procurement items and continue
          setProcurementItemsData(DEFAULT_PROCUREMENT_ITEMS);
          setIsLoading(false);
        }}
        className="px-4 py-2 mb-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2"
      >
        Use Default Items
      </button>
      <button 
        onClick={onCancel} 
        className="mt-4 px-4 py-2 bg-white border border-red-300 rounded-md text-red-700 hover:bg-red-50"
      >
        Go Back
      </button>
    </div>;
  }
  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[75vh] overflow-y-auto p-2 pb-20">
      <div className="flex items-center justify-between">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex-1">
          <h3 className="text-lg font-medium text-blue-800 mb-2 flex items-center">
            <Calculator className="h-5 w-5 mr-2" />
            Procurement Cost Calculator
          </h3>
          <p className="text-sm text-blue-600">
            Fill in the procurement details below to calculate the total budget.
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
          <p className="text-sm text-red-600 break-words">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description of Procurement Activity
        </label>
        <textarea
          {...register('description', { required: 'Description is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Describe the procurement activity..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Procurement Item List
          </label>
          <button
            type="button"
            onClick={() => append({ 
              itemId: procurementItemsData[0]?.id || '',
              quantity: 1,
              unitPrice: undefined // Remove unitPrice from new items
            })}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => {
            const selectedItem = procurementItemsData.find(
              item => item.id === watchItems?.[index]?.itemId
            );
            
            const currentItem = watchItems?.[index];
            const currentQuantity = Number(currentItem?.quantity) || 0;
            
            // Calculate subtotal with debugging
            let currentSubtotal = 0;
            if (selectedItem && currentQuantity > 0) {
              const unitPrice = Number(selectedItem.unit_price) || 0;
              currentSubtotal = currentQuantity * unitPrice;
              console.log(`Subtotal for item ${index}: ${currentQuantity} × ${unitPrice} = ${currentSubtotal}`);
            }
            
            return (
              <div key={field.id} className="flex items-start space-x-4 bg-gray-50 p-4 rounded-lg">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Item Name
                    </label>
                    <select
                      {...register(`items.${index}.itemId` as const, { 
                        required: 'Please select an item from the list' 
                      })}
                      onChange={(e) => {
                        // Manually trigger form update
                        const value = e.target.value;
                        console.log(`Item ${index} selected:`, value);
                        setValue(`items.${index}.itemId`, value);
                        
                        // Force re-calculation by updating the watched values
                        const currentItems = watchItems || [];
                        const updatedItems = [...currentItems];
                        if (updatedItems[index]) {
                          updatedItems[index] = { ...updatedItems[index], itemId: value };
                          console.log('Updated items array:', updatedItems);
                        }
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Select an item...</option>
                      {procurementItemsData.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.category_display}) - ETB {Number(item.unit_price).toLocaleString()}/{item.unit_display}
                        </option>
                      ))}
                    </select>
                    {errors.items?.[index]?.itemId && (
                      <p className="mt-1 text-sm text-red-600">{errors.items[index].itemId.message}</p>
                    )}
                  </div>

                  {selectedItem && (
                    <div className="bg-blue-50 p-3 rounded-md">
                      <p className="text-sm text-blue-700">
                        <strong>Category:</strong> {selectedItem.category_display}<br/>
                        <strong>Unit:</strong> {selectedItem.unit_display}<br/>
                        <strong>Unit Price:</strong> ETB {Number(selectedItem.unit_price).toLocaleString()}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      {...register(`items.${index}.quantity` as const, {
                        required: 'Quantity is required',
                        min: { value: 1, message: 'Minimum 1 required' },
                        valueAsNumber: true
                      })}
                      onChange={(e) => {
                        // Manually trigger form update
                        const value = Number(e.target.value) || 0;
                        console.log(`Item ${index} quantity changed:`, value);
                        setValue(`items.${index}.quantity`, value);
                        
                        // Force re-calculation by updating the watched values
                        const currentItems = watchItems || [];
                        const updatedItems = [...currentItems];
                        if (updatedItems[index]) {
                          updatedItems[index] = { ...updatedItems[index], quantity: value };
                          console.log('Updated items array with quantity:', updatedItems);
                        }
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    {errors.items?.[index]?.quantity && (
                      <p className="mt-1 text-sm text-red-600">{errors.items[index].quantity.message}</p>
                    )}
                  </div>

                  {selectedItem && currentQuantity > 0 && (
                    <div className="bg-green-50 p-3 rounded-md border border-green-200">
                      <p className="text-sm text-green-700 flex justify-between">
                        <span>Item Subtotal:</span>
                        <span className="font-bold">ETB {currentSubtotal.toLocaleString()}</span>
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {currentQuantity} × ETB {Number(selectedItem.unit_price).toLocaleString()} per {selectedItem.unit_display}
                      </p>
                    </div>
                  )}
                  
                  {(!selectedItem || currentQuantity === 0) && (
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                      <p className="text-sm text-gray-500">
                        {!selectedItem ? 'Select an item to see pricing' : 'Enter quantity to see subtotal'}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            );
          })}
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
            <DollarSign className="h-5 w-5 text-green-600 mr-1 flex-shrink-0" />
            <span className="text-lg font-medium text-gray-900">Procurement Budget</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-green-600">
              ETB {watch('totalBudget')?.toLocaleString() || '0'}
            </span>
          </div>
        </div>
        
        {/* Breakdown of costs */}
        <div className="mt-3 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Items Cost:</span>
            <span className="font-medium">ETB {(() => {
              const items = watchItems || [];
              const total = items.reduce((sum, item, index) => {
                console.log(`Breakdown calc for item ${index}:`, item);
                if (!item?.itemId || !item?.quantity) return sum;
                const selectedItem = procurementItemsData.find(dbItem => 
                  String(dbItem.id) === String(item.itemId)
                );
                if (!selectedItem) return sum;
                const subtotal = Number(item.quantity) * Number(selectedItem.unit_price || 0);
                console.log(`Breakdown item ${index}: ${selectedItem.name} = ${subtotal}`);
                return sum + subtotal;
              }, 0);
              console.log(`Items cost total: ${total}`);
              return total.toLocaleString();
            })()}</span>
          </div>
          <div className="flex justify-between">
            <span>Other Costs:</span>
            <span className="font-medium">ETB {(Number(watchOtherCosts) || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-medium border-t border-gray-300 pt-1 mt-1">
            <span>Total:</span>
            <span className="text-green-600">ETB {(watch('totalBudget') || 0).toLocaleString()}</span>
          </div>
        </div>
        
        <p className="mt-2 text-sm text-gray-500 flex items-center">
          <Info className="h-4 w-4 mr-1" />
          This total is calculated based on the selected items, quantities, and database rates
        </p>
      </div>

      <div className="flex justify-end space-x-2 sticky bottom-0 left-0 right-0 bg-white py-4 px-2 border-t border-gray-200 shadow-md z-10">
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
            'Apply and Continue to Funding Sources'
          )}
        </button>
      </div>
    </form>
  );
};

export default ProcurementCostingTool;