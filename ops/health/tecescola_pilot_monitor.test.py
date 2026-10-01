import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("tecescola_pilot_monitor.py")
SPEC = importlib.util.spec_from_file_location("tecescola_pilot_monitor", MODULE_PATH)
monitor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(monitor)


class MonitorStateTests(unittest.TestCase):
    def test_two_http_failures_emit_once_and_recovery_emits_once(self):
        state = {"checks": {}}
        statuses = ["PASS", "FAIL", "FAIL", "FAIL", "PASS"]
        events = [monitor.advance_state(state, "auth", status, 2)[1] for status in statuses]
        self.assertEqual(events, [None, None, "ALERT", None, "RECOVERY"])

    def test_unknown_access_log_is_not_misreported_as_zero_errors(self):
        state = {"checks": {}}
        state, event = monitor.advance_state(state, "http_5xx", "UNKNOWN", 1)
        self.assertEqual(event, "ALERT")
        self.assertEqual(state["checks"]["http_5xx"]["alert_severity"], "WARNING")

    def test_warning_can_escalate_to_critical(self):
        state = {"checks": {}}
        state, first = monitor.advance_state(state, "disk", "WARNING", 1)
        state, second = monitor.advance_state(state, "disk", "CRITICAL", 1)
        self.assertEqual((first, second), ("ALERT", "ALERT"))
        self.assertEqual(state["checks"]["disk"]["alert_severity"], "CRITICAL")


if __name__ == "__main__":
    unittest.main()
