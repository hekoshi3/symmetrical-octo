from django.db import models

# Create your models here.
class AiModel(models.Model):
    name = models.CharField(max_length=200)
    filename = models.CharField(max_length=200)
    image = models.ImageField(upload_to='images/')
    description = models.CharField(max_length=200)

    def __str__(self):
        return self.name

class GeneratedImage(models.Model):
    aimodel = models.ForeignKey(AiModel, on_delete=models.CASCADE)
    image = models.ImageField(upload_to='images/')
    prompt = models.CharField(max_length=200)
    created_at = models.DateTimeField("date created")

    def __str__(self):
        return self.prompt