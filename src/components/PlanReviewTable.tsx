import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { FileSpreadsheet, Download, AlertCircle, Info, Building2, User, Calendar, FileType, CheckCircle, Send, Loader } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../lib/utils/export';
import type { StrategicObjective } from '../types/organization';
import type { PlanType } from '../types/plan';

// Define months with their quarters
const MONTHS = [
  { value: 'JUL', quarter: 'Q1', abbr: 'Jul', fullName: 'July', order: 1 },
  { value: 'AUG', quarter: 'Q1', abbr: 'Aug', fullName: 'August', order: 2 },
  { value: 'SEP', quarter: 'Q1', abbr: 'Sep', fullName: 'September', order: 3 },
  { value: 'OCT', quarter: 'Q2', abbr: 'Oct', fullName: 'October', order: 4 },
  { value: 'NOV', quarter: 'Q2', abbr: 'Nov', fullName: 'November', order: 5 },
  { value: 'DEC', quarter: 'Q2', abbr: 'Dec', fullName: 'December', order: 6 },
  { value: 'JAN', quarter: 'Q3', abbr: 'Jan', fullName: 'January', order: 7 },
  { value: 'FEB', quarter: 'Q3', abbr: 'Feb', fullName: 'February', order: 8 },
  { value: 'MAR', quarter: 'Q3', abbr: 'Mar', fullName: 'March', order: 9 },
  { value: 'APR', quarter: 'Q4', abbr: 'Apr', fullName: 'April', order: 10 },
  { value: 'MAY', quarter: 'Q4', abbr: 'May', fullName: 'May', order: 11 },
  { value: 'JUN', quarter: 'Q4', abbr: 'Jun', fullName: 'June', order: 12 },
];

// Helper function to check if a month is selected for an item
const isMonthSelected = (item: any, monthValue: string): boolean => {
  try {
    // CRITICAL FIX: Comprehensive null/undefined checks
    if (!item) {
      console.warn('isMonthSelected: item is null or undefined for month:', monthValue);
      return false;
    }
    
    // Additional safety checks for item structure
    if (typeof item !== 'object') {
      console.warn('isMonthSelected: item is not an object:', typeof item);
      return false;
    }
    
    const selectedMonths = item.selected_months || [];
    const selectedQuarters = item.selected_quarters || [];

    // Find the month object
    const monthObj = MONTHS.find(m => m.value === monthValue);
    if (!monthObj) return false;

    // If quarters are selected and this month's quarter is included
    if (selectedQuarters && selectedQuarters.includes(monthObj.quarter)) {
      return true;
    }

    // If individual months are selected
    if (selectedMonths && selectedMonths.length > 0) {
      return selectedMonths.includes(monthValue) ||
             selectedMonths.includes(monthObj.fullName) ||
             selectedMonths.includes(monthObj.abbr) ||
             selectedMonths.some((selected: string) =>
               selected.toLowerCase() === monthValue.toLowerCase() ||
               selected.toLowerCase() === monthObj.fullName.toLowerCase() ||
               selected.toLowerCase() === monthObj.abbr.toLowerCase()
             );
    }

    return false;
  } catch (error) {
    console.error(`Error checking if month ${monthValue} is selected:`, error);
    return false;
  }
};

interface PlanReviewTableProps {
  objectives: StrategicObjective[];
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  organizationName: string;
  plannerName: string;
  fromDate: string;
  toDate: string;
  planType: PlanType;
  isPreviewMode?: boolean;
  plannerOrgId?: number | null;
  isViewOnly?: boolean;
}

