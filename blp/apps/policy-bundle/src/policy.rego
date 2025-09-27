package blp.policy

default allow = false

allow {
  result := evaluate_contract
  result.allow
}

deny[msg] {
  result := evaluate_contract
  msg := result.message
  not result.allow
}

evaluate_contract = result {
  input.contract == "trid"
  result := evaluate_trid(input)
}

evaluate_contract = result {
  input.contract == "esign"
  result := evaluate_esign(input)
}

evaluate_contract = result {
  input.contract == "lock"
  result := evaluate_lock(input)
}

evaluate_contract = result {
  input.contract == "tcpa"
  result := evaluate_tcpa(input)
}

evaluate_contract = result {
  input.contract == "recording"
  result := evaluate_recording(input)
}

evaluate_contract = result {
  input.contract == "stage_transition"
  result := evaluate_stage_transition(input)
}

evaluate_contract = {"allow": false, "message": "unknown contract"} {
  not input.contract
}

evaluate_contract = {"allow": false, "message": msg} {
  input.contract
  msg := sprintf("unsupported contract %q", [input.contract])
  not any_contract_matches
}

any_contract_matches {
  input.contract == "trid"
}
any_contract_matches {
  input.contract == "esign"
}
any_contract_matches {
  input.contract == "lock"
}
any_contract_matches {
  input.contract == "tcpa"
}
any_contract_matches {
  input.contract == "recording"
}
any_contract_matches {
  input.contract == "stage_transition"
}

# TRID: CD must be delivered and waiting period observed.
evaluate_trid(input) = {"allow": true} {
  input.disclosure_delivered
  input.waiting_period_days >= 3
  input.borrower_acknowledged
}

evaluate_trid(input) = {"allow": false, "message": msg} {
  not input.disclosure_delivered
  msg := "closing disclosure must be delivered"
}

evaluate_trid(input) = {"allow": false, "message": msg} {
  input.disclosure_delivered
  input.waiting_period_days < 3
  msg := "waiting period not met"
}

evaluate_trid(input) = {"allow": false, "message": msg} {
  input.disclosure_delivered
  input.waiting_period_days >= 3
  not input.borrower_acknowledged
  msg := "borrower acknowledgement required"
}

# E-Sign: all participants must consent and envelope status must be SENT/COMPLETED.
evaluate_esign(input) = {"allow": true} {
  consented := {p | p := input.participants[_]; p.consented}
  count(consented) == count(input.participants)
  input.envelope_status == "COMPLETED"
}

evaluate_esign(input) = {"allow": false, "message": "all participants must consent"} {
  exists := {p | p := input.participants[_]; p.consented}
  count(exists) != count(input.participants)
}

evaluate_esign(input) = {"allow": false, "message": msg} {
  consented := {p | p := input.participants[_]; p.consented}
  count(consented) == count(input.participants)
  msg := "envelope must be completed"
  input.envelope_status != "COMPLETED"
}

# Lock: ensure TRID window and pricing expiration.
evaluate_lock(input) = {"allow": true} {
  input.status == "ACTIVE"
  input.expires_at >= input.current_date
  not input.reprice_required
}

evaluate_lock(input) = {"allow": false, "message": "lock expired"} {
  input.expires_at < input.current_date
}

evaluate_lock(input) = {"allow": false, "message": "reprice required"} {
  input.reprice_required
}

# TCPA: ensure required consent is collected for every jurisdiction and the
# borrower has not opted out of contact attempts.
evaluate_tcpa(input) = {"allow": true} {
  not input.do_not_call
  required := tcpa_required_jurisdictions(input)
  consents := communication_consents(input)
  missing := {j | j := required[_]; not has_consent(consents, j)}
  count(missing) == 0
}

evaluate_tcpa(input) = {"allow": false, "message": "party is on the do not call list"} {
  input.do_not_call
}

evaluate_tcpa(input) = {"allow": false, "message": msg} {
  not input.do_not_call
  required := tcpa_required_jurisdictions(input)
  consents := communication_consents(input)
  missing := [j | j := required[_]; not has_consent(consents, j)]
  count(missing) > 0
  msg := sprintf("missing consent for %v", [sort(missing)])
}

tcpa_required_jurisdictions(input) = required {
  base := {"federal"}
  states := jurisdiction_set(object.get(input, "jurisdictions", []))
  required := base | states
}

