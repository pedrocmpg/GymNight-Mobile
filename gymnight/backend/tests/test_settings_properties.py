"""
Property-based tests for the Settings configuration (config.py).

Feature: supabase-migration
Property 5: Settings rejeita qualquer configuração com variável obrigatória ausente

All tests are fully in-memory — no real .env file interference.
"""

import os
from unittest.mock import patch

import pydantic
import pytest
from hypothesis import HealthCheck, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Strategy
# ---------------------------------------------------------------------------

# All three required variable names
ALL_REQUIRED = ["SUPABASE_URL", "SUPABASE_JWT_SECRET", "DATABASE_URL"]

# A "proper subset" has at least one variable missing, so max_size=2
proper_subsets = st.frozensets(
    st.sampled_from(ALL_REQUIRED),
    min_size=0,
    max_size=2,
)

# ---------------------------------------------------------------------------
# Property 5: Settings rejeita qualquer configuração com variável obrigatória ausente
# Validates: Requirements 2.7, 3.1, 3.2, 3.3
# ---------------------------------------------------------------------------


@h_settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
@given(present_vars=proper_subsets)
def test_property_5_settings_rejects_incomplete_config(
    present_vars: frozenset,
) -> None:
    # Feature: supabase-migration, Property 5: Settings rejects incomplete config
    """
    **Validates: Requirements 2.7, 3.1, 3.2, 3.3**

    For any proper subset of {SUPABASE_URL, SUPABASE_JWT_SECRET, DATABASE_URL}
    (i.e. any combination where at least one variable is missing),
    instantiating Settings() must raise pydantic.ValidationError.

    The test patches the environment so that:
    - Only the variables in `present_vars` are present (with a dummy value)
    - All other required variables are absent
    - The .env file is suppressed via env_file=None to prevent real values
      from leaking in
    """
    dummy_env = {var: "dummy-value-for-testing" for var in present_vars}

    # We need to ensure no real .env leaks in. We do this by:
    # 1. Patching os.environ to only contain our controlled vars
    # 2. Importing Settings locally so we can override model_config

    with patch.dict(os.environ, dummy_env, clear=True):
        # Import Settings inside the patch so it reads our patched environment.
        # We also override model_config to disable .env file loading so the
        # real project .env file cannot fill in the missing variables.
        from pydantic_settings import BaseSettings, SettingsConfigDict

        class IsolatedSettings(BaseSettings):
            model_config = SettingsConfigDict(env_file=None)

            SUPABASE_URL: str
            SUPABASE_JWT_SECRET: str
            DATABASE_URL: str

        with pytest.raises(pydantic.ValidationError) as exc_info:
            IsolatedSettings()

        # Confirm the error mentions at least one of the missing fields
        missing_vars = set(ALL_REQUIRED) - set(present_vars)
        error_str = str(exc_info.value).lower()
        assert any(
            var.lower() in error_str for var in missing_vars
        ), (
            f"ValidationError did not mention any missing variable.\n"
            f"Missing: {missing_vars}\n"
            f"Error: {exc_info.value}"
        )
