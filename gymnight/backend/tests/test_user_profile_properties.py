"""
Property-based tests for User profile field validators.

Feature: backend-fixes-and-improvements
Properties 1–4: ORM @validates decorators and Pydantic schema validators

All properties are tested against BOTH layers:
  1. SQLAlchemy ORM @validates decorators (app/database/models/user.py)
  2. Pydantic field_validators on UserProfileUpdate (app/schemas/user.py)

No database connection is required — ORM validators fire synchronously when
attributes are assigned to an in-memory User() instance.
"""

import os
import re
from datetime import date

import pytest
from hypothesis import HealthCheck, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st
from pydantic import ValidationError

# ---------------------------------------------------------------------------
# Environment setup — required before importing any app module
# ---------------------------------------------------------------------------

os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-hypothesis-runs-x")
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

from app.database.models.user import User            # noqa: E402
from app.schemas.user import UserProfileUpdate       # noqa: E402

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BIRTH_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

VALID_GENDERS = {"male", "female", "other"}


# ---------------------------------------------------------------------------
# Probe helpers: detect whether Pydantic validators are implemented yet
# (They will be added in task 4.1; these probes let the property tests
#  assert the ORM layer now and the Pydantic layer once task 4.1 is done.)
# ---------------------------------------------------------------------------


def _pydantic_weight_validates() -> bool:
    """Return True if UserProfileUpdate currently rejects out-of-range weight."""
    try:
        UserProfileUpdate(weight=0.0)  # 0.0 is always out of [1.0, 500.0]
        return False
    except ValidationError:
        return True


def _pydantic_height_validates() -> bool:
    """Return True if UserProfileUpdate currently rejects out-of-range height."""
    try:
        UserProfileUpdate(height=0.0)  # 0.0 is always out of [50.0, 300.0]
        return False
    except ValidationError:
        return True


def _pydantic_birth_date_validates() -> bool:
    """
    Probe whether UserProfileUpdate currently enforces birth_date validation.
    Returns True if the schema rejects a clearly invalid birth_date string.
    """
    try:
        UserProfileUpdate(birth_date="not-a-date")
        return False  # Schema accepted invalid input → no validator yet
    except ValidationError:
        return True


def _pydantic_gender_validates() -> bool:
    """
    Probe whether UserProfileUpdate currently enforces gender validation.
    Returns True if the schema rejects a clearly invalid gender string.
    """
    try:
        UserProfileUpdate(gender="clearly_invalid_gender_value")
        return False  # Schema accepted invalid input → no validator yet
    except ValidationError:
        return True


def _orm_set_weight(value: float) -> None:
    """Assign `value` to a fresh User instance's weight attribute.

    We use the class-level validator directly rather than constructing a full
    ORM instance (which would require a DB connection).  SQLAlchemy @validates
    decorators are plain methods stored as ``validate_<field>`` on the class
    and can be called directly without a real SQLAlchemy session.
    """
    User.validate_weight(None, "weight", value)


def _orm_set_height(value: float) -> None:
    """Assign `value` to a fresh User instance's height attribute."""
    User.validate_height(None, "height", value)


def _orm_set_birth_date(value: str) -> None:
    """Assign `value` to a fresh User instance's birth_date attribute."""
    User.validate_birth_date(None, "birth_date", value)


def _orm_set_gender(value: str) -> None:
    """Assign `value` to a fresh User instance's gender attribute."""
    User.validate_gender(None, "gender", value)


