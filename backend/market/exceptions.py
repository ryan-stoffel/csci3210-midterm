import logging

from django.db import IntegrityError
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class Conflict(APIException):
    """409: the request is valid but the market state no longer allows it (sold, ended, already resolved)."""

    status_code = 409
    default_detail = "The request conflicts with the current state."
    default_code = "conflict"


def handler(exc, context):
    """DRF's handler, plus JSON bodies for integrity errors and unexpected crashes so the client always gets {detail}."""
    response = exception_handler(exc, context)
    if response is not None:
        return response
    if isinstance(exc, IntegrityError):
        return Response({"detail": "That change conflicts with existing data."}, status=409)
    logger.exception("Unhandled API error", exc_info=exc)
    return Response({"detail": "Something went wrong on our side. Please try again."}, status=500)
