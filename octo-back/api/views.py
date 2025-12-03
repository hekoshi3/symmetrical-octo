from django.shortcuts import render
from api.serializers import AiModelSerializer, PostSerializer
from api.models import Post, CustomUser, AiModel, GeneratedImage
from rest_framework import generics

class ModelListView(generics.ListCreateAPIView):
    queryset = AiModel.objects.all()
    serializer_class = AiModelSerializer

class PostListView(generics.ListCreateAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer