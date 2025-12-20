from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UserProfile, AiModel, GeneratedImage, Notification, Like, Comment, UserFollow
import re

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

@receiver(post_save, sender=Comment)
def notify_mentions(sender, instance, created, **kwargs):
    """
    Проверяет, упомянули ли кого-то через @username в тексте комментария.
    Если да -> создает уведомление.
    """
    if created:
        # 1. Ищем все упоминания вида @username
        # Регулярка ищет @, за которым идут буквы/цифры/подчеркивания
        mentioned_usernames = re.findall(r'@(\w+)', instance.text)
        
        if not mentioned_usernames:
            return

        # 2. Находим реальных юзеров в базе (убираем дубликаты через set)
        users_to_notify = User.objects.filter(
            username__in=list(set(mentioned_usernames))
        )

        # 3. Создаем уведомления
        notifications = []
        for user in users_to_notify:
            # Не уведомляем, если человек тегнул сам себя
            if user == instance.user:
                continue
            
            # Не уведомляем автора поста второй раз (он и так получит уведомление "Новый комментарий")
            # Хотя, если ты хочешь, чтобы он знал, что к нему обратились ЛИЧНО, можно это условие убрать.
            # Для MVP оставим уведомление в любом случае, так надежнее.

            notifications.append(Notification(
                recipient=user,
                actor=instance.user,
                type='MENTION', # Можно добавить новый тип 'MENTION', но фронту проще обработать 'COMMENT'
                image=instance.image,
                aimodel=instance.aimodel,
                comment=instance
            ))
        
        # Записываем пачкой
        Notification.objects.bulk_create(notifications)

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
    if instance.is_published and not instance.notification_sent:
        # Ищем всех подписчиков автора
        followers = instance.author.followers.all()
        
        # Создаем уведомления (в цикле, для MVP сойдет)
        # Для продакшена тут используют Celery, чтобы не зависало при 1млн подписчиков
        notifications = [
            Notification(
                recipient=follow_obj.follower,
                actor=instance.author,
                type='NEW_POST',
                image=instance
            ) for follow_obj in followers
        ]
        
        Notification.objects.bulk_create(notifications)

        # Ставим флаг, что отправили. 
        # Используем .update(), чтобы НЕ вызывать сигнал post_save повторно (избегаем рекурсии)
        GeneratedImage.objects.filter(pk=instance.pk).update(notification_sent=True)

@receiver(post_save, sender=AiModel)
def notify_followers_new_model(sender, instance, created, **kwargs):
    """
    Автор выложил новую Модель -> Уведомляем подписчиков.
    """
    if instance.is_published and not instance.notification_sent:
        followers = instance.author.followers.all()
        
        notifications = [
            Notification(
                recipient=follow_obj.follower,
                actor=instance.author,
                type='NEW_POST',
                aimodel=instance
            ) for follow_obj in followers
        ]
        
        Notification.objects.bulk_create(notifications)
        
        AiModel.objects.filter(pk=instance.pk).update(notification_sent=True)