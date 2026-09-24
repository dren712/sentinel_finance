/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sentinel.json`.
 */
export type Sentinel = {
  "address": "3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK",
  "metadata": {
    "name": "sentinel",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Sentinel Finance On-Chain Postcondition Enforcement Program"
  },
  "instructions": [
    {
      "name": "createPromise",
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
                "path": "promiseId"
              }
            ]
          }
        },
        {
          "name": "agent"
        },
        {
          "name": "policy"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "promiseId",
          "type": "string"
        },
        {
          "name": "intentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "tradeAssetMint",
          "type": "pubkey"
        },
        {
          "name": "tradeDirection",
          "type": "u8"
        },
        {
          "name": "tradeAmountUsd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "executeGuardedTrade",
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
                "account": "promiseAccount"
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
                "account": "portfolioVault"
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
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "tradeAmountCents",
          "type": "u64"
        },
        {
          "name": "executionPriceCents",
          "type": "u64"
        },
        {
          "name": "quotedPriceCents",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeAgent",
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
                "path": "agentId"
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": "string"
        },
        {
          "name": "portfolioId",
          "type": "string"
        },
        {
          "name": "agentAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializePolicy",
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maxSingleAssetBps",
          "type": "u16"
        },
        {
          "name": "minStablecoinBps",
          "type": "u16"
        },
        {
          "name": "maxTradeValueUsd",
          "type": "u64"
        },
        {
          "name": "maxSlippageBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeVault",
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "usdcBalanceCents",
          "type": "u64"
        },
        {
          "name": "positions",
          "type": {
            "vec": {
              "defined": {
                "name": "assetPosition"
              }
            }
          }
        }
      ]
    },
    {
      "name": "recordEvidence",
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
          "name": "agent"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "evidenceId",
          "type": "string"
        },
        {
          "name": "preStateHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "postStateHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "verificationResult",
          "type": "u8"
        },
        {
          "name": "failureCode",
          "type": "u16"
        }
      ]
    },
    {
      "name": "setAgentActive",
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
                "account": "agentAccount"
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
          "name": "isActive",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updatePolicy",
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
          "name": "maxSingleAssetBps",
          "type": "u16"
        },
        {
          "name": "minStablecoinBps",
          "type": "u16"
        },
        {
          "name": "maxTradeValueUsd",
          "type": "u64"
        },
        {
          "name": "maxSlippageBps",
          "type": "u16"
        },
        {
          "name": "isActive",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agentAccount",
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
      "name": "evidenceAccount",
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
      "name": "policyAccount",
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
      "name": "portfolioVault",
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
      "name": "promiseAccount",
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
      "name": "agentInitializedEvent",
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
      "name": "agentStatusUpdatedEvent",
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
      "name": "evidenceRecordedEvent",
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
      "name": "policyUpdatedEvent",
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
      "name": "promiseCreatedEvent",
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
      "name": "tradeSettledEvent",
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
      "name": "vaultInitializedEvent",
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
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "exposureExceeded",
      "msg": "Post-trade single-asset exposure exceeds maximum allowed by policy"
    },
    {
      "code": 6001,
      "name": "stablecoinReserveBreached",
      "msg": "Post-trade stablecoin reserve breaches minimum required threshold"
    },
    {
      "code": 6002,
      "name": "tradeSizeExceeded",
      "msg": "Proposed trade size exceeds policy maximum"
    },
    {
      "code": 6003,
      "name": "slippageExceeded",
      "msg": "Execution price slippage exceeds policy tolerance"
    },
    {
      "code": 6004,
      "name": "policyInactive",
      "msg": "The specified policy is inactive"
    },
    {
      "code": 6005,
      "name": "unauthorizedAgent",
      "msg": "The caller is not authorized as the agent authority"
    },
    {
      "code": 6006,
      "name": "unauthorizedExecution",
      "msg": "The caller is not authorized to execute this promise"
    },
    {
      "code": 6007,
      "name": "invalidPromiseStatus",
      "msg": "Promise is not in a valid state for execution"
    },
    {
      "code": 6008,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow or division by zero in postcondition calculation"
    },
    {
      "code": 6009,
      "name": "invalidPolicyBounds",
      "msg": "Policy basis points must be between 0 and 10,000"
    },
    {
      "code": 6010,
      "name": "assetNotFound",
      "msg": "Target asset mint not found in portfolio vault"
    },
    {
      "code": 6011,
      "name": "insufficientStablecoinReserve",
      "msg": "Vault does not have sufficient stablecoin balance to fund trade"
    },
    {
      "code": 6012,
      "name": "promiseExpired",
      "msg": "Promise has expired and can no longer be executed"
    },
    {
      "code": 6013,
      "name": "securityDomainMismatch",
      "msg": "Security domain mismatch: Agent, Policy, and Vault must share the same owner"
    },
    {
      "code": 6014,
      "name": "agentInactive",
      "msg": "The agent account is currently paused or inactive"
    },
    {
      "code": 6015,
      "name": "tradeAmountMismatch",
      "msg": "Executed trade amount does not match the authorized promise amount"
    },
    {
      "code": 6016,
      "name": "invalidTradeDirection",
      "msg": "Invalid trade direction: only 0 (BUY) and 1 (SELL) are permitted"
    },
    {
      "code": 6017,
      "name": "invalidPrice",
      "msg": "Missing, zero, or invalid market price: execution fails closed"
    }
  ],
  "types": [
    {
      "name": "agentAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "agentAuthority",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          },
          {
            "name": "portfolioId",
            "type": "string"
          },
          {
            "name": "isActive",
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
      "name": "agentInitializedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "agentAuthority",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "agentStatusUpdatedEvent",
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
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "assetPosition",
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
            "name": "amountUnits",
            "type": "u64"
          },
          {
            "name": "priceCents",
            "type": "u64"
          },
          {
            "name": "isIndex",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "evidenceAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "evidenceId",
            "type": "string"
          },
          {
            "name": "promise",
            "type": "pubkey"
          },
          {
            "name": "preStateHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "postStateHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "verificationResult",
            "type": "u8"
          },
          {
            "name": "failureCode",
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
      "name": "evidenceRecordedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "evidenceId",
            "type": "string"
          },
          {
            "name": "promise",
            "type": "pubkey"
          },
          {
            "name": "verificationResult",
            "type": "u8"
          },
          {
            "name": "failureCode",
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
      "name": "policyAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "maxSingleAssetBps",
            "type": "u16"
          },
          {
            "name": "minStablecoinBps",
            "type": "u16"
          },
          {
            "name": "maxTradeValueUsd",
            "type": "u64"
          },
          {
            "name": "maxSlippageBps",
            "type": "u16"
          },
          {
            "name": "policyVersion",
            "type": "u32"
          },
          {
            "name": "isActive",
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
      "name": "policyUpdatedEvent",
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
            "name": "maxSingleAssetBps",
            "type": "u16"
          },
          {
            "name": "minStablecoinBps",
            "type": "u16"
          },
          {
            "name": "maxTradeValueUsd",
            "type": "u64"
          },
          {
            "name": "maxSlippageBps",
            "type": "u16"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "portfolioVault",
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
            "name": "usdcBalanceCents",
            "type": "u64"
          },
          {
            "name": "totalValueCents",
            "type": "u64"
          },
          {
            "name": "positions",
            "type": {
              "vec": {
                "defined": {
                  "name": "assetPosition"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "promiseAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "promiseId",
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
            "name": "intentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "tradeAssetMint",
            "type": "pubkey"
          },
          {
            "name": "tradeDirection",
            "type": "u8"
          },
          {
            "name": "tradeAmountUsd",
            "type": "u64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
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
      "name": "promiseCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "promiseId",
            "type": "string"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "tradeAssetMint",
            "type": "pubkey"
          },
          {
            "name": "tradeDirection",
            "type": "u8"
          },
          {
            "name": "tradeAmountUsd",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tradeSettledEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "promiseId",
            "type": "string"
          },
          {
            "name": "postTotalUsd",
            "type": "u64"
          },
          {
            "name": "postStableUsd",
            "type": "u64"
          },
          {
            "name": "postTargetUsd",
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
      "name": "vaultInitializedEvent",
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
            "name": "totalValueCents",
            "type": "u64"
          },
          {
            "name": "usdcBalanceCents",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