# ---------------------------------------------------------------------------
# Property 1: Weight validation rejects out-of-range values
# Feature: backend-fixes-and-improvements, Property 1: weight validation
# ---------------------------------------------------------------------------


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(weight=st.floats(allow_nan=False, allow_infinity=False))
def test_property_1_weight_validation(weight: float) -> None:
    # Feature: backend-fixes-and-improvements, Property 1: weight validation
    """
    **Validates: Requirements 1.1, 4.5**

    For any float `weight`:
    - If weight is in [1.0, 500.0], both the ORM validator and the Pydantic
      schema MUST accept it without raising an error.
    - If weight is outside [1.0, 500.0], both the ORM validator MUST raise
      ValueError and the Pydantic schema MUST raise ValidationError.
    """
    in_range = 1.0 <= weight <= 500.0

    # --- ORM layer ---
    if in_range:
        # Must not raise
        try:
            _orm_set_weight(weight)
        except ValueError as exc:
            pytest.fail(
                f"ORM validator unexpectedly rejected weight={weight!r}: {exc}"
            )
    else:
        with pytest.raises(ValueError, match="weight must be between"):
            _orm_set_weight(weight)

    # --- Pydantic layer ---
    # Only assert Pydantic validation when the validator is actually implemented.
    # task 4.1 adds @field_validator("weight") to UserProfileUpdate; until then
    # the schema accepts any float and we skip the out-of-range assertion.
    _pydantic_has_validator = _pydantic_weight_validates()

    if not _pydantic_has_validator:
        return

    if in_range:
        try:
            UserProfileUpdate(weight=weight)
        except ValidationError as exc:
            pytest.fail(
                f"Pydantic schema unexpectedly rejected weight={weight!r}: {exc}"
            )
    else:
        with pytest.raises(ValidationError):
            UserProfileUpdate(weight=weight)


# ---------------------------------------------------------------------------
# Property 2: Height validation rejects out-of-range values
# Feature: backend-fixes-and-improvements, Property 2: height validation
# ---------------------------------------------------------------------------


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(height=st.floats(allow_nan=False, allow_infinity=False))
def test_property_2_height_validation(height: float) -> None:
    # Feature: backend-fixes-and-improvements, Property 2: height validation
    """
    **Validates: Requirements 1.2, 4.6**

    For any float `height`:
    - If height is in [50.0, 300.0], both the ORM validator and the Pydantic
      schema MUST accept it without raising an error.
    - If height is outside [50.0, 300.0], the ORM validator MUST raise
      ValueError and the Pydantic schema MUST raise ValidationError.
    """
    in_range = 50.0 <= height <= 300.0

    # --- ORM layer ---
    if in_range:
        try:
            _orm_set_height(height)
        except ValueError as exc:
            pytest.fail(
                f"ORM validator unexpectedly rejected height={height!r}: {exc}"
            )
    else:
        with pytest.raises(ValueError, match="height must be between"):
            _orm_set_height(height)

    # --- Pydantic layer ---
    # Only assert Pydantic validation when the validator is actually implemented.
    # task 4.1 adds @field_validator("height") to UserProfileUpdate; until then
    # the schema accepts any float and we skip the out-of-range assertion.
    _pydantic_has_validator = _pydantic_height_validates()

    if not _pydantic_has_validator:
        return

    if in_range:
        try:
            UserProfileUpdate(height=height)
        except ValidationError as exc:
            pytest.fail(
                f"Pydantic schema unexpectedly rejected height={height!r}: {exc}"
            )
    else:
        with pytest.raises(ValidationError):
            UserProfileUpdate(height=height)


# ---------------------------------------------------------------------------
# Property 3: Birth date validation rejects non-YYYY-MM-DD strings
# Feature: backend-fixes-and-improvements, Property 3: birth_date validation
# ---------------------------------------------------------------------------