const PlanReviewTable: React.FC<PlanReviewTableProps> = ({
  objectives,
  onSubmit,
  isSubmitting,
  organizationName,
  plannerName,
  fromDate,
  toDate,
  planType,
  isPreviewMode = false,
  plannerOrgId = null,
  isViewOnly = false
}) => {
  const { t } = useLanguage();
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataProcessingError, setDataProcessingError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  // Helper function to get selected months for a specific quarter
  const getMonthsForQuarter = (
    selectedMonths: string[] | null,
    selectedQuarters: string[] | null,
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  ): string[] => {
    try {
      if (!selectedMonths && !selectedQuarters) {
        return [];
      }

      // If quarters are selected, return all months in that quarter
      if (selectedQuarters && selectedQuarters.includes(quarter)) {
        return MONTHS
          .filter(month => month.quarter === quarter)
          .map(month => month.abbr);
      }

      // If individual months are selected, return them for the quarter
      if (selectedMonths && selectedMonths.length > 0) {
        const quarterMonths = MONTHS
          .filter(month =>
            month.quarter === quarter && (
              selectedMonths.includes(month.value) ||
              selectedMonths.includes(month.fullName) ||
              selectedMonths.includes(month.abbr)
            )
          )
          .map(month => month.abbr);

        return quarterMonths;
      }

      return [];
    } catch (error) {
      console.error(`Error getting months for ${quarter}:`, error);
      return [];
    }
  };

  // Enhanced function to get months with better matching
  const getSelectedMonthsForQuarter = (item: any, quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'): string => {
    try {
      const selectedMonths = item.selected_months || [];
      const selectedQuarters = item.selected_quarters || [];

      // If quarters are selected and this quarter is included
      if (selectedQuarters && selectedQuarters.includes(quarter)) {
        const quarterMonths = MONTHS
          .filter(month => month.quarter === quarter)
          .map(month => month.abbr);
        return quarterMonths.join(', ');
      }

      // If individual months are selected
      if (selectedMonths && selectedMonths.length > 0) {
        const matchedMonths = MONTHS
          .filter(month => {
            return month.quarter === quarter && (
              selectedMonths.includes(month.value) ||
              selectedMonths.includes(month.fullName) ||
              selectedMonths.includes(month.abbr) ||
              selectedMonths.some((selected: string) =>
                selected.toLowerCase() === month.value.toLowerCase() ||
                selected.toLowerCase() === month.fullName.toLowerCase() ||
                selected.toLowerCase() === month.abbr.toLowerCase()
              )
            );
          })
          .map(month => month.abbr);

        return matchedMonths.length > 0 ? matchedMonths.join(', ') : '';
      }

      return '';
    } catch (error) {
      console.error(`Error getting selected months for ${quarter}:`, error);
      return '';
    }
  };

  // Format quarter target with months
  const formatQuarterTargetWithMonths = (target: any, months: string): string => {
    const targetValue = target === '-' || target === null || target === undefined ? '-' : target;

    if (months && months.trim()) {
      return `${targetValue} (${months})`;
    } else {
      return targetValue.toString();
    }
  };

  // Process and filter data for the planner's organization
  const processedData = useMemo(() => {
    try {
      setDataProcessingError(null);

      if (!objectives || !Array.isArray(objectives)) {
        return [];
      }

      const exportData: any[] = [];

      objectives.forEach((objective, objIndex) => {
        if (!objective) return;

        // Get the actual selected objective weight from the plan's selected_objectives_weights
        // This ensures we show the weight that was actually selected for this plan
        let objectiveWeight = objective.weight ?? 0;

        // Try to get the weight from effective_weight first (this should be the selected weight)
        if (objective.effective_weight !== undefined) {
          objectiveWeight = objective.effective_weight;
        }
        // Then try planner_weight if available
        else if (objective.planner_weight !== undefined && objective.planner_weight !== null) {
          objectiveWeight = objective.planner_weight;
        }

        console.log(`Objective ${objective.title}: using weight ${objectiveWeight} (effective: ${objective.effective_weight}, planner: ${objective.planner_weight}, original: ${objective.weight})`);

        let objectiveAdded = false;

        // Get relevant initiatives for this objective
        const relevantInitiatives = (objective.strategic_initiatives || []).filter(initiative => {
          if (!initiative) return false;
          
          // ADMIN FIX: Main activities are already filtered by AdminPlanSummary
          console.log(`PlanReviewTable: Including initiative "${initiative.name}" (pre-filtered)`);
          return true;
        });

        if (relevantInitiatives.length === 0) {
          exportData.push({
            No: (objIndex + 1).toString(),
            'Strategic Objective': objective.title || 'Untitled Objective',
            'Strategic Objective Weight': `${objectiveWeight.toFixed(1)}%`,
            'Strategic Initiative': 'No initiatives available',
            'Initiative Weight': '-',
            'Performance Measure/Main Activity': 'No measures or activities',
            'Weight': '-',
            'Baseline': '-',
            'Q1Target': '-',
            'Q2Target': '-',
            'SixMonthTarget': '-',
            'Q3Target': '-',
            'Q4Target': '-',
            'AnnualTarget': '-',
            'Implementor': organizationName,
            'BudgetRequired': '-',
            'Government': '-',
            'Partners': '-',
            'SDG': '-',
            'Other': '-',
            'TotalAvailable': '-',
            'Gap': '-',
          });
          objectiveAdded = true;
          return;
        }

        relevantInitiatives.forEach((initiative) => {
          if (!initiative) return;

          // Use main activities as-is since AdminPlanSummary already filtered them
          const mainActivities = initiative.main_activities || [];
          console.log(`PlanReviewTable: Initiative "${initiative.name}" has ${mainActivities.length} main activities (pre-filtered)`);

          // Use performance measures as-is since AdminPlanSummary already filtered them
          const performanceMeasures = initiative.performance_measures || [];
          console.log(`PlanReviewTable: Initiative "${initiative.name}" has ${performanceMeasures.length} performance measures (pre-filtered)`);

          const allItems = [...performanceMeasures, ...mainActivities];

          if (allItems.length === 0) {
            exportData.push({
              No: objectiveAdded ? '' : (objIndex + 1).toString(),
              'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
              'Strategic Objective Weight': objectiveAdded ? '' : `${objectiveWeight.toFixed(1)}%`,
              'Strategic Initiative': initiative.name || 'Untitled Initiative',
              'Initiative Weight': `${initiative.weight || 0}%`,
              'Performance Measure/Main Activity': 'No measures or activities',
              'Weight': '-',
              'Baseline': '-',
              'Q1Target': '-',
              'Q2Target': '-',
              'SixMonthTarget': '-',
              'Q3Target': '-',
              'Q4Target': '-',
              'AnnualTarget': '-',
              'Implementor': organizationName,
              'BudgetRequired': '-',
              'Government': '-',
              'Partners': '-',
              'SDG': '-',
              'Other': '-',
              'TotalAvailable': '-',
              'Gap': '-',
            });
            objectiveAdded = true;
          } else {
            let initiativeAddedForObjective = false;

            allItems.forEach((item) => {
              if (!item || typeof item !== 'object') {
                console.warn('PlanReviewTable: Skipping null/invalid item');
                return;
              }

              const isPerformanceMeasure = performanceMeasures.includes(item);

              // Get selected months for each quarter with enhanced matching
              const q1Months = getSelectedMonthsForQuarter(item, 'Q1');
              const q2Months = getSelectedMonthsForQuarter(item, 'Q2');
              const q3Months = getSelectedMonthsForQuarter(item, 'Q3');
              const q4Months = getSelectedMonthsForQuarter(item, 'Q4');

              let budgetRequired = 0;
              let government = 0;
              let partners = 0;
              let sdg = 0;
              let other = 0;
              let totalAvailable = 0;
              let gap = 0;

              // Calculate budget for main activities from their sub-activities
              if (!isPerformanceMeasure) {
                // For main activities, get budget from sub-activities
                if (item.sub_activities && Array.isArray(item.sub_activities)) {
                  item.sub_activities.forEach((subActivity: any) => {
                    const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
                      ? Number(subActivity.estimated_cost_with_tool || 0)
                      : Number(subActivity.estimated_cost_without_tool || 0);

                    budgetRequired += cost;
                    government += Number(subActivity.government_treasury || 0);
                    partners += Number(subActivity.partners_funding || 0);
                    sdg += Number(subActivity.sdg_funding || 0);
                    other += Number(subActivity.other_funding || 0);
                  });
                }
                // Fallback to legacy budget field if no sub-activities
                else if (item.budget) {
                  budgetRequired = item.budget.budget_calculation_type === 'WITH_TOOL'
                    ? Number(item.budget.estimated_cost_with_tool || 0)
                    : Number(item.budget.estimated_cost_without_tool || 0);

                  government = Number(item.budget.government_treasury || 0);
                  partners = Number(item.budget.partners_funding || 0);
                  sdg = Number(item.budget.sdg_funding || 0);
                  other = Number(item.budget.other_funding || 0);
                }

                totalAvailable = government + partners + sdg + other;
                gap = Math.max(0, budgetRequired - totalAvailable);
              }

              const sixMonthTarget = item.target_type === 'cumulative'
                ? Number(item.q1_target || 0) + Number(item.q2_target || 0)
                : Number(item.q2_target || 0);

              // Get implementor name - prioritize initiative organization, then plan organization
              const implementor = initiative.is_default
                ? 'Ministry of Health (Default)'
                : (initiative.organization_name ||
                   (initiative.organization && organizationsMap[String(initiative.organization)]) ||
                   // CRITICAL FIX: Use the organization name from the plan context for proper display
                   organizationName ||
                   'Ministry of Health');

              const rowData = {
                No: objectiveAdded ? '' : (objIndex + 1).toString(),
                'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
                'Strategic Objective Weight': objectiveAdded ? '' : `${objectiveWeight.toFixed(1)}%`,
                'Strategic Initiative': initiativeAddedForObjective ? '' : (initiative.name || 'Untitled Initiative'),
                'Initiative Weight': initiativeAddedForObjective ? '' : `${initiative.weight || 0}%`,
                'Performance Measure/Main Activity': `${isPerformanceMeasure ? 'PM' : 'MA'}: ${item.name || 'Untitled Item'}`,
                'Weight': `${item.weight || 0}%`,
                'Baseline': item.baseline ?? '-',
                'Q1Target': item.q1_target ?? '-',
                'Q2Target': item.q2_target ?? '-',
                'SixMonthTarget': sixMonthTarget || '-',
                'Q3Target': item.q3_target ?? '-',
                'Q4Target': item.q4_target ?? '-',
                'AnnualTarget': item.annual_target ?? '-',
                'Implementor': implementor,
                'BudgetRequired': budgetRequired > 0 ? budgetRequired : '-',
                'Government': government > 0 ? government : '-',
                'Partners': partners > 0 ? partners : '-',
                'SDG': sdg > 0 ? sdg : '-',
                'Other': other > 0 ? other : '-',
                'TotalAvailable': totalAvailable > 0 ? totalAvailable : '-',
                'Gap': gap > 0 ? gap : '-',
                // Add month selection data for each item
                'selectedMonths': item.selected_months || [],
                'selectedQuarters': item.selected_quarters || [],
                'itemData': item // Store full item data for month checking
              };

              exportData.push(rowData);

              objectiveAdded = true;
              initiativeAddedForObjective = true;
            });
          }
        });
      });

      return exportData;
    } catch (error: any) {
      console.error('PlanReviewTable: Error processing data:', error);
      setDataProcessingError(`Failed to process plan data: ${error.message}`);
      return [];
    }
  }, [objectives, plannerOrgId, organizationName, organizationsMap]);

  // Show error if data processing failed
  if (dataProcessingError) {
    return (
      <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800">Data Processing Error</h3>
        <p className="text-red-600 mt-2">{dataProcessingError}</p>
        <button
          onClick={() => setDataProcessingError(null)}
          className="mt-4 px-4 py-2 bg-white border border-red-300 rounded-md text-red-700 hover:bg-red-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  const handleExportExcel = () => {
    if (processedData.length === 0) return;
    try {
      exportToExcel(
        processedData,
        `plan-${new Date().toISOString().slice(0, 10)}`,
        'en',
        { organization: organizationName, planner: plannerName, fromDate, toDate, planType }
      );
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  const handleExportPDF = () => {
    if (processedData.length === 0) return;
    try {
      exportToPDF(
        processedData,
        `plan-${new Date().toISOString().slice(0, 10)}`,
        'en',
        { organization: organizationName, planner: plannerName, fromDate, toDate, planType }
      );
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    }
  };

  const handleSubmit = async () => {
    if (isViewOnly || isPreviewMode) return;

    setIsProcessing(true);
    try {
      await onSubmit({
        objectives: objectives,
        plannerOrgId: plannerOrgId,
        processedData: processedData
      });
    } catch (error) {
      console.error('Error submitting plan:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  if (!objectives || objectives.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Objectives Available</h3>
        <p className="text-gray-500">No objectives have been selected for this plan.</p>
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <div className="text-center p-8 bg-yellow-50 rounded-lg border border-yellow-200">
        <Info className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-800 mb-2">No Complete Data Available</h3>
        <p className="text-yellow-700">
          The selected objectives don't have complete data (initiatives, measures, or activities) for your organization.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug Toggle */}
      {debugMode && (
        <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
          <h4 className="font-medium text-yellow-800 mb-2">Debug Information</h4>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>Planner Organization ID: {plannerOrgId || 'Not set'}</p>
            <p>Total Objectives: {objectives.length}</p>
            <p>Processed Rows: {processedData.length}</p>
            <p>Organization Name: {organizationName}</p>
          </div>
          <label className="flex items-center text-sm mt-2">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="mr-2"
            />
            Hide Debug Info
          </label>
        </div>
      )}

      {!debugMode && (
        <div className="bg-blue-50 p-2 rounded border border-blue-200">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="mr-2"
            />
            Show Debug Info
          </label>
        </div>
      )}

      {/* Plan Information Header */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center">
            <Building2 className="h-5 w-5 text-gray-500 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Organization</p>
              <p className="font-medium text-gray-900">{organizationName}</p>
            </div>
          </div>
          <div className="flex items-center">
            <User className="h-5 w-5 text-gray-500 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Planner</p>
              <p className="font-medium text-gray-900">{plannerName}</p>
            </div>
          </div>
          <div className="flex items-center">
            <FileType className="h-5 w-5 text-gray-500 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Plan Type</p>
              <p className="font-medium text-gray-900">{planType}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-gray-500 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Period</p>
              <p className="font-medium text-gray-900">{fromDate} - {toDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={handleExportExcel}
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </button>
        <button
          onClick={handleExportPDF}
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </button>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Plan Details Table</h3>
            <div className="text-sm text-gray-600">
              Showing {processedData.length} rows from {objectives.length} selected objectives
              {plannerOrgId && !isViewOnly && (
                <span className="block mt-1">
                  Editing for Organization ID: {plannerOrgId} ({organizationName})
                </span>
              )}
              {plannerOrgId && isViewOnly && (
                <span className="block mt-1">
                  Viewing plan for Organization: {organizationName} (ID: {plannerOrgId})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategic Objective</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obj. Weight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategic Initiative</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Init. Weight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance Measure/Main Activity</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Baseline</th>

                {/* Q1 Section */}
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-blue-200">
                  Jul
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aug
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sep
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Q1 Target
                </th>

                {/* Q2 Section */}
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-green-200">
                  Oct
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nov
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dec
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                  Q2 Target
                </th>

                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50">
                  6-Month
                </th>

                {/* Q3 Section */}
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-orange-200">
                  Jan
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Feb
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mar
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50">
                  Q3 Target
                </th>

                {/* Q4 Section */}
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-red-200">
                  Apr
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  May
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jun
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">
                  Q4 Target
                </th>

                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">Annual</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Implementor</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gov.</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Partners</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SDG</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Other</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gap</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{row.No}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={row['Strategic Objective']}>
                      {row['Strategic Objective']}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{row['Strategic Objective Weight']}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={row['Strategic Initiative']}>
                      {row['Strategic Initiative']}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{row['Initiative Weight']}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={row['Performance Measure/Main Activity']}>
                      {row['Performance Measure/Main Activity']}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">{row.Weight}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{row.Baseline}</td>

                  {/* Q1 Month Columns */}
                  <td className={`px-2 py-4 text-center text-xs border-l-2 border-blue-200 ${
                    (row.itemData && isMonthSelected(row.itemData, 'JUL')) ? 'bg-blue-100 text-blue-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'JUL')) ? '✓' : ''}
                  </td>
                  <td className={`px-2 py-4 text-center text-xs ${
                    (row.itemData && isMonthSelected(row.itemData, 'AUG')) ? 'bg-blue-100 text-blue-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'AUG')) ? '✓' : ''}
                  </td>
                  <td className={`px-2 py-4 text-center text-xs ${
                    (row.itemData && isMonthSelected(row.itemData, 'SEP')) ? 'bg-blue-100 text-blue-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'SEP')) ? '✓' : ''}
                  </td>
                  <td className="px-3 py-4 text-center text-sm text-blue-600 font-medium bg-blue-50">
                    {row.Q1Target}
                  </td>

                  {/* Q2 Month Columns */}
                  <td className={`px-2 py-4 text-center text-xs border-l-2 border-green-200 ${
                    (row.itemData && isMonthSelected(row.itemData, 'OCT')) ? 'bg-green-100 text-green-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'OCT')) ? '✓' : ''}
                  </td>
                  <td className={`px-2 py-4 text-center text-xs ${
                    (row.itemData && isMonthSelected(row.itemData, 'NOV')) ? 'bg-green-100 text-green-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'NOV')) ? '✓' : ''}
                  </td>
                  <td className={`px-2 py-4 text-center text-xs ${
                    (row.itemData && isMonthSelected(row.itemData, 'DEC')) ? 'bg-green-100 text-green-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'DEC')) ? '✓' : ''}
                  </td>
                  <td className="px-3 py-4 text-center text-sm text-green-600 font-medium bg-green-50">
                    {row.Q2Target}
                  </td>

                  <td className="px-3 py-4 text-center text-sm text-purple-600 font-medium bg-purple-50">
                    {row.SixMonthTarget}
                  </td>

                  {/* Q3 Month Columns */}
                  <td className={`px-2 py-4 text-center text-xs border-l-2 border-orange-200 ${
                    (row.itemData && isMonthSelected(row.itemData, 'JAN')) ? 'bg-orange-100 text-orange-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'JAN')) ? '✓' : ''}
                  </td>
                  <td className={`px-2 py-4 text-center text-xs ${
                    (row.itemData && isMonthSelected(row.itemData, 'FEB')) ? 'bg-orange-100 text-orange-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'FEB')) ? '✓' : ''}
                  </td>
                  <td className={`px-2 py-4 text-center text-xs ${
                    (row.itemData && isMonthSelected(row.itemData, 'MAR')) ? 'bg-orange-100 text-orange-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'MAR')) ? '✓' : ''}
                  </td>
                  <td className="px-3 py-4 text-center text-sm text-orange-600 font-medium bg-orange-50">
                    {row.Q3Target}
                  </td>

                  {/* Q4 Month Columns */}
                  <td className={`px-2 py-4 text-center text-xs border-l-2 border-red-200 ${
                    (row.itemData && isMonthSelected(row.itemData, 'APR')) ? 'bg-red-100 text-red-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'APR')) ? '✓' : ''}
                  </td>
                  <td className={`px-2 py-4 text-center text-xs ${
                    (row.itemData && isMonthSelected(row.itemData, 'MAY')) ? 'bg-red-100 text-red-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'MAY')) ? '✓' : ''}
                  </td>
                  <td className={`px-2 py-4 text-center text-xs ${
                    (row.itemData && isMonthSelected(row.itemData, 'JUN')) ? 'bg-red-100 text-red-800 font-medium' : 'bg-white text-gray-400'
                  }`}>
                    {(row.itemData && isMonthSelected(row.itemData, 'JUN')) ? '✓' : ''}
                  </td>
                  <td className="px-3 py-4 text-center text-sm text-red-600 font-medium bg-red-50">
                    {row.Q4Target}
                  </td>

                  <td className="px-3 py-4 text-center text-sm text-gray-900 font-medium bg-gray-100">
                    {row.AnnualTarget}
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={row.Implementor}>
                      {row.Implementor}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {row.BudgetRequired !== '-' ? `ETB ${Number(row.BudgetRequired).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-green-600">
                    {row.Government !== '-' ? `ETB ${Number(row.Government).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-blue-600">
                    {row.Partners !== '-' ? `ETB ${Number(row.Partners).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-purple-600">
                    {row.SDG !== '-' ? `ETB ${Number(row.SDG).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-orange-600">
                    {row.Other !== '-' ? `ETB ${Number(row.Other).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                    {row.TotalAvailable !== '-' ? `ETB ${Number(row.TotalAvailable).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-right">
                    <span className={`font-medium ${
                      row.Gap !== '-' && Number(row.Gap) > 0 ? 'text-red-600' : row.Gap !== '-' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {row.Gap !== '-' ? `ETB ${Number(row.Gap).toLocaleString()}` : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend for Month Selection */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Month Selection Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
            <span>Q1 Selected (Jul-Sep)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
            <span>Q2 Selected (Oct-Dec)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded mr-2"></div>
            <span>Q3 Selected (Jan-Mar)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-2"></div>
            <span>Q4 Selected (Apr-Jun)</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          ✓ indicates the month is selected for that performance measure or main activity
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-3">Plan Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Total Rows</p>
            <p className="text-2xl font-semibold text-gray-900">{processedData.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Objectives</p>
            <p className="text-2xl font-semibold text-blue-600">{objectives.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Budget</p>
            <p className="text-2xl font-semibold text-green-600">
              ETB {processedData.reduce((sum, row) => {
                const budget = row.BudgetRequired !== '-' ? Number(row.BudgetRequired) : 0;
                return sum + budget;
              }, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Funding Gap</p>
            <p className="text-2xl font-semibold text-red-600">
              ETB {processedData.reduce((sum, row) => {
                const gap = row.Gap !== '-' ? Number(row.Gap) : 0;
                return sum + gap;
              }, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      {!isPreviewMode && !isViewOnly && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isProcessing}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isSubmitting || isProcessing ? (
              <>
                <Loader className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Submit Plan
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanReviewTable;