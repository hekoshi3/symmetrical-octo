from django.contrib import admin

# Register your models here.
from .models import AiModel, GeneratedImage

admin.site.register(AiModel)
admin.site.register(GeneratedImage)