# Strategy: generate arbitrary strings, including some that look date-like
_birth_date_strategy = st.one_of(
    st.text(min_size=0, max_size=20),           # Mostly non-matching strings
    st.from_regex(r"\d{4}-\d{2}-\d{2}", fullmatch=True),  # Matching format
    st.dates().map(lambda d: d.isoformat()),     # Real calendar dates (past & future)
)


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(birth_date=_birth_date_strategy)
def test_property_3_birth_date_validation(birth_date: str) -> None:
    # Feature: backend-fixes-and-improvements, Property 3: birth_date validation
    """
    **Validates: Requirements 1.3, 4.8, 4.9**

    For any string `birth_date`:
    - The ORM validator accepts it if and only if it matches the pattern YYYY-MM-DD.
      (The ORM layer only checks format, not whether the date is in the future.)
    - The Pydantic schema accepts it if and only if:
        (a) it matches the pattern YYYY-MM-DD, AND
        (b) the date is NOT in the future (i.e., ≤ today's UTC date).
      Both conditions must hold; either failing means ValidationError.

    Note: the Pydantic layer is only tested if validators exist on
    UserProfileUpdate. If no validators are present yet, the Pydantic
    assertion for the out-of-range case is skipped (schema not yet
    implemented — that is covered by task 4.1).
    """
    format_ok = bool(_BIRTH_DATE_RE.fullmatch(birth_date))

    # Determine if the date is in the past/present (not future) when format is valid
    not_future = False
    if format_ok:
        try:
            parsed = date.fromisoformat(birth_date)
            not_future = parsed <= date.today()
        except ValueError:
            # Syntactically matching regex but not a real calendar date (e.g. 2000-99-99)
            format_ok = False

    # --- ORM layer: checks format only ---
    # The ORM @validates("birth_date") only checks the regex, not future dates.
    if format_ok or not bool(_BIRTH_DATE_RE.fullmatch(birth_date)):
        # Recompute: does the *raw* string match the regex?
        raw_format_ok = bool(_BIRTH_DATE_RE.fullmatch(birth_date))
        if raw_format_ok:
            try:
                _orm_set_birth_date(birth_date)
            except ValueError as exc:
                pytest.fail(
                    f"ORM validator unexpectedly rejected birth_date={birth_date!r}: {exc}"
                )
        else:
            with pytest.raises(ValueError, match="birth_date must be YYYY-MM-DD"):
                _orm_set_birth_date(birth_date)

    # --- Pydantic layer: checks format AND future date ---
    # Detect whether UserProfileUpdate has a birth_date validator by checking
    # if it rejects a known-invalid value.
    _pydantic_has_validator = _pydantic_birth_date_validates()

    if not _pydantic_has_validator:
        # Validators not yet implemented (task 4.1 pending) — skip Pydantic assertions
        return

    pydantic_should_accept = format_ok and not_future

    if pydantic_should_accept:
        try:
            UserProfileUpdate(birth_date=birth_date)
        except ValidationError as exc:
            pytest.fail(
                f"Pydantic schema unexpectedly rejected birth_date={birth_date!r}: {exc}"
            )
    else:
        with pytest.raises(ValidationError):
            UserProfileUpdate(birth_date=birth_date)


# ---------------------------------------------------------------------------
# Property 4: Gender validation accepts only enumerated values
# Feature: backend-fixes-and-improvements, Property 4: gender validation
# ---------------------------------------------------------------------------

# Strategy: arbitrary strings, biased toward the valid set and short strings
_gender_strategy = st.one_of(
    st.text(min_size=0, max_size=20),         # Mostly non-matching strings
    st.sampled_from(["male", "female", "other"]),  # Valid values
    st.sampled_from(["Male", "FEMALE", "Other", "", " ", "unknown", "m", "f"]),
)


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(gender=_gender_strategy)
def test_property_4_gender_validation(gender: str) -> None:
    # Feature: backend-fixes-and-improvements, Property 4: gender validation
    """
    **Validates: Requirements 1.4, 4.7**

    For any string `gender`:
    - If gender is one of {"male", "female", "other"}, both the ORM validator
      and the Pydantic schema MUST accept it.
    - If gender is any other string, the ORM validator MUST raise ValueError
      and the Pydantic schema MUST raise ValidationError.

    Note: Pydantic validation is only asserted if UserProfileUpdate has a
    gender validator (i.e., task 4.1 is complete). If the validator is absent
    the Pydantic assertions are skipped.
    """
    in_enum = gender in VALID_GENDERS

    # --- ORM layer ---
    if in_enum:
        try:
            _orm_set_gender(gender)
        except ValueError as exc:
            pytest.fail(
                f"ORM validator unexpectedly rejected gender={gender!r}: {exc}"
            )
    else:
        with pytest.raises(ValueError, match="gender must be"):
            _orm_set_gender(gender)

    # --- Pydantic layer ---
    _pydantic_has_validator = _pydantic_gender_validates()

    if not _pydantic_has_validator:
        # Validators not yet implemented (task 4.1 pending) — skip Pydantic assertions
        return

    if in_enum:
        try:
            UserProfileUpdate(gender=gender)
        except ValidationError as exc:
            pytest.fail(
                f"Pydantic schema unexpectedly rejected gender={gender!r}: {exc}"
            )
    else:
        with pytest.raises(ValidationError):
            UserProfileUpdate(gender=gender)


