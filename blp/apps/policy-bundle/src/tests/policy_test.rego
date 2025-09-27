package blp.policy

import data.blp.policy as policy

test_tcpa_allows_when_all_consents_present {
  result := policy.evaluate_tcpa({
    "jurisdictions": ["CA", "NV"],
    "communication_consents": {
      "federal": true,
      "ca": true,
      "nv": true,
    },
    "do_not_call": false,
  })
  result.allow
}

test_tcpa_blocks_when_missing_state_consent {
  result := policy.evaluate_tcpa({
    "jurisdictions": ["CA"],
    "communication_consents": {
      "federal": true,
    },
    "do_not_call": false,
  })
  not result.allow
  result.message == "missing consent for [\"ca\"]"
}

test_tcpa_blocks_do_not_call_flag {
  result := policy.evaluate_tcpa({
    "jurisdictions": ["CA"],
    "communication_consents": {
      "federal": true,
      "ca": true,
    },
    "do_not_call": true,
  })
  not result.allow
  result.message == "party is on the do not call list"
}

test_recording_allows_one_party_state_without_extra_consent {
  result := policy.evaluate_recording({
    "recording_enabled": true,
    "jurisdictions": ["TX"],
    "recording_consents": {
      "federal": true,
    },
  })
  result.allow
}

test_recording_requires_dual_party_consent {
  result := policy.evaluate_recording({
    "recording_enabled": true,
    "jurisdictions": ["CA"],
    "recording_consents": {
      "federal": true,
    },
  })
  not result.allow
  result.message == "missing recording consent for [\"ca\"]"
}

test_stage_transition_requires_sequential_order {
  result := policy.evaluate_stage_transition({
    "current_stage": "lead",
    "target_stage": "underwriting",
    "conditions": {
      "application_complete": true,
      "documents_received": true,
      "credit_verified": true,
    },
  })
  not result.allow
  result.message == "invalid transition from \"lead\" to \"underwriting\""
}

test_stage_transition_requires_gates {
  result := policy.evaluate_stage_transition({
    "current_stage": "processing",
    "target_stage": "underwriting",
    "conditions": {
      "documents_received": true,
    },
  })
  not result.allow
  result.message == "workflow requirements missing: [\"credit_verified\"]"
}

test_stage_transition_succeeds_when_gates_complete {
  result := policy.evaluate_stage_transition({
    "current_stage": "application",
    "target_stage": "processing",
    "conditions": {
      "application_complete": true,
      "documents_received": true,
    },
  })
  result.allow
}
