from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.db import transaction
from django.db.models import Sum, Q
import json
import traceback
import logging
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from django.utils import timezone
from .models import (
    Organization, OrganizationUser, StrategicObjective,
    Program, StrategicInitiative, PerformanceMeasure, MainActivity,
    ActivityBudget, SubActivity, ActivityCostingAssumption,InitiativeFeed,
    Plan, PlanReview,Location, LandTransport, AirTransport,
    PerDiem, Accommodation, ParticipantCost, SessionCost,
    PrintingCost, SupervisorCost, ProcurementItem
)
from .serializers import (
    OrganizationSerializer, OrganizationUserSerializer, UserSerializer,
    StrategicObjectiveSerializer, ProgramSerializer,
    StrategicInitiativeSerializer, PerformanceMeasureSerializer, MainActivitySerializer,
    ActivityBudgetSerializer,SubActivitySerializer, ActivityCostingAssumptionSerializer, InitiativeFeedSerializer,
    PlanSerializer, PlanReviewSerializer,LocationSerializer, LandTransportSerializer,
    AirTransportSerializer, PerDiemSerializer, AccommodationSerializer,
    ParticipantCostSerializer, SessionCostSerializer, PrintingCostSerializer,
    SupervisorCostSerializer,ProcurementItemSerializer
)

# Set up logger
logger = logging.getLogger(__name__)

@ensure_csrf_cookie
def login_view(request):
    if request.method == 'POST':
        try:
            # Use json.loads instead of request.json
            data = json.loads(request.body.decode('utf-8'))
            username = data.get('username')
            password = data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)

                # Get the user's organizations
                user_organizations = OrganizationUser.objects.filter(user=user).select_related('organization')
                user_orgs_data = [
                    {
                        'id': org.id,
                        'user': org.user_id,
                        'organization': org.organization_id,
                        'organization_name': org.organization.name,
                        'role': org.role,
                        'created_at': org.created_at
                    }
                    for org in user_organizations
                ]

                return JsonResponse({
                    'detail': 'Login successful',
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    },
                    'userOrganizations': user_orgs_data
                })
            else:
                return JsonResponse({'detail': 'Invalid credentials'}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.exception("Error in login view")
            return JsonResponse({'detail': f'Error: {str(e)}'}, status=400)
    return JsonResponse({'detail': 'Method not allowed'}, status=405)

@csrf_protect
def logout_view(request):
    logout(request)
    logger.info(f"User logged out: {request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'Anonymous'}")
    return JsonResponse({'detail': 'Logout successful'})

@ensure_csrf_cookie
def check_auth(request):
    if request.user.is_authenticated:
        # Get the user's organizations
        user_organizations = OrganizationUser.objects.filter(user=request.user).select_related('organization')
        user_orgs_data = [
            {
                'id': org.id,
                'user': org.user_id,
                'organization': org.organization_id,
                'organization_name': org.organization.name,
                'role': org.role,
                'created_at': org.created_at
            }
            for org in user_organizations
        ]

        return JsonResponse({
            'isAuthenticated': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
            },
            'userOrganizations': user_orgs_data
        })
    return JsonResponse({'isAuthenticated': False})

# CSRF token endpoint
@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({'detail': 'CSRF cookie set'})

# Update user profile
@csrf_protect
def update_profile(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            user = request.user

            # Update fields
            if 'first_name' in data:
                user.first_name = data['first_name']
            if 'last_name' in data:
                user.last_name = data['last_name']
            if 'email' in data:
                user.email = data['email']

            user.save()

            return JsonResponse({
                'detail': 'Profile updated successfully',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                }
            })
        except Exception as e:
            logger.exception("Error updating profile")
            return JsonResponse({'detail': f'Error updating profile: {str(e)}'}, status=400)

    return JsonResponse({'detail': 'Method not allowed'}, status=405)

# Change password
@csrf_protect
def password_change(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            current_password = data.get('current_password')
            new_password = data.get('new_password')

            # Check if current password is correct
            user = authenticate(username=request.user.username, password=current_password)
            if not user:
                return JsonResponse({'detail': 'Current password is incorrect'}, status=400)

            # Validate new password
            try:
                validate_password(new_password, user)
            except ValidationError as e:
                return JsonResponse({'detail': e.messages[0]}, status=400)

            # Set new password
            user.set_password(new_password)
            user.save()

            # Update session to prevent logout
            login(request, user)

            return JsonResponse({'detail': 'Password changed successfully'})
        except Exception as e:
            logger.exception("Error changing password")
            return JsonResponse({'detail': f'Error changing password: {str(e)}'}, status=400)

    return JsonResponse({'detail': 'Method not allowed'}, status=405)

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [AllowAny]  # Allow public access to organizations

    def get_permissions(self):
        if self.request.method == 'GET':
            # For GET requests (list, retrieve), allow public access
            return [AllowAny()]
        # For other methods, use the default permissions
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        try:
            logger.info("OrganizationViewSet.list called")
            logger.info(f"User authenticated: {request.user.is_authenticated}")
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            data = serializer.data
            logger.info(f"Returning {len(data)} organizations")
            return Response(data)
        except Exception as e:
            logger.exception("Error in OrganizationViewSet.list")
            return Response({"error": str(e)}, status=500)

    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        except Exception as e:
            logger.exception("Error in OrganizationViewSet.retrieve")
            return Response({"error": str(e)}, status=500)

    def get_queryset(self):
        try:
            logger.info("Fetching all organizations in get_queryset")
            logger.info(f"User authenticated: {self.request.user.is_authenticated}")
            logger.info(f"User: {self.request.user.username if self.request.user.is_authenticated else 'Anonymous'}")
            queryset = Organization.objects.all()
            logger.info(f"Found {queryset.count()} organizations")
            return queryset
        except Exception as e:
            logger.exception("Error in get_queryset")
            # Return empty queryset on error
            return Organization.objects.none()

    def update(self, request, *args, **kwargs):
        try:
            logger.info(f"Updating organization: {kwargs.get('pk')}")
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)

            # Explicitly log the data being saved
            logger.info(f"Organization update data: {request.data}")

            return Response(serializer.data)
        except Exception as e:
            logger.exception("Error updating organization")
            return Response({"error": str(e)}, status=500)