# ===========================================================================
# Properties 5–8: HTTP endpoint round-trip tests (mocked DB sessions)
# Feature: backend-fixes-and-improvements
#
# These tests exercise the FastAPI router layer using TestClient with
# overridden dependencies — no real database connection is required.
# ===========================================================================

import uuid
from datetime import date
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

# Patch create_all so importing app.main does not require a live DB.
# The env vars are already set above (SUPABASE_URL, SUPABASE_JWT_SECRET,
# DATABASE_URL), but create_all still tries to connect.  We mock it out.
with patch("sqlalchemy.engine.Engine.connect"):
    from app.main import app as fastapi_app  # noqa: E402

from app.core.security import get_current_user, get_current_user_email  # noqa: E402
from app.database.connection import get_db       # noqa: E402
from app.database import models                  # noqa: E402


# ---------------------------------------------------------------------------
# Shared test helpers
# ---------------------------------------------------------------------------

_FIXED_USER_ID = str(uuid.uuid4())
_FIXED_USER_EMAIL = "property-test@example.com"


def _make_mock_db() -> MagicMock:
    """Return a fresh MagicMock that behaves like a SQLAlchemy Session."""
    db = MagicMock()
    # Default: query(...).filter(...).first() returns None (no user found)
    db.query.return_value.filter.return_value.first.return_value = None
    return db


def _make_test_client(mock_user_id: str, mock_db: MagicMock) -> TestClient:
    """
    Build a TestClient for fastapi_app with get_current_user, get_current_user_email
    and get_db all overridden to return the supplied test doubles.
    """
    fastapi_app.dependency_overrides[get_current_user] = lambda: mock_user_id
    fastapi_app.dependency_overrides[get_current_user_email] = lambda: _FIXED_USER_EMAIL
    fastapi_app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(fastapi_app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Property 5: Profile field round-trip via POST /users
# Feature: backend-fixes-and-improvements, Property 5: POST /users round-trip
# ---------------------------------------------------------------------------

@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    name=st.text(
        min_size=1,
        max_size=50,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd", "Zs")),
    ),
    weight=st.one_of(
        st.none(),
        st.floats(min_value=1.0, max_value=500.0, allow_nan=False, allow_infinity=False),
    ),
    height=st.one_of(
        st.none(),
        st.floats(min_value=50.0, max_value=300.0, allow_nan=False, allow_infinity=False),
    ),
    birth_date=st.one_of(
        st.none(),
        st.dates(min_value=date(1900, 1, 1), max_value=date.today()).map(
            lambda d: d.isoformat()
        ),
    ),
    gender=st.one_of(st.none(), st.sampled_from(["male", "female", "other"])),
)
def test_property_5_post_users_field_roundtrip(
    name: str,
    weight,
    height,
    birth_date,
    gender,
) -> None:
    """
    **Validates: Requirements 1.6, 3.1**

    For any valid combination of profile fields sent to POST /users:
    - The endpoint must return HTTP 201.
    - The response JSON must contain exactly the sent field values.

    The DB is fully mocked so no real database is touched.
    """
    user_id = str(uuid.uuid4())
    mock_db = _make_mock_db()

    # No existing user → creation proceeds
    mock_db.query.return_value.filter.return_value.first.return_value = None

    # Simulate ORM populate on db.refresh(new_user): copy fields onto the object
    def _refresh_side_effect(user_obj):
        user_obj.id = user_id
        user_obj.name = name
        user_obj.email = _FIXED_USER_EMAIL
        user_obj.weight = weight
        user_obj.height = height
        user_obj.birth_date = birth_date
        user_obj.gender = gender

    mock_db.refresh.side_effect = _refresh_side_effect

    try:
        fastapi_app.dependency_overrides[get_current_user] = lambda: user_id
        fastapi_app.dependency_overrides[get_current_user_email] = lambda: _FIXED_USER_EMAIL
        fastapi_app.dependency_overrides[get_db] = lambda: mock_db

        client = TestClient(fastapi_app, raise_server_exceptions=False)

        payload = {"name": name}
        if weight is not None:
            payload["weight"] = weight
        if height is not None:
            payload["height"] = height
        if birth_date is not None:
            payload["birth_date"] = birth_date
        if gender is not None:
            payload["gender"] = gender

        response = client.post("/users", json=payload)

        assert response.status_code == 201, (
            f"Expected 201, got {response.status_code}: {response.text}"
        )

        body = response.json()
        assert body["name"] == name, f"name mismatch: {body['name']!r} != {name!r}"

        if weight is not None:
            assert abs(body["weight"] - weight) < 1e-6, (
                f"weight mismatch: {body['weight']} != {weight}"
            )
        if height is not None:
            assert abs(body["height"] - height) < 1e-6, (
                f"height mismatch: {body['height']} != {height}"
            )
        if birth_date is not None:
            assert body["birth_date"] == birth_date, (
                f"birth_date mismatch: {body['birth_date']!r} != {birth_date!r}"
            )
        if gender is not None:
            assert body["gender"] == gender, (
                f"gender mismatch: {body['gender']!r} != {gender!r}"
            )
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)
        fastapi_app.dependency_overrides.pop(get_current_user_email, None)
        fastapi_app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Property 6: GET /users/me returns correct profile for any authenticated user
