export const SENTINEL_IDL = {
  "address": "3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH",
  "metadata": {
    "name": "sentinel",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Sentinel Finance On-Chain Postcondition Enforcement Program"
  },
  "instructions": [
    {
      "name": "create_promise",
      "docs": [
        "Registers a state transition promise from an authorized agent"
      ],
      "discriminator": [
        233,
        170,
        35,
        24,
        34,
        120,
        82,
        200
      ],
      "accounts": [
        {
          "name": "promise",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  109,
                  105,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "arg",
                "path": "promise_id"
              }
            ]
          }
        },
        {
          "name": "agent"
        },
        {
          "name": "policy",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.owner",
                "account": "AgentAccount"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "promise_id",
          "type": "string"
        },
        {
          "name": "intent_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "trade_asset_mint",
          "type": "pubkey"
        },
        {
          "name": "trade_direction",
          "type": "u8"
        },
        {
          "name": "trade_amount_usd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "execute_guarded_trade",
      "docs": [
        "Authoritatively executes a trade on the on-chain PortfolioVault and enforces postconditions.",
        "Mutates the vault directly and computes resulting exposure from actual positions.",
        "Reverts atomically if ANY postcondition is breached."
      ],
      "discriminator": [
        173,
        223,
        79,
        146,
        151,
        58,
        98,
        99
      ],
      "accounts": [
        {
          "name": "promise",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  109,
                  105,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "account",
                "path": "promise.promise_id",
                "account": "PromiseAccount"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "PortfolioVault"
              }
            ]
          }
        },
        {
          "name": "agent",
          "relations": [
            "promise"
          ]
        },
        {
          "name": "policy",
          "relations": [
            "promise",
            "vault"
          ]
        },
        {
          "name": "price_update"
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "trade_amount_cents",
          "type": "u64"
        },
        {
          "name": "execution_price_cents",
          "type": "u64"
        },
        {
          "name": "_quoted_price_cents",
          "type": "u64"
        }
      ]
    },
    {
      "name": "expire_quarantine",
      "docs": [
        "Permissionlessly marks quarantine as expired if recovery window has passed."
      ],
      "discriminator": [
        251,
        89,
        11,
        22,
        81,
        228,
        211,
        45
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "PortfolioVault"
              }
            ]
          }
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "flag_violation",
      "docs": [
        "Flags a policy violation on an active vault based on verified Pyth pricing.",
        "Permissionless: any caller can submit with a verified Pyth price update account."
      ],
      "discriminator": [
        81,
        7,
        183,
        88,
        235,
        179,
        75,
        242
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "PortfolioVault"
              }
            ]
          }
        },
        {
          "name": "policy",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "price_update"
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initialize_agent",
      "docs": [
        "Initializes a new autonomous portfolio agent account bound to the owner"
      ],
      "discriminator": [
        212,
        81,
        156,
        211,
        212,
        110,
        21,
        28
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "agent_id"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agent_id",
          "type": "string"
        },
        {
          "name": "portfolio_id",
          "type": "string"
        },
        {
          "name": "agent_authority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initialize_policy",
      "docs": [
        "Initializes the user's financial policy with bounded, machine-checkable guarantees"
      ],
      "discriminator": [
        9,
        186,
        86,
        225,
        129,
        162,
        231,
        56
      ],
      "accounts": [
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "max_single_asset_bps",
          "type": "u16"
        },
        {
          "name": "min_stablecoin_bps",
          "type": "u16"
        },
        {
          "name": "max_trade_value_usd",
          "type": "u64"
        },
        {
          "name": "max_slippage_bps",
          "type": "u16"
        },
        {
          "name": "confirm_slots",
          "type": "u64"
        },
        {
          "name": "recovery_window_slots",
          "type": "u64"
        },
        {
          "name": "max_recovery_cost_bps",
          "type": "u16"
        },
        {
          "name": "max_bounty_bps",
          "type": "u16"
        },
        {
          "name": "safe_destination",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initialize_vault",
      "docs": [
        "Initializes a controlled on-chain PortfolioVault account with verified balances"
      ],
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "policy"
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "usdc_balance_cents",
          "type": "u64"
        },
        {
          "name": "positions",
          "type": {
            "vec": {
              "defined": {
                "name": "AssetPosition"
              }
            }
          }
        }
      ]
    },
    {
      "name": "owner_release",
      "docs": [
        "Owner releases the vault from any status back to Active.",
        "Resets pending violation and increments recovery_nonce to invalidate in-flight recoveries."
      ],
      "discriminator": [
        22,
        121,
        199,
        43,
        211,
        92,
        186,
        17
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "record_evidence",
      "docs": [
        "Anchors an immutable PROVN evidence record on-chain"
      ],
      "discriminator": [
        253,
        55,
        82,
        184,
        77,
        64,
        217,
        167
      ],
      "accounts": [
        {
          "name": "evidence",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  118,
                  105,
                  100,
                  101,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "promise"
              }
            ]
          }
        },
        {
          "name": "promise"
        },
        {
          "name": "agent",
          "relations": [
            "promise"
          ]
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "evidence_id",
          "type": "string"
        },
        {
          "name": "pre_state_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "post_state_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "verification_result",
          "type": "u8"
        },
        {
          "name": "failure_code",
          "type": "u16"
        }
      ]
    },
    {
      "name": "recover",
      "docs": [
        "Solves an invariant breach on a quarantined vault via permissionless, reduce-only rebalancing."
      ],
      "discriminator": [
        108,
        216,
        38,
        58,
        109,
        146,
        116,
        17
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "PortfolioVault"
              }
            ]
          }
        },
        {
          "name": "policy",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "price_update"
        },
        {
          "name": "solver",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "sell_units",
          "type": "u64"
        },
        {
          "name": "expected_nonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "reject_promise",
      "docs": [
        "Marks a promise as rejected on-chain when risk postconditions or policy checks fail"
      ],
      "discriminator": [
        156,
        218,
        29,
        144,
        96,
        170,
        24,
        128
      ],
      "accounts": [
        {
          "name": "promise",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  109,
                  105,
                  115,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "account",
                "path": "promise.promise_id",
                "account": "PromiseAccount"
              }
            ]
          }
        },
        {
          "name": "agent",
          "relations": [
            "promise"
          ]
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "failure_code",
          "type": "u16"
        }
      ]
    },
    {
      "name": "set_agent_active",
      "docs": [
        "Updates the operational status of an agent (kill-switch for emergency pause)"
      ],
      "discriminator": [
        89,
        168,
        250,
        105,
        254,
        69,
        246,
        221
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "agent.agent_id",
                "account": "AgentAccount"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agent"
          ]
        }
      ],
      "args": [
        {
          "name": "is_active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "sync_vault",
      "docs": [
        "Synchronizes an existing PortfolioVault account with owner-verified positions"
      ],
      "discriminator": [
        19,
        211,
        150,
        118,
        94,
        208,
        138,
        204
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": [
        {
          "name": "usdc_balance_cents",
          "type": "u64"
        },
        {
          "name": "positions",
          "type": {
            "vec": {
              "defined": {
                "name": "AssetPosition"
              }
            }
          }
        }
      ]
    },
    {
      "name": "update_policy",
      "docs": [
        "Updates existing policy constraints, incrementing policy version"
      ],
      "discriminator": [
        212,
        245,
        246,
        7,
        163,
        151,
        18,
        57
      ],
      "accounts": [
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "policy"
          ]
        }
      ],
      "args": [
        {
          "name": "max_single_asset_bps",
          "type": "u16"
        },
        {
          "name": "min_stablecoin_bps",
          "type": "u16"
        },
        {
          "name": "max_trade_value_usd",
          "type": "u64"
        },
        {
          "name": "max_slippage_bps",
          "type": "u16"
        },
        {
          "name": "confirm_slots",
          "type": "u64"
        },
        {
          "name": "recovery_window_slots",
          "type": "u64"
        },
        {
          "name": "max_recovery_cost_bps",
          "type": "u16"
        },
        {
          "name": "max_bounty_bps",
          "type": "u16"
        },
        {
          "name": "safe_destination",
          "type": "pubkey"
        },
        {
          "name": "is_active",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "AgentAccount",
      "discriminator": [
        241,
        119,
        69,
        140,
        233,
        9,
        112,
        50
      ]
    },
    {
      "name": "EvidenceAccount",
      "discriminator": [
        157,
        153,
        108,
        59,
        192,
        219,
        204,
        95
      ]
    },
    {
      "name": "PolicyAccount",
      "discriminator": [
        218,
        201,
        183,
        164,
        156,
        127,
        81,
        175
      ]
    },
    {
      "name": "PortfolioVault",
      "discriminator": [
        83,
        117,
        92,
        138,
        212,
        234,
        242,
        206
      ]
    },
    {
      "name": "PromiseAccount",
      "discriminator": [
        27,
        95,
        98,
        230,
        189,
        135,
        138,
        206
      ]
    }
  ],
  "events": [
    {
      "name": "AgentInitializedEvent",
      "discriminator": [
        7,
        218,
        129,
        38,
        47,
        93,
        84,
        74
      ]
    },
    {
      "name": "AgentStatusUpdatedEvent",
      "discriminator": [
        70,
        54,
        79,
        148,
        85,
        19,
        2,
        212
      ]
    },
    {
      "name": "EvidenceRecordedEvent",
      "discriminator": [
        48,
        42,
        92,
        219,
        173,
        125,
        42,
        116
      ]
    },
    {
      "name": "PolicyUpdatedEvent",
      "discriminator": [
        209,
        11,
        92,
        137,
        96,
        71,
        84,
        243
      ]
    },
    {
      "name": "PromiseCreatedEvent",
      "discriminator": [
        126,
        137,
        45,
        169,
        218,
        65,
        227,
        221
      ]
    },
    {
      "name": "PromiseRejectedEvent",
      "discriminator": [
        237,
        200,
        211,
        76,
        157,
        2,
        25,
        151
      ]
    },
    {
      "name": "QuarantineExpiredEvent",
      "discriminator": [
        71,
        233,
        80,
        101,
        142,
        15,
        90,
        242
      ]
    },
    {
      "name": "RecoveryExecutedEvent",
      "discriminator": [
        186,
        69,
        18,
        177,
        169,
        8,
        24,
        38
      ]
    },
    {
      "name": "TradeSettledEvent",
      "discriminator": [
        20,
        94,
        31,
        101,
        105,
        148,
        236,
        120
      ]
    },
    {
      "name": "VaultInitializedEvent",
      "discriminator": [
        203,
        214,
        91,
        5,
        185,
        248,
        192,
        149
      ]
    },
    {
      "name": "VaultQuarantinedEvent",
      "discriminator": [
        201,
        77,
        183,
        35,
        215,
        115,
        151,
        207
      ]
    },
    {
      "name": "VaultReleasedEvent",
      "discriminator": [
        2,
        209,
        149,
        219,
        204,
        98,
        19,
        14
      ]
    },
    {
      "name": "ViolationClearedEvent",
      "discriminator": [
        75,
        0,
        230,
        123,
        138,
        234,
        26,
        197
      ]
    },
    {
      "name": "ViolationPendingEvent",
      "discriminator": [
        107,
        56,
        113,
        6,
        32,
        103,
        104,
        10
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ExposureExceeded",
      "msg": "Post-trade single-asset exposure exceeds maximum allowed by policy"
    },
    {
      "code": 6001,
      "name": "StablecoinReserveBreached",
      "msg": "Post-trade stablecoin reserve breaches minimum required threshold"
    },
    {
      "code": 6002,
      "name": "TradeSizeExceeded",
      "msg": "Proposed trade size exceeds policy maximum"
    },
    {
      "code": 6003,
      "name": "SlippageExceeded",
      "msg": "Execution price slippage exceeds policy tolerance"
    },
    {
      "code": 6004,
      "name": "PolicyInactive",
      "msg": "The specified policy is inactive"
    },
    {
      "code": 6005,
      "name": "UnauthorizedAgent",
      "msg": "The caller is not authorized as the agent authority"
    },
    {
      "code": 6006,
      "name": "UnauthorizedExecution",
      "msg": "The caller is not authorized to execute this promise"
    },
    {
      "code": 6007,
      "name": "InvalidPromiseStatus",
      "msg": "Promise is not in a valid state for execution"
    },
    {
      "code": 6008,
      "name": "MathOverflow",
      "msg": "Arithmetic overflow or division by zero in postcondition calculation"
    },
    {
      "code": 6009,
      "name": "InvalidPolicyBounds",
      "msg": "Policy basis points must be between 0 and 10,000"
    },
    {
      "code": 6010,
      "name": "AssetNotFound",
      "msg": "Target asset mint not found in portfolio vault"
    },
    {
      "code": 6011,
      "name": "InsufficientStablecoinReserve",
      "msg": "Vault does not have sufficient stablecoin balance to fund trade"
    },
    {
      "code": 6012,
      "name": "PromiseExpired",
      "msg": "Promise has expired and can no longer be executed"
    },
    {
      "code": 6013,
      "name": "SecurityDomainMismatch",
      "msg": "Security domain mismatch: Agent, Policy, and Vault must share the same owner"
    },
    {
      "code": 6014,
      "name": "AgentInactive",
      "msg": "The agent account is currently paused or inactive"
    },
    {
      "code": 6015,
      "name": "TradeAmountMismatch",
      "msg": "Executed trade amount does not match the authorized promise amount"
    },
    {
      "code": 6016,
      "name": "InvalidTradeDirection",
      "msg": "Invalid trade direction: only 0 (BUY) and 1 (SELL) are permitted"
    },
    {
      "code": 6017,
      "name": "InvalidPrice",
      "msg": "Missing, zero, or invalid market price: execution fails closed"
    },
    {
      "code": 6018,
      "name": "StaleOraclePrice",
      "msg": "Pyth oracle quote is older than 60s maximum allowed age"
    },
    {
      "code": 6019,
      "name": "WideConfidenceInterval",
      "msg": "Pyth oracle confidence interval is wider than allowable threshold"
    },
    {
      "code": 6020,
      "name": "MismatchedFeedId",
      "msg": "Pyth price feed ID does not match the target asset mint feed"
    },
    {
      "code": 6021,
      "name": "FeedMismatch",
      "msg": "Pyth price feed ID does not match the stored feed ID for this asset"
    },
    {
      "code": 6022,
      "name": "StaleOracle",
      "msg": "Pyth oracle price is stale (> 60 seconds)"
    },
    {
      "code": 6023,
      "name": "ConfidenceTooWide",
      "msg": "Pyth oracle confidence interval is wider than policy tolerance"
    },
    {
      "code": 6024,
      "name": "UnverifiedPrice",
      "msg": "Price account is not verified by Pyth or has invalid verification level/owner"
    },
    {
      "code": 6025,
      "name": "VaultNotActive",
      "msg": "Vault is not in active state"
    },
    {
      "code": 6026,
      "name": "VaultNotQuarantined",
      "msg": "Vault is not in quarantined state"
    },
    {
      "code": 6027,
      "name": "NoViolation",
      "msg": "No policy violation detected for vault"
    },
    {
      "code": 6028,
      "name": "ViolationNotConfirmed",
      "msg": "Violation has not persisted across confirmation slots"
    },
    {
      "code": 6029,
      "name": "RecoveryNotExpired",
      "msg": "Recovery window has not expired yet"
    },
    {
      "code": 6030,
      "name": "RecoveryWindowClosed",
      "msg": "Recovery window has expired or is not open"
    },
    {
      "code": 6031,
      "name": "StaleRecoveryNonce",
      "msg": "Provided recovery nonce does not match current vault recovery nonce"
    },
    {
      "code": 6032,
      "name": "ValueConservationBreached",
      "msg": "Recovery violates portfolio value conservation bounds"
    },
    {
      "code": 6033,
      "name": "PostconditionFailed",
      "msg": "Recovery failed to restore compliant portfolio policy invariants"
    },
    {
      "code": 6034,
      "name": "OversellGuard",
      "msg": "Recovery sold beyond allowed oversell band"
    },
    {
      "code": 6035,
      "name": "InvalidAmount",
      "msg": "Recovery sell amount is zero or exceeds position holdings"
    }
  ],
  "types": [
    {
      "name": "AgentAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "agent_authority",
            "type": "pubkey"
          },
          {
            "name": "agent_id",
            "type": "string"
          },
          {
            "name": "portfolio_id",
            "type": "string"
          },
          {
            "name": "is_active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "AgentInitializedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "agent_authority",
            "type": "pubkey"
          },
          {
            "name": "agent_id",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "AgentStatusUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "is_active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "AssetPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "symbol",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "amount_units",
            "type": "u64"
          },
          {
            "name": "price_cents",
            "type": "u64"
          },
          {
            "name": "is_index",
            "type": "bool"
          },
          {
            "name": "feed_id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "EvidenceAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "evidence_id",
            "type": "string"
          },
          {
            "name": "promise",
            "type": "pubkey"
          },
          {
            "name": "pre_state_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "post_state_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "verification_result",
            "type": "u8"
          },
          {
            "name": "failure_code",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "EvidenceRecordedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "evidence_id",
            "type": "string"
          },
          {
            "name": "promise",
            "type": "pubkey"
          },
          {
            "name": "verification_result",
            "type": "u8"
          },
          {
            "name": "failure_code",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "PolicyAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "max_single_asset_bps",
            "type": "u16"
          },
          {
            "name": "min_stablecoin_bps",
            "type": "u16"
          },
          {
            "name": "max_trade_value_usd",
            "type": "u64"
          },
          {
            "name": "max_slippage_bps",
            "type": "u16"
          },
          {
            "name": "policy_version",
            "type": "u32"
          },
          {
            "name": "is_active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "confirm_slots",
            "type": "u64"
          },
          {
            "name": "recovery_window_slots",
            "type": "u64"
          },
          {
            "name": "max_recovery_cost_bps",
            "type": "u16"
          },
          {
            "name": "max_bounty_bps",
            "type": "u16"
          },
          {
            "name": "safe_destination",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "PolicyUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "version",
            "type": "u32"
          },
          {
            "name": "max_single_asset_bps",
            "type": "u16"
          },
          {
            "name": "min_stablecoin_bps",
            "type": "u16"
          },
          {
            "name": "max_trade_value_usd",
            "type": "u64"
          },
          {
            "name": "max_slippage_bps",
            "type": "u16"
          },
          {
            "name": "is_active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "PortfolioVault",
      "docs": [
        "PortfolioVault:",
        "The Sentinel PDA representing the on-chain Portfolio Configuration and Execution Authority.",
        "Under Phase 3 (Real Portfolio State Architecture):",
        "- Policy Authority: bound to `policy` account enforcing mathematical invariants",
        "- Portfolio Configuration: tracks owner, tracked mints, and projected total valuation",
        "- Execution Authority: governs guarded trade execution via PDA seeds [b\"vault\", owner.key()]",
        "- Promise Registry: bound to PromiseAccount state transition locks",
        "- Evidence Anchor: bound to EvidenceAccount immutable PROVN records",
        "While actual assets remain native Solana SPL tokens held in user-owned ATAs."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "usdc_balance_cents",
            "type": "u64"
          },
          {
            "name": "total_value_cents",
            "type": "u64"
          },
          {
            "name": "positions",
            "type": {
              "vec": {
                "defined": {
                  "name": "AssetPosition"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "VaultStatus"
              }
            }
          },
          {
            "name": "pending_violation_slot",
            "type": "u64"
          },
          {
            "name": "quarantine_slot",
            "type": "u64"
          },
          {
            "name": "recovery_expires_slot",
            "type": "u64"
          },
          {
            "name": "recovery_nonce",
            "type": "u64"
          },
          {
            "name": "last_recovery_slot",
            "type": "u64"
          },
          {
            "name": "last_recovery_solver",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "PromiseAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "promise_id",
            "type": "string"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "intent_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "trade_asset_mint",
            "type": "pubkey"
          },
          {
            "name": "trade_direction",
            "type": "u8"
          },
          {
            "name": "trade_amount_usd",
            "type": "u64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "expires_at",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "PromiseCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "promise_id",
            "type": "string"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "trade_asset_mint",
            "type": "pubkey"
          },
          {
            "name": "trade_direction",
            "type": "u8"
          },
          {
            "name": "trade_amount_usd",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "PromiseRejectedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "promise_id",
            "type": "string"
          },
          {
            "name": "failure_code",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "QuarantineExpiredEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "recovery_nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "RecoveryExecutedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "solver",
            "type": "pubkey"
          },
          {
            "name": "sell_units",
            "type": "u64"
          },
          {
            "name": "proceeds_cents",
            "type": "u64"
          },
          {
            "name": "pre_exposure_bps",
            "type": "u16"
          },
          {
            "name": "post_exposure_bps",
            "type": "u16"
          },
          {
            "name": "pre_total_cents",
            "type": "u64"
          },
          {
            "name": "post_total_cents",
            "type": "u64"
          },
          {
            "name": "new_nonce",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "bounty_cap_cents",
            "docs": [
              "SIMULATED / NOT PAID: Solver bounty ceiling calculated against policy.max_bounty_bps"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "TradeSettledEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "promise_id",
            "type": "string"
          },
          {
            "name": "post_total_usd",
            "type": "u64"
          },
          {
            "name": "post_stable_usd",
            "type": "u64"
          },
          {
            "name": "post_target_usd",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "VaultInitializedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "total_value_cents",
            "type": "u64"
          },
          {
            "name": "usdc_balance_cents",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "VaultQuarantinedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "quarantine_slot",
            "type": "u64"
          },
          {
            "name": "recovery_expires_slot",
            "type": "u64"
          },
          {
            "name": "recovery_nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "VaultReleasedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "recovery_nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "VaultStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Active"
          },
          {
            "name": "Quarantined"
          },
          {
            "name": "RecoveryExpired"
          }
        ]
      }
    },
    {
      "name": "ViolationClearedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ViolationPendingEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    }
  ]
} as const;
