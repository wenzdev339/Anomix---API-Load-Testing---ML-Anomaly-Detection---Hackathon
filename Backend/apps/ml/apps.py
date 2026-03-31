from django.apps import AppConfig


class MlConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ml"
    label = "ml"

    def ready(self):
        # Load the TensorFlow model once at startup (lazy import to avoid
        # loading TF during migrations or management commands)
        try:
            from apps.ml.service import MLService
            MLService.instance()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "ML model could not be loaded at startup: %s", exc
            )