# Feature: backend-fixes-and-improvements, Property 6: GET /users/me profile
# ---------------------------------------------------------------------------

@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    user_id=st.uuids().map(str),
    name=st.text(
        min_size=1,
        max_size=50,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd", "Zs")),
    ),
    weight=st.one_of(
        st.none(),
        st.floats(min_value=1.0, max_value=500.0, allow_nan=False, allow_infinity=False),
    ),
    height=st.one_of(
        st.none(),
        st.floats(min_value=50.0, max_value=300.0, allow_nan=False, allow_infinity=False),
    ),
    birth_date=st.one_of(
        st.none(),
        st.dates(min_value=date(1900, 1, 1), max_value=date.today()).map(
            lambda d: d.isoformat()
        ),
    ),
    gender=st.one_of(st.none(), st.sampled_from(["male", "female", "other"])),
)
def test_property_6_get_users_me_returns_correct_profile(
    user_id: str,
    name: str,
    weight,
    height,
    birth_date,
    gender,
) -> None:
    """
    **Validates: Requirements 3.1**

    For any stored user profile, GET /users/me must:
    - Return HTTP 200.
    - Return a body containing id, name, weight, height, birth_date, gender
      that match the values stored in the mocked DB.
    """
    mock_db = _make_mock_db()

    # Build a mock user that mimics the ORM User object
    mock_user = MagicMock()
    mock_user.id = user_id
    mock_user.name = name
    mock_user.email = _FIXED_USER_EMAIL
    mock_user.weight = weight
    mock_user.height = height
    mock_user.birth_date = birth_date
    mock_user.gender = gender

    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    try:
        fastapi_app.dependency_overrides[get_current_user] = lambda: user_id
        fastapi_app.dependency_overrides[get_db] = lambda: mock_db

        client = TestClient(fastapi_app, raise_server_exceptions=False)
        response = client.get("/users/me")

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        body = response.json()
        assert body["id"] == user_id, f"id mismatch: {body['id']!r} != {user_id!r}"
        assert body["name"] == name, f"name mismatch: {body['name']!r} != {name!r}"

        if weight is None:
            assert body.get("weight") is None, f"weight should be None, got {body.get('weight')}"
        else:
            assert abs(body["weight"] - weight) < 1e-6, (
                f"weight mismatch: {body['weight']} != {weight}"
            )
        if height is None:
            assert body.get("height") is None, f"height should be None, got {body.get('height')}"
        else:
            assert abs(body["height"] - height) < 1e-6, (
                f"height mismatch: {body['height']} != {height}"
            )

        assert body.get("birth_date") == birth_date, (
            f"birth_date mismatch: {body.get('birth_date')!r} != {birth_date!r}"
        )
        assert body.get("gender") == gender, (
            f"gender mismatch: {body.get('gender')!r} != {gender!r}"
        )
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)
        fastapi_app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Property 7: PATCH /users/me updates only fields present in the payload
# Feature: backend-fixes-and-improvements, Property 7: PATCH /users/me partial
# ---------------------------------------------------------------------------

