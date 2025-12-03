from rest_framework import serializers
from api.models import Post, CustomUser, AiModel, GeneratedImage
from django.contrib.auth.models import User



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        username = serializers.ReadOnlyField(source="user.username")
        fields = ['id', 'username']

class GeneratedImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeneratedImage
        fields = '__all__'

class PostSerializer(serializers.ModelSerializer):
    class Meta:
        author = UserSerializer(read_only=True)
        images = GeneratedImageSerializer(many=True, read_only=True)
        model = Post
        fields = ['id', 'title', 'description', 'created_at', 'author', 'images']
        depth = 1

class AiModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiModel
        fields = '__all__'
