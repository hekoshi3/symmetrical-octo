from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AiModelViewSet, GeneratedImageViewSet, CommentViewSet, LikeViewSet, UserViewSet, RegisterView, UserFollowViewSet, NotificationViewSet, TagViewSet, ModelTypesView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
# Router сам создаст все URL типа /models/, /models/5/, /images/ и т.д.
router = DefaultRouter()
router.register(r'models', AiModelViewSet, basename='aimodel')
router.register(r'images', GeneratedImageViewSet, basename='generatedimage')
router.register(r'comments', CommentViewSet)
router.register(r'likes', LikeViewSet)
router.register(r'users', UserViewSet)
router.register(r'follows', UserFollowViewSet)
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'tags', TagViewSet, basename='tags')



urlpatterns = [
    path('', include(router.urls)),

    # --- JWT AUTH ---
    # Получить токены (Логин)
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    # Обновить токен (когда Access протух)
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('config/model-types/', ModelTypesView.as_view(), name='model-types'),  

]