from django.db import models
from django.contrib.auth.models import User

# Create your models here.

class CustomUser(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(upload_to="users/avatars/", blank=True, default="static/default_avatar.jpeg", max_length=500) #TODO: Обработка NULL

    def __str__(self):
        return self.user.username

class Post(models.Model):
    author = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class AiModel(models.Model):
    name = models.CharField(max_length=50)
    AI_MODEL_TYPES = {
        "LORA" : "LoRA",
        "CHECKPOINT": "Checkpoint",
    }
    model_type = models.CharField(max_length=50, choices=AI_MODEL_TYPES)
    file = models.FileField(upload_to="models/", max_length=500)
    preview_image = models.ForeignKey('GeneratedImage', blank=True, related_name='model_featured', null=True, on_delete=models.SET_NULL)
    description = models.TextField()

    def __str__(self):
        return self.name

class GeneratedImage(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to="images/", max_length=500)
    model = models.ForeignKey(AiModel, on_delete=models.SET_NULL, null=True, blank=True)
    prompt = models.TextField()
    negative_prompt = models.TextField(blank=True)
    seed = models.BigIntegerField()
    steps = models.IntegerField()
    cfg_scale = models.FloatField()
    sampler = models.CharField(max_length=50)

    def __str__(self):
        return self.prompt

