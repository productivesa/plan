import pandas as pd
import json
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from organizations.models import ProcurementItem
from organizations.bulk_import import BulkProcurementImporter


class Command(BaseCommand):
    help = 'Bulk import procurement items from CSV or Excel file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv-file',
            type=str,
            help='Path to CSV or Excel file containing procurement items data',
            required=True
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview import without saving to database',
        )

    def handle(self, *args, **options):
        file_path = options['csv_file']
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No data will be saved'))

        # Use the BulkProcurementImporter class
        importer = BulkProcurementImporter()
        importer.stdout = self.stdout
        importer.style = self.style
        
        result = importer.import_from_file(file_path, dry_run)
        
        if result > 0 and not dry_run:
            self.stdout.write(self.style.SUCCESS(f'Import completed successfully! {result} procurement items created.'))
        elif result > 0 and dry_run:
            self.stdout.write(self.style.SUCCESS(f'Dry run completed. {result} procurement items ready for import.'))
        else:
            self.stdout.write(self.style.ERROR('Import failed or no valid procurement items found.'))