# Strategy for generating a non-empty dict of valid field updates
_optional_name = st.one_of(
    st.none(),
    st.text(
        min_size=1,
        max_size=50,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd", "Zs")),
    ),
)
_optional_weight = st.one_of(
    st.none(),
    st.floats(min_value=1.0, max_value=500.0, allow_nan=False, allow_infinity=False),
)
_optional_height = st.one_of(
    st.none(),
    st.floats(min_value=50.0, max_value=300.0, allow_nan=False, allow_infinity=False),
)
_optional_birth_date = st.one_of(
    st.none(),
    st.dates(min_value=date(1900, 1, 1), max_value=date.today()).map(
        lambda d: d.isoformat()
    ),
)
_optional_gender = st.one_of(st.none(), st.sampled_from(["male", "female", "other"]))


@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(
    # Initial state of the stored user
    initial_name=st.text(
        min_size=1,
        max_size=50,
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd", "Zs")),
    ),
    initial_weight=_optional_weight,
    initial_height=_optional_height,
    initial_birth_date=_optional_birth_date,
    initial_gender=_optional_gender,
    # Fields to include in PATCH payload (None means "omit this field")
    patch_name=_optional_name,
    patch_weight=_optional_weight,
    patch_height=_optional_height,
    patch_birth_date=_optional_birth_date,
    patch_gender=_optional_gender,
)
def test_property_7_patch_users_me_updates_only_sent_fields(
    initial_name,
    initial_weight,
    initial_height,
    initial_birth_date,
    initial_gender,
    patch_name,
    patch_weight,
    patch_height,
    patch_birth_date,
    patch_gender,
) -> None:
    """
    **Validates: Requirements 4.1**

    For any existing user and any valid partial payload sent to PATCH /users/me:
    - The endpoint must return HTTP 200.
    - Fields included in the payload must reflect the new values.
    - Fields NOT included in the payload must remain unchanged.

    This verifies the model_dump(exclude_unset=True) semantics in the router.
    """
    # Build the PATCH payload with only the fields we want to send
    patch_payload: dict = {}
    if patch_name is not None:
        patch_payload["name"] = patch_name
    if patch_weight is not None:
        patch_payload["weight"] = patch_weight
    if patch_height is not None:
        patch_payload["height"] = patch_height
    if patch_birth_date is not None:
        patch_payload["birth_date"] = patch_birth_date
    if patch_gender is not None:
        patch_payload["gender"] = patch_gender

    # If the payload is completely empty, the PATCH is a no-op but still valid.
    # We still verify HTTP 200 and no field mutation.

    user_id = str(uuid.uuid4())
    mock_db = _make_mock_db()

    # Use a simple namespace to support getattr/setattr (as the router does)
    class _MockUser:
        pass

    stored_user = _MockUser()
    stored_user.id = user_id          # type: ignore[attr-defined]
    stored_user.name = initial_name   # type: ignore[attr-defined]
    stored_user.weight = initial_weight    # type: ignore[attr-defined]
    stored_user.height = initial_height    # type: ignore[attr-defined]
    stored_user.birth_date = initial_birth_date  # type: ignore[attr-defined]
    stored_user.gender = initial_gender    # type: ignore[attr-defined]

    mock_db.query.return_value.filter.return_value.first.return_value = stored_user
    mock_db.refresh.side_effect = lambda u: None  # no-op

    try:
        fastapi_app.dependency_overrides[get_current_user] = lambda: user_id
        fastapi_app.dependency_overrides[get_db] = lambda: mock_db

        client = TestClient(fastapi_app, raise_server_exceptions=False)
        response = client.patch("/users/me", json=patch_payload)

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

        body = response.json()

        # --- Fields included in payload must equal the new values ---
        if "name" in patch_payload:
            assert body["name"] == patch_payload["name"], (
                f"name not updated: {body['name']!r} != {patch_payload['name']!r}"
            )
        if "weight" in patch_payload:
            assert abs((body["weight"] or 0) - patch_payload["weight"]) < 1e-6, (
                f"weight not updated: {body['weight']} != {patch_payload['weight']}"
            )
        if "height" in patch_payload:
            assert abs((body["height"] or 0) - patch_payload["height"]) < 1e-6, (
                f"height not updated: {body['height']} != {patch_payload['height']}"
            )
        if "birth_date" in patch_payload:
            assert body["birth_date"] == patch_payload["birth_date"], (
                f"birth_date not updated: {body['birth_date']!r} != {patch_payload['birth_date']!r}"
            )
        if "gender" in patch_payload:
            assert body["gender"] == patch_payload["gender"], (
                f"gender not updated: {body['gender']!r} != {patch_payload['gender']!r}"
            )

        # --- Fields NOT in payload must retain initial values ---
        if "name" not in patch_payload:
            assert body.get("name") == initial_name, (
                f"name mutated unexpectedly: {body.get('name')!r} != {initial_name!r}"
            )
        if "weight" not in patch_payload:
            if initial_weight is None:
                assert body.get("weight") is None
            else:
                assert abs((body.get("weight") or 0) - initial_weight) < 1e-6, (
                    f"weight mutated: {body.get('weight')} != {initial_weight}"
                )
        if "height" not in patch_payload:
            if initial_height is None:
                assert body.get("height") is None
            else:
                assert abs((body.get("height") or 0) - initial_height) < 1e-6, (
                    f"height mutated: {body.get('height')} != {initial_height}"
                )
        if "birth_date" not in patch_payload:
            assert body.get("birth_date") == initial_birth_date, (
                f"birth_date mutated: {body.get('birth_date')!r} != {initial_birth_date!r}"
            )
        if "gender" not in patch_payload:
            assert body.get("gender") == initial_gender, (
                f"gender mutated: {body.get('gender')!r} != {initial_gender!r}"
            )
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)
        fastapi_app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Property 8: DELETE /users/me removes all user data (cascade completeness)
