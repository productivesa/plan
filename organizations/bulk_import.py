import pandas as pd
import json
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import SubActivity, MainActivity, Organization, ProcurementItem


class BulkSubActivityImporter:
    """
    Utility class for bulk importing sub-activities from various file formats
    """
    
    VALID_ACTIVITY_TYPES = ['Training', 'Meeting', 'Workshop', 'Printing', 'Supervision', 'Procurement', 'Other']
    VALID_BUDGET_TYPES = ['WITH_TOOL', 'WITHOUT_TOOL']
    
    REQUIRED_COLUMNS = [
        'main_activity_name', 'name', 'activity_type',
        'estimated_cost_with_tool', 'estimated_cost_without_tool',
        'government_treasury', 'sdg_funding', 'partners_funding', 'other_funding'
    ]
    
    OPTIONAL_COLUMNS = [
        'description', 'budget_calculation_type', 'organization_id',
        'training_details', 'meeting_workshop_details', 'procurement_details',
        'printing_details', 'supervision_details', 'partners_details'
    ]

    def __init__(self, default_organization_id=None):
        self.default_organization_id = default_organization_id
        self.errors = []
        self.warnings = []
        self.stdout = None
        self.style = None

    def validate_file_format(self, file_path):
        """Validate file format and return file type"""
        if file_path.endswith('.csv'):
            return 'csv'
        elif file_path.endswith(('.xlsx', '.xls')):
            return 'excel'
        else:
            raise ValueError('Unsupported file format. Please use CSV or Excel files.')

    def read_file(self, file_path):
        """Read data from CSV or Excel file"""
        file_type = self.validate_file_format(file_path)
        
        try:
            if file_type == 'csv':
                df = pd.read_csv(file_path)
            else:  # Excel
                df = pd.read_excel(file_path)
            
            return df
        except Exception as e:
            raise ValueError(f'Error reading file: {str(e)}')

    def validate_columns(self, df):
        """Validate that required columns exist"""
        missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing_columns:
            raise ValueError(f'Missing required columns: {", ".join(missing_columns)}')

    def log(self, message, style_func=None):
        """Helper to log messages"""
        if self.stdout:
            if style_func and self.style:
                self.stdout.write(style_func(message))
            else:
                self.stdout.write(message)
        else:
            print(message)
    def validate_row(self, row, line_number):
        """Validate a single row of data"""
        errors = []
        
        # Validate main activity exists
        try:
            main_activity_name = str(row['main_activity_name']).strip()
            if not main_activity_name:
                errors.append('Main activity name is required and cannot be empty')
                return None, errors
                
            # Try to find the main activity by name
            try:
                main_activity = MainActivity.objects.get(name=main_activity_name)
                self.log(f'Found main activity: {main_activity_name} (ID: {main_activity.id})')
            except MainActivity.MultipleObjectsReturned:
                errors.append(f'Multiple main activities found with name "{main_activity_name}". Please ensure unique names.')
                return None, errors
            except MainActivity.DoesNotExist:
                # Provide helpful error with available names
                available_names = list(MainActivity.objects.values_list('name', flat=True)[:10])
                errors.append(f'Main activity "{main_activity_name}" not found. Available names (first 10): {", ".join(available_names)}')
                return None, errors
        except (ValueError, TypeError):
            errors.append(f'Invalid main_activity_name: {row["main_activity_name"]}')
            return None, errors

        # Validate organization if specified
        organization_id = self.default_organization_id or row.get('organization_id')
        organization = None
        if organization_id:
            try:
                organization = Organization.objects.get(id=organization_id)
                self.log(f'Using organization: {organization.name} (ID: {organization_id})')
            except Organization.DoesNotExist:
                errors.append(f'Organization {organization_id} not found')

        # Validate name
        name = str(row['name']).strip()
        if not name:
            errors.append('Name is required and cannot be empty')

        # Validate activity type
        activity_type = str(row.get('activity_type', 'Other')).strip()
        if activity_type not in self.VALID_ACTIVITY_TYPES:
            self.warnings.append(f'Line {line_number}: Invalid activity_type "{activity_type}", using "Other"')
            activity_type = 'Other'

        # Validate budget calculation type
        budget_calc_type = str(row.get('budget_calculation_type', 'WITHOUT_TOOL')).upper()
        if budget_calc_type not in self.VALID_BUDGET_TYPES:
            self.warnings.append(f'Line {line_number}: Invalid budget_calculation_type "{budget_calc_type}", using "WITHOUT_TOOL"')
            budget_calc_type = 'WITHOUT_TOOL'

        # Validate numeric fields
        try:
            estimated_cost_with_tool = Decimal(str(row.get('estimated_cost_with_tool', 0) or 0))
            estimated_cost_without_tool = Decimal(str(row.get('estimated_cost_without_tool', 0) or 0))
            government_treasury = Decimal(str(row.get('government_treasury', 0) or 0))
            sdg_funding = Decimal(str(row.get('sdg_funding', 0) or 0))
            partners_funding = Decimal(str(row.get('partners_funding', 0) or 0))
            other_funding = Decimal(str(row.get('other_funding', 0) or 0))
        except (ValueError, TypeError, decimal.InvalidOperation) as e:
            errors.append(f'Invalid numeric value: {str(e)}')
            return None, errors

        # Validate that at least one estimated cost is positive
        if estimated_cost_with_tool <= 0 and estimated_cost_without_tool <= 0:
            errors.append('At least one estimated cost must be greater than 0')

        # Validate funding doesn't exceed estimated cost
        total_funding = government_treasury + sdg_funding + partners_funding + other_funding
        effective_cost = estimated_cost_with_tool if budget_calc_type == 'WITH_TOOL' else estimated_cost_without_tool
        
        if total_funding > effective_cost:
            errors.append(f'Total funding ({total_funding}) cannot exceed estimated cost ({effective_cost})')

        if errors:
            return None, errors

        # Parse JSON details if provided
        training_details = None
        meeting_workshop_details = None
        procurement_details = None
        printing_details = None
        supervision_details = None
        partners_details = None

        json_fields = [
            ('training_details', 'training_details'),
            ('meeting_workshop_details', 'meeting_workshop_details'),
            ('procurement_details', 'procurement_details'),
            ('printing_details', 'printing_details'),
            ('supervision_details', 'supervision_details'),
            ('partners_details', 'partners_details')
        ]

        for field_name, var_name in json_fields:
            if row.get(field_name):
                try:
                    locals()[var_name] = json.loads(str(row[field_name]))
                except json.JSONDecodeError:
                    self.warnings.append(f'Line {line_number}: Invalid {field_name} JSON, skipping')

        return {
            'main_activity': main_activity,
            'name': name,
            'activity_type': activity_type,
            'description': str(row.get('description', '')).strip(),
            'budget_calculation_type': budget_calc_type,
            'estimated_cost_with_tool': estimated_cost_with_tool,
            'estimated_cost_without_tool': estimated_cost_without_tool,
            'government_treasury': government_treasury,
            'sdg_funding': sdg_funding,
            'partners_funding': partners_funding,
            'other_funding': other_funding,
            'training_details': training_details,
            'meeting_workshop_details': meeting_workshop_details,
            'procurement_details': procurement_details,
            'printing_details': printing_details,
            'supervision_details': supervision_details,
            'partners_details': partners_details,
        }, []

    def import_from_file(self, file_path, dry_run=False):
        """Import sub-activities from file"""
        self.errors = []
        self.warnings = []

        try:
            # Read file
            df = self.read_file(file_path)
            self.log(f'Read {len(df)} rows from file')

            # Validate columns
            self.validate_columns(df)

            # Process each row
            valid_sub_activities = []
            line_number = 1

            for index, row in df.iterrows():
                line_number = index + 2  # +2 because index starts at 0 and we skip header
                
                validated_data, row_errors = self.validate_row(row, line_number)
                
                if row_errors:
                    self.errors.extend([f'Line {line_number}: {error}' for error in row_errors])
                    continue

                if validated_data:
                    valid_sub_activities.append(validated_data)

            # Display summary
            self.log(f'Validation complete:')
            self.log(f'  Valid sub-activities: {len(valid_sub_activities)}')
            self.log(f'  Errors: {len(self.errors)}')
            self.log(f'  Warnings: {len(self.warnings)}')

            # Display errors
            if self.errors:
                self.log('ERRORS:', self.style.ERROR if self.style else None)
                for error in self.errors[:10]:
                    self.log(f'  {error}', self.style.ERROR if self.style else None)
                if len(self.errors) > 10:
                    self.log(f'  ... and {len(self.errors) - 10} more errors', self.style.ERROR if self.style else None)

            # Display warnings
            if self.warnings:
                self.log('WARNINGS:', self.style.WARNING if self.style else None)
                for warning in self.warnings[:5]:
                    self.log(f'  {warning}', self.style.WARNING if self.style else None)
                if len(self.warnings) > 5:
                    self.log(f'  ... and {len(self.warnings) - 5} more warnings', self.style.WARNING if self.style else None)

            if len(valid_sub_activities) == 0:
                self.log('No valid sub-activities to import. Aborting.', self.style.ERROR if self.style else None)
                return 0

            # Preview or import
            if dry_run:
                self.log('DRY RUN PREVIEW (first 5):', self.style.SUCCESS if self.style else None)
                for i, data in enumerate(valid_sub_activities[:5]):
                    cost = data['estimated_cost_with_tool'] if data['budget_calculation_type'] == 'WITH_TOOL' else data['estimated_cost_without_tool']
                    self.log(f'  {i+1}. {data["name"]} ({data["activity_type"]}) - '
                           f'Cost: ETB {cost} - Main Activity: {data["main_activity"].name}')
                if len(valid_sub_activities) > 5:
                    self.log(f'  ... and {len(valid_sub_activities) - 5} more')
                return len(valid_sub_activities)

            # Bulk create
            with transaction.atomic():
                created_count = 0
                for data in valid_sub_activities:
                    try:
                        SubActivity.objects.create(**data)
                        created_count += 1
                    except Exception as e:
                        self.log(f'Failed to create sub-activity {data["name"]}: {str(e)}', self.style.ERROR if self.style else None)

                self.log(f'Successfully imported {created_count} sub-activities!', self.style.SUCCESS if self.style else None)
                
                # Display organization summary
                if self.default_organization_id:
                    try:
                        org = Organization.objects.get(id=self.default_organization_id)
                        self.log(f'All sub-activities assigned to organization: {org.name}')
                    except Organization.DoesNotExist:
                        pass

                return created_count

        except Exception as e:
            self.log(f'Import failed: {str(e)}', self.style.ERROR if self.style else None)
            return 0

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        organization_id = options.get('organization_id')
        dry_run = options['dry_run']

        self.default_organization_id = organization_id
        self.stdout = self.stdout

        result = self.import_from_file(csv_file, dry_run)
        
        if result > 0 and not dry_run:
            self.stdout.write(self.style.SUCCESS(f'Import completed successfully! {result} sub-activities created.'))
        elif result > 0 and dry_run:
            self.stdout.write(self.style.SUCCESS(f'Dry run completed. {result} sub-activities ready for import.'))