class OrganizationUserViewSet(viewsets.ModelViewSet):
    queryset = OrganizationUser.objects.all()
    serializer_class = OrganizationUserSerializer
    permission_classes = [IsAuthenticated]
class InitiativeFeedViewSet(viewsets.ModelViewSet):
    queryset = InitiativeFeed.objects.filter(is_active=True).select_related('strategic_objective').order_by('name')
    serializer_class = InitiativeFeedSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        strategic_objective = self.request.query_params.get('strategic_objective', None)
        user_org = getattr(self.request.user, 'organization', None)

        if strategic_objective is not None:
            base_queryset = queryset.filter(strategic_objective=strategic_objective)
            if user_org:
                # Show initiatives that are default OR belong to user's org OR have no org (legacy)
                queryset = base_queryset.filter(
                    models.Q(is_default=True) |
                    models.Q(organization__isnull=True) |
                    models.Q(organization=user_org)
                )
            else:
                queryset = base_queryset
        elif user_org:
            # If no specific filters, still filter by organization
            queryset = queryset.filter(
                models.Q(is_default=True) |
                models.Q(organization__isnull=True) |
                models.Q(organization=user_org)
            )

        # Add proper ordering and select_related for performance
        queryset = queryset.select_related('strategic_objective', 'organization').order_by('-created_at')

        console_log_message = f"StrategicInitiativeViewSet: Filtered queryset - objective:{strategic_objective}, user_org:{user_org}, count:{queryset.count()}"
        print(console_log_message)

        return queryset
