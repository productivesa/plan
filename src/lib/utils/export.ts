import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MONTHS } from '../../types/plan';

// Helper function to get selected months for a specific quarter
const getMonthsForQuarter = (selectedMonths: string[], selectedQuarters: string[], quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'): string => {
  if (!selectedMonths && !selectedQuarters) return '-';
  
  // If quarters are selected, show all months in that quarter
  if (selectedQuarters && selectedQuarters.includes(quarter)) {
    const quarterMonths = MONTHS
      .filter(month => month.quarter === quarter)
      .map(month => month.value);
    return quarterMonths.join(', ');
  }
  
  // If individual months are selected, show only selected months for that quarter
  if (selectedMonths && selectedMonths.length > 0) {
    const quarterMonths = MONTHS
      .filter(month => month.quarter === quarter && selectedMonths.includes(month.value))
      .map(month => month.value);
    return quarterMonths.length > 0 ? quarterMonths.join(', ') : '-';
  }
  
  return '-';
};

// Table headers in English and Amharic
const TABLE_HEADERS_EN = [
  'No.',
  'Strategic Objective',
  'Strategic Objective Weight',
  'Strategic Initiative',
  'Initiative Weight',
  'Performance Measure/Main Activity',
  'Weight',
  'Baseline',
  'Jul',
  'Aug', 
  'Sep',
  'Q1 Target',
  'Oct',
  'Nov',
  'Dec',
  'Q2 Target',
  '6-Month Target',
  'Jan',
  'Feb',
  'Mar',
  'Q3 Target',
  'Apr',
  'May',
  'Jun',
  'Q4 Target',
  'Annual Target',
  'Implementor',
  'Budget Required',
  'Government',
  'Partners',
  'SDG',
  'Other',
  'Total Available',
  'Gap'
];

const TABLE_HEADERS_AM = [
  'ተ.ቁ',
  'ስትራቴጂክ ዓላማ',
  'የስትራቴጂክ ዓላማ ክብደት',
  'ስትራቴጂክ ተነሳሽነት',
  'የተነሳሽነት ክብደት',
  'የአፈጻጸም መለኪያ/ዋና እንቅስቃሴ',
  'ክብደት',
  'መነሻ',
  'ሐምሌ',
  'ነሐሴ',
  'መስከረም',
  'የ1ኛ ሩብ ዓመት ዒላማ',
  'ጥቅምት',
  'ህዳር',
  'ታህሳስ',
  'የ2ኛ ሩብ ዓመት ዒላማ',
  '6 ወር ዒላማ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'የ3ኛ ሩብ ዓመት ዒላማ',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'የ4ኛ ሩብ ዓመት ዒላማ',
  'የዓመት ዒላማ',
  'ተግባሪ',
  'የሚያስፈልግ በጀት',
  'የመንግስት',
  'አጋሮች',
  'ኤስዲጂ',
  'ሌላ',
  'ጠቅላላ ያለ',
  'ክፍተት'
];

