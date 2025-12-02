from django.contrib import admin

# Register your models here.
from .models import AiModel, GeneratedImage, CustomUser, Post

admin.site.register(AiModel)
admin.site.register(GeneratedImage)
admin.site.register(CustomUser)
admin.site.register(Post)