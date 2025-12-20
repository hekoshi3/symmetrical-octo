from rest_framework import permissions

class IsAuthorOrReadOnly(permissions.BasePermission):
    """
    Разрешает редактирование/удаление только автору объекта.
    Остальным - только чтение (GET).
    """
    def has_object_permission(self, request, view, obj):
        # Разрешаем безопасные методы (GET, HEAD, OPTIONS) всем
        if request.method in permissions.SAFE_METHODS:
            return True

        # Запись (PUT, DELETE) разрешаем только если автор совпадает с текущим юзером
        # У наших моделей (AiModel, GeneratedImage) есть поле author
        # У лайков/комментов - поле user. Проверяем оба варианта.
        if hasattr(obj, 'author'):
            return obj.author == request.user
        if hasattr(obj, 'user'):
            return obj.user == request.user
            
        return False