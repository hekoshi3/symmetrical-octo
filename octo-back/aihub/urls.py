from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Подключаем наше API по адресу /api/
    path('api/', include('api.urls')), 
]

# Это нужно, чтобы Django отдавал картинки и файлы в режиме разработки (DEBUG=True)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)