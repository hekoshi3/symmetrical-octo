from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UserProfile, AiModel, GeneratedImage, Notification, Like, Comment, UserFollow

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

@receiver(post_save, sender=Like)
def notify_on_like(sender, instance, created, **kwargs):
    """Кто-то поставил лайк"""
    if created:
        # Определяем владельца контента
        content_object = instance.image if instance.image else instance.aimodel
        recipient = content_object.author
        
        # Не уведомляем, если лайкнул сам себя
        if instance.user != recipient:
            Notification.objects.create(
                recipient=recipient,
                actor=instance.user,
                type='LIKE',
                image=instance.image,
                aimodel=instance.aimodel
            )

@receiver(post_save, sender=Comment)
def notify_on_comment(sender, instance, created, **kwargs):
    """Кто-то оставил коммент"""
    if created:
        content_object = instance.image if instance.image else instance.aimodel
        recipient = content_object.author
        
        if instance.user != recipient:
            Notification.objects.create(
                recipient=recipient,
                actor=instance.user,
                type='COMMENT',
                image=instance.image,
                aimodel=instance.aimodel,
                comment=instance
            )

@receiver(post_save, sender=UserFollow)
def notify_on_follow(sender, instance, created, **kwargs):
    """Кто-то подписался"""
    if created:
        Notification.objects.create(
            recipient=instance.following,
            actor=instance.follower,
            type='FOLLOW'
        )

@receiver(post_save, sender=GeneratedImage)
def notify_followers_new_image(sender, instance, created, **kwargs):
    """
    Автор выложил новый Арт -> Уведомляем подписчиков.
    Срабатывает только если is_published=True
    """
    if instance.is_published:
        # Ищем всех подписчиков автора
        followers = instance.author.followers.all()
        
        # Создаем уведомления (в цикле, для MVP сойдет)
        # Для продакшена тут используют Celery, чтобы не зависало при 1млн подписчиков
        for follow_obj in followers:
            Notification.objects.create(
                recipient=follow_obj.follower,
                actor=instance.author,
                type='NEW_POST',
                image=instance
            )

@receiver(post_save, sender=AiModel)
def notify_followers_new_model(sender, instance, created, **kwargs):
    """Автор выложил новую Модель -> Уведомляем подписчиков"""
    if instance.is_published:
        followers = instance.author.followers.all()
        for follow_obj in followers:
            Notification.objects.create(
                recipient=follow_obj.follower,
                actor=instance.author,
                type='NEW_POST',
                aimodel=instance
            )