# Recording: two-party jurisdictions require affirmative consent for recording
# on top of the universal federal consent requirement.
evaluate_recording(input) = {"allow": true} {
  not input.recording_enabled
}

evaluate_recording(input) = {"allow": true} {
  input.recording_enabled
  consents := recording_consents(input)
  required := recording_required_jurisdictions(input)
  missing := {j | j := required[_]; not has_consent(consents, j)}
  count(missing) == 0
}

evaluate_recording(input) = {"allow": false, "message": msg} {
  input.recording_enabled
  consents := recording_consents(input)
  required := recording_required_jurisdictions(input)
  missing := [j | j := required[_]; not has_consent(consents, j)]
  count(missing) > 0
  msg := sprintf("missing recording consent for %v", [sort(missing)])
}

recording_required_jurisdictions(input) = required {
  base := {"federal"}
  states := jurisdiction_set(object.get(input, "jurisdictions", []))
  required := base | {s | s := states[_]; recording_two_party_state(s)}
}

recording_two_party_state(state) {
  two_party_states[state]
}

two_party_states := {
  "ca": true,
  "ct": true,
  "fl": true,
  "il": true,
  "md": true,
  "ma": true,
  "mi": true,
  "mt": true,
  "nv": true,
  "nh": true,
  "pa": true,
  "wa": true,
}

# Workflow stage transitions enforce sequential movement and gate completion.
evaluate_stage_transition(input) = {"allow": true} {
  current := input.current_stage
  target := input.target_stage
  valid_stage(current)
  valid_stage(target)
  progression_allowed(current, target)
  missing := stage_missing_requirements(input, target)
  count(missing) == 0
}

evaluate_stage_transition(input) = {"allow": true} {
  current := input.current_stage
  target := input.target_stage
  valid_stage(current)
  target == current
}

evaluate_stage_transition(input) = {"allow": false, "message": msg} {
  current := input.current_stage
  target := input.target_stage
  not valid_stage(current)
  msg := sprintf("unknown workflow stage %q", [current])
}

evaluate_stage_transition(input) = {"allow": false, "message": msg} {
  target := input.target_stage
  not valid_stage(target)
  msg := sprintf("unknown workflow stage %q", [target])
}

evaluate_stage_transition(input) = {"allow": false, "message": msg} {
  current := input.current_stage
  target := input.target_stage
  valid_stage(current)
  valid_stage(target)
  not progression_allowed(current, target)
  msg := sprintf("invalid transition from %q to %q", [current, target])
}

evaluate_stage_transition(input) = {"allow": false, "message": msg} {
  current := input.current_stage
  target := input.target_stage
  valid_stage(current)
  valid_stage(target)
  progression_allowed(current, target)
  missing := stage_missing_requirements(input, target)
  count(missing) > 0
  msg := sprintf("workflow requirements missing: %v", [missing])
}

progression_allowed(current, target) {
  stage_index(target) == stage_index(current) + 1
}

stage_index(stage) = index {
  index := stage_index_map[stage]
}

stage_index_map := {
  "lead": 0,
  "application": 1,
  "processing": 2,
  "underwriting": 3,
  "closing": 4,
  "funded": 5,
}

valid_stage(stage) {
  stage_index_map[stage]
}

stage_missing_requirements(input, target) = missing {
  requirements := object.get(stage_requirement_map, target, [])
  conditions := object.get(input, "conditions", {})
  missing := [r |
    r := requirements[_]
    not condition_complete(conditions, r)
  ]
}

condition_complete(conditions, requirement) {
  value := conditions[requirement]
  value == true
}

stage_requirement_map := {
  "lead": [],
  "application": ["application_complete"],
  "processing": ["documents_received"],
  "underwriting": ["documents_received", "credit_verified"],
  "closing": ["clear_to_close", "disclosures_signed"],
  "funded": ["clear_to_close", "funding_authorized"],
}

communication_consents(input) = object.get(input, "communication_consents", {})

recording_consents(input) = object.get(input, "recording_consents", {})

jurisdiction_set(items) = {normalize_jurisdiction(item) | item := items[_]}

normalize_jurisdiction(item) = lower(item) {
  is_string(item)
}

normalize_jurisdiction(item) = item {
  not is_string(item)
}

has_consent(consents, jurisdiction) {
  value := consents[jurisdiction]
  value == true
}
