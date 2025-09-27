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
