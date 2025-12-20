from django.contrib import admin
from .models import UserProfile, AiModel, GeneratedImage, Comment, Like

# Регистрируем модели, чтобы они появились в /admin/
admin.site.register(UserProfile)
admin.site.register(AiModel)
admin.site.register(GeneratedImage)
admin.site.register(Comment)
admin.site.register(Like)