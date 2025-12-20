import hashlib
from django.db.models import F # <--- Не забудь импортировать
from PIL import Image
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AiModel, GeneratedImage, UserProfile, Comment, Like, UserFollow, Notification
import re # Добавили регулярки
from taggit.serializers import TagListSerializerField, TaggitSerializer
from taggit.models import Tag

# --- Вспомогательный сериализатор для Автора ---
# Чтобы фронт получал не просто "author: 1", а "author: { username: 'max', avatar: '...' }"
class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username')
    
    class Meta:
        model = UserProfile
        fields = ['username', 'bio', 'avatar', 'banner']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    followers_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'profile', 'followers_count', 'is_following'] # Добавил поля в fields

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return UserFollow.objects.filter(follower=request.user, following=obj).exists()
        return False


# --- Сериализатор Моделей ---
class AiModelSerializer(TaggitSerializer, serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    tags = TagListSerializerField(required=False, child=serializers.CharField(allow_blank=True)) 
    is_liked = serializers.SerializerMethodField()
    featured_image_url = serializers.SerializerMethodField()
    class Meta:
        model = AiModel
        fields = '__all__'
        read_only_fields = ['author', 'created_at', 'downloads_count', 'likes_count', 'file_hash']



    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False
    
    def get_featured_image_url(self, obj):
        if obj.featured_image:
            # Получаем полный URL (с http://localhost...)
            request = self.context.get('request')
            photo_url = obj.featured_image.image.url
            return request.build_absolute_uri(photo_url) if request else photo_url
        return None

    def validate_file(self, file):
        """
        Проверка Магических чисел (Magic Numbers).
        Убеждаемся, что файл реально того формата, который заявлен.
        """
        # Читаем первые байты (хедер)
        header = file.read(1024) 
        file.seek(0) # Возвращаем каретку в начало, иначе файл сохранится пустым!
        file_name = file.name.lower() 
        # Сигнатуры (примерные)
        # Safetensors - это JSON, начинается с {
        # CKPT (PyTorch) - это ZIP архив, начинается с PK (50 4B)
        
        if file_name.endswith(('.ckpt', '.pt')):
            if not header.startswith(b'PK'):
                raise serializers.ValidationError("Файл поврежден или не является корректным .ckpt/.pt (ожидался ZIP-заголовок).")

        # 2. Проверка для Safetensors
        # Спецификация: первые 8 байт - это размер заголовка (uint64 little-endian).
        # Это сложно валидировать идеально без парсера, но можно проверить, 
        # что это НЕ текстовый файл и НЕ картинка.
        if file_name.endswith('.safetensors'):
            # Просто пример проверки: убедимся, что это не PNG/JPG
            if header.startswith(b'\x89PNG') or header.startswith(b'\xff\xd8\xff'):
                 raise serializers.ValidationError("Вы пытаетесь загрузить картинку под видом модели.")
        
        # Тут можно добавить сложную логику, но для MVP валидатора расширения в models.py обычно хватает.
        # Главное, что мы убедились, что файл читается.
        return file
    
    def validate_tags(self, value):
        # value - это список, который пришел, например [''] или ['cat', '', 'girl']
        # Мы оставляем только те теги, которые НЕ пустые
        clean_tags = [tag for tag in value if tag.strip()]
        return clean_tags

    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['author'] = request.user

        uploaded_file = validated_data.get('file')
        
        if uploaded_file:
            # 1. Считаем хеш (Partial Hash - первые 64кб)
            sha256 = hashlib.sha256()
            for chunk in uploaded_file.chunks(chunk_size=65536):
                sha256.update(chunk)
                break # Убираем break, если нужен полный хеш (для продакшена)
            
            file_hash = sha256.hexdigest()
            
            # 2. ПРОВЕРКА НА ДУБЛИКАТЫ
            # Если такая модель уже есть, и она не принадлежит этому пользователю (или даже если принадлежит)
            if AiModel.objects.filter(file_hash=file_hash).exists():
                raise serializers.ValidationError({
                    "file": f"Такой файл уже был загружен ранее (Hash collision: {file_hash[:8]})."
                })

            validated_data['file_hash'] = file_hash

        return super().create(validated_data)

def parse_generation_data(raw_text):
    """
    Разбивает сырой текст из A1111 на структуру.
    """
    data = {"raw": raw_text}
    
    if not raw_text:
        return data

    # 1. Отделяем параметры (Steps, Sampler...) от промптов
    # Обычно параметры начинаются с "Steps: "
    parts = raw_text.split("Steps: ", 1)
    
    prompts_part = parts[0]
    params_part = "Steps: " + parts[1] if len(parts) > 1 else ""

    # 2. Разделяем Prompt и Negative Prompt
    if "Negative prompt:" in prompts_part:
        p_split = prompts_part.split("Negative prompt:", 1)
        data['prompt'] = p_split[0].strip()
        data['negative_prompt'] = p_split[1].strip()
    else:
        data['prompt'] = prompts_part.strip()
        data['negative_prompt'] = ""

    # 3. Парсим параметры через запятую (Steps: 30, Sampler: DPM++ 2M Karras, ...)
    if params_part:
        # Регулярка ищет паттерн "Ключ: Значение,"
        # Не идеально, но для 99% случаев A1111 работает
        items = re.findall(r'([^:,]+):\s*([^,]+)(?:,|$)', params_part)
        for key, value in items:
            key = key.strip().lower().replace(" ", "_") # steps, cfg_scale, model_hash
            data[key] = value.strip()

    return data
# --- Сериализатор Изображений ---
class GeneratedImageSerializer(TaggitSerializer, serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    tags = TagListSerializerField(required=False, child=serializers.CharField(allow_blank=True)) 
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedImage
        # is_published можно менять, поэтому он НЕ в read_only
        fields = '__all__'
        read_only_fields = ['author', 'created_at', 'likes_count']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['author'] = request.user

        # Читаем метаданные
        image_file = validated_data.get('image')
        if image_file:
            try:
                img = Image.open(image_file)
                img.load()
                
                # Пытаемся достать параметры
                raw_params = img.info.get('parameters', '')
                
                if raw_params:
                    # ИСПОЛЬЗУЕМ НАШ ПАРСЕР
                    parsed_data = parse_generation_data(raw_params)
                    
                    # Добавляем технические данные
                    parsed_data['width'] = img.width
                    parsed_data['height'] = img.height
                    
                    validated_data['generation_params'] = parsed_data
                else:
                    validated_data['generation_params'] = {"info": "No metadata found"}
                    
            except Exception as e:
                print(f"Error parsing image: {e}")
                validated_data['generation_params'] = {"error": str(e)}

        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Смотрим, прислали ли новые параметры генерации
        new_params = validated_data.get('generation_params')
        
        if new_params:
            # Берем старые параметры (или пустой dict, если их не было)
            current_params = instance.generation_params or {}
            
            # Обновляем старые параметры новыми (Python dict update)
            # Это сохранит старые ключи и перезапишет/добавит новые
            current_params.update(new_params)
            
            # Записываем объединенный результат обратно в данные для сохранения
            validated_data['generation_params'] = current_params

        # Вызываем стандартное обновление для остальных полей (description и т.д.)
        return super().update(instance, validated_data)
    
    def validate_tags(self, value):
        # value - это список, который пришел, например [''] или ['cat', '', 'girl']
        # Мы оставляем только те теги, которые НЕ пустые
        clean_tags = [tag for tag in value if tag.strip()]
        return clean_tags

# --- Комментарии ---
class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(source='user', read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'author', 'text', 'created_at', 'image', 'aimodel']
        read_only_fields = ['user']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


# --- Лайки (только для создания) ---
class LikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Like
        fields = ['image', 'aimodel']
    
    def create(self, validated_data):
        user = self.context['request'].user
        image = validated_data.get('image')
        aimodel = validated_data.get('aimodel')

        # Проверка на дубликаты (если уже лайкнул - удаляем лайк, типа toggle)
        existing_like = Like.objects.filter(user=user, image=image, aimodel=aimodel).first()
        
        if existing_like:
            # Если лайк есть - удаляем его (дизлайк) и уменьшаем счетчик
            existing_like.delete()
            if image:
                image.likes_count = F('likes_count') - 1
                image.save(update_fields=['likes_count'])
            if aimodel:
                aimodel.likes_count = F('likes_count') - 1
                aimodel.save(update_fields=['likes_count'])
            raise serializers.ValidationError("Like removed (Unliked)")
        
        # Если лайка нет - создаем и увеличиваем счетчик
        like = Like.objects.create(user=user, **validated_data)
        
        if image:
            image.likes_count = F('likes_count') + 1
            image.save(update_fields=['likes_count'])
        if aimodel:
            aimodel.likes_count = F('likes_count') + 1
            aimodel.save(update_fields=['likes_count'])
            
        return like

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email')

    def create(self, validated_data):
        # create_user автоматически хеширует пароль
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', '')
        )
        return user


class UserFollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserFollow
        fields = ['following']
    
    def create(self, validated_data):
        follower = self.context['request'].user
        following = validated_data['following']

        if follower == following:
            raise serializers.ValidationError("Нельзя подписаться на самого себя!")

        # Логика Toggle (Подписка / Отписка)
        follow_instance = UserFollow.objects.filter(follower=follower, following=following).first()
        
        if follow_instance:
            follow_instance.delete()
            raise serializers.ValidationError("Unfollowed") # Это не ошибка, это сигнал фронту
        
        return UserFollow.objects.create(follower=follower, following=following)

class NotificationSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True) # Разворачиваем инфу о том, кто сделал действие
    
    class Meta:
        model = Notification
        fields = '__all__'

class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Сериализатор для обновления профиля через PATCH /api/users/me/
    """
    # Поля из модели Profile (они вложенные, поэтому указываем source)
    bio = serializers.CharField(source='profile.bio', required=False, allow_blank=True)
    avatar = serializers.ImageField(source='profile.avatar', required=False, allow_null=True)
    banner = serializers.ImageField(source='profile.banner', required=False, allow_null=True)
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'bio', 'avatar', 'banner']
    
    def update(self, instance, validated_data):
        # Достаём данные профиля отдельно (они вложенные)
        profile_data = validated_data.pop('profile', {})
        
        # Обновляем поля User
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.email = validated_data.get('email', instance.email)
        instance.save()
        
        # Обновляем поля Profile
        profile = instance.profile
        if 'bio' in profile_data:
            profile.bio = profile_data['bio']
        if 'avatar' in profile_data:
            profile.avatar = profile_data['avatar']
        if 'banner' in profile_data:
            profile.banner = profile_data['banner']
        profile.save()
        
        return instance


class TagSerializer(serializers.ModelSerializer):
    # Добавляем поле count (количество использований), оно вычисляется в ViewSet
    count = serializers.IntegerField(read_only=True) 

    class Meta:
        model = Tag
        fields = ['name', 'slug', 'count']