// Helper function to check if a month is selected for an item
const isMonthSelected = (item: any, monthValue: string): boolean => {
  try {
    const selectedMonths = item.selected_months || [];
    const selectedQuarters = item.selected_quarters || [];
    
    // Define month mapping
    const monthMapping = {
      'JUL': { quarter: 'Q1', variations: ['JUL', 'July', 'Jul'] },
      'AUG': { quarter: 'Q1', variations: ['AUG', 'August', 'Aug'] },
      'SEP': { quarter: 'Q1', variations: ['SEP', 'September', 'Sep'] },
      'OCT': { quarter: 'Q2', variations: ['OCT', 'October', 'Oct'] },
      'NOV': { quarter: 'Q2', variations: ['NOV', 'November', 'Nov'] },
      'DEC': { quarter: 'Q2', variations: ['DEC', 'December', 'Dec'] },
      'JAN': { quarter: 'Q3', variations: ['JAN', 'January', 'Jan'] },
      'FEB': { quarter: 'Q3', variations: ['FEB', 'February', 'Feb'] },
      'MAR': { quarter: 'Q3', variations: ['MAR', 'March', 'Mar'] },
      'APR': { quarter: 'Q4', variations: ['APR', 'April', 'Apr'] },
      'MAY': { quarter: 'Q4', variations: ['MAY', 'May'] },
      'JUN': { quarter: 'Q4', variations: ['JUN', 'June', 'Jun'] }
    };
    
    const monthInfo = monthMapping[monthValue];
    if (!monthInfo) return false;
    
    // If quarters are selected and this month's quarter is included
    if (selectedQuarters && selectedQuarters.includes(monthInfo.quarter)) {
      return true;
    }
    
    // If individual months are selected, check all variations
    if (selectedMonths && selectedMonths.length > 0) {
      return monthInfo.variations.some(variation =>
        selectedMonths.some((selected: string) => 
          selected.toLowerCase() === variation.toLowerCase()
        )
      );
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking if month ${monthValue} is selected:`, error);
    return false;
  }
};

const formatCurrency = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '$0' : `$${num.toLocaleString()}`;
};

export const exportToExcel = async (
  data: any[],
  filename: string,
  language: 'en' | 'am' = 'en',
  metadata?: {
    organization?: string;
    planner?: string;
    fromDate?: string;
    toDate?: string;
    planType?: string;
  }
) => {
  const headers = language === 'en' ? TABLE_HEADERS_EN : TABLE_HEADERS_AM;
  
  console.log('exportToExcel: Starting export with', data.length, 'rows');
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // Add metadata rows if provided
  const metadataRows = [];
  if (metadata) {
    metadataRows.push(['Organization:', metadata.organization || '']);
    metadataRows.push(['Planner:', metadata.planner || '']);
    metadataRows.push(['Plan Type:', metadata.planType || '']);
    metadataRows.push(['From Date:', metadata.fromDate || '']);
    metadataRows.push(['To Date:', metadata.toDate || '']);
    metadataRows.push([]); // Empty row
  }
  
  // CRITICAL: Transform data exactly as displayed in table
  const tableData = data.map(row => [
    row.No || '',
    row['Strategic Objective'] || '',
    row['Strategic Objective Weight'] || '',
    row['Strategic Initiative'] || '',
    row['Initiative Weight'] || '',
    row['Performance Measure/Main Activity'] || '',
    row.Weight || '',
    row.Baseline || '',
    // Q1 Month columns
    row.JulSelected || (row.itemData ? (isMonthSelected(row.itemData, 'JUL') ? '✓' : '') : ''),
    row.AugSelected || (row.itemData ? (isMonthSelected(row.itemData, 'AUG') ? '✓' : '') : ''),
    row.SepSelected || (row.itemData ? (isMonthSelected(row.itemData, 'SEP') ? '✓' : '') : ''),
    row.Q1Target || row.q1_target || '',
    // Q2 Month columns  
    row.OctSelected || (row.itemData ? (isMonthSelected(row.itemData, 'OCT') ? '✓' : '') : ''),
    row.NovSelected || (row.itemData ? (isMonthSelected(row.itemData, 'NOV') ? '✓' : '') : ''),
    row.DecSelected || (row.itemData ? (isMonthSelected(row.itemData, 'DEC') ? '✓' : '') : ''),
    row.Q2Target || row.q2_target || '',
    row.SixMonthTarget || row.sixMonthTarget || '',
    // Q3 Month columns
    row.JanSelected || (row.itemData ? (isMonthSelected(row.itemData, 'JAN') ? '✓' : '') : ''),
    row.FebSelected || (row.itemData ? (isMonthSelected(row.itemData, 'FEB') ? '✓' : '') : ''),
    row.MarSelected || (row.itemData ? (isMonthSelected(row.itemData, 'MAR') ? '✓' : '') : ''),
    row.Q3Target || row.q3_target || '',
    // Q4 Month columns
    row.AprSelected || (row.itemData ? (isMonthSelected(row.itemData, 'APR') ? '✓' : '') : ''),
    row.MaySelected || (row.itemData ? (isMonthSelected(row.itemData, 'MAY') ? '✓' : '') : ''),
    row.JunSelected || (row.itemData ? (isMonthSelected(row.itemData, 'JUN') ? '✓' : '') : ''),
    row.Q4Target || row.q4_target || '',
    row.AnnualTarget || row.annual_target || row.annualTarget || '',
    row.Implementor || '',
    formatCurrency(row.BudgetRequired !== '-' ? row.BudgetRequired : 0),
    formatCurrency(row.Government !== '-' ? row.Government : 0),
    formatCurrency(row.Partners !== '-' ? row.Partners : 0),
    formatCurrency(row.SDG !== '-' ? row.SDG : 0),
    formatCurrency(row.Other !== '-' ? row.Other : 0),
    formatCurrency(row.TotalAvailable !== '-' ? row.TotalAvailable : 0),
    formatCurrency(row.Gap !== '-' ? row.Gap : 0)
  ]);
  
  console.log('exportToExcel: Transformed', tableData.length, 'rows for export');
  
  // Combine metadata, headers, and data
  const worksheetData = [
    ...metadataRows,
    headers,
    ...tableData
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths
  const colWidths = [
    { wch: 5 },   // No.
    { wch: 25 },  // Strategic Objective
    { wch: 12 },  // Objective Weight
    { wch: 25 },  // Strategic Initiative
    { wch: 12 },  // Initiative Weight
    { wch: 30 },  // Performance Measure/Main Activity
    { wch: 10 },  // Weight
    { wch: 15 },  // Baseline
    // Q1 Month columns
    { wch: 6 },   // Jul
    { wch: 6 },   // Aug
    { wch: 6 },   // Sep
    { wch: 12 },  // Q1 Target
    // Q2 Month columns
    { wch: 6 },   // Oct
    { wch: 6 },   // Nov
    { wch: 6 },   // Dec
    { wch: 12 },  // Q2 Target
    { wch: 15 },  // 6-Month Target
    // Q3 Month columns
    { wch: 6 },   // Jan
    { wch: 6 },   // Feb
    { wch: 6 },   // Mar
    { wch: 12 },  // Q3 Target
    // Q4 Month columns
    { wch: 6 },   // Apr
    { wch: 6 },   // May
    { wch: 6 },   // Jun
    { wch: 12 },  // Q4 Target
    { wch: 15 },  // Annual Target
    { wch: 20 },  // Implementor
    { wch: 15 },  // Budget Required
    { wch: 12 },  // Government
    { wch: 12 },  // Partners
    { wch: 12 },  // SDG
    { wch: 12 },  // Other
    { wch: 15 },  // Total Available
    { wch: 12 }   // Gap
  ];
  
  ws['!cols'] = colWidths;
  
  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Strategic Plan');
  
  // Generate Excel file and trigger download
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportToPDF = (
  data: any[],
  filename: string,
  language: 'en' | 'am' = 'en',
  metadata?: {
    organization?: string;
    planner?: string;
    fromDate?: string;
    toDate?: string;
    planType?: string;
  }
) => {
  const headers = language === 'en' ? TABLE_HEADERS_EN : TABLE_HEADERS_AM;
  
  // Create PDF document
  const doc = new jsPDF('landscape', 'pt', 'a4');
  
  // Add title
  doc.setFontSize(16);
  doc.text('Strategic Plan Export', 40, 40);
  
  // Add metadata if provided
  let yPosition = 70;
  if (metadata) {
    doc.setFontSize(10);
    if (metadata.organization) {
      doc.text(`Organization: ${metadata.organization}`, 40, yPosition);
      yPosition += 15;
    }
    if (metadata.planner) {
      doc.text(`Planner: ${metadata.planner}`, 40, yPosition);
      yPosition += 15;
    }
    if (metadata.planType) {
      doc.text(`Plan Type: ${metadata.planType}`, 40, yPosition);
      yPosition += 15;
    }
    if (metadata.fromDate && metadata.toDate) {
      doc.text(`Period: ${metadata.fromDate} - ${metadata.toDate}`, 40, yPosition);
      yPosition += 15;
    }
    yPosition += 10;
  }
  
  // Transform data to match table structure
  const tableData = data.map(row => [
    row.No || '',
    row['Strategic Objective'] || '',
    row['Strategic Objective Weight'] || '',
    row['Strategic Initiative'] || '',
    row['Initiative Weight'] || '',
    row['Performance Measure/Main Activity'] || '',
    row.Weight || '',
    row.Baseline || '',
    // Q1 Month columns
    row.itemData ? (isMonthSelected(row.itemData, 'JUL') ? '✓' : '') : '',
    row.itemData ? (isMonthSelected(row.itemData, 'AUG') ? '✓' : '') : '',
    row.itemData ? (isMonthSelected(row.itemData, 'SEP') ? '✓' : '') : '',
    row.Q1Target || '',
    // Q2 Month columns
    row.itemData ? (isMonthSelected(row.itemData, 'OCT') ? '✓' : '') : '',
    row.itemData ? (isMonthSelected(row.itemData, 'NOV') ? '✓' : '') : '',
    row.itemData ? (isMonthSelected(row.itemData, 'DEC') ? '✓' : '') : '',
    row.Q2Target || '',
    row.SixMonthTarget || '',
    // Q3 Month columns
    row.itemData ? (isMonthSelected(row.itemData, 'JAN') ? '✓' : '') : '',
    row.itemData ? (isMonthSelected(row.itemData, 'FEB') ? '✓' : '') : '',
    row.itemData ? (isMonthSelected(row.itemData, 'MAR') ? '✓' : '') : '',
    row.Q3Target || '',
    // Q4 Month columns
    row.itemData ? (isMonthSelected(row.itemData, 'APR') ? '✓' : '') : '',
    row.itemData ? (isMonthSelected(row.itemData, 'MAY') ? '✓' : '') : '',
    row.itemData ? (isMonthSelected(row.itemData, 'JUN') ? '✓' : '') : '',
    row.Q4Target || '',
    row.AnnualTarget || '',
    row.Implementor || '',
    formatCurrency(row.BudgetRequired),
    formatCurrency(row.Government),
    formatCurrency(row.Partners),
    formatCurrency(row.SDG),
    formatCurrency(row.Other),
    formatCurrency(row.TotalAvailable),
    formatCurrency(row.Gap)
  ]);
  
  // Generate table
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: yPosition,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 25 },
      1: { cellWidth: 60 },
      2: { halign: 'center', cellWidth: 35 },
      3: { cellWidth: 60 },
      4: { halign: 'center', cellWidth: 35 },
      5: { cellWidth: 70 },
      6: { halign: 'center', cellWidth: 30 },
      7: { halign: 'center', cellWidth: 40 },
      // Q1 Month columns
      8: { halign: 'center', cellWidth: 20 },   // Jul
      9: { halign: 'center', cellWidth: 20 },   // Aug
      10: { halign: 'center', cellWidth: 20 },  // Sep
      11: { halign: 'center', cellWidth: 30 },  // Q1 Target
      // Q2 Month columns
      12: { halign: 'center', cellWidth: 20 },  // Oct
      13: { halign: 'center', cellWidth: 20 },  // Nov
      14: { halign: 'center', cellWidth: 20 },  // Dec
      15: { halign: 'center', cellWidth: 30 },  // Q2 Target
      16: { halign: 'center', cellWidth: 30 },  // 6-Month Target
      // Q3 Month columns
      17: { halign: 'center', cellWidth: 20 },  // Jan
      18: { halign: 'center', cellWidth: 20 },  // Feb
      19: { halign: 'center', cellWidth: 20 },  // Mar
      20: { halign: 'center', cellWidth: 30 },  // Q3 Target
      // Q4 Month columns
      21: { halign: 'center', cellWidth: 20 },  // Apr
      22: { halign: 'center', cellWidth: 20 },  // May
      23: { halign: 'center', cellWidth: 20 },  // Jun
      24: { halign: 'center', cellWidth: 30 },  // Q4 Target
      25: { halign: 'center', cellWidth: 30 },  // Annual Target
      26: { cellWidth: 50 },                    // Implementor
      27: { halign: 'right', cellWidth: 40 },   // Budget Required
      28: { halign: 'right', cellWidth: 35 },   // Government
      29: { halign: 'right', cellWidth: 35 },   // Partners
      30: { halign: 'right', cellWidth: 35 },   // SDG
      31: { halign: 'right', cellWidth: 35 },   // Other
      32: { halign: 'right', cellWidth: 40 },   // Total Available
      33: { halign: 'right', cellWidth: 35 }    // Gap
    },
    margin: { top: 60, right: 40, bottom: 60, left: 40 },
    pageBreak: 'auto',
    showHead: 'everyPage',
  });
  
  // Save the PDF
  doc.save(`${filename}.pdf`);
};

export const processDataForExport = (objectives: any[], language: 'en' | 'am' = 'en'): any[] => {
  const exportData: any[] = [];
  
  if (!objectives || !Array.isArray(objectives)) {
    return exportData;
  }

  objectives.forEach((objective, objIndex) => {
    if (!objective) return;
    
    // Get the actual selected objective weight from the plan
    let objectiveWeight = objective.weight ?? 0;
    
    // Try to get the weight from effective_weight first (this should be the selected weight)
    if (objective.effective_weight !== undefined) {
      objectiveWeight = objective.effective_weight;
    } 
    // Then try planner_weight if available
    else if (objective.planner_weight !== undefined && objective.planner_weight !== null) {
      objectiveWeight = objective.planner_weight;
    }
    
    if (!objective.initiatives || objective.initiatives.length === 0) {
      exportData.push({
        'No': objIndex + 1,
        'Strategic Objective': objective.title || 'Untitled Objective',
        'Strategic Objective Weight': `${objectiveWeight}%`,
        'Strategic Initiative': '-',
        'Initiative Weight': '-',
        'Performance Measure/Main Activity': '-',
        'Weight': '-',
        'Baseline': '-',
        // Q1 Months
        'JulSelected': '',
        'AugSelected': '',
        'SepSelected': '',
        'Q1Target': '-',
        // Q2 Months
        'OctSelected': '',
        'NovSelected': '',
        'DecSelected': '',
        'Q1Months': '-',
        'SixMonthTarget': '-',
        // Q3 Months
        'JanSelected': '',
        'FebSelected': '',
        'MarSelected': '',
        'Q3Target': '-',
        // Q4 Months
        'AprSelected': '',
        'MaySelected': '',
        'JunSelected': '',
        'Q3Months': '-',
        'AnnualTarget': '-',
        'Implementor': 'Ministry of Health',
        'BudgetRequired': '-',
        'Government': '-',
        'Partners': '-',
        'SDG': '-',
        'Other': '-',
        'TotalAvailable': '-',
        'Gap': '-'
      });
      return;
    }

    let objectiveAdded = false;

    objective.initiatives.forEach((initiative: any) => {
      if (!initiative) return;
      
      const performanceMeasures = initiative.performance_measures || [];
      const mainActivities = initiative.main_activities || [];
      const allItems = [...performanceMeasures, ...mainActivities];

      if (allItems.length === 0) {
        exportData.push({
          'No': objectiveAdded ? '' : (objIndex + 1).toString(),
          'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
          'Strategic Objective Weight': objectiveAdded ? '' : `${objectiveWeight}%`,
          'Strategic Initiative': initiative.name || 'Untitled Initiative',
          'Initiative Weight': `${initiative.weight || 0}%`,
          'Performance Measure/Main Activity': '-',
          'Weight': '-',
          'Baseline': '-',
          // Q1 Months
          'JulSelected': '',
          'AugSelected': '',
          'SepSelected': '',
          'Q1Target': '-',
          // Q2 Months
          'OctSelected': '',
          'NovSelected': '',
          'DecSelected': '',
          'Q1Months': '-',
          'SixMonthTarget': '-',
          // Q3 Months
          'JanSelected': '',
          'FebSelected': '',
          'MarSelected': '',
          'Q3Target': '-',
          // Q4 Months
          'AprSelected': '',
          'MaySelected': '',
          'JunSelected': '',
          'Q3Months': '-',
          'AnnualTarget': '-',
          'Implementor': initiative.organization_name || 'Ministry of Health',
          'BudgetRequired': '-',
          'Government': '-',
          'Partners': '-',
          'SDG': '-',
          'Other': '-',
          'TotalAvailable': '-',
          'Gap': '-'
        });
        objectiveAdded = true;
        return;
      }

      let initiativeAddedForObjective = false;

      performanceMeasures.forEach((measure: any) => {
        if (!measure) return;
        
        const sixMonthTarget = measure.target_type === 'cumulative' 
          ? Number(measure.q1_target || 0) + Number(measure.q2_target || 0) 
          : Number(measure.q2_target || 0);
        
        exportData.push({
          'No': objectiveAdded ? '' : (objIndex + 1).toString(),
          'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
          'Strategic Objective Weight': objectiveAdded ? '' : `${objectiveWeight}%`,
          'Strategic Initiative': initiativeAddedForObjective ? '' : (initiative.name || 'Untitled Initiative'),
          'Initiative Weight': initiativeAddedForObjective ? '' : `${initiative.weight || 0}%`,
          'Performance Measure/Main Activity': `PM: ${measure.name}`,
          'Weight': `${measure.weight}%`,
          'Baseline': measure.baseline || '-',
          // Q1 Months
          'JulSelected': isMonthSelected(measure, 'JUL') ? '✓' : '',
          'AugSelected': isMonthSelected(measure, 'AUG') ? '✓' : '',
          'SepSelected': isMonthSelected(measure, 'SEP') ? '✓' : '',
          'Q1Target': measure.q1_target || 0,
          // Q2 Months
          'OctSelected': isMonthSelected(measure, 'OCT') ? '✓' : '',
          'NovSelected': isMonthSelected(measure, 'NOV') ? '✓' : '',
          'DecSelected': isMonthSelected(measure, 'DEC') ? '✓' : '',
          'Q2Target': measure.q2_target || 0,
          'SixMonthTarget': sixMonthTarget,
          // Q3 Months
          'JanSelected': isMonthSelected(measure, 'JAN') ? '✓' : '',
          'FebSelected': isMonthSelected(measure, 'FEB') ? '✓' : '',
          'MarSelected': isMonthSelected(measure, 'MAR') ? '✓' : '',
          'Q3Target': measure.q3_target || 0,
          // Q4 Months
          'AprSelected': isMonthSelected(measure, 'APR') ? '✓' : '',
          'MaySelected': isMonthSelected(measure, 'MAY') ? '✓' : '',
          'JunSelected': isMonthSelected(measure, 'JUN') ? '✓' : '',
          'Q4Target': measure.q4_target || 0,
          'AnnualTarget': measure.annual_target || 0,
          'Implementor': initiative.organization_name || '-',
          'BudgetRequired': 0,
          'Government': 0,
          'Partners': 0,
          'SDG': 0,
          'Other': 0,
          'TotalAvailable': 0,
          'Gap': 0,
          'itemData': measure
        });
        
        objectiveAdded = true;
        initiativeAddedForObjective = true;
      });

      mainActivities.forEach((activity: any) => {
        if (!activity) return;
        
        let budgetRequired = 0;
        let government = 0;
        let partners = 0;
        let sdg = 0;
        let other = 0;
        let totalAvailable = 0;
        let gap = 0;

        // Calculate budget from sub-activities
        if (activity.sub_activities && Array.isArray(activity.sub_activities)) {
          activity.sub_activities.forEach((subActivity: any) => {
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
        else if (activity.budget) {
          budgetRequired = activity.budget.budget_calculation_type === 'WITH_TOOL' 
            ? Number(activity.budget.estimated_cost_with_tool || 0)
            : Number(activity.budget.estimated_cost_without_tool || 0);
          
          government = Number(activity.budget.government_treasury || 0);
          partners = Number(activity.budget.partners_funding || 0);
          sdg = Number(activity.budget.sdg_funding || 0);
          other = Number(activity.budget.other_funding || 0);
        }
        
        totalAvailable = government + partners + sdg + other;
        gap = Math.max(0, budgetRequired - totalAvailable);

        const sixMonthTarget = activity.target_type === 'cumulative' 
          ? Number(activity.q1_target || 0) + Number(activity.q2_target || 0) 
          : Number(activity.q2_target || 0);
        
        exportData.push({
          'No': objectiveAdded ? '' : (objIndex + 1).toString(),
          'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
          'Strategic Objective Weight': objectiveAdded ? '' : `${objectiveWeight}%`,
          'Strategic Initiative': initiativeAddedForObjective ? '' : (initiative.name || 'Untitled Initiative'),
          'Initiative Weight': initiativeAddedForObjective ? '' : `${initiative.weight || 0}%`,
          'Performance Measure/Main Activity': `MA: ${activity.name}`,
          'Weight': `${activity.weight}%`,
          'Baseline': activity.baseline || '-',
          // Q1 Months
          'JulSelected': isMonthSelected(activity, 'JUL') ? '✓' : '',
          'AugSelected': isMonthSelected(activity, 'AUG') ? '✓' : '',
          'SepSelected': isMonthSelected(activity, 'SEP') ? '✓' : '',
          'Q1Target': activity.q1_target || 0,
          // Q2 Months
          'OctSelected': isMonthSelected(activity, 'OCT') ? '✓' : '',
          'NovSelected': isMonthSelected(activity, 'NOV') ? '✓' : '',
          'DecSelected': isMonthSelected(activity, 'DEC') ? '✓' : '',
          'Q2Target': activity.q2_target || 0,
          'SixMonthTarget': sixMonthTarget,
          // Q3 Months
          'JanSelected': isMonthSelected(activity, 'JAN') ? '✓' : '',
          'FebSelected': isMonthSelected(activity, 'FEB') ? '✓' : '',
          'MarSelected': isMonthSelected(activity, 'MAR') ? '✓' : '',
          'Q3Target': activity.q3_target || 0,
          // Q4 Months
          'AprSelected': isMonthSelected(activity, 'APR') ? '✓' : '',
          'MaySelected': isMonthSelected(activity, 'MAY') ? '✓' : '',
          'JunSelected': isMonthSelected(activity, 'JUN') ? '✓' : '',
          'Q4Target': activity.q4_target || 0,
          'AnnualTarget': activity.annual_target || 0,
          'Implementor': initiative.organization_name || 
                        'Ministry of Health',
          'BudgetRequired': budgetRequired,
          'Government': government,
          'Partners': partners,
          'SDG': sdg,
          'Other': other,
          'TotalAvailable': totalAvailable,
          'Gap': gap,
          'itemData': activity
        });
        
        objectiveAdded = true;
        initiativeAddedForObjective = true;
      });
    });
  });

  return exportData;
};