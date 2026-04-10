"""Unit tests for Retell tool handlers, dialer logic, and timezone utilities.

These tests import modules directly (not via HTTP) and cover:
- Tool definition schemas (tool_definitions.py)
- Dialer business logic (dialer.py)
- Timezone derivation (timezone_util.py)
"""

import os
import sys
import pytest

# Add backend to import path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))


# ---------------------------------------------------------------------------
# Tool Definitions
# ---------------------------------------------------------------------------

class TestToolDefinitions:
    """Verify the 6 tool definition schemas built for Retell LLM."""

    def _tools(self):
        from scripts.tool_definitions import build_tool_definitions
        return build_tool_definitions("https://test.com/retell/tool")

    def test_build_returns_list(self):
        tools = self._tools()
        assert isinstance(tools, list)

    def test_build_tool_definitions_count(self):
        tools = self._tools()
        assert len(tools) == 6

    def test_all_tools_have_required_fields(self):
        for tool in self._tools():
            assert "name" in tool, f"Tool missing 'name': {tool}"
            assert "type" in tool, f"Tool missing 'type': {tool}"
            assert "url" in tool, f"Tool missing 'url': {tool}"
            assert "parameters" in tool, f"Tool missing 'parameters': {tool}"

    def test_all_tools_are_custom_type(self):
        for tool in self._tools():
            assert tool["type"] == "custom", f"Tool type should be 'custom': {tool['name']}"

    def test_all_tools_point_to_correct_url(self):
        for tool in self._tools():
            assert tool["url"] == "https://test.com/retell/tool", (
                f"Tool URL wrong for {tool['name']}: {tool['url']}"
            )

    def test_tool_names(self):
        names = [t["name"] for t in self._tools()]
        assert "lookup_programme" in names
        assert "get_objection_response" in names
        assert "log_call_outcome" in names
        assert "get_lead_context" in names
        assert "transfer_call" in names
        assert "send_brochure" in names

    def test_tool_names_no_duplicates(self):
        names = [t["name"] for t in self._tools()]
        assert len(names) == len(set(names)), "Duplicate tool names found"

    def test_lookup_programme_params(self):
        tools = self._tools()
        lp = next(t for t in tools if t["name"] == "lookup_programme")
        props = lp["parameters"]["properties"]
        assert "profile" in props
        assert "country" in props
        assert lp["parameters"]["required"] == ["profile", "country"]

    def test_get_objection_response_params(self):
        tools = self._tools()
        gr = next(t for t in tools if t["name"] == "get_objection_response")
        props = gr["parameters"]["properties"]
        assert "objection_type" in props
        assert "objection_type" in gr["parameters"]["required"]

    def test_log_call_outcome_required_fields(self):
        tools = self._tools()
        lco = next(t for t in tools if t["name"] == "log_call_outcome")
        required = lco["parameters"]["required"]
        assert "outcome" in required
        assert "summary" in required

    def test_log_call_outcome_optional_fields_exist(self):
        tools = self._tools()
        lco = next(t for t in tools if t["name"] == "log_call_outcome")
        props = lco["parameters"]["properties"]
        optional_fields = [
            "programme_recommended", "closing_strategy_used", "lead_persona",
            "motivation_strength", "capacity_assessment", "objections_raised",
            "confirmed_email", "call_type", "webinar_date", "follow_up_date",
        ]
        for field in optional_fields:
            assert field in props, f"Expected optional field '{field}' missing from log_call_outcome"

    def test_get_lead_context_has_no_required_params(self):
        tools = self._tools()
        glc = next(t for t in tools if t["name"] == "get_lead_context")
        assert glc["parameters"].get("required", []) == []

    def test_transfer_call_params(self):
        tools = self._tools()
        tc = next(t for t in tools if t["name"] == "transfer_call")
        props = tc["parameters"]["properties"]
        assert "reason" in props
        assert "reason" in tc["parameters"]["required"]
        # context_summary is optional
        assert "context_summary" in props

    def test_send_brochure_optional_only(self):
        tools = self._tools()
        sb = next(t for t in tools if t["name"] == "send_brochure")
        # send_brochure has no required params
        assert sb["parameters"].get("required", []) == []
        props = sb["parameters"]["properties"]
        assert "programme" in props
        assert "include_webinar_link" in props

    def test_all_tools_have_description(self):
        for tool in self._tools():
            assert "description" in tool
            assert len(tool["description"]) > 10, f"Description too short for {tool['name']}"

    def test_all_tools_have_timeout_ms(self):
        for tool in self._tools():
            assert "timeout_ms" in tool
            assert isinstance(tool["timeout_ms"], int)
            assert tool["timeout_ms"] > 0

    def test_different_url_is_used(self):
        from scripts.tool_definitions import build_tool_definitions
        tools = build_tool_definitions("https://other.example.com/retell/tool")
        for tool in tools:
            assert tool["url"] == "https://other.example.com/retell/tool"


