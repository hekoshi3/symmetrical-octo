from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UserProfile, AiModel, GeneratedImage

@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_delete, sender=AiModel)
def auto_delete_file_on_model_delete(sender, instance, **kwargs):
    """
    Удаляет файл модели с диска, когда удаляется запись из БД.
    """
    if instance.file:
        instance.file.delete(save=False) # save=False чтобы не вызывать сохранение модели

@receiver(post_delete, sender=GeneratedImage)
def auto_delete_file_on_image_delete(sender, instance, **kwargs):
    """
    Удаляет файл картинки с диска.
    """
    if instance.image:
        instance.image.delete(save=False)