class StrategicObjectiveViewSet(viewsets.ModelViewSet):
    queryset = StrategicObjective.objects.all()
    serializer_class = StrategicObjectiveSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Ensure we always return objectives with proper error handling
        """
        try:
            queryset = StrategicObjective.objects.all().order_by('id')
            return queryset
        except Exception as e:
            print(f"Error in StrategicObjectiveViewSet.get_queryset: {e}")
            return StrategicObjective.objects.none()

    def list(self, request, *args, **kwargs):
        """
        Override list method to ensure proper error handling and response format
        """
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)

            # Ensure we return data in expected format
            return Response({
                'data': serializer.data,
                'count': len(serializer.data)
            })
        except Exception as e:
            print(f"Error in StrategicObjectiveViewSet.list: {e}")
            return Response({
                'error': 'Failed to load strategic objectives',
                'data': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve(self, request, *args, **kwargs):
        """
        Override retrieve method for better error handling
        """
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in StrategicObjectiveViewSet.retrieve: {e}")
            return Response({
                'error': 'Failed to load strategic objective'
            }, status=status.HTTP_404_NOT_FOUND)

    def update(self, request, *args, **kwargs):
        """
        Override update method with better error handling
        """
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)

            if serializer.is_valid():
                self.perform_update(serializer)
                return Response(serializer.data)
            else:
                print(f"Validation errors in objective update: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error in StrategicObjectiveViewSet.update: {e}")
            return Response({
                'error': 'Failed to update strategic objective'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, *args, **kwargs):
        try:
            logger.info(f"Updating strategic objective: {kwargs.get('pk')}")
            partial = kwargs.pop('partial', False)
            instance = self.get_object()

            # Log the current and new values
            logger.info(f"Current weight: {instance.weight}")
            logger.info(f"Current planner_weight: {instance.planner_weight}")
            logger.info(f"Update data: {request.data}")

            # Determine if this is a planner updating a default objective
            user_is_planner = OrganizationUser.objects.filter(
                user=request.user,
                role='PLANNER'
            ).exists()

            # If a planner is updating weight for a default objective, set planner_weight
            if user_is_planner and instance.is_default and 'weight' in request.data:
                # Store the requested weight in planner_weight instead of weight
                if 'planner_weight' not in request.data:
                    request.data['planner_weight'] = request.data['weight']
                logger.info(f"Planner updating default objective. Setting planner_weight to {request.data['planner_weight']}")

            # Process the update
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)

            # Log the updated instance
            logger.info(f"Updated weight: {instance.weight}")
            logger.info(f"Updated planner_weight: {instance.planner_weight}")

            return Response(serializer.data)
        except Exception as e:
            logger.exception("Error updating strategic objective")
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """
        Get weight summary with proper error handling
        """
        try:
            objectives = StrategicObjective.objects.all()
            total_weight = sum(obj.get_effective_weight() for obj in objectives)
            remaining_weight = 100 - total_weight
            is_valid = total_weight == 100

            return Response({
                'total_weight': total_weight,
                'remaining_weight': remaining_weight,
                'is_valid': is_valid
            })
        except Exception as e:
            print(f"Error in weight_summary: {e}")
            return Response({
                'error': 'Failed to calculate weight summary',
                'total_weight': 0,
                'remaining_weight': 100,
                'is_valid': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        """
        Get the sum of all objective weights and check if they sum to 100%
        """
        total_weight = StrategicObjective.objects.aggregate(
            total=Sum('weight')
        )['total'] or 0

        # Calculate remaining weight (target is 100%)
        remaining_weight = 100 - total_weight

        # Validate if total is valid (should be 100%)
        is_valid = total_weight == 100

        return Response({
            'total_weight': total_weight,
            'remaining_weight': remaining_weight,
            'is_valid': is_valid
        })

    @action(detail=False, methods=['post'])
    def validate_total_weight(self, request):
        """
        Validate that the total weight of all objectives is 100%
        """
        total_weight = StrategicObjective.objects.aggregate(
            total=Sum('weight')
        )['total'] or 0

        if total_weight == 100:
            return Response({
                'detail': 'Total weight of all objectives is 100%',
                'is_valid': True
            })
        else:
            return Response({
                'detail': f'Total weight of all objectives should be 100%, but is {total_weight}%',
                'is_valid': False
            }, status=status.HTTP_400_BAD_REQUEST)

class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Get current user's organization for filtering
        user_org = None
        if self.request.user.is_authenticated:
            user_org_instance = self.request.user.organization_users.first()
            if user_org_instance:
                user_org = user_org_instance.organization_id

        # Filter by strategic objective if provided
        strategic_objective_id = self.request.query_params.get('strategic_objective')
        if strategic_objective_id:
            queryset = queryset.filter(strategic_objective_id=strategic_objective_id)

        return queryset

class StrategicInitiativeViewSet(viewsets.ModelViewSet):
    queryset = StrategicInitiative.objects.all()
    serializer_class = StrategicInitiativeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Get the user's organizations
        if self.request.user.is_authenticated:
            user_organizations = OrganizationUser.objects.filter(user=self.request.user).values_list('organization_id', flat=True)
        else:
            user_organizations = []

        # Filter based on query parameters
        strategic_objective = self.request.query_params.get('objective')
        program = self.request.query_params.get('program')

        # Handle filtering by parent type
        if strategic_objective:
            base_query = queryset.filter(strategic_objective_id=strategic_objective)
        elif program:
            base_query = queryset.filter(program_id=program)
        else:
            base_query = queryset

        # Return default initiatives OR initiatives from the user's organizations
        return base_query.filter(
            Q(is_default=True) |  # All default initiatives
            Q(is_default=False, organization_id__in=user_organizations)  # Custom initiatives from user's orgs
        )

    def perform_create(self, serializer):
        # Get the organization_id from the request data
        organization_id = serializer.validated_data.get('organization_id')
        initiative_feed = serializer.validated_data.get('initiative_feed')

        # If using an initiative feed, copy the name
        name = serializer.validated_data.get('name')
        if initiative_feed and not name:
            name = initiative_feed.name

        # If no organization_id was provided, try to get the user's primary organization
        if not organization_id:
            user_org = OrganizationUser.objects.filter(user=self.request.user).first()
            if user_org:
                organization_id = user_org.organization_id

        # Set is_default=False and organization_id when created by a planner
        if not serializer.validated_data.get('is_default', True) and organization_id:
            serializer.save(
                organization_id=organization_id,
                is_default=False,
                name=name
            )
        else:
            serializer.save(name=name)

    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """
        Calculate weight summary for initiatives under a specific parent
        """
        strategic_objective_id = request.query_params.get('objective')
        program_id = request.query_params.get('program')

        if strategic_objective_id:
            # Get the objective
            try:
                objective = StrategicObjective.objects.get(id=strategic_objective_id)
                # Use the effective weight (planner_weight if available, otherwise weight)
                if objective.planner_weight is not None:
                    parent_weight = objective.planner_weight
                else:
                    parent_weight = objective.weight
                parent_type = 'strategic_objective'
                parent_id = strategic_objective_id

                logger.info(f"Initiative weight summary for objective {objective.id}: weight={objective.weight}, planner_weight={objective.planner_weight}, effective={parent_weight}")
            except StrategicObjective.DoesNotExist:
                return Response({'detail': 'Strategic objective not found'}, status=status.HTTP_404_NOT_FOUND)

            # Get initiatives for this objective
            initiatives = self.get_queryset().filter(strategic_objective_id=strategic_objective_id)

        elif program_id:
            # Get the program
            try:
                program = Program.objects.get(id=program_id)
                parent_weight = 100  # Programs no longer have weight
                parent_type = 'program'
                parent_id = program_id
            except Program.DoesNotExist:
                return Response({'detail': 'Program not found'}, status=status.HTTP_404_NOT_FOUND)

            # Get initiatives for this program
            initiatives = self.get_queryset().filter(program_id=program_id)

        else:
            return Response({'detail': 'Missing parent ID parameter'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate total initiatives weight
        total_initiatives_weight = initiatives.aggregate(
            total=Sum('weight')
        )['total'] or 0

        # Calculate remaining weight
        remaining_weight = parent_weight - total_initiatives_weight

        # Validate if total is valid (should be equal to parent_weight for objectives)
        is_valid = parent_type == 'strategic_objective' and abs(total_initiatives_weight - parent_weight) < 0.01 or total_initiatives_weight <= parent_weight

        return Response({
            'parent_type': parent_type,
            'parent_id': parent_id,
            'parent_weight': parent_weight,
            'total_initiatives_weight': total_initiatives_weight,
            'remaining_weight': remaining_weight,
            'is_valid': is_valid
        })

    @action(detail=False, methods=['post'])
    def validate_initiatives_weight(self, request):
        """
        Validate that the total weight of initiatives is correct for the parent
        """
        strategic_objective_id = request.query_params.get('objective')
        program_id = request.query_params.get('program')

        if strategic_objective_id:
            # Get the objective
            try:
                objective = StrategicObjective.objects.get(id=strategic_objective_id)
                parent_weight = objective.get_effective_weight()  # Use effective weight
                parent_type = 'strategic objective'

                initiatives = self.get_queryset().filter(strategic_objective_id=strategic_objective_id)

                total_weight = initiatives.aggregate(
                    total=Sum('weight')
                )['total'] or 0

                # For objectives, total must equal parent_weight exactly (using epsilon for floating point comparison)
                if abs(total_weight - parent_weight) < 0.01:
                    return Response({
                        'message': f'Total weight of initiatives for this {parent_type} is {parent_weight}%',
                        'is_valid': True
                    })
                else:
                    return Response({
                        'message': f'Total weight of initiatives for this {parent_type} should be {parent_weight}%, but is {total_weight}%',
                        'is_valid': False,
                        'total_weight': total_weight,
                        'parent_weight': parent_weight
                    }, status=status.HTTP_400_BAD_REQUEST)

            except StrategicObjective.DoesNotExist:
                return Response({'detail': 'Strategic objective not found'}, status=status.HTTP_404_NOT_FOUND)

        elif program_id:
            initiatives = self.get_queryset().filter(program_id=program_id)
            parent_type = 'program'

            total_weight = initiatives.aggregate(
                total=Sum('weight')
            )['total'] or 0

            # For programs, total should not exceed 100%
            if total_weight <= 100:
                return Response({
                    'message': f'Total weight of initiatives for this {parent_type} is {total_weight}%',
                    'is_valid': True
                })
            else:
                return Response({
                    'message': f'Total weight of initiatives for this {parent_type} should not exceed 100%, but is {total_weight}%',
                    'is_valid': False,
                    'total_weight': total_weight
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'detail': 'Missing parent ID parameter'}, status=status.HTTP_400_BAD_REQUEST)

class PerformanceMeasureViewSet(viewsets.ModelViewSet):
    queryset = PerformanceMeasure.objects.all()
    serializer_class = PerformanceMeasureSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Get the user's organizations
        if self.request.user.is_authenticated:
            user_organizations = OrganizationUser.objects.filter(user=self.request.user).values_list('organization_id', flat=True)
        else:
            user_organizations = []

        # Filter by initiative if provided
        initiative_id = self.request.query_params.get('initiative')
        if initiative_id:
            # Get the base queryset filtered by initiative
            base_query = queryset.filter(initiative_id=initiative_id)

            # Return default measures (with no organization) OR measures from the user's organizations
            return base_query.filter(
                Q(organization__isnull=True) |  # Default measures with no organization
                Q(organization_id__in=user_organizations)  # Custom measures from user's orgs
            )

        return queryset

    def perform_create(self, serializer):
        # Get the organization_id from the request data
        organization_id = serializer.validated_data.get('organization_id')

        # If no organization_id was provided, try to get the user's primary organization
        if not organization_id:
            user_org = OrganizationUser.objects.filter(user=self.request.user).first()
            if user_org:
                organization_id = user_org.organization_id

        # Save with the organization ID
        serializer.save(organization_id=organization_id)

    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """
        Calculate weight summary for performance measures under a specific initiative
        """
        initiative_id = request.query_params.get('initiative')

        if not initiative_id:
            return Response({'detail': 'Initiative ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get the initiative to check its weight
            initiative = StrategicInitiative.objects.get(id=initiative_id)
            initiative_weight = initiative.weight

            # Get measures for this initiative
            measures = self.get_queryset().filter(initiative_id=initiative_id)

            # Calculate total measures weight
            total_measures_weight = measures.aggregate(
                total=Sum('weight')
            )['total'] or 0

            # Expected weight for measures is 35% of initiative weight
            expected_measures_weight = 35

            # Calculate remaining weight
            remaining_weight = expected_measures_weight - total_measures_weight

            # Validate if total is valid (should be 35%)
            is_valid = total_measures_weight == expected_measures_weight

            return Response({
                'initiative_id': initiative_id,
                'initiative_weight': initiative_weight,
                'expected_measures_weight': expected_measures_weight,
                'total_measures_weight': total_measures_weight,
                'remaining_weight': remaining_weight,
                'is_valid': is_valid
            })

        except StrategicInitiative.DoesNotExist:
            return Response({'detail': 'Initiative not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'])
    def validate_measures_weight(self, request):
        """
        Validate that the total weight of performance measures is 35%
        """
        initiative_id = request.query_params.get('initiative')

        if not initiative_id:
            return Response({'detail': 'Initiative ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get measures for this initiative
        measures = self.get_queryset().filter(initiative_id=initiative_id)

        # Calculate total measures weight
        total_weight = measures.aggregate(
            total=Sum('weight')
        )['total'] or 0

        # Expected weight for measures is 35%
        expected_weight = 35

        # Check if weight is exactly 35%
        if total_weight == expected_weight:
            return Response({
                'message': 'Total weight of performance measures is 35%',
                'is_valid': True
            })
        else:
            return Response({
                'message': f'Total weight of performance measures should be 35%, but is {total_weight}%',
                'is_valid': False,
                'total_weight': total_weight
            }, status=status.HTTP_400_BAD_REQUEST)
# Location viewset
class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by region if provided
        region = self.request.query_params.get('region')
        if region:
            queryset = queryset.filter(region=region)

        # Filter by hardship area
        hardship = self.request.query_params.get('is_hardship_area')
        if hardship:
            hardship_bool = hardship.lower() in ['true', '1', 'yes']
            queryset = queryset.filter(is_hardship_area=hardship_bool)

        return queryset

# Land Transport viewset
class LandTransportViewSet(viewsets.ModelViewSet):
    queryset = LandTransport.objects.all()
    serializer_class = LandTransportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by origin location
        origin = self.request.query_params.get('origin')
        if origin:
            queryset = queryset.filter(origin_id=origin)

        # Filter by destination location
        destination = self.request.query_params.get('destination')
        if destination:
            queryset = queryset.filter(destination_id=destination)

        # Filter by trip type
        trip_type = self.request.query_params.get('trip_type')
        if trip_type:
            queryset = queryset.filter(trip_type=trip_type)

        return queryset

# Air Transport viewset
class AirTransportViewSet(viewsets.ModelViewSet):
    queryset = AirTransport.objects.all()
    serializer_class = AirTransportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by origin location
        origin = self.request.query_params.get('origin')
        if origin:
            queryset = queryset.filter(origin_id=origin)

        # Filter by destination location
        destination = self.request.query_params.get('destination')
        if destination:
            queryset = queryset.filter(destination_id=destination)

        # Filter by trip type
        trip_type = self.request.query_params.get('trip_type')
        if trip_type:
            queryset = queryset.filter(trip_type=trip_type)

        return queryset

# PerDiem viewset
class PerDiemViewSet(viewsets.ModelViewSet):
    queryset = PerDiem.objects.all()
    serializer_class = PerDiemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by location
        location = self.request.query_params.get('location')
        if location:
            queryset = queryset.filter(location_id=location)

        return queryset

# Accommodation viewset
class AccommodationViewSet(viewsets.ModelViewSet):
    queryset = Accommodation.objects.all()
    serializer_class = AccommodationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by location
        location = self.request.query_params.get('location')
        if location:
            queryset = queryset.filter(location_id=location)

        # Filter by service type
        service_type = self.request.query_params.get('service_type')
        if service_type:
            queryset = queryset.filter(service_type=service_type)

        return queryset

# ParticipantCost viewset
class ParticipantCostViewSet(viewsets.ModelViewSet):
    queryset = ParticipantCost.objects.all()
    serializer_class = ParticipantCostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by cost type
        cost_type = self.request.query_params.get('cost_type')
        if cost_type:
            queryset = queryset.filter(cost_type=cost_type)

        return queryset

# SessionCost viewset
class SessionCostViewSet(viewsets.ModelViewSet):
    queryset = SessionCost.objects.all()
    serializer_class = SessionCostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by cost type
        cost_type = self.request.query_params.get('cost_type')
        if cost_type:
            queryset = queryset.filter(cost_type=cost_type)

        return queryset

# PrintingCost viewset
class PrintingCostViewSet(viewsets.ModelViewSet):
    queryset = PrintingCost.objects.all()
    serializer_class = PrintingCostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by document type
        document_type = self.request.query_params.get('document_type')
        if document_type:
            queryset = queryset.filter(document_type=document_type)

        return queryset

# SupervisorCost viewset
class SupervisorCostViewSet(viewsets.ModelViewSet):
    queryset = SupervisorCost.objects.all()
    serializer_class = SupervisorCostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by cost type
        cost_type = self.request.query_params.get('cost_type')
        if cost_type:
            queryset = queryset.filter(cost_type=cost_type)

        return queryset
# ProcurementItem viewset
class ProcurementItemViewSet(viewsets.ModelViewSet):
    queryset = ProcurementItem.objects.all()
    serializer_class = ProcurementItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by category if provided
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        return queryset
class MainActivityViewSet(viewsets.ModelViewSet):
    queryset = MainActivity.objects.all()
    serializer_class = MainActivitySerializer
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """
        Custom destroy method to handle cascade deletes properly in production
        """
        try:
            instance = self.get_object()
            instance_name = instance.name
            
            print(f"MainActivityViewSet: Starting delete for main activity {instance.id} ({instance_name})")
            
            # Get sub-activities count for logging
            sub_activities = list(instance.sub_activities.all())
            sub_activity_count = len(sub_activities)
            print(f"Found {sub_activity_count} sub-activities to delete")
            
            # Clean up any ActivityBudget records that reference these sub-activities
            if sub_activity_count > 0:
                logger.info(f"Cleaning up budget references for {sub_activity_count} sub-activities")
                for sub_activity in sub_activities:
                    ActivityBudget.objects.filter(sub_activity_id=str(sub_activity.id)).delete()
                
            # Clean up legacy budget records linked to main activity
            legacy_budgets = ActivityBudget.objects.filter(activity=instance)
            legacy_count = legacy_budgets.count()
            if legacy_count > 0:
                logger.info(f"Deleting {legacy_count} legacy ActivityBudget records")
                legacy_budgets.delete()
                
            # Delete the main activity (this will cascade to sub-activities)
            instance.delete()
            print(f"Main activity {instance.id} deleted successfully")
            
            return Response(
                {'message': 'Main activity and all related data deleted successfully'}, 
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            print(f"Error deleting main activity {kwargs.get('pk')}: {str(e)}")
            return Response(
                {'error': f'Failed to delete main activity: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    def get_queryset(self):
        queryset = super().get_queryset()

        # Get the user's organizations
        if self.request.user.is_authenticated:
            user_organizations = OrganizationUser.objects.filter(user=self.request.user).values_list('organization_id', flat=True)
        else:
            user_organizations = []

        # Filter by initiative if provided
        initiative_id = self.request.query_params.get('initiative')
        if initiative_id:
            # Get the base queryset filtered by initiative
            base_query = queryset.filter(initiative_id=initiative_id)

            # Return activities with no organization OR activities from user's organizations
            return base_query.filter(
                Q(organization__isnull=True) |  # Default activities with no organization
                Q(organization_id__in=user_organizations)  # Custom activities from user's orgs
            )

        return queryset

    def perform_create(self, serializer):
        # Get the organization_id from the request data
        organization_id = serializer.validated_data.get('organization_id')

        # If no organization_id was provided, try to get the user's primary organization
        if not organization_id:
            user_org = OrganizationUser.objects.filter(user=self.request.user).first()
            if user_org:
                organization_id = user_org.organization_id

        # Save with the organization ID
        serializer.save(organization_id=organization_id)

    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """
        Calculate weight summary for main activities under a specific initiative
        """
        initiative_id = request.query_params.get('initiative')

        if not initiative_id:
            return Response({'detail': 'Initiative ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get the initiative to check its weight
            initiative = StrategicInitiative.objects.get(id=initiative_id)
            initiative_weight = float(initiative.weight)

            # Get activities for this initiative
            activities = self.get_queryset().filter(initiative_id=initiative_id)

            # Calculate total activities weight
            total_weight_result = activities.aggregate(
                total=Sum('weight')
            )
            total_activities_weight = float(total_weight_result['total'] or 0)

            # Expected weight for activities is 65% of initiative weight
            expected_activities_weight = round(initiative_weight * 0.65, 2)

            # Calculate remaining weight
            remaining_weight = expected_activities_weight - total_activities_weight

            # Validate if total is valid (should be 65% of initiative weight)
            is_valid = abs(total_activities_weight - expected_activities_weight) < 0.01

            return Response({
                'initiative_id': initiative_id,
                'initiative_weight': initiative_weight,
                'expected_activities_weight': expected_activities_weight,
                'total_activities_weight': total_activities_weight,
                'remaining_weight': remaining_weight,
                'is_valid': is_valid
            })

        except StrategicInitiative.DoesNotExist:
            return Response({'detail': 'Initiative not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'])
    def validate_activities_weight(self, request):
        """
        Validate that the total weight of main activities is 65% of initiative weight
        """
        initiative_id = request.query_params.get('initiative')

        if not initiative_id:
            return Response({'detail': 'Initiative ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get the initiative to check its weight
        try:
            initiative = StrategicInitiative.objects.get(id=initiative_id)
            initiative_weight = float(initiative.weight)
        except StrategicInitiative.DoesNotExist:
            return Response({'detail': 'Initiative not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get activities for this initiative
        activities = self.get_queryset().filter(initiative_id=initiative_id)

        # Calculate total activities weight
        total_weight = activities.aggregate(
            total=Sum('weight')
        )['total'] or 0

        # Expected weight for activities is 65% of initiative weight (as a value)
        expected_weight = round(initiative_weight * 0.65, 2)

        # Check if weight is exactly 65% of initiative weight
        if abs(float(total_weight) - expected_weight) < 0.01:
            return Response({
                'message': f'Total weight of main activities is {expected_weight} (65% of initiative weight {initiative_weight})',
                'is_valid': True
            })
        else:
            return Response({
                'message': f'Total weight of main activities should be {expected_weight} (65% of initiative weight {initiative_weight}), but is {total_weight}',
                'is_valid': False,
                'total_weight': total_weight
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_budget(self, request, pk=None):
        """
        Update or create budget for an activity
        """
        activity = self.get_object()

        try:
            with transaction.atomic():
                # Try to get existing budget
                try:
                    budget = SubActivity.objects.get(activity=activity)
                    # Update existing budget
                    budget_serializer = SubActivitySerializer(budget, data=request.data, partial=True)
                except SubActivity.DoesNotExist:
                    # Create new budget
                    budget_serializer = SubActivitySerializer(data=request.data)

                budget_serializer.is_valid(raise_exception=True)
                budget = budget_serializer.save(activity=activity)

                # Return updated budget
                return Response(SubActivitySerializer(budget).data)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)



class SubActivityViewSet(viewsets.ModelViewSet):
    queryset = SubActivity.objects.all()
    serializer_class = SubActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = SubActivity.objects.all()
        main_activity = self.request.query_params.get('main_activity', None)
        if main_activity is not None:
            queryset = queryset.filter(main_activity=main_activity)
        return queryset

    @action(detail=True, methods=['post'])
    def add_budget(self, request, pk=None):
        """Add budget for a sub-activity"""
        try:
            sub_activity = self.get_object()
            budget_data = request.data

            # Create budget for this sub-activity
            budget = ActivityBudget.objects.create(
                sub_activity=sub_activity,
                **budget_data
            )

            serializer = ActivityBudgetSerializer(budget)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """
        Custom destroy method to handle cascade deletes properly in production
        """
        try:
            instance = self.get_object()
            instance_name = instance.name
            
            print(f"SubActivityViewSet: Starting delete for sub-activity {instance.id} ({instance_name})")
            
            # Use the model's custom delete method which handles cascades
            instance.delete()
            
            print(f"SubActivityViewSet: Successfully deleted sub-activity {instance_name}")
            
            return Response(
                {"detail": f"Sub-activity '{instance_name}' and all related data deleted successfully"},
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            print(f"SubActivityViewSet: Error deleting sub-activity: {e}")
            return Response(
                {"detail": f"Failed to delete sub-activity: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['put'])
    def update_budget(self, request, pk=None):
        """Update budget for a sub-activity"""
        try:
            sub_activity = self.get_object()
            budget_data = request.data

            # Get or create the budget
            budget, created = ActivityBudget.objects.get_or_create(
                sub_activity=sub_activity,
                defaults=budget_data
            )

            if not created:
                # Update existing budget
                for key, value in budget_data.items():
                    if hasattr(budget, key):
                        setattr(budget, key, value)
                budget.save()

            serializer = ActivityBudgetSerializer(budget)
            return Response(serializer.data)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['delete'])
    def delete_budget(self, request, pk=None):
        """Delete budget for a sub-activity"""
        try:
            sub_activity = self.get_object()

            if hasattr(sub_activity, 'budget'):
                sub_activity.budget.delete()
                return Response({'message': 'Budget deleted successfully'})
            else:
                return Response(
                    {'error': 'No budget found for this sub-activity'},
                    status=status.HTTP_404_NOT_FOUND
                )

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
class ActivityBudgetViewSet(viewsets.ModelViewSet):
    queryset = ActivityBudget.objects.all()
    serializer_class = ActivityBudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ActivityBudget.objects.all()
        sub_activity = self.request.query_params.get('sub_activity', None)
        if sub_activity is not None:
            queryset = queryset.filter(sub_activity=sub_activity)
        # Keep legacy activity filtering for backward compatibility
        activity = self.request.query_params.get('activity', None)
        if activity is not None and not sub_activity:
            queryset = queryset.filter(activity=activity)
        return queryset



class ActivityCostingAssumptionViewSet(viewsets.ModelViewSet):
    queryset = ActivityCostingAssumption.objects.all()
    serializer_class = ActivityCostingAssumptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by activity type if provided
        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)

        # Filter by location if provided
        location = self.request.query_params.get('location')
        if location:
            queryset = queryset.filter(location=location)

        # Filter by cost type if provided
        cost_type = self.request.query_params.get('cost_type')
        if cost_type:
            queryset = queryset.filter(cost_type=cost_type)

        return queryset


class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all().select_related('organization', 'strategic_objective').prefetch_related('reviews', 'selected_objectives')
    serializer_class = PlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter plans based on user's role and organization"""
        queryset = super().get_queryset()
        user = self.request.user

        # Check for special 'all' parameter for evaluators/admins
        show_all = self.request.query_params.get('all', 'false').lower() == 'true'

        # Get user's organizations and role
        user_organizations = OrganizationUser.objects.filter(user=user)

        if not user_organizations.exists():
            # User has no organization access, return empty queryset
            logger.warning(f"User {user.username} has no organization access")
            return queryset.none()

        # Check user's role
        user_roles = user_organizations.values_list('role', flat=True)
        user_org_ids = user_organizations.values_list('organization', flat=True)

        logger.info(f"User {user.username} roles: {list(user_roles)}, orgs: {list(user_org_ids)}")

        # Admins can see all plans
        if 'ADMIN' in user_roles:
            logger.info(f"Admin {user.username} accessing all plans")
            return queryset

        # Evaluators can see all plans for review purposes
        if 'EVALUATOR' in user_roles:
            if show_all:
                logger.info(f"Evaluator {user.username} accessing all plans for statistics")
                return queryset
            else:
                # For individual plan access, evaluators can see all plans
                logger.info(f"Evaluator {user.username} accessing all plans for review")
                return queryset

        # Planners can only see plans from their own organizations
        if 'PLANNER' in user_roles:
            filtered_queryset = queryset.filter(organization__in=user_org_ids)
            logger.info(f"Planner {user.username} accessing {filtered_queryset.count()} plans from orgs {list(user_org_ids)}")
            return filtered_queryset

        # Default: no access
        logger.warning(f"User {user.username} has no recognized role, denying access")
        return queryset.none()

    def create(self, request, *args, **kwargs):
        """Custom create method with enhanced logging and validation"""
        logger.info(f"PlanViewSet.create called with data: {request.data}")

        try:
            # Validate required fields
            required_fields = ['organization', 'planner_name', 'type', 'from_date', 'to_date']
            for field in required_fields:
                if not request.data.get(field):
                    return Response(
                        {'error': f'{field} is required'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Validate selected objectives
            selected_objectives = request.data.get('selected_objectives', [])
            if not selected_objectives:
                return Response(
                    {'error': 'At least one objective must be selected'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate selected objectives weights
            selected_objectives_weights = request.data.get('selected_objectives_weights')
            if not selected_objectives_weights:
                return Response(
                    {'error': 'Selected objectives weights are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            logger.info(f"Validation passed. Creating plan with serializer...")

            # Use transaction to ensure data consistency
            with transaction.atomic():
                serializer = self.get_serializer(data=request.data)
                if serializer.is_valid():
                    plan = serializer.save()
                    logger.info(f"Plan created successfully with ID: {plan.id}")

                    # Verify the data was saved correctly
                    plan.refresh_from_db()
                    logger.info(f"Plan verification - selected_objectives count: {plan.selected_objectives.count()}")
                    logger.info(f"Plan verification - selected_objectives_weights: {plan.selected_objectives_weights}")

                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                else:
                    logger.error(f"Serializer validation failed: {serializer.errors}")
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception(f"Exception in plan creation: {str(e)}")
            return Response(
                {'error': f'Failed to create plan: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_create(self, serializer):
        """Override to save selected objectives when creating plan"""
        try:
            plan = serializer.save()

            # Only save objectives that the planner actually selected (have planner_weight set)
            selected_objectives = StrategicObjective.objects.filter(
                planner_weight__isnull=False
            ).distinct()

            # If no objectives have planner_weight, fall back to the main strategic_objective
            if not selected_objectives.exists() and plan.strategic_objective:
                selected_objectives = StrategicObjective.objects.filter(id=plan.strategic_objective.id)

            # Save all selected objectives to the plan
            plan.selected_objectives.set(selected_objectives)

            logger.info(f"Plan {plan.id} created with {selected_objectives.count()} objectives")
        except Exception as e:
            logger.exception("Error creating plan with selected objectives")
            raise

    def perform_update(self, serializer):
        """Override to update selected objectives when updating plan"""
        try:
            plan = serializer.save()

            # If plan is being submitted, ensure all selected objectives are saved
            if plan.status == 'SUBMITTED':
                # Only save objectives that the planner actually selected (have planner_weight set)
                selected_objectives = StrategicObjective.objects.filter(
                    planner_weight__isnull=False
                ).distinct()

                # If no objectives have planner_weight, fall back to the main strategic_objective
                if not selected_objectives.exists() and plan.strategic_objective:
                    selected_objectives = StrategicObjective.objects.filter(id=plan.strategic_objective.id)

                # Update selected objectives
                plan.selected_objectives.set(selected_objectives)

                logger.info(f"Plan {plan.id} submitted with {selected_objectives.count()} objectives")
        except Exception as e:
            logger.exception("Error updating plan with selected objectives")
            raise

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit plan for review"""
        try:
            plan = self.get_object()

            if plan.status != 'DRAFT':
                return Response({'error': 'Only draft plans can be submitted'}, status=status.HTTP_400_BAD_REQUEST)

            # Only save objectives that the planner actually selected (have planner_weight set)
            selected_objectives = StrategicObjective.objects.filter(
                planner_weight__isnull=False
            ).distinct()

            # If no objectives have planner_weight, fall back to the main strategic_objective
            if not selected_objectives.exists() and plan.strategic_objective:
                selected_objectives = StrategicObjective.objects.filter(id=plan.strategic_objective.id)

            plan.selected_objectives.set(selected_objectives)
            plan.status = 'SUBMITTED'
            plan.save()

            return Response({'message': 'Plan submitted successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Error submitting plan")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted plan"""
        try:
            logger.info(f"Attempting to approve plan {pk} by user {request.user.username}")
            plan = self.get_object()

            if plan.status != 'SUBMITTED':
                logger.warning(f"Plan {pk} status is {plan.status}, not SUBMITTED")
                return Response({'error': 'Only submitted plans can be approved'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if user has evaluator role
            user_organizations = OrganizationUser.objects.filter(user=request.user)
            user_roles = user_organizations.values_list('role', flat=True)

            if 'EVALUATOR' not in user_roles and 'ADMIN' not in user_roles:
                logger.warning(f"User {request.user.username} does not have evaluator/admin role")
                return Response({'error': 'Only evaluators can approve plans'}, status=status.HTTP_403_FORBIDDEN)

            # Get the evaluator's organization user record
            evaluator_org_user = user_organizations.filter(role__in=['EVALUATOR', 'ADMIN']).first()
            if not evaluator_org_user:
                logger.error(f"No evaluator organization record found for user {request.user.username}")
                return Response({'error': 'Evaluator organization record not found'}, status=status.HTTP_400_BAD_REQUEST)

            # Create review record
            review_data = {
                'plan': plan,
                'status': 'APPROVED',
                'feedback': request.data.get('feedback', ''),
                'evaluator': evaluator_org_user
            }

            logger.info(f"Creating review record for plan {pk}")
            review = PlanReview.objects.create(**review_data)

            # Update plan status
            plan.status = 'APPROVED'
            plan.save()

            logger.info(f"Plan {pk} approved successfully by {request.user.username}")
            return Response({'message': 'Plan approved successfully'}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Error approving plan {pk}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a submitted plan"""
        try:
            logger.info(f"Attempting to reject plan {pk} by user {request.user.username}")
            plan = self.get_object()

            if plan.status != 'SUBMITTED':
                logger.warning(f"Plan {pk} status is {plan.status}, not SUBMITTED")
                return Response({'error': 'Only submitted plans can be rejected'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if user has evaluator role
            user_organizations = OrganizationUser.objects.filter(user=request.user)
            user_roles = user_organizations.values_list('role', flat=True)

            if 'EVALUATOR' not in user_roles and 'ADMIN' not in user_roles:
                logger.warning(f"User {request.user.username} does not have evaluator/admin role")
                return Response({'error': 'Only evaluators can reject plans'}, status=status.HTTP_403_FORBIDDEN)

            # Get the evaluator's organization user record
            evaluator_org_user = user_organizations.filter(role__in=['EVALUATOR', 'ADMIN']).first()
            if not evaluator_org_user:
                logger.error(f"No evaluator organization record found for user {request.user.username}")
                return Response({'error': 'Evaluator organization record not found'}, status=status.HTTP_400_BAD_REQUEST)

            # Create review record
            review_data = {
                'plan': plan,
                'status': 'REJECTED',
                'feedback': request.data.get('feedback', ''),
                'evaluator': evaluator_org_user
            }

            logger.info(f"Creating review record for plan {pk}")
            review = PlanReview.objects.create(**review_data)

            # Update plan status
            plan.status = 'REJECTED'
            plan.save()

            logger.info(f"Plan {pk} rejected successfully by {request.user.username}")
            return Response({'message': 'Plan rejected successfully'}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Error rejecting plan {pk}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def pending_reviews(self, request):
        """Get plans pending review"""
        try:
            # Check if user is an evaluator
            user_organizations = OrganizationUser.objects.filter(user=request.user)
            user_roles = user_organizations.values_list('role', flat=True)

            if 'EVALUATOR' in user_roles:
                # Evaluators can see all submitted plans for review
                plans = Plan.objects.filter(status='SUBMITTED').select_related(
                    'organization', 'strategic_objective'
                ).prefetch_related('reviews', 'selected_objectives')
                logger.info(f"Evaluator {request.user.username} accessing {plans.count()} pending plans")
            elif 'ADMIN' in user_roles:
                # Admins can also see all submitted plans
                plans = Plan.objects.filter(status='SUBMITTED').select_related(
                    'organization', 'strategic_objective'
                ).prefetch_related('reviews', 'selected_objectives')
                logger.info(f"Admin {request.user.username} accessing {plans.count()} pending plans")
            else:
                # For planners and others, use the normal filtered queryset
                plans = self.get_queryset().filter(status='SUBMITTED')
                logger.info(f"User {request.user.username} accessing {plans.count()} filtered pending plans")

            serializer = self.get_serializer(plans, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.exception("Error fetching pending reviews")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PlanReviewViewSet(viewsets.ModelViewSet):
    queryset = PlanReview.objects.all().select_related('plan', 'evaluator')
    serializer_class = PlanReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        plan = self.request.query_params.get('plan', None)
        if plan is not None:
            queryset = queryset.filter(plan=plan)
        return queryset



# Costing Model ViewSets
class LocationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Location.objects.all().order_by('region', 'name')
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]

class LandTransportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LandTransport.objects.all().select_related('origin', 'destination')
    serializer_class = LandTransportSerializer
    permission_classes = [IsAuthenticated]

class AirTransportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AirTransport.objects.all().select_related('origin', 'destination')
    serializer_class = AirTransportSerializer
    permission_classes = [IsAuthenticated]

class PerDiemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PerDiem.objects.all().select_related('location')
    serializer_class = PerDiemSerializer
    permission_classes = [IsAuthenticated]

class AccommodationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Accommodation.objects.all().select_related('location')
    serializer_class = AccommodationSerializer
    permission_classes = [IsAuthenticated]

class ParticipantCostViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ParticipantCost.objects.all()
    serializer_class = ParticipantCostSerializer
    permission_classes = [IsAuthenticated]

class SessionCostViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SessionCost.objects.all()
    serializer_class = SessionCostSerializer
    permission_classes = [IsAuthenticated]

class PrintingCostViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PrintingCost.objects.all()
    serializer_class = PrintingCostSerializer
    permission_classes = [IsAuthenticated]

class SupervisorCostViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SupervisorCost.objects.all()
    serializer_class = SupervisorCostSerializer
    permission_classes = [IsAuthenticated]

class ProcurementItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProcurementItem.objects.all().order_by('category', 'name')
    serializer_class = ProcurementItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category', None)
        if category is not None:
            queryset = queryset.filter(category=category)
        return queryset