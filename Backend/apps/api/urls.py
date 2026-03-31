from django.urls import path
from . import views

urlpatterns = [
    path("test/",            views.test_list,         name="test-list"),
    path("test/<int:pk>/",   views.test_detail,        name="test-detail"),
    path("test/<int:pk>/delete/", views.test_delete,   name="test-delete"),
    path("metrics/",         views.metrics_list,       name="metrics-list"),
    path("metrics/<int:pk>/",views.metrics_detail,     name="metrics-detail"),
    path("predict/",         views.predict,            name="predict"),
    path("anomaly/",         views.anomaly_list,       name="anomaly-list"),
    path("anomaly/<int:pk>/",views.anomaly_for_result, name="anomaly-for-result"),
    path("ml/status/",       views.ml_status,          name="ml-status"),
]
