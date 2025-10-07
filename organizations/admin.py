from django.contrib import admin
from django import forms
from .models import (
    Organization, OrganizationUser, StrategicObjective, 
    Program, StrategicInitiative, PerformanceMeasure, MainActivity,
    ActivityBudget, ActivityCostingAssumption, InitiativeFeed,
    Location, LandTransport, AirTransport, PerDiem, Accommodation,
    ParticipantCost, SessionCost, PrintingCost, SupervisorCost,ProcurementItem,Plan,SubActivity
)
admin.site.register(Plan)
class OrganizationAdminForm(forms.ModelForm):
    core_values_text = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 5}),
        required=False,
        label="Core Values (one per line)",
        help_text="Enter each core value on a new line"
    )

    class Meta:
        model = Organization
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Convert JSON list to newline-separated text for editing
        if self.instance.pk and self.instance.core_values:
            self.fields['core_values_text'].initial = '\n'.join(self.instance.core_values)

    def clean(self):
        cleaned_data = super().clean()
        # Convert newline-separated text back to list for JSON field
        core_values_text = cleaned_data.get('core_values_text', '')
        if core_values_text:
            cleaned_data['core_values'] = [value.strip() for value in core_values_text.split('\n') if value.strip()]
        else:
            cleaned_data['core_values'] = []
        return cleaned_data

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    form = OrganizationAdminForm
    list_display = ('name', 'type', 'parent', 'created_at', 'updated_at')
    list_filter = ('type',)
    search_fields = ('name',)
    ordering = ('type', 'name')
    fieldsets = (
        (None, {
            'fields': ('name', 'type', 'parent')
        }),
        ('Metadata', {
            'fields': ('vision', 'mission', 'core_values_text'),
            'classes': ('collapse',),
        }),
    )

    def save_model(self, request, obj, form, change):
        # Core values are already processed in the form's clean method
        super().save_model(request, obj, form, change)

@admin.register(OrganizationUser)
class OrganizationUserAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'role', 'created_at')
    list_filter = ('role', 'organization')
    search_fields = ('user__username', 'user__email', 'organization__name')
    ordering = ('organization', 'user')

@admin.register(InitiativeFeed)
class InitiativeFeedAdmin(admin.ModelAdmin):
    list_display = ('name', 'strategic_objective', 'is_active', 'created_at', 'updated_at')
    search_fields = ('name', 'description', 'strategic_objective__title')
    list_filter = ('is_active', 'strategic_objective')
    ordering = ('name',)
    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'strategic_objective', 'is_active')
        }),
    )

@admin.register(StrategicObjective)
class StrategicObjectiveAdmin(admin.ModelAdmin):
    list_display = ('title', 'weight', 'is_default', 'created_at', 'updated_at')
    list_filter = ('is_default',)
    search_fields = ('title', 'description')

@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ('name', 'strategic_objective', 'is_default', 'created_at', 'updated_at')
    list_filter = ('strategic_objective', 'is_default')
    search_fields = ('name', 'description')

class PerformanceMeasureInline(admin.TabularInline):
    model = PerformanceMeasure
    extra = 1
    fields = ('name', 'weight', 'baseline', 'q1_target', 'q2_target', 'q3_target', 'q4_target', 'annual_target')

class MainActivityInline(admin.TabularInline):
    model = MainActivity
    extra = 1
    fields = ('name', 'weight', 'selected_months', 'selected_quarters', 'baseline', 'target_type', 'q1_target', 'q2_target', 'q3_target', 'q4_target', 'annual_target')

@admin.register(StrategicInitiative)
class StrategicInitiativeAdmin(admin.ModelAdmin):
    list_display = ('name', 'strategic_objective', 'program', 'weight', 'is_default', 'created_at', 'updated_at')
    list_filter = ('strategic_objective', 'program', 'is_default')
    search_fields = ('name',)
    inlines = [PerformanceMeasureInline, MainActivityInline]

@admin.register(PerformanceMeasure)
class PerformanceMeasureAdmin(admin.ModelAdmin):
    list_display = ('name', 'initiative', 'weight', 'annual_target', 'created_at', 'updated_at')
    list_filter = ('initiative',)
    search_fields = ('name',)
    fieldsets = (
        (None, {
            'fields': ('initiative', 'name', 'weight', 'baseline')
        }),
        ('Targets', {
            'fields': ('target_type', 'q1_target', 'q2_target', 'q3_target', 'q4_target', 'annual_target'),
        }),
        ('Period', {
            'fields': ('selected_months', 'selected_quarters'),
            'classes': ('collapse',),
        }),
    )

