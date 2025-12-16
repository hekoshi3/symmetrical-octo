from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AiModelViewSet, GeneratedImageViewSet, CommentViewSet, LikeViewSet, UserViewSet

# Router сам создаст все URL типа /models/, /models/5/, /images/ и т.д.
router = DefaultRouter()
router.register(r'models', AiModelViewSet)
router.register(r'images', GeneratedImageViewSet)
router.register(r'comments', CommentViewSet)
router.register(r'likes', LikeViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    path('', include(router.urls)),
]