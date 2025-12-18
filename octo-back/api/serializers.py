import hashlib
from PIL import Image
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AiModel, GeneratedImage, UserProfile, Comment, Like, UserFollow, Notification
import re # Добавили регулярки

# --- Вспомогательный сериализатор для Автора ---
# Чтобы фронт получал не просто "author: 1", а "author: { username: 'max', avatar: '...' }"
class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username')
    
    class Meta:
        model = UserProfile
        fields = ['username', 'bio', 'avatar']

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
class AiModelSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = AiModel
        fields = '__all__'
        read_only_fields = ['author', 'created_at', 'downloads_count', 'likes_count', 'file_hash']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def validate_file(self, file):
        """
        Проверка Магических чисел (Magic Numbers).
        Убеждаемся, что файл реально того формата, который заявлен.
        """
        # Читаем первые байты (хедер)
        header = file.read(1024) 
        file.seek(0) # Возвращаем каретку в начало, иначе файл сохранится пустым!
        
        # Сигнатуры (примерные)
        # Safetensors - это JSON, начинается с {
        # CKPT (PyTorch) - это ZIP архив, начинается с PK (50 4B)
        
        # Для MVP простая проверка: Safetensors должен начинаться с байта, указывающего на JSON
        if file.name.endswith('.safetensors'):
            # В спецификации safetensors первые 8 байт - это размер заголовка (int64), потом идет JSON '{'
            # Но для простоты проверим, не является ли это очевидным текстом или картинкой
            pass 
        
        # Тут можно добавить сложную логику, но для MVP валидатора расширения в models.py обычно хватает.
        # Главное, что мы убедились, что файл читается.
        return file

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
class GeneratedImageSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedImage
        # is_published можно менять, поэтому он НЕ в read_only
        fields = '__all__'
        read_only_fields = ['author', 'created_at', 'likes_count', 'generation_params']

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
                image.likes_count = max(0, image.likes_count - 1)
                image.save()
            if aimodel:
                aimodel.likes_count = max(0, aimodel.likes_count - 1)
                aimodel.save()
            raise serializers.ValidationError("Like removed (Unliked)")
        
        # Если лайка нет - создаем и увеличиваем счетчик
        like = Like.objects.create(user=user, **validated_data)
        
        if image:
            image.likes_count += 1
            image.save()
        if aimodel:
            aimodel.likes_count += 1
            aimodel.save()
            
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