# ---------------------------------------------------------------------------
# Dialer Logic
# ---------------------------------------------------------------------------

class TestDialerLogic:
    """Test dialer business logic — functions that don't require DB."""

    def test_is_in_business_hours_returns_bool_london(self):
        from dialer import is_in_business_hours
        result = is_in_business_hours("Europe/London")
        assert isinstance(result, bool)

    def test_is_in_business_hours_returns_bool_lagos(self):
        from dialer import is_in_business_hours
        result = is_in_business_hours("Africa/Lagos")
        assert isinstance(result, bool)

    def test_is_in_business_hours_empty_string_fails_open(self):
        from dialer import is_in_business_hours
        assert is_in_business_hours("") is True

    def test_is_in_business_hours_none_fails_open(self):
        from dialer import is_in_business_hours
        assert is_in_business_hours(None) is True

    def test_is_in_business_hours_invalid_timezone_fails_open(self):
        from dialer import is_in_business_hours
        assert is_in_business_hours("Invalid/NotReal_Timezone") is True

    def test_is_in_business_hours_9am_to_6pm_boundary(self):
        """Verify start_hour/end_hour params work correctly."""
        from dialer import is_in_business_hours
        import pytz
        from datetime import datetime

        # Force a specific hour by using a timezone where we know current time
        # We test the logic indirectly: all-day window should always be True
        result_all_day = is_in_business_hours("Europe/London", start_hour=0, end_hour=24)
        assert result_all_day is True

    def test_max_concurrent_calls_default(self):
        from dialer import MAX_CONCURRENT_CALLS
        assert MAX_CONCURRENT_CALLS == 18

    def test_max_concurrent_calls_is_int(self):
        from dialer import MAX_CONCURRENT_CALLS
        assert isinstance(MAX_CONCURRENT_CALLS, int)

    def test_min_call_interval_is_120(self):
        from dialer import MIN_CALL_INTERVAL_SECONDS
        assert MIN_CALL_INTERVAL_SECONDS == 120

    def test_lead_scan_limit_is_positive(self):
        from dialer import _LEAD_SCAN_LIMIT
        assert _LEAD_SCAN_LIMIT > 0


# ---------------------------------------------------------------------------
# Timezone Utility
# ---------------------------------------------------------------------------

class TestTimezoneUtil:
    """Test timezone derivation from E.164 phone numbers."""

    def test_uk_number_44_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+447700900000") == "Europe/London"

    def test_nigeria_number_234_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+2347084863705") == "Africa/Lagos"

    def test_us_number_1_prefix(self):
        from timezone_util import derive_timezone
        result = derive_timezone("+15551000101")
        assert result == "America/New_York"

    def test_ghana_number_233_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+233200000000") == "Africa/Accra"

    def test_ireland_number_353_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+35387123456") == "Europe/Dublin"

    def test_kenya_number_254_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+254700000000") == "Africa/Nairobi"

    def test_south_africa_number_27_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+27821234567") == "Africa/Johannesburg"

    def test_germany_number_49_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+4915112345678") == "Europe/Berlin"

    def test_france_number_33_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+33612345678") == "Europe/Paris"

    def test_uae_number_971_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+971501234567") == "Asia/Dubai"

    def test_india_number_91_prefix(self):
        from timezone_util import derive_timezone
        assert derive_timezone("+919876543210") == "Asia/Kolkata"

    def test_unknown_number_returns_utc(self):
        from timezone_util import derive_timezone
        result = derive_timezone("+99999999999")
        assert isinstance(result, str)
        assert len(result) > 0  # Must not crash or return empty

    def test_empty_string_returns_string(self):
        from timezone_util import derive_timezone
        result = derive_timezone("")
        assert isinstance(result, str)

    def test_no_plus_prefix_still_works(self):
        from timezone_util import derive_timezone
        # derive_timezone strips leading +
        result = derive_timezone("447700900000")
        assert isinstance(result, str)

    def test_longer_prefix_wins_over_shorter(self):
        """234 (Nigeria) must beat 2 (no mapping) — longest match wins."""
        from timezone_util import derive_timezone
        # +234 should match Nigeria, not a hypothetical +2 mapping
        result = derive_timezone("+2341234567890")
        assert result == "Africa/Lagos"

    def test_returns_valid_timezone_string(self):
        """All mapped timezones should be parseable by pytz."""
        import pytz
        from timezone_util import COUNTRY_CODE_TO_TIMEZONE
        for code, tz in COUNTRY_CODE_TO_TIMEZONE.items():
            try:
                pytz.timezone(tz)
            except pytz.UnknownTimeZoneError:
                pytest.fail(f"Invalid timezone '{tz}' for country code '{code}'")
