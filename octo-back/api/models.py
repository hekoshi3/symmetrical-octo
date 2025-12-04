from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

# Create your models here.

class CustomUser(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(upload_to="users/avatars/", blank=True, null=True, max_length=500) #TODO: Обработка NULL

    def __str__(self):
        return self.user.username

class Post(models.Model):
    author = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    image = models.ForeignKey('GeneratedImage', null=True, on_delete=models.CASCADE)
    aimodel = models.ForeignKey('AiModel', null=True, on_delete=models.CASCADE)

    def __str__(self):
        return self.title
    
    def clean(self):
        if not self.image and not self.aimodel:
            raise ValidationError("Пост должен ссылаться на изображение или модель.")
        if self.image and self.aimodel:
            raise ValidationError("Пост должен ссылаться только на один объект.")

class AiModel(models.Model):
    name = models.CharField(max_length=50)
    AI_MODEL_TYPES = [
        ("LORA", "LoRA"),
        ("CHECKPOINT", "Checkpoint"),
        ("EMBEDDING", "Embedding"),
        ("UPSCALER", "Upscaler"),
        ("CONTROLNET", "ControlNet"),
    ]
    model_type = models.CharField(max_length=50, choices=AI_MODEL_TYPES)
    file = models.FileField(upload_to="models/", max_length=500)
    preview_image = models.ForeignKey('Post', blank=True, related_name='model_featured', null=True, on_delete=models.SET_NULL)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name



class GeneratedImage(models.Model):
    image = models.ImageField(upload_to="images/", max_length=500)
    checkpoint = models.ForeignKey(AiModel, on_delete=models.SET_NULL, limit_choices_to={'model_type': 'CHECKPOINT'}, related_name='model', null=True, blank=True)
    resources = models.ManyToManyField(AiModel, related_name='additional_models', limit_choices_to={'model_type__in': ['LORA', 'EMBEDDING', 'UPSCALER', 'CONTROLNET']}, blank=True)
    generation_params = models.JSONField(default=dict)
    #prompt = models.TextField(blank=True)
    #negative_prompt = models.TextField(blank=True)
    #seed = models.BigIntegerField(null=True)
    #steps = models.IntegerField(null=True)
    #cfg_scale = models.FloatField(null=True)
    #sampler = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f"Image #{self.id}"