@admin.register(MainActivity)
class MainActivityAdmin(admin.ModelAdmin):
    list_display = ('name', 'initiative', 'weight', 'created_at', 'updated_at')
    list_filter = ('initiative',)
    search_fields = ('name',)
    fieldsets = (
        (None, {
            'fields': ('initiative', 'name', 'weight')
        }),
        ('Period', {
            'fields': ('selected_months', 'selected_quarters'),
        }),
        ('Targets', {
            'fields': ('baseline', 'target_type', 'q1_target', 'q2_target', 'q3_target', 'q4_target', 'annual_target'),
        }),
    )

admin.site.register(ActivityBudget)

    
@admin.register(ActivityCostingAssumption)
class ActivityCostingAssumptionAdmin(admin.ModelAdmin):
    list_display = ('activity_type', 'location', 'cost_type', 'amount', 'created_at')
    list_filter = ('activity_type', 'location', 'cost_type')
    search_fields = ('description',)
    ordering = ('activity_type', 'location', 'cost_type')

# New models registration
@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('name', 'region', 'is_hardship_area')
    list_filter = ('is_hardship_area', 'region')
    search_fields = ('name', 'region')
    ordering = ('region', 'name')
    fieldsets = (
        (None, {
            'fields': ('name', 'region', 'is_hardship_area')
        }),
    )
    
    def formfield_for_choice_field(self, db_field, request, **kwargs):
        if db_field.name == 'region':
            kwargs['choices'] = Location.REGIONS
        return super().formfield_for_choice_field(db_field, request, **kwargs)

@admin.register(LandTransport)
class LandTransportAdmin(admin.ModelAdmin):
    list_display = ('origin', 'destination', 'trip_type', 'price')
    list_filter = ('trip_type', 'origin__region', 'destination__region')
    search_fields = ('origin__name', 'destination__name')
    ordering = ('origin', 'destination')

@admin.register(AirTransport)
class AirTransportAdmin(admin.ModelAdmin):
    list_display = ('origin', 'destination', 'price')
    list_filter = ('origin__region', 'destination__region')
    search_fields = ('origin__name', 'destination__name')
    ordering = ('origin', 'destination')

@admin.register(PerDiem)
class PerDiemAdmin(admin.ModelAdmin):
    list_display = ('location', 'amount', 'hardship_allowance_amount')
    list_filter = ('location__region',)
    search_fields = ('location__name',)
    ordering = ('location', 'amount')

@admin.register(Accommodation)
class AccommodationAdmin(admin.ModelAdmin):
    list_display = ('location', 'service_type', 'price')
    list_filter = ('service_type', 'location__region')
    search_fields = ('location__name',)
    ordering = ('location', 'service_type')

@admin.register(ParticipantCost)
class ParticipantCostAdmin(admin.ModelAdmin):
    list_display = ('cost_type', 'price')
    list_filter = ('cost_type',)
    ordering = ('cost_type',)

@admin.register(SessionCost)
class SessionCostAdmin(admin.ModelAdmin):
    list_display = ('cost_type', 'price')
    list_filter = ('cost_type',)
    ordering = ('cost_type',)

@admin.register(PrintingCost)
class PrintingCostAdmin(admin.ModelAdmin):
    list_display = ('document_type', 'price_per_page')
    list_filter = ('document_type',)
    ordering = ('document_type',)

@admin.register(SupervisorCost)
class SupervisorCostAdmin(admin.ModelAdmin):
    list_display = ('cost_type', 'amount')
    list_filter = ('cost_type',)
    ordering = ('cost_type',)
@admin.register(ProcurementItem)
class ProcurementItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'unit', 'unit_price')
    list_filter = ('category', 'unit')
    search_fields = ('name',)
    ordering = ('category', 'name')
    fieldsets = (
        (None, {
            'fields': ('category', 'name', 'unit', 'unit_price')
        }),
    )
admin.site.register(SubActivity)

list_display = ('name', 'main_activity', 'activity_type')
list_filter = ('main_activity', 'activity_type')
search_fields = ('name',)
ordering = ('main_activity', 'name')
fieldsets = (
        (None, {
            'fields': ('name', 'main_activity', 'activity_type')
        }),
         ('Costs', {
            'fields': (
                'estimated_cost_with_tool',
                'estimated_cost_without_tool',
                'government_treasury',
                'sdg_funding',
                'partners_funding',
                'other_funding'
            ),
        }),
        ('Activity Details', {
            'fields': (
                'training_details',
                'meeting_workshop_details',
                'procurement_details',
                'printing_details',
                'supervision_details',
                'partners_details'
            ),
            'classes': ('collapse',),
        }),
    )
