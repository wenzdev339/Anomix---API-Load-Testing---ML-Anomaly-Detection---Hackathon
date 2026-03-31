from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loadtest", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="loadtestresult",
            name="sample_response_body",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="loadtestresult",
            name="sample_response_headers",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
