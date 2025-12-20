from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import redirect
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta

from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as filters 
from .serializers import RegisterSerializer, UserFollowSerializer, UserUpdateSerializer, TagSerializer

from django.contrib.auth.models import User
from .models import AiModel, GeneratedImage, Comment, Like, UserFollow, Notification
from .serializers import AiModelSerializer, GeneratedImageSerializer, CommentSerializer, LikeSerializer, UserSerializer, NotificationSerializer
from .permissions import IsAuthorOrReadOnly
from django.db.models import Q, Sum, Count, F, ExpressionWrapper, IntegerField
from taggit.models import Tag


class AiModelFilter(filters.FilterSet):
    # Поиск по тегу (без учета регистра)
    tag = filters.CharFilter(field_name='tags__name', lookup_expr='iexact')
    
    # Фильтры по дате (created_after=2025-01-01)
    created_after = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    # Фильтры по популярности (min_likes=50)
    min_likes = filters.NumberFilter(field_name='likes_count', lookup_expr='gte')
    min_downloads = filters.NumberFilter(field_name='downloads_count', lookup_expr='gte')

    class Meta:
        model = AiModel
        # Оставляем старые точные фильтры тут
        fields = ['model_type', 'author']

class GeneratedImageFilter(filters.FilterSet):
    tag = filters.CharFilter(field_name='tags__name', lookup_expr='iexact')
    
    created_after = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    min_likes = filters.NumberFilter(field_name='likes_count', lookup_expr='gte')

    class Meta:
        model = GeneratedImage
        fields = ['author', 'linked_model']

# --- Пагинация (чтобы не грузить 1000 картинок сразу) ---
class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

# --- VIEWSETS ---

class AiModelViewSet(viewsets.ModelViewSet):
    """
    API для моделей.
    Поддерживает: Поиск по названию, Фильтр по типу и базовой модели, Сортировку.
    """
    serializer_class = AiModelSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    pagination_class = StandardPagination
    
    # Подключаем фильтрацию
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    filterset_class = AiModelFilter
    # 2. По каким искать текст (?search=anime)
    search_fields = ['name', 'description', 'tags__name', 'author__username']
    # 3. Как сортировать (?ordering=-likes_count)
    ordering_fields = ['likes_count', 'downloads_count', 'created_at', 'rating']

    # Счетчик скачиваний (GET /api/models/5/download/)
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        instance = self.get_object()
        
        # Увеличиваем счетчик
        instance.downloads_count += 1
        instance.save()
        
        # ПЕРЕНАПРАВЛЯЕМ пользователя на реальный файл
        return redirect(instance.file.url)
    
    def get_queryset(self):
        user = self.request.user
        
        # ЭТАП 1: Базовая видимость (Security)
        # Аноним видит только is_published=True
        # Авторизованный видит is_published=True ИЛИ свои посты (даже черновики)
        if user.is_authenticated:
            # Q-объект: (Опубликовано) ИЛИ (Автор - это я)
            visibility_filter = Q(is_published=True) | Q(author=user)
        else:
            visibility_filter = Q(is_published=True)
            
        # Применяем базовый фильтр ко всей таблице
        queryset = AiModel.objects.filter(visibility_filter)
        queryset = queryset.annotate(
            # Считаем комменты
            comments_count_calc=Count('comments', distinct=True),
            # Вычисляем рейтинг по формуле
            rating=ExpressionWrapper(
                F('likes_count') * 1 + F('downloads_count') * 2 + Count('comments', distinct=True) * 3,
                output_field=IntegerField()
            )
        )

        # ЭТАП 2: Фильтрация по запросу (User Preferences)
        feed_param = self.request.query_params.get('feed')
        
        # Если в URL есть ?feed=following и юзер вошел
        if feed_param == 'following' and user.is_authenticated:
            # Оставляем только те картинки, авторы которых есть в моих подписках
            queryset = queryset.filter(author__followers__follower=user)
        

        return queryset.order_by('-rating', '-created_at')


class GeneratedImageViewSet(viewsets.ModelViewSet):
    """
    API для картинок.
    """
    serializer_class = GeneratedImageSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    pagination_class = StandardPagination
    
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    

    search_fields = ['description', 'tags__name', 'author__username']
    # Фильтры: ?author=1, ?linked_model=5
    filterset_class = GeneratedImageFilter

    ordering_fields = ['likes_count', 'created_at', 'rating']

    def get_queryset(self):
        user = self.request.user
        
        # ЭТАП 1: Базовая видимость (Security)
        # Аноним видит только is_published=True
        # Авторизованный видит is_published=True ИЛИ свои посты (даже черновики)
        if user.is_authenticated:
            # Q-объект: (Опубликовано) ИЛИ (Автор - это я)
            visibility_filter = Q(is_published=True) | Q(author=user)
        else:
            visibility_filter = Q(is_published=True)
            
        # Применяем базовый фильтр ко всей таблице
        queryset = GeneratedImage.objects.filter(visibility_filter)

        queryset = queryset.annotate(
            rating=ExpressionWrapper(
                F('likes_count') * 1 + Count('comments', distinct=True) * 3,
                output_field=IntegerField()
            )
        )

        # ЭТАП 2: Фильтрация по запросу (User Preferences)
        feed_param = self.request.query_params.get('feed')
        
        # Если в URL есть ?feed=following и юзер вошел
        if feed_param == 'following' and user.is_authenticated:
            # Оставляем только те картинки, авторы которых есть в моих подписках
            queryset = queryset.filter(author__followers__follower=user)
        

        return queryset.select_related('author', 'author__profile').order_by('-rating','-created_at')

