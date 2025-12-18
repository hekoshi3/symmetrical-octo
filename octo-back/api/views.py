from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import redirect
from rest_framework import generics
from rest_framework.permissions import AllowAny
from .serializers import RegisterSerializer, UserFollowSerializer 

from django.contrib.auth.models import User
from .models import AiModel, GeneratedImage, Comment, Like, UserFollow, Notification
from .serializers import AiModelSerializer, GeneratedImageSerializer, CommentSerializer, LikeSerializer, UserSerializer, NotificationSerializer
from .permissions import IsAuthorOrReadOnly
from django.db.models import Q, Sum

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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    # 1. По каким полям фильтровать точно (?model_type=LORA)
    filterset_fields = ['model_type', 'author'] 
    # 2. По каким искать текст (?search=anime)
    search_fields = ['name', 'description']
    # 3. Как сортировать (?ordering=-likes_count)
    ordering_fields = ['likes_count', 'downloads_count', 'created_at']

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

        # ЭТАП 2: Фильтрация по запросу (User Preferences)
        feed_param = self.request.query_params.get('feed')
        
        # Если в URL есть ?feed=following и юзер вошел
        if feed_param == 'following' and user.is_authenticated:
            # Оставляем только те картинки, авторы которых есть в моих подписках
            queryset = queryset.filter(author__followers__follower=user)

        return queryset.order_by('-created_at')


class GeneratedImageViewSet(viewsets.ModelViewSet):
    """
    API для картинок.
    """
    serializer_class = GeneratedImageSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    pagination_class = StandardPagination
    
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    
    # Фильтры: ?author=1, ?linked_model=5
    filterset_fields = ['author', 'linked_model']
    ordering_fields = ['likes_count', 'created_at']

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

        # ЭТАП 2: Фильтрация по запросу (User Preferences)
        feed_param = self.request.query_params.get('feed')
        
        # Если в URL есть ?feed=following и юзер вошел
        if feed_param == 'following' and user.is_authenticated:
            # Оставляем только те картинки, авторы которых есть в моих подписках
            queryset = queryset.filter(author__followers__follower=user)

        return queryset.order_by('-created_at')

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

    # GET /api/users/me/stats/
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """
        Возвращает профиль текущего юзера + расширенную статистику.
        """
        user = request.user
        
        # Считаем сумму скачиваний всех моделей юзера
        total_downloads = AiModel.objects.filter(author=user).aggregate(Sum('downloads_count'))['downloads_count__sum'] or 0
        
        # Считаем сумму лайков на моделях
        model_likes = AiModel.objects.filter(author=user).aggregate(Sum('likes_count'))['likes_count__sum'] or 0
        
        # Считаем сумму лайков на картинках
        image_likes = GeneratedImage.objects.filter(author=user).aggregate(Sum('likes_count'))['likes_count__sum'] or 0
        
        total_likes = model_likes + image_likes
        
        # Количество подписчиков
        followers_count = user.followers.count()

        # Собираем ответ
        data = {
            "username": user.username,
            "avatar": user.profile.avatar.url if user.profile.avatar else None,
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