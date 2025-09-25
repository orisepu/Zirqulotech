from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0016_alter_modelo_options_alter_modelo_unique_together_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='likewizeitemstaging',
            name='marca',
            field=models.CharField(default='Apple', max_length=100),
        ),
    ]
