package blp.policy

import data.blp.policy

trid_allows_when_waiting_period_satisfied {
  allow with input as {
    "contract": "trid",
    "disclosure_delivered": true,
    "waiting_period_days": 3,
    "borrower_acknowledged": true,
  }
}

trid_denies_when_waiting_period_short {
  not allow with input as {
    "contract": "trid",
    "disclosure_delivered": true,
    "waiting_period_days": 2,
    "borrower_acknowledged": true,
  }
  deny[msg] with input as {
    "contract": "trid",
    "disclosure_delivered": true,
    "waiting_period_days": 2,
    "borrower_acknowledged": true,
  }
  msg == "waiting period not met"
}

esign_requires_consent {
  not allow with input as {
    "contract": "esign",
    "participants": [
      {"name": "Borrower", "consented": true},
      {"name": "Co", "consented": false},
    ],
    "envelope_status": "COMPLETED",
  }
}

esign_allows_when_complete {
  allow with input as {
    "contract": "esign",
    "participants": [
      {"name": "Borrower", "consented": true},
    ],
    "envelope_status": "COMPLETED",
  }
}

lock_denies_on_expiration {
  not allow with input as {
    "contract": "lock",
    "status": "ACTIVE",
    "expires_at": "2024-01-01",
    "current_date": "2024-01-02",
    "reprice_required": false,
  }
  deny[msg] with input as {
    "contract": "lock",
    "status": "ACTIVE",
    "expires_at": "2024-01-01",
    "current_date": "2024-01-02",
    "reprice_required": false,
  }
  msg == "lock expired"
}
