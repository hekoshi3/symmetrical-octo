from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator

# --- ПРОФИЛЬ ---
class UserProfile(models.Model):
    # Используем OneToOne, как ты и хотел
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(upload_to="users/avatars/", blank=True, null=True)

    def __str__(self):
        return self.user.username

# --- МОДЕЛЬ (LoRA, Checkpoint) ---
class AiModel(models.Model):
    AI_MODEL_TYPES = [
        ("LORA", "LoRA"),
        ("CHECKPOINT", "Checkpoint"),
        ("EMBEDDING", "Embedding"),
        ("UPSCALER", "Upscaler"),
        ("CONTROLNET", "ControlNet"),
    ]

    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="models")
    name = models.CharField(max_length=100)
    model_type = models.CharField(max_length=50, choices=AI_MODEL_TYPES)
    description = models.TextField(blank=True)
    
    # Файл модели + валидация (ТЗ 5.2)
    file = models.FileField(
        upload_to="models/", 
        max_length=500,
        validators=[FileExtensionValidator(allowed_extensions=['safetensors', 'ckpt', 'pt'])]
    )
    file_hash = models.CharField(max_length=64, blank=True, null=True) 
    # Статистика
    downloads_count = models.IntegerField(default=0)
    # Лайки храним в лайках, но дублируем счетчиком для быстрой сортировки
    likes_count = models.IntegerField(default=0)

    featured_image = models.ForeignKey(
        'GeneratedImage', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='featured_in_models',
        help_text="Главная картинка (обложка) этой модели"
    )
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

# --- ГЕНЕРАЦИЯ (КАРТИНКА) ---
class GeneratedImage(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="images/", max_length=500)
    
    # Ссылка на модель (если это пример работы конкретной модели)
    linked_model = models.ForeignKey(
        AiModel, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='images'
    )
    
    # Ресурсы (LoRA и прочее, что использовалось) - М2М, как ты и хотел
    resources = models.ManyToManyField(
        AiModel, 
        related_name='used_in_images', 
        blank=True
    )
    
    # Параметры генерации храним в JSON (Prompt, Seed, Sampler...)
    generation_params = models.JSONField(default=dict, blank=True)
    is_published = models.BooleanField(default=False)
    likes_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image {self.id} by {self.author.username}"

# --- КОММЕНТАРИИ (Одна таблица) ---
class Comment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Ссылки (заполняется только одна)
    image = models.ForeignKey(GeneratedImage, on_delete=models.CASCADE, null=True, blank=True, related_name='comments')
    aimodel = models.ForeignKey(AiModel, on_delete=models.CASCADE, null=True, blank=True, related_name='comments')

    def clean(self):
        # Проверка, что коммент не висит в воздухе и не привязан к двум сразу
        if not self.image and not self.aimodel:
            raise ValidationError("Комментарий должен быть привязан к объекту.")
        if self.image and self.aimodel:
            raise ValidationError("Нельзя комментировать два объекта сразу.")

    def save(self, *args, **kwargs):
        self.full_clean() # Вызываем валидацию перед сохранением
        super().save(*args, **kwargs)

# --- ЛАЙКИ (Одна таблица) ---
class Like(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    image = models.ForeignKey(GeneratedImage, on_delete=models.CASCADE, null=True, blank=True, related_name='likes')
    aimodel = models.ForeignKey(AiModel, on_delete=models.CASCADE, null=True, blank=True, related_name='likes')

    class Meta:
        # Уникальность: Юзер не может лайкнуть одну и ту же картинку дважды
        unique_together = [
            ['user', 'image'],
            ['user', 'aimodel']
        ]
    
    def clean(self):
        if not self.image and not self.aimodel:
            raise ValidationError("Лайк должен быть привязан к объекту.")
        if self.image and self.aimodel:
            raise ValidationError("Нельзя лайкнуть два объекта сразу.")
            
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)