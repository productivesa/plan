from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.http import HttpResponse
from .views import (
    OrganizationViewSet, StrategicObjectiveViewSet,
    ProgramViewSet, StrategicInitiativeViewSet,
    PerformanceMeasureViewSet, MainActivityViewSet,
    ActivityBudgetViewSet,SubActivityViewSet, ActivityCostingAssumptionViewSet,
    PlanViewSet, PlanReviewViewSet, InitiativeFeedViewSet,SubActivityViewSet,
    LocationViewSet, LandTransportViewSet, AirTransportViewSet,
    PerDiemViewSet, AccommodationViewSet, ParticipantCostViewSet,
    SessionCostViewSet, PrintingCostViewSet, SupervisorCostViewSet,
    ProcurementItemViewSet,login_view, logout_view, check_auth,
    update_profile, password_change)
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.http import JsonResponse
router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet)
router.register(r'strategic-objectives', StrategicObjectiveViewSet)
router.register(r'programs', ProgramViewSet)
router.register(r'strategic-initiatives', StrategicInitiativeViewSet)
router.register(r'performance-measures', PerformanceMeasureViewSet)
router.register(r'main-activities', MainActivityViewSet)
router.register(r'activity-budgets', ActivityBudgetViewSet)
router.register(r'sub-activities', SubActivityViewSet)
router.register(r'activity-costing-assumptions', ActivityCostingAssumptionViewSet)
router.register(r'plans', PlanViewSet)
router.register(r'plan-reviews', PlanReviewViewSet)
router.register(r'initiative-feeds', InitiativeFeedViewSet)
router.register(r'locations', LocationViewSet)
router.register(r'land-transports', LandTransportViewSet)
router.register(r'air-transports', AirTransportViewSet)
router.register(r'per-diems', PerDiemViewSet)
router.register(r'accommodations', AccommodationViewSet)
router.register(r'participant-costs', ParticipantCostViewSet)
router.register(r'session-costs', SessionCostViewSet)
router.register(r'printing-costs', PrintingCostViewSet)
router.register(r'supervisor-costs', SupervisorCostViewSet)
router.register(r'procurement-items', ProcurementItemViewSet)
# router.register(r'bulk-procurement-item-upload', BulkProcurementItemUploadView)


# CSRF token endpoint
@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({'detail': 'CSRF cookie set'})
urlpatterns = [
    path('', include(router.urls)),
   path('auth/login/', login_view, name='login'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/check/', check_auth, name='check_auth'),
    path('auth/csrf/', csrf_token_view, name='csrf_token'),
    path('auth/profile/', csrf_protect(update_profile), name='update_profile'),
    path('auth/password_change/', csrf_protect(password_change), name='password_change'),
    # Add custom budget update endpoint
    path('main-activities/<str:pk>/budget/', MainActivityViewSet.as_view({'post': 'update_budget'}), name='sub-activities-update'),
    # Bulk import endpoints
    # path('sub-activities/bulk_import/', SubActivityViewSet.as_view({'post': 'bulk_import'}), name='subactivity-bulk-import'),
    # path('sub-activities/export_template/', SubActivityViewSet.as_view({'get': 'export_template'}), name='subactivity-export-template'),
    # path('sub-activities/bulk_import_instructions/', SubActivityViewSet.as_view({'get': 'bulk_import_instructions'}), name='subactivity-bulk-import-instructions'),
    
    # Procurement bulk import endpoints
    # path('procurement-items/bulk_import/', ProcurementItemViewSet.as_view({'post': 'bulk_import'}), name='procurement-bulk-import'),
    # path('procurement-items/export_template/', ProcurementItemViewSet.as_view({'get': 'export_template'}), name='procurement-export-template'),
    # path('procurement-items/bulk_import_instructions/', ProcurementItemViewSet.as_view({'get': 'bulk_import_instructions'}), name='procurement-bulk-import-instructions'),
    # path('procurements/bulk-upload/', BulkProcurementItemUploadView.as_view(), name='procurement-bulk-upload'),
]