class BulkProcurementImporter:
    """
    Utility class for bulk importing procurement items from various file formats
    """
    
    VALID_CATEGORIES = [choice[0] for choice in ProcurementItem.CATEGORY_CHOICES]
    VALID_UNITS = [choice[0] for choice in ProcurementItem.UNIT_CHOICES]
    
    REQUIRED_COLUMNS = [
        'category', 'name', 'unit', 'unit_price'
    ]

    def __init__(self):
        self.errors = []
        self.warnings = []
        self.stdout = None
        self.style = None

    def validate_file_format(self, file_path):
        """Validate file format and return file type"""
        if file_path.endswith('.csv'):
            return 'csv'
        elif file_path.endswith(('.xlsx', '.xls')):
            return 'excel'
        else:
            raise ValueError('Unsupported file format. Please use CSV or Excel files.')

    def read_file(self, file_path):
        """Read data from CSV or Excel file"""
        file_type = self.validate_file_format(file_path)
        
        try:
            if file_type == 'csv':
                df = pd.read_csv(file_path)
            else:  # Excel
                df = pd.read_excel(file_path)
            
            return df
        except Exception as e:
            raise ValueError(f'Error reading file: {str(e)}')

    def validate_columns(self, df):
        """Validate that required columns exist"""
        missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing_columns:
            raise ValueError(f'Missing required columns: {", ".join(missing_columns)}')

    def log(self, message, style_func=None):
        """Helper to log messages"""
        if self.stdout:
            if style_func and self.style:
                self.stdout.write(style_func(message))
            else:
                self.stdout.write(message)
        else:
            print(message)

    def validate_row(self, row, line_number):
        """Validate a single row of procurement data"""
        errors = []
        
        # Validate category
        try:
            category = str(row['category']).strip().upper()
            if category not in self.VALID_CATEGORIES:
                errors.append(f'Invalid category "{category}". Valid options: {", ".join(self.VALID_CATEGORIES)}')
                return None, errors
        except (ValueError, TypeError):
            errors.append(f'Invalid category: {row["category"]}')
            return None, errors

        # Validate name
        try:
            name = str(row['name']).strip()
            if not name:
                errors.append('Item name is required and cannot be empty')
                return None, errors
        except (ValueError, TypeError):
            errors.append(f'Invalid name: {row["name"]}')
            return None, errors

        # Validate unit
        try:
            unit = str(row['unit']).strip().upper()
            if unit not in self.VALID_UNITS:
                errors.append(f'Invalid unit "{unit}". Valid options: {", ".join(self.VALID_UNITS)}')
                return None, errors
        except (ValueError, TypeError):
            errors.append(f'Invalid unit: {row["unit"]}')
            return None, errors

        # Validate unit price
        try:
            unit_price = Decimal(str(row['unit_price'] or 0))
            if unit_price <= 0:
                errors.append('Unit price must be greater than 0')
                return None, errors
        except (ValueError, TypeError, decimal.InvalidOperation) as e:
            errors.append(f'Invalid unit_price: {str(e)}')
            return None, errors

        # Check for duplicate items (same category, name, unit)
        existing_item = ProcurementItem.objects.filter(
            category=category,
            name=name,
            unit=unit
        ).first()
        
        if existing_item:
            self.warnings.append(f'Line {line_number}: Item "{name}" ({category}, {unit}) already exists with price ETB {existing_item.unit_price}. Will be skipped.')
            return None, []  # Skip duplicate, but no error

        if errors:
            return None, errors

        return {
            'category': category,
            'name': name,
            'unit': unit,
            'unit_price': unit_price,
        }, []

    def import_from_file(self, file_path, dry_run=False):
        """Import procurement items from file"""
        self.errors = []
        self.warnings = []

        try:
            # Read file
            df = self.read_file(file_path)
            self.log(f'Read {len(df)} rows from file')

            # Validate columns
            self.validate_columns(df)

            # Process each row
            valid_items = []
            line_number = 1

            for index, row in df.iterrows():
                line_number = index + 2  # +2 because index starts at 0 and we skip header
                
                validated_data, row_errors = self.validate_row(row, line_number)
                
                if row_errors:
                    self.errors.extend([f'Line {line_number}: {error}' for error in row_errors])
                    continue

                if validated_data:
                    valid_items.append(validated_data)

            # Display summary
            self.log(f'Validation complete:')
            self.log(f'  Valid procurement items: {len(valid_items)}')
            self.log(f'  Errors: {len(self.errors)}')
            self.log(f'  Warnings: {len(self.warnings)}')

            # Display errors
            if self.errors:
                self.log('ERRORS:', self.style.ERROR if self.style else None)
                for error in self.errors[:10]:
                    self.log(f'  {error}', self.style.ERROR if self.style else None)
                if len(self.errors) > 10:
                    self.log(f'  ... and {len(self.errors) - 10} more errors', self.style.ERROR if self.style else None)

            # Display warnings
            if self.warnings:
                self.log('WARNINGS:', self.style.WARNING if self.style else None)
                for warning in self.warnings[:5]:
                    self.log(f'  {warning}', self.style.WARNING if self.style else None)
                if len(self.warnings) > 5:
                    self.log(f'  ... and {len(self.warnings) - 5} more warnings', self.style.WARNING if self.style else None)

            if len(valid_items) == 0:
                self.log('No valid procurement items to import. Aborting.', self.style.ERROR if self.style else None)
                return 0

            # Preview or import
            if dry_run:
                self.log('DRY RUN PREVIEW (first 5):', self.style.SUCCESS if self.style else None)
                for i, data in enumerate(valid_items[:5]):
                    self.log(f'  {i+1}. {data["name"]} ({data["category"]}) - '
                           f'Unit: {data["unit"]} - Price: ETB {data["unit_price"]}')
                if len(valid_items) > 5:
                    self.log(f'  ... and {len(valid_items) - 5} more')
                return len(valid_items)

            # Bulk create
            with transaction.atomic():
                created_count = 0
                for data in valid_items:
                    try:
                        ProcurementItem.objects.create(**data)
                        created_count += 1
                    except Exception as e:
                        self.log(f'Failed to create procurement item {data["name"]}: {str(e)}', self.style.ERROR if self.style else None)

                self.log(f'Successfully imported {created_count} procurement items!', self.style.SUCCESS if self.style else None)
                return created_count

        except Exception as e:
            self.log(f'Import failed: {str(e)}', self.style.ERROR if self.style else None)
            return 0