from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend

from django.contrib.auth.models import User
from .models import AiModel, GeneratedImage, Comment, Like
from .serializers import (
    AiModelSerializer, 
    GeneratedImageSerializer, 
    CommentSerializer, 
    LikeSerializer,
    UserSerializer
)
from .permissions import IsAuthorOrReadOnly

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
    queryset = AiModel.objects.all().order_by('-created_at')
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

    # Счетчик скачиваний (POST /api/models/5/download/)
    @action(detail=True, methods=['post'])
    def download(self, request, pk=None):
        instance = self.get_object()
        instance.downloads_count += 1
        instance.save()
        return Response({'status': 'download counted', 'count': instance.downloads_count})


class GeneratedImageViewSet(viewsets.ModelViewSet):
    """
    API для картинок.
    """
    queryset = GeneratedImage.objects.all().order_by('-created_at')
    serializer_class = GeneratedImageSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    pagination_class = StandardPagination
    
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    
    # Фильтры: ?author=1, ?linked_model=5
    filterset_fields = ['author', 'linked_model']
    ordering_fields = ['likes_count', 'created_at']

    # Персональная лента (ТЗ 5.3 - задел на будущее)
    # Пока просто выводит всё, но можно допилить под подписки
    @action(detail=False, methods=['get'])
    def feed(self, request):
        if not request.user.is_authenticated:
             return Response({"error": "Auth required"}, status=401)
        # Логика: images = GeneratedImage.objects.filter(author__in=request.user.following.all())
        # Для MVP вернем просто новые картинки
        recent_images = self.queryset[:20]
        serializer = self.get_serializer(recent_images, many=True)
        return Response(serializer.data)


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
    """
    Только просмотр пользователей (профили авторов).
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer