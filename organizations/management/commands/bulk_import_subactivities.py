import csv
import json
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from organizations.models import SubActivity, MainActivity, Organization


class Command(BaseCommand):
    help = 'Bulk import sub-activities from CSV file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv-file',
            type=str,
            help='Path to CSV or Excel file containing sub-activities data',
            required=True
        )
        parser.add_argument(
            '--organization-id',
            type=int,
            help='Target organization ID for all sub-activities',
            required=False
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview import without saving to database',
        )

    def handle(self, *args, **options):
        file_path = options['csv_file']
        organization_id = options.get('organization_id')
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No data will be saved'))

        # Use the BulkSubActivityImporter class
        importer = BulkSubActivityImporter(default_organization_id=organization_id)
        importer.stdout = self.stdout
        importer.style = self.style
        
        result = importer.import_from_file(file_path, dry_run)
        
        if result > 0 and not dry_run:
            self.stdout.write(self.style.SUCCESS(f'Import completed successfully! {result} sub-activities created.'))
        elif result > 0 and dry_run:
            self.stdout.write(self.style.SUCCESS(f'Dry run completed. {result} sub-activities ready for import.'))
        else:
            self.stdout.write(self.style.ERROR('Import failed or no valid sub-activities found.'))