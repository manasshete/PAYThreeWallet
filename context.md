# Pay3 Context

## Overview

Pay3 is an AI-native financial infrastructure platform built on the Stellar ecosystem.

Instead of building another crypto wallet, Pay3 acts as the bridge between AI agents and blockchain finance through an MCP (Model Context Protocol) server.

The vision is to allow AI assistants like Claude, ChatGPT, Gemini, and Cursor to securely manage wallets, interact with DeFi, and make payments on behalf of users while operating within strict user-defined policies.

---

# Problem

Current AI assistants cannot directly perform financial actions.

Users still need to:

- Open their wallet
- Copy wallet addresses
- Approve every transaction manually
- Switch between multiple DeFi protocols
- Manage investments themselves

Existing wallets are designed for humans, not autonomous AI agents.

---

# Solution

Pay3 provides an MCP Server that exposes financial tools to AI assistants.

Example:

User:
> "Claude, pay 0.008 XLM to Hurain."

Claude

↓

Calls Pay3 MCP Tool

↓

Policy Validation

↓

Session Key Authorization

↓

Transaction executes on Stellar

The AI never has access to the user's private key.

---

# Vision

Become the operating system for autonomous AI commerce on Stellar.

Instead of humans manually managing wallets, AI agents become trusted financial assistants operating inside programmable policies.

---

# Core Features

## AI Wallet

- Autonomous wallet management
- User always owns the wallet
- AI receives delegated permissions only
- No private key exposure

---

## MCP Server

The heart of Pay3.

Provides tools that AI assistants can call.

Example tools:

- wallet.get_balance()
- wallet.transfer()
- wallet.swap()
- wallet.supply()
- wallet.borrow()
- wallet.claim_rewards()
- payments.payMerchant()
- portfolio.rebalance()

Compatible with:

- Claude Desktop
- ChatGPT
- Cursor
- Gemini
- Any MCP-compatible client

---

## Session Keys

Uses Soroban Custom Authentication.

Instead of giving AI the wallet's private key, Pay3 creates temporary delegated permissions.

Example:

Duration:
24 Hours

Maximum Spend:
500 USDC per transaction

Daily Budget:
2,000 USDC

Allowed Protocols:

- Blend
- Phoenix
- Aquarius

Blocked Actions:

- Withdraw Funds
- Unknown Smart Contracts
- NFT Purchases

If the AI attempts something outside the policy, the transaction is rejected.

---

## Policy Engine

Every transaction passes through the Policy Engine.

Checks include:

- Daily budget
- Per transaction limit
- Allowed protocols
- Allowed smart contracts
- Allowed assets
- Allowed actions
- Session expiration
- Rate limits

Only valid transactions are executed.

---

# Transaction Flow

User

↓

AI Assistant

↓

Pay3 MCP Server

↓

Policy Engine

↓

Session Manager

↓

Transaction Engine

↓

Soroban Smart Contract

↓

Stellar Network

---

# DeFi Integrations

## Blend

Purpose:

- Lending
- Borrowing
- Auto repayment
- Health monitoring

AI can:

- Supply assets
- Borrow assets
- Repay loans
- Prevent liquidation

---

## Phoenix

Purpose:

Token swaps.

AI can:

- Swap XLM
- Swap USDC
- Portfolio rebalancing

---

## Aquarius

Purpose:

Liquidity management.

AI can:

- Add liquidity
- Remove liquidity
- Claim rewards
- Optimize APY

---

# Merchant Payments

AI can make payments directly.

Example:

Restaurant AI

↓

Orders vegetables

↓

Pay3 validates policy

↓

USDC transferred

↓

Supplier receives payment

Future support:

- Subscription payments
- Vendor payments
- API payments
- SaaS billing

---

# Procurement Automation

Long-term vision.

Workflow:

Business needs inventory

↓

AI discovers suppliers

↓

Collects quotes

↓

Compares structured data

↓

Recommends supplier

↓

Human approval

↓

Smart Contract Escrow

↓

Delivery confirmation

↓

Automatic payment

---

# Security

Security is Pay3's primary feature.

The AI:

❌ Cannot access the private key

❌ Cannot exceed spending limits

❌ Cannot use unknown contracts

❌ Cannot transfer outside policies

✅ Can only execute approved actions

Every transaction is validated before execution.

---

# Why Stellar

Stellar provides:

- Very low transaction fees
- Fast settlement
- Native USDC support
- Soroban smart contracts
- Custom Authentication
- Session Keys

Low fees make AI micro-transactions economically possible.

Examples:

- Auto compounding
- Frequent portfolio rebalancing
- Small recurring payments
- Automated DeFi optimization

---

# Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

---

## Backend

- Node.js
- Fastify
- TypeScript

---

## AI Layer

- Model Context Protocol (MCP)
- Official MCP TypeScript SDK

---

## Blockchain

- Stellar
- Soroban
- Stellar JavaScript SDK

---

## Authentication

- Soroban Custom Auth
- Session Keys

---

## Database

- PostgreSQL
- Prisma ORM

---

## Cache

- Redis

---

## Infrastructure

- Docker
- AWS
- GitHub Actions

---

## Monitoring

- OpenTelemetry
- Grafana
- Prometheus

---

# High-Level Architecture

                   Next.js Dashboard
                           │
                           ▼
                Fastify Backend API
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    MCP Server      Policy Engine     Wallet Service
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                 Transaction Engine
                           │
                 Stellar JavaScript SDK
                           │
                           ▼
                Soroban Smart Contracts
                           │
                           ▼
                    Stellar Network
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
       Blend           Phoenix          Aquarius

---

# Example User Commands

"Claude, pay 5 USDC to John."

"Swap 100 XLM to USDC."

"Invest my idle USDC in the highest yield protocol."

"Rebalance my portfolio."

"Repay my loan before liquidation."

"Pay my API subscription."

---

# Future Roadmap

Phase 1

- AI Wallet
- Session Keys
- Policy Engine
- MCP Server

Phase 2

- Agentic DeFi
- Yield Aggregation
- Auto Rebalancing
- Lending Automation

Phase 3

- Merchant Payments
- Subscription Billing
- Vendor Payments

Phase 4

- Procurement Operating System
- Smart Contract Escrow
- Supplier Discovery
- AI Purchasing

Phase 5

- AI Commerce Infrastructure
- Enterprise Dashboard
- Autonomous Business Workflows

---

# Core Value Proposition

Traditional Wallet

Human performs every transaction manually.

Smart Wallet

Basic automation.

Pay3

AI agents can securely discover financial opportunities, make decisions, execute blockchain transactions, interact with DeFi, and pay merchants autonomously while always remaining inside programmable user-defined policies.

---

# One-Line Pitch

Pay3 is an MCP-powered AI financial operating system on Stellar that enables AI agents to securely manage wallets, interact with DeFi, and make autonomous payments using Soroban session keys and programmable policies.