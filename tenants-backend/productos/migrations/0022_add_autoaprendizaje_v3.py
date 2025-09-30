# Generated for auto-learning V3 system

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('productos', '0021_mappingsessionreport_appledeviceknowledgebase_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='LikewizeKnowledgeBase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('likewize_model_name', models.CharField(db_index=True, max_length=500)),
                ('likewize_m_model', models.CharField(db_index=True, max_length=255)),
                ('likewize_capacity', models.CharField(max_length=50)),
                ('likewize_phone_model_id', models.IntegerField(blank=True, null=True)),
                ('likewize_full_name', models.CharField(blank=True, max_length=500)),
                ('confidence_score', models.FloatField(default=0.5)),
                ('times_used', models.IntegerField(default=1)),
                ('success_rate', models.FloatField(default=1.0)),
                ('last_used', models.DateTimeField(auto_now=True)),
                ('user_validated', models.BooleanField(default=False)),
                ('auto_learned', models.BooleanField(default=True)),
                ('created_by_correction', models.BooleanField(default=False)),
                ('features', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('local_capacidad', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='productos.capacidad')),
                ('local_modelo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='productos.modelo')),
            ],
            options={
                'db_table': 'productos_likewize_knowledge_base',
            },
        ),
        migrations.CreateModel(
            name='FeaturePattern',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pattern_name', models.CharField(max_length=100, unique=True)),
                ('pattern_type', models.CharField(choices=[('regex', 'Regular Expression'), ('keyword', 'Keyword Match'), ('similarity', 'Similarity Score'), ('ml', 'Machine Learning')], max_length=50)),
                ('pattern_value', models.TextField()),
                ('confidence_threshold', models.FloatField(default=0.7)),
                ('times_applied', models.IntegerField(default=0)),
                ('success_count', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'productos_feature_patterns',
            },
        ),
        migrations.CreateModel(
            name='LearningSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('total_items_processed', models.IntegerField(default=0)),
                ('items_learned', models.IntegerField(default=0)),
                ('items_predicted', models.IntegerField(default=0)),
                ('items_corrected', models.IntegerField(default=0)),
                ('prediction_accuracy', models.FloatField(blank=True, null=True)),
                ('avg_confidence', models.FloatField(blank=True, null=True)),
                ('processing_time_seconds', models.FloatField(blank=True, null=True)),
                ('session_metadata', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('tarea', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='learning_sessions', to='productos.tareaactualizacionlikewize')),
            ],
            options={
                'db_table': 'productos_learning_sessions',
            },
        ),
        migrations.CreateModel(
            name='MappingCorrection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('likewize_data', models.JSONField()),
                ('correction_reason', models.TextField(blank=True)),
                ('original_confidence', models.FloatField(blank=True, null=True)),
                ('correction_confidence', models.FloatField(default=1.0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('corrected_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('corrected_mapping', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='corrected_mappings', to='productos.capacidad')),
                ('kb_entry', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='productos.likewizeknowledgebase')),
                ('original_mapping', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='original_mappings', to='productos.capacidad')),
            ],
            options={
                'db_table': 'productos_mapping_corrections',
            },
        ),
        migrations.AddField(
            model_name='featurepattern',
            name='learned_from_sessions',
            field=models.ManyToManyField(blank=True, to='productos.learningsession'),
        ),
        migrations.AddField(
            model_name='likewizeitemstaging',
            name='phone_model_id',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='likewizeitemstaging',
            name='confidence_score',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name='likewizeknowledgebase',
            index=models.Index(fields=['likewize_m_model', 'confidence_score'], name='productos_l_likewiz_98eb42_idx'),
        ),
        migrations.AddIndex(
            model_name='likewizeknowledgebase',
            index=models.Index(fields=['last_used'], name='productos_l_last_us_21c8f4_idx'),
        ),
        migrations.AddIndex(
            model_name='likewizeknowledgebase',
            index=models.Index(fields=['user_validated', 'confidence_score'], name='productos_l_user_va_9c4a1b_idx'),
        ),
        migrations.AddIndex(
            model_name='likewizeknowledgebase',
            index=models.Index(fields=['success_rate'], name='productos_l_success_8a2e1f_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='likewizeknowledgebase',
            unique_together={('likewize_model_name', 'likewize_capacity')},
        ),
        migrations.AddIndex(
            model_name='featurepattern',
            index=models.Index(fields=['pattern_type', 'is_active'], name='productos_f_pattern_5d7e2a_idx'),
        ),
        migrations.AddIndex(
            model_name='featurepattern',
            index=models.Index(fields=['confidence_threshold'], name='productos_f_confide_8f9c3b_idx'),
        ),
        migrations.AddIndex(
            model_name='learningsession',
            index=models.Index(fields=['tarea', 'created_at'], name='productos_l_tarea_i_4a7f8d_idx'),
        ),
        migrations.AddIndex(
            model_name='learningsession',
            index=models.Index(fields=['prediction_accuracy'], name='productos_l_predict_9e8a7c_idx'),
        ),
        migrations.AddIndex(
            model_name='mappingcorrection',
            index=models.Index(fields=['created_at'], name='productos_m_created_3c4b8f_idx'),
        ),
        migrations.AddIndex(
            model_name='mappingcorrection',
            index=models.Index(fields=['corrected_by', 'created_at'], name='productos_m_correct_7a8d9e_idx'),
        ),
    ]