class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all().order_by('-created_at')
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    
    filter_backends = [DjangoFilterBackend]
    # Фильтр, чтобы получить комменты конкретной картинки: ?image=5
    filterset_fields = ['image', 'aimodel'] 


class LikeViewSet(viewsets.ModelViewSet):
    """
    Лайки. Разрешаем только создавать (ставить лайк) и смотреть.
    Удаление происходит автоматически при повторном лайке (см. Serializer).
    """
    queryset = Like.objects.all()
    serializer_class = LikeSerializer
    permission_classes = [IsAuthenticated] # Лайкать могут только авторизованные
    http_method_names = ['post'] # Запрещаем GET список всех лайков (бессмысленно)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    # --- МАГИЯ ТУТ ---
    # Теперь ссылки будут вида /api/users/admin/ вместо /api/users/1/
    lookup_field = 'username' 

    # Разрешаем GET (просмотр) и PATCH (редактирование)
    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        user = request.user

        # PATCH (Обновление)
        if request.method == 'PATCH':
            serializer = UserUpdateSerializer(user, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return self._get_me_data(user)
            return Response(serializer.errors, status=400)

        # GET (Просмотр)
        return self._get_me_data(user)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def analytics(self, request):
        user = request.user
        
        # 1. ТОП-5 Моделей по РЕЙТИНГУ (Формула: Лайки + 2*Скачивания + 3*Комменты)
        top_models = AiModel.objects.filter(author=user).annotate(
            rating=ExpressionWrapper(
                F('likes_count') * 1 + F('downloads_count') * 2 + Count('comments', distinct=True) * 3,
                output_field=IntegerField()
            )
        ).order_by('-rating')[:5].values('id', 'name', 'downloads_count', 'likes_count', 'rating')

        # 2. ТОП-5 Картинок по РЕЙТИНГУ (Формула: Лайки + 3*Комменты)
        top_images = GeneratedImage.objects.filter(author=user).annotate(
            rating=ExpressionWrapper(
                F('likes_count') * 1 + Count('comments', distinct=True) * 3,
                output_field=IntegerField()
            )
        ).order_by('-rating')[:5].values('id', 'image', 'likes_count', 'rating')

        # 3. ГРАФИК: Лайки за последние 30 дней (Без изменений)
        last_30_days = timezone.now() - timedelta(days=30)
        
        daily_likes = Like.objects.filter(
            Q(aimodel__author=user) | Q(image__author=user), 
            created_at__gte=last_30_days
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')

        return Response({
            "top_models": top_models,
            "top_images": top_images,
            "activity_graph": daily_likes
        })

    def _get_me_data(self, user):
        from django.db.models import Sum

        total_downloads = AiModel.objects.filter(author=user).aggregate(Sum('downloads_count'))['downloads_count__sum'] or 0
        model_likes = AiModel.objects.filter(author=user).aggregate(Sum('likes_count'))['likes_count__sum'] or 0
        image_likes = GeneratedImage.objects.filter(author=user).aggregate(Sum('likes_count'))['likes_count__sum'] or 0
        total_likes = model_likes + image_likes
        followers_count = user.followers.count()
        profile = getattr(user, 'profile', None)

        data = {
            "id": user.id,  # <--- ВОТ ТУТ МЫ ВОЗВРАЩАЕМ ID
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "bio": profile.bio if profile else "",
            "avatar": profile.avatar.url if profile and profile.avatar else None,
            "banner": profile.banner.url if profile and profile.banner else None,

            "stats": {
                "total_downloads": total_downloads,
                "total_likes": total_likes,
                "followers": followers_count,
                "models_count": user.models.count(),
                "images_count": user.images.count(),
            }
        }
        return Response(data)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,) # Разрешаем всем (даже гостям)
    serializer_class = RegisterSerializer

class UserFollowViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт для подписки.
    POST /api/follows/ { "following": ID_ЮЗЕРА }
    """
    queryset = UserFollow.objects.all()
    serializer_class = UserFollowSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['post']

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete', 'post'] 
    def get_queryset(self):
        # Юзер видит ТОЛЬКО свои уведомления
        return Notification.objects.filter(recipient=self.request.user)

    # Экшен: Пометить все как прочитанные
    # POST /api/notifications/mark_all_read/
    @action(detail=False, methods=['post'], url_path='mark_read')
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'All marked as read'})

class TagViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API для получения списка всех тегов.
    Сортирует теги по популярности (количеству использований).
    """
    serializer_class = TagSerializer
    permission_classes = [AllowAny] # Разрешаем смотреть всем (даже гостям)
    pagination_class = None # Выключаем пагинацию (или оставь StandardPagination, если тегов миллион)

    def get_queryset(self):
        # taggit_taggeditem_items — это скрытая связь в БД, которую создает библиотека
        return Tag.objects.annotate(
            count=Count('taggit_taggeditem_items')
        ).order_by('-count') # Сначала самые популярные


class ModelTypesView(APIView):
    """
    Возвращает список доступных типов моделей для выпадающего списка.
    """
    permission_classes = [AllowAny] # Разрешаем всем

    def get(self, request):
        # Превращаем кортежи [("LORA", "LoRA"), ...] в список словарей
        data = [
            {"value": item[0], "label": item[1]} 
            for item in AiModel.AI_MODEL_TYPES
        ]
        return Response(data)