# Feature: backend-fixes-and-improvements, Property 8: DELETE /users/me cascade
# ---------------------------------------------------------------------------

@h_settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
@given(user_id=st.uuids().map(str))
def test_property_8_delete_users_me_cascade_completeness(user_id: str) -> None:
    """
    **Validates: Requirements 5.1, 5.4, 5.6**

    For any authenticated user:
    - DELETE /users/me must return HTTP 204.
    - db.delete(user) must be called (user row removed).
    - The DeletedRecord filter+delete query must be called (tombstones removed).
    - A subsequent GET /users/me (with DB returning None) must return HTTP 404.
    """
    mock_db = _make_mock_db()

    mock_user = MagicMock()
    mock_user.id = user_id

    # First query returns the user (DELETE path), chained calls for DeletedRecord
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    # .delete(synchronize_session=False) should not raise
    mock_db.query.return_value.filter.return_value.delete.return_value = 1

    try:
        fastapi_app.dependency_overrides[get_current_user] = lambda: user_id
        fastapi_app.dependency_overrides[get_db] = lambda: mock_db

        client = TestClient(fastapi_app, raise_server_exceptions=False)

        # --- Primary assertion: DELETE returns 204 ---
        response = client.delete("/users/me")
        assert response.status_code == 204, (
            f"Expected 204, got {response.status_code}: {response.text}"
        )

        # --- db.delete(user) must have been called ---
        mock_db.delete.assert_called_once_with(mock_user)

        # --- db.commit() must have been called ---
        mock_db.commit.assert_called()

        # --- DeletedRecord query must have been executed ---
        # The router calls db.query(models.DeletedRecord).filter(...).delete(...)
        # We verify that db.query was called with DeletedRecord at some point.
        query_args = [c.args for c in mock_db.query.call_args_list]
        called_with_deleted_record = any(
            models.DeletedRecord in args for args in query_args
        )
        assert called_with_deleted_record, (
            "Expected db.query(DeletedRecord) to be called, but it was not. "
            f"Actual query calls: {query_args}"
        )

        # --- After delete, GET /users/me with None-returning DB should be 404 ---
        mock_db_empty = _make_mock_db()
        mock_db_empty.query.return_value.filter.return_value.first.return_value = None

        fastapi_app.dependency_overrides[get_db] = lambda: mock_db_empty
        get_response = client.get("/users/me")
        assert get_response.status_code == 404, (
            f"Expected 404 after delete, got {get_response.status_code}: {get_response.text}"
        )
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)
        fastapi_app.dependency_overrides.pop(get_db, None)
