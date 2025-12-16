import hashlib
from PIL import Image
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AiModel, GeneratedImage, UserProfile, Comment, Like

# --- Вспомогательный сериализатор для Автора ---
# Чтобы фронт получал не просто "author: 1", а "author: { username: 'max', avatar: '...' }"
class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username')
    
    class Meta:
        model = UserProfile
        fields = ['username', 'bio', 'avatar']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'profile']


# --- Сериализатор Моделей ---
class AiModelSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField() # Лайкнул ли текущий юзер?

    class Meta:
        model = AiModel
        fields = '__all__'
        read_only_fields = ['author', 'created_at', 'downloads_count', 'likes_count', 'file_hash']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def create(self, validated_data):
        # 1. Достаем юзера из запроса
        request = self.context.get('request')
        validated_data['author'] = request.user

        # 2. Считаем хеш файла (SHA256) "на лету"
        # Для MVP считаем хеш первых 64кб, чтобы не зависало на больших файлах
        uploaded_file = validated_data.get('file')
        if uploaded_file:
            sha256 = hashlib.sha256()
            for chunk in uploaded_file.chunks(chunk_size=65536): # Читаем кусочками
                sha256.update(chunk)
                break # УБЕРИ break, если хочешь полный хеш (но будет долго грузить)
            validated_data['file_hash'] = sha256.hexdigest()

        return super().create(validated_data)


# --- Сериализатор Изображений ---
class GeneratedImageSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedImage
        fields = '__all__'
        read_only_fields = ['author', 'created_at', 'likes_count', 'generation_params']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def create(self, validated_data):
        # 1. Привязываем автора
        request = self.context.get('request')
        validated_data['author'] = request.user

        # 2. МАГИЯ: Читаем метаданные из картинки
        image_file = validated_data.get('image')
        if image_file:
            try:
                # Открываем картинку через Pillow
                img = Image.open(image_file)
                img.load() 
                
                # Ищем параметры (обычно A1111 пишет в 'parameters')
                info = img.info
                params = info.get('parameters', '')
                
                if params:
                    # Простой парсинг: сохраняем весь текст, 
                    # в будущем можно разбить на prompt/negative/seed регулярками
                    validated_data['generation_params'] = {
                        "raw": params,
                        "width": img.width,
                        "height": img.height
                    }
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